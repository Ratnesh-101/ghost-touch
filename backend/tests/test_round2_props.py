"""Round 2 backend properties P40, P41, P42, P45, P46 (Hypothesis).

P43 and P44 live in the frontend (fast-check). Each property here was also run against a
deliberately broken version of the code (see docs/kiro-evidence/round2.md).
"""

from __future__ import annotations

import string

import pytest
from hypothesis import HealthCheck, example, given, settings
from hypothesis import strategies as st
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.ask import (
    DONT_KNOW_RESPONSES,
    MAX_ANSWER_CHARS,
    MAX_ANSWER_SENTENCES,
    SENTENCE_END_PATTERN,
    clamp_answer,
    is_dont_know,
)
from app.limits import (
    _HITS,
    MAX_CLIENT_KEY_CHARS,
    RATE_WINDOW_SECONDS,
    SWEEP_INTERVAL_SECONDS,
    RequestGuardMiddleware,
    client_key,
    normalize_path,
    reset_rate_limits,
)

PROPS = settings(max_examples=300, deadline=None, suppress_health_check=[HealthCheck.too_slow])

ip_text = st.from_regex(r"[0-9]{1,3}(\.[0-9]{1,3}){3}", fullmatch=True)
header_entry = st.text(
    alphabet=string.ascii_letters + string.digits + ".:-_", min_size=1, max_size=20
)


@pytest.fixture(autouse=True)
def _clean_limiter() -> None:
    reset_rate_limits()


# ---------------------------------------------------------------------------
# P40: the client key cannot be forged through X-Forwarded-For
# ---------------------------------------------------------------------------


@PROPS
@given(peer=ip_text, forged=st.lists(header_entry, max_size=6))
def test_p40_no_trusted_proxy_means_the_peer_decides(peer: str, forged: list[str]) -> None:
    header = ", ".join(forged) if forged else None
    assert client_key(peer, header, 0) == client_key(peer, None, 0) == peer[:MAX_CLIENT_KEY_CHARS]


@PROPS
@given(
    peer=ip_text,
    forged=st.lists(header_entry, max_size=6),
    appended=st.lists(ip_text, min_size=1, max_size=3),
)
def test_p40_entries_left_of_the_trusted_hops_are_never_read(
    peer: str, forged: list[str], appended: list[str]
) -> None:
    hops = len(appended)
    honest = ", ".join(appended)
    forged_header = ", ".join([*forged, *appended])
    assert client_key(peer, forged_header, hops) == client_key(peer, honest, hops)
    assert len(client_key(peer, forged_header, hops)) <= MAX_CLIENT_KEY_CHARS


# ---------------------------------------------------------------------------
# P41: limiter state stays bounded
# ---------------------------------------------------------------------------


async def _noop(scope, receive, send) -> None:  # type: ignore[no-untyped-def]
    return None


@PROPS
@given(
    steps=st.lists(
        st.tuples(st.integers(0, 40), st.floats(0.0, 90.0, allow_nan=False)),
        min_size=1,
        max_size=80,
    ),
    per_minute=st.integers(1, 5),
)
def test_p41_limiter_holds_no_empty_window_and_no_long_expired_client(
    steps: list[tuple[int, float]], per_minute: int
) -> None:
    reset_rate_limits()
    mw = RequestGuardMiddleware(_noop, body_limits={}, rate_limits={"/api/v1/ask": per_minute})
    now = 1000.0
    last_seen: dict[str, float] = {}
    for client_index, delta in steps:
        now += delta
        client = f"10.0.0.{client_index}"
        mw._allow(client, "/api/v1/ask", per_minute, now=now)
        last_seen[client] = now
        assert all(len(window) > 0 for window in _HITS.values())
        slack = RATE_WINDOW_SECONDS + SWEEP_INTERVAL_SECONDS
        recently_active = {c for c, t in last_seen.items() if now - t <= slack}
        assert {c for c, _ in _HITS} <= recently_active


# ---------------------------------------------------------------------------
# P42: guards are path-normalisation invariant
# ---------------------------------------------------------------------------

GUARDED = ["/api/v1/scene", "/api/v1/ask", "/api/v1/validate"]


def _variant(route: str, extra: list[int], trailing: int) -> str:
    parts = [p for p in route.split("/") if p]
    out = "/" * (1 + extra[0]) + ("/" * (1 + extra[1])).join(parts)
    return out + "/" * trailing


@PROPS
@given(
    route=st.sampled_from(GUARDED),
    extra=st.lists(st.integers(0, 3), min_size=2, max_size=2),
    trailing=st.integers(0, 4),
)
def test_p42_normalised_path_is_the_route(route: str, extra: list[int], trailing: int) -> None:
    variant = _variant(route, extra, trailing)
    assert normalize_path(variant) == route
    assert normalize_path(normalize_path(variant)) == normalize_path(variant)


def _guarded_client(limit: int) -> TestClient:
    async def ok(request):  # type: ignore[no-untyped-def]
        return PlainTextResponse("ok")

    app = Starlette(
        routes=[Route(r, ok, methods=["POST"]) for r in GUARDED],
    )
    wrapped = RequestGuardMiddleware(app, body_limits={}, rate_limits={r: limit for r in GUARDED})
    return TestClient(wrapped)


@settings(max_examples=60, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    route=st.sampled_from(["/api/v1/ask", "/api/v1/validate"]),
    variants=st.lists(
        st.tuples(st.lists(st.integers(0, 2), min_size=2, max_size=2), st.integers(0, 2)),
        min_size=4,
        max_size=4,
    ),
)
def test_p42_any_mix_of_slash_variants_shares_one_rate_limit(
    route: str, variants: list[tuple[list[int], int]]
) -> None:
    reset_rate_limits()
    client = _guarded_client(limit=3)
    paths = [_variant(route, extra, trailing) for extra, trailing in variants]
    # Requests with a double slash at the start are valid paths for TestClient only via a full URL,
    # so send them with an explicit base URL to keep the leading slashes.
    statuses = [
        client.post("http://testserver" + path, follow_redirects=False).status_code
        for path in paths
    ]
    # Starlette may answer 307/404 for odd slash forms; what matters is that the guard counts them
    # all against the same budget: three pass the guard, the fourth is rate limited.
    assert 429 not in statuses[:3]
    assert statuses[3] == 429


# ---------------------------------------------------------------------------
# P45: fact answers are bounded
# ---------------------------------------------------------------------------

answer_text = st.one_of(
    st.text(alphabet=st.characters(blacklist_categories=("Cs",)), max_size=800),
    # Long runs with no space or only rare spaces: the shape that once produced 301 characters.
    st.text(alphabet="abc", min_size=290, max_size=700),
    st.text(alphabet="ab ", min_size=290, max_size=700),
)


@PROPS
@example("a" * 400)
@example("a" * 299 + " " + "b" * 50)
@given(text=answer_text)
def test_p45_clamped_answer_is_bounded(text: str) -> None:
    out = clamp_answer(text)
    assert len(out) <= MAX_ANSWER_CHARS
    sentences = [s for s in SENTENCE_END_PATTERN.split(out.strip()) if s.strip()]
    assert len(sentences) <= MAX_ANSWER_SENTENCES


@PROPS
@given(text=answer_text)
def test_p45_clamping_twice_equals_clamping_once(text: str) -> None:
    once = clamp_answer(text)
    assert clamp_answer(once) == once


# ---------------------------------------------------------------------------
# P46: "don't know" ignores trailing punctuation, in every language
# ---------------------------------------------------------------------------

TRAILERS = st.text(alphabet=" .।॥\t", max_size=6)


@PROPS
@given(lang=st.sampled_from(sorted(DONT_KNOW_RESPONSES)), trailer=TRAILERS)
def test_p46_dont_know_ignores_trailing_punctuation(lang: str, trailer: str) -> None:
    phrase = DONT_KNOW_RESPONSES[lang]
    base = phrase.rstrip(" .।॥")
    assert is_dont_know(phrase) is True
    assert is_dont_know(base + trailer) is True


EXACT_PHRASES = [
    "i don't know",
    "i do not know",
    "unknown",
    "don't know",
    "do not know",
    "not mentioned",
    "cannot determine",
]


@PROPS
@given(phrase=st.sampled_from(EXACT_PHRASES), trailer=TRAILERS)
def test_p46_exact_dont_know_phrases_ignore_trailing_punctuation(phrase: str, trailer: str) -> None:
    # These phrases are matched exactly (not as substrings), so a danda or full stop after them
    # must be stripped first.
    assert is_dont_know(phrase + trailer) is True


@PROPS
@given(trailer=TRAILERS)
def test_p46_punctuation_does_not_turn_an_answer_into_dont_know(trailer: str) -> None:
    assert is_dont_know("AB = 3 centimetres" + trailer) is False
