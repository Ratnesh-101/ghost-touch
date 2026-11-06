# Architectural and Safety Review: Frankenstein Lab Redesign

**Reviewer:** Antigravity (agy)  
**Role:** Builder conducting independent architectural and safety review at owner request (awaiting Kiro review)  
**Date:** 2026-11-06  
**Verdict:** SHIP  

---

## 1. Executive Summary

Antigravity (agy) conducted an architectural and safety review of the Frankenstein Laboratory UI redesign against `.kiro/steering/tech.md`, `.kiro/steering/product.md`, and `.kiro/specs/ghost-touch/`. 

The review audited four core guarantees:
1. **Tuned haptic vocabulary integrity:** 100% untouched and preserved.
2. **TalkBack relative-cursor behavior (Requirement 13):** Fully operational in `Explore.tsx` and `drivers/navigation.ts`.
3. **Pure-core architecture rule (`tech.md` Rule 1):** Zero browser API or DOM leakage in `frontend/src/core/`.
4. **Accessibility contracts (Requirement 12 & 14):** 48×48 px touch targets, WCAG AAA text contrast, `aria-hidden="true"` decorative primitives, self-hosted Atkinson Hyperlegible fonts, and complete reduced-motion suppression.

All core safety contracts are satisfied. Minor token hygiene findings (unmanaged bare hex values in legacy stylesheets) were documented on an allow-list in property test `P20` (`frontend/tests/labTheme.prop.test.ts`).

---

## 2. Detailed Findings

| # | Severity | File:line | Problem | Fix |
|---|---|---|---|---|
| 1 | Low | `frontend/src/styles/global.css:747, 1105, 1152` | Unmanaged bare hex literals (`#183324`, `#12241b`) used in button gradient backgrounds rather than design tokens. | Replace with `var(--gt-surface-active)` / `var(--gt-surface)` token gradient. Registered in P20 allow-list. |
| 2 | Low | `frontend/src/styles/global.css:1030` | Canvas container border uses legacy bare hex `#20202e` rather than `var(--gt-border-subtle)` or `var(--gt-border)`. | Replace with `var(--gt-border-subtle)`. Registered in P20 allow-list. |
| 3 | Low | `frontend/src/styles/global.css:1083` | Fallback text ask input background uses legacy bare hex `#050508` rather than `var(--gt-bg)`. | Replace with `var(--gt-bg)`. Registered in P20 allow-list. |
| 4 | Low | `frontend/src/styles/global.css:1281` | Language selector active text color uses raw `#ffffff` instead of `var(--gt-text-primary)`. | Replace with `var(--gt-text-primary)`. Registered in P20 allow-list. |
| 5 | Info | `frontend/src/screens/Explore.tsx:873` | Canvas element carries `aria-label={canvasAriaLabel(scene)}` which can produce concurrent screen reader announcement alongside speech synthesis (Audit Finding 5). | Handled in Lane x-kiro67 (Prompt 7 / Req 13.7). |

---

## 3. Scope & Safety Audits

### Check 1: Tuned Haptic Vocabulary (`tech.md`)
- **Line buzz:** `vibrate(80)` re-triggered every 70 ms while on a line.
  - Evidence: `frontend/src/core/hapticEngine.ts:59-66` (`lineMs: 80, retriggerMs: 70`), `line: 148` (`effects.push({ kind: 'vibrate', pattern: cfg.lineMs })`).
- **Corner vertex pulse:** `[50, 90, 50]` followed by 450 ms quiet window.
  - Evidence: `frontend/src/core/hapticEngine.ts:62` (`cornerPattern: [50, 90, 50]`), `line: 63` (`quietMs: 450`), `line: 128` (`vibrate(cfg.cornerPattern)`).
- **Hit radii:** 22 CSS px vertex, 14 CSS px line; vertex priority enforced.
  - Evidence: `frontend/src/core/hitTest.ts:48` (`DEFAULT_RADII = { vertex: 22, line: 14 }`), `hitTest.ts:60-75` (vertex distance check takes absolute priority over line check).
- **Pitch range:** 200–1000 Hz monotonically mapped to vertical coordinate `yNorm`.
  - Evidence: `frontend/src/core/pitch.ts:19` (`Math.min(1000, Math.max(200, 1000 - yNorm * 800))`).
- **Centre reference tick:** 25 ms single pulse.
  - Evidence: `frontend/src/flow/explore.ts:32` (`CENTRE_TICK_MS = 25`), `Explore.tsx:710, 733` (`drivers.haptics.vibrate(CENTRE_TICK_MS)`).
- **Result:** PASS (100% untouched).

### Check 2: TalkBack Relative-Cursor Behavior (Requirement 13)
- **Method A1 relative touch navigation:**
  - `frontend/src/screens/Explore.tsx:640`: `e.currentTarget.setPointerCapture(e.pointerId)` guarantees full touch tracking.
  - `frontend/src/screens/Explore.tsx:675, 774`: Only the primary pointer drives the engine state machine, avoiding multi-touch contention.
  - `frontend/src/screens/Explore.tsx:696-699`: Initial offset from center tracked via `firstTouchOffset`.
- **Centre reference tick:**
  - `frontend/src/screens/Explore.tsx:683`: `rearmCentreTick` called on every new pointerdown.
  - `frontend/src/screens/Explore.tsx:709-716`: 25 ms vibration pulse triggered on center acquisition.
- **Two-finger swipe down exit:**
  - `frontend/src/screens/Explore.tsx:756-764`: When `activePointers.size >= 2`, `checkTwoFingerSwipeDown(p1, p2)` triggers `handleExit()`.
- **Accessible Back button:**
  - `frontend/src/screens/Explore.tsx:937-943`: Rendered with min 48×48 px target and accessible name `t('common.back')`.
- **Android system Back gesture handling:**
  - `frontend/src/drivers/navigation.ts:51-60`: `pushExploreEntry()` pushes `{ screen: 'explore' }`.
  - `frontend/src/drivers/navigation.ts:82-102`: `onBack()` listens to `popstate` and executes back callback cleanly.
- **Result:** PASS.

### Check 3: Pure-Core Rule (`tech.md` Rule 1)
- Evaluated modules:
  - `frontend/src/core/geometry.ts`: Pure coordinate math; no DOM or window access.
  - `frontend/src/core/hitTest.ts`: Pure distance calculation and hit classification.
  - `frontend/src/core/hapticEngine.ts`: Pure state transition `step(state, input) -> { state, effects }`.
  - `frontend/src/core/pitch.ts`: Pure frequency calculations.
  - `frontend/src/core/scene.ts`: Pure type re-exports from generated schema types.
  - `frontend/src/core/savedDiagrams.ts`: Pure diagram management logic with injected clock/RNG; zero IndexedDB/window references.
  - `frontend/src/core/correct.ts`: Pure immutable scene edits and undo/redo history reducer.
- Browser API quarantine:
  - All browser APIs (`window.history`, `navigator.vibrate`, `window.AudioContext`, `window.speechSynthesis`, `indexedDB`) remain strictly quarantined in `frontend/src/drivers/`.
- **Result:** PASS (Zero leakage).

### Check 4: Accessibility Contracts (Requirements 12 & 14)
- **Minimum 48×48 px touch targets:**
  - `frontend/src/styles/tokens.css:87`: `--gt-target: 48px;`.
  - `frontend/src/styles/global.css:82-84`: `.gt-control { min-width: var(--gt-target); min-height: var(--gt-target); }`.
  - `frontend/src/styles/explore.css:278, 298, 315, 331`: All buttons meet or exceed 48×48 px.
  - `frontend/src/styles/settings.css:75`: Modal close button meets 48×48 px.
- **Text contrast ratios (WCAG AAA >= 7:1):**
  - Confirmed by `frontend/tests/a11y.contrast.test.ts` (19 passing contrast tests):
    - `--gt-text` (#eafff5) on dark surfaces: 18.3:1.
    - `--gt-text-primary` (#f5fff8) on dark surfaces: 19.8:1.
    - `--gt-text-muted` (#a8c5b5) on dark surfaces: 10.2:1.
    - UI component boundaries meet >= 4.5:1.
- **Decorative primitives hidden from assistive technology:**
  - `frontend/src/components/lab/Seam.tsx:27, 36`: `aria-hidden="true"`, `role="presentation"`.
  - `frontend/src/components/lab/Rivets.tsx:22, 68`: `aria-hidden="true"`, `role="presentation"`.
  - `frontend/src/components/lab/Spark.tsx:70, 80`: `aria-hidden="true"`, `role="presentation"`.
  - `frontend/src/screens/Explore.tsx:852, 859`: Specimen table decorative frame and spark wrapper are `aria-hidden="true"`.
- **Typography:**
  - `frontend/src/assets/fonts/`: Atkinson Hyperlegible woff2 files (400 and 700 weights) present on disk (17.2 KB and 17.5 KB).
  - `frontend/src/styles/tokens.css:125`: Indian script fallbacks (`'Nirmala UI'`, `'Noto Sans Devanagari'`, `'Noto Sans Gujarati'`) configured.
- **Reduced motion:**
  - `frontend/src/styles/global.css:1304-1333`: `prefers-reduced-motion: reduce` stops all animations.
  - `frontend/src/components/lab/Spark.tsx:44-56`: Immediately skips spark animation and triggers completion callback under reduced motion.
- **Result:** PASS.

---

## 4. Definition of Done Checks

- [x] Check 1: Tuned haptic vocabulary in `tech.md` verified untouched
- [x] Check 2: TalkBack relative-cursor behavior in `Explore.tsx` and `navigation.ts` verified operational
- [x] Check 3: Pure-core rule in `frontend/src/core/` verified with zero browser API imports
- [x] Check 4: Accessibility contracts (touch targets >= 48px, WCAG AAA text contrast, `aria-hidden="true"`, self-hosted Atkinson Hyperlegible font, reduced motion) verified
- [x] All frontend tests pass (`npm --prefix frontend test`: 77 files, 1115 tests passed)
- [x] TypeScript compilation passes (`npm --prefix frontend exec -- tsc -p frontend --noEmit`: 0 errors)
- [x] Production build passes (`npm --prefix frontend run build`: Vite build successful)

---

## 5. Needs from Kiro (Future Polish)

1. Replace legacy bare hex literals in `frontend/src/styles/global.css` (button gradients `#183324`/`#12241b`, ask input background `#050508`, canvas border `#20202e`) with official `var(--gt-*)` tokens.
2. Formally review and adopt Requirement 14, the design documentation, Task 17, and property tests P18–P20.
