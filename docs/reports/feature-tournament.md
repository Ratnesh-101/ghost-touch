# Next-feature tournament (Claude subagents, 2026-11-08)
Process: 17 Sonnet proposals (distinct lenses) and 6 Opus proposals; Sonnet bracket: 8 duels (Sonnet judges), 3 group rumbles (Opus judges), 1 decider (Opus); Opus bracket: 3 duels + 1 three-way (Opus judges); courtroom final: Opus 5.5 judge, Opus counsel for Ghostwriter, Sonnet lead + Opus second-chair for Spec Ghost. All read-only; no repo edits. Claims by agents were partly checked by the judges against the code.

## Verdict: SPEC GHOST wins (Sonnet champion beat the Opus champion Ghostwriter)
Honest consistency check between a scene's printed facts and its drawn geometry. Not forgery protection, never says "verified".

Why (judge, verified in repo): correct.ts has no add-point/add-segment (Ghostwriter = new reducer + screen + gesture 5 days before freeze); "Right angle at B" already ships in semantic.py/guide semantic; lift-to-place under TalkBack is unproven (Explore.tsx:848-853, CORE-08); triangle.json is consistent (CA 0.60, BC 0.45, AB 0.75 = 4:3:5, right angle at C) so an honest scene stays silent and a forged "AC = 7 cm" is flagged; pure core + property tests fit Kiro hooks.

What Spec Ghost got wrong (judge): real AI facts are often prose ("The length of side AB is 3 cm.", bar facts "Red: 35"), and prompts.py:24 ("short sentences") contradicts prompts.py:35 ("angle B = 90°"), so as specified the checker would stay silent on most real scenes.

## Conditions
1. Parser covers: "XY = n unit", "length of (side) XY is n unit", "XY: n", degree sign and "degrees", reversed names (AC vs segment CA). Tighten prompts.py:24 so facts use "XY = n unit" (OWNER DECISION: backend prompt change).
2. Regression: run over research/samples/synthetic/ground_truth, research/results/*/predictions and the 3 samples: zero false flags.
3. Wording only "Facts and drawing disagree on AB. I can't tell which is right."; silent when unparsed, "not to scale", or <2 lengths; measure in the renderer's letterboxed unit square.

## Kiro build brief (paste to Kiro)
1. Add .kiro/steering/verify.md: consistency check, not forgery protection; never say "verified"; silent when unsure.
2. Create pure frontend/src/core/verify.ts: parse "XY = n u", "length of (side) XY is n u", "label: n", "angle X = n°/degrees"; match reversed segment ids.
3. Checks: length ratios ±15% (±25% when mode is ai), angles ±8°, only with >=2 parsed lengths; skip on "not to scale".
4. Properties P47-P50: scene built from its own facts never flagged; move/scale invariance; unparsed facts give silence; regression over research/ ground truth and predictions gives zero flags.
5. Wire in: announce once on scene load (incl. shared links); Ask answers about a disputed segment add the caveat; tighten prompts.py line 24 so facts use "XY = n unit".
6. On-save hook runs the verify property tests; phone pass with TalkBack on; log in BUILD_LOG.md; no haptic values touched.

## Runner-up / add-on
Ghostwriter: not before the freeze. After STEMergent, a cut-down version for Kiroween polish: addPoint/addSegment in correct.ts with a property test that validateSceneInvariants still passes, exposed only in Teach; no new screen, no TalkBack gesture.

## Other notable survivors (for the roadmap)
Opus bracket: Ghostwriter, Teach-Back, Bone-Setter (Spirit Level died on aspect ratio). Sonnet bracket group winners: Spec Ghost, Marks Lane (midpoint-only), Stitch / "Parts found". Early eliminations worth revisiting after Dec 5: Landmark Pins, Echo Room, Circuit Current Walk.
Note: Spec Ghost partly overlaps the existing backend deterministic Ask (semantic.py) and the open audit findings (F2/F4 in audit-claude-backend-robustness.md, R2/R5 in audit-claude-redteam-share.md).
