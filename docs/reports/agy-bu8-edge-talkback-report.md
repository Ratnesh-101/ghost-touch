# Antigravity Lane Report: bu8b (Page Edge Cue)

**Lane:** `bu8b`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-16  
**Status:** Complete & verified  

---

## 1. Summary of Changes

This lane implemented the pure page edge cue tracker (`checkPageEdge`), its integration into the Explore screen move pipeline and announcements, short earcon feedback, and localized string tables in English (`en`), Hindi (`hi`), and Gujarati (`gu`).

Per the brief instructions, `flow/a11yFeatures.ts` was deliberately left untouched (handled by another lane for TalkBack feature labels).

1. **Pure Tracker (`frontend/src/flow/explore.ts`):**
   - Added `checkPageEdge(normPos, state, viewScale)` pure tracker function.
   - Detects when the finger goes outside the unit square $[0, 1]$ on any axis (`normPos.x < 0`, `normPos.x > 1`, `normPos.y < 0`, `normPos.y > 1`).
   - Determines the dominant exited side (`'top'`, `'bottom'`, `'left'`, `'right'`) and returns localized spoken text (`t('edge.' + side)`).
   - Re-arms only after the finger returns inside by at least 20 px worth of normalized distance (`PAGE_EDGE_REARM_PX = 20`, normalized margin $= 20 / \text{viewScale}$).
   - Added `seedPageEdgeState(normPos, viewScale)` for hold initialization: landing outside speaks once and disarms immediately; landing inside remains armed without speech.
   - Integrated `pageEdge: PageEdgeResult` into `MovePipelineResult` and `processPointerMove`.
   - Exported `checkPageEdge`, `initialPageEdgeState`, `seedPageEdgeState`, `PAGE_EDGE_REARM_PX`, and types `PageEdgeSide`, `PageEdgeState`, `PageEdgeResult`.

2. **Explore Screen Wiring (`frontend/src/screens/Explore.tsx`):**
   - Tracked `pageEdgeState = useRef<PageEdgeState>(initialPageEdgeState())`.
   - Passed `pageEdgeState.current` into `processPointerMove` across pointerdown, pointermove, keep-alive ticks, and pointer promotion.
   - In `applyMoveResult`:
     - Updated `pageEdgeState.current = moveResult.pageEdge.nextState`.
     - When `moveResult.pageEdge.spoken` is present:
       - Plays the short existing earcon: `drivers.audio.playEarcon?.('back')`.
       - Joins edge speech with axis crossings, centre announcements, and feature speech into one single utterance via `mergeAnnouncements`.
       - Produces **zero vibration** for edge exits.
       - Updates `lastSpokenRef.current`, `lastSpeechStartRef.current`, and `statusMessage`.
   - On new hold in `handlePointerDown`, re-seeds `pageEdgeState.current = initialPageEdgeState()`, ensuring that landing outside speaks once.
   - On lift, window blur, visibility change, and exit, resets `pageEdgeState.current = initialPageEdgeState()`.

3. **String Parity (`frontend/src/i18n/index.ts`):**
   - Added `edge.top`, `edge.bottom`, `edge.left`, `edge.right` across English, Hindi, and Gujarati tables with strict key parity and non-empty values.

4. **Tests (`frontend/tests/`):**
   - Created `frontend/tests/flow.pageEdge.test.ts` (9 tests) testing:
     - Edge cue fires once per exit on all four sides and not again until re-armed.
     - 20 px normalized distance re-arm threshold (movement inside $< 20\text{ px}$ does not re-arm; $\ge 20\text{ px}$ re-arms).
     - Corner exit side disambiguation by maximum overshoot.
     - Seeding on pointerdown (`seedPageEdgeState`): landing outside speaks once; landing inside is silent and armed.
     - Robustness against non-finite (NaN / Infinity) coordinates.
     - Exact localized copy across `en`, `hi`, and `gu`.
     - `PAGE_EDGE_REARM_PX === 20`.
     - Integration in `processPointerMove` pipeline and absence of vibration.
     - Single utterance merging via `mergeAnnouncements`.
   - Added suite in `frontend/tests/flow.explore.test.ts` testing `checkPageEdge` on all four sides.

---

## 2. Localization Table (en, hi, gu)

| Key | English (`en`) | Hindi (`hi`, machine-translated) | Gujarati (`gu`, machine-translated) |
|---|---|---|---|
| `edge.top` | Edge, top | किनारा, ऊपर | કિનારો, ઉપર |
| `edge.bottom` | Edge, bottom | किनारा, नीचे | કિનારો, નીચે |
| `edge.left` | Edge, left | किनारा, बाएँ | કિનારો, ડાબે |
| `edge.right` | Edge, right | किनारा, दाएँ | કિનારો, જમણે |

---

## 3. Files Touched

- `frontend/src/i18n/index.ts`
- `frontend/src/flow/explore.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/tests/flow.pageEdge.test.ts`
- `frontend/tests/flow.explore.test.ts`
- `docs/reports/agy-bu8-edge-talkback-report.md`

*(Note: `frontend/src/flow/a11yFeatures.ts` was not modified as instructed).*

---

## 4. Suggested Commit Groups

### Commit 1: `feat(flow): add page edge cue pure tracker and i18n keys for en, hi, gu`
- `frontend/src/i18n/index.ts`
- `frontend/src/flow/explore.ts`
- `frontend/tests/flow.pageEdge.test.ts`
- `frontend/tests/flow.explore.test.ts`

### Commit 2: `feat(explore): wire page edge cue into move pipeline with earcon and unified announcement`
- `frontend/src/screens/Explore.tsx`

### Commit 3: `docs(bu8b): add page edge cue lane report`
- `docs/reports/agy-bu8-edge-talkback-report.md`
