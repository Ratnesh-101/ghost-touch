# Report: Lane f1-phone-fixes

- **Status:** DONE
- **Tool:** Antigravity (agy), reviewed by Claude
- **Lane:** f1-phone-fixes
- **Date:** 2026-11-12

## Purpose
Port PR #35 (phone fixes from OnePlus Nord CE6 and Samsung Galaxy S24+ testing) onto current main
without breaking the Requirement 25 canvas fix.

## Scope & Implementation Details

### 1. Fix A: Corner vibration missing on some phones (`drivers/haptics.ts`)
- Added `MIN_FALLBACK_PULSE_MS = 100` constant.
- Added pure helper `fallbackPulse(pattern: readonly number[]): number`, which computes the sum of
  active (even index) durations with a minimum floor of 100 ms.
- In `WebHapticDriver.vibrate`, implemented a single fallback retry: if `tryVibrate(host, pattern)`
  returns false or throws, and `pattern` is an array, it retries exactly once with
  `fallbackPulse(pattern)`.
- A working host is called exactly once with the original unchanged pattern. Single number durations
  (e.g. 80 ms line buzz) are never retried.
- Kept `FallbackHapticDriver`, `patternToBuzzes`, and `BuzzSink` code intact and untouched. Tuned
  haptic values in `core/hapticEngine.ts` remain untouched.

### 2. Fix B: TalkBack exploration overlay (`screens/Explore.tsx`, `flow/a11yFeatures.ts`)
- Created pure helper `frontend/src/flow/a11yFeatures.ts` (zero React, zero browser APIs) defining
  `buildA11yFeatures(scene, maxFeatures)` and exporting `MAX_A11Y_FEATURES = 60`.
- Extracted points, segments, bars, curves, and axes as focusable accessibility features with
  localized names via `tf()` and bounding box geometry.
- In `frontend/src/screens/Explore.tsx`, rendered `.gt-explore__a11y-tree` inside the canvas container.
- Conformed to strict Requirement 25 isolation constraints:
  - `.gt-explore__a11y-tree` is `position: absolute; inset: 0; pointer-events: none; overflow: hidden`.
  - `.gt-explore__a11y-item` buttons are `position: absolute; pointer-events: none;`.
  - The overlay does not participate in container layout, has no height or min-height affecting flow,
    does not touch canvas sizing logic or `touch-action`, and leaves status card and debug line fixed.
  - Focusing an overlay item invokes `step(initialState(), ...)` and `runEffects()`, delivering the
    same corner vibration, line buzz, bar pitch/label, and curve tone that direct touch would trigger.
    Direct touch with TalkBack off is completely unhindered (`pointer-events: none`).
  - Re-exported `buildA11yFeatures`, `MAX_A11Y_FEATURES`, and `type A11yFeature` from `screens/Explore.tsx`.

### 3. Fix C: Vibration help card (`components/LabSettings.tsx`, `styles/settings.css`, i18n)
- Added accessible guidance card in `components/LabSettings.tsx` detailing OS vibration/haptic paths:
  - Samsung One UI (Sounds and vibration -> Vibration intensity -> Touch feedback; Power Saving off)
  - Stock Android / Pixel (Sound & vibration -> Vibration & haptics -> Touch feedback)
  - OnePlus OxygenOS (Sound & vibration -> Haptics -> vibration on)
  - Xiaomi HyperOS (Sound & vibration -> Haptic feedback & Vibrate on touch)
- Added lab theme styling in `frontend/src/styles/settings.css` using `--gt-copper`, `--gt-green`,
  and `--gt-card-bg`.
- Added localized strings across `en`, `hi`, and `gu` in `frontend/src/i18n/index.ts` for all
  `lab.settings.vibrationHelp*` and `a11y.*` keys.
- Appended machine-translated entries marked for native review to
  `docs/user-test/translation-review.csv` and `docs/user-test/translation-review.md`.

## Deferred List
None. All tasks and requirements from `docs/briefs/agy-f1-phone-fixes.md` are completed.

## Pass 2: Test Suite Fixes (Supervisor Gate Follow-Up)

- **Status:** DONE
- **Context:** Production code was verified correct by the supervisor gate (`tsc 0 errors`,
  `vite build` ok). Three tests failed in Vitest due to test-file issues:
  1. `tests/explore.talkback.test.tsx` (2 tests: pointer interception and absolute positioning):
     Threw `TypeError: The URL must be of scheme file` due to `new URL(..., import.meta.url)` in
     Vitest's jsdom environment.
  2. `tests/labSettings.vibrationHelp.test.tsx` (1 test: instruction strings in English): Failed
     due to comparing rendered HTML with decimal HTML-escaped apostrophes (`&#27;` vs jsdom DOM text
     representation of `phone's`).

### Actions Taken in Pass 2
1. **`frontend/tests/explore.talkback.test.tsx`:**
   - Eliminated `new URL(..., import.meta.url)` file URL construction.
   - Introduced safe stylesheet resolution (`readStyleFile`) using `node:path` + `node:fs` relative
     to `__dirname` with root/frontend fallbacks.
   - Reused `parseCssRules` and `findRule` helpers modeled after
     `frontend/tests/explore.layout.test.tsx` to verify `pointer-events: none`, `position: absolute`,
     and `inset: 0` alongside regex checks without weakening any assertion.
2. **`frontend/tests/labSettings.vibrationHelp.test.tsx`:**
   - Replaced `new URL(..., import.meta.url)` with `readStyleFile` for loading `settings.css`.
   - Enabled `@vitest-environment jsdom` and asserted on text using `container.textContent` rather
     than brittle `innerHTML` entity escaping (`escape()` with `&#27;`).
   - Compared rendered text directly against `t(key)` from the i18n table for English, Hindi, and
     Gujarati so strings cannot drift from translations.
   - Preserved all assertions: section accessibility (`aria-labelledby`), heading role/content,
     intro note (`aria-describedby`), `<li>` list counts, unique element IDs, settings path text
     matching, and lab theme token styles.

## Tests & Proof of Correctness
1. `frontend/tests/drivers.haptics.test.ts`:
   - Proves a working host is called exactly once with the unchanged pattern.
   - Proves a host rejecting an array pattern retries exactly once with `fallbackPulse`.
   - Proves `fallbackPulse` never returns less than 100 ms and equals `max(sum of ON entries, 100)`.
2. `frontend/tests/haptic.corner.regression.test.ts`:
   - Proves sample triangle corners trigger `[50, 90, 50]` corner pattern and speak point id.
   - Proves sample triangle edges trigger 80 ms line buzz.
   - Proves array fallback mechanics and edge cases.
3. `frontend/tests/labSettings.vibrationHelp.test.tsx`:
   - Proves rendering of all vibration instruction strings in English, Hindi, and Gujarati.
   - Proves mentions of device setting paths across Samsung, Pixel, OnePlus, Xiaomi.
   - Proves accessible heading (`aria-labelledby`), description (`aria-describedby`), unique element
     IDs, and theme styling.
4. `frontend/tests/explore.talkback.test.tsx`:
   - Proves accessible tree exposes corners, sides, bars, curves, and axes with proper ARIA attributes.
   - Proves capping at `MAX_A11Y_FEATURES` (60) or custom cap limit.
   - Proves focus and blur trigger respective haptic patterns, theremin tones, bar pitch, and speech.
   - Proves `pointer-events: none` and `position: absolute` ensure direct touch passes to canvas.
5. `frontend/tests/explore.layout.test.tsx`:
   - All Requirement 25 layout invariants remain verified.
   - Verified that `.gt-explore__a11y-tree` is `position: absolute` and `pointer-events: none` in
     both `global.css` and `explore.css`.

## Files Touched
- `frontend/src/drivers/haptics.ts`
- `frontend/src/flow/a11yFeatures.ts` (new)
- `frontend/src/screens/Explore.tsx`
- `frontend/src/components/LabSettings.tsx`
- `frontend/src/styles/explore.css`
- `frontend/src/styles/global.css`
- `frontend/src/styles/settings.css`
- `frontend/src/i18n/index.ts`
- `frontend/tests/drivers.haptics.test.ts`
- `frontend/tests/explore.layout.test.tsx`
- `frontend/tests/explore.talkback.test.tsx` (new)
- `frontend/tests/haptic.corner.regression.test.ts` (new)
- `frontend/tests/labSettings.vibrationHelp.test.tsx` (new)
- `docs/user-test/translation-review.csv`
- `docs/user-test/translation-review.md`
- `docs/BUILD_LOG.md`
- `docs/reports/agy-f1-phone-fixes-report.md`
