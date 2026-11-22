# Round 2: B (Planchette) vs A (Ghost Skin)

Every claim below was checked in the repo on 2026-11-22. Nothing was run on a phone.

## 1. Three attacks on Ghost Skin

**Attack 1: the purr is buried under two louder sounds that Ghost Skin's own preset turns on.**
- Ghost Skin is on only in Explorer (pitch-A line 32).
- `core/presets.ts:47-54`: Explorer also turns on `findingSound: true` and `graphScan: true`.
- `flow/explore.ts:124-140` (`scanTone`): on a `function_graph`, any finger that is not on the curve or a vertex gets the curve tone at **level 0.33** wherever `curveYAtX` has a value. That is the whole area under the sine, which is exactly where the purr is meant to play.
- Pitch-A's "when it is silent" list (line 16) never mentions graph scan.
- On the triangle, A's own number does the damage. The inradius is 54 px and clicks fire within 48 px of a line (`core/proximity.ts:33`). The part of the inside farther than 48 px from every edge is a similar triangle scaled by (54-48)/54 = 0.11, which is about 1% of the area. So on about 99% of the inside the purr runs at half gain, 0.04, under clicks at 0.3 to 0.6 (`proximity.ts:43-45`). That is 17 to 23 dB down.
- On the sine (`samples/sine.json`): the axis sits at y 0.5 and the curve peaks only 0.3 away, so most of each hump is within 48 px of the curve or the axis as well.
- In practice, the place the purr is supposed to fill is already full of two louder sounds.

**Attack 2: "she has felt the signed integral" is not true. The purr carries sign and width, not area.**
- The purr has two fixed rates, 8 Hz and 3 Hz (pitch-A lines 13-14). Height does not change it.
- A tall narrow hump and a low wide hump of equal area purr for different times. A tall hump and a short hump of equal width purr exactly the same.
- "Same length, so they cancel" (demo, line 58) only works on a symmetric sine, and only if the volunteer sweeps both humps at the same speed. The duration is set by the hand, not the graph.
- The volunteer's line "The integral is zero" is coached. A judge who knows calculus will notice.
- The x-axis is itself a line target (`core/hitTest.ts:37`, `'axis'`). "Sweep just above the axis" (line 57) means either the 14 px axis buzz (purr silenced) or the click zone (purr halved).

**Attack 3: a new audio cue that nobody hears, by the owner's own rulings.**
- Improvement report ruling 1: "No new cue before Dec 5."
- Owner decision OD-2 (`opus-owner-decisions-2026-11-18.md:112`) took Finding sound out of Standard because nobody had heard it on a phone next to the theremin. It goes back on only after a phone test shows the two can be told apart.
- Ghost Skin adds a third untested layer (165 Hz carrier, 8 and 3 Hz pulses, gain 0.08). It is OFF by default and Explorer-only.
- So in the shipped app no student hears it, and the demo must switch on a preset whose other members are still waiting for owner approval (`tech.md` PROPOSED rows).
- Coverage is also narrow. `backend/app/schema.py` has no circle or arc type (Point, Segment, Polyline, Bar, Axes only), so the most common area chapter in NCERT, area of circles and sectors, cannot be expressed at all.

## 2. Attacks I expect from A, and my answers

| A's attack | Answer (verified) |
|---|---|
| "AI cost and hallucination." | Template walks use no AI and work offline. Model walks are accepted only after code checks: each anchor must be a real element id, each `calc` is evaluated by `graphs/expr.py`, every spoken number must appear in the facts, and the walk is refused if Spec Ghost disputes a side. If any check fails, the student gets today's plain Ask answer. |
| "Facts parse on only ~35% of scenes, so walks rarely exist." | That number (README:173) was measured on older scenes. The extraction prompt now requires `'AB = 3 cm'`-shaped facts (`vision/prompts.py:24-27`), and the parser matches reversed names, so AC matches segment CA (`core/verify.ts:208`). Where facts are missing, the walk says so and falls back. |
| "More speech; Amara wants less." | Nothing plays unless the student asks. One sentence per step, paced by her "next step". Lifting the finger or saying "stop" ends it. |
| "Depends on Guide, which is off and untested." | It does not depend on Guide. The main path is: explore until `hitTest` reports the anchor. Guide is an optional extra. |
| "Your trigger collides." | **Correct, and I accept it.** "show me" is already a Guide prefix (`guide/semantic.ts:57`, "show me B" guides to B), and "Show me" is the name of the highlight feature (Req 49, `core/highlight.ts:2`). The fix: trigger on "why ..." or "walk me through ...", plus the visible button, renamed "Walk me through". |
| "The demo is circular: the triangle already states AB = 5." | The template must leave out the target fact as a premise: it proves AB from CA = 4, BC = 3 and the right angle at C. That becomes a property: no walk cites its own conclusion. Spec Ghost already shows these facts are consistent (feature-tournament.md:7). |
| "Finding each anchor without Guide is slow on a busy diagram." | See the improvement below: each "find" line names the anchor's position in coarse words using the existing `getCoarsePosition` (`flow/commands.ts:420`). |

## 3. One improvement: "Your turn"

After a walk ends, the creature offers: "Your turn. Touch the side opposite the right angle." The same reducer then runs in reverse. It names a step's role, waits for a `hitTest` hit, and answers with the anchor's own name. On a wrong element it says "That is BC. Try again", at most twice, then gives the answer.
- This turns the explanation into **active recall**, so it is a tutor, not a narrator.
- It needs no new cue, no AI call and no new screen.
- Kiro gets a clean property: a correct touch always advances, and a wrong touch never does.

The "find" line also gets a coarse position ("Find side CA, on the left"). Together these close the two weakest points above: slow searching, and a student who only listens.
