# Lane G Report: Accessibility Pass and Halloween Presentation Layer (T14, Requirement 12)

**Agent:** Antigravity (builder)  
**Lane:** Lane G (`agy/a11y`)  
**Task:** T14 (Requirement 12 — Accessibility and Theme)  
**Reviewer:** Claude Code  
**Date:** 2026-11-04  

---

## 1. Executive Summary

This run executed the full scope of `docs/briefs/agy-a11y.md` for Lane G, establishing a verified WCAG AAA contrast baseline, enforcing 48×48 CSS px touch targets across all interactive selectors, hardening focus rings and reduced-motion suppression, crafting an original-art Frankenstein phone mascot, and producing an honest accessibility audit for the owner.

Zero Kiro-owned files were touched. Zero tuned haptic values were modified. Zero new dependencies were introduced.

---

## 2. Definition of Done Proof (Real Counts)

### 2.1 TypeScript Type Check
```bash
$ npm --prefix frontend exec -- tsc -p frontend --noEmit
# Exit code: 0 (clean, 0 errors across entire frontend and test suite)
```

### 2.2 Frontend Test Suite
```bash
$ npm --prefix frontend test
# Vitest v2.1.9
# Test Files: 34 passed (34)
# Tests:      380 passed (380) — up from 313 passed (+67 new tests)
# Duration:   1.21s
```
New test files added:
- `frontend/tests/a11y.contrast.test.ts` (25 tests)
- `frontend/tests/a11y.targets.test.ts` (21 tests)
- `frontend/tests/a11y.motion.test.ts` (9 tests)
- `frontend/tests/mascot.test.ts` (12 tests)

### 2.3 Frontend Production Build
```bash
$ npm --prefix frontend run build
# vite v6.4.5 building for production...
# dist/registerSW.js                           0.13 kB
# dist/manifest.webmanifest                    0.49 kB
# dist/index.html                              0.71 kB │ gzip:   0.41 kB
# dist/assets/pdf.worker.min-CjEcRF4W.mjs  1,264.34 kB
# dist/assets/index-DAc84RP3.css              18.79 kB │ gzip:   4.04 kB
# dist/assets/index-DOB9NJ1L.js              227.61 kB │ gzip:  70.88 kB
# dist/assets/pdf-BtCWNl9F.js                483.74 kB │ gzip: 144.80 kB
# ✓ built in 1.26s
# PWA v0.21.2: 14 precache entries generated (273.97 KiB)
```

### 2.4 Backend Baseline Verification
```bash
$ backend/.venv/Scripts/python -m pytest backend
# 336 passed, 1 skipped, 1 warning in 34.42s

$ backend/.venv/Scripts/python -m ruff check backend
# All checks passed!

$ backend/.venv/Scripts/python -m ruff format --check backend
# 51 files already formatted
```

---

## 3. What Was Built

### Task 1: WCAG AAA Colour Contrast
- **Helper Test (`frontend/tests/a11y.contrast.test.ts` — 25 tests):**
  - Parses colour tokens from `frontend/src/styles/tokens.css`.
  - Implements the exact W3C WCAG 2.1 relative luminance and contrast formula without external dependencies.
  - Tests all 18 actually used body text / background pairs, asserting WCAG AAA compliance (>= 7:1).
  - Tests large text and UI component pairs, asserting >= 4.5:1.
  - Asserts that `--gt-green`, `--gt-line`, and `--gt-focus` remain strictly `#39ff88`.
- **Token Calibration:**
  - In `tokens.css` and `global.css`, calibrated `--gt-text-muted` from `#9fb3a8` (which achieved only 6.78:1 on active surface `#242436`) to `#a8c5b5`.
  - Result: `--gt-text-muted` achieves **10.7:1** on default dark background (`#0b0b10`) and **8.1:1** on active surface (`#242436`), exceeding 7:1 everywhere while maintaining the muted creature-theme slate hue.

### Task 2: Minimum Touch Targets (Requirement 12.1)
- **Scanner Test (`frontend/tests/a11y.targets.test.ts` — 21 tests):**
  - Parses `frontend/src/styles/global.css` (stripping CSS comments to prevent false positives).
  - Validates that every interactive class (`.gt-control`, `.gt-start-surface`, `.gt-capture__button`, `.gt-capture__sample-btn`, `.gt-explore__ask`, `.gt-explore__back`, `.gt-explore__send`, `.gt-explore__ask-input`, `.gt-lang-selector__btn`, `.gt-rate-selector__btn`) declares `min-width` and `min-height` >= 48px.
- **CSS Hardening (`frontend/src/styles/global.css`):**
  - Added explicit `min-width: var(--gt-target)` and `min-height: var(--gt-target)` to `.gt-start-surface`, `.gt-capture__button`, `.gt-capture__sample-btn`, `.gt-explore__ask`, `.gt-explore__back`, and `.gt-explore__ask-input`.

### Task 3: Visible Focus Rings & Reduced Motion
- **Verification Test (`frontend/tests/a11y.motion.test.ts` — 9 tests):**
  - Verifies visible focus rings on all controls: `.gt-control:focus-visible`, `.gt-start-surface:focus-visible`, `.gt-explore__canvas:focus-visible`, `.gt-explore__ask-input:focus-visible` with outline >= 3px solid `--gt-focus` (`#39ff88`) and dual offset rings.
  - Verifies Windows High Contrast mode (`forced-colors: active`) system outline (`3px solid Highlight !important`) and button borders (`2px solid ButtonText !important`).
  - Verifies `@media (prefers-reduced-motion: reduce)` block zeroes animation and transition durations (`0.001ms !important`), pauses animations (`animation-play-state: paused !important`), explicitly strips animations from `.gt-start__pulse-dot`, `.gt-capture__status-indicator`, `.gt-capture__progress-bar`, and `.gt-mascot`, and strips SVG filter/transform effects.

### Task 4: Original Frankenstein Phone Mascot
- **Component (`frontend/src/components/Mascot.tsx`):**
  - Original art SVG representing a friendly Frankenstein phone stitched from three organs:
    1. **Nerves:** Tactile buzzer module with internal copper coil windings and radiated haptic vibration arcs.
    2. **Eyes:** Cybernetic camera lens sensor with aperture rings, glowing pupil, and glint highlight.
    3. **Voice:** Corner-mounted theremin antenna rod with tip sphere and radiated audio pitch waves.
    4. **Stitched Charm:** Friendly stitched smile seam and chassis bolts.
  - Strictly decorative: `aria-hidden="true"`, `focusable="false"`, zero text tags (`<text>`, `<tspan>`), zero readable text content.
  - Rendered size is ~2.7 KB (tested <= 8192 bytes budget).
  - Standalone public SVG asset created at `frontend/public/mascot/frankenstein-phone.svg` (2.5 KB).
- **Start Screen Integration (`frontend/src/screens/Start.tsx`):**
  - `<Mascot />` replaces the prior generic placeholder inline SVG.
  - Retains the single full-screen `<button>` contract for TalkBack double-tap activation (`expect(html.match(/<button/g)).toHaveLength(1)`).
- **Mascot Test (`frontend/tests/mascot.test.ts` — 12 tests):**
  - Tests SVG structure, `aria-hidden="true"`, absence of text nodes, byte size <= 8 KB, presence of buzzer/eye/theremin/stitches, and verified that mascot is used ONLY on `Start.tsx` and never in `Capture.tsx` or `Explore.tsx`.

### Task 5: Comprehensive Accessibility Audit (`docs/a11y-audit.md`)
- Detailed checklist of automated test proofs across contrast, touch targets, focus, motion, and screen reader output.
- Honest checklist of items requiring physical Android device testing with TalkBack for the owner (ERM motor spin-up latency, TalkBack pass-through gesture timing, regional TTS voice data for Hindi/Gujarati, audio ducking, two-finger gesture digitizer limits).
- Full issue register for files outside Lane G's permitted edit scope.

---

## 4. Needs from Kiro (Issues Found in Files Outside Lane Scope)

Per AGENTS.md Rule 1, these findings are registered for Kiro's return or Claude Code review:

1. **`frontend/src/screens/Explore.tsx` (lines 691–703) — Canvas lacks keyboard arrow navigation:**
   - `<canvas>` has `tabIndex={0}` and an accessible label (`role="img" aria-label="..."`), but does not attach `onKeyDown` handlers for arrow keys. A sighted or blind keyboard user who navigates with a Bluetooth keyboard or laptop cannot move the explore cursor across the diagram.
   - *Recommendation for Kiro:* Add an `onKeyDown` handler to the canvas that shifts `pendingCursor` by ±10px on ArrowLeft/Right/Up/Down and calls `step`.
2. **`frontend/src/screens/Capture.tsx` (lines 170–183) — Unlabelled hidden file inputs:**
   - `<input ref={photoInput} type="file" ... hidden />` and `<input ref={fileInput} type="file" ... hidden />` lack `aria-label`. If `hidden` is temporarily toggled by dev tools or assistive extensions, automated scanners flag unnamed inputs.
   - *Recommendation for Kiro:* Add `aria-label={t('capture.takePhoto')}` and `aria-label={t('capture.chooseImage')}`.
3. **`frontend/src/components/LanguageSelector.tsx` (lines 53–57) — Landmark role conflict:**
   - `<nav role="group" aria-label="...">` overrides the HTML5 `<nav>` element's native `navigation` landmark role in the accessibility tree.
   - *Recommendation for Kiro:* Remove `role="group"` from the `<nav>` tag or switch to a `<div>`.
4. **`frontend/src/flow/explore.ts` (lines 30–31, 140–165) — Touch-only exit shortcut:**
   - Two-finger swipe down has no keyboard equivalent in the gesture recognizer. (Mitigated by the labelled 52px Back button in the Explore footer).

---

## 5. Files Touched

### Modified Existing Files
- `frontend/src/styles/tokens.css` (calibrated `--gt-text-muted` to `#a8c5b5`)
- `frontend/src/styles/global.css` (tokens sync, explicit min-width/min-height, focus rings, reduced motion)
- `frontend/src/screens/Start.tsx` (integrated Mascot component inside single start button)
- `docs/BUILD_LOG.md` (added Lane G entry)

### New Files Created
- `frontend/src/components/Mascot.tsx` (original Frankenstein phone creature mascot component)
- `frontend/public/mascot/frankenstein-phone.svg` (standalone public SVG asset, <= 8 KB)
- `frontend/tests/a11y.contrast.test.ts` (25 contrast tests)
- `frontend/tests/a11y.targets.test.ts` (21 touch target tests)
- `frontend/tests/a11y.motion.test.ts` (9 focus and motion tests)
- `frontend/tests/mascot.test.ts` (12 creature mascot tests)
- `docs/a11y-audit.md` (comprehensive accessibility audit & owner checklist)
- `docs/reports/agy-a11y-report.md` (this report)

---

## 6. Self-Audit Against Rules
- **No git changes:** No commits, pushes, branches, or PRs made.
- **No Kiro-owned files touched:** Zero files in `core/**`, `*.prop.test.ts`, `.kiro/**`, `App.tsx`, `Explore.tsx`, `Capture.tsx`, `i18n/index.ts`, `flow/explore.ts` were edited.
- **No haptic value changes:** The haptic values in `tech.md` remain untouched.
- **No secrets touched:** No `.env` files opened or read.
- **No new dependencies:** Uses standard Vite, React, and Vitest.
- **Accessibility:** 48×48 px targets enforced, visible focus rings, non-visual-first architecture preserved.
