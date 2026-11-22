# Pitch A: Ghost Skin

**Hook:** the creature has nerves along its bones but no skin. Ghost Skin gives it some. Slide a finger inside a shape and it purrs. Slide under a curve and it purrs fast above the axis and slowly below it. For the first time a blind student can feel **area**, which is a 2D idea, where today every cue is a point or a line.

## The problem (checked in the repo)
Every cue Ghost Touch has today lives on a 1D or 0D thing: line buzz, corner pulse, theremin on the curve, near-line clicks, compass words. The space between lines is silence. `fable-blind-user-plan.md` §2.1 measured 88.7% silence on the triangle and 80.6% on the sine, and §2.5 says it plainly: "The triangle's inside and outside are both silent, so I cannot tell if I am in the shape." Item I15 there (a spoken inside/outside clause in where-am-I) was parked as "later". It was never built or rejected. `grep` finds no inside, area or region logic in `core/` or `flow/`.

**Scenario.** Priya is in Class 12 and the chapter is NCERT "Application of Integrals". The board shows y = sin x over one period, and the teacher says "the area above the axis cancels the area below, so the integral is zero." With today's app Priya can trace the curve and hear its height, but she cannot feel the two lobes as regions, compare their widths, or notice that one is above the axis and one below. With Ghost Skin she sweeps a finger left to right, just inside the curve. She hears a fast purr for the first hump, nothing as she crosses the axis, then a slow purr for the second hump, and the two last the same time. She has felt the signed integral. The same works for geometry. In a quadrilateral ABCD split by diagonal AC, she rubs one part and rests, and hears "Inside triangle A B C". She crosses the buzzing diagonal and hears "Inside triangle A C D". Now she knows which piece is which before she ever asks.

## How it feels, sounds and is spoken (no vibration is added or changed)
- **Haptics: untouched.** The motor stays reserved for lines and corners. Ghost Skin never calls `vibrate`, so the rule "one sound per meaning" holds: buzz means edge, purr means surface.
- **The purr (audio, a PROPOSED row for `tech.md`):** one low triangle-wave carrier at 165 Hz, whose odd harmonics at 495 and 825 Hz are what a phone speaker actually plays. It is amplitude-modulated at 100% depth, with a peak gain of 0.08. That is under the theremin's 0.15 and the clicks' 0.3, so it sits beneath everything. Fade in and out with time constant 0.05 s.
  - **Inside a closed shape, or in the area between the curve and the axis while above the axis:** pulse rate **8 Hz**, a cat-like purr.
  - **In the area below the axis (negative signed area):** pulse rate **3 Hz**, a slow throb.
  - The meaning is carried by **rhythm, not pitch**, so it never collides with the theremin (200 to 1000 Hz, a steady sine) or the clicks (500 to 1200 Hz, short ticks).
- **When it is silent:** the finger is on a line or vertex (the engine's buzz wins), in a bar interior (bars keep their own spoken value), inside the 450 ms corner quiet window, while any speech plays (the same rule the owner set for clicks in D4), and after a lift. While the near-line clicks are active the purr plays at half gain. It does not stop, because the triangle's inradius is about 54 px on a 360 px canvas, so most of its inside is within 48 px of an edge.
- **Speech, kept very small:**
  - The first time the purr starts in a scene, the app says one word, "Inside.", once per scene.
  - On the existing where-am-I rest (`flow/commands.ts whereAmI`, the `checkWhereAmIDwell` path) it adds one clause: "Inside triangle A B C." / "Inside quadrilateral A B C D." / "Inside a shape with 5 corners." For graphs: "In the area under the curve, above the axis." / "In the area between the curve and the axis, below the axis."
  - Names go through `core/speakable.ts`, so no `raw_` id is ever spoken.
  - Help (`core/help.ts`) gains one sentence when the switch is on: "A purr means you are inside a shape or under a curve. Slow purr: below the axis."

## Frankenstein fit
Nerves (the buzzer) give the creature bones and joints. Eyes (the vision AI) give it a body plan. Voice (the synth) now gives it **skin**: a surface you can stroke, which purrs like a living thing and throbs where the body dips below the axis. The Halloween stays in the creature: it purrs, the student does not become the spooky one. The pitch line writes itself: "We stitched a cat's purr onto a calculus textbook."

## What to build
**Kiro (pure core and spec, the main share).** Requirement 51, properties P159 to P165, task 82 (next free numbers, re-check before use). A `tech.md` PROPOSED row; every existing value stays byte-identical.
- `frontend/src/core/skin.ts` (new):
  - `regionsOf(scene)`: simple cycles of 3 to 8 points in the segment graph. Bounded DFS, at most 200 cycles. Skipped when there are more than 60 segments or the mode is Raw. Self-crossing cycles are dropped. Closed polylines (first and last point within 0.02) count as regions too.
  - `skinAt(scene, regions, x, y)`: the smallest-area containing cycle (shoelace formula plus point-in-polygon), so a diagonal splits a quadrilateral into its two triangles. For a `function_graph` it uses `curveYAtX` and `axes.x_axis_y` to return `{kind:'area', sign}`.
  - `skinStep(state, input)`, returning `{state, effects}` with the single effect `{kind:'skin', rateHz: 8 | 3 | null, gain}` and `DEFAULT_SKIN`.
- `core/presets.ts`: a `skin` field, true only in Explorer.
- `core/help.ts`: the one sentence above.
- `tests/skin.prop.test.ts`, at least 200 runs each:
  - P159: no skin effect unless the hit target is `none`.
  - P160: Ghost Skin never emits `vibrate`.
  - P161: lift, speech or the quiet window gives `rateHz` null.
  - P162: a random convex polygon contains its centroid, and a point outside its bounding box is never inside.
  - P163: a diagonal-split quadrilateral never reports the quadrilateral.
  - P164: mirroring a graph about its x-axis swaps 8 and 3. A curve wholly above the axis never gives 3.
  - P165: regions are invariant under translation and scale. `skinAt` is total, and the cycle work is bounded on 300-segment scenes.
  - Off-switch equality: with the switch off, Explore's effects are exactly today's.

**agy (screens and drivers):**
- `drivers/audio.ts`: `setSkin(rateHz, gain)`, one carrier plus one LFO into a GainNode, created on unlock. `AudioContextLike` gains the AudioParam `connect`.
- `drivers/index.ts`: `runEffects` handles `skin`.
- `flow/explore.ts` and `screens/Explore.tsx` (one EX lane, serialized): call `skinStep` in the move pipeline and the keep-alive tick, and stop it on lift, blur and hidden.
- `flow/commands.ts`: the where-am-I clause.
- `LabSettings.tsx` and `drivers/storage.ts`: switch "Feel the inside", key `gt_skin_enabled`, **OFF by default**.
- `Debug.tsx`: "Purr 8 Hz" and "Purr 3 Hz" buttons, so the owner can tune by ear.
- i18n keys in en, hi and gu.

**Backend: none.** No AI call, no cost, and it works offline on samples, saved diagrams and share links.

## 20-second demo
Use the sine sample, a blindfolded volunteer, and the phone audio on the mic. Captions are on screen.
- 0 to 8 s: the volunteer sweeps just above the axis, then just below it. Fast purr over the first hump, slow throb under the second, the same length. Caption: "area above, area below".
- 8 to 14 s: the volunteer says "They cancel. The integral is zero."
- 14 to 20 s: switch to the triangle and rub the inside (purr), cross an edge (buzz), go outside (silence). The volunteer says "I'm in the triangle."

## Risks and why they are survivable
1. **Small speakers lose 165 Hz.** The meaning rides on the 8 Hz and 3 Hz rhythm, and the triangle wave's harmonics are in the speaker's range. The values are PROPOSED, with Debug buttons for tuning on the Nord CE6 and a budget phone.
2. **Clutter with graph scan and clicks.** The purr is the quietest layer, silent under speech and on lines, half gain under clicks, and off by default (Explorer preset only). That matches ruling 1 of the improvement report ("no new cue" by default) and the precedent set by sticky line and heartbeat.
3. **Unclosed AI shapes give no skin.** If an edge does not share point ids, there is no cycle and no purr. Here silence means "no region found", never "outside", because where-am-I says "outside" only when a region exists. Teach (Ghostwriter add-edge) closes a shape.
4. **Cycle blow-up on Raw Mode.** Raw Mode is skipped, and the work is capped at 60 segments and 200 cycles. P165 makes the bound a test.
5. **Unfelt and untested.** Nothing here has been on a phone or used by a blind person. The docs say so in the same sentence as every other proposed cue.

## Why this should win
- **It adds a dimension, not a variant.** Every rival in "feel" will likely refine lines, corners or directions, all of them 1D. Ghost Skin turns the silent 2D interior into information. It teaches **area and signed area**, real syllabus concepts (NCERT Class 12 "Application of Integrals"; area and regions in geometry) that no current cue can carry.
- **It touches no tuned value and no motor pattern.** There is no backend change and no AI cost, and it is off by default, so it cannot break the demo.
- **It is the most Kiro-shaped idea possible.** The cycle finder, smallest-face rule and signed-area mirror are pure geometry with sharp properties (P159 to P165), just what Kiroween judges reward. agy's share is one driver method, one switch and one EX lane.
- **The demo is understood in five seconds.** "Fast purr, slow purr, same length: they cancel" is a calculus lesson felt eyes-closed, and a story the Frankenstein category will remember.
