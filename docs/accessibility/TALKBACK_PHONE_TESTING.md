# TalkBack Phone Testing & Platform Limitations (Android)

> Adapted from PR 36 by drv653 and corrected against the code.

## Overview
This document records the architectural integration, physical testing procedures, platform limitations, and recent haptic/audio cues for Ghost Touch when running with Android TalkBack enabled.

When a student or teacher opens the Explore screen, Ghost Touch immediately delivers an automated verbal overview via `exploreAnnouncement` (built by `buildOverview` in `frontend/src/flow/overview.ts`):
- **Geometry**: Diagram title, count of corners and sides, and coarse positions for up to 6 labelled corners (e.g., "Corner A top left, B bottom right").
- **Function Graph**: Diagram title, curve count, and axis locations (e.g., "x-axis at bottom, y-axis at left").
- **Bar Chart**: Diagram title, bar count, and bar labels listed from left to right.
- **Raw Mode / Unknown**: Spoken notification indicating the diagram could not be fully parsed and only tactile outlines can be felt.
- **Guidance & Caveats**: Followed immediately by the exploration gesture prompt ("Double-tap and hold, then drag to feel the diagram. Press Back to leave.") and any verification caveat if diagram geometry and facts disagree.

---

## Architecture: Dual-Layer Interaction Model

Ghost Touch provides a dual-layer interaction model designed to support both blind students using TalkBack screen reader exploration and low-vision or sighted users interacting through direct touch.

### 1. Direct Touch Mode (TalkBack OFF)
- When TalkBack is disabled, single-finger touch and drag gestures interact directly with the HTML5 `<canvas>`.
- Touch down sets an initial reference anchor; subsequent movements shift the relative cursor across the diagram.
- Pointer movements trigger low-latency audio tones (Web Audio API synth) and tactile haptic vibration (`navigator.vibrate`) via `hapticEngine.ts` and `explore.ts`:
  - **Vertices / Corners**: Line buzz (80 ms) + corner vibration pulse (`[50, 90, 50]` ms) + corner name speech, followed by a 450 ms quiet window suppressing subsequent line buzzes.
  - **Edges / Lines / Axes**: Tactile line buzz (80 ms).
  - **Bar Chart Columns**: 80 ms line buzz + pitch mapped to bar height + spoken value.
  - **Function Curves**: Continuous synthesized audio tone mapped to the curve's normalized vertical coordinate (`pitchForY`).
  - **Centre Reference**: Crossing the canvas center triggers a tactile tick pulse and speaks "Centre." on initial hold.
- **Touch Gestures (TalkBack OFF)**:
  - **Single-finger drag**: Continuous canvas exploration.
  - **Stationary hold on a line**: Triggers the hold keep-alive timer (every 60 ms) so line vibration does not stall, and if Directions is enabled, speaks the line name and endpoints after a 1200 ms dwell.
  - **Resting in open space**: Stationary dwell (< 6 px movement) for 1200 ms on empty canvas space automatically speaks a "Where am I" announcement describing the nearest diagram feature.
  - **Two-finger swipe down**: Gesture shortcut to exit the Explore screen (`checkTwoFingerSwipeDown`).
  - **Two-finger long press**: Holding two fingers stationary for 600 ms with < 20 px movement initiates the voice question Ask flow (`checkTwoFingerLongPress`).

### 2. Screen Reader Exploration Mode (TalkBack ON)
- Android TalkBack intercepts single-finger touch events for screen reader navigation ("Explore by Touch"). Direct `<canvas>` elements cannot receive standard touch coordinates under default TalkBack behavior without special gestures.
- **Accessible Tree Overlay (`.gt-explore__a11y-tree`)**:
  - Semantic DOM `<button>` elements (`.gt-explore__a11y-item`) with exact bounding box dimensions (`style={{ left, top, width, height }}`), `role="button"`, and localized `aria-label` are generated for diagram elements via `frontend/src/flow/a11yFeatures.ts`.
  - **Pointer Events Behavior**: Both the overlay container (`.gt-explore__a11y-tree`) and individual feature buttons (`.gt-explore__a11y-item`) have `pointer-events: none` permanently set in CSS (`frontend/src/styles/explore.css`). Direct touches pass straight through to the underlying HTML5 canvas. TalkBack navigates by traversing the Android accessibility node hierarchy (DOM accessibility tree) and does not require `pointer-events: auto`.
  - **Focus & Activation**:
    - When TalkBack moves focus to an item (via linear swipe gestures or touch exploration), `onFocus` (`handleFeatureFocus`) fires the exact same haptic and audio effects that direct finger contact would produce:
      - Vertices: Corner vibration pattern `[50, 90, 50]` ms + spoken label (e.g. "Corner A").
      - Line Segments & Axes: Line buzz (80 ms) + label (e.g. "Side AB", "x-axis", "y-axis").
      - Bars: Line buzz (80 ms) + frequency tone for bar value + label (e.g. "Q1, value 40").
      - Curves: Continuous tone at the curve's average normalized y-pitch + label (e.g. "Curve C").
    - Double-tapping to activate an item (`onClick` / `handleFeatureActivate`) speaks the feature's accessible name via `drivers.speech.speak` and displays it in the screen status card.
- **Alternative Gesture (TalkBack Pass-Through Gesture)**:
  - TalkBack users can perform a double-tap and hold on the second tap, then drag without lifting.
  - TalkBack treats this as a gesture pass-through bypass, routing raw pointer events directly to the canvas coordinate handler. This allows TalkBack users to explore diagrams continuously with relative cursor haptics and audio feedback.
- **Explore Screen UI Controls**:
  - **Header**: Settings launcher button (`SettingsLauncher`) — accessible button displaying current language and speech rate ("Settings: English, 1.0×"). Activating it opens the modal `LabSettings` dialog.
  - **Footer Buttons**:
    - **Where am I** (`explore.whereAmI`, `data-testid="explore-where-am-i"`): Accessible button with a minimum 48×48 px touch target. When clicked, speaks the user's current or last-touched location relative to diagram elements (touching, close, far, and compass direction).
    - **Voice Command / Ask** (`ask.button`): Launches voice question recognition or displays the text input fallback.
    - **Guide me** (`ask.guideMe`): Displayed when an offered guidance target is active and finger guidance is enabled.
    - **Correct** (`explore.correct`): Available when teacher correction mode is enabled.
    - **Back** (`common.back`): Accessible button to leave Explore.

---

## Platform Limitations & Workarounds

### 1. Vibration API on Samsung One UI & Android Chromium HAL
- **Issue**: Calling `navigator.vibrate([50, 90, 50])` with an array pattern on certain Android hardware abstraction layers (notably Samsung Galaxy S24+ One UI 6 and OnePlus OxygenOS) either silently fails or returns `false`.
- **Resolution**: `WebHapticDriver.vibrate()` in `frontend/src/drivers/haptics.ts` implements `fallbackPulse(pattern)`. If `host.vibrate(pattern)` returns `false` or throws on an array, it automatically falls back to a solid single pulse calculated as the sum of all active ("on") pulses (`i % 2 === 0`), clamped to a minimum duration of `MIN_FALLBACK_PULSE_MS = 100` ms, guaranteeing physical motor actuation.
- On platforms or browsers without `navigator.vibrate` support (e.g., iOS Safari or desktop browsers), `FallbackHapticDriver` translates vibration calls into audible synth buzzes via `WebAudioDriver`.

### 2. System-Level Vibration Toggles
- **Limitation**: The Web Vibration API cannot override Android system-level vibration settings.
- If **Touch feedback** or **Vibration intensity** is set to 0 or disabled in Android system settings, `navigator.vibrate()` calls will produce no physical sensation despite returning `true`.
- **Resolution**: Ghost Touch includes an accessible guidance card in Lab Settings (`.gt-lab-settings__vibration-help`, titled "Device Vibration Settings") with localized instructions for major Android distributions:
  - **Samsung One UI**: Open Settings, then Sounds and vibration, then Vibration intensity, and turn on Touch feedback. Also turn off Power Saving Mode.
  - **Stock Android or Pixel**: Open Settings, then Sound & vibration, then Vibration & haptics, and turn on Touch feedback.
  - **OnePlus OxygenOS**: Open Settings, then Sound & vibration, then Haptics, and turn vibration on.
  - **Xiaomi HyperOS**: Open Settings, then Sound & vibration, then turn on Haptic feedback and Vibrate on touch.
  - Note: Menu paths and names may vary across Android versions and phone manufacturers.

### 3. TalkBack Exploration Granularity & Curve Handling
- Complex curves with many points are **not** partitioned into representative segments or extrema in the accessibility tree overlay.
- In `frontend/src/flow/a11yFeatures.ts` (lines 117–138), each polyline in `scene.polylines` emits **one** accessible feature button representing the entire polyline. Its bounding box spans the full extent of the curve (`boxOf(xs, ys)`), its normalized vertical position (`yNorm`) is the average y-coordinate of all valid points, and its label is `Curve {name}`.
- To prevent unwieldy DOM trees and avoid overwhelming the TalkBack accessibility buffer, the total number of features is capped by `MAX_A11Y_FEATURES = 60`. The feature extractor distributes this quota evenly across element kinds (points, segments, bars, curves, axes) so that no single category starves the others.

---

## New Haptic & Audio Cues (Pending Physical Phone Testing)

Recent releases introduced several new assistive cues and settings in `frontend/src/flow/explore.ts`, `frontend/src/core/proximity.ts`, and `frontend/src/components/LabSettings.tsx`.

> [!NOTE]
> **Phone Testing Status**: While each of the cues below has been fully implemented in pure core/flow modules and verified with automated unit tests (Vitest), **they have not yet been validated through hands-on testing on physical Android devices running TalkBack**. Real-world haptic latency, audio engine concurrency, and TalkBack gesture conflicts remain to be evaluated on physical phones.

### 1. Directions Switch (Lane A3)
- **Settings Control**: Located in Lab Settings under "Directions" (`lab.settings.directions`), toggleable on or off (default enabled). Spoken announcement confirms "Directions enabled." or "Directions disabled."
- **Corner Compass**: When the finger enters a corner (vertex), Ghost Touch speaks the corner name followed by 8-way compass exit directions to adjacent vertices (e.g., "Corner B. Up-left to A, down-right to C.").
  - If a vertex has more than 4 exits or if the direction text exceeds 12 words, it speaks a concise summary (e.g., "5 edges.") instead of listing every direction.
  - If the corner was visited recently within `VERTEX_VISIT_WINDOW_MS` (1200 ms), exit directions are suppressed to prevent repetitive chatter.
- **Line Names on Hold**: Resting a finger stationary on a line segment for `LINE_DWELL_MS` (1200 ms) speaks the line name and compass directions to its two endpoints (e.g., "Side AB. Up-left to A, down-right to B."). For coordinate axes, it speaks "x-axis, left to right" or "y-axis, top to bottom".

### 2. Finding Sound Switch (Lane A4)
- **Settings Control**: Located in Lab Settings under "Finding sound" (`lab.settings.findingSound`), toggleable on or off (default enabled). Spoken announcement confirms "Finding sound enabled." or "Finding sound disabled."
- **Proximity Audio Guidance**: When the user's finger is off an element but within `radiusPx = 48` CSS px of a line or feature, a soft audio click cue sounds to guide the finger back to the line.
  - As the finger nears the line (down to `lineRadiusPx = 14` px), click repetition accelerates from `farMs = 400` ms to `nearMs = 90` ms.
  - Click pitch rises smoothly from `loHz = 500` Hz to `hiHz = 1200` Hz.
  - Click loudness increases from gain 0.3 to 0.6, and clicks are stereo-panned toward the line.
  - On a line inside the 450 ms corner quiet window, clicks run at their closest setting (90 ms, 1200 Hz), confirming that a turn was completed while line buzz is suppressed.

### 3. Hold Keep-Alive Timer (Lane GT-08)
- **Implementation**: Created via `createHoldKeepAliveTimer` in `frontend/src/flow/explore.ts`, ticking every `KEEP_ALIVE_INTERVAL_MS = 60` ms.
- **Problem Solved**: Mobile browsers and Android touch drivers typically cease firing `pointermove` events when a user's finger comes to a complete rest on a touchscreen. Without ongoing events, haptic vibration or audio tones could prematurely cut off even though the user is deliberately resting on a line or curve.
- **Behavior**: While a pointer is held down, the 60 ms keep-alive timer periodically re-dispatches engine move steps at the last known coordinates if no fresh move event has arrived within the interval. This guarantees continuous tactile and auditory feedback during stationary holds.

### 4. Graph Scan Switch (Lane A6)
- **Settings Control**: Located in Lab Settings under "Graph scan" (`lab.settings.graphScan`), toggleable on or off (default enabled). Spoken announcement confirms "Graph scan enabled." or "Graph scan disabled."
- **Behavior**: On function graphs (`kind: 'function_graph'`), moving across the graph outside the curve plays a continuous tone at 0.33 volume matching the curve's normalized y-coordinate pitch at the current horizontal position.

### 5. Where Am I Automatic Dwell Detection (Lane A5)
- **Implementation**: In addition to the footer "Where am I" button, `checkWhereAmIDwell` in `explore.ts` monitors resting touches in open space (`target.kind === 'none'`).
- **Behavior**: If the finger rests with < 6 px movement (`WHERE_AM_I_REST_MAX_MOVE_PX`) for 1200 ms (`WHERE_AM_I_DWELL_MS`), Ghost Touch automatically speaks the user's location relative to the closest diagram element (e.g., "Near side AB, close, above to your left").
- **Safety Guards**: Automatically suppressed if speech was active within 1500 ms, if voice Ask is listening, or if Guide mode is actively guiding. Re-arms only after the finger moves at least 20 px from the previously spoken coordinates.
