# TalkBack Phone Testing & Platform Limitations (Android)

## Overview
This document records the architectural integration, physical testing procedures, and platform limitations for Ghost Touch when running with Android TalkBack enabled.

---

## Architecture: Dual-Layer Interaction Model

### 1. Direct Touch Mode (TalkBack OFF)
- When TalkBack is disabled, single-finger direct touch gestures directly hit the HTML5 canvas layer.
- Fast pointer movements trigger low-latency audio tones (Web Audio API synth) and tactile haptic vibration (`navigator.vibrate`) via `hapticEngine.ts` and `explore.ts`.

### 2. Screen Reader Exploration Mode (TalkBack ON)
- Android TalkBack intercepts single-finger touch events for screen reader navigation ("Explore by Touch"). Direct `<canvas>` elements cannot receive standard touch coordinates under default TalkBack behavior without special gestures.
- **Accessible Tree Overlay (`.gt-explore__a11y-tree`)**:
  - Semantic DOM buttons with exact bounding boxes, `aria-label`, and `role="button"` are generated for each geometric element (vertices, line edges, function curves, and bar chart columns) via `frontend/src/flow/a11yFeatures.ts`.
  - The overlay container uses `pointer-events: none` while child interactive buttons retain `pointer-events: auto` only during accessibility traversal.
  - When TalkBack focuses an item (either via swipe gestures or single-finger touch exploration), `onFocus` fires the corresponding haptic feedback and speech announcement (`vibrate(CORNER)` + label for vertices; `vibrate(lineMs)` for edges; frequency tone for graph curves).
- **Alternative Gesture (TalkBack Pass-Through A1)**:
  - Users can also double-tap and hold on the second tap, then drag without lifting. TalkBack treats this as a pass-through gesture, routing raw pointer events directly to the canvas coordinate handler.

---

## Platform Limitations & Workarounds

### 1. Vibration API on Samsung One UI & Android Chromium HAL
- **Issue**: Calling `navigator.vibrate([50, 90, 50])` with an array pattern on certain Android HALs (notably Samsung Galaxy S24+ One UI 6 and OnePlus OxygenOS) either silently fails or returns `false`.
- **Resolution**: `WebHapticDriver.vibrate()` implements `fallbackPulse(pattern)`: if `host.vibrate(pattern)` returns `false` or throws on an array, it automatically falls back to a solid single pulse (sum of active pulses, min 100ms) guaranteeing physical motor actuation.

### 2. System-Level Vibration Toggles
- **Limitation**: The Web Vibration API cannot override Android system-level vibration settings.
- If **Touch feedback** or **Vibration intensity** is set to 0 or disabled in Android system settings (`Settings > Sound and vibration > Vibration intensity / System vibration`), `navigator.vibrate()` calls will produce no physical sensation despite returning `true`.
- **Resolution**: Ghost Touch includes an accessible guidance card in Lab Settings detailing OS navigation paths for Samsung One UI, Stock Android / Pixel, OnePlus OxygenOS, and Xiaomi HyperOS.

### 3. TalkBack Exploration Granularity
- Complex curves with hundreds of points are partitioned into representative segments (polyline segments or key extrema) within the DOM tree overlay to maintain responsiveness and avoid overwhelming the TalkBack accessibility buffer.
