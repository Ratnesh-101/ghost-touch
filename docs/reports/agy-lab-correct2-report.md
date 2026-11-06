# Antigravity Lane Report: lab-correct2

**Lane:** `lab-correct2`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-06  
**Status:** Complete & verified  

---

## 1. Executive Summary

This lane resolved the critical touch and letterboxing desynchronization bug on the Teacher Correct canvas (BUG-02 / Finding 7), the Saved and Correct layout / responsive constraints (BUG-05, BUG-06, BUG-07), initial focus placement for TalkBack / keyboard navigation on SavedDiagrams and Correct (Finding 8), and the PDF blob photo overlay guard in Correct (Finding 17).

---

## 2. Findings Fixed

### 2.1 BUG-02 / Finding 7 (CRITICAL): Canvas Letterboxing & Touch Alignment
- **Problem:** In `Correct.tsx`, `<canvas>` had hardcoded 600×400 buffer dimensions and CSS `object-fit: contain`. When rendered inside responsive containers on small screens and phones (e.g. 320×280), CSS letterbox bars shifted the visual diagram, while hit-testing and dragging converted pointer positions assuming the diagram directly scaled to `rect.width` and `rect.height`. This caused touches near edges to miss completely and dragged points to desynchronize from the teacher's touch.
- **Fix:**
  - Removed `object-fit: contain;` from `.gt-correct__canvas` in `frontend/src/styles/correct.css`.
  - Sized canvas bitmap dynamically via `ResizeObserver` and window resize listeners in `Correct.tsx`: `canvas.width = Math.round(width * dpr)`, `canvas.height = Math.round(height * dpr)`, applying `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
  - Constructed a single letterboxed `Viewport` (`makeViewport(width, height)`) shared by drawing, hit-testing, and pointer-to-scene conversion.
  - Implemented pure conversion helpers in `frontend/src/flow/correctCanvas.ts`:
    - `pointerToScene(clientX, clientY, rect, bitmapSize, dpr, viewport)`: converts pointer coordinates to normalized [0, 1] scene coordinates, correctly accounting for letterbox offsets, scales, DPR, and clamping to borders. Supports both positional parameters and options object.
    - `pointerToHitTestCoords(clientX, clientY, rect, viewport)`: converts pointer coordinates to viewport-relative space `{ px, py }` for passing to `hitTestCorrect(history.present, px, py, view.scale, view.scale)`.
  - Updated `renderCanvas` to draw photo overlay, segments, polylines, points, and labels via `toScreen(..., view)`.

### 2.2 BUG-05: Saved Header Flexbox Wrapping
- **Problem:** `.gt-saved__header` lacked `flex-wrap: wrap;`. On 320 px viewports or at 200% zoom, the `1.75rem` heading and Back button collided.
- **Fix:** Added `flex-wrap: wrap;` to `.gt-saved__header` in `frontend/src/styles/saved.css`, preserving the existing `gap: var(--gt-space-sm, 12px)`.

### 2.3 BUG-06: Safe-Area Inset Padding
- **Problem:** Hardware notches and home bars touched UI controls because `env(safe-area-inset-*)` padding was missing on Saved and Correct containers.
- **Fix:** Added safe-area padding rules using `max(...)` fallbacks to `.gt-saved` in `frontend/src/styles/saved.css` and `.gt-correct` in `frontend/src/styles/correct.css`:
  - `padding-top: max(var(--gt-space-xl, 24px), env(safe-area-inset-top, 0px));` (Saved) / `max(var(--gt-space-md, 16px), env(safe-area-inset-top, 0px));` (Correct)
  - `padding-right: max(var(--gt-space-md, 16px), env(safe-area-inset-right, 0px));`
  - `padding-bottom: max(var(--gt-space-3xl, 48px), env(safe-area-inset-bottom, 0px));` (Saved) / `max(var(--gt-space-md, 16px), env(safe-area-inset-bottom, 0px));` (Correct)
  - `padding-left: max(var(--gt-space-md, 16px), env(safe-area-inset-left, 0px));`

### 2.4 BUG-07: Canvas Container Minimum Height in Landscape
- **Problem:** Rigid `min-height: 280px;` on `.gt-correct__canvas-container` forced excessive height on small landscape viewports (≤ 360 px height), pushing edit controls and action buttons below the fold.
- **Fix:** Updated `.gt-correct__canvas-container` in `frontend/src/styles/correct.css` to use `min-height: clamp(160px, 40vh, 280px);` and added a dedicated landscape rule:
  ```css
  @media (orientation: landscape) {
    .gt-correct__canvas-container {
      min-height: 160px;
    }
  }
  ```

### 2.5 Finding 8 (MEDIUM): Lost Focus on Mount in Correct and SavedDiagrams
- **Problem:** Neither screen set initial focus on mount, leaving screen reader / TalkBack and keyboard users focused on `document.body`.
- **Fix:**
  - In `SavedDiagrams.tsx`, added `headingRef`, `tabIndex={-1}` on `<h1 className="gt-saved__heading">`, and focused the heading in a mount `useEffect`. Preserved existing spoken entry messages.
  - In `Correct.tsx`, added `headingRef`, `tabIndex={-1}` on `<h1 className="gt-correct__title">`, and focused the heading in a mount `useEffect`. Preserved `speak(t('correct.intro'))`.

### 2.6 Finding 17 (LOW): Guard Photo Overlay Against PDF Blobs in Correct
- **Problem:** PDF uploads produce PDF blobs; passing a PDF blob URL to `new Image().src` failed decoding and left Teacher Correct without background image overlay.
- **Fix:**
  - Added synchronous `isPdfSource` check (checking `.pdf` extensions and `data:application/pdf` data URLs) in `frontend/src/flow/correctCanvas.ts`.
  - In `Correct.tsx`, guarded `photoUrl` preload: checks `isPdfSource(photoUrl)` and inspects `blob:` URL MIME types via `fetch(photoUrl)`; if the MIME type is `application/pdf` or not `image/*`, the image element is cleared (`photoImgRef.current = null`) and no overlay is loaded, avoiding broken image decoding.

---

## 3. Definition of Done Proof & Verification Results

### 3.1 Type Check (`npm --prefix frontend exec -- tsc -p frontend --noEmit`)
- **Result:** Exit code 0 (clean, 0 type errors).

### 3.2 Test Suite (`npm --prefix frontend test`)
- **Result:** Exit code 0.
- **Summary:** 57 test files passed (57), 841 tests passed (841).
  - All 55 baseline test files passed.
  - 2 new test files passed:
    - `frontend/tests/correct.canvas.test.ts` (44 tests)
    - `frontend/tests/saved.focus.test.tsx` (6 tests)
  - Extended test suites passed:
    - `frontend/tests/correct.lab.test.tsx` (25 tests)
    - `frontend/tests/saved.lab.test.tsx` (29 tests)

### 3.3 Production Build (`npm --prefix frontend run build`)
- **Result:** Exit code 0.
- **Output:**
  - `dist/assets/index-CJ0lxMp0.css`: 40.90 kB (gzip: 7.01 kB)
  - `dist/assets/index-CNWSAuBu.js`: 338.61 kB (gzip: 101.61 kB)
  - Service worker precache generated (22 entries, 459.72 KiB).

### 3.4 Confirmation of New CSS Rules in Built Bundle
Verified in `frontend/dist/assets/index-CJ0lxMp0.css`:
- `flex-wrap: wrap` on `.gt-saved__header`:
  ```css
  .gt-saved__header{...;flex-wrap:wrap;display:flex}
  ```
- Safe-area insets on `.gt-saved`:
  ```css
  .gt-saved{...;padding-top:max(var(--gt-space-xl,24px), env(safe-area-inset-top,0px));padding-right:max(var(--gt-space-md,16px), env(safe-area-inset-right,0px));padding-bottom:max(var(--gt-space-3xl,48px), env(safe-area-inset-bottom,0px));padding-left:max(var(--gt-space-md,16px), env(safe-area-inset-left,0px));...}
  ```
- Safe-area insets on `.gt-correct`:
  ```css
  .gt-correct{...;padding-top:max(var(--gt-space-md,16px), env(safe-area-inset-top,0px));padding-right:max(var(--gt-space-md,16px), env(safe-area-inset-right,0px));padding-bottom:max(var(--gt-space-md,16px), env(safe-area-inset-bottom,0px));padding-left:max(var(--gt-space-md,16px), env(safe-area-inset-left,0px));...}
  ```
- `clamp(160px,40vh,280px)` and landscape rule on `.gt-correct__canvas-container`:
  ```css
  .gt-correct__canvas-container{...;min-height:clamp(160px,40vh,280px);max-height:55vh;...}@media (orientation:landscape){.gt-correct__canvas-container{min-height:160px}}
  ```
- Absence of `object-fit: contain` on `.gt-correct__canvas`:
  ```css
  .gt-correct__canvas{width:100%;height:100%;min-width:var(--gt-target,48px);min-height:var(--gt-target,48px);cursor:crosshair;background-color:var(--gt-bg,#0b0e0c);display:block}
  ```

### 3.5 Backend Check
- Per brief instructions ("Run NO backend commands"), zero backend commands were executed.

---

## 4. Git Diff Stat

```
 frontend/src/flow/correctCanvas.ts     | 141 ++++++++++++++++++++++++
 frontend/src/screens/Correct.tsx       | 184 +++++++++++++++++++++++++--------
 frontend/src/screens/SavedDiagrams.tsx |  11 +-
 frontend/src/styles/correct.css        |  13 ++-
 frontend/src/styles/saved.css          |   6 ++
 frontend/tests/correct.canvas.test.ts  | 240 +++++++++++++++++++++++++++++++++++++++++
 frontend/tests/correct.lab.test.tsx    |  22 +++-
 frontend/tests/saved.focus.test.tsx    | 128 ++++++++++++++++++++++
 frontend/tests/saved.lab.test.tsx      |  14 ++-
 9 files changed, 712 insertions(+), 47 deletions(-)
```

---

## 5. Commit Groups

For review and landing, the changes partition into two logical commits:

### Group 1: `fix(correct): letterbox canvas sizing, hit-testing & PDF overlay guard (BUG-02, BUG-07, Finding 17)`
- `frontend/src/flow/correctCanvas.ts` (new pure letterboxed coordinate helpers)
- `frontend/src/screens/Correct.tsx` (`ResizeObserver`, DPR scaling, unified `Viewport` drawing/hit-testing, PDF blob guard, heading focus)
- `frontend/src/styles/correct.css` (removal of `object-fit: contain`, clamp min-height, landscape media query, safe-area insets)
- `frontend/tests/correct.canvas.test.ts` (unit tests for corner/edge mapping, wide/tall letterboxed boxes, DPR 1-3, same-viewport inverse)
- `frontend/tests/correct.lab.test.tsx` (CSS assertions for BUG-02, BUG-06, BUG-07)

### Group 2: `fix(saved): header wrapping, safe-area insets & screen mount focus (BUG-05, BUG-06, Finding 8)`
- `frontend/src/screens/SavedDiagrams.tsx` (mount heading focus effect with `tabIndex={-1}`)
- `frontend/src/styles/saved.css` (`flex-wrap: wrap` on header, safe-area insets)
- `frontend/tests/saved.focus.test.tsx` (mount focus verification on SavedDiagrams and Correct)
- `frontend/tests/saved.lab.test.tsx` (CSS assertions for BUG-05 and BUG-06)
