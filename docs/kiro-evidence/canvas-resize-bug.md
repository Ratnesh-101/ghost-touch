# Explore canvas grows during interaction (P0, task 42, Requirement 25)

Written by Kiro, 2026-11-11. Tool: Kiro.

## Symptom (owner's video, Samsung Galaxy S24+, Android Chrome, sample "Right Triangle ABC")
On the first double-tap-hold-drag the debug line changed from "waiting for touch" to
"First hold: dx=-74.4px, dy=-47.2px from centre". The canvas then grew taller for about 7 s, the
triangle drifted down and was cut off, and Ask, Correct and Back were pushed off screen.

## Root cause
A layout feedback loop through the canvas bitmap, plus several layout rules that depended on
content instead of on the viewport:

1. **Bitmap feeds layout (the loop).** The canvas was in normal flow. Inside an auto-height flex
   column, `height: 100%` is unresolvable, so the canvas height came from its `height` attribute,
   which `updateDimensions()` set from the canvas's own measured rect times the device pixel ratio.
   The `ResizeObserver` observed the canvas, so every bitmap resize re-fired `updateDimensions()`.
   On a high-DPR phone each pass grew the page. Commit 5616cd5 (PR #34) took the canvas out of flow
   (`position: absolute; inset: 0`), which breaks the loop on the CSS side.
2. **Same loop, still armed in JavaScript.** After 5616cd5 the sizing code still measured the
   canvas, observed the canvas and, on every pointer down, called `updateDimensions()`, which
   reassigned `canvas.width/height` (clears the bitmap, forces a repaint) even when nothing had
   changed. The first pointer down is exactly when the debug text changed, so the two happened together.
3. **Layout depended on text.** The status card had only a `min-height`, the debug line only a
   `min-height`, so a longer message ("First hold: dx=..." replacing "waiting for touch", or a
   long Ask answer) changed their height and moved everything below.
4. **Screen height was a floor, not a size.** `.gt-explore` had `min-height: 100dvh`, so it could
   grow past the viewport and the page scrolled instead of the canvas taking the remainder.
5. **`min-height: clamp(220px, 55dvh, 100%)`.** The `100%` is a percentage of an auto-height
   parent and is unresolvable; some engines then drop the whole declaration, so the container's
   lower bound was not reliable.

I could not prove which of 1 to 5 was the dominant contributor on the device, because the
deployed build contains 5616cd5 and I have no way to run Chrome on the S24+. What I did verify, in
code, is that after 5616cd5 items 2 to 5 were still present and could each move the canvas box.

## What changed
- Requirement 25, design section (P86, P87) and task 42 first (`.kiro/specs/ghost-touch/`).
- `frontend/src/flow/canvasSize.ts` (new, pure): `measureBox`, `reconcileCanvasBox`, `cappedDpr`.
  The CSS box comes from the container only; the bitmap is derived from it and never read back;
  the previous box object is returned while the container has not moved.
- `Explore.tsx`:
  - `updateDimensions()` measures the container (`canvas.parentElement`), reconciles, and touches
    the bitmap and the offscreen scene only when the container's CSS size changed. A pointer down
    now refreshes only the rect cache.
  - The `ResizeObserver` observes the container, not the canvas.
  - `computeCanvasDpr` is kept (existing tests) and delegates to `cappedDpr`.
- `global.css`, `explore.css`:
  - `.gt-explore`: `height: 100vh; height: 100dvh` (was `min-height`), `overscroll-behavior: contain`,
    `overflow-y: auto` kept so overflow scrolls inside the screen.
  - Canvas container: `flex: 1 1 0; min-height: 220px; touch-action: none` (no percentage).
  - Status card `height: 5rem; overflow: hidden`, status text clamped to 3 lines.
  - Debug line `height: 1.25rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis`.
- Tests:
  - `tests/canvasSize.prop.test.ts`: P86, 300 runs for the sequence property and 200+ for the rest.
    Mutation-checked: comparing the previous bitmap width instead of the previous CSS width makes
    two of its five tests fail (seed -890308826); reverted.
  - `tests/explore.layout.test.tsx`: P87 as example tests over both stylesheets (not fast-check;
    a static file has nothing to randomise).
  - Two older CSS tests were amended because they pinned the old rule: `explore.layout.test.tsx`
    ("flex 1 1 auto" and the `clamp(...)` min-height) and `explore.lab.test.tsx` BUG-01 (it
    forbade `height`; the intent, no clipping by `overflow: hidden`, is kept and still asserted).
- Not changed: `hapticEngine.ts`, every tuned haptic value, `core/`, the pulse ring and spark
  markup. I checked the pulse ring, the "IT'S ALIVE" spark, the frame and the rivets: all are
  `position: absolute` with `pointer-events: none` inside a container with `overflow: hidden`, so
  they cannot change the canvas box. The no-vibration note is in flow, but it is rendered once on
  mount (the haptic support flag does not change during a session), so it cannot move the canvas
  during a hold. It does take a few lines above the canvas on devices without vibration.

## Suspects checked (from the P0 brief)
| Suspect | Finding |
|---|---|
| (a) ResizeObserver / `updateDimensions()` | Real: observed the canvas, measured the canvas, reset the bitmap on every pointer down. Fixed. |
| (b) Status line changes height | Real: only `min-height`. Fixed height plus line clamp. |
| (c) `touch-action`, `overscroll-behavior` | Canvas already had `touch-action: none`; container and screen did not. Added. `body` already had `overscroll-behavior: none`. |
| (d) `100vh` vs `dvh` | Screen was `min-height`. Now `height` with `100vh` fallback then `100dvh`. |
| W3 pulse ring, no-vibration note | Cannot change layout (see above). |

## What jsdom cannot show
- jsdom does no layout: `clientWidth/clientHeight` are 0, `ResizeObserver` is absent, `dvh` is
  not evaluated, and there is no URL-bar animation or `devicePixelRatio` of 3. The loop itself
  (bitmap resize, then layout, then observer) cannot happen there. P86 models the rule, not the
  browser; the CSS tests prove the declarations exist, not that Chrome honours them as intended.
- In jsdom `updateDimensions()` falls back to the canvas rect when the container reports 0 (so
  existing tests that mock `getBoundingClientRect` keep working). On a device the container
  measurement is used.
- Playwright is deliberately not run here; another agent adds the end-to-end test.

## Re-check on the S24+ (exact steps)
1. Open https://ghost-touch-iota.vercel.app after this change is deployed, pick "Right Triangle ABC".
2. Note the canvas top and bottom edges and the positions of Ask, Correct, Back.
3. Double-tap-hold and drag for at least 10 s, lift, repeat three times. Expected: the debug line
   reads "First hold: dx=…" on one line (cut with an ellipsis if long); the canvas and the three
   buttons do not move at all; the page does not scroll.
4. Pull down from the top while dragging. Expected: no pull-to-refresh, no page scroll.
5. Let the URL bar hide (scroll gesture outside the canvas, or rotate and rotate back). Expected:
   the canvas resizes once to the new space and then stays still; the triangle is redrawn centred.
6. Ask a question with a long answer. Expected: the status card keeps its height (text clipped to
   three lines; the full answer is still spoken).
7. If any of 3 to 6 fails, record screen video and the debug line text; that points back to a
   cause not covered here (for example TalkBack's own overlay).

Known trade-off: a long status message is visually cut at three lines. The same text is spoken
and exposed through the live region, so non-visual users lose nothing; sighted teachers see the
start of it.
