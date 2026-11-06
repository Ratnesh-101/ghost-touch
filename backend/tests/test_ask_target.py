"""Tests for Ask endpoint target validation and prompt construction.

Verifies:
- Valid element id kept in target
- Unknown element id dropped -> target: None
- Valid in-range point kept
- Out-of-range or non-finite xy dropped -> target: None
- Plain-text model reply unchanged (target: None)
- Model 'don't know' reply drops target
- Facts fallback path has target: None
- Malformed target payloads tolerated without 500
- Scene element IDs and navigation instructions listed in prompt
"""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.ask import (
    QUESTION_DELIMITER_END,
    QUESTION_DELIMITER_START,
    ElementTarget,
    PointTarget,
    build_ask_prompt,
    extract_scene_element_ids,
    parse_model_ask_output,
    validate_ask_target,
)
from app.main import app, get_provider_chain
from app.schema import Bar, DiagramScene, Point, Polyline, Segment
from app.vision.base import VisionError
from app.vision.chain import ProviderChain
from fixtures.triangle import triangle_scene


class FakeAskProvider:
    """Fake text provider for unit testing without network calls."""

    def __init__(
        self,
        name: str = "fake",
        response: str | Exception | None = None,
        responses: list[str | Exception] | None = None,
        delay: float = 0.0,
    ) -> None:
        self.name = name
        if responses is not None:
            self.responses = list(responses)
        elif response is not None:
            self.responses = [response]
        else:
            self.responses = []
        self.delay = delay
        self.prompts_received: list[str] = []
        self.call_count = 0

    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str:
        raise NotImplementedError("extract not used in text-only ask tests")

    async def complete(self, prompt: str, *, timeout: float) -> str:
        self.call_count += 1
        self.prompts_received.append(prompt)
        if self.delay > 0:
            await asyncio.sleep(self.delay)
        if not self.responses:
            raise VisionError(self.name, "No more canned responses")
        res = self.responses.pop(0)
        if isinstance(res, Exception):
            raise res
        return res


@pytest.fixture
def triangle() -> DiagramScene:
    return triangle_scene()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Valid elementId kept
# ---------------------------------------------------------------------------


def test_ask_target_valid_element_id_kept(client: TestClient, triangle: DiagramScene) -> None:
    model_output = json.dumps(
        {
            "answer": "Point A is at the top vertex.",
            "target": {"elementId": "A"},
        }
    )
    fake = FakeAskProvider("gemini", response=model_output)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "Where is point A?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert "Point A" in data["answer"]
        assert data["target"] == {"elementId": "A"}
    finally:
        app.dependency_overrides.clear()


def test_ask_target_valid_segment_id_in_markdown_block(
    client: TestClient, triangle: DiagramScene
) -> None:
    model_output = (
        '```json\n{"answer": "The hypotenuse is segment AB.", "target": {"elementId": "AB"}}\n```'
    )
    fake = FakeAskProvider("gemini", response=model_output)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "Find hypotenuse AB.",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert data["target"] == {"elementId": "AB"}
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 2. Unknown elementId dropped
# ---------------------------------------------------------------------------


def test_ask_target_unknown_element_id_dropped(client: TestClient, triangle: DiagramScene) -> None:
    model_output = json.dumps(
        {
            "answer": "Here is point Z.",
            "target": {"elementId": "Z_NON_EXISTENT"},
        }
    )
    fake = FakeAskProvider("gemini", response=model_output)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "Where is point Z?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert data["target"] is None
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 3. Valid in-range point kept
# ---------------------------------------------------------------------------


def test_ask_target_valid_point_kept(client: TestClient, triangle: DiagramScene) -> None:
    model_output = json.dumps(
        {
            "answer": "The centroid is at the bottom left.",
            "target": {"x": 0.25, "y": 0.85},
        }
    )
    fake = FakeAskProvider("gemini", response=model_output)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "Where is the centroid?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert data["target"] == {"x": 0.25, "y": 0.85}
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 4. Out-of-range xy dropped
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad_coords",
    [
        {"x": 1.5, "y": 0.5},
        {"x": -0.1, "y": 0.5},
        {"x": 0.5, "y": 2.0},
        {"x": 0.5, "y": -0.5},
        {"x": "nan", "y": 0.5},
        {"x": True, "y": 0.5},
    ],
)
def test_ask_target_out_of_range_xy_dropped(
    client: TestClient, triangle: DiagramScene, bad_coords: dict[str, object]
) -> None:
    model_output = json.dumps(
        {
            "answer": "Out of bounds point.",
            "target": bad_coords,
        }
    )
    fake = FakeAskProvider("gemini", response=model_output)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "Where is it?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert data["target"] is None
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 5. Plain-text model reply unchanged
# ---------------------------------------------------------------------------


def test_ask_target_plain_text_reply_unchanged(client: TestClient, triangle: DiagramScene) -> None:
    fake = FakeAskProvider("gemini", response="The hypotenuse AB is 5 cm long.")
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "What is the length of AB?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert data["answer"] == "The hypotenuse AB is 5 cm long."
        assert data["target"] is None
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 6. Model 'don't know' reply drops target
# ---------------------------------------------------------------------------


def test_ask_target_dont_know_drops_target(client: TestClient, triangle: DiagramScene) -> None:
    model_output = json.dumps(
        {
            "answer": "I don't know from this diagram.",
            "target": {"elementId": "A"},
        }
    )
    fake = FakeAskProvider("gemini", response=model_output)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "What colour is the triangle?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "unknown"
        assert data["target"] is None
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 7. Facts path has no target
# ---------------------------------------------------------------------------


def test_ask_target_facts_path_has_no_target(client: TestClient, triangle: DiagramScene) -> None:
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "What is the length of AB?",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "facts"
        assert "5 cm" in data["answer"]
        assert data["target"] is None
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 8. Malformed target junk tolerated without raising
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "junk_target",
    [
        "A",
        123,
        True,
        [],
        ["A"],
        {},
        {"unknownKey": "val"},
        {"elementId": ""},
        {"elementId": None},
        {"elementId": 123},
        {"x": 0.5},
        {"y": 0.5},
        {"elementId": "A", "x": 0.5},
        {"elementId": " A "},
    ],
)
def test_ask_target_junk_tolerated(
    client: TestClient, triangle: DiagramScene, junk_target: object
) -> None:
    model_output = json.dumps(
        {
            "answer": "Some answer here.",
            "target": junk_target,
        }
    )
    fake = FakeAskProvider("gemini", response=model_output)
    app.dependency_overrides[get_provider_chain] = lambda: ProviderChain([fake])

    try:
        resp = client.post(
            "/api/v1/ask",
            json={
                "scene": triangle.model_dump(),
                "question": "Find something.",
                "lang": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "ai"
        assert data["target"] is None
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 9. Prompt contains scene element ids and navigation instructions
# ---------------------------------------------------------------------------


def test_build_ask_prompt_lists_element_ids() -> None:
    scene = DiagramScene(
        kind="bar_chart",
        title="Sample Chart",
        points=[Point(id="pt_origin", x=0.1, y=0.9, label="Origin")],
        segments=[Segment(id="seg_axis", a="pt_origin", b="pt_origin", label="Axis")],
        polylines=[Polyline(id="poly_trend", points=[[0.1, 0.9], [0.5, 0.5]], label="Trend")],
        bars=[Bar(id="bar_2020", x0=0.2, x1=0.3, y_top=0.4, y_base=0.9, label="2020", value=50.0)],
        facts=["Revenue in 2020 was 50"],
    )

    ids = extract_scene_element_ids(scene)
    assert ids == ["pt_origin", "seg_axis", "poly_trend", "bar_2020"]

    prompt = build_ask_prompt(scene, "Where is the 2020 bar?", lang="en-IN")

    assert "Scene Element IDs:" in prompt
    assert "pt_origin" in prompt
    assert "seg_axis" in prompt
    assert "poly_trend" in prompt
    assert "bar_2020" in prompt
    assert "where is" in prompt or "location" in prompt
    assert QUESTION_DELIMITER_START in prompt
    assert QUESTION_DELIMITER_END in prompt
    assert prompt.endswith(QUESTION_DELIMITER_END)


# ---------------------------------------------------------------------------
# 10. Direct unit tests of helper functions
# ---------------------------------------------------------------------------


def test_validate_ask_target_direct(triangle: DiagramScene) -> None:
    assert validate_ask_target(None, triangle) is None
    assert validate_ask_target("junk", triangle) is None
    assert validate_ask_target(42, triangle) is None

    # Valid element id
    res_elem = validate_ask_target({"elementId": "A"}, triangle)
    assert isinstance(res_elem, ElementTarget)
    assert res_elem.elementId == "A"

    # Already an ElementTarget instance
    res_inst = validate_ask_target(ElementTarget(elementId="B"), triangle)
    assert isinstance(res_inst, ElementTarget)
    assert res_inst.elementId == "B"

    # Unknown element id
    assert validate_ask_target({"elementId": "unknown"}, triangle) is None
    assert validate_ask_target(ElementTarget(elementId="unknown"), triangle) is None

    # Padded element id must NOT match exact scene id
    assert validate_ask_target({"elementId": " A "}, triangle) is None
    assert validate_ask_target(ElementTarget(elementId=" A "), triangle) is None

    # Extra keys rejected
    assert validate_ask_target({"elementId": "A", "x": 0.5}, triangle) is None
    assert validate_ask_target({"x": 0.5, "y": 0.5, "extra": True}, triangle) is None

    # Valid point
    res_pt = validate_ask_target({"x": 0.5, "y": 0.5}, triangle)
    assert isinstance(res_pt, PointTarget)
    assert res_pt.x == 0.5
    assert res_pt.y == 0.5

    # Point boundaries [0, 1]
    res_pt0 = validate_ask_target({"x": 0.0, "y": 1.0}, triangle)
    assert isinstance(res_pt0, PointTarget)
    assert res_pt0.x == 0.0
    assert res_pt0.y == 1.0

    # Out of range point
    assert validate_ask_target({"x": -0.1, "y": 0.5}, triangle) is None
    assert validate_ask_target({"x": 0.5, "y": 1.1}, triangle) is None
    assert validate_ask_target(PointTarget(x=0.5, y=0.5), triangle) is not None


def test_parse_model_ask_output_variants() -> None:
    # 1. Plain text
    ans, tgt = parse_model_ask_output("Plain text answer.")
    assert ans == "Plain text answer."
    assert tgt is None

    # 2. Raw JSON
    ans, tgt = parse_model_ask_output('{"answer": "Here.", "target": {"elementId": "A"}}')
    assert ans == "Here."
    assert tgt == {"elementId": "A"}

    # 3. Fenced JSON
    fenced = '```json\n{"answer": "Fenced.", "target": {"x": 0.5, "y": 0.5}}\n```'
    ans, tgt = parse_model_ask_output(fenced)
    assert ans == "Fenced."
    assert tgt == {"x": 0.5, "y": 0.5}

    # 4. Empty text
    ans, tgt = parse_model_ask_output("   ")
    assert ans == ""
    assert tgt is None
