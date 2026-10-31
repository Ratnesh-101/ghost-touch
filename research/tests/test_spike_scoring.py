"""Unit tests for the vision-spike scorer. Run with the backend virtualenv:

    backend/.venv/Scripts/python -m pytest research/tests
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

RESEARCH = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RESEARCH))

from spike_scoring import (  # noqa: E402
    facts_recall,
    is_appearance_label,
    label_key,
    score_scene,
)
from vision_spike import parse_scene_json  # noqa: E402

TRUTH_DIR = RESEARCH / "samples" / "synthetic" / "ground_truth"
TRUTH_FILES = sorted(TRUTH_DIR.glob("*.json"))


def load(name: str) -> dict:
    return json.loads((TRUTH_DIR / f"{name}.json").read_text(encoding="utf-8"))


@pytest.mark.skipif(not TRUTH_FILES, reason="no ground truth files")
@pytest.mark.parametrize("path", TRUTH_FILES, ids=lambda p: p.stem)
def test_ground_truth_scores_perfectly_against_itself(path: Path) -> None:
    truth = json.loads(path.read_text(encoding="utf-8"))
    score = score_scene(copy.deepcopy(truth), truth)
    assert score.composite == pytest.approx(1.0)


def test_wrong_kind_zeroes_the_kind_metric() -> None:
    truth = load("01_right_triangle")
    pred = {**copy.deepcopy(truth), "kind": "bar_chart"}
    assert score_scene(pred, truth).metrics["kind"] == 0.0


def test_renamed_vertices_lower_point_f1() -> None:
    truth = load("01_right_triangle")
    pred = copy.deepcopy(truth)
    pred["points"][0]["label"] = "Q"
    assert score_scene(pred, truth).metrics["point_f1"] < 1.0


def test_teacher_prefix_still_matches_vertex_label() -> None:
    truth = load("01_right_triangle")
    pred = copy.deepcopy(truth)
    for point in pred["points"]:
        point["label"] = f"vertex {point['label']}"
    assert score_scene(pred, truth).metrics["point_f1"] == 1.0


def test_corners_far_from_truth_get_zero_accuracy_but_labels_still_match() -> None:
    truth = load("01_right_triangle")
    pred = copy.deepcopy(truth)
    for point in pred["points"]:
        point["x"] = min(1.0, point["x"] + 0.4) if point["x"] < 0.5 else point["x"] - 0.4
    metrics = score_scene(pred, truth).metrics
    assert metrics["point_f1"] == 1.0
    assert metrics["corner_accuracy"] == 0.0
    assert metrics["corner_error"] > 0.3


def test_missing_segment_lowers_segment_f1() -> None:
    truth = load("01_right_triangle")
    pred = copy.deepcopy(truth)
    pred["segments"].pop()
    assert 0.0 < score_scene(pred, truth).metrics["segment_f1"] < 1.0


def test_wrong_bar_value_lowers_value_accuracy() -> None:
    truth = load("08_bar_subjects")
    pred = copy.deepcopy(truth)
    pred["bars"][1]["value"] = 99
    assert score_scene(pred, truth).metrics["value_accuracy"] == pytest.approx(0.75)


def test_curve_shifted_in_the_frame_keeps_its_shape_score_but_not_the_absolute_one() -> None:
    truth = load("05_sine_graph")
    pred = copy.deepcopy(truth)
    pred["polylines"][0]["points"] = [[x, y * 0.6 + 0.3] for x, y in pred["polylines"][0]["points"]]
    metrics = score_scene(pred, truth).metrics
    assert metrics["curve_score"] > 0.95  # same shape, different frame
    assert metrics["curve_score_abs"] < 0.8  # the absolute-frame score notices the frame change


def test_a_mirrored_curve_scores_low_even_after_shape_normalisation() -> None:
    truth = load("05_sine_graph")
    pred = copy.deepcopy(truth)
    pred["polylines"][0]["points"] = [[x, 1 - y] for x, y in pred["polylines"][0]["points"]]
    assert score_scene(pred, truth).metrics["curve_score"] < 0.2


def test_half_the_curve_scores_far_lower_than_the_whole_curve() -> None:
    truth = load("05_sine_graph")
    pred = copy.deepcopy(truth)
    points = pred["polylines"][0]["points"]
    pred["polylines"][0]["points"] = points[: len(points) // 2]
    assert score_scene(pred, truth).metrics["curve_score"] < 0.4


def test_corners_in_a_tight_frame_keep_their_shape_accuracy() -> None:
    truth = load("01_right_triangle")
    pred = copy.deepcopy(truth)
    for point in pred["points"]:  # ground truth has 15% margins; the model frames tightly
        point["x"] = (point["x"] - 0.15) / 0.7
        point["y"] = (point["y"] - 0.15) / 0.7
    metrics = score_scene(pred, truth).metrics
    assert metrics["corner_accuracy"] == pytest.approx(1.0)
    assert metrics["corner_accuracy_abs"] < 0.7


def test_garbage_prediction_does_not_raise() -> None:
    truth = load("01_right_triangle")
    pred = {"kind": 7, "points": "nope", "segments": [None, 3], "facts": [1]}
    assert score_scene(pred, truth).composite < 0.3


def test_label_key_drops_vertex_words() -> None:
    assert label_key("vertex B") == label_key("Point B") == label_key("B") == "b"


@pytest.mark.parametrize(
    "label,expected",
    [
        ("blue polygon", True),
        ("red line", True),
        ("dotted shape", True),
        ("hypotenuse AC", False),
        ("vertex B", False),
        ("A", False),
        ("AB", False),
    ],
)
def test_appearance_label_detection(label: str, expected: bool) -> None:
    assert is_appearance_label(label) is expected


def test_facts_match_despite_wording_of_units() -> None:
    truth = {"facts": ["angle B = 90°", "AB = 3 cm"]}
    pred = {"facts": ["angle B = 90 degrees", "AB = 3 centimetres"]}
    assert facts_recall(pred, truth) == 1.0


@pytest.mark.parametrize(
    "wanted,said,expected",
    [
        ("Maths: 12", ["Maths is the favourite subject of 12 students."], True),
        ("PQ = 8 cm", ["Length of PQ is 8 cm"], True),
        ("angle B = 90°", ["The angle at B is 90 degrees."], True),
        ("opens upward", ["The parabola opens upward with its vertex at (0, -4)."], True),
        ("angle X = 70°", ["Angle X is 70 degrees", "Angle Y is 60 degrees"], True),
        # A paraphrase must keep the numbers: a wrong number or the wrong subject is a miss.
        ("AB = 3 cm", ["Length of AB is 5 cm"], False),
        ("angle X = 70°", ["Angle Y is 70 degrees"], False),
        ("AB = 3 cm", [], False),
    ],
)
def test_fact_matching_accepts_paraphrases_but_not_wrong_numbers(
    wanted: str, said: list[str], expected: bool
) -> None:
    from spike_scoring import fact_matches

    assert fact_matches(wanted, said) is expected


def test_no_truth_facts_means_not_applicable() -> None:
    assert facts_recall({"facts": ["x"]}, {"facts": []}) is None


def test_parse_scene_json_strips_code_fences() -> None:
    assert parse_scene_json('```json\n{"kind": "geometry"}\n```') == {"kind": "geometry"}


def test_parse_scene_json_rejects_non_object() -> None:
    with pytest.raises(ValueError):
        parse_scene_json("[1, 2]")
