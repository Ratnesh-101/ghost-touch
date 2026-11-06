# Lane lab-explore3 Report: CSS Import & Explore Layout Fixes

**Agent:** Antigravity (agy)  
**Date:** 2026-11-06  
**Lane:** `lab-explore3`  
**Status:** Complete & Verified  

---

## 1. Executive Summary

In lane `lab-explore3`, we addressed the root causes identified in the supervisor audit (`docs/reports/audit-layout.md` and `docs/reports/audit-csstests.md`):

1. **CSS Import Bug Fix:** Moved `@import './explore.css';` to the top of `frontend/src/styles/global.css` immediately following the other `@import` statements. Prior to this fix, Vite/PostCSS dropped `@import './explore.css';` with warning `[vite:css][postcss] @import statements must precede all other statements`, preventing all specimen table, rivet, and HUD classes from reaching the built bundle `dist/assets/index-*.css`.
2. **Import Ordering & Existence Guard Test:** Added `frontend/tests/css.imports.test.ts`, asserting that:
   - For every `.css` file in `src/styles/`, all `@import` statements precede all rules (ignoring comments and `@charset`).
   - Every file imported via `@import` exists on disk.
   - Every CSS file imported by components or screens exists on disk.
   - **Proof of failure on old layout:** Verified that this test failed with `AssertionError: In "global.css", @import statement "@import './explore.css';" appears after rules or statements...` on the old layout before passing cleanly once fixed.
3. **Audit BUG-01 (Explore Viewport Lock & Clipping):** Replaced `height: 100dvh; overflow: hidden;` on `.gt-explore` with `min-height: 100vh; min-height: 100dvh; overflow-y: auto;`. The canvas container now uses `flex: 1 1 auto; min-height: clamp(220px, 50dvh, 100%);`. Under 200% browser zoom, landscape orientation, or mobile virtual keyboard display, the Ask, Correct, and Back controls remain fully reachable via scrolling or canvas flexing.
4. **Audit BUG-04 (Action Button Overflow):** Added `flex-wrap: wrap;` to `.gt-explore__actions` in both `global.css` and `explore.css` and ensured `.gt-explore__correct` has `flex: 1; min-height: 52px; min-width: var(--gt-target, 48px);`, preventing button clipping or collision at 320 px or 200% zoom.
5. **Audit BUG-08 (Title Truncation):** Removed `white-space: nowrap; text-overflow: ellipsis;` from `.gt-explore__title` and implemented two-line multiline clamping (`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal; word-break: break-word;`).
6. **Audit BUG-06 (Safe-Area Insets):** Added `padding-top: max(var(--gt-space-sm), env(safe-area-inset-top, 0px));`, `padding-bottom: max(var(--gt-space-md), env(safe-area-inset-bottom, 0px));`, and horizontal safe-area insets to `.gt-explore` in both portrait and landscape media queries.
7. **Extended Lab Explore Test Suite:** Updated and added 6 new test assertions in `frontend/tests/explore.lab.test.tsx` verifying the new layout, import position, action wrapping, multiline title, safe-area insets, and touch target guarantees.

---

## 2. Canvas Sizing and Hit-Testing Verification

Per Section 5 of `docs/reports/audit-layout.md` and brief Item 3:

### Pipeline Inspection
1. **Dimension Acquisition (`Explore.tsx:416-436`):**
   ```ts
   const updateDimensions = (): void => {
     const canvas = canvasRef.current;
     if (!canvas) return;
     const rect = canvas.getBoundingClientRect();
     const width = Math.max(1, Math.round(rect.width));
     const height = Math.max(1, Math.round(rect.height));
     const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

     canvas.width = Math.round(width * dpr);
     canvas.height = Math.round(height * dpr);

     const ctx = canvas.getContext('2d');
     if (ctx) {
       ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
     }

     const view = makeViewport(width, height);
     viewportRef.current = view;
     renderStaticScene(view, dpr);
     draw(view, pendingCursor.current);
   };
   ```
2. **Observation:** A `ResizeObserver` actively observes `canvasRef.current`. Whenever the container flexes, shrinks, or window resizes, `updateDimensions()` triggers and recalculates `rect.width` and `rect.height`.
3. **Coordinate Transformation (`Explore.tsx:481-489`):**
   ```ts
   const getCanvasCoords = (e: PointerEvent<HTMLCanvasElement>): ScreenPoint => {
     const canvas = canvasRef.current;
     if (!canvas) return { x: 0, y: 0 };
     const rect = canvas.getBoundingClientRect();
     return {
       x: e.clientX - rect.left,
       y: e.clientY - rect.top,
     };
   };
   ```
4. **Hit-Testing vs Drawing Synchronization:**
   - Both `renderStaticScene(view, dpr)` and hit-testing in `flow/explore.ts` consume the exact same `view` calculated from `rect.width` and `rect.height`.
   - The `<canvas>` layout box is measured directly; borders and padding are applied to `.gt-explore__canvas-container` / `.gt-lab-specimen-table` rather than to `<canvas>` directly.
   - The canvas element maintains `touch-action: none;` and `position: relative; z-index: 2;`, while decorative frame elements (`.gt-lab-frame`, `.gt-lab-rivet`, `.gt-lab-suture-border`) have `pointer-events: none; z-index: 1;`.
   - **Conclusion:** Hit-testing remains 100% synchronized with the visual rendering across all container sizes and scrolling offsets.

---

## 3. Proof of Guard Test Failure on Old Layout

When `frontend/tests/css.imports.test.ts` was initially executed against the codebase with `@import './explore.css';` at line 1195 of `global.css`, it failed with:

```text
FAIL  tests/css.imports.test.ts > CSS Import Ordering Guard (Brief Item 2) > scans all CSS files in src/styles/ and asserts every @import appears before any rule
AssertionError: In "global.css", @import statement "@import './explore.css';" appears after rules or statements: "@font-face {
  font-family: 'Atkinson Hyperlegible';
  font-style: normal;
  font-weight: 400;
 ...": expected '@font-face {\r\n  font-family: \'Atki…' to be ''
```

Moving the `@import` statement to line 3 at the top of `global.css` immediately resolved the failure.

---

## 4. Verification Results (Definition of Done)

### 4.1 TypeScript Compiler Check
Command: `npm --prefix frontend exec -- tsc -p frontend --noEmit`
Result: Clean exit (code 0), zero errors.

### 4.2 Frontend Test Suite
Command: `npm --prefix frontend test`
Result:
```text
 Test Files  54 passed (54)
      Tests  746 passed (746)
   Duration  803ms
```
(Previous baseline: 53 files passed, 737 tests passed. +1 new test file `css.imports.test.ts` with 3 tests, +6 tests in `explore.lab.test.tsx` = +9 tests total).

### 4.3 Frontend Production Build
Command: `npm --prefix frontend run build`
Result:
```text
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 60 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.59 kB │ gzip:   0.61 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-DH4PGFgt.css                                        36.15 kB │ gzip:   7.02 kB
dist/assets/index-XX8_W-QY.js                                        336.58 kB │ gzip: 101.08 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB

✓ built in 162ms
```
Zero Vite/PostCSS `@import` warnings. CSS bundle size increased from 30.99 kB to 36.15 kB.

### 4.4 Confirmation of Built Frame Classes in CSS
Inspection of built CSS (`frontend/dist/assets/index-DH4PGFgt.css`):
- `.gt-lab-specimen-table`:
  ```css
  .gt-lab-specimen-table{background:var(--gt-lab-charcoal,#0b0e0c);border:2px solid var(--gt-copper,var(--gt-border,#39ff88));border-radius:var(--gt-radius-lg,16px);box-sizing:border-box;flex:auto;min-height:clamp(220px,50dvh,100%);padding:10px;display:flex;position:relative;overflow:hidden;box-shadow:0 10px 30px #000000d9,inset 0 0 20px #000000b3}
  ```
- `.gt-lab-frame`:
  ```css
  .gt-lab-frame{pointer-events:none;z-index:1;position:absolute;inset:0}
  ```
- `.gt-lab-suture-border`:
  ```css
  .gt-lab-suture-border{border:1.5px dashed var(--gt-bone,var(--gt-text-muted,#d9d4c573));border-radius:calc(var(--gt-radius-lg,16px) - 4px);pointer-events:none;position:absolute;inset:5px}
  ```
- `.gt-lab-rivet`:
  ```css
  .gt-lab-rivet{background:radial-gradient(circle at 35% 35%, #e0a370 0%, var(--gt-copper,#b87333) 50%, #4a2810 100%);border:1px solid var(--gt-copper,#8c4e20);pointer-events:none;border-radius:50%;width:8px;height:8px;position:absolute;box-shadow:0 1px 3px #000000e6,inset 0 0 1px #fff6}
  ```
- `.gt-lab-status-card`:
  ```css
  .gt-lab-status-card{background:var(--gt-surface-card,#12121b);border:1px solid var(--gt-copper,var(--gt-border-subtle,#222232));border-radius:var(--gt-radius-md,12px);padding:8px var(--gt-space-md,16px);margin-bottom:var(--gt-space-xs,8px);align-items:center;min-height:2.75rem;display:flex;box-shadow:0 2px 10px #00000080}
  ```
- `.gt-lab-badge`:
  ```css
  .gt-lab-badge{font-size:var(--gt-text-xs,.75rem);letter-spacing:.08em;text-transform:uppercase;color:var(--gt-bone,var(--gt-text-muted,#a8c5b5));border-radius:var(--gt-radius-sm,4px);background:var(--gt-surface-card,#12121b);border:1px solid var(--gt-copper,var(--gt-border-subtle,#222232));padding:2px 8px;font-weight:700}
  ```
- `.gt-lab-raw-notice`:
  ```css
  .gt-lab-raw-notice{align-items:center;gap:var(--gt-space-xs,8px);padding:8px var(--gt-space-md,16px);margin-bottom:var(--gt-space-xs,8px);border:1px dashed var(--gt-copper,var(--gt-border,#c87d55));border-radius:var(--gt-radius-md,12px);color:var(--gt-text,#eafff5);font-size:var(--gt-text-xs,.75rem);background:#b873331f;line-height:1.4;display:flex;box-shadow:0 2px 8px #0006}
  ```

---

## 5. Git Diff Stat

```text
 frontend/src/screens/Explore.tsx    |  2 +-
 frontend/src/styles/explore.css     | 43 +++++++++++++++++-
 frontend/src/styles/global.css      | 49 +++++++++++++++-----
 frontend/tests/css.imports.test.ts  | 98 +++++++++++++++++++++++++++++++++++++++
 frontend/tests/explore.lab.test.tsx | 89 ++++++++++++++++++++++++++++++++++++-
 5 files changed, 265 insertions(+), 16 deletions(-)
```

---

## 6. Commit Groups

### Group 1: Fix CSS import ordering and add guard test
- **Message:** `fix(css): move explore.css import to top of global.css and add import ordering guard test`
- **Files:**
  - `frontend/src/styles/global.css`
  - `frontend/tests/css.imports.test.ts`
  - `frontend/tests/explore.lab.test.tsx`

### Group 2: Resolve Explore responsive layout, scroll trapping, and title truncation
- **Message:** `fix(explore): prevent scroll clipping with min-height, wrap actions, clamp canvas, and clamp title`
- **Files:**
  - `frontend/src/styles/global.css`
  - `frontend/src/styles/explore.css`
  - `frontend/src/screens/Explore.tsx`
  - `frontend/tests/explore.lab.test.tsx`

### Group 3: Documentation and build log updates
- **Message:** `docs: record lab-explore3 fixes and verification results`
- **Files:**
  - `docs/reports/agy-lab-explore3-report.md`
  - `docs/BUILD_LOG.md`
