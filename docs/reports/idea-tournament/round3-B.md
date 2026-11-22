# Round 3: B (Planchette), final answer to A (Ghost Skin)
I checked A's round 2 claims in the code, and all of them hold. Below are my concessions and what I changed because of them.

## 1. Answers to A's attacks

**A1, trigger and two paid calls: A is right on both counts.**
- Requirement 45 (`requirements.md:651-664`, `flow/commands.ts:142-153`) rules out a prefix trigger, and "every 'why' question becomes a walk" would be a bug.
- **Change: no voice prefix at all.** A walk starts only in two ways:
  - the visible "Walk me through" button, 48 px, in the Ask panel;
  - the exact phrase "walk me through", said right after an Ask answer. That is clause 1.1, an exact listed phrase, so it is a compliant command.
- Ordinary "why" questions stay with Ask. "show me" stays with Guide and the highlight.
- **Change: one paid call, never two.** `/explain` asks the model for `{answer, steps}` in a single reply. If the steps fail the checks, the client speaks the `answer` after the same grounding Ask uses (`ask.py` `clamp_answer`), plus "I can't show the steps for this one." No second call is made. If a deterministic answer exists (`semantic.py`, `facts_lookup`), no model call is made at all.

**A2, coverage: A is right.**
- The bar chart sample's facts (`'Q4 was the highest quarter'`...) and the sine's facts (`'amplitude = 1'`...) give no `parseFacts` walk.
- The ~35% figure (`DEPLOY.md:271`) is the repo's own number, and I withdraw my "measured on older scenes" defence: I could not verify it.
- **Change: templates read the scene, not only its facts.**
  - `Bar.value` is a required field (`backend/app/schema.py:62-71`). So "how much more did Q4 sell than Q1" builds offline from the bars themselves: Q4 32, Q1 10, difference 22, read with the printed unit fact "thousands of units".
  - The sine gets a shape walk over the existing semantic anchors `origin`, `peak` and `trough` (`guide/semantic.ts:15-23`), and speaks no number that is not printed.
  - Result: all three samples now have an offline walk. Only the Pythagoras walk needs parsed facts.
- **Circular demo: conceded.** The triangle prints `AB = 5 cm`. The demo now uses the bar chart ("How much more did Q4 sell than Q1?"), whose answer is printed nowhere. The triangle walk stays, with a property that no walk uses its own conclusion as a premise.

**A3, "no new sensation, overlaps Ask and Guide": partly right.**
- True: the finger feels nothing new, and Ask already returns one target (`ask.py:366-367`).
- What is new is order plus confirmation by touch: N anchors, each sentence released only when `hitTest` reports that anchor. That is the teacher's pointing, which neither Ask nor Guide does.
- Adding no new sensation is a deliberate choice: ruling 1 and OD-2 point that way.

**Lift: decided.**
- A lift does **not** end the walk. The walk lives in its reducer until "stop", Back, a new walk, or 120 s with no touch.
- A step sentence is speech the student asked for, so it gets the same protection as an Ask answer: a lift does not cut it. This is Requirement 37 clause 2 (`requirements.md:556`), which Kiro amends to name "a walk step". "repeat" re-says the step.
- Corner labels and other exploration speech during a walk still follow clause 1.

## 2. Sharpest remaining attack on the improved Ghost Skin
A's round 2 reply never answers graph scan.
- In Explorer, the only preset that enables Ghost Skin, `graphScan` is on (`core/presets.ts:47-54`).
- `scanTone` (`flow/explore.ts:124-140`) plays the curve tone at level **0.33** at every off-curve point under a function graph. That is the whole region the purr exists for.
- So A's headline sine demo plays a 0.08 purr under a 0.33 steady tone, about 12 dB down, which is untested on any phone speaker.
- The new "spoken size ranking" admits the problem: the area comparison now arrives as a **sentence** on the where-am-I rest. It is no longer felt. That is Ghost Skin conceding A3 against itself: the part that teaches area is speech, and the new sensation is the part buried under the scan tone.

## 3. Closing statement
1. Ghost Touch already lets a student feel a diagram. Planchette lets her feel the **reasoning** about it, one anchored step at a time.
2. It adds no sound and no vibration, touches no tuned value, and works on all three samples offline with no AI.
3. When AI is used: one call, a real id for every anchor, every calculation checked by `expr.py`, every number grounded, and today's answer if any check fails.
4. Every flaw A found is fixed above by a stated rule, not a promise: an exact phrase, one call, scene-based templates, and walks that survive a lift.
5. Pick the feature that turns a creature that answers into a creature that teaches, and does it with the parts it already has.
