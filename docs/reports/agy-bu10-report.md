# Lane bu10 Report: TalkBack Testing Documentation Correction

**Task**: Correct and adopt TalkBack testing documentation (`docs/accessibility/TALKBACK_PHONE_TESTING.md`) from outside PR 36 (contributor `drv653`), verifying every claim against `frontend/src` and docs.  
**Lane**: `bu10`  
**Tool**: Antigravity (`agy`)  
**Files Modified**:
- `docs/accessibility/TALKBACK_PHONE_TESTING.md`
- `docs/reports/agy-bu10-report.md`

---

## 1. Summary of Corrections Against the Code

The untrusted submission in PR 36 was reviewed (`gt-pr36-verdict.md`) and verified against the Ghost Touch codebase. All erroneous and stale statements were corrected while preserving the document's structure:

### Error 1: Curve Segmentation Falsehood (PR 36 Review High Finding)
- **Original Claim**: Line ~37 claimed that complex curves with hundreds of points are partitioned into representative segments or key extrema for TalkBack.
- **Code Verification**: In `frontend/src/flow/a11yFeatures.ts` (lines 117–138), `scene.polylines` does **not** perform curve segmentation or extrema extraction. Each polyline produces a single `A11yFeature` button with a single bounding box (`boxOf(xs, ys)`), an average normalized y-pitch (`yNorm`), and label `tf('a11y.curve', { name })`.
- **Correction Applied**: Updated the documentation to explicitly state that each curve emits a single accessible feature button representing the entire polyline. Tree complexity is controlled by the `MAX_A11Y_FEATURES = 60` quota distributing focusable elements across points, segments, bars, polylines, and axes.

### Error 2: Pointer-Events Inaccuracy (PR 36 Review Medium Finding)
- **Original Claim**: Line ~18 claimed that child interactive buttons retain `pointer-events: auto` during accessibility traversal.
- **Code Verification**: In `frontend/src/styles/explore.css` (lines 752–773), both `.gt-explore__a11y-tree` and `.gt-explore__a11y-item` explicitly have `pointer-events: none` permanently set in CSS. Touches pass directly through to the canvas underneath without blocking touch interaction. TalkBack operates on the Android accessibility node hierarchy (accessibility tree) and does not require `pointer-events: auto`.
- **Correction Applied**: Clarified that both container and item buttons have `pointer-events: none` permanently, allowing direct touches to reach the canvas while TalkBack navigates the semantic DOM tree.

### Attribution Banner
- Added the required header banner at the top of `docs/accessibility/TALKBACK_PHONE_TESTING.md`:
  `> Adapted from PR 36 by drv653 and corrected against the code.`

---

## 2. Comprehensive Codebase Verification

Every other claim and interaction model detail was cross-referenced with `frontend/src`:

1. **Overview Speech on Screen Entry (Lane A2)**:
   - Verified against `frontend/src/flow/navigation.ts` (`exploreAnnouncement`) and `frontend/src/flow/overview.ts` (`buildOverview`).
   - Documented the exact summary spoken upon entering Explore (title, corner/side counts, coarse positions for up to 6 corners, curve counts, axis locations, bar counts and labels, or raw outline notice), followed by the gesture reminder and verification caveat.

2. **Explore Screen UI Controls**:
   - Verified against `frontend/src/screens/Explore.tsx`:
     - Header: `SettingsLauncher` button ("Settings: English, 1.0×") opening `LabSettings`.
     - Footer: "Where am I" accessible button (`explore.whereAmI`, `data-testid="explore-where-am-i"`, min 48×48 px touch target) speaking relative position, "Ask" button (`ask.button`), "Guide me" button (`ask.guideMe`), "Correct" button (`explore.correct`), and "Back" button (`common.back`).

3. **Lab Settings & Vibration Help Card**:
   - Verified against `frontend/src/components/LabSettings.tsx` and `frontend/src/i18n/index.ts`:
     - Section title: "Device Vibration Settings" (`lab.settings.vibrationHelpTitle`).
     - Samsung One UI: Settings > Sounds and vibration > Vibration intensity > turn on Touch feedback. Turn off Power Saving Mode.
     - Stock Android / Pixel: Settings > Sound & vibration > Vibration & haptics > turn on Touch feedback.
     - OnePlus OxygenOS: Settings > Sound & vibration > Haptics > turn vibration on.
     - Xiaomi HyperOS: Settings > Sound & vibration > turn on Haptic feedback and Vibrate on touch.

4. **Vibration HAL Fallback**:
   - Verified against `frontend/src/drivers/haptics.ts` (`WebHapticDriver.vibrate` and `fallbackPulse`):
     - Correctly sums active pulses (`i % 2 === 0`) and clamps to `MIN_FALLBACK_PULSE_MS = 100` ms when array vibration returns `false` or throws on Samsung/OnePlus devices.
     - `FallbackHapticDriver` translates vibrations into audio buzzes when `navigator.vibrate` is unavailable.

---

## 3. New Assistive Cues Section

Added a dedicated section documenting recent assistive features, including an honest note regarding physical device testing:

1. **Directions Switch (Lane A3)**:
   - Lab Settings toggle switch (`lab.settings.directions`, default enabled).
   - Corner compass exit speech (8-way directions to adjacent vertices) and line dwell names after 1200 ms (`LINE_DWELL_MS`).
2. **Finding Sound Switch (Lane A4)**:
   - Lab Settings toggle switch (`lab.settings.findingSound`, default enabled).
   - Audio proximity clicks within `radiusPx = 48` px (frequency 400 ms -> 90 ms, pitch 500 Hz -> 1200 Hz, gain 0.3 -> 0.6, stereo panned).
3. **Hold Keep-Alive Timer (Lane GT-08)**:
   - `createHoldKeepAliveTimer` in `frontend/src/flow/explore.ts` with `KEEP_ALIVE_INTERVAL_MS = 60` ms.
   - Prevents haptic and tone cutoffs during stationary finger holds on touchscreen canvas.
4. **Graph Scan Switch (Lane A6)**:
   - Lab Settings toggle switch (`lab.settings.graphScan`, default enabled) providing curve pitch guidance at 0.33 gain across the diagram.
5. **Where Am I Dwell Detection (Lane A5)**:
   - `checkWhereAmIDwell` in `frontend/src/flow/explore.ts` auto-announcing nearest feature when dwelling in open space for 1200 ms with < 6 px movement.
6. **Honest Testing Note**:
   - Included clear note that while these cues are implemented in pure core/flow modules and verified via unit tests, they have not yet been evaluated on physical Android phones under TalkBack.

---

## 4. Run Constraints Compliance

- **No shell commands executed**: All verification performed via read operations only.
- **No environment files accessed**: No `.env*` files opened, printed, or searched.
- **File boundary compliance**: Edits strictly confined to `docs/accessibility/TALKBACK_PHONE_TESTING.md` and `docs/reports/agy-bu10-report.md`.
