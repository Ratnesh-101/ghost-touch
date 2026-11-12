"""Tests for Nov 12 Kiro audit fixes (B-01, B-02, B-03) in lane r7-backend.

Covers:
- B-01: Raw Mode scene point cap ensuring <= 500 points and successful validation.
- B-02: Facts fallback retaining all tied winners (up to 3) in clamp_answer.
- B-03: TOKEN_PATTERN matching Devanagari and Gujarati combining marks whole.
"""

from __future__ import annotations

import io
from collections.abc import Generator

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.ask import (
    MAX_FACTS_ANSWER_SENTENCES,
    TOKEN_PATTERN,
    clamp_answer,
    facts_lookup,
)
from app.limits import reset_rate_limits
from app.main import app, get_provider_chain
from app.raw_mode import MAX_RAW_POINTS, build_raw_scene
from app.schema import DiagramScene, Point, Segment
from app.validate import validate_scene
from app.vision.chain import ProviderChain
from fixtures.triangle import triangle_scene


@pytest.fixture(autouse=True)
def _clean_overrides() -> Generator[None, None, None]:
    reset_rate_limits()
    app.dependency_overrides.clear()
    yield
    reset_rate_limits()
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def triangle() -> DiagramScene:
    return triangle_scene()


def _make_noisy_disjoint_lines_image(
    num_lines: int = 500,
    width: int = 1200,
    height: int = 1200,
    line_len: int = 60,
    seed: int = 42,
) -> bytes:
    """Draw many disjoint short lines on a high-res image (reproducing B-01 audit scenario)."""
    rng = np.random.RandomState(seed)
    img = np.zeros((height, width, 3), dtype=np.uint8)
    for _ in range(num_lines):
        x1 = rng.randint(10, width - line_len - 10)
        y1 = rng.randint(10, height - line_len - 10)
        angle = rng.uniform(0.0, 2.0 * np.pi)
        x2 = int(x1 + line_len * np.cos(angle))
        y2 = int(y1 + line_len * np.sin(angle))
        cv2.line(img, (x1, y1), (x2, y2), (255, 255, 255), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


# ---------------------------------------------------------------------------
# B-01 (High): Raw Mode points capped to <= 500 and passes validator
# ---------------------------------------------------------------------------


def test_raw_mode_scene_always_passes_validator_point_cap() -> None:
    """B-01: Busy noisy image produces <= 500 points and passes validate_scene."""
    img_bytes = _make_noisy_disjoint_lines_image(num_lines=500, seed=42)
    scene = build_raw_scene(img_bytes)

    assert isinstance(scene, DiagramScene)
    assert len(scene.points) <= MAX_RAW_POINTS
    assert len(scene.points) <= 500
    assert len(scene.segments) <= 300
    assert len(scene.segments) > 0

    val_res = validate_scene(scene.model_dump())
    assert val_res.scene is not None
    assert val_res.errors == []
    assert len(val_res.scene.points) <= 500


def test_raw_mode_endpoint_returns_200_raw_mode(client: TestClient) -> None:
    """B-01: POST /api/v1/scene with no providers returns 200 mode=raw on busy photo."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    img_bytes = _make_noisy_disjoint_lines_image(num_lines=500, seed=99)
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("busy.png", io.BytesIO(img_bytes), "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "raw"
    assert "scene" in data
    assert len(data["scene"]["points"]) <= 500
    assert len(data["scene"]["segments"]) <= 300


# ---------------------------------------------------------------------------
# B-02 (Medium): Facts answer keeps all tied winners (up to 3)
# ---------------------------------------------------------------------------


def test_facts_answer_names_every_requested_side(
    client: TestClient, triangle: DiagramScene
) -> None:
    """B-02: Asking for AB, BC and AC answers with all three tied facts without truncation."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    # 1. Direct facts_lookup returns all three facts
    fact_text = facts_lookup(triangle, "How long are AB, BC and AC?")
    assert fact_text is not None
    assert "AB" in fact_text
    assert "BC" in fact_text
    assert "AC" in fact_text

    # 2. clamp_answer preserves all three sentences for the facts path
    clamped = clamp_answer(fact_text, preserve_symbols=True)
    assert "AB" in clamped
    assert "BC" in clamped
    assert "AC" in clamped

    # 3. Full /api/v1/ask endpoint via facts fallback delivers all 3 in answer
    resp = client.post(
        "/api/v1/ask",
        json={
            "scene": triangle.model_dump(),
            "question": "How long are AB, BC and AC?",
            "lang": "en",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "facts"
    assert "AB" in data["answer"]
    assert "BC" in data["answer"]
    assert "AC" in data["answer"]


def test_clamp_answer_keeps_three_sentences_for_facts() -> None:
    """B-02: clamp_answer keeps up to 3 sentences when max_sentences=3 or facts path."""
    text = "AC = 4 cm. BC = 3 cm. AB = 5 cm."
    # With preserve_symbols=True, facts path default is 3 sentences
    assert clamp_answer(text, preserve_symbols=True) == "AC = 4 cm. BC = 3 cm. AB = 5 cm."
    # Explicit max_sentences=3
    assert (
        clamp_answer(text, max_sentences=MAX_FACTS_ANSWER_SENTENCES)
        == "AC = 4 cm. BC = 3 cm. AB = 5 cm."
    )
    # Default model output (preserve_symbols=False) remains clamped to 2 sentences
    assert clamp_answer(text) == "AC = 4 cm. BC = 3 cm."


# ---------------------------------------------------------------------------
# B-03 (Medium): Indic combining marks kept whole in TOKEN_PATTERN
# ---------------------------------------------------------------------------


def test_token_pattern_keeps_indic_words_whole() -> None:
    """B-03: TOKEN_PATTERN keeps Devanagari and Gujarati words with vowel marks whole."""
    # Hindi examples from audit
    assert TOKEN_PATTERN.findall("कितनी") == ["कितनी"]
    assert TOKEN_PATTERN.findall("कितना") == ["कितना"]
    assert TOKEN_PATTERN.findall("लंबाई") == ["लंबाई"]
    assert TOKEN_PATTERN.findall("कोण") == ["कोण"]
    assert TOKEN_PATTERN.findall("AB की लंबाई कितनी है") == ["AB", "की", "लंबाई", "कितनी", "है"]

    # Gujarati examples from audit
    assert TOKEN_PATTERN.findall("કેટલી") == ["કેટલી"]
    assert TOKEN_PATTERN.findall("કેટલું") == ["કેટલું"]
    assert TOKEN_PATTERN.findall("લંબાઈ") == ["લંબાઈ"]
    assert TOKEN_PATTERN.findall("ખૂણો") == ["ખૂણો"]
    assert TOKEN_PATTERN.findall("AB ની લંબાઈ કેટલી છે") == ["AB", "ની", "લંબાઈ", "કેટલી", "છે"]


def test_hindi_wrong_angle_not_answered(client: TestClient) -> None:
    """B-03: Facts with angle C only return source unknown for angle B or angle A question."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    scene = DiagramScene(
        kind="geometry",
        title="समकोण त्रिभुज",
        points=[
            Point(id="A", x=0.25, y=0.25, label="A"),
            Point(id="B", x=0.75, y=0.85, label="B"),
            Point(id="C", x=0.25, y=0.85, label="C"),
        ],
        segments=[
            Segment(id="s1", a="C", b="A", label="CA"),
            Segment(id="s2", a="A", b="B", label="AB"),
            Segment(id="s3", a="B", b="C", label="BC"),
        ],
        facts=["कोण C = 90°"],
    )

    # Asking about angle B must NOT match angle C fact; must return unknown
    resp_b = client.post(
        "/api/v1/ask",
        json={
            "scene": scene.model_dump(),
            "question": "कोण B कितना है",
            "lang": "hi",
        },
    )
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["source"] == "unknown"
    assert "ज्ञात नहीं है" in data_b["answer"]

    # Asking about angle A must also return unknown
    resp_a = client.post(
        "/api/v1/ask",
        json={
            "scene": scene.model_dump(),
            "question": "कोण A कितना है",
            "lang": "hi",
        },
    )
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["source"] == "unknown"
    assert "ज्ञात नहीं है" in data_a["answer"]

    # Asking about angle C must correctly answer from facts
    resp_c = client.post(
        "/api/v1/ask",
        json={
            "scene": scene.model_dump(),
            "question": "कोण C कितना है",
            "lang": "hi",
        },
    )
    assert resp_c.status_code == 200
    data_c = resp_c.json()
    assert data_c["source"] == "facts"
    assert "90" in data_c["answer"]


def test_gujarati_wrong_angle_not_answered(client: TestClient) -> None:
    """B-03: Facts with angle C only return source unknown for Gujarati angle B question."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    scene = DiagramScene(
        kind="geometry",
        title="કાટકોણ ત્રિકોણ",
        points=[
            Point(id="A", x=0.25, y=0.25, label="A"),
            Point(id="B", x=0.75, y=0.85, label="B"),
            Point(id="C", x=0.25, y=0.85, label="C"),
        ],
        segments=[
            Segment(id="s1", a="C", b="A", label="CA"),
            Segment(id="s2", a="A", b="B", label="AB"),
            Segment(id="s3", a="B", b="C", label="BC"),
        ],
        facts=["ખૂણો C = 90°"],
    )

    resp_b = client.post(
        "/api/v1/ask",
        json={
            "scene": scene.model_dump(),
            "question": "ખૂણો B કેટલો છે",
            "lang": "gu",
        },
    )
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["source"] == "unknown"
    assert "જાણ નથી" in data_b["answer"]

    resp_c = client.post(
        "/api/v1/ask",
        json={
            "scene": scene.model_dump(),
            "question": "ખૂણો C કેટલો છે",
            "lang": "gu",
        },
    )
    assert resp_c.status_code == 200
    data_c = resp_c.json()
    assert data_c["source"] == "facts"
    assert "90" in data_c["answer"]


def test_english_behavior_remains_unchanged(client: TestClient, triangle: DiagramScene) -> None:
    """B-03 regression: English questions and facts work exactly as before."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    resp_ab = client.post(
        "/api/v1/ask",
        json={
            "scene": triangle.model_dump(),
            "question": "What is the length of AB?",
            "lang": "en",
        },
    )
    assert resp_ab.status_code == 200
    assert resp_ab.json()["source"] == "facts"
    assert "5 cm" in resp_ab.json()["answer"]

    resp_ad = client.post(
        "/api/v1/ask",
        json={
            "scene": triangle.model_dump(),
            "question": "How long is AD?",
            "lang": "en",
        },
    )
    assert resp_ad.status_code == 200
    assert resp_ad.json()["source"] == "unknown"
    assert resp_ad.json()["answer"] == "I don't know from this diagram."


def test_facts_lookup_general_facts_hindi_and_gujarati() -> None:
    """B-03: General facts without IDs match single-content questions in Hindi/Gujarati."""
    scene_hi = DiagramScene(
        kind="geometry",
        facts=["क्षेत्रफल = 20 cm²"],
    )
    ans_hi = facts_lookup(scene_hi, "क्षेत्रफल कितना है?", lang="hi")
    assert ans_hi is not None
    assert "20" in ans_hi

    scene_gu = DiagramScene(
        kind="geometry",
        facts=["ક્ષેત્રફળ = 50 cm²"],
    )
    ans_gu = facts_lookup(scene_gu, "ક્ષેત્રફળ કેટલું છે?", lang="gu")
    assert ans_gu is not None
    assert "50" in ans_gu


def test_raw_mode_small_image_endpoint_returns_200(client: TestClient) -> None:
    """B-01: Tiny valid image (10x10) returns 200 mode raw without empty outline 422."""
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    cv2.rectangle(img, (1, 1), (8, 8), (255, 255, 255), 1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    resp = client.post(
        "/api/v1/scene",
        files={"image": ("tiny.png", io.BytesIO(buf.tobytes()), "image/png")},
    )
    assert resp.status_code == 200
    assert resp.headers["X-Vision-Provider"] == "raw"
    data = resp.json()
    assert data["mode"] == "raw"
