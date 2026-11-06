# Lane g2-guide-ui Report (agy)

**Date:** 2026-11-06  
**Tool:** Antigravity (agy, reviewed by Claude)  
**Status:** Completed  
**Branch:** `agy/g2-guide-ui` (or `gt-lane-g2-guide-ui`)

---

## 1. Summary

Implemented "Guide my finger" in Explore behind feature flags per `docs/briefs/agy-g2-guide-ui.md`, `docs/briefs/guide-share-contract.md`, and `AGENTS.md`.

### Implemented Capabilities
1. **Feature Flags & Settings**:
   - `frontend/src/config/features.ts`: Reused and extended existing module with `STORAGE_KEY_GUIDE`, `getStoredGuideSetting()`, `setStoredGuideSetting(enabled)` (with in-memory fallback for node tests), `isGuideEnvOn()`, `isGuideActive(settingOn)`.
   - Feature is active **only** when `VITE_FEATURE_GUIDE === '1'` AND the user setting is enabled.
2. **Guide Flow Glue**:
   - `frontend/src/flow/guide.ts`: Created `GuideController` connecting pointer moves, TalkBack cursor updates, and 250ms interval ticks to pure `guideStep` state machine.
   - 20 s timeout automatically ends guidance and speaks "Guide stopped".
   - Maps `GuideEffect` to haptic vibration pulses, audio guide tones, and speech hints.
3. **Audio Driver & Guide Tone**:
   - `frontend/src/drivers/audio.ts`: Added `setGuideTone(hz, pan)` using `StereoPannerNode` where available (`pan` clamped to `[-1, 1]`, frequency clamped to `[100, 2000]`), gracefully falling back to mono (no pan) if `StereoPanner` is unsupported.
   - Suppresses existing theremin tone during guidance.
   - Ducks and restores guide tone around earcons (`playEarcon`).
   - Kept all existing earcons, theremin parameters, and tuned values completely unchanged.
4. **Effects Wiring**:
   - `frontend/src/drivers/index.ts`: Added `runGuideEffects(effects, drivers, lang)` mapping:
     - `pulse` -> `drivers.haptics.vibrate(ms)`
     - `tone` -> `drivers.audio.setGuideTone(hz, pan)`
     - `toneOff` -> `drivers.audio.setGuideTone(null)`
     - `speak` -> `drivers.speech.speak(t(key), lang)`
     - `arrive` -> corner vibration pattern `[50, 90, 50]`, earcon `'success'`, and spoken arrival message.
     - `stopped` -> `drivers.audio.setGuideTone(null)`.
5. **Explore Screen Integration**:
   - `frontend/src/screens/Explore.tsx`:
     - TalkBack relative cursor norm feeds into `GuideController.move`.
     - Visual indicator on canvas draws target indicator with subtle pulse/reticle when guiding.
     - Root container gets `.gt-explore--guiding`.
     - Back button interception: stops guidance first (speaking "Guide stopped"), without navigating away from Explore. Subsequent Back exits Explore.
     - Entry: Ask answers offering a target display an accessible "Guide me" button (`data-testid="explore-guide-me"`, >= 48×48 px) and speak the offer.
     - Never auto-starts without explicit user action.
6. **Voice Commands (en, hi, gu)**:
   - `frontend/src/flow/commands.ts`:
     - "take me to <label>", "find <label>", "guide to <label>"
     - "stop"
     - "next corner" (initiates guidance to the next vertex when guide is active)
     - Supported in English, Hindi, and Gujarati.
     - Falls through to existing unrecognized command behavior when guide feature is inactive.
7. **Ask Flow**:
   - `frontend/src/flow/ask.ts`: Added optional `target?: GuideTarget` to `AskOutcome` and propagated `response.target`.
8. **LabSettings Modal**:
   - `frontend/src/components/LabSettings.tsx`: Guide switch toggle shown only when `isGuideEnvOn()`, toggles stored setting, >= 48×48 px target, speaks state changes in en/hi/gu.
9. **Internationalization & Documentation**:
   - `frontend/src/i18n/index.ts`: Added all 20 guide translation keys across `en`, `hi`, `gu`.
   - `docs/user-test/translation-review.md` & `.csv`: Appended all 20 translation keys.
10. **Type Definitions**:
    - `frontend/src/vite-env.d.ts`: Added `VITE_FEATURE_GUIDE` and `VITE_FEATURE_SHARE`.

---

## 2. Commands Run & Real Results

### TypeScript Verification
```
npm --prefix frontend exec -- tsc -p frontend --noEmit
Exit code: 0
Output: Clean (0 errors)
```

### Frontend Vitest Suite
```
npm --prefix frontend test
Exit code: 0
Output:
 Test Files  95 passed (95)
      Tests  1330 passed (1330)
   Duration  1.46s
```
All existing tests and 59 new acceptance tests pass:
- `frontend/tests/guide.ui.commands.test.ts`: 20 tests (voice parsing en/hi/gu, flag off fall-through, flag on target resolution)
- `frontend/tests/guide.ui.audio.test.ts`: 11 tests (StereoPanner, mono fallback, mandatory spoken hint fallback, earcon ducking)
- `frontend/tests/guide.ui.flow.test.ts`: 14 tests (GuideController, arrival once, cancel paths: voice stop, back button, 20s timeout)
- `frontend/tests/guide.ui.explore.test.tsx`: 14 tests (Explore & LabSettings markup, flag on/off, cancel paths, i18n completeness)

### Frontend Production Build
```
npm --prefix frontend run build
Exit code: 0
Output:
✓ 83 modules transformed.
dist/assets/index-DHu7jxwx.css   64.31 kB │ gzip:  10.08 kB
dist/assets/index-BnTdxUbB.js   392.69 kB │ gzip: 114.92 kB
✓ built in 162ms
```

### Backend Verification
```
backend/.venv/Scripts/python -m pytest backend
Exit code: 0
Output: 454 passed, 1 skipped in 32.41s

backend/.venv/Scripts/python -m ruff check backend
Exit code: 0
Output: All checks passed!

backend/.venv/Scripts/python -m ruff format --check backend
Exit code: 0
Output: 60 files already formatted
```

---

## 3. Bundle Size Delta

| Asset | Baseline | Post-Implementation | Delta |
|---|---|---|---|
| JavaScript (`dist/assets/index-*.js`) | 373.02 kB (gzip: 109.79 kB) | 392.69 kB (gzip: 114.92 kB) | +19.67 kB (+5.13 kB gzip) |
| CSS (`dist/assets/index-*.css`) | 64.31 kB (gzip: 10.08 kB) | 64.31 kB (gzip: 10.08 kB) | 0.00 kB (0.00 kB gzip) |

---

## 4. Acceptance Criteria Checklist

- [x] Guide pulse uses haptic driver's `vibrate(ms)` from guide effects.
- [x] Theremin tone suppressed while guiding and replaced by guide tone (`pitchFor`, `panFor`).
- [x] Guide tone with `StereoPanner`, falling back to no pan if unsupported without altering existing audio parameters.
- [x] **Spoken hint fallback is mandatory**: Tested and verified that hints are spoken via speech driver even when `StereoPanner` / `setGuideTone` is absent.
- [x] Cancel paths: voice "stop", Back button (stops guide first without leaving Explore), 20s timeout => speak "Guide stopped". All 3 tested.
- [x] TalkBack relative cursor support (cursor norm coordinates feed into finger position).
- [x] Entry: (a) Ask answer `target` => "Guide me" button (48×48 px, accessible name) & spoken offer; (b) voice commands; (c) never auto-start.
- [x] Feature flags: guide active only when `VITE_FEATURE_GUIDE === '1'` AND user setting is on; otherwise no button, voice commands fall through to existing behavior, UI unchanged (both tested).
- [x] All strings through `t()` in `en`, `hi`, `gu`.
- [x] Touch targets at least 48×48 CSS px.
- [x] Zero edits to `frontend/src/core/**` and no new npm packages installed.

---

## 5. Files Touched

### Created
- `docs/reports/agy-g2-guide-ui-report.md`
- `frontend/src/flow/guide.ts`
- `frontend/tests/guide.ui.commands.test.ts`
- `frontend/tests/guide.ui.audio.test.ts`
- `frontend/tests/guide.ui.flow.test.ts`
- `frontend/tests/guide.ui.explore.test.tsx`

### Modified
- `frontend/src/config/features.ts`
- `frontend/src/drivers/audio.ts`
- `frontend/src/drivers/index.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/src/flow/commands.ts`
- `frontend/src/flow/ask.ts`
- `frontend/src/components/LabSettings.tsx`
- `frontend/src/i18n/index.ts`
- `frontend/src/vite-env.d.ts`
- `docs/user-test/translation-review.md`
- `docs/user-test/translation-review.csv`
- `docs/BUILD_LOG.md`
