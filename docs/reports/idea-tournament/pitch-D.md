# Pitch D (wild card): GHOST WALK

## Name and one-line hook
**Ghost Walk.** The graph's ghost walks the curve in real time. Keep your finger on it and your hand does the motion the graph describes: a distance-time graph turns into a movement you make with your own arm.

## The problem
Every Ghost Touch cue today is **static**. You can feel *where* a curve is, but not *how it changes over time*, and that is what most graphs in physics and early calculus are about. Example: CBSE Class 9 Science, chapter "Motion". A distance-time graph of a girl walking to school: a gentle climb, a flat part (she stops at a shop), then a steep climb (she runs because she is late). The exam question asks "Where was she fastest? When was she at rest?" A blind student tracing it in Explore feels three straight lines joined at two corners. "Steep means fast" stays a rule to memorise. Sighted students *see* the slope. In good physics labs they also *walk* it: the classic "graph matching" activity with a motion sensor (Thornton and Sokoloff, 1990s microcomputer-based labs). The same gap shows up for sine (where is it changing fastest?), velocity-time graphs, cooling curves and population growth. Nothing in the repo covers it. `grep` finds no moving target, no slope or shape description in `flow/overview.ts`, and `guide/` only steers to *fixed* points. This is not in the improvement report backlog and was not pitched in `feature-tournament.md`.

## How it works and feels
1. On a `function_graph` scene, Explore offers a **Chase** button (48 px, footer) and a voice command "chase". Neither appears on geometry or bar scenes in v1.
2. Speech: "The ghost waits at the left end of the curve. Find it." The ghost is a point on the curve, at its leftmost x. The student finds it with the cues that already exist: line buzz on the curve, and near-line clicks if they are on. Once the finger rests on the ghost for 500 ms, the app says **"Go."**
3. **Time is the x-axis.** The ghost moves right at a constant x speed (whole curve in 10 s), always exactly on the curve: `y = curveYAtX(x)`. So its vertical speed *is* the slope.
4. While the finger is within the catch radius of the ghost you feel the **tuned line buzz** (`vibrate(80)` every 70 ms) and hear the **theremin at the ghost's height** (`pitchForY`). Lose it and the buzz stops, but the tone keeps singing the ghost's height at the existing graph-scan level 0.33, so you know whether to go up or down.
5. **The patient ghost:** after 1 s lost, the ghost stops and waits. After 1.5 s it speaks one direction word from the existing `core/compass.ts` `directionOf`. When you catch it again it moves on. Any student can finish, and nobody fails a timer.
6. On the flat part your hand **stops** while the buzz goes on, so you are holding still and still on the ghost. On the steep part your hand **shoots up**. On a sine wave your hand moves fastest at the zero crossings and pauses at the peaks: the derivative, felt in the shoulder.
7. At the end, one sentence: score plus shape story. "You stayed with the ghost 84 percent of the way. It climbed slowly, stood still, then climbed fast." The story comes from a pure `motionStory()` over the polyline slopes (flat, slow, fast, falling).
8. Lift = the ghost pauses and the app goes quiet (it obeys "lift means quiet"). Back or "stop" leaves the mode, and free Explore comes back exactly as before.

**No new haptic or audio value.** Chase reuses the tuned line buzz, the theremin range, the 0.33 scan level, the 22 px vertex radius as the catch radius, and existing direction words. This respects ruling 1 of the improvement report ("no new cue"): it is a new *mode* built from existing cues, entered on purpose, and free Explore does not change.

## Frankenstein fit
The name of the app finally comes true. Until now "ghost" was a metaphor. Here the creature's ghost **leaves the body and walks the diagram**, and you chase it with your finger. All three stitched organs work at once, in time: the **eyes** (vision LLM) supply the curve, the **voice** (theremin) sings where the ghost is, and the **nerves** (buzzer) tell you that you have hold of it. Halloween stays in the creature: the student is the ghost hunter, never the spooky one.

## What to build
Next free numbers are about Requirement 51, P159 and task 84 (re-check before use).
**Kiro, pure core (`frontend/src/core/ghostWalk.ts`, new, imports `curve.ts`, `pitch.ts`, `geometry.ts`, `compass.ts`, `hapticEngine.ts` config):**
- `isWalkable(scene)`: a `function_graph` with a polyline that is x-monotonic and wide enough. AI curves that loop back (a circle mislabelled as a graph) get no Chase.
- `ghostAt(scene, polylineId, progress)` gives a normalized point. `chaseStep(state, {t, finger | null, viewport}, cfg)` gives `{state, effects}` in the engine's effect shape (vibrate, tone, speak-key).
- `motionStory(points)` returns i18n keys only. `chaseScore(state)` returns 0 to 100.
- Spec, `.kiro/steering` note, and properties for: ghost x is non-decreasing over time; the ghost is always on the polyline (distance 0); every vibrate pattern is in {80, 0} (**no new haptic value can sneak in**); no buzz faster than `retriggerMs`; no vibrate or tone while lifted; progress never advances while waiting past the lost limit; a finger trace equal to the ghost path scores 100; `motionStory` does not change under vertical shift or x-scaling. The existing `run-tests-on-core-save` hook fires on this file, so it doubles as hook evidence.

**agy, shell:**
- `frontend/src/flow/chase.ts` (new): ticker every 50 ms on `performance.now()`, feeds `chaseStep`, runs effects through `runEffects`.
- `screens/Explore.tsx` (one EX lane): the button, glowing ghost dot on the canvas (also helps low-vision viewers and the video), and the pointer hand-off.
- `flow/commands.ts` ("chase", exact match). `core/help.ts` sentence (Kiro). i18n keys in en, hi and gu, plus `translation-review.csv`.
- New sample `walk.json` (distance-time graph: walk, rest, run) in `frontend/public/samples/` and `backend/fixtures/`, with a Pydantic validation test. Capture gets a fourth sample button.
- **No backend, schema or provider change.**

## The 20-second demo
Blindfolded volunteer, `walk.json`. Tap Chase, then "Go". The camera shows the green ghost dot sliding along the curve and her fingertip riding it. Her hand creeps up, **freezes** (buzz still going), then **jumps** up as the theremin climbs. The phone says: "84 percent. Climbed slowly, stood still, then climbed fast." Caption: *"Her hand just performed the graph."* No other feature in the app is so easy to understand on video without sound.

## Risks and why they are survivable
- **Too hard to keep up on a phone:** the patient ghost waits, so a run always ends. Catch radius and duration are config values, PROPOSED until a phone test, the same way sticky and heartbeat ship.
- **Timer jitter on budget phones:** position comes from elapsed time, not frame count, and each tick is one `curveYAtX` call (O(points), at most 150).
- **Bad AI curves:** `isWalkable` hides Chase. Samples and teacher-corrected scenes still work.
- **Another lane in the busy `Explore.tsx`:** the logic sits in `core/ghostWalk.ts` and `flow/chase.ts`. Explore gets one button, one draw call and one pointer branch.
- **Nothing felt on a phone yet:** true of every recent cue. The owner adds a five-minute "Chase on walk.json and sine" row to `docs/PHONE_TEST.md`, and docs call it experimental until then.

## Why this should beat the other three
1. **It opens a new dimension, not just a new cue.** Every other idea can only add to *space*. Ghost Walk adds *time*. Motion, rates and derivatives are a big part of the physics and calculus syllabus, and today the app cannot touch them.
2. **It rests on proven teaching.** Graph matching with a motion sensor is an established physics-lab method. Ghost Walk brings it to blind students on a phone they already own.
3. **It fits the theme better than anything else could:** an app called Ghost Touch where you literally touch a ghost.
4. **It is cheap and honest:** zero new tuned values, zero backend, and one pure module packed with properties for Kiro (which strengthens the Kiro score). The demo shot reads in silence.
