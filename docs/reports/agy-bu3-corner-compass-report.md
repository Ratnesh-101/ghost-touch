# Lane A3 Report: Corner Compass and Line Dwell

**Lane:** A3 (Corner Compass & Line Dwell)  
**Builder:** Antigravity (headless run)  
**Spec & Requirements:** Fable blind user plan (sections 2.3, 2.5, 4: I1, I7); tasks.md / design.md  
**Status:** Complete

---

## 1. Summary of Changes

Lane A3 introduces corner compass directions and line dwell announcements to provide blind and low-vision users with intuitive spatial orientation while exploring STEM diagrams:
1. **Corner Compass (`flow/explore.ts`)**:
   - `cornerCompass(scene, vertexId, arrivedLineId | null, visitedRecently: boolean): string`
   - Spoken after the vertex label: one concise directional clause per leaving exit (e.g., `"Down-right to B."`).
   - Automatically skips the segment the user's finger arrived on.
   - If a vertex has more than 4 exits (or >4 exits to announce), concisely announces `"{n} edges."` (e.g., `"5 edges."`).
   - When `visitedRecently` is true (within 10 s of previous visit), returns `""` to prevent repetitive auditory clutter.
   - Strict 12-word cap: falls back to `"{n} edges."` if the text would exceed 12 words.
2. **Line Name (`flow/explore.ts`)**:
   - `lineName(scene, lineId): string`
   - Segments: Formats name with opposing exit directions towards endpoints, e.g., `"Side AB. Up-left to A, down-right to B."`.
   - Coordinate axes: `"x-axis, left to right"` and `"y-axis, top to bottom"`.
   - Polylines & bar edges: Identifies elements by their trimmed label only (or id if unlabelled).
3. **Explore Screen Integration (`screens/Explore.tsx`)**:
   - Tracks `prevTargetRef` across touch moves and keep-alive ticks to identify the arrival line.
   - Tracks `lastVertexVisitRef` per vertex id with a 10-second window (`VERTEX_VISIT_WINDOW_MS = 10000`).
   - Merges corner compass text into `applyMoveResult` so the corner label and compass directions are spoken as a single seamless utterance.
   - Implements line dwell using the A1 keep-alive timer (`LINE_DWELL_MS = 800`): when stationary on a line for 800 ms, speaks `lineName` once.
   - Leaving the line immediately re-arms dwell for the next visit.
   - Dwell speech is suppressed during the Ask listening window (`askActive`) and while Guide is actively guiding (`isGuiding`).
4. **Settings & Persistence (`drivers/storage.ts` & `components/LabSettings.tsx`)**:
   - Added persistent Directions setting via `STORAGE_KEY_DIRECTIONS = 'gt_directions_enabled'` (default: ON / `true`).
   - Added accessible switch control in `LabSettings`: role="switch", aria-checked, minimum 48×48 CSS px touch target, spoken confirmation on toggle.
   - Disabling Directions suppresses both corner compass announcements and line dwell announcements.
5. **Haptic & Audio Invariance**:
   - `core/hapticEngine.ts`, `core/hitTest.ts`, and tuned haptic constants are completely untouched.
   - Vibrate and tone effect sequences are 100% identical whether Directions are enabled or disabled.
6. **Multi-language Support (`i18n/index.ts`)**:
   - Added 18 direction, compass, and setting translation keys in English (`en`), Hindi (`hi`), and Gujarati (`gu`).
   - Compass direction words mirror `guide.hint.*`.

---

## 2. Files Modified

| File | Changes |
|------|---------|
| `frontend/src/flow/explore.ts` | Added `cornerCompass()`, `lineName()`, `VERTEX_VISIT_WINDOW_MS = 10000`, `LINE_DWELL_MS = 800`, exports. |
| `frontend/src/screens/Explore.tsx` | Integrated `prevTargetRef`, `lastVertexVisitRef`, `lineDwellRef`, dwell check in keep-alive timer and moves, unified utterance merging in `applyMoveResult`. |
| `frontend/src/drivers/storage.ts` | Added `STORAGE_KEY_DIRECTIONS`, `getStoredDirectionsSetting()`, `setStoredDirectionsSetting()`, `_resetDirectionsSettingForTesting()`. |
| `frontend/src/components/LabSettings.tsx` | Added Directions toggle switch section with accessible styling, touch targets, and speech announcements. |
| `frontend/src/i18n/index.ts` | Added 18 i18n keys in `en`, `hi`, and `gu`. |
| `frontend/tests/cornerCompass.test.ts` | Comprehensive acceptance test suite: triangle.json cases, i18n, 12-word limit, haptic invariance, dwell timer. |
| `frontend/tests/flow.explore.test.ts` | Added unit tests for `cornerCompass`, `lineName`, and timing constants. |
| `frontend/tests/LabSettings.test.tsx` | Added tests for LabSettings Directions toggle switch and localization. |
| `docs/reports/agy-bu3-corner-compass-report.md` | This completion report. |

---

## 3. Requirement Verification

### Requirement 1: Pure Functions in `flow/explore.ts`
- `cornerCompass(scene, vertexId, arrivedLineId | null, visitedRecently: boolean): string`
  - On `frontend/public/samples/triangle.json`:
    - Vertex A with no arrival line (`arrivedLineId = null`): `"Down to C. Down-right to B."`
    - Arriving at A from CA: `"Down-right to B."` (skips arrived segment CA).
    - Arriving at A from AB: `"Down to C."` (skips arrived segment AB).
    - Arriving at B from AB: `"Left to C."` (skips arrived segment AB).
    - Arriving at B from BC: `"Up-left to A."` (skips arrived segment BC).
    - Arriving at C from BC: `"Up to A."` (skips arrived segment BC).
    - Arriving at C from CA: `"Right to B."` (skips arrived segment CA).
  - High degree (> 4 exits): Star scene with 5 edges returning `"5 edges."`.
  - Recency suppression: Returns `""` when `visitedRecently = true`.
- `lineName(scene, lineId): string`
  - Segment AB on `triangle.json`: `"Side AB. Up-left to A, down-right to B."`
  - Segment CA on `triangle.json`: `"Side CA. Down to C, up to A."`
  - Segment BC on `triangle.json`: `"Side BC. Right to B, left to C."`
  - Axes: `"x-axis, left to right"` and `"y-axis, top to bottom"`.
  - Polylines & bar edges: Returns trimmed label only.
  - All directional strings translated in `en`, `hi`, `gu`.

### Requirement 2: Explore.tsx Target Tracking & Vertex Entry Utterance
- `prevTargetRef` retains the previous `Target`. When a move enters a vertex, `arrivedLineId` is resolved from `prevTargetRef` (if previous target was a line).
- `lastVertexVisitRef` maps vertex ids to millisecond timestamps. Visits within 10,000 ms (`VERTEX_VISIT_WINDOW_MS`) set `visitedRecently = true`.
- `applyMoveResult` merges vertex label and compass directions via `mergeAnnouncements(axisCrossings, effects, afterAnnouncements)` so they are delivered as one contiguous utterance to `runEffects`.

### Requirement 3: 800 ms Dwell Timer
- Uses the A1 keep-alive timer (`createHoldKeepAliveTimer`, ticking at 60 ms intervals).
- Tracks line id, entry timestamp, and spoken flag via `lineDwellRef`.
- When finger remains on the same line for >= 800 ms (`LINE_DWELL_MS`), speaks `lineName` exactly once.
- Moving off the line (or lifting) clears `lineDwellRef`, re-arming the dwell for future visits.
- Speech is gated by `!askActive.current && !guideController.current?.isGuiding()`.

### Requirement 4: Directions Toggle in Settings
- Stored in `localStorage` under `gt_directions_enabled`.
- Default: `true` (ON).
- When toggled OFF, suppresses both `cornerCompass` extra announcements and `lineName` dwell speech.
- `LabSettings` includes a switch button with `role="switch"`, `aria-checked`, 48×48 px minimum dimensions, and spoken status feedback (`Directions enabled.` / `Directions disabled.`).

### Requirement 5: Haptic Invariance
- Zero changes to `core/hapticEngine.ts`, `core/hitTest.ts`, or any haptic configuration.
- Automated test in `frontend/tests/cornerCompass.test.ts` records all `vibrate` and `tone` effects across an identical multi-point trace with Directions ON vs Directions OFF. Both effect streams are identical.

### Requirement 6: Comprehensive Tests
- Acceptance tests on `frontend/public/samples/triangle.json`.
- All 18 translation keys verified across `en`, `hi`, and `gu`.
- Word count guarantee: `cornerCompass` is capped at <= 12 words under all circumstances (falling back to `"{n} edges."` if exceeded).
- Dwell timing, re-arming, and quiet window suppression verified.
