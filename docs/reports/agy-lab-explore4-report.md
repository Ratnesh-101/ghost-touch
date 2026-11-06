# Antigravity Lane Report: lab-explore4

**Lane:** `lab-explore4`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-06  
**Status:** Complete & verified  

---

## 1. Executive Summary

This lane resolved the 5 UI and architectural issues identified by the supervisor from real device screenshots (390×844 and 1440×900 viewports):
1. **Toolbar Consolidation in Explore:** Extracted `SettingsLauncher` from the Capture screen pattern into `frontend/src/components/SettingsLauncher.tsx` and replaced the old multi-button language and speech-rate selectors in Explore's toolbar, reclaiming ~250 px of vertical space on phones.
2. **Title Wrapping:** Restructured the Explore header and title row so diagram titles wrap cleanly across 2 lines (`white-space: normal`, `-webkit-line-clamp: 2`, `flex: 1 1 auto; min-width: 0`), while ensuring the Diagram specimen badge retains `flex-shrink: 0; align-self: flex-start` so it never squeezes the title.
3. **Canvas Frame Fill and Unified Background:**
   - In Explore: eliminated the wide strip and lighter rectangle defect. Configured `.gt-lab-specimen-table` and `.gt-explore__canvas-container` to `flex: 1 1 auto; flex-direction: column; min-height: clamp(220px, 55dvh, 100%); padding: 0`, and `.gt-explore__canvas` to `flex: 1 1 auto; align-self: stretch; width: 100%; height: 100%`. Set background fill color in CSS and canvas 2D context (`renderStaticScene`) to `var(--gt-bg, #0b0e0c)`.
   - In Correct: eliminated the 177 px square collapse by removing `justify-content: center; align-items: center` on `.gt-correct__canvas-container` and setting `flex-direction: column` with `.gt-correct__canvas` `flex: 1 1 auto; align-self: stretch; width: 100%; height: 100%`. The diagram now utilizes the full height of the container (~358×358 px square area instead of 177×177 px).
4. **Layout Shift Prevention in Correct:** Reserved status area height with `min-height: 4.5rem; display: flex; align-items: center` on `.gt-correct__status-card` and `min-height: 3rem; display: flex; align-items: center; width: 100%` on `.gt-correct__status`, preventing the ~47 px canvas jump when dragging points.
5. **Pure "IT'S ALIVE" Registry:** Extracted state tracking into pure module `frontend/src/flow/alive.ts` (`shouldPlayAlive`, `markAlivePlayed`, `markReturningFromCorrect`, `resetAliveForTesting`). Explore reads from `useRef`/`useEffect` without side effects inside render or state initializers, ensuring full resilience under React StrictMode and SSR `renderToStaticMarkup`.

---

## 2. Canvas Sizing and Hit-Testing Synchronization

### 2.1 Explore Screen

- **Sizing lines:** `frontend/src/screens/Explore.tsx`:
  - `updateDimensions` (lines 456–476): measures canvas CSS box via `rect = canvas.getBoundingClientRect()`, calculates bitmap dimensions `canvas.width = Math.round(width * dpr)` and `canvas.height = Math.round(height * dpr)`, applies `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, builds `view = makeViewport(width, height)`, and schedules rendering.
  - Dimension triggers: initial mount (line 491), `window.addEventListener('resize')` (lines 493–494), `ResizeObserver` observing `canvas` (lines 496–503), and `onPointerDown` (line 534).
- **CSS styling lines:**
  - `frontend/src/styles/explore.css` lines 51–65 (`.gt-lab-specimen-table`: `display: flex; flex-direction: column; flex: 1 1 auto; min-height: clamp(220px, 55dvh, 100%); padding: 0; background: var(--gt-bg, #0b0e0c)`).
  - `frontend/src/styles/explore.css` lines 143–155 (`.gt-explore__canvas`: `display: block; width: 100%; height: 100%; flex: 1 1 auto; align-self: stretch; background-color: var(--gt-bg, #0b0e0c)`).
  - Background fill in `renderStaticScene`: line 301 sets `ctx.fillStyle = '#0b0e0c'`.
- **How hit-testing matches drawing:**
  - `makeViewport(width, height)` computes `scale = Math.min(width, height)`, centering the unit square with `offsetX = (width - scale) / 2` and `offsetY = (height - scale) / 2`.
  - `getCanvasCoords` (lines 521–529) measures pointer screen coordinates relative to canvas top-left: `x = e.clientX - rect.left`, `y = e.clientY - rect.top`.
  - Drawing (`toScreen`) and hit-testing (`toNorm` / screen distance) utilize the identical `view` instance in `viewportRef.current`. Because padding is `0` and the canvas fills the container content box directly, `rect.left` and `rect.top` align precisely with context origin `(0, 0)`, guaranteeing exact touch-to-stroke alignment.

### 2.2 Teacher Correct Screen

- **Sizing lines:** `frontend/src/screens/Correct.tsx`:
  - `updateDimensions` (lines 95–115): queries `rect = canvas.getBoundingClientRect()`, sizes bitmap `canvas.width = Math.round(width * dpr)` and `canvas.height = Math.round(height * dpr)`, sets transform `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, and constructs `makeViewport(width, height)`.
  - Observers: window resize listener (lines 121–124) and `ResizeObserver` observing `canvas` (lines 127–133).
- **CSS styling lines:**
  - `frontend/src/styles/correct.css` lines 79–100: `.gt-correct__canvas-container` uses `display: flex; flex-direction: column; flex: 1; min-height: clamp(160px, 40vh, 280px); max-height: 55vh; background: ... var(--gt-bg, #0b0e0c)`.
  - `frontend/src/styles/correct.css` lines 120–130: `.gt-correct__canvas` sets `display: block; width: 100%; height: 100%; flex: 1 1 auto; align-self: stretch; background-color: var(--gt-bg, #0b0e0c)`.
- **How hit-testing matches drawing:**
  - Removing `align-items: center; justify-content: center` allows the canvas to stretch to the container height instead of collapsing to its 2:1 intrinsic aspect ratio (177 px).
  - `renderCanvas` draws photo overlays and geometry using `toScreen(p, view)` with `view.offsetX`, `view.offsetY`, and `view.scale`.
  - `pointerToScene` and `pointerToHitTestCoords` in `frontend/src/flow/correctCanvas.ts` convert `clientX - rect.left` and `clientY - rect.top` through the exact same `viewport.offsetX`, `viewport.offsetY`, and `viewport.scale`. Points and handles remain locked under the user's touch.

---

## 3. Definition of Done Proof & Verification Results

### 3.1 Type Check (`npm --prefix frontend exec -- tsc -p frontend --noEmit`)
- **Result:** Exit code 0 (clean, 0 type errors).

### 3.2 Test Suite (`npm --prefix frontend test`)
- **Result:** Exit code 0.
- **Output summary:**
  - 69 test files passed (69 passed, 0 failed).
  - 1001 tests passed (979 baseline + 22 new tests).
  - Test suites added:
    - `frontend/tests/alive.flow.test.ts`: 8 tests passed.
    - `frontend/tests/settingsLauncher.test.tsx`: 5 tests passed.
    - `frontend/tests/explore.layout.test.tsx`: 9 tests passed.

### 3.3 Production Build (`npm --prefix frontend run build`)
- **Result:** Exit code 0.
- **Output:**
  - `dist/assets/index-CvnYnvlv.css`: 62.02 kB (gzip: 9.76 kB).
  - `dist/assets/index-9JLQMB_N.js`: 366.54 kB (gzip: 108.38 kB).
  - `dist/assets/pdf-ULJPBbF3.js`: 430.16 kB (gzip: 129.27 kB).
  - Service worker precache generated (18 entries, 498.05 KiB).
  - Zero CSS warnings.
- **CSS Rule Verification in Built Bundle:**
  - `.gt-correct__status-card` has `min-height:4.5rem;display:flex;align-items:center`.
  - `.gt-correct__status` has `min-height:3rem;display:flex;align-items:center;width:100%`.
  - `.gt-correct__canvas-container` has `flex-direction:column;flex:1;display:flex`.
  - `.gt-correct__canvas` has `flex:auto;align-self:stretch;display:block;background-color:var(--gt-bg,#0b0e0c)`.
  - `.gt-lab-specimen-table` has `flex-direction:column;flex:auto;min-height:clamp(220px,55dvh,100%);padding:0`.
  - `.gt-explore__canvas` has `flex:auto;align-self:stretch;width:100%;height:100%;background-color:var(--gt-bg,#0b0e0c)`.
  - `.gt-settings-launcher__button` has `min-width:var(--gt-target,48px);min-height:var(--gt-target,48px)`.
  - `.gt-explore__title` has `-webkit-line-clamp:2;white-space:normal;flex:auto;min-width:0`.
  - `.gt-lab-badge` has `flex-shrink:0;align-self:flex-start`.

### 3.4 Backend Commands
- **Result:** Zero backend commands run, conforming strictly to the brief instructions.

---

## 4. Diff Stat for `Explore.tsx` and `Correct.tsx`

```
 frontend/src/screens/Explore.tsx | 65 ++++++++++++++++++++--------------------
 1 file changed, 33 insertions(+), 32 deletions(-)
```

*(Note: `frontend/src/screens/Correct.tsx` required 0 line changes; its existing semantic markup classes `.gt-correct__status-card`, `.gt-correct__status`, `.gt-correct__canvas-container`, and `.gt-correct__canvas` were targeted directly in `frontend/src/styles/correct.css` to fix the layout jump and canvas fill without altering handlers or geometry math.)*

Full git diff stat across all modified files:
```
 frontend/src/screens/Explore.tsx | 65 ++++++++++++++++++++--------------------
 frontend/src/styles/correct.css  | 12 ++++++--
 frontend/src/styles/explore.css  | 61 ++++++++++++++++++++++++++++++++++---
 frontend/src/styles/global.css   | 25 ++++++++++++----
 4 files changed, 119 insertions(+), 44 deletions(-)
```

---

## 5. Commit Groups

### Group 1: flow(alive): extract pure alive registry
- **Message:** `refactor(alive): extract pure alive registry with zero side effects during render`
- **Files:**
  - `frontend/src/flow/alive.ts`
  - `frontend/tests/alive.flow.test.ts`

### Group 2: feat(components): extract SettingsLauncher component
- **Message:** `feat(components): extract SettingsLauncher launcher button and modal sheet`
- **Files:**
  - `frontend/src/components/SettingsLauncher.tsx`
  - `frontend/tests/settingsLauncher.test.tsx`

### Group 3: feat(explore): wire SettingsLauncher, title wrapping, and pure alive registry
- **Message:** `feat(explore): wire SettingsLauncher, 2-line title wrapping, and canvas container fill`
- **Files:**
  - `frontend/src/screens/Explore.tsx`
  - `frontend/src/styles/explore.css`
  - `frontend/src/styles/global.css`

### Group 4: fix(correct): reserve status height and expand canvas to fill container
- **Message:** `fix(correct): reserve status height and expand canvas to fill container without layout shift`
- **Files:**
  - `frontend/src/styles/correct.css`
  - `frontend/tests/explore.layout.test.tsx`

### Group 5: docs: update build log and add lane report
- **Message:** `docs: add lab-explore4 lane report and update build log`
- **Files:**
  - `docs/reports/agy-lab-explore4-report.md`
  - `docs/BUILD_LOG.md`
