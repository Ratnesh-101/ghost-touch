# Final, last word: B (Planchette)

## Answers to C's three attacks
**A. "Steps repeat touch speech; overlaps Ask, semantic and Guide." Mostly true, conceded.**
- Touching a bar already says its label and value (`core/hitTest.ts:46`, `:302`).
- What is new is the order, the check that *she* found each part, and "Your turn", which tests recall without speaking the answer.
- Ghost Hand's checking half has the same limit: it is the unchanged Explore (C, final1 §3).

**B. "The graph walk cannot be checked by touch." True of my round 3, conceded and repaired in final1-B §2.**
- C's "touching anywhere on the curve" does not apply to that repair: arrival needs the polyline target *and* a finger within 22 px of the peak point.
- I accept that until Kiro's reachability property passes, the sine walk does not exist.

**C. "The most valuable half is the riskiest half: a new paid route." True, conceded.** The Hindi number-word gap in a digit-grounding check is a fair inference. Rather than defend it, I cut the route (below).

**C's repair is good.** "Down-left to (0, 1), up-right to (1, 3)" with the readout off answers my dilemma attack: she gets both ends and works out the rise herself.

**What C has not answered:** the hand-in still opens only when `VITE_FEATURE_SHARE` is set (`App.tsx:277`, `:405`; `config/features.ts:41-42`). The README (line 171) says Share is off and untested on a phone.

## What I cut
For Dec 5, Planchette ships **template walks only**: Pythagoras, bar difference and longest side, plus "Your turn", and the sine walk only if Kiro's `walkAnchor` properties pass. There is no `/explain` route, no model call, no backend change and no paid cost.

That leaves one Kiro task (the `walk.ts` reducer and templates, the Requirement 37 amendment, properties) and one serialized Explore lane.

## Closing
1. Ghost Touch reads diagrams to a student. Planchette teaches her the reasoning, one anchored step at a time, and then asks her to find it herself.
2. After the cut it is offline, free, adds no sound or vibration, touches no tuned value, and is the smallest new feature in this final.
3. Every number it speaks comes from the scene: printed facts or `bars[].value`. Every step is reached by a real `hitTest` target, and every rule is a Kiro property.
4. I conceded each point C and A proved, and answered each one with a cut or a stated rule, not a promise.
5. Ghost Hand is the right feature after Share has been felt on a phone. Planchette works on the triangle and bar chart samples the day it lands, and on the sine only once its property passes.
