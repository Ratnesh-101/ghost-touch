# Conflict Resolution Report: Lane bu12 (Stay on Line / Sticky Line Following)

**Lane:** bu12 (`gt-lane-bu12` — Stay on line switch and sticky line following)  
**Merged with:** `agy/bu8b` (Page Edge Cues, Corner Heartbeat, Speech Pacing, and Speech Detail)  
**Status:** Clean — Merge conflicts resolved; zero conflict markers remaining; all features from both sides fully preserved.

---

## 1. Conflict Resolution Summary

Merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) from merging `agy/bu8b` into lane `bu12` were identified and resolved in:
- `frontend/src/components/LabSettings.tsx`
- `frontend/src/drivers/storage.ts`
- `frontend/src/flow/explore.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/tests/labSettings.test.tsx`

All conflict blocks were resolved by preserving the intent, logic, types, and tests of BOTH sides:
- **Lane bu12 features:** Stay on line ("Stay-on-line") switch, localStorage persistence (`STORAGE_KEY_STICKY_LINE`), sticky line hold tracking (`getHeldMs`, `updateStickyHoldState`, `resetStickyHoldOnLift`), `processPointerMove` sticky line targeting with `followTarget`, and unit tests.
- **`agy/bu8b` features:** Corner heartbeat switch (`STORAGE_KEY_CORNER_HEARTBEAT`, `DEFAULT_HEARTBEAT`, `heartbeatStep`), Page edge cues (`checkPageEdge`, `PAGE_EDGE_REARM_PX`), Speech pacing (`paceSpeech`, `checkBarRest`, `updateBarMove`), and speech detail options (`full` / `short`).

---

## 2. Details of Merged Files

### 2.1 `frontend/src/components/LabSettings.tsx`
- **Imports:** Merged storage imports to include both `getStoredStickyLineSetting`, `setStoredStickyLineSetting` (bu12) and `getStoredCornerHeartbeatSetting`, `setStoredCornerHeartbeatSetting` (bu8b / hb2).
- **Component Sections:** Both the "Stay on line" switch (`lab-settings-section-sticky-line`) and "Corner heartbeat" switch (`lab-settings-section-corner-heartbeat`) are present with accessible 48×48 px controls, switch roles, and spoken state announcements.

### 2.2 `frontend/src/drivers/storage.ts`
- **Storage Keys:** Retained both `STORAGE_KEY_STICKY_LINE = 'gt_sticky_line_enabled'` and `STORAGE_KEY_CORNER_HEARTBEAT = 'gt_corner_heartbeat_enabled'`.
- **Get/Set/Reset Helpers:** Retained both sets of helpers:
  - `getStoredStickyLineSetting`, `setStoredStickyLineSetting`, `_resetStickyLineSettingForTesting` (default: `false`).
  - `getStoredCornerHeartbeatSetting`, `setStoredCornerHeartbeatSetting`, `_resetCornerHeartbeatSettingForTesting` (default: `false`).

### 2.3 `frontend/src/flow/explore.ts`
- **Imports & Re-exports:**
  - Storage imports and exports include both sticky line helpers (`getStoredStickyLineSetting`, `setStoredStickyLineSetting`, `_resetStickyLineSettingForTesting`, `STORAGE_KEY_STICKY_LINE`, `followTarget`, `STICKY_HOLD_MS`, `STICKY_RADIUS_PX`) and corner heartbeat helpers (`getStoredCornerHeartbeatSetting`, `setStoredCornerHeartbeatSetting`, `_resetCornerHeartbeatSettingForTesting`, `STORAGE_KEY_CORNER_HEARTBEAT`, `DEFAULT_HEARTBEAT`, `initialHeartbeatState`, `heartbeatStep`).
- **`processPointerMove` Function Signature & Implementation:**
  - Merged parameter list to support `sticky?: ProcessPointerMoveStickyOptions`, `pageEdgeState: PageEdgeState = initialPageEdgeState()`, `heartbeatState: HeartbeatState = initialHeartbeatState()`, and `heartbeatCfg: HeartbeatConfig | null = null`.
  - Added backward-compatible signature handling supporting both bu12 and bu8b positional call conventions.
  - Retained sticky line target calculation via `followTarget` when enabled, page edge detection via `checkPageEdge`, and corner heartbeat step via `heartbeatStep`.
  - Retained `MovePipelineResult` return containing both `pageEdge` and `heartbeatState`.

### 2.4 `frontend/src/screens/Explore.tsx`
- **Imports & Refs:**
  - Retained imports for both `DEFAULT_HEARTBEAT`, `getStoredSpeechDetailSetting`, `resetBarRest`, `type SpeechPacingState`, `type SpeechSource` and `getStoredStickyLineSetting`, `getHeldMs`, `resetStickyHoldOnLift`, `type StickyHoldState`.
  - Maintained both `stickyLineSettingRef` and `cornerHeartbeatSettingRef` with `subscribeSettings` updates.
- **Event Handlers & Move Pipeline:**
  - `keepAliveTimer`: passes sticky options along with `pageEdgeState.current`, `heartbeatState.current`, and heartbeat config; preserves `applyMoveResult(..., true)` stillness pacing and updates `stickyHoldRef`.
  - `handlePointerDown`: reads both settings; on both askActive and normal exploration paths, passes sticky options and heartbeat/page edge states to `processPointerMove`; updates `stickyHoldRef`.
  - `handlePointerMove`: on both askActive and normal exploration paths, passes sticky options and heartbeat/page edge states to `processPointerMove`; updates `stickyHoldRef`.
  - `handlePointerLift`: on secondary pointer promotion, re-seeds state, runs lift step, and steps the promoted pointer with both sticky options and heartbeat/page edge states.
  - State resets on finger lift, pointer cancel, window blur, visibility change, Ask activation, Guide start, and unmount reset both `stickyHoldRef.current = resetStickyHoldOnLift()` and `heartbeatState.current = initialHeartbeatState()`.

### 2.5 `frontend/tests/labSettings.test.tsx`
- **Test Suites:**
  - Kept `describe('LabSettings stay on line toggle (Lane bu12)', ...)` asserting switch button rendering, default off (`aria-checked="false"`), fixed label, and localized labels in Hindi and Gujarati.
  - Kept `describe('LabSettings corner heartbeat toggle (Lane hb2)', ...)` asserting switch button rendering, default off (`aria-checked="false"`), 48×48 px minimum target, fixed label, and localized labels in Hindi and Gujarati.

---

## 3. Verification & Invariants

- **Syntactic validity:** Re-read every resolved file. All files are syntactically valid TypeScript.
- **Import integrity:** No duplicate imports exist in any resolved file.
- **Conflict markers:** Exactly 0 conflict marker lines (`<<<<<<<`, `=======`, `>>>>>>>`) remain anywhere across the workspace.
- **Compliance with headless run constraints:**
  - Zero shell commands executed (strict compliance with "Do NOT run any shell command").
  - No `.env` files opened, read, or modified.
  - No Kiro-owned files (`frontend/src/core/**` or `.kiro/**`) modified.
  - Tuned haptic values in `DEFAULT_HAPTICS`, `DEFAULT_HEARTBEAT`, `tech.md`, etc., untouched.
