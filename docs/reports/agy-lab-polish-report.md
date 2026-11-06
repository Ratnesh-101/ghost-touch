# Lane Report: lab-polish (Visual Fixes for Start on Phones & Capture Labels)

**Tool:** Antigravity (agy)  
**Date:** 2026-11-06  
**Briefs:** `docs/briefs/lab-spec.md` and `docs/briefs/agy-lab-polish.md`  

---

## 1. Problem Diagnosis & Root Causes

### Problem 1: Start Logo Wordmark Missing at 390px
- **Symptom:** At 1440px desktop width, the full Logo variant (including the "Ghost Touch" wordmark) rendered correctly above the mascot emblem. At 390px mobile viewport, the mascot emblem appeared at the very top of the screen and the Logo wordmark was invisible.
- **Root Cause Analysis:**
  1. `.gt-start__hero` is a vertical flex container (`display: flex; flex-direction: column`).
  2. Inside `.gt-start__hero`, the full Logo was rendered as an SVG element with class `.gt-start__logo` having CSS properties:
     ```css
     .gt-start__logo {
       max-width: 100%;
       width: min(340px, 85vw);
       height: auto;
       display: block;
     }
     ```
  3. By default in CSS Flexbox layout, child elements have `flex-shrink: 1`. An SVG element without an explicit CSS `aspect-ratio` or `flex-shrink: 0` has an intrinsic min-height of `0` in Chromium/Blink.
  4. On wide viewports (1440x900), the organ cards sat in a 3-column row, taking ~120px height; total content height (~500px) was well below the 900px viewport, so no flex shrinking occurred.
  5. On narrow viewports (<= 640px), the 3 organ cards stacked vertically. Due to a cascade override bug (see Problem 2 below), the cards were tall column cards (~120px each = 360px+). Total hero content height exceeded 844px.
  6. The mascot emblem (`.gt-start__creature-emblem`) explicitly had `flex-shrink: 0;`, and all other items had text content that enforced minimum content heights.
  7. Consequently, Chromium's flexbox algorithm applied all shrink pressure directly to `.gt-start__logo`, collapsing its rendered height down to `0px`.
  8. With height collapsed to 0, the Logo became invisible, making the Mascot emblem the first visible element on screen.
- **Solution:**
  - Added `aspect-ratio: 340 / 80;` and `flex-shrink: 0;` to `.gt-start__logo` in `frontend/src/styles/global.css`.
  - Added `@media (max-width: 640px)` hero rhythm compacting gaps and paddings so the entire hero naturally fits on mobile viewports.
  - Verified across 320px, 360px, 390px, 430px widths and at 200% zoom.

### Problem 2: Start Organ Tiles Tall Stacked Cards Pushing CTA off 390x844
- **Symptom:** At 390x844, the three organ tiles were tall stacked cards pushing the "Wake the creature" CTA button to the bottom screen edge or off-screen.
- **Root Cause Analysis:**
  1. In `frontend/src/styles/start.css`, the `@media (max-width: 640px)` block was placed **above** the base `.gt-organ-tile` rule (lines 28-49 vs line 52).
  2. Because both rules possessed identical selector specificity (`.gt-organ-tile`), CSS source order dictates that the later rule wins. The base rule declared `flex-direction: column; text-align: center; padding: var(--gt-space-lg, 20px) var(--gt-space-md, 16px);`.
  3. This completely overrode `flex-direction: row;` from the media query, keeping each organ tile laid out vertically as a tall column card.
  4. Furthermore, the icon wrapper was 44x44px and tile padding was 16px top and bottom, so even with horizontal layout it would have been ~76-90px tall.
- **Solution:**
  - Moved the `@media (max-width: 640px)` block to the end of `frontend/src/styles/start.css` (after all base tile, icon, rivet, content, title, and line rules), fixing the cascade.
  - In `@media (max-width: 640px)`, laid out each tile horizontally (`flex-direction: row; text-align: left; align-items: center; gap: var(--gt-space-sm, 12px);`).
  - Configured a compact row height: `min-height: 64px; height: auto; padding: var(--gt-space-xs, 8px) var(--gt-space-md, 16px);`.
  - Adjusted icon badge to 38x38px with 24x24px SVG icon.
  - Kept natural multiline text wrapping (`overflow-wrap: break-word; white-space: normal;`), so longer Hindi ("रेखाओं और कोनों को कंपन के रूप में महसूस करें") and Gujarati ("રેખાઓ અને ખૂણાઓને વાઇબ્રેશન તરીકે અનુભવો") descriptions wrap and expand the tile height smoothly without clipping.
  - Retained the spacious 3-column layout on wide screens (> 640px).

### Problem 3: Capture Specimen Card Labels Were Tiny (~11px)
- **Symptom:** Sample diagram button labels ("Right triangle", "Sine wave", "Bar chart") were tiny (~11px), difficult to read for low-vision users.
- **Root Cause Analysis:**
  1. `.gt-capture__sample-btn` and `.gt-capture__sample-name` in `frontend/src/styles/global.css` declared `font-size: var(--gt-text-xs);` (0.75rem / 12px at standard root).
  2. In the narrow-screen media query `@media (max-width: 380px)`, `.gt-capture__sample-btn` had an explicit rule `font-size: 0.72rem;` (~11.5px).
- **Solution:**
  - In `global.css`, upgraded `.gt-capture__sample-name` to `font-size: var(--gt-text-sm, 0.875rem); line-height: var(--gt-line-height-normal, 1.4);`.
  - In `global.css`, upgraded `.gt-capture__sample-btn` to `font-size: var(--gt-text-sm, 0.875rem); line-height: var(--gt-line-height-normal, 1.4);`.
  - In `@media (max-width: 380px)`, replaced `font-size: 0.72rem;` with `font-size: var(--gt-text-sm, 0.875rem);`.
  - Preserved minimum 48px touch targets (`min-height: 108px; min-width: var(--gt-target);`).
  - Added `white-space: normal; overflow-wrap: break-word; max-width: 100%;` to allow Hindi and Gujarati specimen labels ("સમકોણ ત્રિકોણ", "સ્તંભ આલેખ") to wrap comfortably.

### Problem 4: Contract Preservation
- Zero changes to accessible names, spoken strings, handlers, flow, routing, or core business logic.
- All colors derived strictly from design tokens (`var(--gt-...)`). Zero hardcoded hex, rgb, or named colors introduced.

---

## 2. Diff Stat

```
 frontend/src/styles/global.css      | 56 ++++++++++++++++++++++++--
 frontend/src/styles/start.css       | 78 +++++++++++++++++++++++++------------
 frontend/tests/capture.lab.test.tsx | 12 ++++++
 frontend/tests/polish.start.test.tsx| 228 ++++++++++++++++++++++++++++++++++++
 frontend/tests/start.lab.test.tsx   | 38 +++++++++++++++++++
 docs/BUILD_LOG.md                   | 21 ++++++++++
 6 files changed, 405 insertions(+), 28 deletions(-)
```

---

## 3. Definition of Done & Verification Proof

### Command 1: Type Checking
```bash
npm --prefix frontend exec -- tsc -p frontend --noEmit
```
**Exit Code:** 0  
**Result:** Clean (0 errors).

### Command 2: Test Suite
```bash
npm --prefix frontend test
```
**Exit Code:** 0  
**Result:**
```
Test Files  60 passed (60)
     Tests  854 passed (854)
  Duration  839ms
```
- Includes 12 new dedicated tests in `frontend/tests/polish.start.test.tsx`.
- Includes 3 extended assertions in `frontend/tests/start.lab.test.tsx`.
- Includes 2 extended assertions in `frontend/tests/capture.lab.test.tsx`.
- Zero regressions across existing test suite.

### Command 3: Production Build & Reachable CSS
```bash
npm --prefix frontend run build
```
**Exit Code:** 0  
**Output:**
```
dist/assets/index-BomJQHoP.css       59.86 kB │ gzip: 9.43 kB
dist/assets/index-CiU4DLhy.js       359.46 kB │ gzip: 106.56 kB
PWA v2.0.0 precache: 22 entries (498.59 KiB)
```
**Reachable CSS Verification:**
Confirmed presence of new rules in `frontend/dist/assets/index-BomJQHoP.css`:
- `.gt-start__logo{aspect-ratio:340/80;width:min(340px,85vw);max-width:100%;height:auto;filter:drop-shadow(0 0 12px var(--gt-green-glow));transition:filter var(--gt-transition-normal), transform var(--gt-transition-normal);flex-shrink:0;display:block}`
- `@media (width<=640px){.gt-organ-tiles{gap:var(--gt-space-xs,8px);grid-template-columns:1fr}.gt-organ-tile{text-align:left;align-items:center;gap:var(--gt-space-sm,12px);padding:var(--gt-space-xs,8px) var(--gt-space-md,16px);flex-direction:row;height:auto;min-height:64px}...}`
- `.gt-capture__sample-name{font-family:var(--gt-font-sans);font-size:var(--gt-text-sm,.875rem);line-height:var(--gt-line-height-normal,1.4);color:var(--gt-text-secondary);word-break:normal;overflow-wrap:break-word;white-space:normal;max-width:100%;display:block}`
- `@media (width<=380px){.gt-capture__sample-btn{font-size:var(--gt-text-sm,.875rem);padding:8px 4px}}`

---

## 4. Commit Groups

Ordered logical commits for integration:

### Commit 1: Start screen narrow viewport layout & Logo anti-collapse
```
fix(start): prevent Logo flex-shrink collapse and lay out organ tiles horizontally on narrow screens

- Add flex-shrink: 0 and aspect-ratio: 340 / 80 to .gt-start__logo in global.css to prevent height collapse on narrow viewports
- Relocate @media (max-width: 640px) block to end of start.css to fix CSS cascade override
- Lay out .gt-organ-tile horizontally in a compact row (min-height: 64px, padding: 8px 16px, icon: 38px)
- Add narrow-screen hero compacting rhythm in global.css to ensure 390x844 Start screen fits without scrolling
- Preserve natural multiline text wrapping for Hindi and Gujarati translations and top-origin 200% zoom scrolling

Files:
  frontend/src/styles/global.css
  frontend/src/styles/start.css
```

### Commit 2: Capture specimen jar labels font size & touch targets
```
style(capture): enlarge sample card labels to at least 0.875rem with comfortable line-height

- Update .gt-capture__sample-name and .gt-capture__sample-btn to font-size: var(--gt-text-sm, 0.875rem)
- Set comfortable line-height of 1.4 on specimen labels with natural text wrapping
- Replace 0.72rem font size in @media (max-width: 380px) with var(--gt-text-sm, 0.875rem)
- Maintain minimum 48px touch targets (min-height: 108px)

Files:
  frontend/src/styles/global.css
```

### Commit 3: Polish test suite and lab tests extension
```
test(lab): add visual polish verification test suite and extend start/capture lab tests

- Add frontend/tests/polish.start.test.tsx covering logo anti-collapse, organ tile horizontal layout, cascade order, specimen label sizing, and design tokens
- Extend frontend/tests/start.lab.test.tsx with logo aspect-ratio, mobile rhythm, and row layout checks
- Extend frontend/tests/capture.lab.test.tsx with specimen label font-size and multiline wrapping checks
- Update docs/BUILD_LOG.md with build entry

Files:
  frontend/tests/polish.start.test.tsx
  frontend/tests/start.lab.test.tsx
  frontend/tests/capture.lab.test.tsx
  docs/BUILD_LOG.md
  docs/reports/agy-lab-polish-report.md
```
