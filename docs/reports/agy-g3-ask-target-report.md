# Lane g3-ask-target report — Ask target (server validation + client parser)

Builder: **agy, reviewed by Claude**
Date: 2026-11-06

## Summary
Implemented optional guide target support for the Ask endpoint per `docs/briefs/agy-g3-ask-target.md` and `docs/briefs/guide-share-contract.md`. The server validates returned targets strictly against scene element IDs and normalized [0, 1] coordinate bounds, dropping malformed or unknown targets to `None` without raising. The client parses responses tolerantly into `GuideTarget` per the contract, never throwing on malformed target data.

## What Was Built

### 1. Backend (`backend/app/ask.py`)
- **Pydantic Models**:
  - `ElementTarget(elementId: str)` with `extra="forbid"` and non-empty string validation.
  - `PointTarget(x: float, y: float)` with `extra="forbid"`, `ge=0.0, le=1.0`, and finite float validation.
  - `AskTarget = ElementTarget | PointTarget` (with aliases `AskElementTarget`, `AskPointTarget`).
  - `AskResponse.target: AskTarget | None = None`. Existing fields (`answer`, `source`) remain unchanged.
- **Scene Element IDs**:
  - `extract_scene_element_ids(scene: DiagramScene) -> list[str]` collects unique non-empty element IDs in document order from `points`, `segments`, `polylines`, and `bars`.
- **Prompt Construction**:
  - Updated `build_ask_prompt`:
    - Injects a `Scene Element IDs` section listing all element IDs in the scene.
    - Adds Rule 5 instructing the model to optionally output JSON with `"target"` ONLY for location/navigation requests (e.g. "where is", "take me to", "find", "locate") choosing an ID from the list, and to omit `"target"` or reply in plain text for non-location queries.
    - Preserves <= 2 short sentences rule, exact "I don't know from this diagram." rule, untrusted user data delimiters, and delimiter placement at the end.
- **Tolerant Model Response Parsing**:
  - `parse_model_ask_output(ai_text: str) -> tuple[str, Any]` extracts `(answer_text, raw_target)` from markdown fenced JSON code blocks or raw JSON containing an `"answer"` key. Returns `(ai_text, None)` for plain-text replies.
- **Server-Side Validation**:
  - `validate_ask_target(raw_target: Any, scene: DiagramScene) -> AskTarget | None`:
    - Drops unknown element IDs not present in the scene -> `None`.
    - Drops coordinates outside [0, 1] or non-finite -> `None`.
    - Tolerates arbitrary junk, wrong types, missing fields, or booleans without raising -> `None`.
- **Workflow Integration**:
  - Updated `answer_question`:
    - AI path: validates model target against the scene. If the model says "don't know", target is dropped to `None`.
    - Facts path: target defaults to `None`.
    - Unknown path: target defaults to `None`.

### 2. Frontend Client (`frontend/src/api/ask.ts`)
- **GuideTarget Type**:
  - `export type GuideTarget = { kind: 'element'; elementId: string } | { kind: 'point'; x: number; y: number };` matching contract.
  - `AskResponse.target?: GuideTarget`.
- **Tolerant Target Parser**:
  - `export function parseTarget(raw: unknown): GuideTarget | undefined`:
    - Maps `{ elementId: string }` -> `{ kind: 'element', elementId }`.
    - Maps `{ x: number, y: number }` (with finite numbers in [0, 1]) -> `{ kind: 'point', x, y }`.
    - Returns `undefined` for malformed, non-object, out-of-range, or non-finite inputs; never throws.
- **Response Parsing**:
  - `parseAskResponse` extracts and validates `target` using `parseTarget`, attaching it if present. Shape checks on `answer` and `source` continue to throw `AskRequestError('bad-response')` as required.

### 3. Tests
- **`frontend/tests/api.ask.target.test.ts` (14 new Vitest tests)**:
  - Element target parsing and whitespace trimming.
  - Point target parsing within [0, 1] and exact boundaries (0, 1).
  - Out-of-bounds coordinates (<0, >1) -> undefined.
  - Non-finite coordinates (NaN, Infinity, -Infinity) -> undefined.
  - Empty or invalid element IDs -> undefined.
  - Incomplete point objects, wrong types, booleans -> undefined.
  - Arbitrary junk tolerance without throwing.
  - `parseAskResponse` with element target, point target, null/undefined/missing target, and junk targets.
  - Shape check preservation for `answer` and `source`.
  - End-to-end `requestAsk` delivering target and tolerating invalid server target.
- **`backend/tests/test_ask_target.py` (10 pytest unit tests)**:
  - Valid element ID kept in target.
  - Segment ID in markdown fenced block kept.
  - Unknown element ID dropped to `None`.
  - Valid in-range point kept.
  - Out-of-range and non-finite xy dropped to `None`.
  - Plain-text model reply unchanged (`target: None`).
  - Model "don't know" drops target (`target: None`).
  - Facts lookup fallback has `target: None`.
  - Arbitrary junk targets tolerated without 500 error.
  - `build_ask_prompt` element IDs and navigation instructions verification.
  - Direct unit tests of `validate_ask_target` and `parse_model_ask_output`.
- **`backend/tests/test_ask_target_props.py` (3 Hypothesis property-based tests)**:
  - Property 1: `validate_ask_target` with arbitrary recursive junk on fixed triangle scene yields `None`, valid `ElementTarget`, or in-range `PointTarget`, never raising.
  - Property 2: `validate_ask_target` on randomized valid scenes with arbitrary junk satisfies invariant.
  - Property 3: `parse_model_ask_output` + `validate_ask_target` pipeline with arbitrary string text never raises.

## Verification & Commands

| Command | Result |
|---|---|
| `npm --prefix frontend test` | 83 test files passed, 1217 tests passed (including all 14 new tests in `api.ask.target.test.ts`) |
| `npm --prefix frontend exec -- tsc -p frontend --noEmit` | Note: 31 unused `@ts-expect-error` in pre-existing test files (see below); zero errors in `src/` or our new test |
| Backend pytest / ruff | Not run per brief instructions ("Do NOT run pytest or ruff (supervisor does)") |

## Follow-up Lane g3-fix (Supervisor Gate Fixes)

### 1. `backend/tests/test_ask_target_props.py`: Missing `pytest` import (ruff F821)
- **Problem**: `backend/tests/test_ask_target_props.py` called `pytest.fail(...)` in property failure branches, but `import pytest` was omitted, causing ruff F821 undefined name errors.
- **Fix**: Added `import pytest` to `backend/tests/test_ask_target_props.py`.

### 2. `backend/tests/test_ask_target.py`: Junk target case 12 & exact element ID matching
- **Problem**: `test_ask_target_junk_tolerated[junk_target12]` failed with `assert data["target"] is None` got `{'elementId': 'A'}`.
- **Root Cause & Contract Analysis**:
  - Case 12 in the parameterized test was `{"elementId": "A", "x": 0.5}`, an ambiguous payload mixing both element ID and coordinate keys.
  - Previously, `validate_ask_target` checked `if "elementId" in raw_target:`, which matched and extracted `"A"`, ignoring the extra coordinate key `"x": 0.5`. Additionally, `elem_id.strip()` was performed, which would accept padded IDs like `" A "` as `"A"`.
  - By contract (`docs/briefs/guide-share-contract.md`), `target` is strictly `{elementId: string} | {x: number, y: number} | null`. Extra keys are forbidden (`extra="forbid"` on both `ElementTarget` and `PointTarget`). Furthermore, the server drops any `elementId` not present in the scene, and a padded ID like `" A "` is not an exact scene ID.
- **Changes Made**:
  - In `backend/app/ask.py`:
    - Updated `validate_ask_target` to strictly enforce dictionary key schemas:
      - Element target dicts must have keys exactly matching `{"elementId"}` (extra keys rejected).
      - Point target dicts must have keys exactly matching `{"x", "y"}` (extra keys rejected).
    - Element IDs are matched strictly and EXACTLY (`elem_id in valid_ids`) with no strip-then-accept.
    - Updated `ElementTarget._validate_element_id` to validate non-emptiness while preserving the exact string without stripping, ensuring padded IDs like `" A "` are not normalized into valid scene IDs.
  - In `backend/tests/test_ask_target.py`:
    - Kept `{"elementId": "A", "x": 0.5}` in `test_ask_target_junk_tolerated`, which now correctly evaluates to `target: None`.
    - Added `{"elementId": " A "}` to `test_ask_target_junk_tolerated` to explicitly test rejection of padded IDs.
    - Added unit test assertions in `test_validate_ask_target_direct` confirming that padded IDs and dicts with extra keys are dropped to `None`.

### 3. Verification & Commands
- Per brief instructions ("Do not run pytest or ruff (supervisor runs them)"), neither pytest nor ruff was run; both are reserved for the supervisor.

## Needs from Planner / Kiro
- In `frontend/tests/`: 31 pre-existing test files (such as `AccessibleButton.test.tsx`, `RateSelector.test.tsx`, etc.) contain `// @ts-expect-error` directives before `import fs from 'node:fs';`. In the current TypeScript configuration, `import fs from 'node:fs'` resolves without error, causing TypeScript TS2578 (`Unused '@ts-expect-error' directive`) when typechecking tests. These files are Kiro-owned/pre-existing and not within this lane's allowed files list.

## Files Touched
- `backend/app/ask.py`
- `backend/tests/test_ask_target.py` (new)
- `backend/tests/test_ask_target_props.py` (new)
- `frontend/src/api/ask.ts`
- `frontend/tests/api.ask.target.test.ts` (new)
- `docs/reports/agy-g3-ask-target-report.md` (new)
- `docs/BUILD_LOG.md`
