# Semifinal 1 judgment: A (Ghost Skin) vs B (Planchette)
Judge read RULES.md, both pitches, rounds 2 and 3, and checked 10 claims in the repo on 2026-11-22. Nothing was run on a phone.

## Scores (1-10; weights 5, 4, 3, 2, 1 in criterion order)
| Criterion | A Ghost Skin | B Planchette |
|---|---|---|
| 1. Creativity and surprise | 9 | 8 |
| 2. Value to a blind / low-vision student | 7 | 8 |
| 3. Honesty and survival of verification | 7 | 7 |
| 4. Buildability under the repo's rules | 5 | 8 |
| 5. Demo strength and Frankenstein fit | 7 | 8 |
| **Weighted total (max 150)** | **111** | **117** |

## Claims verified
| # | Claim (who) | Result |
|---|---|---|
| 1 | Explorer turns on `findingSound` and `graphScan` (`core/presets.ts:47-54`) (B) | True. But `standard` (39-46) also has `graphScan: true`, so the scan tone sits under the area in the default app too; B's attack is stronger than B said. |
| 2 | OD-2 not landed: `standard.findingSound` is still `true` (A, round 3) | True (`presets.ts:42`; ruling at `opus-owner-decisions-2026-11-18.md:112`). |
| 3 | `scanTone` plays level 0.33 at every off-curve point of a function graph (`flow/explore.ts:124-140`) (B) | True (level at line 153). |
| 4 | Clicks within 48 px at gain 0.3-0.6 (`core/proximity.ts:33,43-45`) (B) | True. |
| 5 | `matchesCommand` takes exact phrases or at most 3 words (`flow/commands.ts:142-153`); Req 45 clause 2 rejects command words inside a longer sentence (A) | True (`requirements.md:651,660`). B's pitch trigger "starts with why / show me" broke it; B conceded. |
| 6 | Ask is capped at 2 sentences and already returns `target.elementId` (`ask.py:360,367`) (B, A) | True (B cited :362; the rule is at :360, close enough). |
| 7 | `barchart.json` facts give no `parseFacts` bar walk; `Bar.value` is a required field (`schema.py:62-71`) (A, B) | Both true. B's round-3 fix (templates read `bars[].value`) holds: Q4 32 - Q1 10 = 22. |
| 8 | Facts parse on ~35% (21 of 60) (`DEPLOY.md:271`) (A) | True. B's "older scenes" defence was unverifiable and B withdrew it. |
| 9 | Req 37 clause 2 protects Ask answers from a lift (`requirements.md:556`) (B) | True. B's plan to amend it for walk steps is spec-compatible. |
| 10 | Sine walk anchors on `origin`, `peak`, `trough` (`guide/semantic.ts:15-23`) and a step plays "only when `hitTest` reports the anchor" (B, round 3) | **Wrong as combined.** These are Guide semantic targets, not scene element ids; `hitTest` never returns them, and B's own `validateWalk` drops any anchor not in the scene. The sine walk does not work as written. |
| 11 | No inside/area logic in `core/` or `flow/` (A) | True: `pointInPolygon`/shoelace found only in `screens/Debug.tsx`. |
| 12 | Triangle sample prints `AB = 5 cm` (A: circular demo) | True (`triangle.json:52`); B conceded and moved the demo to the bar chart. |

## Winner
**B, Planchette.**

## Why
- **Creativity is close; A edges it.** "Feel the inside" is a new dimension. But A's own concessions took most of it away: the purr carries only inside/sign, the area comparison became a spoken sentence, and on graphs the "new" cue is now the existing scan tone switched on and off. B's "the creature leads your hand through a proof" survived three rounds intact.
- **Value.** Anchored, ordered reasoning ("this side, this corner, so...") is the teacher's pointing, which no current feature does. With "Your turn" it becomes active recall. A's strongest real value, the "Inside triangle A B C" clause, is item I15 and costs one where-am-I sentence; it does not need the purr.
- **Honesty.** Both conceded every proven point cleanly. A withdrew "felt the signed integral". B withdrew the 35% defence. B loses a point for the unchecked sine anchors (claim 10); A loses one for under-reporting the scan-tone clash in its pitch.
- **Buildability decides it.** Ghost Skin is a new audio cue against ruling 1 ("no new cue before Dec 5") and the spirit of OD-2. Its round-3 fix (purr replaces clicks inside shapes) needs an owner ruling on a PROPOSED cue that has never been heard on a phone, and the graph area is covered by `graphScan` in Standard as well. Feature freeze is Nov 30 (`opus-owner-decisions-2026-11-18.md:152`). Planchette adds no sound and no vibration, touches no tuned value, has a complete AI-free core (templates plus reducer), and needs one serialized Explore.tsx lane.
- **Demo.** A finger walking Q4, then Q1, then "22 thousand more" on eyes-closed touch shows all three organs acting as one creature.

## Conditions the winner must meet when built
1. **Trigger and cost (from A1, conceded by B).** A walk starts only from the 48 px "Walk me through" button or the exact phrase "walk me through" after an Ask answer (Req 45 clause 1). Ordinary "why" stays with Ask; "show me" stays with Guide and the highlight. At most one paid call per walk (`/explain` returns `{answer, steps}`); a template or `semantic.py` answer means zero calls; no walk on Raw Mode. A property proves no transcript longer than 3 words starts a walk.
2. **Grounded, reachable anchors (from A2 and claim 10).** Every anchor must be a scene element id that `hitTest` can return, or Kiro first adds a pure, property-tested mapping from a semantic anchor (peak, trough, origin) to a hit region; otherwise the sine walk is dropped. Every spoken number comes from facts, `bars[].value`, or an `expr.py`-checked calc; no walk cites its own conclusion as a premise; a Spec Ghost dispute blocks the walk. Each "find" line adds the coarse position (`getCoarsePosition`).
3. **Lift, quiet and recall (from A's lift attack and B's improvements).** Kiro amends Requirement 37 clause 2 before any code so a walk-step sentence survives a lift; the walk ends only on "stop", Back, a new walk, or 120 s with no touch. The reducer emits only `speak` and `guideTo` (a property: never `vibrate` or `tone`), so the tuned values and the no-new-cue ruling hold. Ship "Your turn" (a correct touch always advances, a wrong one never does, the answer after two misses). The template-only build lands first, through one serialized Explore.tsx lane, before the Nov 30 freeze.
