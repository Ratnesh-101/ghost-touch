# Owner decisions raised by Kiro

Questions the spec cannot settle. Kiro does not decide them; each lists what the code does today, so the owner can choose.

## OD-1: Where does the cursor start on a new hold? (Requirement 13.3)

Raised 2026-11-15 while amending Requirement 13.1 from lane bu2 (commit 6f11ab7).

**What the old spec said:** "WHEN a new hold starts THEN the system SHALL start the cursor at the centre of the diagram", and the entry speech said "You start at the centre."

**What the code does (checked in `frontend/src/screens/Explore.tsx` `handlePointerDown`, `flow/explore.ts` `checkCentreTick`):**
- The cursor is the finger's own position (`clientX`/`clientY` through `getCanvasCoords`). It does not start at the centre. The header comment of `Explore.tsx` still says "relative cursor"; the code is absolute touch.
- Each new hold resets the engine state, the axis tracking and the centre-tick arming.
- The centre reference tick (25 ms) and "Centre." fire only when the finger is inside 24 CSS px of the canvas centre, on touch-down or on a later move. They re-arm after the finger leaves 36 px. "Centre." is spoken once, on the first hold that starts inside the radius.
- The first touch's offset from the centre appears on the debug line only (`explore.debugOffset`).

**Decision needed:**
- (a) Keep absolute touch. Requirement 13.3 as reworded is then final. The centre tick is a landmark the student can find, not a starting point.
- (b) Make the cursor start at the centre and move relative to the finger (the earlier design). That changes `Explore.tsx` and the gesture model, and needs a phone test with TalkBack.

Until decided, the spec follows the code (a), and no entry speech claims a centre start.


## OD-2: Should "Finding sound" (the near-line click) be on by default? (Requirement 27, review M4)

Raised 2026-11-16 from `docs/reviews/kiro-review-bu3-bu5.md` (M4, owner decision 1). **Not decided here; no default was changed.**

**What the code does:** the "Finding sound" setting defaults to on (`flow/explore.ts`, storage read once per move). So the live app plays the near-line click for every user until they switch it off.

**What the spec and steering say:** the click numbers (48 px radius, 90 to 400 ms, 500 to 1200 Hz, gain 0.3 to 0.6) are "proposed, pending owner approval, not phone-tested" in `tech.md` and Requirement 27.9. The gain range is 2 to 4 times the theremin's 0.15. A resting finger near a line clicks every 90 to 400 ms, and the clicks continue under line-name and where-am-I speech with no ducking. Whether the click can be told apart from the theremin and the Guide tone, on a speaker and on one earbud, is a phone-test question.

**Decision needed:**
- (a) Default off until the values are tuned on the phone. The demo and the README "Try it" steps stay as they are. Review lean: this one.
- (b) Default on, as briefed in plan improvement I4, accepting untested values in the live app.
- (c) Default on only after the phone test passes; ship off until then.

## OD-3: Directions default, and the demo audio (Requirements 26, 28 to 30, review M4)

Raised 2026-11-16 from `docs/reviews/kiro-review-bu3-bu5.md` (owner decisions 2 and 3). **Not decided here; no default was changed.**

**What the code does:** Directions defaults to on. Every corner now speaks its exits ("A. Down-right to B."). The README "Try it in 60 seconds" steps still describe a corner that only speaks its label.

**What task 55 decided (by instruction, not by this note):** the automatic where-am-I dwell sits behind the Directions switch, so it can be turned off (Requirement 30.2); the button and voice command always work (30.3).

**Decision needed:**
- (a) Keep Directions on and update the README and demo script to say corners now speak their exits.
- (b) Ship it off for the Devpost recording and the live demo, and turn it on after the phone test of corner speech (review: "Corner touch-down speech after M1" and the 800 ms and 1200 ms timings, with TalkBack off and on).
