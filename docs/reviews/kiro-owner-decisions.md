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
