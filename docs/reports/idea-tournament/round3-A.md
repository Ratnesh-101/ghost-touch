# Round 3, A (Ghost Skin): answers, last attack, closing
I checked these claims on 2026-11-22. Nothing was run on a phone.

## 1. Answers to B's three attacks
**B1, "the purr is buried": conceded, and the design changed.**
- B's evidence holds:
  - Explorer turns on `findingSound` and `graphScan` (`core/presets.ts:47-54`).
  - `scanTone` plays the curve tone at level 0.33 everywhere off the curve (`flow/explore.ts:124-140`).
  - Clicks run at 0.3 to 0.6 within 48 px (`core/proximity.ts:33,43-45`).
  - At half gain (0.04), my purr would lose on almost all of the triangle's inside.
- Changes to Ghost Skin:
  - **(a) Graphs: no third layer.** Inside the area, the existing scan tone itself pulses (on and off at 8 Hz above the axis, 3 Hz below). There is no separate carrier, so the height information stays and nothing is buried.
  - **(b) Geometry:** inside a closed region the purr replaces the near-line clicks; outside regions the clicks work as today.
    - My reason: drifting inside a shape now gives purr, or the buzz of a crossed edge, so the student is never in silence.
    - This trades away the click's direction hint inside shapes, and the owner must approve that.
    - The purr then plays at its full 0.08 with nothing louder beneath it except speech, during which it stops.

**B2, "it carries sign and width, not area": conceded.**
- Two fixed rates cannot encode height. "She has felt the signed integral" overclaims, and the demo line "The integral is zero" was coached. I withdraw both.
- "Sweep just above the axis" was also wrong: the axis is a line target (`core/hitTest.ts`), so the finger would get the buzz or the clicks instead.
- New claim, and only this: the purr tells **where** signed area is positive or negative and which region the finger is in. The **size** comes from the spoken ranking (the round-2 improvement), computed from coordinates, which is real area. For example, "Under the first hump, above the axis. Same size as the hump below."
- New demo: sweep through the middle of each hump, rest, hear the ranking. The volunteer says only what she heard.

**B3, "nobody hears it, and no circles": partly conceded.**
- Off by default means no student hears it until the owner's phone test. That is the same status as sticky line and heartbeat, and the same rule as OD-2 (`opus-owner-decisions-2026-11-18.md`).
- I checked one detail of that rule: OD-2's ruling says Standard should ship Finding sound OFF, but `core/presets.ts` still has `standard.findingSound: true`. So OD-2's action has not landed in the code yet. That does not change B's point.
- `schema.py` has no circle or arc type, and the prompt asks for polylines only in function graphs, so circles and sectors are not reliably covered. Conceded.
- Planchette cannot anchor a circle either. Ghost Skin covers polygons with any number of sides, areas under curves, and closed polylines when present.

## 2. Sharpest remaining attack on the improved Planchette
**My round-2 attack A1 still stands after B's fix (the two round-2 files were written in parallel, so B could not have seen it).**
- **The renamed triggers still break Requirement 45.** "why ..." and "walk me through ..." are still prefix rules on transcripts longer than 3 words. Requirement 45 clause 2 (around line 660 of `requirements.md`) says such a transcript "SHALL NOT match" and "goes on to Ask". `matchesCommand` (`flow/commands.ts:142-153`) enforces it.
- **"why" is the most common question word.** Today every "why" question gets one Ask call. Under Planchette it gets a walk attempt first. A walk can fail the number check B itself describes ("every spoken number must appear in the facts"), and then the student gets the fallback Ask. That makes two paid calls under one `paid_budget`, and the cost-doubling on failure is not addressed in round 2-B.
- **Lifting ends the walk, which contradicts how the walk is used.** B restates "Lifting the finger or saying 'stop' ends it", yet the main path is "explore until `hitTest` reports the anchor" with Guide off. A blind tracer lifts to reorient all the time (the scenario behind Requirement 37), so normal searching cancels the lesson.
- **B's prompt rebuttal is partly right.** `vision/prompts.py:24-27` now asks for `'AB = 3 cm'` and `'label: 35'` facts, so my "35%" figure may be dated. But the repo's own samples still fail it: `barchart.json` and `sine.json` give no template walk, and no newer parse-rate measurement exists in the repo.
- **The finger still feels nothing new.** It is Ask, plus a quiz, plus a new route.

## 3. Closing statement
1. My slot was "new ways to FEEL a diagram", and Ghost Skin is the only pitch here that gives the finger new information. Today the inside of every shape and every area under a curve is silent; Ghost Skin makes it say "inside", "above" or "below".
2. I conceded every point B proved: the purr was buried, it never encoded area, and it does not cover circles. Ghost Skin is now leaner: the graph cue reuses the scan tone, inside shapes the purr replaces the clicks instead of competing with them, and size is spoken from computed area.
3. It changes no vibration and no tuned value, adds no AI call, no backend and no paid risk, and it works offline on every scene with closed shapes or axes.
4. Kiro gets real geometry to prove: smallest containing shape, sign flips under mirroring, scale invariance, a bounded number of shapes, and the switch-off equality.
5. Planchette adds speech; Ghost Skin adds touch and sound. In a "feel" tournament, the finger should learn something new.
