# Lane B Report — Graph & Model Pipeline Hardening

**Builder:** Antigravity (agy)  
**Task:** Lane B (`docs/briefs/agy-graph.md`) — Graph / model pipeline hardening  
**Date:** 2026-11-04  
**Status:** Complete — All tests passing, ruff check clean, ruff format clean.

---

## 1. Summary of Built Changes

### 1. Default Gemini Model in Code (`backend/app/vision/gemini.py`)
- Updated `GeminiProvider.__init__` default fallback model from `gemini-3.8-flash` to `gemini-3.5-flash-lite`.
- Fast tier latency (~2.6 s) is now the default for geometry and bar charts.
- `GEMINI_MODEL` environment variable override remains fully functional, and explicit constructor `model` argument takes top precedence.
- Docstring updated to reflect `gemini-3.5-flash-lite default`.

### 2. Graph Pipeline Hardening & Safe Parser Verification (`backend/app/graphs/`, `backend/tests/test_graphs.py`)
- Confirmed that `backend/app/graphs/route.py`, `sample.py`, and `expr.py` extract equations, axis ranges ($x_{\min}, x_{\max}, y_{\min}, y_{\max}$), and visible ticks, sampling curves safely without any `eval()` or `exec()`.
- Added comprehensive unit tests in `backend/tests/test_graphs.py` verifying that all unsupported expressions are strictly rejected:
  - **Names not $x$ or known constants:** `"y"`, `"z"`, `"foo"`, `"bar"`, `"ans"`, `"theta"`, `"a"`, `"b"`, `"val"` raise `ExpressionError`.
  - **Attribute access:** `"x.foo"`, `"x.__class__"`, `"math.sin(x)"`, `"x.bar"`, `"a.b"`, `"(x).real"` raise `ExpressionError`.
  - **Function calls outside whitelist:** `"eval(x)"`, `"exec(x)"`, `"print(x)"`, `"open('f')"`, `"system('ls')"`, `"pow(x, 2)"`, `"round(x)"`, `"floor(x)"`, `"ceil(x)"`, `"min(x, 1)"`, `"max(x, 1)"`, `"sin(eval(x))"` raise `ExpressionError`.
  - **Very long input:** Input strings $> 200$ characters raise `ExpressionError`.
  - **Huge exponents:** Exponent magnitude cap ($|p| > 12$) safely catches overflow and evaluates to `NaN`.
  - **Division by zero:** `"x/0"`, `"1/0"`, `"0/0"` evaluate to `NaN` without raising unhandled exceptions or crashing.
  - **NaN / Inf representations:** `"nan"`, `"inf"`, `"-inf"`, `"+inf"`, `"Infinity"`, `"-Infinity"`, `"NaN"`, `"-nan"` raise `ExpressionError`.
- Verified and tested pipeline fallback: when an equation is missing (`None`, `""`), unsafe (contains attribute access, arbitrary code, or unknown functions), or fails (division by zero yielding no visible points in plot area), the route cleanly falls back to the original traced polyline from the vision model.

### 3. Non-Blocking "Improve" Pass (`backend/app/main.py`, `backend/tests/test_improve_pass.py`)
- Added `get_improve_provider()` FastAPI dependency in `backend/app/main.py`:
  - Reads `GEMINI_IMPROVE_MODEL` (default: `gemini-3.8-flash`).
  - Gracefully disables if set to `"off"`, `"none"`, `"false"`, `"0"`, or if `GEMINI_API_KEY` is unset.
  - Supports dependency override in test harnesses (`app.dependency_overrides[get_improve_provider]`).
- Added `run_improve_pass` coroutine dispatched via FastAPI `BackgroundTasks`:
  - Runs strictly in the background after the fast AI response has been sent to the client.
  - Never delays or fails the primary response (enclosed in full try/except logging).
  - Uses the full extraction prompt with teacher-vocabulary rules and validates the returned scene against `validate_scene`.
  - If valid, stores the upgraded scene in `scene_cache` under the same image hash (`cache_key`) with the improve provider's name.
  - Failures (network error, quota exhaustion, 5xx, invalid JSON) are never cached, leaving the existing fast scene in the cache.
- Added comprehensive example-based tests in `backend/tests/test_improve_pass.py` verifying the full lifecycle, cache updates, failure resilience, and env configuration.

### 4. Scene Cache Hardening (`backend/app/scene_cache.py`, `backend/tests/test_scene_cache.py`)
- Updated `image_key(image, prompt, version=1)`:
  - Generates SHA-256 digest over image bytes, extraction prompt, and schema/model version.
  - Prevents stale cache entries when the schema version or prompt is modified.
- Verified bounded size with LRU eviction (`max_entries`, default 64, configurable via `SCENE_CACHE_SIZE`).
- Verified that only validated AI scenes are accepted (`payload["mode"] == "ai"`), and Raw Mode / errors are refused.
- Added unit tests in `backend/tests/test_scene_cache.py` covering cache hits, cache misses, bounded eviction, version invalidation, and no-cache-on-failure.

### 5. Timeouts and Raw Mode Floor
- Preserved `SCENE_TIMEOUT_SECONDS` (15.0 s budget).
- Preserved `RAW_MODE_RESERVE_SECONDS` (2.5 s floor) ensuring OpenCV Raw Mode always has guaranteed execution time.

---

## 2. Definition of Done Commands & Real Results

### Command 1: Backend Tests
```bash
backend/.venv/Scripts/python -m pytest backend
```
**Result:**  
```
325 passed, 1 skipped, 1 warning in 30.25s
Exit code: 0
```
*(All 325 tests passed cleanly, 1 skipped test from existing test suite).*

### Command 2: Ruff Lint Check
```bash
backend/.venv/Scripts/python -m ruff check backend
```
**Result:**  
```
All checks passed!
Exit code: 0
```

### Command 3: Ruff Format Check
```bash
backend/.venv/Scripts/python -m ruff format --check backend
```
**Result:**  
```
50 files already formatted
Exit code: 0
```

### Command 4: Frontend Checks
```bash
npm --prefix frontend exec -- tsc -p frontend --noEmit
```
**Result:**  
```
npm : The term 'npm' is not recognized as the name of a cmdlet, function, script file, or operable program.
```
*(Node/npm is not present in the current Windows environment path. Zero frontend files were touched, in strict compliance with the AGENTS.md and brief boundaries).*

---

## 3. Files Touched

### Modified Allowed Files
1. `backend/app/vision/gemini.py` — Default model set to `gemini-3.5-flash-lite`.
2. `backend/app/scene_cache.py` — `image_key` updated to hash version.
3. `backend/app/main.py` — Added `get_improve_provider`, `run_improve_pass`, `BackgroundTasks` wiring in `/api/v1/scene`.
4. `backend/tests/test_graphs.py` — Added unit tests for safe expression parser rejection rules and pipeline fallback.
5. `backend/tests/test_scene_cache.py` — Added tests for bounded eviction, version invalidation, and no-cache-on-failure.

### New Allowed Files
1. `backend/tests/test_improve_pass.py` — Example-based tests for improve pass and Gemini model defaults.
2. `docs/reports/agy-graph-report.md` — This handoff report.

### Forbidden Files
*No forbidden files were touched. (No edits to `backend/app/schema.py`, `backend/app/validate.py`, `test_*_props.py`, `frontend/**`, `render.yaml`, `.env.example`, `.kiro/**`).*

---

## 4. Needs from Owner

1. **`.env.example` Update (Optional):**  
   If desired, document `GEMINI_IMPROVE_MODEL=gemini-3.8-flash` in `.env.example` (and `render.yaml` if needed). These files are forbidden to Antigravity so they must be updated by the repository owner.
2. **Quota / Billing Verification for Demo Day:**  
   The primary fast model (`gemini-3.5-flash-lite`) and the background improve model (`gemini-3.8-flash`) have independent per-model quotas on the Gemini API free tier (20 requests/day/project/model). For live demonstrations or bulk testing, ensure billing is enabled on the Google project or keep `GEMINI_IMPROVE_MODEL=off` to conserve quota.
