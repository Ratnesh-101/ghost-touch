#!/usr/bin/env python
"""Vision spike: run a vision LLM over the sample diagrams and score it.

Synthetic samples (``samples/synthetic/{clean,photo}``) have ground truth in
``samples/synthetic/ground_truth``, so they are scored automatically: kind
match, point/segment/bar label F1, corner error, curve error, bar values, facts
recall and a weighted 0..1 composite (see ``spike_scoring.py``).

Real photos in ``samples/real/`` are run and checked for schema validity,
latency and appearance-only labels. They are also scored if you add
``samples/real/ground_truth/<same-stem>.json``.

Run it with the backend virtualenv (it has google-genai, httpx, opencv)::

    backend/.venv/Scripts/python research/vision_spike.py --provider gemini
    backend/.venv/Scripts/python research/vision_spike.py --provider nvidia --model <id>
    backend/.venv/Scripts/python research/vision_spike.py --rescore research/results/<run>
    backend/.venv/Scripts/python research/vision_spike.py --oracle    # no API: truth vs truth

Keys come from the environment (``GEMINI_API_KEY``, ``NVIDIA_API_KEY``,
``NVIDIA_MODEL``). If a key is missing the script loads ``backend/.env`` once
(never printed). ``--oracle`` and ``--rescore`` never touch keys or the network.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from statistics import fmean, median
from typing import Any

from spike_scoring import Scene, SceneScore, score_scene
from spike_scoring import appearance_label_rate as appearance_rate

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SAMPLES = HERE / "samples"
RESULTS = HERE / "results"
DEFAULT_ENV_FILE = REPO / "backend" / ".env"
USABLE_THRESHOLD = 0.7
NVIDIA_INLINE_LIMIT = 180_000  # bytes; hosted NVIDIA vision endpoints cap inline images (verify)
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
SYNTHETIC_VARIANTS = {"clean": "png", "photo": "jpg"}

PROMPT_TEMPLATE = """You convert images of school STEM diagrams into JSON for a touch-and-vibration app used by blind students.
Return ONLY JSON matching this schema: {schema}
Rules:
- Coordinates are normalized to [0,1], origin top-left, relative to the diagram's bounding box.
- kind: geometry | function_graph | bar_chart | unknown.
- geometry: every labeled corner is a point; every drawn edge is a segment between point ids.
- function_graph: sample each curve as a polyline of 40-150 points; set axes.
- bar_chart: one bar per bar with label and numeric value.
- Put every given measurement or relation from the image into "facts" as short sentences.
- Do not invent labels or values that are not visible. If unsure, use kind "unknown".
- Label things the way a maths or science teacher would say them aloud, using standard terms: "hypotenuse", "vertex B", "right angle at B", "x-axis". Prefer the label printed in the diagram (A, B, C, "AB") and add the role when it is clear.
- Never label an element by its appearance (colours, line styles, generic shape words): not "blue polygon", "red line", "dotted shape". If an element has no printed label and no standard name, leave its label empty.
"""


class SpikeError(Exception):
    """A provider or setup failure that should be reported, not crash the run."""


# ---------------------------------------------------------------------------
# Samples
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Sample:
    variant: str  # clean | photo | real
    stem: str
    image: Path
    truth: Path | None

    @property
    def sample_id(self) -> str:
        return f"{self.variant}/{self.stem}"


def discover(variants: list[str], only: list[str], limit: int | None) -> list[Sample]:
    found: list[Sample] = []
    for variant in variants:
        found.extend(_discover_variant(variant))
    if only:
        found = [s for s in found if any(s.stem.startswith(prefix) for prefix in only)]
    return found[:limit] if limit else found


def _discover_variant(variant: str) -> list[Sample]:
    if variant in SYNTHETIC_VARIANTS:
        folder = SAMPLES / "synthetic" / variant
        truth_dir = SAMPLES / "synthetic" / "ground_truth"
        images = sorted(folder.glob(f"*.{SYNTHETIC_VARIANTS[variant]}"))
    elif variant == "real":
        folder = SAMPLES / "real"
        truth_dir = folder / "ground_truth"
        images = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
    else:
        raise SpikeError(f"unknown variant {variant!r}; use clean, photo or real")
    samples = []
    for image in images:
        truth = truth_dir / f"{image.stem}.json"
        samples.append(Sample(variant, image.stem, image, truth if truth.is_file() else None))
    return samples


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------


def load_env_file(path: Path) -> None:
    """Load KEY=VALUE lines into os.environ without overriding; never prints values."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _require_env(name: str, env_file: Path) -> str:
    if not os.environ.get(name):
        load_env_file(env_file)
    value = os.environ.get(name)
    if not value:
        raise SpikeError(f"{name} is not set. {_describe_env_file(env_file)}")
    return value


def _describe_env_file(path: Path) -> str:
    """Say where we looked and which variable NAMES (never values) the file defines."""
    if not path.is_file():
        return f"Key file not found at {path}."
    names = sorted(
        line.split("=", 1)[0].strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    )
    return f"Key file {path} defines these names: {', '.join(names) or '(none)'}."


class GeminiProvider:
    name = "gemini"

    def __init__(self, model: str | None, env_file: Path) -> None:
        from google import genai  # lazy: oracle/rescore need no SDK

        self.model = model or os.environ.get("GEMINI_MODEL") or "gemini-3.8-flash"
        self._client = genai.Client(api_key=_require_env("GEMINI_API_KEY", env_file))

    def extract(self, image: bytes, mime: str, prompt: str) -> str:
        from google.genai import types

        response = self._client.models.generate_content(
            model=self.model,
            contents=[types.Part.from_bytes(data=image, mime_type=mime), prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json", temperature=0
            ),
        )
        if not response.text:
            raise SpikeError("empty response from gemini")
        return response.text


class NvidiaProvider:
    name = "nvidia"

    def __init__(self, model: str | None, env_file: Path) -> None:
        self._key = _require_env("NVIDIA_API_KEY", env_file)
        self.model = model or os.environ.get("NVIDIA_MODEL") or ""
        if not self.model:
            raise SpikeError("set NVIDIA_MODEL or pass --model <nvidia vision model id>")
        self._base = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

    def extract(self, image: bytes, mime: str, prompt: str) -> str:
        import httpx

        image, mime = fit_for_inline(image, mime)
        data_url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
        body = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            "temperature": 0,
            "max_tokens": 4096,
            "stream": False,
        }
        response = httpx.post(
            f"{self._base}/chat/completions",
            headers={"Authorization": f"Bearer {self._key}"},
            json=body,
            timeout=90,
        )
        response.raise_for_status()
        choices = response.json().get("choices") or []
        text = choices[0].get("message", {}).get("content") if choices else None
        if not text:
            raise SpikeError("empty response from nvidia")
        return text


def fit_for_inline(image: bytes, mime: str, max_bytes: int = NVIDIA_INLINE_LIMIT) -> tuple[bytes, str]:
    """Shrink an image until its bytes fit the inline limit (needs opencv; else unchanged)."""
    if len(image) <= max_bytes:
        return image, mime
    try:
        import cv2
        import numpy as np
    except ImportError:
        return image, mime
    decoded = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        return image, mime
    side = 1024
    while side >= 256:
        scale = min(1.0, side / max(decoded.shape[:2]))
        small = cv2.resize(decoded, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        for quality in (85, 70, 55, 40):
            ok, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, quality])
            if ok and len(buf) <= max_bytes:
                return buf.tobytes(), "image/jpeg"
        side = int(side * 0.75)
    return image, mime


class AgyProvider:
    """Antigravity's CLI (`agy --print`) as a vision provider, for the OFFLINE spike only.

    It spends the owner's Antigravity quota instead of a Gemini API key, and only works on this
    machine: the deployed backend cannot use it. The agent is told to look at one image file and
    answer with JSON. No shell command is needed, so the exact-match permissions in
    scripts/agy-settings.json (no dangerous flag) are enough.
    """

    name = "agy"
    accepts_path = True
    TIMEOUT_S = 420

    def __init__(self, model: str | None) -> None:
        if shutil.which("agy") is None:
            raise SpikeError("the agy command is not on PATH")
        self.model = model or "gemini-3.8-flash-high"

    def extract(self, image: bytes, mime: str, prompt: str) -> str:
        raise SpikeError("agy needs an image file path, not bytes")

    def extract_path(self, image: Path, mime: str, prompt: str) -> str:
        full_prompt = (
            f"{prompt}\n\nThe diagram to convert is the image file at this absolute path: "
            f"{image.resolve()}\nView that image file with your file-viewing tool. Do NOT run any "
            "command, do NOT edit or create any file, do NOT read any other file. Reply with ONLY "
            "the JSON object, no commentary, no code fence."
        )
        # Same safety as scripts/agy-run.sh: exact-match permissions from scripts/agy-settings.json
        # (viewing an image needs no shell command), no dangerous flag, and the API-key variables
        # removed for the child process only so it can only use the signed-in Antigravity account.
        command = [
            "agy", "--print", full_prompt, "--model", self.model, "--output-format", "text",
            "--mode", "accept-edits", "--settings", str(REPO / "scripts" / "agy-settings.json"),
        ]  # fmt: skip
        child_env = {
            k: v for k, v in os.environ.items()
            if k not in {"GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY",
                         "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"}
        }  # fmt: skip
        try:
            done = subprocess.run(
                command, capture_output=True, text=True, encoding="utf-8",
                timeout=self.TIMEOUT_S, cwd=str(REPO), env=child_env,
            )  # fmt: skip
        except subprocess.TimeoutExpired:
            raise SpikeError("agy timed out") from None
        if done.returncode != 0:
            raise SpikeError(f"agy exit {done.returncode}: {done.stderr.strip()[:200]}")
        out = done.stdout
        start, end = out.find("{"), out.rfind("}")
        if start < 0 or end <= start:
            raise SpikeError("agy reply had no JSON object")
        return out[start : end + 1]


def parse_scene_json(text: str) -> Scene:
    """Parse model output as a JSON object, tolerating ```json fences."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("top-level JSON is not an object")
    return data


def build_prompt() -> str:
    schema = "(schema unavailable)"
    try:
        sys.path.insert(0, str(REPO / "backend"))
        from app.schema import DiagramScene

        schema = json.dumps(DiagramScene.model_json_schema())
    except ImportError:
        pass
    return PROMPT_TEMPLATE.replace("{schema}", schema)


def make_validator() -> Callable[[Scene], bool] | None:
    """Strict DiagramScene check (no clamping), or None if the backend isn't importable."""
    try:
        sys.path.insert(0, str(REPO / "backend"))
        from app.schema import DiagramScene
    except ImportError:
        return None

    def _valid(scene: Scene) -> bool:
        try:
            DiagramScene.model_validate(scene)
        except ValueError:  # pydantic.ValidationError subclasses ValueError
            return False
        return True

    return _valid


# ---------------------------------------------------------------------------
# Running and scoring one sample
# ---------------------------------------------------------------------------


@dataclass
class Outcome:
    sample_id: str
    variant: str
    kind_truth: str | None
    kind_pred: str | None
    composite: float | None  # None = not scored (no ground truth)
    metrics: dict[str, float | None] = field(default_factory=dict)
    latency_s: float | None = None
    error: str | None = None


Predictor = Callable[[Sample], str]


TRANSIENT_MARKERS = ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "overloaded", "high demand")
RETRY_WAITS_S = (3.0, 8.0, 15.0)


def is_transient(error: Exception) -> bool:
    """Rate limits and 'high demand' errors are worth a short wait and another try."""
    text = f"{type(error).__name__} {error}"
    return any(marker in text for marker in TRANSIENT_MARKERS)


def live_predictor(provider: Any, prompt: str, waits: tuple[float, ...] = RETRY_WAITS_S) -> Predictor:
    """Call the provider, retrying transient errors; remember the last attempt's own duration."""

    def predict(sample: Sample) -> str:
        mime = mimetypes.guess_type(sample.image.name)[0] or "image/jpeg"
        image = sample.image.read_bytes()
        for attempt in range(len(waits) + 1):
            started = time.perf_counter()
            try:
                if getattr(provider, "accepts_path", False):
                    text = provider.extract_path(sample.image, mime, prompt)
                else:
                    text = provider.extract(image, mime, prompt)
            except Exception as exc:  # provider errors vary by SDK
                if attempt < len(waits) and is_transient(exc):
                    time.sleep(waits[attempt])
                    continue
                raise
            predict.last_attempt_seconds = time.perf_counter() - started  # type: ignore[attr-defined]
            return text
        raise SpikeError("unreachable")

    return predict


def oracle_predictor(sample: Sample) -> str:
    if sample.truth is None:
        raise SpikeError("no ground truth for oracle")
    return sample.truth.read_text(encoding="utf-8")


def _obtain_prediction(
    sample: Sample, pred_dir: Path, predict: Predictor | None, reuse: bool
) -> tuple[Scene, float | None]:
    """Return the parsed prediction and call latency (None when reused from disk)."""
    saved = pred_dir / sample.variant / f"{sample.stem}.json"
    if predict is None or (reuse and saved.is_file()):
        if not saved.is_file():
            raise SpikeError("no saved prediction")
        return json.loads(saved.read_text(encoding="utf-8")), None
    started = time.perf_counter()
    raw = predict(sample)
    # Prefer the last attempt's own duration so retry waits do not inflate latency.
    latency = getattr(predict, "last_attempt_seconds", None) or (time.perf_counter() - started)
    saved.parent.mkdir(parents=True, exist_ok=True)
    saved.with_suffix(".txt").write_text(raw, encoding="utf-8")
    scene = parse_scene_json(raw)
    saved.write_text(json.dumps(scene, indent=2), encoding="utf-8")
    return scene, latency


def evaluate_sample(
    sample: Sample,
    pred_dir: Path,
    predict: Predictor | None,
    validate: Callable[[Scene], bool] | None,
    reuse: bool = False,
) -> Outcome:
    truth = json.loads(sample.truth.read_text(encoding="utf-8")) if sample.truth else None
    kind_truth = truth.get("kind") if truth else None
    try:
        pred, latency = _obtain_prediction(sample, pred_dir, predict, reuse)
    except (SpikeError, ValueError, OSError) as exc:
        return Outcome(sample.sample_id, sample.variant, kind_truth, None, 0.0 if truth else None,
                       error=f"{type(exc).__name__}: {exc}")
    except Exception as exc:  # provider/network errors must not stop the batch
        return Outcome(sample.sample_id, sample.variant, kind_truth, None, 0.0 if truth else None,
                       error=f"{type(exc).__name__}: {str(exc)[:200]}")
    if truth is None:
        metrics = {
            "schema_valid": None if validate is None else float(validate(pred)),
            "appearance_labels": appearance_rate(pred),
        }
        return Outcome(sample.sample_id, sample.variant, None, pred.get("kind"), None, metrics, latency)
    score: SceneScore = score_scene(pred, truth, validate)
    return Outcome(sample.sample_id, sample.variant, kind_truth, pred.get("kind"),
                   score.composite, score.metrics, latency)


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def _fmt(value: float | None, digits: int = 2) -> str:
    return "  - " if value is None else f"{value:.{digits}f}"


def _mean(values: list[float | None]) -> float | None:
    clean = [v for v in values if v is not None]
    return fmean(clean) if clean else None


def group_stats(items: list[Outcome], usable: float) -> dict[str, Any]:
    scored = [o for o in items if o.composite is not None]
    latencies = [o.latency_s for o in items if o.latency_s is not None]
    return {
        "n": len(items),
        "scored": len(scored),
        "mean_composite": _mean([o.composite for o in scored]),
        "kind_correct": sum(o.kind_truth == o.kind_pred for o in scored),
        "schema_valid": sum(o.metrics.get("schema_valid") == 1.0 for o in items),
        "usable": sum((o.composite or 0.0) >= usable for o in scored),
        "errors": sum(o.error is not None for o in items),
        "median_latency_s": median(latencies) if latencies else None,
    }


def render_report(outcomes: list[Outcome], usable: float, title: str) -> str:
    lines = [title, ""]
    head = f"{'sample':<26}{'truth->pred':<30}{'score':>6}{'valid':>7}{'secs':>7}  notes"
    lines += [head, "-" * len(head)]
    for o in outcomes:
        kinds = f"{o.kind_truth or '?'}->{o.kind_pred or '-'}"
        note = o.error or _worst_metric(o)
        lines.append(
            f"{o.sample_id:<26}{kinds:<30}{_fmt(o.composite):>6}"
            f"{_fmt(o.metrics.get('schema_valid'), 0):>7}{_fmt(o.latency_s, 1):>7}  {note}"
        )
    lines += ["", "Summary", "-------"]
    groups = _grouped(outcomes)
    for name, items in groups.items():
        s = group_stats(items, usable)
        lines.append(
            f"{name:<18} n={s['n']:<3} score={_fmt(s['mean_composite'])} "
            f"kind {s['kind_correct']}/{s['scored']}  valid {s['schema_valid']}/{s['n']}  "
            f"usable(>={usable}) {s['usable']}/{s['scored']}  errors {s['errors']}  "
            f"median {_fmt(s['median_latency_s'], 1)}s"
        )
    appearance = _mean([o.metrics.get("appearance_labels") for o in outcomes])
    lines += ["", f"appearance-only labels (lower is better): {_fmt(appearance)}"]
    return "\n".join(lines)


def _grouped(outcomes: list[Outcome]) -> dict[str, list[Outcome]]:
    groups: dict[str, list[Outcome]] = {"ALL": outcomes}
    for o in outcomes:
        groups.setdefault(f"variant:{o.variant}", []).append(o)
        if o.kind_truth:
            groups.setdefault(f"kind:{o.kind_truth}", []).append(o)
    return groups


_NOTE_KEYS = ("point_f1", "segment_f1", "corner_accuracy", "curve_score",
              "axes_accuracy", "bar_label_f1", "value_accuracy", "facts_recall")  # fmt: skip


def _worst_metric(o: Outcome) -> str:
    """Name the weakest scored metric so a bad row says why."""
    weak = [(v, k) for k in _NOTE_KEYS if (v := o.metrics.get(k)) is not None and v < 0.8]
    return f"low {min(weak)[1]}={min(weak)[0]:.2f}" if weak else ""


def save_run(out_dir: Path, outcomes: list[Outcome], report: str, meta: dict[str, Any]) -> None:
    """Write results.json and summary.md. A partial run (--only / --resume) is merged into the
    existing results by sample id instead of replacing them."""
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "results.json"
    merged = {o.sample_id: asdict(o) for o in outcomes}
    if path.is_file():
        previous = json.loads(path.read_text(encoding="utf-8")).get("samples", [])
        merged = {**{s["sample_id"]: s for s in previous}, **merged}
    payload = {**meta, "samples": list(merged.values())}
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    fence = "`" * 3
    (out_dir / "summary.md").write_text(f"{fence}\n{report}\n{fence}\n", encoding="utf-8")


def load_latencies(run_dir: Path) -> dict[str, float | None]:
    path = run_dir / "results.json"
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {s["sample_id"]: s.get("latency_s") for s in data.get("samples", [])}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument(
        "--provider",
        choices=["gemini", "nvidia", "agy"],
        help="vision provider: gemini and nvidia use API keys; agy uses the Antigravity CLI "
        "quota (offline spike only, e.g. --model gemini-3.8-flash-high)",
    )
    p.add_argument("--model", help="model id (default: GEMINI_MODEL / NVIDIA_MODEL)")
    p.add_argument("--variants", default="clean,photo,real", help="comma list of clean,photo,real")
    p.add_argument("--only", default="", help="comma list of sample number prefixes, e.g. 01,05")
    p.add_argument("--limit", type=int, help="run at most N samples")
    p.add_argument("--sleep", type=float, default=0.0, help="seconds between calls (free-tier rate limits)")
    p.add_argument("--resume", action="store_true", help="reuse predictions already saved in --out")
    p.add_argument("--out", type=Path, help="run directory (default: research/results/<auto>)")
    p.add_argument("--rescore", type=Path, help="re-score saved predictions in this run dir (no API)")
    p.add_argument("--oracle", action="store_true", help="score ground truth against itself (sanity check)")
    p.add_argument("--usable", type=float, default=USABLE_THRESHOLD, help="composite counted as usable")
    p.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE, help="fallback key file")
    return p.parse_args(argv)


def _run_dir(args: argparse.Namespace, model: str) -> Path:
    if args.out:
        return args.out
    slug = re.sub(r"[^A-Za-z0-9.]+", "-", model).strip("-")
    return RESULTS / f"{args.provider}-{slug}-{datetime.now():%Y%m%d-%H%M%S}"


def _build_predictor(args: argparse.Namespace) -> tuple[Predictor | None, str, Path | None]:
    """Return (predictor, model label, run dir) for the chosen mode."""
    if args.oracle:
        return oracle_predictor, "oracle", None
    if args.rescore:
        if not (args.rescore / "predictions").is_dir():
            raise SpikeError(f"no predictions folder in {args.rescore}")
        return None, "rescore", args.rescore
    if not args.provider:
        raise SpikeError("choose --provider gemini|nvidia, or --oracle, or --rescore DIR")
    if args.provider == "agy":
        provider: Any = AgyProvider(args.model)
    else:
        provider = (GeminiProvider if args.provider == "gemini" else NvidiaProvider)(
            args.model, args.env_file
        )
    return live_predictor(provider, build_prompt()), provider.model, _run_dir(args, provider.model)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args(argv)
    try:
        predict, model, run_dir = _build_predictor(args)
        samples = discover(
            [v for v in args.variants.split(",") if v],
            [o for o in args.only.split(",") if o],
            args.limit,
        )
    except SpikeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if not samples:
        print("error: no samples found for those options", file=sys.stderr)
        return 2
    pred_dir = (run_dir / "predictions") if run_dir else Path(tempfile.mkdtemp(prefix="spike-oracle-"))
    validate = make_validator()
    old_latency = load_latencies(run_dir) if args.rescore and run_dir else {}
    outcomes: list[Outcome] = []
    for i, sample in enumerate(samples):
        outcome = evaluate_sample(sample, pred_dir, predict, validate, args.resume)
        if args.rescore and outcome.latency_s is None:
            outcome.latency_s = old_latency.get(sample.sample_id)
        outcomes.append(outcome)
        print(f"[{i + 1}/{len(samples)}] {outcome.sample_id}: {_fmt(outcome.composite)} {outcome.error or ''}",
              file=sys.stderr)
        if args.sleep and predict is not None and not args.oracle and i < len(samples) - 1:
            time.sleep(args.sleep)
    report = render_report(outcomes, args.usable, f"Vision spike - {model} - {datetime.now():%Y-%m-%d %H:%M}")
    print(report)
    if run_dir is not None:
        save_run(run_dir, outcomes, report, {"provider": args.provider, "model": model})
        print(f"\nsaved to {run_dir}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
