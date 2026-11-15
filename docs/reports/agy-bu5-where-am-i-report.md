# Lane A5 Report — "Where am I" Exploration and Voice Feedback

**Author:** Antigravity (Lane A5)  
**Date:** 2026-11-15  
**Spec Reference:** Fable blind user plan §2.6, §4 (I5), Requirement 26  

---

## 1. Summary of Changes

Lane A5 builds the "Where am I" capability for Ghost Touch, providing immediate contextual orientation to blind and low-vision students:
1. **Pure `whereAmI(scene, view, cursorNorm): string` function** (`frontend/src/flow/commands.ts`):
   - Computes coarse position (`getCoarsePosition`) across 9 sectors (`centre`, `top left`, `top right`, `bottom left`, `bottom right`, `top`, `bottom`, `left`, `right`).
   - Finds the nearest drawn element via `nearestElement` with no distance cap.
   - Formats the element name cleanly based on `NearestKind`:
     - `vertex`: `"corner ${label}"` (e.g. `"corner B"`)
     - `segment`: `"side ${label}"` (e.g. `"side CA"`, `"side AB"`)
     - `polyline`: `"the curve"`
     - `axis`: `"x-axis"` or `"y-axis"`
     - `bar-edge`: `"bar ${label}"` (e.g. `"bar Q2"`)
   - Computes distance word:
     - `touching` for distance $\le 14\text{ px}$ (matching line hit radius)
     - `close` for distance $\le 60\text{ px}$
     - `far` otherwise
   - Computes compass direction from finger to closest point using `directionOf` in screen pixel space:
     - 8 compass sectors: `"to your left"`, `"to your right"`, `"above you"`, `"below you"`, and diagonal compass phrases.
     - When exact position matches ($\text{dist} = 0$, $\vec{d} = \vec{0}$), direction is omitted.
   - For an empty scene or scene with no drawable elements: speaks coarse position only.
   - Seamlessly integrated with voice command handler `executeExploreCommand('where_am_i')`.

2. **Rest Dwell Timer on `'none'` Target** (`frontend/src/flow/explore.ts`, `frontend/src/screens/Explore.tsx`):
   - Utilizes the A1 keep-alive timer (`createHoldKeepAliveTimer`).
   - When the primary finger rests (moved $< 6\text{ px}$) on a `'none'` target for $1200\text{ ms}$, speaks `whereAmI` once.
   - Re-arms when the finger moves $\ge 20\text{ px}$ from the rest/spoken position or when the finger lifts.
   - Guarded against:
     - Speech that started $< 1500\text{ ms}$ ago (to prevent overlapping synthesizer playback).
     - Active Ask listening (`isAskActive`).
     - Active Guide navigation (`isGuiding`).
     - Non-`'none'` targets (vertices and lines have their own haptic and tone feedback).
   - Structured as a pure state machine (`checkWhereAmIDwell`, `updateWhereAmIDwellOnMove`, `resetWhereAmIDwellOnLift`) in `flow/explore.ts` for rigorous unit testing.

3. **"Where am I" Button in Explore Controls** (`frontend/src/screens/Explore.tsx`, `frontend/src/styles/explore.css`):
   - Added AccessibleButton into `.gt-explore__actions` in the Explore screen footer.
   - Accessible name: `t('explore.whereAmI')` ("Where am I" / "कहाँ हूँ मैं" / "હું ક્યાં છું").
   - Minimum touch target: at least $48 \times 48\text{ CSS px}$ (`min-height: 52px; min-width: var(--gt-target, 48px)` and inline style `minWidth: 48px, minHeight: 48px`).
   - On activation: speaks `whereAmI` for the last recorded finger position (defaults to `{ x: 0.5, y: 0.5 }` centre if no finger touch occurred yet).

4. **Full Localization (`en`, `hi`, `gu`)** (`frontend/src/i18n/index.ts`):
   - Added all element names, distance words, directions, and sentence templates in English, Hindi, and Gujarati.

5. **No Core Changes**:
   - Zero modifications to `core/hitTest.ts`, `core/hapticEngine.ts`, `core/compass.ts`, or any tuned haptic numbers in `tech.md`.

---

## 2. Files Touched

| File | Status | Description |
|---|---|---|
| `frontend/src/i18n/index.ts` | Modified | Added `whereAmI.*`, `explore.whereAmI`, and `commands.whereAmI` keys across English, Hindi, and Gujarati tables. |
| `frontend/src/flow/commands.ts` | Modified | Implemented `whereAmI` pure function; wired into `executeExploreCommand('where_am_i')`. |
| `frontend/src/flow/explore.ts` | Modified | Exported dwell constants (`WHERE_AM_I_DWELL_MS`, `WHERE_AM_I_REST_MAX_MOVE_PX`, etc.) and pure dwell state tracker (`checkWhereAmIDwell`, `updateWhereAmIDwellOnMove`, `resetWhereAmIDwellOnLift`). |
| `frontend/src/styles/explore.css` | Modified | Added `.gt-explore__where-am-i` styles with $\ge 48\times 48\text{ px}$ target dimensions. |
| `frontend/src/screens/Explore.tsx` | Modified | Wired dwell detector into `keepAliveTimer` onTick and pointermove; tracked `lastSpeechStartRef` and `lastFingerNormRef`; added "Where am I" AccessibleButton to footer actions. |
| `frontend/tests/screens.render.test.ts` | Modified | Added a11y touch target test and markup verification for the "Where am I" button. |
| `frontend/tests/flow.commands.test.ts` | Modified | Updated existing `executeExploreCommand('where_am_i')` tests to match new `whereAmI` output. |
| `frontend/tests/whereAmI.test.ts` | Created | Comprehensive tests for `whereAmI`, translations, dwell state transitions, and speech guards. |
| `docs/reports/agy-bu5-where-am-i-report.md` | Created | Lane A5 report. |

---

## 3. Test Coverage

The new test suite `frontend/tests/whereAmI.test.ts` covers:
1. **30 px left of side CA (`triangle.json`)**:
   - Cursor: `{ x: 0.15, y: 0.5 }` (30 px left on 300x300 viewport).
   - Result contains: `"left"`, `"side CA"`, `"close"`, `"to your right"`.
2. **On side AB (`triangle.json`)**:
   - Cursor: midpoint `{ x: 0.475, y: 0.55 }` (distance 0 px).
   - Result contains: `"side AB"`, `"touching"`.
3. **On corner B (`triangle.json`)**:
   - Cursor: `{ x: 0.7, y: 0.85 }` (distance 0 px).
   - Result contains: `"bottom right"`, `"corner B"`, `"touching"`.
4. **Far corner of the canvas**:
   - Cursor: `{ x: 0.95, y: 0.05 }` (top-right corner).
   - Result contains: `"top right"`, `"far"`.
5. **On the sine sample (`sine.json`)**:
   - Cursor: `{ x: 0.1, y: 0.5 }` on curve point.
   - Result contains: `"the curve"`, `"touching"`.
6. **On the bar sample (`barchart.json`)**:
   - Cursor: `{ x: 0.395, y: 0.44 }` on top edge of Q2.
   - Result contains: `"bar Q2"`, `"touching"`.
7. **Empty scene**:
   - Scene with no elements returns coarse position only (`"centre"`, `"top left"`, etc.).
8. **Multi-language support (`en`, `hi`, `gu`)**:
   - Verified that all output phrases localize in Hindi and Gujarati.
   - Table check confirms 100% presence of all new keys without missing or empty strings.
9. **Dwell timing & speech guards**:
   - Resting $< 6\text{ px}$ for $1200\text{ ms}$ on `'none'` target fires `whereAmI` once.
   - Consecutive ticks while resting do not repeat speech (fires once per rest).
   - Moving $< 20\text{ px}$ does not re-arm.
   - Moving $\ge 20\text{ px}$ re-arms the detector.
   - Lifting the finger re-arms the detector.
   - Moving $\ge 6\text{ px}$ resets the rest timer.
   - Suppressed while speech started $< 1500\text{ ms}$ ago.
   - Suppressed while Ask is listening (`isAskActive = true`).
   - Suppressed while Guide is guiding (`isGuiding = true`).
   - Suppressed on non-`'none'` targets (vertices and lines).
10. **Touch target accessibility**:
   - `screens.render.test.ts` verifies `.gt-explore__where-am-i` touch target is $\ge 48\text{ px}$ tall and wide.
