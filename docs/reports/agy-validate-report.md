# Lane T11b Report: POST /api/v1/validate (Backend Scene Validation)

**Tool / Author:** Antigravity (agy) — **Agent-written, not Kiro-written**  
*Authorization Note:* The repository owner explicitly authorized this lane (2026-11-04) for Antigravity to write code that `AGENTS.md` normally reserves for Kiro.  
**Requirement:** 9.3 (Teacher Correct mode)  
**Date:** 2026-11-04  

---

## 1. Summary of Changes

Implemented the diagram scene validation endpoint for Teacher Correct mode:

1. **`backend/app/limits.py`**:
   - Added `DEFAULT_VALIDATE_PER_MINUTE = 40` matching `/api/v1/ask`.
   - Updated `default_rate_limits()` to configure `"/api/v1/validate"` via `RATE_LIMIT_VALIDATE_PER_MIN` (default 40 per minute per client).

2. **`backend/app/main.py`**:
   - Added `MAX_VALIDATE_BODY_SIZE = 512 * 1024` (512 KB, matching JSON body caps).
   - Wired `"/api/v1/validate": MAX_VALIDATE_BODY_SIZE` into `RequestGuardMiddleware` body limits.
   - Defined request and response models:
     - `ValidateRequest`: requires `scene: dict[str, Any]` (FastAPI default 422 if missing or malformed).
     - `ValidateResponse`: `ok: bool`, `scene: DiagramScene | None = None`, `errors: list[str] = Field(default_factory=list)`.
   - Implemented route `POST /api/v1/validate`:
     - Uses dependency injection: `validator: Annotated[Callable[[str | dict[str, Any]], ValidationResult], Depends(get_validator)]`.
     - Calls `validator(request.scene)`. If accepted, returns `200` with `ok=True`, the validator's repaired/normalized `DiagramScene`, and `errors=[]`. If rejected, returns `200` with `ok=False`, `scene=null`, and `errors=["<message>", ...]`.
     - Zero caching and zero storage (nothing is cached or stored).

3. **`backend/tests/test_validate_endpoint.py`** (new):
   - Example-based test suite covering the full contract across 10 tests:
     - `test_valid_triangle_fixture_accepted`: right-triangle fixture returns 200 with `ok=True`, `errors=[]`, and matching scene.
     - `test_dangling_segment_repaired_when_other_elements_remain`: dangling segment referencing nonexistent points is dropped by validator repair rules while valid segments are retained.
     - `test_dangling_segment_rejected_when_no_drawable_elements_remain`: scene with only dangling segments leaves zero drawable elements after repair and is rejected with `ok=False`.
     - `test_coordinates_beyond_tolerance_rejected_with_error`: coordinates outside `[-0.02, 1.02]` (tested with `x=1.5` and `x=-0.05`) are dropped, resulting in rejection with error.
     - `test_colour_only_labels_rejected`: labels consisting only of colour/shape words (e.g. "blue polygon") are rejected per Requirement 3.6.
     - `test_empty_scene_rejected`: completely empty scene `{}` and elementless scene `{"kind": "geometry", "points": []}` are rejected.
     - `test_garbage_json_returns_422`: syntax errors in JSON, missing `"scene"` key, `"scene"` not an object, and null `"scene"` all return FastAPI default 422.
     - `test_oversize_body_rejected_with_413`: body exceeding 512 KB returns 413.
     - `test_rate_limit_matches_ask`: exactly 40 requests allowed in 60s window from client; 41st request rejected with 429. Resets properly.
     - `test_dependency_override_get_validator`: verifies FastAPI `app.dependency_overrides[get_validator]` cleanly overrides the validator.

---

## 2. Shared Rules Compliance

- **No git mutations:** No git add, commit, push, branch, or checkout was run.
- **No secret access:** No `.env` or dot-env files opened or searched; no keys printed.
- **Allowed files only:** Touched strictly the 4 allowed files:
  - `backend/app/limits.py`
  - `backend/app/main.py`
  - `backend/tests/test_validate_endpoint.py`
  - `docs/reports/agy-validate-report.md`
- **Forbidden files preserved:** `backend/app/validate.py` and `schema.py` were not edited (used read-only). Property tests and frontend files were untouched.
- **Tuned values preserved:** No haptic values, pitch calibrations, or audio cues were modified.

---

## 3. Real Verification Results (Definition of Done)

Commands were executed from the repo root and yielded true results:

### Backend Checks
```
$ backend/.venv/Scripts/python -m ruff check backend
All checks passed!

$ backend/.venv/Scripts/python -m ruff format --check backend
52 files already formatted

$ backend/.venv/Scripts/python -m pytest backend
============================== warnings summary ===============================
backend\.venv\Lib\site-packages\fastapi\testclient.py:1
  ... StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
346 passed, 1 skipped, 1 warning in 34.97s
```
*(Baseline before this lane: 336 passed, 1 skipped. New test suite added 10 tests, bringing total to 346 passed).*

### Frontend Regression Integrity (Read-Only Checks)
```
$ npm --prefix frontend exec -- tsc -p frontend --noEmit
(clean exit, 0 errors)

$ npm --prefix frontend test
Test Files  30 passed (30)
     Tests  313 passed (313)

$ npm --prefix frontend run build
✓ built in 1.25s
PWA v0.21.2: precache 13 entries (266.61 KiB)
```

---

## 4. Files Touched

- `backend/app/limits.py`
- `backend/app/main.py`
- `backend/tests/test_validate_endpoint.py`
- `docs/reports/agy-validate-report.md`
