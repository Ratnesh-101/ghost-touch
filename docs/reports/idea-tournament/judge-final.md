# Final judgment: B (Planchette) vs C (Ghost Hand)
I read RULES.md, both pitches, both semifinal judgments, round3-B/C, final1-B/C and final2-B/C, and checked 12 claims in the repo on 2026-11-22. Nothing was run on a phone. The owner lifted the Nov 26/Nov 30 freeze for this tournament, so "fits before the freeze" counts for less than it did in the semifinals.

## Scores (1-10; weights 5, 4, 3, 2, 1, as in semifinal 1). Each idea is scored as it stands after its final cuts.
| Criterion | B Planchette | C Ghost Hand |
|---|---|---|
| 1. Creativity and surprise | 7 | 9 |
| 2. Value to a blind / low-vision student | 7 | 9 |
| 3. Honesty after verification | 8 | 8 |
| 4. Buildability (repo rules, pure core, Explore serialization) | 8 | 8 |
| 5. Demo and Frankenstein fit | 8 | 7 |
| **Weighted total (max 150)** | **111** | **128** |

## Claims verified
| # | Claim (who) | Result |
|---|---|---|
| 1 | A new vertex emits the corner pattern, a label, `tone(null)`, and opens the quiet window; polylines get the theremin, segments `tone(null)` (`core/hapticEngine.ts:139-184`) (both) | True. C was right to drop the pitch self-check. |
| 2 | `hitTest` returns only `vertex/line/bar/none`; axes have the ids `x-axis`/`y-axis`; a polyline beats an axis (`core/hitTest.ts:43-47, 185, 238, 243`) (B final1) | True. B's `walkAnchor` repair stands on real ids. It is still unbuilt, and it is still unproven. |
| 3 | Opening a share link is gated only by the build flag (`App.tsx:277, 405`; `config/features.ts:41-42`) (B attack, C correction) | True. No Settings switch is checked at those sites. |
| 4 | The production build already sets `VITE_FEATURE_SHARE=1` (`opus-owner-decisions-2026-11-18.md:54`) (C) | The doc says so, and it asks the owner to re-check (`:149`). Nothing in the repo proves the live value: **unverified**. |
| 5 | A segment's line name speaks "Side X" plus both ends by their labels (`flow/explore.ts:887-907`) (C) | True. With pin labels such as "(0, 1)", C's "Down-left to (0, 1), up-right to (1, 3)" follows from the code. |
| 6 | `addPoint` and `addSegment` exist (`core/correct.ts:284, 310`) (C) | True. |
| 7 | `ExploreProps` is `scene`, `announced`, `drivers`, `onBack` plus optional props, so the unchanged Explore can mount a draft (`screens/Explore.tsx:255-271`) (C) | True. Explore.tsx is 2,686 lines, as both said. |
| 8 | `Bar.value` is a required field (`backend/app/schema.py:62-71`), and the bar sample gives Q4 32 and Q1 10 (B) | True. The bar-difference walk can be built offline. |
| 9 | The triangle facts are `angle C = 90 degrees`, `AC = 4 cm`, `BC = 3 cm`, and `parseFacts` reads "angle X = n degrees" (B) | True (`triangle.json:48-53`, `verify.ts:112-165`). But `AB = 5 cm` is printed too, so the Pythagoras walk is still circular on the shipped sample. |
| 10 | Requirement 37 clause 2 protects only Ask and Guide speech from a lift (`requirements.md:556`) (B) | True. B needs a spec amendment before any code. |
| 11 | Ask is capped at 2 sentences (`backend/app/ask.py:360`) (B) | True. |
| 12 | `TWO_FINGER_LONG_PRESS_MS = 600` (`flow/explore.ts:491`); `share/validate.ts` rejects a scene with zero drawable elements (C) | True. A pin-only draft passes, because pins are points. |

Neither finalist invented a citation. Each one's main error (B's sine anchors, C's pitch self-check) was caught and conceded.

## Winner
**C, Ghost Hand: a blind student plots her own graph, checks it by touch and exact speech, and hands it to a sighted teacher.**

## Why
- **Creativity.** Every feature in Ghost Touch, including Planchette, makes the creature read the world *to* the student. Ghost Hand reverses that direction. The student becomes the author, and the creature's output now goes to sighted eyes. That is the single most surprising idea in the tournament, and the "missing limb" gives the Frankenstein story a new organ. B conceded that Planchette is "a conductor", that it adds no new sensation, and that its steps mostly repeat what touch already says (final2-B, A).
- **Value.** Plotting points is graded NCERT Class 9-10 homework that blind students today cannot do alone or send. Planchette's value is real but shrank after its cuts. It is now three templates, one of them circular on the triangle sample, and the sine walk only if a property passes. Its core benefit, ordered pointing, overlaps Ask, `semantic.py` and Guide.
- **Honesty.** This is a tie. Both cut their biggest claims cleanly: B the `/explain` route, C the readout, the gestures and the image.
- **Buildability.** This is a tie, with different risks. C has zero `Explore.tsx` edits, no backend and no schema change, but a whole new screen with en, hi and gu strings. B has no new screen, but it puts a lane in the 2,686-line file (the I01-I08 seam pattern), needs a Requirement 37 amendment, and needs the unbuilt `walkAnchor`. With the freeze lifted, C's larger UI surface counts against it less.
- **Demo.** B wins narrowly: a blindfolded finger walking an argument looks good on video. C's ending (a graph the student made, arriving on the teacher's phone) is the shot judges remember, but moving a slider looks flat on camera.

## Concessions and cuts the winner must keep
1. **Input.** The main input is the x and y sliders (`role="slider"`, value spoken) plus a 48 px Pin button. The second-finger tap and the voice command "pin" come later, and only as TalkBack-off shortcuts.
2. **Explore and grid.** Feel the draft through the **unchanged** Explore, with zero `Explore.tsx` edits. The MVP grid is fixed at 0-6 by 0-8, with cells of at least 48 px. Store the grid range as a fact line, with a Kiro property that `verify.ts` ignores it.
3. **Stitch.** `stitchInOrder` builds segments only, never a polyline (a property). Make no claim, anywhere, that slope can be heard as pitch.
4. **Readout.** The "up 2, right 1" readout is off by default and post-MVP. The hand-in states whether it was on.
5. **No new sound.** Add no new haptic value, audio value or cue. The grid-line click stays PROPOSED and off.
6. **Hand-in.** The hand-in is the share link plus the point list, marked "Made by ..., not checked". The image export is stretch, gated on `navigator.canShare({files})`, with download plus a copied link as the fallback.
7. **Labelling.** Add PHONE_TEST rows for the sliders under TalkBack, pin, feel, stitch and hand-in. Call the feature experimental until the owner has felt it on the Nord CE6.

## Five biggest risks
1. **Share path.** The hand-in, the teacher half of the value, depends on `VITE_FEATURE_SHARE=1` on Vercel (unverified) and on a Share path never tested on a phone. **Before building, the owner checks the flag and opens one share link on the phone.**
2. **Answers leak through the mounted Explore.** The unchanged Explore keeps Ask (and possibly a later Planchette). On a draft, "Is it a straight line?" could be answered for the student. Kiro must decide whether Ask stays on for drafts. Turning it off costs one optional prop, which is a small, deliberate exception to "zero Explore edits".
3. **Sliders under TalkBack.** They are a platform pattern, not tested evidence in this app (`talkback-spike.md`). If they fail, there is no fallback input left.
4. **Speech of coordinate labels.** Pin labels like "(2, 5)" may be read with the brackets by Android TTS, and in hi and gu they need localised wording. Prefer the label "2, 5", and test it in all three languages.
5. **Draft edge cases.** A pin-only draft, an undo back to empty, or autosave plus a palm exit (I28) could fail `isRenderableScene`, Saved diagrams or the share codec. Kiro's round-trip property must cover 0, 1 and many pins.

## Should the loser also be built?
My view: **yes, but second, smaller, and sequenced.** Build Planchette after Ghost Hand's MVP has landed and passed the owner's phone check. Ship it template-only (bar difference, longest side, Pythagoras only on scenes that do not print the conclusion), with "Your turn", no `/explain` route and no new cue. Its one Explore lane must not merge during the filming week. It must never offer a walk on a Ghost Hand draft (B's own rule in final1-B §3). If time gets tight, drop Planchette before risking the video or the phone pass. Its value overlaps Ask and Guide; Ghost Hand's does not.
