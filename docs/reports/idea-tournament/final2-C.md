# Final, last word: C (Ghost Hand)

## Answers to B's three attacks
**C1, "the creature is a form": mostly true.**
- Pins are placed with sliders and a Pin button, and the creature part is the unchanged Explore. Placing pins is not theatrical.
- But a form is what TalkBack users can operate today; the gesture version could not work under TalkBack (`talkback-spike.md:11`).
- The new limb is the **direction** of the work, not a new sensation: the student's work reaches a sighted reader for the first time. Planchette adds no new sensation either (round3-B, A3); its eyes are mostly templates, and its walks voice what touch already says.

**C2, the readout dilemma: half true.**
- With the readout off, the app does not *judge* the homework. That is deliberate: the teacher marks it.
- Off is not blind. Resting on each stitched segment speaks both exact endpoints, "Side AB. Down-left to (0, 1), up-right to (1, 3)" (`flow/explore.ts:887-907`), and every pin speaks its coordinates at the corner. So a mis-plotted (2, 6) is *heard* as "(2, 6)", and she checks the differences herself, as a sighted student does on paper.
- B is right that compass words alone cannot tell a slope of 2 from 3. I do not claim they can.

**C3, hand-in on a flag: true, with one correction.**
- Opening a link is gated on `VITE_FEATURE_SHARE` (`App.tsx:277`, `:405`; `config/features.ts:41-42`), and Share is untested on a phone (README:171).
- Correction: only the build flag gates opening a link; the student's Settings switch is not checked. The owner decisions state the production bundle "is already built with `VITE_FEATURE_SHARE=1`" (`opus-owner-decisions-2026-11-18.md:54`) and ask the owner to re-check it (`:149`). I have not verified the live build.
- The point list is what the teacher marks ("did she plot the right points?"), and the link lets the teacher see and trace it. The new screen with en, hi and gu strings is real scope; I concede that.

## What I cut
For the Nov 30 freeze, Ghost Hand ships only a fixed 0 to 6 by 0 to 8 grid, x and y sliders, Pin, Undo, Stitch, Feel (the unchanged Explore), and a hand-in of the share link plus the point list. The readout, the second-finger tap, voice "pin", spoken ranges and the image export all move after Dec 5.

## Closing
1. Every other idea makes the app read the world better. Ghost Hand is the only one that lets a blind student **write** in STEM.
2. Where I was wrong (pitch self-check, a gesture TalkBack cannot do, the polyline that lost the steps), I said so and changed the design.
3. What remains uses only shipped parts: `addPoint`, `addSegment`, the line-name speech of exact endpoints, the unchanged Explore and the share link.
4. It needs no backend, no paid call, no schema change, no tuned-value change and zero `Explore.tsx` edits, so it never joins the Explore queue during the filming week.
5. It turns "I draw it on her palm" into a graph she plotted herself, which her teacher can open and trace.
