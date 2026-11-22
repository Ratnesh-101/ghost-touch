# Judge, semifinal 2: Ghost Hand (C) vs Ghost Walk (D)

Read: RULES.md, pitch-C, pitch-D, round2-C, round2-D, round3-C, round3-D. Scores are for each idea as it stood after round 3.

## Scores (1-10)

| Criterion (weight order) | C Ghost Hand | D Ghost Walk |
|---|---|---|
| 1. Creativity and surprise for a Kiroween judge | 8 | 9 |
| 2. Real value to a blind or low-vision student | 9 | 6 |
| 3. Honesty, and how it survived verification | 8 | 6 |
| 4. Buildability (frozen values, pure core, Req 37/39/45, no-new-cue, OD-2, Explore serialization) | 9 | 5 |
| 5. Demo strength and Frankenstein fit | 7 | 8 |
| Total | 41 | 34 |

## Claims I checked in the repo

| # | Claim (who) | Result |
|---|---|---|
| 1 | Entering a new vertex sends the corner pattern, the label and `tone(null)`, and opens the quiet window (`core/hapticEngine.ts:139-163`, D's attack A1) | **True.** The engine does this (lines 140-163). Pins really do cut C's "steady glide", so C was right to drop the pitch self-check. |
| 2 | Polylines get the theremin, segments get `tone(null)` (`hapticEngine.ts:181`, both) | **True** (lines 180-184). |
| 3 | `curveYAtX` returns null unless the scene is a `function_graph` (`core/curve.ts:26-27`, C's attack C) | **True.** Chase cannot run on geometry or bar scenes, so it is narrow. |
| 4 | `TWO_FINGER_LONG_PRESS_MS = 600` (`flow/explore.ts:491`) and a 60 ms keep-alive (`:713`) | **True** (lines 491 and 713). |
| 5 | `addPoint` and `addSegment` exist in `core/correct.ts:284`, `:310` | **True.** |
| 6 | `ExploreProps` takes a `scene` and `onBack`, so the unchanged Explore can be mounted on a draft (`screens/Explore.tsx:255-271`, C round 3) | **True.** It also needs `announced` and `drivers`, which a parent screen can supply. So the "zero Explore edits" claim is plausible. |
| 7 | Line-name-on-rest speaks a segment label as "Side ..." plus the ends (`flow/explore.ts:864-908`, C round 3) | **True** for segments (lines 887-907). **Caveat:** a polyline speaks only its label, with no ends. So the per-step readout is lost if "join in order" turns the pins into a polyline. |
| 8 | `drivers/clipboard.ts:73-95` shares only `{title,text,url}`, with no files (D's attack A3) | **True.** C's image hand-in is new and unproven. C correctly moved it to stretch. |
| 9 | The sticky row in tech.md "changes which target is reported, adds no effect" (D's target-filter precedent) | **True** (tech.md:30). The precedent is real. |
| 10 | TalkBack pass-through gives one virtual finger, starts at the centre and moves relatively (`talkback-spike.md:11`) | **True.** C's original split tap could not work under TalkBack. |
| 11 | `MAX_SAMPLES = 400`, plus a `JUMP_FRACTION` break (`graphs/sample.py`, D's own correction) | **True** (lines 20 and 23). D's pitch said 150. The fix was honest. |
| 12 | `Explore.tsx` checks `isGuiding()` in "about ten places" (D round 3) | **Undercounted.** 20 lines contain `isGuiding()`. Adding a Chase mode next to Guide costs more than D admits. |

Both sides cited the code accurately. Only #12 is wrong, and that error cuts against the side that made it. Neither side invented a citation. D's Thornton and Sokoloff citation was from memory, and D withdrew it.

## Winner
**Ghost Hand (C).**

## Why
- **Creativity: D leads, but only narrowly.** A ghost you chase in an app called Ghost Touch is the bigger surprise. But C's reversal also surprises: the creature grows a hand, and a blind student makes a graph for sighted eyes.
- **Value: C leads clearly.** C targets graded NCERT plotting homework, and the work is the student's own. D lost its core value claim under verification. C showed the hand keeps drifting right on the flat part, and D withdrew "her hand performed the graph". C's round-3 point also stands, and D's round 3 never answered it: the patient ghost waits at the steep parts, so the hand feels the student's catch-up rhythm rather than the slope. That leaves `motionStory` as a spoken summary, which the overview could give without a moving target.
- **Honesty:** both conceded well. C dropped the pitch self-check and the second-finger-first input. D dropped the score, the overclaim and the citation. But what D gave up was its headline. What C gave up was a side feature, and C replaced it with exact integer arithmetic.
- **Buildability: C wins clearly.** C's design is a form screen plus the unchanged Explore: zero Explore edits, outside the serialized EX queue, zero backend, schema or tuned-value changes. D still needs a new mode inside the 2,686-line Explore, with guards at more than 20 Guide-style sites. That is the I01-I08 seam pattern the improvement report warns about.
- **Demo: D leads, but C has the better closing shot.** D's moving ghost reads better silently on video. C ends on an object a judge can see: a graph the student made herself, arriving on the teacher's phone.

## Three conditions Ghost Hand must meet when built
1. **TalkBack-first input, and Explore stays untouched.** Place pins with x and y sliders (`role="slider"`, value spoken) plus a 48 px Pin button. Check the work by mounting the unchanged `Explore` on the draft through `ExploreProps`, with zero edits to `Explore.tsx`. The second-finger tap is only an optional shortcut when TalkBack is off, and voice "pin" is optional. Keep cells of at least 48 px, and refuse a grid that is too fine out loud. Add no new haptic or audio value and no new cue (the grid-line click stays out of the MVP). Store the grid range as a fact line, with a Kiro property that `verify.ts` ignores that line.
2. **The rise-and-run readout must be exact, honest and optional** (C's improvement, limited by D's last attack). Each stitched segment's label is computed from the integer pins ("up 2, right 1"), and a Kiro property checks that every label equals its pins' integer differences. "Join in order" must keep stitched segments, or keep per-step labels some other way, because Explore names a polyline by its label only (claim 7). Make no claim that slope can be heard as pitch. The readout is a switch that is **off by default**, and the hand-in states whether it was on. That way the MVP does not quietly answer "Is it a straight line?" for the student before the teacher-worksheet control exists.
3. **Hand in only what works today, and log it as untested** (both sides' honesty rules, including D's PROPOSED and phone-test discipline). The MVP hand-in is the existing share link plus a text list of the points, marked "Made by ..., not checked". The black-on-white image share is stretch, gated on `navigator.canShare({files})`, with download plus a copied link as the fallback. Add rows to `docs/PHONE_TEST.md` for sliders under TalkBack, pin, feel, join and hand-in. Docs call the feature experimental until the owner has tried it on the phone.
