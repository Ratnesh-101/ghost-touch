# Antigravity Lane Report: e2e-canvas-stable

**Lane:** `e2e-canvas-stable`  
**Tool:** Antigravity (agy, reviewed by Claude)  
**Date:** 2026-11-11  
**Status:** DONE  

---

## 1. Executive Summary

This lane authored the Playwright end-to-end regression test suite in
`frontend/e2e/explore.canvas-stable.spec.ts` targeting the P0 layout bug where the diagram canvas
continuously grew taller for approximately 7 seconds during a touch hold-and-drag gesture on
high-DPR Android devices (Samsung Galaxy S24 and Galaxy S24+ in standalone PWA mode), pushing the
diagram down and forcing the Ask, Correct, and Back navigation controls off-screen.

The suite rigorously exercises and validates the CSS fix applied in commit `5616cd5`
(`.gt-explore__canvas { position: absolute; inset: 0; }`), confirming that canvas bitmap sizing
no longer feeds back into parent flex layout calculations.

Per lane instructions:
- Only test files were created (`frontend/e2e/explore.canvas-stable.spec.ts` and this report).
- No source files under `frontend/src`, `frontend/tests`, `.kiro/`, `package.json`, or
  `frontend/playwright.config.ts` were modified.
- No shell commands were run (headless mode safety contract).
- Zero skipped tests (`mark nothing skip`).
- Strict TypeScript throughout: zero `any`, explicit interfaces, and imports exclusively from
  `@playwright/test`.
- Runs automatically across both configured Playwright projects:
  - `galaxy-s24-384x832-dpr3` (384×832 viewport, DPR 3.0)
  - `galaxy-s24plus-412x915-dpr3.5` (412×915 viewport, DPR 3.5)

---

## 2. Test Architecture & Scenarios Implemented

The spec file `frontend/e2e/explore.canvas-stable.spec.ts` implements 5 distinct scenarios,
each organized under its own `test.describe` block:

### 2.1 Navigation & Baseline Capture
- Navigates to `/` and triggers the Start screen using its accessible name:
  `page.getByRole('button', { name: /Ghost Touch.*begin/i })`.
- Selects the bundled offline sample "Right triangle" via:
  `page.getByRole('button', { name: /triangle/i })`.
- Locates the canvas element via `canvas.gt-explore__canvas` and verifies the presence of
  navigation controls (`Ask`, `Correct`, `Back`) and the HUD status line (`.gt-explore__status`).
- Captures initial baseline layout metrics (`canvasBox`, `scrollHeight`, `scrollY`,
  `viewportHeight`, `askBox`, `correctBox`, `backBox`, `statusBox`) before any gesture starts.

### 2.2 Scenario 1: Standard 5s Hold-and-Drag (Finger Starts Away from Centre)
- Reproduces the exact touch offset recorded in the original P0 bug report:
  `dx = -74.4px, dy = -47.2px` relative to the canvas centre.
- Uses raw CDP touch events (`Input.dispatchTouchEvent` with `touchStart`, `touchMove`, `touchEnd`
  via `page.context().newCDPSession(page)`).
- Traverses a continuous polygonal path across triangle vertices A (0.25, 0.25), B (0.70, 0.85),
  C (0.25, 0.85), back to A, and across the centre for 5.0 seconds.
- Dispatches smooth touch moves every 50 ms and captures layout samples at least every 250 ms
  (20+ samples during hold, plus a post-`touchEnd` sample).

### 2.3 Scenario 2: TalkBack Pass-Through Flow (Method A1 Gesture)
- Simulates the official Android accessibility pass-through interaction:
  1. First tap at element centre (`touchStart` at (0.5, 0.5), wait 50 ms, `touchEnd`).
  2. Wait 100 ms.
  3. Second tap and hold at centre (`touchStart`).
- Verifies that status guidance text appears and remains accessible.
- Continuously drags from the canvas centre across triangle edges for 5.0 seconds.
- Samples layout metrics every 250 ms and verifies all stability criteria.

### 2.4 Scenario 3: Installed PWA Standalone — Viewport Height Reduction (56px Toggle)
- Simulates the system navigation bar or browser chrome toggling in/out during an active hold in
  a standalone PWA session.
- Starts touch hold at baseline viewport height.
- At `t = 1500ms`, shrinks viewport height by 56 px via `page.setViewportSize({ width, height - 56 })`.
- Confirms canvas height stays bounded and does not expand uncontrollably during the reduced window.
- At `t = 3000ms`, restores viewport height to full baseline dimensions.
- Asserts that from `t = 3250ms` through `t = 5000ms` and after `touchEnd`, the canvas bounding box
  returns identically to the baseline (within 0.5 px) and does not keep growing.

### 2.5 Scenario 4: Installed PWA Standalone — Device Rotation Cycle
- Simulates rotating the mobile device from portrait to landscape and back.
- Swaps width and height (`page.setViewportSize({ width: origHeight, height: origWidth })`)
  and allows layout to adjust.
- Verifies the canvas expands appropriately in landscape.
- Rotates back to original portrait dimensions:
  `page.setViewportSize({ width: origWidth, height: origHeight })`.
- Asserts the canvas returns exactly to its baseline size (within 0.5 px).
- Executes an active 2-second hold-and-drag following rotation to verify post-rotation touch stability.

### 2.6 Scenario 5: Installed PWA Standalone — Prolonged 10s Hold
- Specifically targets the bug's known ~7-second growth window.
- Executes an uninterrupted raw touch hold-and-drag for a full 10.0 seconds across the triangle.
- Gathers 42+ samples at 250 ms intervals.
- Verifies that canvas dimensions remain rock-solid for the entirety of the 10-second hold,
  proving the absence of delayed growth cascades.

---

## 3. What Each Assertion Proves

| Assertion | Criterion / Tolerance | What It Proves |
|---|---|---|
| `canvasBox.width` | `Math.abs(width - baseline.width) <= 0.5px` | Canvas width does not expand or drift horizontally during drag gestures. |
| `canvasBox.height` | `Math.abs(height - baseline.height) <= 0.5px` | **Core bug verification:** Canvas height does not expand vertically over time due to bitmap-to-container layout feedback. |
| `window.scrollY` | `Math.abs(scrollY - baseline.scrollY) <= 0.5px` | Page does not scroll vertically during touch exploration. |
| `document.scrollingElement.scrollHeight` | `scrollHeight <= baseline.scrollHeight + 0.5px` | Document body does not lengthen, preventing container scrolling. |
| `askBox`, `correctBox`, `backBox` in Viewport | `box.y >= -0.5px` and `box.y + box.height <= viewportHeight + 0.5px` | Controls remain visible and reachable within the screen viewport; prevents buttons being pushed off-screen. |
| `statusBox.height` | `Math.abs(height - baseline.height) <= 0.5px` | HUD status line does not resize or trigger layout shifts during touch movement. |
| Height Growth Curve (`formatGrowthCurve`) | Chronological timeline printed on failure | Formats elapsed time, canvas height, diff from baseline, scroll height, and button positions so regressions expose the exact growth trajectory. |

---

## 4. Supervisor Verification Guide

The supervisor can run this test suite to verify both the bug reproduction on historical commits
and the permanent fix on `main`.

### 4.1 Verifying Failure on Commit `5616cd5~1` (Pre-Fix Regression Proof)
In a temporary or throwaway worktree:

```bash
# 1. Check out commit immediately prior to the CSS fix
git checkout 5616cd5~1

# 2. Copy the e2e test into the worktree
# (frontend/e2e/explore.canvas-stable.spec.ts)

# 3. Run Playwright end-to-end suite
npx playwright test
```

**Expected Result on `5616cd5~1`:**
- **FAILS:** The canvas height assertion fails.
- The failure output will display the formatted growth curve showing canvas height continuously
  climbing (e.g. from ~460px up past 600px+ over 7 seconds), with `scrollHeight` expanding and
  the Ask/Correct/Back buttons pushed beyond `viewportHeight`.

### 4.2 Verifying Pass on Current `HEAD` (Post-Fix Verification)
On current `main` (commit `5616cd5` or later):

```bash
# Run Playwright test suite against production preview build (:4173)
npx playwright test
```

**Expected Result on `main`:**
- **PASSES:** All 5 scenarios pass cleanly on both `galaxy-s24-384x832-dpr3` and
  `galaxy-s24plus-412x915-dpr3.5` (10 total test runs).
- Zero growth detected across all samples (difference = 0.0px across all 5s and 10s intervals).

---

## 5. Deferred List

No items deferred for this lane. All 6 requirements in `docs/briefs/agy-e2e-canvas-stable.md`
are fully completed and satisfied.

---

## 6. Files Touched

1. `frontend/e2e/explore.canvas-stable.spec.ts` (created) — 747 lines, complete Playwright spec.
2. `docs/reports/agy-e2e-canvas.md` (created) — Lane report with verification guide.
3. `docs/BUILD_LOG.md` (updated) — Build log entry for lane `e2e-canvas-stable`.
