# Ghost Touch: blind-user trace test and improvement plan (2026-11-15)

Read-only pass by Claude Code (planning agent). Nothing in the repo was changed except this file.
Method: read the steering docs, spec, pure core, Explore screen and drivers; ran 93 existing core and
Explore tests (5 files, all pass); then drove scripted finger traces through the real `hitTest`,
`step` and `checkAxisCrossing` on the three samples. Canvas assumed 360 x 480 CSS px (scale 360,
60 px silent letterbox bands top and bottom), 60 Hz touch. The trace scripts are throwaway and
live outside the repo.

Not done: no phone, no TalkBack, no real motor, no real blind user. Every number below is a
simulation of a finger, not a measurement of a person. Section 6 lists what only a phone can settle.

---

## 1. Verdict

- The owner's complaint is real and it is by design, not a bug. The only signal is "buzz" or
  "no buzz". Neither state says which way the line runs, which side it is on, or how far away it is.
- Silence carries five different meanings (off the line, corner quiet window, finger held still,
  letterbox band, nothing there at all). I cannot tell them apart.
- The corner, where the line turns and I most need help, tells me the least: one letter, then
  450 ms in which the right direction and a wrong direction feel identical.
- Two helpers already exist but do not reach me: "Guide my finger" is off unless a build flag and a
  setting are both on, and "where am I" is voice-only and never mentions the nearest line.
- Fix order: tell me where edges go at a corner, give me a "getting warmer" sound near a line, stop
  the false silences, and describe the layout before I touch. None of these needs a change to the
  tuned haptic values. In my finger model the first two together cut a triangle loop from about
  56 s to about 13 s.
- Deadline note: STEMergent closes Nov 16, 09:00 IST. Only slice S0 (section 5) is small enough to
  consider before that, and only if tonight's phone test passes. Everything else is Kiroween work.

---

## 2. What I feel, hear and get lost on (first person, with trace evidence)

### 2.1 Most of the page is silence

| Sample | Silent area | Line band | Vertex | Bar interior |
|---|---|---|---|---|
| Triangle | 88.7% | 8.7% | 2.6% | 0% |
| Sine | 80.6% | 19.4% | 0% | 0% |
| Bars | 66.7% | 27.6% | 0% | 5.7% |

I land on something 12% of the time on the triangle. Sweeping in straight lines at 200 px/s I find
the first buzz after 1.4 s (median) and 5.2 s (90th percentile); 7 of 400 landings found nothing in
20 s. While searching I hear nothing, so I do not know whether I am close, far, or off the page.

### 2.2 On a line, I cannot hold it

I do not know the line's heading, so I guess. Distance I travel before the buzz stops
(edges are CA 216 px, AB 270 px, BC 162 px):

| My heading error | Line lost (share of tries) | Distance before loss (median) |
|---|---|---|
| 5 degrees | 15 to 66% | 92 to 128 px |
| 10 degrees | 83 to 100% | about 80 px |
| 15 degrees | 100% | about 54 px |
| 20 degrees | 100% | about 41 px |
| 30 degrees | 100% | about 29 px |

A sighted person with eyes closed is 10 to 20 degrees off with no reference. So I lose every edge
after a third of its length or less. When the buzz stops I do not know which side the line is on, so
recovery is trial and error.

### 2.3 The corner is the worst place

- The phone says "A" and nothing else. It does not say how many edges leave A or where they go.
- For 450 ms after the corner there is no line buzz (tuned quiet window). Leaving C along CA with
  perfect aim, my first line buzz comes at:

| Speed | First line buzz | Distance from corner |
|---|---|---|
| 40 px/s | 550 ms | 22 px |
| 80 px/s | 450 ms | 36 px |
| 150 px/s | 450 ms | 68 px |
| 300 px/s | 450 ms | 135 px |

- Leaving C in a wrong direction (into empty space) gives exactly the same thing for the first
  450 ms: nothing. At 150 px/s I am 68 px away before I can know I chose wrong.
- If I leave a corner slowly, it stutters. Leaving A along AC at 30 px/s with 2 px tremor, the corner
  pattern and "A" fire 3 times (median; up to 5). Each one restarts the 450 ms quiet window, so the
  first line buzz slips to about 700 to 850 ms. Cause: `step()` forgets the vertex the moment the
  finger is outside 22 px, so jitter on the boundary re-enters it. A finger resting on the boundary
  for 3 s fired the corner about 45 times.

### 2.4 Silence lies to me

1. **Held still.** The engine only runs on `pointermove` (no timer in `Explore.tsx`). A finger that
   stops on a line gets no new event, so the 80 ms buzz ends and the line "vanishes" while I am
   still on it. Pausing to think is the natural thing to do, and it is punished.
2. **Quiet window** after a corner (above).
3. **Letterbox bands** (60 px top and bottom here) and everything outside the unit square.
4. **Truly off the line.**
5. **Something broke.** I cannot rule it out.

### 2.5 Every line feels the same

Side AB, side BC, an axis, a bar edge and a Raw Mode outline all give the same buzz. The engine
knows the line id but never says it. I learn which side I am on only by reaching a corner. The
triangle's inside and outside are both silent, so I cannot tell if I am in the shape.

### 2.6 I have no frame

- Entry speech is "Double-tap and hold, then drag to feel the diagram. You start at the centre."
  With direct touch the cursor is absolute (`getCanvasCoords`), so I start wherever I land. The
  centre tick fires only within 24 px of the centre. The sentence is untrue for me.
  (Spec conflict: Requirement 13.3 says a new hold starts the cursor at the centre. The code does
  not. The owner should decide which is right; I would keep absolute touch and fix the words.)
- Nothing tells me the title, how many corners there are, or roughly where they sit, before I touch.
- Nothing marks the edge of the page.
- "Where am I" needs the microphone and speech recognition, and answers "Near Point A, top left".
  It never says "the line is just to your right". A `commands.whereNearLine` string exists in all
  three languages and is unused.

### 2.7 Sine graph

- A plain left-to-right sweep (what a first-time user does) takes 2.4 s and gives me two tone blips
  of about 200 ms each. I cannot hear the shape. To hear it I must follow a path that tilts up to
  67 degrees, blind.
- Following the curve with a 12 px wobble keeps me on it 88% of the time with 12 dropouts; with
  16 px wobble, 63% and 26 dropouts. A fingertip covers more than that.
- Sweeping along y = 0.5 I am on the x-axis the whole time and never hear the curve cross it: the
  axis is nearer than the curve at every sample, so the curve's tone never plays there.
- Tracing the x-axis with 8 px wobble says "x-axis" 4 times in 3.3 s.
- The curve starts 7 px from the y-axis and exactly on the x-axis: three lines in one fingertip.

### 2.8 Bar chart

- The part of a bar that counts as "inside" (not within 14 px of its own edges) is 26 px wide;
  Q1's is 26 x 30 px. The 18 px gap between bars is entirely edge band. A horizontal sweep is
  66% edge buzz and 34% bar.
- "Q1, 10" takes about a second to say. Bars are 72 px apart, so above roughly 70 px/s each bar
  cuts off the one before. At 120 px/s a new bar speaks every 600 ms. "y-axis" is cut off by
  "Q1, 10" 270 ms later at 60 px/s.

### 2.9 What works

- A fast swipe across a line still buzzes: 100% of crossings up to 1500 px/s at 60 Hz
  (66% at 2500 px/s). Finding a line by scrubbing works.
- Corner versus line is distinct, labels are spoken, lift silences everything, speech is merged so
  an axis word and a label are not lost together.
- The guide machine (tone pitch for up/down, pan for left/right, spoken 8-way hints, arrival pulse)
  is exactly the right kind of cue. It is just switched off and limited to named targets.

### 2.10 A model of me tracing the triangle

A closed-loop follower that uses only what the app gives (buzz or not, corner event), reacts 250 ms
after silence, backs up to the last buzz and tries a new heading 25 degrees either side, at
100 px/s, 200 runs, one loop A-B-C:

| Variant | Finished in 120 s | Median time | Line losses | Time with no feedback | Longest silence |
|---|---|---|---|---|---|
| Today | 92.5% | 56 s | 64 | 74% | 2.3 s |
| Corner says where edges go | 100% | 24 s | 25 | 63% | 1.7 s |
| Side-aware near-line cue (within 45 px) | 100% | 29 s | 22 | 55% | 1.4 s |
| Both | 100% | 13 s | 6 | 38% | 1.1 s |

The model is crude (a person is smarter and also clumsier). Read the ratios, not the seconds.

---

## 3. Limits of the hardware (keep the plan honest)

- One motor. It cannot say left or right, and the Web Vibration API cannot change strength. A
  "weaker" haptic can only be shorter or sparser pulses.
- Budget motors need about 30 to 60 ms to spin up; `drivers/haptics.ts` already assumes 100 ms for a
  reliable pulse. Pulses under about 25 ms may not be felt at all. So direction and distance must
  go through sound and speech, with haptics kept for "on the line" and "corner".
- Stereo pan needs headphones. A phone speaker is mono. Never make pan the only carrier of a cue.
- Speech starts 150 to 400 ms after the call and is one channel: each `speak` cancels the last.
- Sound in a classroom means one earbud. Every audio cue needs an off switch and a short form.

---

## 4. Improvements, ranked (benefit to a blind user against cost and risk)

| # | Improvement | Benefit | Cost / risk | Requirement impact | Owner |
|---|---|---|---|---|---|
| I1 | **Corner compass.** At a vertex say the label, then where each edge goes: "A. Down to C. Down-right to B." Skip the edge I arrived on. Short form on repeat visits. | Highest. Fixes the turn. | Low. Pure helper plus wiring. Engine untouched. | New requirement; extends 4.4 | Kiro core, agy wiring |
| I2 | **Hold keep-alive.** While a finger is down and still, re-run the move pipeline about every 60 ms. | High. Removes a false "lost". | Very low. Shell only. | Clarifies 4.2 / P5 | agy |
| I3 | **Overview on entry and honest hint.** "Right Triangle ABC. 3 corners, 3 sides. A top left, B bottom right, C bottom left." Then the gesture hint, without the untrue "You start at the centre". | High. Gives the map first. | Low. Pure text builder. | Amends 13.1, 13.3 | Kiro spec, agy code |
| I4 | **Near-line cue ("warmer").** Off the line but within about 48 px: soft clicks, faster and higher as I get closer; pan to the line's side as a bonus. Also plays during the corner quiet window when I am on an edge, so a right turn is confirmed at once. Audio only. | High. Fixes drift and recovery. | Medium. New pure machine, audio driver method, tuning on a phone. | New requirement | Kiro core, agy driver and wiring |
| I5 | **Where am I, without voice.** Hold still 1.2 s in silence, or press a button: "Open space, left of centre. Nearest: side CA, close, to your left." | High. | Low to medium. Needs I2's ticker and K1's helper. | Extends the command set | Kiro helper, agy |
| I6 | **No corner stutter.** Re-entering the same vertex inside the quiet window emits nothing. | Medium. | Low, but it is engine code. | Tightens 4.4 / P4 | Kiro |
| I7 | **Line name and heading on dwell.** Rest 0.8 s on a line: "Side AB. Up-left to A, down-right to B." | Medium to high. | Low after I1 and I2. | New criterion | agy on Kiro's helper |
| I8 | **Graph scan.** In a function graph, a finger off the curve still plays the curve's height at that x, quietly; on the curve it is full volume plus buzz. A plain sweep plays the whole shape. | High for graphs and for the demo ("count the peaks"). | Medium. Core helper, tone gain. | Amends Requirement 5 | Kiro core, agy audio |
| I9 | **Curve beats axis** when both are within reach. | Medium, graphs only. | Low. Hit priority change. | Amends 4.6 ordering note | Kiro |
| I10 | **Page edge cue.** One short earcon and "edge" when I leave the unit square. | Medium. | Low. | New criterion | agy |
| I11 | **Speech pacing.** Verbosity setting (full / short); a corner label is not cut by an axis word; bars use a short form when I move fast. | Medium. | Low to medium. | Extends 17.2 | agy; Kiro for a join property |
| I12 | **TalkBack tree says more.** Feature buttons read "Corner A, top left, joined to B and C". | Medium for swipe users. | Low. | Extends 13 | agy |
| I13 | **Turn Guide on.** Ship with `VITE_FEATURE_GUIDE=1` and the setting on by default. "Guide me to B" already works. | Medium. Zero code. | Needs a phone test of Guide first. Deployed value not checked (env files not read). | None | Owner |
| I14 | **Sticky line.** Once I follow a line, keep the buzz for that same line out to about 24 px. | Medium. Open-loop reach at 10 degrees goes from about 80 to about 138 px. | Touches the tuned 14 px line radius in spirit; blurs close parallel lines. **Owner approval and phone test required.** | Changes hit radius semantics | Kiro, only if approved |
| I15 | **Inside / outside** answer in "where am I" for closed shapes. | Low to medium. | Medium. | Extends I5 | later |

Rejected or parked:
- A second vibration pattern for "near the line". One motor, no strength control; it would blur
  into the line buzz and break product principle 3. Keep proximity in audio.
- True magnetic snap. The phone cannot move a finger. I14 is the honest version.
- Wider bar interiors. Would change Requirement 6.3 feel; I11's short form solves the real problem.

New numbers introduced by this plan (all proposed, none tuned, none replace an existing value):
near-line radius 48 px, click interval 90 to 400 ms, click pitch 500 to 1200 Hz, hold tick 60 ms,
dwell 800 ms on a line, 1200 ms in silence. **Each needs the owner's phone test, then a row in the
`tech.md` table marked "proposed, pending approval" like the centre tick.**

---

## 5. Order and dependencies

```
S0 (smallest high-impact slice)   A1 hold keep-alive   A2 overview + honest hint
S1                                K1 compass helpers -> A3 corner compass + dwell line name
                                  K2 corner stutter (independent)
S2                                K3 proximity machine -> A4 audio click + wiring
                                  (K1) -> A5 where-am-I by dwell and button
S3                                K4 curve priority + graph scan core -> A6 scan audio wiring
S4                                A7 pacing/verbosity, A8 edge cue + TalkBack labels
Optional, owner approval first    K5 sticky line
```

- S0 touches no core file and no tuned value. It is the only slice to consider before Nov 16.
- K1 unblocks A3, A5 and the labels in A8. Do K1 first on the Kiro side.
- A1 must land before A3's dwell part and before A5.
- One lane at a time in `frontend/src/screens/Explore.tsx` and `frontend/src/flow/explore.ts`
  (A1, A3, A4, A5, A6, A8 all touch them). Run those lanes in sequence, not in parallel.
- Each new cue gets a Settings toggle so the owner can switch it off for the demo.

---

## 6. Needs the owner, and what only a phone can show

Owner decisions:
1. Ship any of S0 before the STEMergent deadline, or hold everything until after Nov 16.
2. Requirement 13.3 conflict: relative cursor (spec) or absolute touch (code). This plan assumes
   absolute touch and corrected words.
3. Approve the new proposed numbers above for a phone trial.
4. I13: turn Guide on in the deployed build.
5. I14: sticky line (touches the tuned line radius in spirit).

Phone-only checks (OnePlus Nord CE and the budget phone):
- Does a resting finger send `pointermove` events? (Decides how much A1 matters; A1 is safe either way.)
- Does the 80 / 70 line buzz still feel continuous when driven by a 60 ms timer?
- Can I tell the near-line click from the theremin and from the Guide tone, on the speaker and on
  one earbud?
- Is the corner compass too long? Does it get cut by the next corner at normal tracing speed?
- With TalkBack on: does double-tap-hold-drag still deliver moves while clicks play; does the dwell
  timer fire; does TalkBack talk over the overview?
- Web Audio click latency, and speech start latency, on the budget phone.
- Are the model's gains real: time one eyes-closed triangle loop before and after S1 and S2.
- A blind or low-vision tester, even one, on S0 + S1. This is the only real proof.

---

## 7. KIRO WORKER TASKS

Kiro owns `frontend/src/core/`, `.kiro/specs/ghost-touch/*`, and the property tests. Use the next
free requirement, property and task numbers (last seen: Requirement 25, P87). Kiro ticks its own
boxes. No tuned value in `tech.md` changes in K1 to K4.

### K1. Compass helpers (pure) - do first

- Idea: one pure module that answers "what leaves this corner", "which way does this line run" and
  "what is nearest to this finger".
- Requirement idea: "WHEN the finger enters a vertex THEN the system SHALL speak the label followed
  by the direction of each edge that leaves it, in at most 8 compass words, omitting the edge the
  finger arrived on. WHEN the finger rests on a line THEN the system SHALL be able to name the line
  and both of its directions."
- Property ideas:
  - Exits are complete and exact: for any valid scene, `vertexExits(scene, id)` has one entry per
    segment that touches the point, no others, and never the point itself.
  - Direction is antisymmetric: the direction from A to B is the opposite of B to A, for any two
    distinct points.
  - Direction is invariant under uniform scale and translation of the scene.
  - Nearest is truly nearest: no element of the scene is closer than the one `nearestElement`
    returns; the returned vector has length equal to the returned distance; with `maxDist` the
    result is null exactly when nothing is within it.
  - Agreement with `hitTest`: whenever `hitTest` returns a line, `nearestElement` returns distance
    <= the line radius.
  - Total on bad input: NaN, infinite and dangling ids never throw.
- Acceptance: new file in `frontend/src/core/`, no DOM or React imports, named exports,
  properties at 200+ runs, all existing tests still pass.

```
Task: add pure compass helpers to the core (new requirement, design section, properties, task).

Read first: .kiro/steering/tech.md, .kiro/steering/structure.md, docs/reports/fable-blind-user-plan.md
(sections 2.3, 2.5 and 7 K1), frontend/src/core/hitTest.ts, frontend/src/core/geometry.ts,
frontend/src/guide/geometry.ts (reuse its 8-way HintKey idea; do not import from guide into core).

1. Spec: add a new requirement "Know where the line goes" to requirements.md with EARS criteria:
   corner speech lists the direction of each edge leaving the vertex, omits the edge arrived on;
   a line can be named with both of its directions; nearest element is available for any finger
   position. Add a design.md section and the properties below with the next free P numbers. Add a
   task to tasks.md.
2. Code: create frontend/src/core/compass.ts with named exports only:
   - type Compass8 = 'up'|'down'|'left'|'right'|'up-left'|'up-right'|'down-left'|'down-right'
   - directionOf(from: NormPoint, to: NormPoint): Compass8 | null   (null when the points coincide)
   - vertexExits(scene, pointId): { segmentId: string; toId: string; toLabel?: string; dir: Compass8 }[]
   - lineEnds(scene, lineId): { aId: string; bId: string; dirToA: Compass8; dirToB: Compass8 } | null  (segments only)
   - nearestElement(scene, finger: ScreenPoint, view: Viewport, maxDistPx?: number):
       { id: string; elementKind: 'vertex'|'segment'|'polyline'|'axis'|'bar-edge';
         distPx: number; dxPx: number; dyPx: number } | null
     (dx, dy point from the finger to the closest point on the element; screen y grows downward)
   Pure: no DOM, React, window, navigator, audio or speech. No `any`. y = 0 is the top, so "up" is
   smaller y.
3. Properties (fast-check, at least 200 runs each): exits complete and exact; direction
   antisymmetric; direction invariant under uniform scale and translation; nearest is truly nearest
   and its vector length equals distPx; null exactly when nothing is within maxDistPx; agrees with
   hitTest (a line hit implies distPx <= line radius); never throws on NaN, Infinity or dangling ids.
4. Do not change hitTest.ts, hapticEngine.ts or any value in the tech.md haptic table.
5. Run the frontend tests and tsc; report results and any property that found a real bug
   (note it for docs/BUILD_LOG.md).
```

### K2. No corner stutter

- Requirement idea: "WHEN the finger leaves a vertex and re-enters the same vertex before the quiet
  window of its last corner pulse has ended THEN the system SHALL NOT emit the corner pattern or the
  label again and SHALL NOT extend the quiet window."
- Property ideas: for any trace that stays within 40 px of one vertex for less than `quietMs`, the
  corner pattern is emitted at most once; a re-entry after `quietMs` still fires (reachability is
  kept); a different vertex always fires; P3, P4, P5, P6 still hold.
- Acceptance: uses only `quietMs` (450, unchanged). No new number. Add a regression test that
  replays "leave A along AC at 30 px/s with 2 px jitter" and expects exactly one corner pattern.
- Evidence: section 2.3 (3 fires median, up to 5; first line buzz delayed to 700 to 850 ms).

```
Task: stop the corner pattern from repeating when a slow or shaky finger crosses the vertex radius.

Read first: .kiro/steering/tech.md (tuned values: do not change any), frontend/src/core/hapticEngine.ts,
frontend/tests/hapticEngine.prop.test.ts, frontend/tests/haptic.corner.regression.test.ts,
docs/reports/fable-blind-user-plan.md section 2.3.

Problem: step() sets lastVertexId to null as soon as the target is not a vertex, so jitter on the
22 px boundary re-enters the same vertex and re-fires cornerPattern and the label, restarting the
450 ms quiet window each time.

1. Spec: add an acceptance criterion under Requirement 4 (or a new requirement) : re-entering the
   same vertex before the quiet window of its last corner pulse has ended emits no corner pattern,
   no label, and does not extend quietUntil. Add the property to design.md with the next free P
   number and a task to tasks.md.
2. Code: change step() in frontend/src/core/hapticEngine.ts only as much as needed (for example keep
   the id of the last fired vertex in EngineState and compare against quietUntil). Use quietMs as
   the only time constant. Do not add or change any value in DEFAULT_HAPTICS.
3. Properties: (a) any trace that hits one vertex, leaves and re-enters it within quietMs emits
   cornerPattern exactly once; (b) re-entry after quietMs fires again; (c) entering a different
   vertex always fires; (d) existing P3, P4, P5, P6 pass unchanged.
4. Regression test: leave vertex A of frontend/public/samples/triangle.json along AC at 30 px/s,
   60 Hz, with seeded 2 px jitter; expect exactly one corner pattern and the first line buzz no
   later than 450 ms + one retrigger after the corner.
5. Run the frontend tests and tsc; report results.
```

### K3. Proximity machine (pure) - the "warmer" cue

- Requirement idea: "WHEN the finger is not on any element AND the nearest line is within the
  near-line radius THEN the system SHALL play a click whose rate and pitch rise as the distance
  falls, with pan toward the line. WHEN the finger is on a line inside the corner quiet window THEN
  the system SHALL play the click at its closest setting. The cue SHALL be audio only and SHALL
  stop on lift, on a line hit outside the quiet window, and beyond the radius."
- Property ideas: no effect ever has kind `vibrate` (haptics stay distinct); closer never means a
  longer interval or a lower pitch (monotonic); pitch and interval always inside configured bounds;
  pan in [-1, 1] and its sign equals the sign of dx; nothing emitted beyond the radius or after
  lift; click gaps never shorter than the minimum interval for any input timing.
- Acceptance: new `frontend/src/core/proximity.ts` with its own config object (own constants, like
  `guide/config.ts`); `step`-shaped `proximityStep(state, input, cfg) -> { state, effects }`;
  effects are plain data `{ kind: 'click', hz, pan, gain }`.

```
Task: add a pure "near the line" cue machine (new requirement, design, properties, task).

Read first: .kiro/steering/tech.md, .kiro/steering/product.md (principle 3: haptics must stay
distinct), frontend/src/core/hapticEngine.ts, frontend/src/guide/machine.ts and guide/config.ts (same
shape, own constants), frontend/src/core/compass.ts (nearestElement from the previous task),
docs/reports/fable-blind-user-plan.md sections 2.2, 2.3, 3 and 7 K3.

1. Spec: new requirement "Find the line again" with EARS criteria: off every element and within the
   near-line radius -> clicks whose rate and pitch rise as distance falls, pan toward the line; on a
   line inside the corner quiet window -> clicks at the closest setting; audio only; stops on lift,
   beyond the radius, and on a line hit outside the quiet window. Mark every number as "proposed,
   pending owner approval" and add them to the tech.md table in a separate, clearly marked row
   (do not edit existing rows).
2. Code: frontend/src/core/proximity.ts, named exports:
   - ProximityConfig { radiusPx: 48, lineRadiusPx: 14, farMs: 400, nearMs: 90, loHz: 500, hiHz: 1200 }
     as DEFAULT_PROXIMITY
   - ProximityInput = { kind: 'move'; t: number; distPx: number | null; dxPx: number;
       onLine: boolean; inQuietWindow: boolean } | { kind: 'lift'; t: number }
   - ProximityEffect = { kind: 'click'; hz: number; pan: number; gain: number }
   - proximityStep(state, input, cfg = DEFAULT_PROXIMITY) -> { state, effects }
   Pure, no `any`, no browser API. Never emit a vibrate effect.
3. Properties (fast-check, 200+ runs): never a vibrate effect; interval and pitch monotonic in
   distance; all values inside configured bounds; pan in [-1, 1] with the sign of dxPx; no effect
   beyond radiusPx, after lift, or on a line outside the quiet window; gap between clicks is never
   below nearMs for any sequence of timestamps; NaN and Infinity inputs never throw and emit nothing.
4. Do not change hapticEngine.ts or hitTest.ts.
5. Run the frontend tests and tsc; report results.
```

### K4. Graphs: curve beats axis, and scan helper

- Requirement idea (amend Requirement 5): "WHEN a curve and an axis are both within the line radius
  THEN the curve SHALL be the target. In a function graph, WHEN the finger is not on a curve THEN
  the system SHALL be able to give the curve's height at the finger's x so the shell can play it
  quietly."
- Property ideas: with a polyline and an axis both within radius, `hitTest` never returns the axis;
  scenes with no polyline give exactly the previous answers (reuse the P52 frozen-copy style);
  `curveYAtX` returns a value in the polyline's y range, equals the point's y at any polyline
  point's x, is null outside the x range, and never throws; pitch from it stays in [200, 1000].
- Acceptance: vertex > line > bar > none order is kept; only the tie-break among lines changes.

```
Task: make a curve win over an axis in hit-testing, and add a pure helper for "curve height at x".

Read first: .kiro/steering/tech.md, frontend/src/core/hitTest.ts (findLine), frontend/src/core/pitch.ts,
frontend/tests/hitTest.perf.prop.test.ts (P52 frozen-copy pattern),
docs/reports/fable-blind-user-plan.md sections 2.7 and 7 K4.

1. Spec: amend Requirement 5 with two criteria: (a) when a polyline and an axis are both within the
   line radius, the polyline is the target; (b) in a function_graph the curve's height at the
   finger's x is available when the finger is off the curve. Add properties with the next free P
   numbers and a task.
2. Code:
   - hitTest.ts findLine: prefer a polyline candidate over an axis candidate when both are within
     radius. Keep "nearest wins, first wins a tie" inside each kind. Keep the no-allocation loop.
     Radii unchanged.
   - new frontend/src/core/curve.ts: curveYAtX(scene, xNorm): { polylineId: string; yNorm: number } | null
     using linear interpolation between neighbouring points; for several curves or a multi-valued
     curve return the candidate nearest to an optional yNorm hint argument, else the first.
3. Properties (200+ runs): axis never returned when a polyline is also within radius; scenes with
   no polylines answer exactly as the frozen previous hitTest; curveYAtX is within the polyline's y
   range, exact at polyline points, null outside the x range, never throws; pitchForY of its result
   is in [200, 1000].
4. Update any existing test whose expectation changes and say which ones and why.
5. Run the frontend tests and tsc; report results.
```

### K5. Sticky line (optional - only after the owner approves)

- Changes how the tuned 14 px line radius behaves. Do not start without a written yes.
- Idea: once a line has been the target for 200 ms or more, the same line stays the target out to
  `stickyRadius` (proposed 24 px) until another element is nearer or the finger lifts.
- Property ideas: a first touch still needs 14 px (acquisition unchanged); stickiness never hides a
  vertex (P2 holds); never survives a lift; a different line that is nearer always wins.

```
Task (only with owner approval recorded in docs/BUILD_LOG.md): sticky line following.

Read first: .kiro/steering/tech.md (the 14 px line radius is a tuned value), frontend/src/core/hitTest.ts,
frontend/src/core/hapticEngine.ts, docs/reports/fable-blind-user-plan.md section 4 (I14).

Add a requirement, properties and a task. Implement stickiness as a separate pure function that
wraps hitTest (for example followTarget(prevLineId, heldMs, scene, finger, view, radii, stickyRadiusPx))
so hitTest and DEFAULT_RADII stay untouched. Add the new value to tech.md as "proposed, pending
approval". Properties: acquisition still needs the line radius; a vertex within the vertex radius
always wins; a nearer different line always wins; no stickiness after lift; with stickyRadiusPx equal
to the line radius the wrapper equals hitTest exactly. Run tests and tsc; report results.
```

---

## 8. AGY WORKER TASKS

Lanes own everything outside `frontend/src/core/` and `.kiro/`. Every prompt forbids shell
commands; the orchestrator runs the gates (tsc, vitest, build, Playwright) itself. Lanes that touch
`Explore.tsx` or `flow/explore.ts` run one after another. Lane ids for branches and reports are
`bu1` to `bu8` (A1 = bu1, and so on), because `a1` and `a3` are already used by older lanes.

### A1. Hold keep-alive (S0)

- Scope: `frontend/src/screens/Explore.tsx`, `frontend/src/flow/explore.ts`, `frontend/tests/`.
- Acceptance: while the primary pointer is down, the move pipeline re-runs at the last position
  about every 60 ms if no `pointermove` arrived; the timer stops on lift, cancel, blur, hidden tab,
  Ask listening, Guide, and unmount; a test with fake timers shows a still finger on a line keeps
  getting `vibrate(80)` at gaps of 150 ms or less and a lift stops it; no change to engine output
  for a moving finger.

```
You are lane A1 (hold keep-alive). Do NOT run any shell command, terminal command, npm, npx, git or
script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/screens/Explore.tsx, frontend/src/flow/explore.ts, frontend/tests/**,
docs/reports/agy-bu1-hold-keepalive-report.md.
Forbidden: frontend/src/core/**, .kiro/**, tasks.md, .gitignore, any .env file, package.json.

Read first: docs/reports/fable-blind-user-plan.md section 2.4, .kiro/steering/tech.md,
frontend/src/flow/explore.ts (processPointerMove), frontend/src/screens/Explore.tsx
(handlePointerDown, handlePointerMove, handlePointerLift, applyMoveResult, visibility and blur handlers).

Problem: the haptic engine only runs on pointermove. A finger resting on a line gets no events, so
the 80 ms line buzz ends and the line seems to vanish.

Do:
1. In Explore.tsx, while the primary pointer is down, run a timer (60 ms) that calls the same move
   pipeline (processPointerMove + applyMoveResult) with the last known coordinates when no
   pointermove has been handled in the last 60 ms. Put any decision logic (for example
   "shouldKeepAlive(lastMoveAt, now, intervalMs)") in flow/explore.ts as a pure exported function.
2. Stop the timer on pointer up, cancel, lost capture, window blur, document hidden, when Ask
   listening is active, while Guide is guiding, on exit, and on unmount.
3. Do not change any haptic value, the engine, or hitTest.
4. Tests in frontend/tests/: with fake timers, a still finger on side CA of the triangle sample
   keeps receiving vibrate(80) with gaps of at most 150 ms for 2 s; after lift no further vibrate
   call happens; a still finger on a vertex gets the corner pattern once only; a still finger in
   empty space gets no vibrate.
5. Write docs/reports/agy-bu1-hold-keepalive-report.md: files changed, tests added, anything unsure.
```

### A2. Overview on entry and honest hint (S0)

- Scope: new `frontend/src/flow/overview.ts`, `frontend/src/i18n/index.ts`, the place that builds
  Explore's `announced` text (`frontend/src/App.tsx` / `frontend/src/flow/navigation.ts`), tests.
- Acceptance: entry speech is `{title}. {counts}. {where each labelled corner is, at most 6}.` then
  the gesture hint; "You start at the centre." is removed from the hint in en, hi and gu; graphs say
  "curve from left to right, x-axis across the middle"; bar charts say "4 bars, left to right: Q1,
  Q2, Q3, Q4"; Raw Mode keeps its own announcement; total text under about 40 words; the "describe"
  voice command reuses the same builder before the facts.
- Depends on the owner's decision on Requirement 13.3 (section 6, item 2). Kiro must amend 13.1
  wording in the spec; flag it in the lane report, do not edit `.kiro`.

```
You are lane A2 (overview on entry). Do NOT run any shell command, terminal command, npm, npx, git
or script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/flow/overview.ts (new), frontend/src/flow/commands.ts,
frontend/src/flow/navigation.ts, frontend/src/App.tsx, frontend/src/i18n/index.ts, frontend/tests/**,
docs/reports/agy-bu2-overview-report.md.
Forbidden: frontend/src/core/**, .kiro/**, tasks.md, .gitignore, any .env file, package.json.

Read first: docs/reports/fable-blind-user-plan.md section 2.6, .kiro/steering/product.md,
frontend/src/flow/commands.ts (getCoarsePosition, the 'describe' command), frontend/src/i18n/index.ts
(keys explore.gestureHint, pos.*), and how Explore's `announced` prop is built.

Do:
1. Create a pure function buildOverview(scene): string in flow/overview.ts (no React, no browser
   API). Output, through i18n keys in en, hi and gu:
   - geometry: title; "N corners, M sides"; then up to 6 labelled corners with their coarse position
     from getCoarsePosition ("A top left, B bottom right, C bottom left").
   - function_graph: title; number of curves; where the axes are in coarse words.
   - bar_chart: title; "N bars, left to right: Q1, Q2, ..." (up to 8 labels, sorted by x0).
   - unknown / Raw Mode: return an empty string (the Raw Mode announcement stays as it is).
   Keep it under about 40 words. Never read coordinates as numbers.
2. Speak the overview before the gesture hint when Explore opens, as ONE utterance (the speech driver
   cancels on each speak). Keep StatusText in step with it (Requirement 13.7, 13.8: no double reading).
3. Change explore.gestureHint in en, hi and gu: remove the sentence "You start at the centre." and
   its translations. Keep the rest. Update every test that asserts the old text.
4. Make the 'describe' voice command speak buildOverview(scene) and then the facts.
5. Tests: one per scene kind on the three samples in frontend/public/samples; every new key exists
   and is non-blank in en, hi and gu; overview has at most 40 words for scenes with up to 60 points.
6. Report in docs/reports/agy-bu2-overview-report.md, and list the spec lines Kiro must amend
   (Requirement 13.1 and 13.3 wording). Do not edit the spec yourself.
```

### A3. Corner compass and line name on dwell (S1; needs K1 and A1)

- Scope: `frontend/src/flow/explore.ts`, `frontend/src/screens/Explore.tsx`,
  `frontend/src/i18n/index.ts`, `frontend/src/components/LabSettings.tsx` (toggle), tests.
- Acceptance: entering vertex A on the triangle from side CA speaks "A. Down-right to B." (the
  arrival edge is skipped); landing on A from empty space speaks both edges; a vertex with more
  than 4 edges says the count instead of listing; the second visit within 10 s says only "A";
  the compass is joined with the label and any axis word into one utterance; resting 800 ms on a
  segment speaks "Side AB. Up-left to A, down-right to B." once per line visit; a "Directions"
  setting (default on) switches both off; the engine and its effects are unchanged.

```
You are lane A3 (corner compass). Do NOT run any shell command, terminal command, npm, npx, git or
script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/flow/explore.ts, frontend/src/screens/Explore.tsx,
frontend/src/i18n/index.ts, frontend/src/components/LabSettings.tsx, frontend/src/drivers/storage.ts,
frontend/tests/**, docs/reports/agy-bu3-corner-compass-report.md.
Forbidden: frontend/src/core/** (read only), .kiro/**, tasks.md, .gitignore, .env files, package.json.

Read first: docs/reports/fable-blind-user-plan.md sections 2.3, 2.5, 4 (I1, I7);
frontend/src/core/compass.ts (vertexExits, lineEnds, Compass8); frontend/src/flow/explore.ts
(mergeAnnouncements, joinAnnouncements, processPointerMove); the hold keep-alive timer from lane A1.

Do:
1. In flow/explore.ts add pure functions:
   - cornerCompass(scene, vertexId, arrivedLineId | null, visitedRecently: boolean): string
     Text after the label: one short clause per exit, e.g. "Down-right to B." Skip the segment the
     finger arrived on. More than 4 exits: say "{n} edges" only. visitedRecently: return ''.
   - lineName(scene, lineId): string, e.g. "Side AB. Up-left to A, down-right to B." Axes: "x-axis,
     left to right". Polylines and bar edges: their label only.
   All words through i18n keys in en, hi and gu (direction words: reuse or mirror guide.hint.*).
2. In Explore.tsx track the previous target (so the arrival line is known) and the last visit time
   per vertex (10 s window). When a move enters a vertex, pass cornerCompass text as an extra
   announcement to applyMoveResult so label and compass are one utterance.
3. Dwell: using the A1 timer, when the finger has stayed on the same line id for 800 ms and that
   line has not been named during this visit, speak lineName once. Leaving the line re-arms it.
   Never speak during the Ask listening window or while Guide is guiding.
4. Add a "Directions" toggle in settings (stored, default on) that disables both.
5. Do not change hapticEngine, hitTest or any haptic value. The vibrate and tone effects for a given
   trace must be identical with the toggle on and off: add a test that proves it.
6. Tests: the acceptance cases above on frontend/public/samples/triangle.json; keys present in en,
   hi, gu; compass text never longer than 12 words.
7. Report in docs/reports/agy-bu3-corner-compass-report.md.
```

### A4. Near-line click: audio driver and wiring (S2; needs K1, K3, A1)

- Scope: `frontend/src/drivers/audio.ts`, `frontend/src/drivers/index.ts`,
  `frontend/src/flow/explore.ts`, `frontend/src/screens/Explore.tsx`, settings, i18n, tests.
- Acceptance: `AudioDriver.playClick(hz, pan, gain)` plays a click of 30 ms or less through its own
  gain node (and panner when available), never touches the theremin oscillator, and is a no-op
  before unlock; `runProximityEffects` maps `click` effects to it; off the line within 48 px of the
  triangle the clicks get faster toward the line; on an edge inside the quiet window clicks play;
  no click while on a line outside the quiet window, during Ask, during Guide, or after lift; a
  "Finding sound" setting (default on); no `vibrate` call is added anywhere.

```
You are lane A4 (near-line click). Do NOT run any shell command, terminal command, npm, npx, git or
script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/drivers/audio.ts, frontend/src/drivers/index.ts,
frontend/src/flow/explore.ts, frontend/src/screens/Explore.tsx, frontend/src/components/LabSettings.tsx,
frontend/src/i18n/index.ts, frontend/tests/**, docs/reports/agy-bu4-near-line-click-report.md.
Forbidden: frontend/src/core/** (read only), .kiro/**, tasks.md, .gitignore, .env files, package.json.

Read first: docs/reports/fable-blind-user-plan.md sections 2.2, 3, 4 (I4);
frontend/src/core/proximity.ts (proximityStep, DEFAULT_PROXIMITY, ProximityEffect);
frontend/src/core/compass.ts (nearestElement); frontend/src/drivers/audio.ts (setTone, setGuideTone,
earcons, unlock); frontend/src/drivers/index.ts (runEffects, runGuideEffects).

Do:
1. audio.ts: add playClick(hz, pan, gain) to the AudioDriver interface (optional method) and to
   WebAudioDriver: a short (<= 30 ms) enveloped blip on its own oscillator and gain node, through a
   StereoPanner when the context has one, mono otherwise. It must not move or mute the theremin
   oscillator or the guide tone, must be silent before unlock, and must not throw.
2. drivers/index.ts: add runProximityEffects(effects, drivers).
3. flow/explore.ts: extend the move pipeline result with the proximity step: call nearestElement
   with DEFAULT_PROXIMITY.radiusPx, then proximityStep with distPx, dxPx, onLine (target is a line)
   and inQuietWindow (t < engine quietUntil). Keep the function pure.
4. Explore.tsx: hold the proximity state in a ref; run its effects after the haptic effects on down,
   move and the A1 keep-alive tick; send a lift on pointer lift, blur, hidden, exit and unmount.
   Skip while Ask is listening and while Guide is guiding.
5. Settings: "Finding sound" toggle (stored, default on), en, hi and gu strings.
6. Never call haptics.vibrate from this feature. Do not change any haptic value.
7. Tests: fake audio context shows playClick does not touch the theremin nodes; a trace moving from
   45 px to 15 px off side CA gets clicks with shrinking gaps; no clicks beyond 48 px, on a line
   outside the quiet window, after lift, with the toggle off; the vibrate calls of a fixed trace are
   identical with the toggle on and off.
8. Report in docs/reports/agy-bu4-near-line-click-report.md, with the list of values the owner must
   tune on the phone.
```

### A5. Where am I, by dwell and by button (S2; needs K1 and A1)

- Scope: `frontend/src/flow/commands.ts`, `frontend/src/screens/Explore.tsx`, i18n, tests.
- Acceptance: "where am I" answers with coarse position plus the nearest element and its side:
  "Left of centre. Nearest: side CA, close, to your left." (uses the existing
  `commands.whereNearLine` idea; distance in three words: touching, close, far); on a line it says
  the line name; holding still 1200 ms in silence speaks the same answer once per rest, never
  during speech that started under 1.5 s ago, Ask, or Guide; a visible, labelled 48 x 48 px
  "Where am I" button does the same using the last finger position; works in en, hi and gu.

```
You are lane A5 (where am I). Do NOT run any shell command, terminal command, npm, npx, git or
script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/flow/commands.ts, frontend/src/flow/explore.ts,
frontend/src/screens/Explore.tsx, frontend/src/styles/explore.css, frontend/src/i18n/index.ts,
frontend/tests/**, docs/reports/agy-bu5-where-am-i-report.md.
Forbidden: frontend/src/core/** (read only), .kiro/**, tasks.md, .gitignore, .env files, package.json.

Read first: docs/reports/fable-blind-user-plan.md sections 2.6 and 4 (I5);
frontend/src/flow/commands.ts ('where_am_i' in executeExploreCommand, getCoarsePosition);
frontend/src/core/compass.ts (nearestElement, directionOf); the A1 keep-alive timer.

Do:
1. commands.ts: build one pure function whereAmI(scene, view, cursorNorm): string and use it for the
   'where_am_i' command. Content: coarse position; then the nearest element from nearestElement with
   no distance cap: its name ("side CA", "corner B", "the curve", "x-axis", "bar Q2"), a distance
   word (touching <= 14 px, close <= 60 px, far otherwise) and the side it is on in one compass word
   ("to your left"). Empty scene: position only. All words through i18n in en, hi and gu.
2. Explore.tsx: with the A1 timer, when the finger has rested (moved < 6 px) for 1200 ms on a 'none'
   target, speak whereAmI once; re-arm after the finger moves 20 px or lifts. Do not fire while
   speech that started less than 1500 ms ago may still be playing, while Ask is listening, or while
   Guide is guiding.
3. Add a "Where am I" button to the Explore controls: accessible name, at least 48 x 48 px, speaks
   whereAmI for the last finger position (centre if none yet).
4. Do not change haptics, the engine or hitTest.
5. Tests: answers for a finger 30 px left of side CA, on side AB, on corner B, in a far corner of the
   canvas, on the sine sample and on the bar sample; dwell fires once per rest and not during Ask or
   Guide; keys present in en, hi and gu; the a11y target-size test covers the new button.
6. Report in docs/reports/agy-bu5-where-am-i-report.md.
```

### A6. Graph scan audio (S3; needs K4)

- Scope: `frontend/src/drivers/audio.ts` (tone gain), `frontend/src/flow/explore.ts`,
  `frontend/src/screens/Explore.tsx`, settings, i18n, tests.
- Acceptance: in a `function_graph`, a finger inside the curve's x range but off every line hears
  the curve's pitch at that x at about one third of the normal gain; on the curve it is full gain
  plus the unchanged line buzz; outside the x range and on lift it is silent; an axis hit still
  buzzes and keeps the quiet scan tone; a "Graph scan" setting (default on); other scene kinds
  behave exactly as before.

```
You are lane A6 (graph scan). Do NOT run any shell command, terminal command, npm, npx, git or
script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/drivers/audio.ts, frontend/src/drivers/index.ts,
frontend/src/flow/explore.ts, frontend/src/screens/Explore.tsx, frontend/src/components/LabSettings.tsx,
frontend/src/i18n/index.ts, frontend/tests/**, docs/reports/agy-bu6-graph-scan-report.md.
Forbidden: frontend/src/core/** (read only), .kiro/**, tasks.md, .gitignore, .env files, package.json.

Read first: docs/reports/fable-blind-user-plan.md sections 2.7 and 4 (I8); frontend/src/core/curve.ts
(curveYAtX); frontend/src/core/pitch.ts (pitchForY); frontend/src/drivers/audio.ts (setTone).

Do:
1. audio.ts: let the theremin tone take an optional level (setTone(hz, level = 1), level in [0, 1]
   scaling the existing on-gain). Keep the existing time constants and the default behaviour.
2. flow/explore.ts: pure function scanTone(scene, target, xNorm, yNorm): { hz: number; level: number } | null.
   Only for kind 'function_graph'. Target is the polyline: null (the engine already plays it at
   full level). Otherwise use curveYAtX(scene, xNorm, yNorm): if it returns a value, hz =
   pitchForY(yNorm of curve), level 0.33; else null.
3. Explore.tsx: after running the engine effects for a move, if scanTone is not null call
   setTone(hz, level); the engine's own tone(null) for that move must not win. On lift, blur, hidden,
   Ask and Guide the tone stops as today.
4. Settings: "Graph scan" toggle (stored, default on), strings in en, hi and gu.
5. Do not change haptics. Vibrate calls of a fixed trace must be identical with the toggle on and off.
6. Tests: a horizontal sweep at y = 0.25 across frontend/public/samples/sine.json yields a tone at
   every sample inside the curve's x range, rising then falling then rising in pitch as the curve
   does; level is 1 on the curve and 0.33 off it; silent outside the x range; triangle and bar
   samples produce no scan tone.
7. Report in docs/reports/agy-bu6-graph-scan-report.md.
```

### A7. Speech pacing and verbosity (S4)

- Scope: `frontend/src/flow/explore.ts`, `frontend/src/screens/Explore.tsx`, settings, i18n, tests.
- Acceptance: a "Speech detail" setting (full / short); in short mode corners say the label only
  and bars say the label only when the previous bar was announced under 700 ms ago, then the value
  after a 500 ms rest on the bar; an axis word arriving within 600 ms of a corner or bar
  announcement is dropped rather than cutting it; "x-axis" is not repeated within 2 s. Evidence:
  sections 2.7 and 2.8.

```
You are lane A7 (speech pacing). Do NOT run any shell command, terminal command, npm, npx, git or
script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/flow/explore.ts, frontend/src/screens/Explore.tsx,
frontend/src/components/LabSettings.tsx, frontend/src/i18n/index.ts, frontend/tests/**,
docs/reports/agy-bu7-speech-pacing-report.md.
Forbidden: frontend/src/core/**, .kiro/**, tasks.md, .gitignore, .env files, package.json.

Read first: docs/reports/fable-blind-user-plan.md sections 2.7, 2.8, 4 (I11);
frontend/src/flow/explore.ts (mergeAnnouncements, checkAxisCrossing); frontend/src/drivers/speech.ts.

Do:
1. Add a pure pacing function in flow/explore.ts, paceSpeech(state, { t, text, source }) ->
   { state, speakNow: string | null }, with source in 'corner' | 'bar' | 'axis' | 'other'. Rules:
   an 'axis' text within 600 ms after a 'corner' or 'bar' text is dropped; the same axis word is not
   repeated within 2000 ms; in short mode a 'bar' text that follows another bar within 700 ms is
   reduced to its label, and the full "label, value" is spoken after the finger has rested on that
   bar for 500 ms (use the keep-alive timer); corners in short mode speak the label only.
2. Add a "Speech detail" setting (full / short, stored, default full), strings in en, hi and gu.
3. Do not drop or reorder anything in full mode except the axis rules above. Do not change haptics.
4. Tests: the bar sweep at 120 px/s on frontend/public/samples/barchart.json in short mode never
   cuts a label; tracing the x-axis with 8 px wobble on the sine sample says "x-axis" at most twice
   in 3.3 s; a corner label is never followed by an axis word within 600 ms.
5. Report in docs/reports/agy-bu7-speech-pacing-report.md.
```

### A8. Page edge cue and richer TalkBack labels (S4; labels need K1)

- Scope: `frontend/src/flow/explore.ts`, `frontend/src/flow/a11yFeatures.ts`,
  `frontend/src/screens/Explore.tsx`, i18n, tests.
- Acceptance: leaving the unit square plays the existing "back"-style short earcon and says "Edge,
  top" (or bottom, left, right) once per exit, re-armed after coming 20 px back inside; landing
  outside says it once; TalkBack feature buttons read "Corner A, top left, joined to B and C",
  "Side AB, from top left to bottom right"; the feature cap of 60 is unchanged.

```
You are lane A8 (edge cue and TalkBack labels). Do NOT run any shell command, terminal command, npm,
npx, git or script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/flow/explore.ts, frontend/src/flow/a11yFeatures.ts,
frontend/src/screens/Explore.tsx, frontend/src/i18n/index.ts, frontend/tests/**,
docs/reports/agy-bu8-edge-talkback-report.md.
Forbidden: frontend/src/core/** (read only), .kiro/**, tasks.md, .gitignore, .env files, package.json.

Read first: docs/reports/fable-blind-user-plan.md sections 2.1, 2.6, 4 (I10, I12);
frontend/src/flow/a11yFeatures.ts; frontend/src/core/compass.ts (vertexExits, lineEnds);
frontend/src/flow/commands.ts (getCoarsePosition).

Do:
1. flow/explore.ts: pure tracker checkPageEdge(normPos, state) -> { spoken: string | null; nextState }.
   It fires when the finger goes outside [0, 1] on either axis and names the side; it re-arms only
   after the finger is back inside by at least 20 px worth of normalized distance (pass the viewport
   scale in). Seed it on pointer down: landing outside speaks once.
2. Explore.tsx: run it in the move pipeline, join its text with the other announcements into one
   utterance, and play one short existing earcon. No vibration.
3. a11yFeatures.ts: richer labels. Points: "Corner {name}, {coarse position}, joined to {names}".
   Segments: "Side {name}, from {coarse position of a} to {coarse position of b}". Keep bars, curves
   and axes as they are. Keep MAX_A11Y_FEATURES and the share-out logic unchanged.
4. Strings in en, hi and gu. Do not change haptics, the engine or hitTest.
5. Tests: edge cue once per exit on all four sides and not again until re-armed; labels for the
   triangle sample; existing a11y feature tests updated for the new wording.
6. Report in docs/reports/agy-bu8-edge-talkback-report.md.
```

---

## 9. After each slice

- Gates the orchestrator runs: `tsc`, `vitest`, build, backend untouched, Playwright in `frontend/`.
- Owner phone check per slice: one eyes-closed triangle loop timed, one sine sweep, one bar sweep,
  once with TalkBack on. Write the times next to the model numbers in section 2.10.
- Log each lane and each Kiro task in `docs/BUILD_LOG.md` with the tool that did it. This report
  itself still needs a BUILD_LOG entry (tool: Claude Code, kind: review/plan); I was limited to
  writing this one file.
