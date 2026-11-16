"""Tests for HX2 per-client paid call budget and circuit breaker.

Verifies:
- Interleaving consumes across up to 5 clients (Hypothesis property test).
- Client A exhausted does not block Client B.
- Date rollover resets client and global budgets.
- Cap 0 or unset equals old behaviour.
- Table cap holds (20_000 keys) without eviction.
- Endpoint POST /api/v1/scene returns mode 'raw' with reason 'budget_exhausted'
  for capped client and mode 'ai' for another client.
- Warning is logged once per client per day without leaking client key.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Any

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from hypothesis import given, settings
from hypothesis import strategies as st

import app.paid_budget as pb
from app.main import app, get_provider_chain
from app.paid_budget import (
    CLIENT_LEDGER_CAP,
    budget_client,
    get_client_consumed,
    get_client_daily_limit,
    get_consumed,
    is_budget_exhausted,
    reset_budget,
    set_budget_client,
    set_clock_for_testing,
    try_consume,
)
from app.scene_cache import scene_cache
from app.vision.base import VisionError
from app.vision.chain import ProviderChain

VALID_SCENE_DICT: dict[str, Any] = {
    "version": 1,
    "kind": "geometry",
    "title": "Right Triangle",
    "points": [
        {"id": "p1", "x": 0.2, "y": 0.8, "label": "vertex A"},
        {"id": "p2", "x": 0.8, "y": 0.8, "label": "vertex B"},
        {"id": "p3", "x": 0.8, "y": 0.2, "label": "vertex C"},
    ],
    "segments": [
        {"id": "s1", "a": "p1", "b": "p2", "label": "base AB"},
        {"id": "s2", "a": "p2", "b": "p3", "label": "height BC"},
        {"id": "s3", "a": "p1", "b": "p3", "label": "hypotenuse AC"},
    ],
    "polylines": [],
    "bars": [],
    "axes": None,
    "facts": ["angle B = 90°", "AB = 3 cm", "BC = 4 cm"],
}
VALID_SCENE_JSON = json.dumps(VALID_SCENE_DICT)


def make_test_image_bytes(width: int = 100, height: int = 100) -> bytes:
    """Create a simple synthetic image for scene tests."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (width - 20, height - 20), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


class FakeVisionProvider:
    """Fake VisionProvider that consumes 1 paid call and returns canned scene."""

    def __init__(self, name: str, canned_json: str) -> None:
        self.name = name
        self.canned_json = canned_json
        self.call_count = 0

    async def extract(
        self,
        image: bytes,
        mime: str,
        prompt: str,
        *,
        timeout: float,
    ) -> str:
        self.call_count += 1
        if not try_consume(1):
            raise VisionError(self.name, "paid call budget exhausted", transient=False)
        return self.canned_json


@pytest.fixture(autouse=True)
def clean_state() -> Generator[None, None, None]:
    """Ensure clean budget, contextvar, and dependency overrides for every test."""
    reset_budget()
    budget_client.set(None)
    scene_cache.clear()
    app.dependency_overrides.clear()
    yield
    reset_budget()
    budget_client.set(None)
    scene_cache.clear()
    app.dependency_overrides.clear()


@given(
    global_limit=st.integers(min_value=1, max_value=30),
    client_cap=st.integers(min_value=1, max_value=10),
    actions=st.lists(
        st.tuples(
            st.integers(min_value=0, max_value=4),
            st.integers(min_value=1, max_value=5),
        ),
        min_size=1,
        max_size=40,
    ),
)
@settings(max_examples=40)
def test_hypothesis_interleaving_clients_within_caps(
    global_limit: int,
    client_cap: int,
    actions: list[tuple[int, int]],
) -> None:
    """For any interleaving of consumes across up to 5 clients:

    Each client's count <= its cap and the total <= the global cap.
    """
    old_global = os.environ.get("PAID_CALLS_PER_DAY")
    old_client = os.environ.get("PAID_CALLS_PER_CLIENT_PER_DAY")
    try:
        os.environ["PAID_CALLS_PER_DAY"] = str(global_limit)
        os.environ["PAID_CALLS_PER_CLIENT_PER_DAY"] = str(client_cap)
        reset_budget()

        clients = [f"client_{i}" for i in range(5)]
        expected_client_counts = {c: 0 for c in clients}
        expected_total = 0

        for client_idx, n in actions:
            c_id = clients[client_idx]
            token = set_budget_client(c_id)

            curr_c = expected_client_counts[c_id]
            would_exceed_client = curr_c + n > client_cap
            would_exceed_global = expected_total + n > global_limit

            ok = try_consume(n)
            if would_exceed_client or would_exceed_global:
                assert ok is False
            else:
                assert ok is True
                expected_client_counts[c_id] += n
                expected_total += n

            budget_client.reset(token)

        for c_id in clients:
            actual_c = get_client_consumed(c_id)
            assert actual_c <= client_cap
            assert actual_c == expected_client_counts[c_id]

        actual_total = get_consumed()
        assert actual_total <= global_limit
        assert actual_total == expected_total
        assert sum(expected_client_counts.values()) == actual_total
    finally:
        if old_global is not None:
            os.environ["PAID_CALLS_PER_DAY"] = old_global
        else:
            os.environ.pop("PAID_CALLS_PER_DAY", None)
        if old_client is not None:
            os.environ["PAID_CALLS_PER_CLIENT_PER_DAY"] = old_client
        else:
            os.environ.pop("PAID_CALLS_PER_CLIENT_PER_DAY", None)


def test_client_a_exhausted_does_not_block_client_b(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A exhausted does not block B."""
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "10")
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "2")
    reset_budget()

    # Client A consumes 2 calls and reaches cap
    token_a = set_budget_client("client_A")
    assert is_budget_exhausted() is False
    assert try_consume(1) is True
    assert is_budget_exhausted() is False
    assert try_consume(1) is True
    assert is_budget_exhausted() is True
    assert try_consume(1) is False
    budget_client.reset(token_a)

    # Client B is not blocked
    token_b = set_budget_client("client_B")
    assert is_budget_exhausted() is False
    assert try_consume(1) is True
    assert get_client_consumed("client_B") == 1
    assert try_consume(1) is True
    assert get_client_consumed("client_B") == 2
    assert is_budget_exhausted() is True
    assert try_consume(1) is False
    budget_client.reset(token_b)

    # Client A is still exhausted
    token_a2 = set_budget_client("client_A")
    assert is_budget_exhausted() is True
    assert try_consume(1) is False
    budget_client.reset(token_a2)

    assert get_client_consumed("client_A") == 2
    assert get_client_consumed("client_B") == 2
    assert get_consumed() == 4


def test_date_rollover_resets_client_and_global_budgets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Date rollover resets client and global consumption."""
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "10")
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "2")
    reset_budget()

    day1 = datetime(2026, 11, 16, 12, 0, 0, tzinfo=UTC)
    current_time = day1

    def test_clock() -> datetime:
        return current_time

    set_clock_for_testing(test_clock)

    token_a = set_budget_client("client_A")
    assert try_consume(2) is True
    assert is_budget_exhausted() is True
    assert try_consume(1) is False
    assert get_client_consumed("client_A") == 2
    assert get_consumed() == 2

    # Advance clock to next UTC day
    current_time = day1 + timedelta(days=1)

    # After rollover, client A is reset
    assert is_budget_exhausted() is False
    assert try_consume(1) is True
    assert get_client_consumed("client_A") == 1
    assert get_consumed() == 1
    budget_client.reset(token_a)

    set_clock_for_testing(None)


def test_cap_zero_or_unset_equals_old_behaviour(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cap 0 or unset equals old behaviour (no per-client cap)."""
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "5")

    # 1. Unset
    monkeypatch.delenv("PAID_CALLS_PER_CLIENT_PER_DAY", raising=False)
    reset_budget()
    assert get_client_daily_limit() == 0

    token = set_budget_client("single_client")
    for _ in range(5):
        assert is_budget_exhausted() is False
        assert try_consume(1) is True
    assert is_budget_exhausted() is True
    assert try_consume(1) is False
    assert get_consumed() == 5
    budget_client.reset(token)

    # 2. Cap = "0"
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "0")
    reset_budget()
    assert get_client_daily_limit() == 0

    token = set_budget_client("single_client")
    for _ in range(5):
        assert is_budget_exhausted() is False
        assert try_consume(1) is True
    assert is_budget_exhausted() is True
    assert try_consume(1) is False
    budget_client.reset(token)

    # 3. Invalid value "invalid"
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "invalid")
    assert get_client_daily_limit() == 0

    # 4. Negative value "-5"
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "-5")
    assert get_client_daily_limit() == 0


def test_table_cap_holds_refuses_new_keys_without_eviction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Per-client ledger capped at 20_000: refuses new keys rather than evicting."""
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "50000")
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "10")
    reset_budget()

    with pb._lock:
        pb._current_date = pb._get_utc_date_str()
        for i in range(CLIENT_LEDGER_CAP):
            pb._client_ledger[f"client_{i}"] = 1
        pb._consumed_count = CLIENT_LEDGER_CAP

    assert len(pb._client_ledger) == CLIENT_LEDGER_CAP

    # A new key (client_new_over_cap) tries to consume
    token_new = set_budget_client("client_new_over_cap")
    assert is_budget_exhausted() is True
    assert try_consume(1) is False
    budget_client.reset(token_new)

    # Table length did not exceed cap and no eviction occurred
    assert len(pb._client_ledger) == CLIENT_LEDGER_CAP
    assert "client_new_over_cap" not in pb._client_ledger
    assert "client_0" in pb._client_ledger

    # Existing key can still consume
    token_existing = set_budget_client("client_0")
    assert is_budget_exhausted() is False
    assert try_consume(1) is True
    assert pb._client_ledger["client_0"] == 2
    assert len(pb._client_ledger) == CLIENT_LEDGER_CAP
    budget_client.reset(token_existing)


def test_endpoint_scene_capped_client_raw_other_client_ai(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/v1/scene returns 'raw'/'budget_exhausted' for capped client, 'ai' for another."""
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "100")
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "1")
    reset_budget()

    fake_provider = FakeVisionProvider("fake_gemini", VALID_SCENE_JSON)
    chain = ProviderChain([fake_provider])
    app.dependency_overrides[get_provider_chain] = lambda: chain

    client = TestClient(app)

    img_a1 = make_test_image_bytes(100, 100)
    img_a2 = make_test_image_bytes(120, 120)
    img_b1 = make_test_image_bytes(140, 140)

    client_a_headers = {"X-Forwarded-For": "198.51.100.1"}
    client_b_headers = {"X-Forwarded-For": "198.51.100.2"}

    # Request 1 from Client A: succeeds with AI mode
    res1 = client.post(
        "/api/v1/scene",
        files={"image": ("test_a1.png", img_a1, "image/png")},
        headers=client_a_headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["mode"] == "ai"
    assert res1.headers.get("X-Vision-Provider") == "ai"
    assert fake_provider.call_count == 1

    # Request 2 from Client A: Client A has consumed its 1 allowed call.
    # Returns mode 'raw' with reason 'budget_exhausted'
    res2 = client.post(
        "/api/v1/scene",
        files={"image": ("test_a2.png", img_a2, "image/png")},
        headers=client_a_headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["mode"] == "raw"
    assert data2["reason"] == "budget_exhausted"
    assert res2.headers.get("X-Vision-Provider") == "raw"
    assert fake_provider.call_count == 1

    # Request 1 from Client B: Client B is unexhausted and succeeds with mode 'ai'
    res3 = client.post(
        "/api/v1/scene",
        files={"image": ("test_b1.png", img_b1, "image/png")},
        headers=client_b_headers,
    )
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["mode"] == "ai"
    assert res3.headers.get("X-Vision-Provider") == "ai"
    assert fake_provider.call_count == 2


def test_logging_once_per_client_per_day_without_key(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Warning is logged once per client per day, without the key itself."""
    monkeypatch.setenv("PAID_CALLS_PER_DAY", "100")
    monkeypatch.setenv("PAID_CALLS_PER_CLIENT_PER_DAY", "2")
    reset_budget()

    secret_key = "secret_client_ip_192_0_2_99"
    token = set_budget_client(secret_key)
    assert try_consume(2) is True

    with caplog.at_level(logging.WARNING, logger="app.paid_budget"):
        assert try_consume(1) is False
        assert try_consume(1) is False

    records = [
        r for r in caplog.records if r.name == "app.paid_budget" and r.levelno == logging.WARNING
    ]
    assert len(records) == 1
    record = records[0]
    msg = record.getMessage()
    assert secret_key not in msg
    assert "Per-client paid call budget exhausted" in msg
    budget_client.reset(token)
