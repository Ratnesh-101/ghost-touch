# Antigravity Lane Report: ux14 — Storage Getters & Ask Listening Corner Exit Guard

**Lane:** ux14 (EX)  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-18  

---

## 1. What was built

### Fix 1: Storage Getters (`getStoredGraphScanSetting`, `getStoredGuideSetting`, and `getStoredTeacherSetting`)
- **Requirement 46 (P148 and P149)**:
  - Updated `getStoredGraphScanSetting` in `frontend/src/flow/explore.ts`, `getStoredGuideSetting` in `frontend/src/config/features.ts`, and `getStoredTeacherSetting` in `frontend/src/flow/teach.ts` to follow the exact pattern used by the four getters fixed in lane ux10 (`getStoredDirectionsSetting`, `getStoredFindingSoundSetting`, `getStoredStickyLineSetting`, `getStoredCornerHeartbeatSetting`).
  - **In-memory precedence (P149)**: If an in-memory value has been set, it takes precedence. Even if `localStorage.setItem` throws (e.g. `QuotaExceededError`), the value just set is returned on subsequent getter calls.
  - **Strict boolean parsing & documented defaults (P148)**: When no in-memory value exists (`inMemory === null`):
    - Stored `'true'` returns `true`.
    - Stored `'false'` returns `false`.
    - Any other stored string (e.g. `'yes'`, `'1'`, `'TRUE'`, empty string, junk) or missing item (`null`) returns the documented default:
      - `getStoredGraphScanSetting`: default `true`
      - `getStoredGuideSetting`: default `false`
      - `getStoredTeacherSetting`: default `false`
  - Exported `_resetGuideSettingForTesting()` in `frontend/src/config/features.ts` and `_resetTeacherSettingForTesting()` in `frontend/src/flow/teach.ts` to cleanly reset in-memory state and remove stored keys during tests (matching `_resetGraphScanSettingForTesting`).

### Fix 2: Requirement 28.7 (Corner exits guarded when promoting onto vertex while Ask is listening)
- **Requirement 28.7**: WHILE Ask is listening, the system must not speak corner exits.
- In `frontend/src/screens/Explore.tsx`, updated the surviving pointer promotion path in `handlePointerLift`:
  - Guarded `compassAnnouncements`:
    ```typescript
    const compassAnnouncements = !askActive.current
      ? checkVertexCompass(moveResult.target, now)
      : [];
    ```
  - When Ask is listening (`askActive.current === true`), promoting a surviving finger onto a vertex (such as Corner A) suppresses `compassAnnouncements`, preventing corner exit directions from being announced.
  - When Ask is not listening, exits are computed and announced normally.

---

## 2. Files Changed

- `frontend/src/flow/explore.ts`: Updated `getStoredGraphScanSetting()` with in-memory precedence and strict boolean parsing (default `true`).
- `frontend/src/config/features.ts`: Updated `getStoredGuideSetting()` with in-memory precedence and strict boolean parsing (default `false`); added `_resetGuideSettingForTesting()`.
- `frontend/src/flow/teach.ts`: Updated `getStoredTeacherSetting()` with in-memory precedence and strict boolean parsing (default `false`); added `_resetTeacherSettingForTesting()`.
- `frontend/src/screens/Explore.tsx`: Guarded `checkVertexCompass` in the surviving pointer promotion branch of `handlePointerLift` with `!askActive.current`.

---

## 3. Tests Added

- `frontend/tests/settings.getters.test.ts`:
  - Unit tests covering P148 and P149 for `getStoredGraphScanSetting`, `getStoredGuideSetting`, and `getStoredTeacherSetting`:
    - Default returned when nothing is in storage (graph scan -> `true`, guide -> `false`, teacher -> `false`).
    - Exact parsing of `'true'` and `'false'`.
    - Documented defaults returned for various junk stored strings (`''`, `'yes'`, `'no'`, `'TRUE'`, `'True'`, `'1'`, `'0'`, `' true'`, `'null'`, etc.).
    - In-memory precedence when `localStorage.setItem` throws `QuotaExceededError`.
    - Normal read-back after successful setters.
- `frontend/tests/explore.askListeningCorner.test.tsx`:
  - Test for Requirement 28.7 verifying that promoting a surviving finger onto Corner A while Ask is listening speaks no exits (`COMPASS_OR_LINE_NAME` regex filter returns empty, and no `"to B"` or `"to C"` exit phrases are spoken). Fails if the `!askActive.current` guard is removed.
  - Control test verifying that promoting a surviving finger onto Corner A without Ask listening speaks the corner exits (`"to B"` and `"to C"`).

---

## 4. What Could Not Be Verified

- Per UX lane rules: *"Do NOT run any shell command. No npm, npx, node, python, pytest, ruff, git, curl. The orchestrator runs all gates."*
- Consequently, test suites (`npm --prefix frontend test`, `tsc --noEmit`, etc.) were not executed in this session. The orchestrator runs all gates and will flip the `it.fails` markers in Kiro's test files:
  - `frontend/tests/storage.settings.prop.test.ts` (P148 and P149 graph scan / guide rows)
  - `frontend/tests/explore.wiring.guards.test.tsx` ('Ask listening: promoting a finger onto corner A speaks no exits (28.7)')
