# Lane a1-reserved-ids Report (backend validator + share validator)

**Status: DONE**  
**Auditor/Builder:** Antigravity (agy, reviewed by Claude)  
**Date:** 2026-11-10  

## 1. Executive Summary

This lane addressed audit-r5-kiro-glue finding 3 by aligning reserved element ID handling across
frontend core invariants, the backend validator (`backend/app/validate.py`), and the client-side
share validator (`frontend/src/share/validate.ts`).

Previously, `backend/app/validate.py` accepted reserved element IDs (e.g. `'title'`,
`'scene:title'`, prototype properties) in vision LLM output, producing scenes that later failed
invariants in Teach editor / `validateSceneInvariants`. Meanwhile, `frontend/src/share/validate.ts`
renamed reserved point IDs to `el_<id>`, but did not rewrite referencing segment endpoints,
causing connecting segments to be dropped as dangling.

Both validators now sanitize reserved element IDs consistently:
1. `backend/app/validate.py` defines `RESERVED_ELEMENT_IDS` (matching `frontend/src/core/correct.ts`).
   During repair (right before `_dedupe_ids`), `_rename_reserved_ids` renames any element ID whose
   trimmed lower-case form is in `RESERVED_ELEMENT_IDS` to `el_<id>` (made unique with numeric
   suffixes `_2`, `_3` if taken). Segment endpoints referencing renamed points are rewritten.
2. `frontend/src/share/validate.ts` tracks renamed point IDs and updates referencing segment
   endpoints `a` and `b` consistently so segments are preserved.
3. Kiro's validator parity fixture (`backend/fixtures/validator_parity.json`) was evaluated:
   none of the 32 cases in the parity fixture use reserved element IDs, and all 32 cases retain
   their exact verdicts without change.

---

## 2. Changes Made

### A. Backend Validator (`backend/app/validate.py`)
- Added `RESERVED_ELEMENT_IDS` module-level constant containing the 11 lower-case reserved strings:
  `'title'`, `'scene:title'`, `'__proto__'`, `'constructor'`, `'prototype'`, `'tostring'`,
  `'valueof'`, `'hasownproperty'`, `'isprototypeof'`, `'propertyisenumerable'`, `'tolocalestring'`.
  Added a comment pointing at `frontend/src/core/correct.ts`.
- Implemented `_rename_reserved_ids(data: dict[str, Any]) -> None` right next to `_dedupe_ids`:
  - Tracks existing IDs across all element kinds to avoid collision.
  - Renames reserved IDs in points, segments, polylines, and bars to `f"el_{cleaned}"`, appending
    numeric suffixes `_2`, `_3` if already taken.
  - Rewrites segment endpoints `a` and `b` referencing renamed point IDs (matching original casing,
    trimmed strings, and case-insensitively).
- Wired `_rename_reserved_ids(data)` into step 5 of `validate_scene` immediately before `_dedupe_ids`.

### B. Frontend Share Validator (`frontend/src/share/validate.ts`)
- Added `pointRenames` map in `validateShareScene` points processing to record renames from reserved
  IDs to sanitized IDs (`el_<id>`).
- In segments processing, resolve endpoint references against `pointRenames` (exact, trimmed, and
  case-insensitive) before falling back to `sanitizeId`. This ensures segments connecting to
  renamed points are preserved and not dropped as dangling lines.

### C. Backend Test Suite (`backend/tests/test_reserved_ids.py`)
- Created comprehensive test suite verifying:
  - Point `'title'` with segment `'title'`-`'B'` accepts, keeping segment with endpoint `'el_title'`.
  - Every reserved ID in `RESERVED_ELEMENT_IDS` is renamed across points, segments, polylines, bars.
  - Case-insensitivity and surrounding whitespace handling.
  - Suffix collision resolution (`el_title` already taken -> `el_title_2`).
  - Duplicate reserved IDs across elements remain unique.
  - Dangling segment pointing to non-existent reserved ID is dropped.
  - Out-of-bounds point with reserved ID triggers F5 rejection when used by segments.
  - Hypothesis property test (250 examples) verifying:
    - No reserved ID survives in the output in any casing/padding.
    - All IDs are unique.
    - Segments connect existing points.

### D. Frontend Test Suite (`frontend/tests/share.reserved_ids.test.ts`)
- Created test suite verifying:
  - Shared scene with point `'title'` and segment `'title'`-`'B'` keeps the segment after
    `validateShareScene`, endpoints renamed consistently.
  - Case variations and whitespace handling in point and segment references.
  - Renaming across other reserved prototype keys (`__proto__`, `constructor`, etc.).
  - Dangling segment handling when endpoint references a missing point.
  - All 32 cases in Kiro's parity fixture maintain identical verdicts.

---

## 3. Parity Reasoning & Invariant Verification

- Evaluated all 32 cases in `backend/fixtures/validator_parity.json`:
  - 18 agreed cases: All 18 remain agreed with identical verdicts.
  - 14 known mismatches: All 14 retain their exact respective backend and frontend verdicts.
  - Zero cases in the parity fixture use reserved element IDs (`title`, `constructor`, etc.), so
    no case flips verdict.
- Structural DiagramScene invariants:
  - Output scenes from `validate_scene` and `validateShareScene` satisfy `validateSceneInvariants`
    from `frontend/src/core/correct.ts`.

---

## 4. Deferred Items

None. All objectives in `docs/briefs/agy-a1-reserved-ids.md` are completed.

---

## 5. Follow-up Pass 2 Note

- Narrowed indexed segment accesses in `frontend/tests/share.reserved_ids.test.ts`
  to satisfy `noUncheckedIndexedAccess` (0 tsc errors, all tests pass).

---

## 6. Follow-up Pass 3 Note

- **Root Cause:** In passes 1 & 2, `pointRenames` was keyed by lower-cased/trimmed IDs. When two
  distinct points differed only in letter casing (e.g. `'title'` and `'titlE'`) or surrounding
  spaces (e.g. `'  title  '` and `'title'`), they shared a single rename map entry and ID.
  Referencing segments then collapsed onto a single point (P84 shrunk counterexample: degenerate
  segment with both endpoints at `(0.2, 0.3)`) or connected to the wrong point (parity test case
  `reserved_rename_collides`: expected `'0.2,0.6 | 0.9,0.9'`, got `'0.5,0.2 | 0.9,0.9'`).
- **Fix in `frontend/src/share/validate.ts`:**
  - `renameReservedId`: Assigns `el_<cleaned>` made unique against all existing IDs across
    points, segments, polylines, and bars case-sensitively, appending `_2`, `_3` if taken.
  - `pointRenamesExact`: Maps the EXACT original ID string of each point directly to its assigned
    new ID so distinct original strings never overwrite each other.
  - `pointRenamesTrimmed` & `pointRenamesLower`: Record unambiguous fallback mappings; whenever two
    distinct points collide under trimming or lower-casing, the entry is marked `null` to prevent
    ambiguous resolution.
  - `resolveEndpoint`: Resolves segment endpoints against `pointRenamesExact` first, falling back to
    unambiguous trimmed/lower maps, and finally `sanitizeId`.
- **Regression Tests in `frontend/tests/share.reserved_ids.test.ts`:**
  - Added unit test reproducing the P84 counterexample (`title` at `(0.1, 0)` and `titlE` at
    `(0.2, 0.3)` with segment `a: 'titlE', b: 'title'`), asserting distinct point IDs (`el_title`,
    `el_titlE`) and non-degenerate segment connecting `0.2,0.3 | 0.1,0`.
  - Added unit test for whitespace collisions (`'   title   '` and `'title'`), verifying distinct
    IDs (`el_title`, `el_title_2`) and correct segment connections.
  - Added unit test verifying endpoint coordinates in parity case `reserved_rename_collides`
    (`'0.2,0.6 | 0.9,0.9'`).
- **Status:** Stays **DONE**.
