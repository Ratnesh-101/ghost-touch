# T09a Report — Backend Diagram Question Answering (`POST /api/v1/ask`)

**Builder:** Antigravity (agy)  
**Task:** Task 9.1 — Backend `POST /api/v1/ask` (scene QA, facts lookup fallback, provider text completion)  
**Reviewer:** Claude Code (Kiro paused)  
**Date:** 2026-11-01  

---

## 1. Summary of Changes

Followed `AGENTS.md` and user instructions strictly:
- **Backend Only**: Owned `backend/**` only; touched zero files in `frontend/`, `research/`, or deploy configurations.
- **No Kiro-owned files edited**: Untouched `frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**`.
- **No state-changing git commands run**: Read-only `status`, `diff`, `log` only.
- **No secrets touched**: No `.env` files opened, inspected, or modified; zero keys logged or exposed.
- **No new dependencies**: Used existing packages in `backend/.venv`.
- **Prompt hygiene & privacy**: Never logs question text or scene JSON; prompt-injection defenses keep user questions strictly enclosed as untrusted data.

### Implementation Details

1. **Ask Module (`backend/app/ask.py`)**:
   - **Pydantic Request & Response Models**:
     - `AskRequest`: validates `scene` via `DiagramScene.model_validate`; validates `question` length 1 to 500 characters after `strip()`; validates `lang` against BCP-47 regex (`^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{1,8})*$`). Raises standard HTTP 422 with concise error messages on invalid input.
     - `AskResponse`: strongly typed `{ answer: str, source: Literal["ai", "facts", "unknown"] }`.
   - **Compact Scene Generator (`compact_scene`)**:
     - Summarizes long polylines (>10 points) into `{ id, label, point_count, x_min, x_max, y_min, y_max }` to drastically reduce prompt token count and latency while retaining bounds.
     - Preserves all facts, points, segments, and bars in full.
   - **Prompt Builder (`build_ask_prompt`)**:
     - Answers in at most 2 short sentences using only the scene JSON and its `facts`.
     - Standard refusal if unsupported: exactly `"I don't know from this diagram."` (or translated for Hindi/Gujarati).
     - Prompt injection hygiene: encloses untrusted question in `<user_question>` and `</user_question>` delimiters with explicit instructions to ignore instructions/jailbreaks inside the block; sanitizes embedded closing tags (`&lt;/user_question&gt;`).
   - **Deterministic Facts Lookup (`facts_lookup`)**:
     - Written fresh in the backend (no research imports).
     - Extracts candidates from `scene.facts`, labeled segments, bars, and points.
     - Normalizes units (e.g. `degrees` → `°`, `centimeters` → `cm`), handles 2-letter segment reversals (e.g. `BA` matches `AB`), and matches content words and identifiers with scoring threshold.
     - Serves as offline/quota-free fallback (`source: "facts"`). If no candidate matches, safely returns `None` (`source: "unknown"` with `"I don't know from this diagram."`).
   - **Workflow (`answer_question`)**:
     - Total budget 10 s (configurable via `ASK_TIMEOUT_SECONDS`), then falls back to facts lookup.
     - Structured privacy logging: logs provider, source, question length, scene point count, and elapsed ms. Never logs question text or diagram elements.

2. **Provider Text Completion Extensions (`backend/app/vision/`)**:
   - `VisionProvider` protocol (`backend/app/vision/base.py`): added `complete(prompt, *, timeout) -> str`.
   - `GeminiProvider` (`backend/app/vision/gemini.py`): implemented text-only `complete` with `GenerateContentConfig(temperature=0.0)` and optional thinking budget.
   - `NvidiaProvider` (`backend/app/vision/nvidia.py`): implemented text-only `complete` via OpenAI-compatible `/chat/completions` payload.
   - `ProviderChain` (`backend/app/vision/chain.py`): implemented `complete` trying providers in sequence and falling through on `VisionError`.

3. **FastAPI Route (`backend/app/main.py`)**:
   - Added `POST /api/v1/ask` with dependency injection: `chain: Annotated[ProviderChain, Depends(get_provider_chain)]`.
   - Keeps prompt logic isolated in `app/ask.py`.

---

## 2. Verification & Proof of DoD

### Definition of Done Checks

| Check | Expected Result | Actual Result | Status |
|---|---|---|---|
| Triangle sample: `"What is the length of AB?"` | Answer contains number `"5"` and unit `"cm"` | `"AB = 5 cm."` (`source: "facts"`) | **Pass** |
| Triangle sample: `"What colour is it?"` | Exactly `"I don't know from this diagram."` | `"I don't know from this diagram."` (`source: "unknown"`) | **Pass** |
| AI provider answer | Response from fake provider | `source: "ai"`, answer returned | **Pass** |
| AI provider says don't know | Refusal converted to standard unknown | `source: "unknown"`, `"I don't know from this diagram."` | **Pass** |
| Provider error fallback | Provider raises `VisionError`, fallback to facts | `source: "facts"`, `"AB = 5 cm."` | **Pass** |
| Both fail | Provider error + unsupported question | `source: "unknown"`, `"I don't know from this diagram."` | **Pass** |
| Prompt delimiters | Enclosed in `<user_question>` delimiters | Verified: `start < q < end` | **Pass** |
| Over-long question (>500 chars) | HTTP 422 Unprocessable Entity | HTTP 422: `"question must be 1 to 500 characters after trimming"` | **Pass** |
| Empty / whitespace question | HTTP 422 Unprocessable Entity | HTTP 422 | **Pass** |
| Bad language tag (e.g. `"english"`, `"123"`) | HTTP 422 Unprocessable Entity | HTTP 422: `"Invalid BCP-47 language tag"` | **Pass** |
| Valid language tags (`en`, `en-IN`, `hi`, `gu`) | HTTP 200 OK | HTTP 200 OK | **Pass** |
| Prompt injection defense | Attempt stays inside data block | Closing tags escaped, unescaped delimiter appears only once | **Pass** |
| Privacy logging | Never log question text or scene | Verified via `caplog`: secret question and scene titles absent from logs | **Pass** |

### Test Suite Execution

```bash
# Pytest execution across entire backend
backend/.venv/Scripts/python -m pytest
# Result: 167 passed, 1 warning (Starlette testclient deprecation) in 2.28s

# Lint check
backend/.venv/Scripts/python -m ruff check backend
# Result: All checks passed!

# Format check
backend/.venv/Scripts/python -m ruff format --check backend
# Result: 34 files already formatted
```

---

## 3. Files Touched

- `backend/app/ask.py` (created complete module)
- `backend/app/main.py` (wired `POST /api/v1/ask` route)
- `backend/app/vision/base.py` (added `complete` protocol method)
- `backend/app/vision/chain.py` (added `complete` to `ProviderChain`)
- `backend/app/vision/gemini.py` (added `complete` to `GeminiProvider`)
- `backend/app/vision/nvidia.py` (added `complete` to `NvidiaProvider`)
- `backend/tests/test_ask.py` (created 28 comprehensive tests for Ask)
- `backend/tests/test_chain.py` (added tests for `ProviderChain.complete`)
- `backend/tests/test_gemini_provider.py` (added tests for `GeminiProvider.complete`)
- `backend/tests/test_nvidia_provider.py` (added tests for `NvidiaProvider.complete`)

---

## 4. Suggested BUILD_LOG Entry

```markdown
### 2026-11-01 — Task 9.1: Backend POST /api/v1/ask (Antigravity)
- **Built:**
  - `POST /api/v1/ask` endpoint accepting `{ scene, question, lang }` and returning `{ answer, source }` (`ai` | `facts` | `unknown`).
  - Pydantic models `AskRequest` and `AskResponse` with strict BCP-47 language validation and trimmed question length bounds (1-500 chars).
  - Compact scene builder `compact_scene()` omitting verbose polylines (>10 points) with bounding summaries.
  - Prompt builder `build_ask_prompt()` in `app/ask.py` with strict delimiters `<user_question>...</user_question>` and anti-injection instructions.
  - Deterministic facts-lookup fallback `facts_lookup()` over `scene.facts` and element labels/values, handling unit normalization and 2-letter segment reversal.
  - Text-only completion `complete(prompt, timeout)` on `GeminiProvider`, `NvidiaProvider`, and `ProviderChain` with fallback on `VisionError` or timeout.
  - Zero-exposure privacy logging (log lengths, provider, and outcome only; question text and scene data never logged).
  - 28 new tests in `backend/tests/test_ask.py`, plus provider unit tests in `test_chain.py`, `test_gemini_provider.py`, and `test_nvidia_provider.py`.
- **Broke:** None. All 167 backend tests pass; `ruff check` and `ruff format` clean.
- **Files touched:**
  - `backend/app/ask.py`
  - `backend/app/main.py`
  - `backend/app/vision/base.py`
  - `backend/app/vision/chain.py`
  - `backend/app/vision/gemini.py`
  - `backend/app/vision/nvidia.py`
  - `backend/tests/test_ask.py`
  - `backend/tests/test_chain.py`
  - `backend/tests/test_gemini_provider.py`
  - `backend/tests/test_nvidia_provider.py`
```
