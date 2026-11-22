# Final, round 1: C (Ghost Hand) vs B (Planchette)

What I checked in B's pitch and round 3 is accurate: Ask's 2-sentence rule (`backend/app/ask.py:360`), the `expr.py` evaluator (`parse_expression` `:205`, `evaluate(node, x)` `:214`), the semantic names (`guide/semantic.ts:15-23`), the required `Bar.value` (`schema.py:62-71`), and the bar sample's facts. B's template-only core is cheap and clean. These attacks are about overlap, reach and the parts that cost the most.

## 1. Three strongest attacks on Planchette

**A. Most steps repeat what the app already says when touched, and the rest overlaps Ask, semantic and Guide.**
- B's new headline demo is the bar chart: "How much more did Q4 sell than Q1?" Step 1 is "touch Q4, hear 32"; step 2 is "touch Q1, hear 10". Touching a bar already speaks its label and value: `hitTest` returns `{kind:'bar', label, value}` (`core/hitTest.ts:46`, `:302`). The only new content is the subtraction, 22, one sentence Ask can already give.
- Ask can already return a `target` id (`ask.py:366-367`). `semantic.py` already resolves peak, trough, origin, tallest and shortest bar, right angle and longest side (`:377-698`). Guide already leads the finger to them.
- Planchette strings these together in order and adds no new sensation, as B concedes (round3-B, A3). The eyes and voice gain a script; the nerves do what they do today. That is a conductor, not a new limb.

**B. The graph walk cannot be checked by touch as specified, and the fix is unscoped Kiro work.**
- `hitTest` only returns `vertex`, `line`, `bar` or `none`, with a scene element id (`core/hitTest.ts:44-47`). `peak`, `trough` and `origin` are semantic names, not ids.
- The sine sample is one polyline, so "find the peak" is satisfied by touching *anywhere* on the curve.
- The semifinal judge made this condition 2 (`judge-semifinal-1.md:42`): a new pure mapping from a semantic anchor to a hit region, or the sine walk is dropped. So one of the three "all samples offline" walks does not exist yet; today touch-check works on geometry and bars only.

**C. Its most valuable half is the riskiest half: a new paid backend route plus an Explore lane.**
- Model walks need `POST /api/v1/explain`, a fourth POST route next to `/scene`, `/ask` and `/validate` (`backend/app/main.py:567`, `:944`, `:1038`). It brings new prompt-injection surface, new rate-limit and budget wiring, and a "every number in `say` is grounded" checker.
- Ask replies in `lang` (`ask.py` rule 4). A Hindi step that says a number as a word would defeat a digit-matching grounding check unless that is specified. This is my inference, not a tested fact.
- The client needs a serialized EX lane in `Explore.tsx` that feeds every move's `hitTest` target to `walkStep` (pitch-B; judge condition 3), plus a Kiro amendment to Requirement 37 so step speech survives a lift. That is new glue in the 2,686-line file the improvement report blames for I01 to I08. Without the route, Planchette is templates for Pythagoras and bar differences.

## 2. Repairing my known flaw (judge condition 2): joined pins stay segments
- `joinInOrder` is now **`stitchInOrder`**: it sorts pins by x and calls the existing `addSegment` for each neighbouring pair. It **never builds a polyline**, so every step stays a segment that `lineName` names with its ends (`flow/explore.ts:887-907`).
- Pins get letter ids A, B, C (`nextPointId`, `core/correct.ts:226-234`), which `speakableName` speaks (`core/speakable.ts:10-26`); segment ids are `AB`, `BC` and so on.
- **Readout off (default):** resting on a step speaks "Side AB. Down-left to (0, 1), up-right to (1, 3)." She hears both endpoints and works out the rise herself; the app gives no answer.
- **Readout on:** the label becomes "AB, up 2, right 1", so Explore speaks "Side AB, up 2, right 1. Down-left to …".
- Kiro properties: no polylines in the output; segments join neighbours in x order; each readout label equals its pins' integer differences; with the readout off, no label contains a slope.
- Segments get `tone(null)` (`core/hapticEngine.ts:180-184`), so no pitch claim survives anywhere. A curved homework graph (a parabola) is a set of straight chords, described as such.

## 3. Can both be built? Yes, mostly in separate files
- **Ghost Hand:** `core/pegboard.ts` (Kiro); a form screen, an `App.tsx` route, a `Capture.tsx` button and i18n (agy). Explore is mounted unchanged through `ExploreProps` (`screens/Explore.tsx:255-271`). Zero Explore, backend, schema or tuned-value edits.
- **Planchette:** `core/walk.ts` (Kiro); one EX lane in `Explore.tsx`, `flow/commands.ts` phrases, i18n, and later `explain.py` plus a `main.py` route (agy).
- **Real collisions:** `frontend/src/i18n/index.ts` (both add keys, so merge one at a time, as the report already requires); Kiro's requirement, task and property numbering; and Kiro's time before the Nov 30 freeze, since Planchette also needs the Requirement 37 amendment and the semantic-anchor mapping.
- **They compose:** a Ghost Hand draft is an ordinary `DiagramScene` opened in the real Explore, so a template walk could in principle run on a student's own graph. Neither of us has tested it.
- **If only one fits the calendar:** Ghost Hand carries less risk: no backend, outside the Explore queue, no paid call. It adds what the app lacks: the student as author, not a better-ordered answer.
