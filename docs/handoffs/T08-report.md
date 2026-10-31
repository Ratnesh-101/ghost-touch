# T08 Handoff Report — Backend Scene Pipeline

**Builder:** Antigravity (agy)  
**Task:** Task 8 (8.1, 8.2, 8.4, 8.5) — Backend vision pipeline (Gemini primary, NVIDIA fallback, Raw Mode floor)  
**Reviewer:** Claude Code (Kiro paused)  
**Date:** 2026-11-01  

---

## 1. Summary of Changes

Implemented the complete backend scene extraction pipeline:
- **VisionProvider interface (`backend/app/vision/base.py`)**: `VisionError` exception type with provider tag and secret sanitization; `VisionProvider` asynchronous protocol.
- **GeminiProvider (`backend/app/vision/gemini.py`)**: Primary provider using `google-genai` SDK `client.aio.models.generate_content`, defaulting to `gemini-3.8-flash`. Supports `GEMINI_THINKING_BUDGET` via `types.ThinkingConfig(thinking_budget=...)` (default `0` to keep response times within the 15 s budget). Unwraps markdown fences, wraps all SDK errors in `VisionError("gemini", ...)`.
- **NvidiaProvider (`backend/app/vision/nvidia.py`)**: Fallback vision provider using NVIDIA's hosted OpenAI-compatible chat completions API with `httpx.AsyncClient`. Includes pure helper `fit_image_for_inline(image, max_bytes)` to downscale and re-encode with OpenCV if payload exceeds `180_000` bytes. Strips markdown fences, maps 429/5xx/timeouts/empty choices to `VisionError("nvidia", ...)`, redacts Bearer tokens and API keys from error messages. Default model: `meta/llama-3.2-11b-vision-instruct`.
- **Fallback Chain (`backend/app/vision/chain.py` & `backend/app/vision/__init__.py`)**: `ProviderChain` attempts providers in order, falling through on `VisionError`. Factory `build_chain_from_env()` reads `VISION_PROVIDERS` (default `gemini,nvidia`), silences missing keys, and logs provider names only.
- **Prompts (`backend/app/vision/prompts.py`)**: Base extraction prompt from `CLAUDE.md` §6 Task 8 with `{schema}` filled from `DiagramScene.model_json_schema()`, plus the TouchSight teacher vocabulary block (standard names like "hypotenuse AC", forbidding appearance-only descriptions like "blue polygon" or "long blue line"). `build_prompt(errors)` generates retry prompt with validation feedback.
- **Raw Mode (`backend/app/raw_mode.py`)**: OpenCV pipeline: grayscale → `GaussianBlur(5, 5)` → `Canny(50, 150)` → `findContours` → `approxPolyDP(epsilon=0.01*perimeter)` → extracts line segments, sorts by length, caps at 300 longest segments, normalizes coordinates to [0, 1] relative to width and height, outputs valid `DiagramScene(kind="unknown")` with unique point and segment IDs. Raises typed `RawModeError` on undecodable bytes.
- **FastAPI Endpoint (`POST /api/v1/scene` in `backend/app/main.py`)**:
  - Multipart upload validation: rejects files >10 MB (HTTP 413) and non-JPEG/PNG/WebP (HTTP 415).
  - Configurable timeouts: total deadline via `SCENE_TIMEOUT_SECONDS` (default `15.0` s) and per-provider cap via `PROVIDER_TIMEOUT_SECONDS` (default `8.0` s).
  - Flow: Provider extract → `validate_scene` → if invalid, single retry on same provider with errors appended if remaining time ≥3 s → if still invalid, provider failure, or deadline hit → Raw Mode floor.
  - Zero providers configured goes straight to Raw Mode (`reason="no_provider"`).
  - Raw Mode scenes pass through `validate_scene` before return.
  - Response header: `X-Vision-Provider: gemini|nvidia|none`.
  - Structured logging: provider used, mode, reason, elapsed ms (no image bytes, no keys, no raw model output).
  - Dependency injection for both `get_provider_chain` and `get_validator` using FastAPI `Depends`.
- **TEMP Stub (`backend/app/_temp/validate_stub.py`)**: Minimal throwaway stub implementing `ValidationResult(scene, errors)` and `validate_scene(raw) -> ValidationResult` via `DiagramScene.model_validate`, tolerating fenced JSON and never raising.
- **Dependencies (`backend/pyproject.toml`)**: Moved `httpx>=0.27.0` from `dev` optional-dependencies to runtime `dependencies`.

---

## 2. NVIDIA Model Choice & Inline Limit

- **Chosen Default Model:** `meta/llama-3.2-11b-vision-instruct`
  - **Rationale:** Hosted on NVIDIA NIM (`https://integrate.api.nvidia.com/v1`), this vision model is instruction-tuned for multimodal extraction, lightweight (11B parameters) with lower inference latency than 90B variants, and handles JSON structured outputs effectively.
  - **Image Size Limit:** Hosted endpoints enforce an inline image limit of approximately 180 KB (`180_000` bytes). The pure helper `fit_image_for_inline` was verified with unit tests (`test_fit_inline.py`) to downscale images above 180 KB to ≤ 180 KB while preserving image validity.

---

## 3. Commands Run & Results

```bash
# 1. Verification of pyproject.toml and dependencies
backend/.venv/Scripts/python -m pytest backend
# Result: 92 passed, 1 warning (Starlette testclient deprecation) in 1.98s

# 2. Linting
backend/.venv/Scripts/python -m ruff check backend
# Result: All checks passed!

# 3. Formatting
backend/.venv/Scripts/python -m ruff format --check backend
# Result: 33 files already formatted

# 4. Secret check (tracked files)
git grep -n "nvapi-\|AIza"
# Result: 0 occurrences in source or test code (only 1 match in brief checklist description)
```

---

## 4. Tests Written (All Offline / Mocked)

All tests run without network access or real API keys:
- `backend/tests/test_raw_mode.py`:
  - `test_build_raw_scene_produces_valid_diagram_scene`: verifies invariants (coordinates in [0, 1], unique IDs, valid point references).
  - `test_build_raw_scene_caps_at_300_segments`: verifies segment cap under dense contours.
  - `test_build_raw_scene_raises_on_invalid_bytes`: verifies `RawModeError` on corrupted bytes.
- `backend/tests/test_prompts.py`:
  - `test_build_prompt_includes_schema_and_teacher_vocabulary`: validates presence of JSON schema and teacher rules ("hypotenuse AC", no "long blue line").
  - `test_build_prompt_with_errors_appends_feedback`: validates retry feedback appending.
- `backend/tests/test_fit_inline.py`:
  - `test_fit_image_small_input_returned_unchanged`: input <= limit unchanged.
  - `test_fit_image_large_input_fits_limit_and_decodes`: large image downscaled under limit, still decodes.
  - `test_fit_image_undecodable_bytes_returned_as_is`: returns undecodable bytes as-is without crashing.
- `backend/tests/test_chain.py`:
  - `test_chain_first_provider_succeeds_second_never_called`: short-circuit on success.
  - `test_chain_first_fails_second_succeeds`: fallback on `VisionError`.
  - `test_chain_all_fail_raises_vision_error`: raises `VisionError("chain", ...)`.
  - `test_build_chain_from_env_missing_keys_skipped`: silent skipping when keys are unset.
- `backend/tests/test_nvidia_provider.py` (via `httpx.MockTransport`):
  - `test_nvidia_provider_success_and_bearer_header`: verifies request structure and Bearer authorization header.
  - `test_nvidia_provider_unwraps_fenced_reply`: verifies stripping of ` ```json ` fences.
  - `test_nvidia_provider_rate_limit_429`: maps HTTP 429 to `VisionError`.
  - `test_nvidia_provider_empty_choices`: maps empty choices to `VisionError`.
  - `test_nvidia_provider_key_never_appears_in_error_text`: redacts sensitive keys and Bearer tokens from error strings.
- `backend/tests/test_gemini_provider.py`:
  - `test_gemini_provider_uses_thinking_config`: verifies `types.ThinkingConfig(thinking_budget=...)` is passed.
  - `test_gemini_provider_timeout_raises_vision_error`: verifies timeout mapping.
  - `test_gemini_provider_empty_reply_raises_vision_error`: verifies empty text handling.
- `backend/tests/test_scene_pipeline.py`:
  - `test_pipeline_valid_json_returns_ai_mode`: AI extraction with `X-Vision-Provider: gemini`.
  - `test_pipeline_fenced_json_is_accepted`: fences tolerated and unwrapped.
  - `test_pipeline_first_fails_fallback_to_nvidia`: chain fallback to second provider in route.
  - `test_pipeline_all_providers_fail_returns_raw_mode`: fallback to Raw Mode with `reason="provider_error"`.
  - `test_pipeline_zero_providers_returns_raw_mode_no_provider`: immediate Raw Mode with `reason="no_provider"` and `X-Vision-Provider: none`.
  - `test_pipeline_invalid_then_valid_on_retry`: retry prompt receives validation errors; returns `mode: "ai"`.
  - `test_pipeline_invalid_twice_falls_back_to_raw`: second failure falls back to Raw Mode (`reason="invalid"`).
  - `test_pipeline_garbage_non_json_falls_back_to_raw`: non-JSON response falls back to Raw Mode without HTTP 500.
  - `test_pipeline_vocabulary_rule_retry_succeeds`: fake validator rejecting "blue polygon" triggers vocabulary error in retry prompt, returning `mode: "ai"` after provider corrects it.
  - `test_pipeline_vocabulary_rule_fails_twice_returns_raw`: repeated appearance label errors fall back to Raw Mode (`reason="invalid"`).
  - `test_pipeline_provider_timeout_falls_back_to_raw`: deadline breach falls back to Raw Mode (`reason="timeout"`).
  - `test_pipeline_unsupported_media_type_returns_415`: rejects non-image with 415.
  - `test_pipeline_oversized_upload_returns_413`: rejects >10 MB with 413.
  - `test_pipeline_empty_upload_returns_422`: rejects empty image with 422.

---

## 5. Files Changed & Created

### Backend Source
- `backend/pyproject.toml` (moved httpx to dependencies)
- `backend/app/main.py` (added POST /api/v1/scene route, CORS, dependency injection)
- `backend/app/raw_mode.py` (implemented OpenCV Raw Mode fallback)
- `backend/app/vision/base.py` (VisionProvider protocol and VisionError)
- `backend/app/vision/gemini.py` (Gemini provider with ThinkingConfig)
- `backend/app/vision/nvidia.py` (NVIDIA provider with fit_image_for_inline)
- `backend/app/vision/chain.py` (ProviderChain with fallback)
- `backend/app/vision/prompts.py` (extraction prompt with teacher vocabulary rules)
- `backend/app/vision/__init__.py` (exports & build_chain_from_env)
- `backend/app/_temp/validate_stub.py` (TEMP stub for validate_scene)
- `backend/app/_temp/__init__.py` (stub package)
- `backend/.env.example` (appended empty configuration keys)

### Backend Tests
- `backend/tests/test_health.py` (formatted)
- `backend/tests/test_raw_mode.py` (created)
- `backend/tests/test_prompts.py` (created)
- `backend/tests/test_fit_inline.py` (created)
- `backend/tests/test_chain.py` (created)
- `backend/tests/test_gemini_provider.py` (created)
- `backend/tests/test_nvidia_provider.py` (created)
- `backend/tests/test_scene_pipeline.py` (created)

---

## 6. Deviations & Observations

- **Thinking Budget Default:** Configured `GEMINI_THINKING_BUDGET=0` by default. As observed in `vision-spike.md`, thinking effort caused 29–169 s latencies against the 15 s budget. Disabling thinking effort (`0`) allows the model to respond directly and fit comfortably within the 8 s per-provider cap.
- **AsyncCoroutines in Tests:** Because `pytest-asyncio` is not in the virtual environment dependencies and installing packages is prohibited, async provider calls in unit tests are run via `asyncio.run()`, avoiding external plugin requirements while maintaining full test coverage.
- **Kiro Files Untouched:** `backend/app/schema.py`, `backend/app/validate.py`, and `backend/tests/test_schema_props.py` were not modified.

---

## 7. Needs from Kiro (When Kiro Resumes)

1. **`app/validate.py` (Task 8.3):**
   - Implement real `validate_scene(raw: str | dict) -> ValidationResult` with coordinate clamping (±0.02), dangling segment removal, ID deduplication, and the appearance-only label vocabulary check ("blue polygon", "red line" rejection on points, segments, and polylines).
   - Once implemented, update the single import in `backend/app/main.py`:
     ```python
     # Replace: from app._temp.validate_stub import ValidationResult, validate_scene
     # With:    from app.validate import ValidationResult, validate_scene
     ```
   - Delete `backend/app/_temp/validate_stub.py`.
2. **Properties P9 & P10 (Tasks 8.6 & 8.7):**
   - Write hypothesis property tests P9 (validator repairs) and P10 (Raw Mode segment bound ≤ 300) in `test_validate_props.py` / `test_raw_mode_props.py`.

---

## 8. TEMP Stub Register Entry & BUILD_LOG Entry

*(Per prompt instructions, not written directly to `docs/handoffs/KIRO-PAUSE.md` or `docs/BUILD_LOG.md` to prevent write collisions with the parallel frontend agent)*

### TEMP Stub Register Row (to append to `docs/handoffs/KIRO-PAUSE.md` §7):
| Stub file | Replaces (Kiro) | Imported by | Swap = change this import |
|---|---|---|---|
| `backend/app/_temp/validate_stub.py` (T08; contract `validate_scene(raw) -> ValidationResult(scene, errors)`, no repair or vocab check) | `backend/app/validate.py` (Task 8.3) | `backend/app/main.py` | Change import `from app._temp.validate_stub` to `from app.validate` in `main.py`, then delete `backend/app/_temp/validate_stub.py` |

### BUILD_LOG Entry (to append to `docs/BUILD_LOG.md`):
```markdown
## [2026-11-01] Task 8 — Backend Scene Pipeline (Antigravity)
- **Built:**
  - `VisionProvider` interface & `VisionError` (`app/vision/base.py`).
  - `GeminiProvider` (`app/vision/gemini.py`) with configurable `GEMINI_THINKING_BUDGET` (default 0), `gemini-3.8-flash` default model, and structured JSON output.
  - `NvidiaProvider` (`app/vision/nvidia.py`) with `fit_image_for_inline` OpenCV helper (180 KB cap) and OpenAI-compatible endpoint mapping for `meta/llama-3.2-11b-vision-instruct`.
  - `ProviderChain` & `build_chain_from_env` (`app/vision/chain.py`, `app/vision/__init__.py`) with fallback on `VisionError` and silent skipping of missing keys.
  - Extraction prompts (`app/vision/prompts.py`) with DiagramScene JSON schema, TouchSight teacher vocabulary rules, and validation retry feedback.
  - OpenCV Raw Mode fallback (`app/raw_mode.py`) with GaussianBlur, Canny, findContours, approxPolyDP, ≤300 segment bound, and `RawModeError`.
  - `POST /api/v1/scene` endpoint in `app/main.py` with size/MIME validation, configurable 15 s total / 8 s provider timeouts, retry-once flow, Raw Mode floor, `X-Vision-Provider` header, and dependency-injected validator and chain.
  - TEMP stub `app/_temp/validate_stub.py`.
  - 34 comprehensive backend tests (92 passing across the backend).
- **Files touched:**
  - `backend/pyproject.toml`
  - `backend/.env.example`
  - `backend/app/main.py`
  - `backend/app/raw_mode.py`
  - `backend/app/vision/base.py`
  - `backend/app/vision/gemini.py`
  - `backend/app/vision/nvidia.py`
  - `backend/app/vision/chain.py`
  - `backend/app/vision/prompts.py`
  - `backend/app/vision/__init__.py`
  - `backend/app/_temp/validate_stub.py`
  - `backend/tests/test_raw_mode.py`
  - `backend/tests/test_prompts.py`
  - `backend/tests/test_fit_inline.py`
  - `backend/tests/test_chain.py`
  - `backend/tests/test_gemini_provider.py`
  - `backend/tests/test_nvidia_provider.py`
  - `backend/tests/test_scene_pipeline.py`
- **Verification:** `pytest` (92/92 passed), `ruff check` (clean), `ruff format --check` (clean), zero secrets in repo.
```
