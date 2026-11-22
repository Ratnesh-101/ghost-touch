# Round 2: D (Ghost Walk) vs C (Ghost Hand)

C's citations check out: `fable-persona-verma-teacher.md:327`, `fable-persona-amara-blind-student.md:335`, `hapticEngine.ts:181` (polyline tone), `addPoint` and `addSegment` (`core/correct.ts:284`, `:310`), `historyReducer` (`:404`), `describeUndo` (`flow/ghostwriter.ts:197`), the zero-drawable reject (`share/validate.ts:~501`) and `TWO_FINGER_LONG_PRESS_MS = 600` (`flow/explore.ts:491`). So I am attacking the design, not the citations.

## 1. My three strongest attacks on Ghost Hand

**A1. The self-check ("a straight line sounds like a steady glide, a wrong point sounds like a jump") does not hold in the engine as it is.**
- Every pin is a scene `Point` (C step 3). `hitTest` gives vertex priority over line (tech.md: "Vertex hits take priority").
- On entering a new vertex, `step()` vibrates the corner pattern, speaks the label, emits `tone(null)` and opens the 450 ms quiet window (`hapticEngine.ts:139-163`).
- Take the homework line y = 2x + 1 at the smallest allowed cell (48 px). Each piece between pins is about 107 px long (48 × √5). About 44 px of it lies inside the two 22 px vertex radii. So roughly 40% of the trace has the tone off, and the student hears "(0, 1)", "(1, 3)", "(2, 5)", "(3, 7)" spoken over the glide.
- `joinInOrder` makes the polyline pass through every pin, so the curve is continuous and the pitch **never jumps**. A wrong pin only changes how fast the pitch rises. That rate also depends on how fast the finger moves, and a blind tracer cannot keep that steady. Hearing a slope change under these conditions is not shown anywhere, and C gives no property for it.
- C's own "it's alive" verification moment rests on this claim.

**A2. The split tap collides with TalkBack, and the fallbacks undo the hands-free promise.**
- The only TalkBack evidence in the repo (`docs/research/talkback-spike.md:11`) is pass-through: double-tap, hold, then drag. It gives **one** virtual finger, starts at the centre of the focused element, and moves **relatively**.
- Under pass-through there is no second pointer to tap with. Hold-one-finger-and-tap-another is also TalkBack's own split-tap activation gesture (general TalkBack behaviour, not tested in this repo). So the split tap is a sighted-mode gesture, and with relative movement, landing an exact grid crossing under TalkBack is unproven.
- `splitTap.ts` is only disjoint from the long-press detector because the detector needs both pointers held 600 ms (`explore.ts:499-517`). That is safe, but nothing stops a palm.
- The fallbacks have costs. "Pin here" needs a lift and a button press, and the button sits on the same canvas the finger is exploring. Voice "pin" means saying your homework out loud in class. That is the exact objection I28 raised about Ask.

**A3. It is a big new build that rebuilds Explore's fragile hold layer and overlaps Teach.**
- `Build.tsx` "reuses `hitTest`, `step` and `runEffects`". But axis-crossing speech, the keep-alive, lift-means-quiet, the page edge and where-am-I all live in `Explore.tsx` (2,686 lines) and `flow/explore.ts`, not in core.
- The improvement report's theme 2 is that exactly this glue breaks when it is copied: tests drove "a copy of the screen glue" while bugs I01 to I08 existed.
- Point and edge authoring already ships for teachers. `Teach.tsx:369`, `:383` and `:694-701` use the `flow/ghostwriter.ts` mode machine (idle, addPoint, addEdgeFirst, addEdgeSecond), so Ghost Hand is largely Ghostwriter on a grid for students.
- Export is untested. `drivers/clipboard.ts:73-95` shares `{title, text, url}` only. It has no `files` and no `canShare({files})` check, so `drivers/exportImage.ts` and a file share are new and unproven on Android Chrome. C admits this.
- Scope: a new screen, route, gesture classifier, export driver, grid model and a fact-line convention, plus a Kiro parser rule. That is four or five lanes, not three.

## 2. Attacks I expect from C, and my answers

| C's likely attack | Answer (verified) |
|---|---|
| "Another lane in the serialized Explore bottleneck" | True, and it is my biggest cost. The logic goes in `core/ghostWalk.ts` plus `flow/chase.ts`. Explore gets one button, one draw call and one pointer branch. If the owner prefers, Chase can be its own small route that reuses the same core, still far smaller than Build. |
| "Few real scenes are walkable" | Equation graphs are sampled by x in Python (`backend/app/graphs/sample.py:103`, breaks at asymptotes, `JUMP_FRACTION`), so they are x-monotonic by construction. The sine sample is too (100 points, x from 0.1 to 0.9, checked). `isWalkable` hides Chase on anything else. Correction to my pitch: curves can have up to 400 points (`MAX_SAMPLES`), not 150. One tick is still O(400). |
| "A blind student cannot keep a constant horizontal pace" | That is why the ghost is patient. Time only moves while the finger is on the ghost, or for 1 s after losing it. |
| "Breaks ruling 1, no new cue" | It adds no new value. The vibrate set {80, 0} is a property. It is a mode the student enters on purpose, the same defence C uses. |
| "The 22 px catch radius is a reused number with a new meaning, never felt" | Agreed. It ships as PROPOSED, like sticky and heartbeat, with a phone-test row. |
| "Pure demo, no lasting output" | The output is understanding that gets examined. Distance-time and velocity-time graphs are graded content. The end summary (`motionStory`) answers "where was it fastest, when at rest". |
| "Chase fights Explore's axis speech and keep-alive" | The pointer branch hands moves to `chaseStep` only. Axis speech and keep-alive are paused for the length of the mode, and that pause gets an oracle test. |

## 3. One improvement: Ghost Race (comparison, the most common exam question)
Distance-time questions are usually "A and B: who is faster, who started later, when do they meet?" Many such graphs have two lines. Every polyline already has its own `id` and optional `label` (`schema.py:49-59`), so this change needs nothing new from the schema.
- On a scene with two or more walkable polylines, Chase walks each ghost in turn on the same clock.
- The summary compares them: "B's ghost climbed faster. A rested; B never did. They were level near the middle."
- It is pure and property-testable: `raceStory(polylines)` swaps names when the inputs are swapped, and says "level" exactly where the curves are within half the catch radius.
- It adds no new cue and no backend change, and gives `walk.json` a second walker for the demo.
