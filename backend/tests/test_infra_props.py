"""Hypothesis property-based tests for backend infrastructure modules.

Covers:
- app.image_utils (sniffing arbitrary bytes, PNG/JPEG size decoding, EXIF orientation)
- app.scene_cache (key determinism & uniqueness, bounded capacity, get-after-put round-trip, monotonic TTL expiry)
- app.limits (fresh client key allowance, sliding window rate limit guarantee)
"""

from __future__ import annotations

import struct
import unittest.mock

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from app.image_utils import (
    sniff_image_dimensions,
    sniff_image_format,
)
from app.limits import (
    RATE_WINDOW_SECONDS,
    RequestGuardMiddleware,
    reset_rate_limits,
)
from app.scene_cache import (
    SceneCache,
    image_key,
)

# ---------------------------------------------------------------------------
# image_utils properties (P21 - P24)
# ---------------------------------------------------------------------------


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(st.binary(min_size=0, max_size=4096))
def test_p21_image_dimensions_never_raises_on_arbitrary_bytes(data: bytes) -> None:
    """P21: Dimension sniffing never raises on arbitrary bytes, returning None or (width, height) >= 0."""
    dims = sniff_image_dimensions(data)
    if dims is not None:
        assert isinstance(dims, tuple)
        assert len(dims) == 2
        width, height = dims
        assert isinstance(width, int) and isinstance(height, int)
        assert width >= 0 and height >= 0

    fmt = sniff_image_format(data)
    assert fmt is None or fmt in ("image/png", "image/jpeg", "image/webp")


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    width=st.integers(min_value=1, max_value=65535),
    height=st.integers(min_value=1, max_value=65535),
    extra=st.binary(min_size=0, max_size=128),
)
def test_p22_image_dimensions_png_returns_encoded_size(
    width: int, height: int, extra: bytes
) -> None:
    """P22: Valid generated PNG headers decode to their exact encoded (width, height)."""
    header = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        + struct.pack(">II", width, height)
        + b"\x08\x02\x00\x00\x00\x00\x00\x00\x00"
        + extra
    )
    dims = sniff_image_dimensions(header)
    assert dims == (width, height)
    assert sniff_image_format(header) == "image/png"


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    width=st.integers(min_value=1, max_value=65535),
    height=st.integers(min_value=1, max_value=65535),
    sof_marker=st.sampled_from(
        [0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]
    ),
    include_app0=st.booleans(),
)
def test_p23_image_dimensions_jpeg_returns_encoded_size(
    width: int, height: int, sof_marker: int, include_app0: bool
) -> None:
    """P23: Valid generated JPEG headers with any SOF marker return their exact encoded (width, height)."""
    app0_segment = b""
    if include_app0:
        app0_payload = b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        app0_segment = b"\xff\xe0" + struct.pack(">H", len(app0_payload) + 2) + app0_payload

    sof_payload = (
        b"\x08" + struct.pack(">HH", height, width) + b"\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
    )
    sof_segment = (
        b"\xff" + bytes([sof_marker]) + struct.pack(">H", len(sof_payload) + 2) + sof_payload
    )
    jpeg_data = b"\xff\xd8" + app0_segment + sof_segment

    dims = sniff_image_dimensions(jpeg_data)
    assert dims == (width, height)
    assert sniff_image_format(jpeg_data) == "image/jpeg"


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    raw_width=st.integers(min_value=1, max_value=65534),
    raw_height=st.integers(min_value=1, max_value=65534),
    orientation=st.integers(min_value=1, max_value=8),
    endian=st.sampled_from(["II", "MM"]),
)
def test_p24_image_dimensions_jpeg_exif_orientation_swaps_dimensions(
    raw_width: int, raw_height: int, orientation: int, endian: str
) -> None:
    """P24: EXIF orientation tags 5-8 swap (height, width) into (width, height); 1-4 preserve them."""
    if raw_width == raw_height:
        raw_height += 1

    endian_char = "<" if endian == "II" else ">"
    magic_bytes = b"II*\x00" if endian == "II" else b"MM\x00*"

    app1_payload = (
        b"Exif\x00\x00"
        + magic_bytes
        + struct.pack(endian_char + "I", 8)
        + struct.pack(endian_char + "H", 1)
        + struct.pack(endian_char + "H", 0x0112)
        + struct.pack(endian_char + "H", 3)
        + struct.pack(endian_char + "I", 1)
        + struct.pack(endian_char + "H", orientation)
        + b"\x00\x00"
        + struct.pack(endian_char + "I", 0)
    )
    app1_segment = b"\xff\xe1" + struct.pack(">H", len(app1_payload) + 2) + app1_payload

    sof_payload = (
        b"\x08"
        + struct.pack(">HH", raw_height, raw_width)
        + b"\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
    )
    sof_segment = b"\xff\xc0" + struct.pack(">H", len(sof_payload) + 2) + sof_payload
    jpeg_data = b"\xff\xd8" + app1_segment + sof_segment

    dims = sniff_image_dimensions(jpeg_data)
    assert dims is not None

    if orientation in (5, 6, 7, 8):
        assert dims == (raw_height, raw_width)
    else:
        assert dims == (raw_width, raw_height)


# ---------------------------------------------------------------------------
# scene_cache properties (P25 - P28)
# ---------------------------------------------------------------------------


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    image1=st.binary(min_size=1, max_size=512),
    image2=st.binary(min_size=1, max_size=512),
    prompt=st.text(min_size=0, max_size=100),
    version=st.one_of(st.integers(min_value=1, max_value=100), st.text(min_size=1, max_size=20)),
)
def test_p25_scene_cache_key_deterministic_and_collision_free(
    image1: bytes, image2: bytes, prompt: str, version: int | str
) -> None:
    """P25: Identical image bytes yield the same cache key; distinct image bytes yield distinct keys."""
    key1_a = image_key(image1, prompt, version)
    key1_b = image_key(image1, prompt, version)
    assert key1_a == key1_b
    assert len(key1_a) == 64

    if image1 != image2:
        key2 = image_key(image2, prompt, version)
        assert key1_a != key2


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    max_entries=st.integers(min_value=0, max_value=15),
    items=st.lists(
        st.tuples(
            st.text(min_size=1, max_size=8),
            st.sampled_from(["ai", "raw", "other"]),
            st.text(max_size=8),
        ),
        min_size=0,
        max_size=40,
    ),
)
def test_p26_scene_cache_size_bound_never_exceeded(
    max_entries: int, items: list[tuple[str, str, str]]
) -> None:
    """P26: The scene cache never holds more than max_entries items after any sequence of puts."""
    cache = SceneCache(max_entries=max_entries, ttl_seconds=3600.0)
    for key, mode, provider in items:
        payload = {"mode": mode, "scene": {"title": key}}
        cache.put(key, payload, provider)
        assert len(cache) <= max(0, max_entries)

    assert len(cache) <= max(0, max_entries)
    if max_entries == 0:
        assert len(cache) == 0
        assert not cache.enabled


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    max_entries=st.integers(min_value=2, max_value=10),
    data_str=st.text(min_size=1, max_size=30),
    provider=st.text(min_size=1, max_size=10),
    extra_count=st.integers(min_value=0, max_value=8),
)
def test_p27_scene_cache_get_after_put_returns_stored_scene(
    max_entries: int, data_str: str, provider: str, extra_count: int
) -> None:
    """P27: A get after a put returns the stored scene unless evicted by newer entries."""
    cache = SceneCache(max_entries=max_entries, ttl_seconds=3600.0)
    target_key = "target_key"
    target_payload = {"mode": "ai", "data": data_str}
    cache.put(target_key, target_payload, provider)

    # Immediately after put, target must exist and return an independent deep copy
    res = cache.get(target_key)
    assert res is not None
    stored_payload, stored_provider = res
    assert stored_payload == target_payload
    assert stored_provider == provider

    # Mutating returned copy must not affect cache contents
    stored_payload["data"] = "mutated_value"
    refreshed = cache.get(target_key)
    assert refreshed is not None
    assert refreshed[0]["data"] == data_str

    # Put extra_count unique new items (all distinct from target_key)
    for i in range(extra_count):
        cache.put(f"extra_{i}", {"mode": "ai", "data": f"extra_{i}"}, "provider")

    # If extra_count < max_entries, target_key cannot have been evicted
    if extra_count < max_entries:
        survived = cache.get(target_key)
        assert survived is not None
        assert survived[0]["data"] == data_str


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    ttl=st.floats(min_value=1.0, max_value=3600.0, allow_nan=False, allow_infinity=False),
    dt1=st.floats(min_value=0.0, max_value=0.99, allow_nan=False, allow_infinity=False),
    dt2=st.floats(min_value=0.01, max_value=1000.0, allow_nan=False, allow_infinity=False),
    dt3=st.floats(min_value=0.01, max_value=1000.0, allow_nan=False, allow_infinity=False),
)
def test_p28_scene_cache_ttl_expiry_monotonic(
    ttl: float, dt1: float, dt2: float, dt3: float
) -> None:
    """P28: Cache expiry is strictly monotonic: valid before TTL, expired after TTL, never revives."""
    current_time = 1000.0
    cache = SceneCache(max_entries=10, ttl_seconds=ttl, clock=lambda: current_time)

    key = "ttl_test_key"
    payload = {"mode": "ai", "scene": {"id": 1}}
    cache.put(key, payload, "prov")

    # 1. Before TTL: valid and readable
    current_time = 1000.0 + (ttl * dt1)
    hit = cache.get(key)
    assert hit is not None
    assert hit[0] == payload

    # 2. Past TTL: expired and returns None
    current_time = 1000.0 + ttl + dt2
    miss = cache.get(key)
    assert miss is None

    # 3. Monotonic: further in the future, it stays expired and never revives
    current_time = 1000.0 + ttl + dt2 + dt3
    assert cache.get(key) is None


# ---------------------------------------------------------------------------
# limits properties (P29 - P30)
# ---------------------------------------------------------------------------


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    client_id=st.text(min_size=1, max_size=30),
    path=st.sampled_from(["/api/v1/scene", "/api/v1/ask", "/api/v1/validate"]),
    per_minute=st.integers(min_value=1, max_value=100),
)
def test_p29_limits_fresh_key_always_allowed(client_id: str, path: str, per_minute: int) -> None:
    """P29: A client key never seen before (or after reset) is always granted on its first request."""
    reset_rate_limits()
    middleware = RequestGuardMiddleware(
        app=unittest.mock.AsyncMock(),
        body_limits={},
        rate_limits={path: per_minute},
    )
    assert middleware._allow(client_id, path, per_minute) is True


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(
    per_minute=st.integers(min_value=1, max_value=10),
    deltas=st.lists(
        st.floats(min_value=0.0, max_value=30.0, allow_nan=False, allow_infinity=False),
        min_size=5,
        max_size=40,
    ),
)
def test_p30_limits_rate_limiter_never_exceeds_n_per_window(
    per_minute: int, deltas: list[float]
) -> None:
    """P30: Rate limiter never permits more than per_minute requests within any sliding 60-second window."""
    reset_rate_limits()
    middleware = RequestGuardMiddleware(
        app=unittest.mock.AsyncMock(),
        body_limits={},
        rate_limits={"/api/v1/scene": per_minute},
    )
    client = "rate_test_client"
    path = "/api/v1/scene"

    simulated_time = 1000.0
    accepted_times: list[float] = []

    for d in deltas:
        simulated_time += d
        with unittest.mock.patch("time.monotonic", return_value=simulated_time):
            if middleware._allow(client, path, per_minute):
                accepted_times.append(simulated_time)

    # Invariant: for every accepted request at T, the count of accepted requests
    # in (T - RATE_WINDOW_SECONDS, T] must not exceed per_minute
    for t_acc in accepted_times:
        window_hits = sum(1 for t in accepted_times if t_acc - RATE_WINDOW_SECONDS < t <= t_acc)
        assert window_hits <= per_minute
