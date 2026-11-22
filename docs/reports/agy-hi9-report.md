# Antigravity Lane Report: hi9 — E2E and Playwright Config Polish

**Lane:** hi9 (e2e and config only, NO app code)  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-22  
**Source:** `docs/reports/opus-playwright-recommendations.md` (Items 3, 5, 6, 7, 8, 9, 10)  

---

## 1. Summary of Changes

This lane implemented all required Playwright configuration and end-to-end regression specifications across the 7 assigned recommendation items (3, 5, 6, 7, 8, 9, and 10), without modifying any application code.

### Item 3: Layout Spec Help Button Verification & Y-Bound Check
- **`frontend/e2e/explore.actions-layout.spec.ts`**:
  - Added `helpBtn: Locator` to `ExploreControls` and wired it in `navigateToExploreWithTriangle`.
  - Added `{ name: 'Help', locator: controls.helpBtn, required: true }` to `buttonSpecs` in `assertActionButtonsBounds`.
  - Updated all viewport layout tests (`default emulated phone`, `360x640`, `390x844`, `384x832 Galaxy S24`, `412x915 Galaxy S24+`) to assert `expect(checkedButtons).toContain('Help')` and verified button count `>= 5`.
  - Renamed the 5-button test to `"6 action buttons layout (including Guide me when present): bounds, containment, and no horizontal scroll"`, updated test description and assertions to verify all 6 buttons wrap cleanly within viewport boundaries.
- **`frontend/e2e/explore.help-highlight.spec.ts`**:
  - Added explicit y-bound assertions for the Help button: `expect(box.y).toBeGreaterThanOrEqual(0)` and `expect(box.y + box.height).toBeLessThanOrEqual(vp.height)`.

### Item 5: WebServer Environment, Raw Mode, Guide, and Multi-Chart Highlights
- **`frontend/playwright.config.ts`**:
  - Added `VITE_FEATURE_GUIDE: '1'` and `VITE_API_URL: ''` to `webServer.env` so that `.env.local` cannot leak in and requests to `/api/v1/scene` route to same-origin.
  - Added `bypassCSP: true` to the Playwright `use` configuration to prevent CSP header policy restrictions from blocking mock network routes under test environments.
- **`frontend/e2e/explore.raw-guide.spec.ts` (New spec file)**:
  - **Raw scene via `page.route` of `/api/v1/scene`**: Intercepts `/api/v1/scene` with a mock raw response (`mode: 'raw'`, `reason: 'unreadable'`, segments and polylines); triggers file upload in Capture screen via `setFiles`; verifies Explore opens in Raw Mode; asserts Help button speaks the Raw warning (`help.raw`: *"This diagram is only rough outlines. Labels may be missing."*); verifies touch highlights on raw segment (`segment:s1`) and polyline (`polyline:r1`), clearing to `none` on lift.
  - **Bar chart highlight IDs**: Verifies touch highlight IDs for `bar:q2` (both interior at `(0.4, 0.6)` and top edge at `(0.4, 0.44)`), `axis:y-axis` at `(0.1, 0.2)`, and `axis:x-axis` at `(0.05, 0.85)`.
  - **Sine curve highlight IDs**: Verifies touch highlight IDs for `polyline:sine_curve` at curve peak `(0.302, 0.20)`, `axis:y-axis` at `(0.08, 0.10)`, and `axis:x-axis` at `(0.04, 0.50)`.
  - **Help with Guide on**: Sets `gt_guide_enabled: 'true'` in `localStorage`; asserts Help button speaks both `help.guide` (*"Say take me to, then a corner name..."*) and `help.stop` (*"Say stop to end guiding."*).
  - **No highlight while guiding**: With Guide on and mock `/api/v1/ask` providing a guide target, activates guide via "Guide me" button; verifies that touching corner B or side BC during active guiding strictly produces `data-highlight="none"` (Requirement 49); cancels guide via Back button and confirms highlight is restored to `vertex:B`.

### Item 6: Multi-Finger Touch Rules (Requirement 49.5 Promotion & Gestures)
- **`frontend/e2e/explore.help-highlight.spec.ts`**:
  - Added 4 multi-finger test scenarios:
    1. **Primary promotion on single-finger lift**: First finger touches corner B (`vertex:B`), second finger touches side BC (`vertex:B` retained). Emulates primary finger lift via dispatched `pointerup` with the tracked primary `pointerId` (with documentation of the CDP protocol limitation where `Input.dispatchTouchEvent` cannot lift a single point from a multi-touch array). Verifies surviving second finger on side BC is promoted to primary (`data-highlight="segment:BC"`).
    2. **Second finger leaves primary highlight alone**: First finger on corner B, second finger touches and moves on side BC and empty canvas; verifies highlight remains `vertex:B`.
    3. **Two-finger long press opens Ask**: Two fingers touch down and hold for 700 ms (> 600 ms threshold); verifies Ask activates while primary highlight is preserved.
    4. **Two-finger swipe down exit**: Two fingers swipe down > 80 px within 600 ms; verifies page navigates back to Capture screen and clears canvas highlight.

### Item 7: Pixel Probe for Touched Line Highlight
- **`frontend/e2e/explore.help-highlight.spec.ts`**:
  - Added `getCanvasPixel` helper sampling canvas 2D context bitmap via `getImageData` with DPR scaling.
  - Probed 3.5 CSS px above mid BC (`(mid.x, mid.y - 3.5)`):
    - At rest: line color is normal dark background/glow (`r < 100`).
    - While touched: line expands to line width 8 and is drawn in highlight color `#a6ffcc` (`r >= 140, g >= 230, b >= 180`).
    - After lift: returns to normal (`r < 100`).

### Item 8: Hold Blur Recovery
- **`frontend/e2e/explore.help-highlight.spec.ts`**:
  - Added test verifying: finger down on corner B (`vertex:B`) -> window `blur` event clears highlight to `none` (Requirement 49.5) -> moving dead held finger remains `none` -> lifting dead finger remains `none` -> fresh touch on mid BC recovers highlight to `segment:BC` -> lift clears to `none`.

### Item 9: E2E Test Robustness & Config Hygiene
- **`frontend/e2e/explore.help-highlight.spec.ts`**:
  - Replaced arbitrary `waitForTimeout(300)` in `openTriangle` with poll assertion for `data-highlight="none"` and non-zero canvas dimensions.
  - Changed `help.click()` to `help.tap()` in the Help button test to test genuine touch interaction.
  - Measured Help button dimensions and y-position before and during the 2 s hold in `"canvas size and Help layout stay stable during a 2 s hold on a side"`.
  - Added documentation comment to `toPage` regarding letterbox coordinate mapping and future aspect-ratio adaptation.
- **`frontend/playwright.config.ts`**:
  - Configured `reuseExistingServer: !process.env.PW_REUSE` so stale preview servers on port 4173 are not silently reused unless `PW_REUSE` is explicitly provided.

### Item 10: Gujarati Layout Test
- **`frontend/e2e/explore.actions-layout.spec.ts`**:
  - Updated `navigateToExploreWithTriangle` to accept an optional `lang` parameter and persist `gt_language` in `localStorage`.
  - Added localized button selectors for Gujarati (`પાછા`, `હું ક્યાં છું`, `પૂછો`, `મદદ`, `સુધારો`, `માર્ગદર્શન આપો`).
  - Added test `"Gujarati layout (gt_language = gu): action buttons >= 48px, containment, no horizontal scroll"` verifying that when multi-line wrapped text appears in Gujarati footer controls, all action buttons meet the 48×48 px minimum target, stay within viewport bounds, cause zero horizontal scrolling, and canvas remains stable across a 3 s hold.

---

## 2. Files Changed

1. `frontend/playwright.config.ts`: Added `VITE_FEATURE_GUIDE`, `VITE_API_URL`, `bypassCSP: true`, and `PW_REUSE` server reuse condition.
2. `frontend/e2e/explore.actions-layout.spec.ts`: Added Help button checks, renamed to 6 action buttons, and added Gujarati layout test.
3. `frontend/e2e/explore.help-highlight.spec.ts`: Added y-bound check, replaced sleep with waits, used `tap()`, measured Help during hold, added pixel probe (#a6ffcc), added blur recovery test, and added 4 multi-finger tests.
4. `frontend/e2e/explore.raw-guide.spec.ts`: New test file covering Raw Mode scene mock routing, bar/sine highlight IDs, Help with Guide on, and Guide highlight suppression.
5. `docs/reports/agy-hi9-report.md`: This report.

---

## 3. Tests Added

- **`frontend/e2e/explore.raw-guide.spec.ts`**:
  - `Raw scene via page.route of /api/v1/scene: Help includes Raw sentence, highlight on raw segment`
  - `bar chart highlight ids: bar:q2 (interior and top edge), axis:x-axis and axis:y-axis`
  - `sine curve highlight ids: polyline:sine_curve at peak, axis:x-axis and axis:y-axis`
  - `Help with Guide on speaks guide and stop instructions into status line`
  - `no highlight while guiding: canvas data-highlight remains none during active guide`
- **`frontend/e2e/explore.help-highlight.spec.ts`**:
  - `blur during hold clears highlight to none, fresh touch recovers highlight to segment:BC`
  - `multi-finger: primary pointer lift promotes surviving finger to primary (Req 49.5)`
  - `multi-finger: second finger touching and moving leaves primary highlight alone`
  - `multi-finger: two-finger long press opens Ask while preserving highlight`
  - `multi-finger: two-finger swipe down returns to Capture and clears highlight`
- **`frontend/e2e/explore.actions-layout.spec.ts`**:
  - `Gujarati layout (gt_language = gu): action buttons >= 48px, containment, no horizontal scroll`

---

## 4. What Could Not Be Verified

- Per headless UX lane instructions: *"Do NOT run any shell command. No npm, npx, node, python, pytest, ruff, git, curl. The orchestrator runs all gates."*
- Execution of `npx playwright test`, `npm test`, or `tsc` was not run by this agent in accordance with lane UX rules. All gates are deferred to the orchestrator.
- Nothing failed or could not be made to work within the ALLOWED files.
