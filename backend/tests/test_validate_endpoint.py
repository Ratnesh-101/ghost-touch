"""Tests for POST /api/v1/validate (Lane T11b, Requirement 9.3).

Validates:
- Valid triangle fixture is accepted (ok=True, scene equals the validated scene).
- Dangling segment is repaired or rejected exactly as the real validator does.
- Coordinates beyond tolerance are rejected with an error.
- Colour-only labels such as "blue polygon" are rejected.
- Empty scenes are rejected.
- Garbage JSON and missing scene give 422.
- Oversize body is rejected with 413.
- Rate-limit behaviour matches /api/v1/ask (40/minute limit, 41st returns 429).
- Dependency override for validator is supported.
"""

from __future__ import annotations

from collections.abc import Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.limits import reset_rate_limits
from app.main import app, get_validator
from app.schema import DiagramScene
from app.validate import ValidationResult
from fixtures.triangle import triangle_scene


@pytest.fixture(autouse=True)
def _clean() -> Generator[None, None, None]:
    """Reset dependency overrides and rate limits before and after each test."""
    app.dependency_overrides.clear()
    reset_rate_limits()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_valid_triangle_fixture_accepted(client: TestClient) -> None:
    """A valid triangle fixture is accepted with ok=True and normalized scene."""
    triangle = triangle_scene()
    resp = client.post("/api/v1/validate", json={"scene": triangle.model_dump()})
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is True
    assert data["errors"] == []
    assert data["scene"] == triangle.model_dump()


def test_dangling_segment_repaired_when_other_elements_remain(client: TestClient) -> None:
    """A dangling segment referencing unknown points is dropped; remaining scene is accepted."""
    scene_dict: dict[str, Any] = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.2, "y": 0.2, "label": "A"},
            {"id": "B", "x": 0.8, "y": 0.8, "label": "B"},
        ],
        "segments": [
            {"id": "AB", "a": "A", "b": "B", "label": "AB"},
            {"id": "CD", "a": "C", "b": "D", "label": "CD"},  # dangling: C and D do not exist
        ],
    }
    resp = client.post("/api/v1/validate", json={"scene": scene_dict})
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is True
    assert data["errors"] == []
    # Segment CD was dropped by repair rule
    seg_ids = [s["id"] for s in data["scene"]["segments"]]
    assert seg_ids == ["AB"]


def test_dangling_segment_rejected_when_no_drawable_elements_remain(client: TestClient) -> None:
    """When dropping dangling segments leaves zero elements, the scene is rejected."""
    scene_dict: dict[str, Any] = {
        "kind": "geometry",
        "points": [],
        "segments": [
            {"id": "AB", "a": "A", "b": "B", "label": "AB"},  # dangling: points empty
        ],
    }
    resp = client.post("/api/v1/validate", json={"scene": scene_dict})
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is False
    assert data["scene"] is None
    assert any("no drawable elements" in e.lower() for e in data["errors"])


def test_coordinates_beyond_tolerance_rejected_with_error(client: TestClient) -> None:
    """Coordinates beyond +/-0.02 tolerance are dropped; if no elements remain, scene is rejected."""
    # x=1.5 is far beyond 1.02 clamp tolerance
    scene_dict: dict[str, Any] = {
        "kind": "geometry",
        "points": [
            {"id": "P1", "x": 1.5, "y": 0.5},
        ],
    }
    resp = client.post("/api/v1/validate", json={"scene": scene_dict})
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is False
    assert data["scene"] is None
    assert any("no drawable elements" in e.lower() for e in data["errors"])

    # x=-0.05 is also beyond -0.02 clamp tolerance
    scene_dict_neg: dict[str, Any] = {
        "kind": "geometry",
        "points": [
            {"id": "P2", "x": -0.05, "y": 0.5},
        ],
    }
    resp_neg = client.post("/api/v1/validate", json={"scene": scene_dict_neg})
    assert resp_neg.status_code == 200
    data_neg = resp_neg.json()
    assert data_neg["ok"] is False
    assert data_neg["scene"] is None


def test_colour_only_labels_rejected(client: TestClient) -> None:
    """Requirement 3.6: labels consisting only of colour or shape words are rejected."""
    scene_dict: dict[str, Any] = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0.5, "y": 0.5, "label": "blue polygon"},
        ],
    }
    resp = client.post("/api/v1/validate", json={"scene": scene_dict})
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is False
    assert data["scene"] is None
    assert any("colour or generic shape" in e.lower() for e in data["errors"])


def test_empty_scene_rejected(client: TestClient) -> None:
    """Empty dict or scene without elements is rejected."""
    # Completely empty dict
    resp = client.post("/api/v1/validate", json={"scene": {}})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["scene"] is None
    assert len(data["errors"]) > 0

    # Geometry scene with no elements
    resp_no_elem = client.post(
        "/api/v1/validate",
        json={"scene": {"kind": "geometry", "points": [], "segments": []}},
    )
    assert resp_no_elem.status_code == 200
    data_no_elem = resp_no_elem.json()
    assert data_no_elem["ok"] is False
    assert data_no_elem["scene"] is None
    assert any("no drawable elements" in e.lower() for e in data_no_elem["errors"])


def test_garbage_json_returns_422(client: TestClient) -> None:
    """Malformed body or missing scene gives FastAPI default 422."""
    # Invalid JSON syntax
    resp = client.post(
        "/api/v1/validate",
        content=b"{not valid json",
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 422

    # Missing "scene" key in request
    resp_missing = client.post("/api/v1/validate", json={"wrong_key": 123})
    assert resp_missing.status_code == 422

    # "scene" is not an object (e.g. a string)
    resp_not_obj = client.post("/api/v1/validate", json={"scene": "not-an-object"})
    assert resp_not_obj.status_code == 422

    # "scene" is null
    resp_null = client.post("/api/v1/validate", json={"scene": None})
    assert resp_null.status_code == 422


def test_oversize_body_rejected_with_413(client: TestClient) -> None:
    """Request body exceeding MAX_VALIDATE_BODY_SIZE (512 KB) is rejected with 413."""
    resp = client.post(
        "/api/v1/validate",
        content=b"x" * (600 * 1024),
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 413


def test_rate_limit_matches_ask(client: TestClient) -> None:
    """Rate limit matches /api/v1/ask: 40 requests allowed per minute, 41st is 429."""
    triangle = triangle_scene().model_dump()
    body = {"scene": triangle}

    codes = [client.post("/api/v1/validate", json=body).status_code for _ in range(41)]
    assert codes[:40] == [200] * 40
    assert codes[40] == 429

    # After reset, requests are allowed again
    reset_rate_limits()
    resp_after = client.post("/api/v1/validate", json=body)
    assert resp_after.status_code == 200


def test_dependency_override_get_validator(client: TestClient) -> None:
    """Dependency override on get_validator works cleanly for mocking or custom validators."""
    custom_scene = DiagramScene(
        kind="geometry",
        points=[{"id": "MOCK", "x": 0.1, "y": 0.1, "label": "MOCK"}],
    )

    def mock_validator(raw: str | dict[str, Any]) -> ValidationResult:
        return ValidationResult(scene=custom_scene, errors=[])

    app.dependency_overrides[get_validator] = lambda: mock_validator

    resp = client.post("/api/v1/validate", json={"scene": {"anything": "ignored"}})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["scene"]["points"][0]["id"] == "MOCK"
