# Lane lab-explore Report: Specimen Table Frame & HUD around Explore Canvas (Pass 2)

**Builder:** Antigravity (agy)  
**Lane:** `lab-explore`  
**Briefs:** [`docs/briefs/lab-spec.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/docs/briefs/lab-spec.md), [`docs/briefs/agy-lab-explore.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/docs/briefs/agy-lab-explore.md), [`docs/briefs/agy-lab-explore2.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/docs/briefs/agy-lab-explore2.md)  
**Date:** 2026-11-06  

---

## 1. Summary of Built Work

In accordance with `lab-spec.md`, `agy-lab-explore.md`, and pass-2 brief `agy-lab-explore2.md`:

1. **Specimen Table Frame around Explore Canvas:**
   - The drawing canvas preserves 100% maximum contrast: glowing green strokes (`#39ff88`) on near-black (`#0b0e0c`), with zero decorative textures, gradient overlays, or obstructions over the drawing area.
   - The frame container (`.gt-lab-specimen-table` with `data-lab-specimen-table="true"`) acts as the Frankenstein laboratory specimen table with a subtle aged copper edge (`var(--gt-copper, var(--gt-border, #39ff88))`), deep charcoal surface (`var(--gt-lab-charcoal, #0b0e0c)`), and 10px frame padding around the canvas.
   - The decorative frame (`.gt-lab-frame`) carries the `data-lab-frame` attribute, `aria-hidden="true"`, `pointer-events: none`, and lower z-index than the canvas.
   - Four corner rivets (`.gt-lab-rivet--tl`, `.gt-lab-rivet--tr`, `.gt-lab-rivet--bl`, `.gt-lab-rivet--br`) and a dashed bone suture seam (`.gt-lab-suture-border`) decorate the perimeter, all strictly marked `aria-hidden="true"` and `pointer-events: none`.

2. **HUD & Status Chip:**
   - Restyled HUD status card (`.gt-lab-status-card`) with aged copper border and high-contrast text (> 10:1 contrast ratio, exceeding the 7:1 AAA requirement).
   - Added specimen badge (`.gt-lab-badge`) in the header.
   - Added Raw Mode notice banner (`.gt-lab-raw-notice` with `role="status"`) when in raw mode, displaying visible copy via `t('lab.raw.notice')` with graceful fallback to `t('raw.announce')` until the i18n lane merges.

3. **Scope Creep Removal:**
   - Removed unrequested `onSave` prop and its Save button from `Explore.tsx`.
   - Kept `onCorrect`, `onBack`, and `onAsk` exactly as they were.

4. **Controls & Action Touch Targets:**
   - Every control around the canvas maintains an accessible name and touch targets $\ge 48 \times 48$ CSS px (`min-height: 52px; min-width: var(--gt-target, 48px);` for buttons, `min-height: 48px` for inputs).

5. **CSS Tokens & Reduced Motion:**
   - Tokens use CSS variables with fallbacks (`var(--gt-copper, ...)`, `var(--gt-cyan, ...)`, `var(--gt-bone, ...)`) ensuring compatibility before and after the foundation lane merges.
   - Under `prefers-reduced-motion: reduce`, animations and transitions on the specimen table and its frame decorations are explicitly disabled (`animation: none !important; transition: none !important;`).

6. **Test Suite Fixes (`frontend/tests/explore.lab.test.tsx`):**
   - Replaced bundler `?raw` CSS import with `node:fs` `readFileSync(new URL('../src/styles/explore.css', import.meta.url))` identical to `tests/a11y.contrast.test.ts`, preventing Vitest from returning an empty string stub for non-global stylesheets.
   - Replaced fragile order-dependent regex matching with a CSS rule parser and dimension resolution helper that handles `var(--gt-target, 48px)` fallbacks as well as plain px numbers.
   - Updated static markup assertions to match React's rendered boolean attributes (`data-lab-frame`) without depending on attribute ordering.
   - Updated action button assertions to reflect the removal of `onSave`.

---

## 2. Changes to `Explore.tsx`

Per brief instructions:
> *"The canvas element, its pointer handlers, touch-action, hit-testing, haptic/effect calls, speech and earcon calls, the two-finger swipe, the long-press Ask gesture, flow/**, core/**, drivers/**, i18n/**, other screens, tokens.css, .env* are forbidden."*
> *"Markup and class names AROUND the canvas only."*

### Diff Stat:
```
 frontend/src/screens/Explore.tsx | 33 +++++++++++++++++++++++++++------
 1 file changed, 27 insertions(+), 6 deletions(-)
```

### Exact Changes:
1. **Props:**
   - Added optional `isRaw?: boolean` to [`ExploreProps`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/frontend/src/screens/Explore.tsx#L49-L57). No `onSave`.
2. **State & Raw Mode Detection:**
   - Added detection `isRawScene = isRaw ?? (scene.kind === 'unknown' || announced.includes(t('raw.announce')))`.
   - Added translation lookup `rawNoticeTranslation = t('lab.raw.notice')` falling back to `t('raw.announce')` if the i18n key is not yet merged.
3. **Markup Around the Canvas:**
   - `main`: Added `gt-lab-explore` class.
   - `header`: Added `gt-lab-header` class.
   - Diagram badge: Added `gt-lab-badge` class.
   - Raw Mode Notice: Rendered `.gt-explore__raw-notice.gt-lab-raw-notice` when `isRawScene` is true.
   - Status card: Added `gt-lab-status-card` class.
   - Specimen Table Frame: Wrapped the canvas in `.gt-explore__canvas-container.gt-lab-specimen-table` with `data-lab-specimen-table="true"`, containing `<div className="gt-lab-frame" data-lab-frame aria-hidden="true">` with 4 corner rivets and stitched suture border.
   - Canvas: **100% UNTOUCHED.** Same ref, same className (`gt-explore__canvas`), same `tabIndex={0}`, same `role="img"`, same `aria-label`, same `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, and `onLostPointerCapture`.
   - Actions footer: Kept `onCorrect`, `onBack`, and `onAsk` exactly as original.

---

## 3. Styling Architecture

- **New Stylesheet:** [`frontend/src/styles/explore.css`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/frontend/src/styles/explore.css) contains the specimen table frame, corner rivets, suture borders, HUD status card, raw mode notice, lab button variants, and reduced-motion rules.
- **Import Line:** Exactly one import line was added at the very end of [`frontend/src/styles/global.css`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/frontend/src/styles/global.css#L1021-L1022):
  ```css
  /* Lane lab-explore: specimen table frame and HUD around Explore canvas */
  @import './explore.css';
  ```
- **Preserved Existing Rules:** All existing `.gt-explore*` rules in `global.css` that [`tests/a11y.targets.test.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/frontend/tests/a11y.targets.test.ts), [`tests/screens.render.test.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/frontend/tests/screens.render.test.ts), and [`tests/a11y.motion.test.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/frontend/tests/a11y.motion.test.ts) inspect by regex remain intact and passing.

---

## 4. Definition of Done Command Proof

Executed from repo root:

### 1. TypeScript Compiler Check
**Command:** `npm --prefix frontend exec -- tsc -p frontend --noEmit`  
**Output:** Clean (no errors, exit code 0).

### 2. Frontend Test Suite
**Command:** `npm --prefix frontend test`  
**Output:**
```
 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-explore/frontend

 Test Files  43 passed (43)
      Tests  493 passed (493)
   Start at  06:29:26
   Duration  681ms (transform 53%, tests 21%, import 19%, worker 8%)
```
**Result:** 43 test files passed, 493 tests passed, 0 failures (exit code 0).

### 3. Frontend Production Build
**Command:** `npm --prefix frontend run build`  
**Output:**
```
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 60 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                           0.13 kB
dist/manifest.webmanifest                    0.48 kB
dist/index.html                              0.70 kB │ gzip:   0.40 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs  1,264.34 kB
dist/assets/index-DkhKiTy5.css              23.69 kB │ gzip:   4.84 kB
dist/assets/index-DBreAJbT.js              331.18 kB │ gzip: 100.12 kB
dist/assets/pdf-ULJPBbF3.js                430.16 kB │ gzip: 129.27 kB

✓ built in 460ms

PWA v2.0.0
mode      generateSW
precache  14 entries (379.96 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```
**Result:** Build succeeded cleanly, PWA service worker and precache assets emitted (exit code 0).

### 4. Git Diff Stat
**Command:** `git diff --stat`  
**Output:**
```
 docs/BUILD_LOG.md                | 22 ++++++++++++++++++++++
 frontend/src/screens/Explore.tsx | 33 +++++++++++++++++++++++++++------
 frontend/src/styles/global.css   |  4 ++++
 3 files changed, 53 insertions(+), 6 deletions(-)
```

---

## 5. Needs from Kiro / Other Lanes

- **i18n Lane:** When the i18n lane merges the translation key `'lab.raw.notice': "The creature's eyes are blurry — you can still feel the outlines."`, Explore will automatically display it. Until then, it falls back to `t('raw.announce')`.
- **Foundation Token Lane:** The foundation lane will provide root definitions for `--gt-copper`, `--gt-cyan`, and `--gt-bone`. All rules in `explore.css` already include valid existing token fallbacks (`var(--gt-copper, var(--gt-border, #39ff88))`, `var(--gt-cyan, var(--gt-line, #39ff88))`, `var(--gt-bone, var(--gt-text-muted, #a8c5b5))`).

---

## 6. Commit Groups

Ordered logical conventional commits for review and integration:

### Commit 1: `feat(explore): add Frankenstein laboratory specimen table frame and HUD styling`
**Files:**
- `frontend/src/styles/explore.css`
- `frontend/src/styles/global.css`

**Description:**  
Introduces `explore.css` with the specimen table frame around the canvas, corner rivets, bone dashed suture lines, lab token CSS variable fallbacks, $\ge 48$px touch targets, and reduced-motion query. Imports `explore.css` at the end of `global.css`.

### Commit 2: `feat(explore): wire specimen table frame, rivets, and raw mode notice around Explore canvas`
**Files:**
- `frontend/src/screens/Explore.tsx`

**Description:**  
Updates markup and classes around the canvas in `Explore.tsx`: wraps canvas in `.gt-lab-specimen-table` containing `data-lab-frame` with `aria-hidden="true"` corner rivets and suture border. Restyles HUD status card, adds specimen badge, and raw mode notice via `t('lab.raw.notice')`. Leaves canvas element, its attributes, and pointer handlers completely untouched.

### Commit 3: `test(explore): add lab specimen table and HUD accessibility test suite`
**Files:**
- `frontend/tests/explore.lab.test.tsx`

**Description:**  
Adds Vitest test suite validating that `data-lab-frame` and corner rivets are `aria-hidden="true"`, canvas accessibility is unaffected, all controls around canvas have touch targets $\ge 48 \times 48$ CSS px and accessible names, raw mode renders status notice, token fallbacks are present, and reduced-motion disables frame animations.

### Commit 4: `docs(explore): add lane report and build log entry for lab-explore`
**Files:**
- `docs/reports/agy-lab-explore-report.md`
- `docs/BUILD_LOG.md`

**Description:**  
Records the build log entry and complete lane report with DoD proof and diff stats for review.
