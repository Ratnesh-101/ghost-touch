# TalkBack spike (Gate A)

Status: **Gate A decided on 2026-11-01. A1 passes. Stay on web.** The results below are the owner's own phone tests (OnePlus Nord CE6, Chrome on Android, TalkBack on). Claude Code organised them and wrote the design; Claude Code did not re-test anything.

## Why this matters
Most blind Android users keep TalkBack on. With TalkBack on, a plain one-finger drag is *explore by touch*: TalkBack consumes it to move its own focus, so the page sees no useful events and no vibration fires. The Explore screen needs raw finger movement, so we needed one gesture that gets through.

## Results (test table from `docs/WIN_PLAN.md`, Gate A)
| # | Method | How it was tested | Result |
|---|---|---|---|
| A1 | **TalkBack pass-through**: double-tap, **hold** on the second tap, then drag without lifting | On the canvas, TalkBack on | **PASS.** Events reach the page and **the phone vibrates when the cursor crosses a line.** TalkBack starts the virtual finger at the **centre of the focused element**, and movement is **relative**. |
| A2 | Two-finger drag over the lines | not tested | Untested, low priority |
| A3 | Hover events from a plain one-finger drag | not tested | Untested, low priority |
| A4 | Suspend TalkBack with the accessibility shortcut, explore, resume | known to work | Fallback only; not needed |

## Decision
- **A1 becomes the official explore gesture.** The app announces it on entering Explore.
- **Stay on the web (PWA).** The Capacitor native spike (WIN_PLAN Phase 0b) is **not needed for the MVP.** Keep it as an **optional Phase 2 experiment** (for example to remove the double-tap-and-hold step or to get stronger haptics), only if time allows after the Nov 14 submission.
- WIN_PLAN §0 and the risk register were updated to match (TalkBack risk: *solved via pass-through gesture*).

## What the result means for the design
Pointer events during A1 describe a **virtual finger** that always starts at the centre of the canvas and then moves relative to where it started. So the student cannot rely on where their physical finger lands; they can rely on "I start at the centre, and I move from there".
- The same gesture also works with TalkBack **off** (a tap followed by a press-and-drag is an ordinary touch). So we announce **one** gesture for everyone and use the same code path for both. With TalkBack off a direct touch anywhere works as well.
- Design written up in `docs/briefs/T07-explore.md` ("relative cursor"): spoken hint on entry, a centre reference tick, re-centre on every new hold, and an exit that works with TalkBack (Android Back, which includes TalkBack's back gesture, plus a labelled Back button; the two-finger swipe stays as a TalkBack-off shortcut because TalkBack uses two-finger swipes itself).

## Still to confirm on the phone (cheap, during the T07 test)
1. Are the `pointermove` coordinates during A1 the virtual position (centre plus movement) or the physical one? The T07 brief logs the first `pointerdown` position against the canvas centre so this is answered in one try.
2. Is the movement scale 1:1? If the cursor feels too slow or fast, a gain constant can be added later; the brief deliberately leaves it out until measured.
3. Does the **Android Back** gesture, and TalkBack's own Back gesture, leave Explore as designed?
4. Does vibration stay steady over a long drag (more than 20 seconds)?
5. A2 and A3 only if someone wants an alternative gesture.

## Open decisions for the owner
- Approve the **centre reference tick** pattern (proposed: a single 25 ms pulse, deliberately different from the line buzz at 80 ms and the corner pattern `[50, 90, 50]`). It is a new pattern, so the tuned table in `tech.md` is untouched until you approve.
- Whether to speak "centre" on the first hold only (proposed) or on every hold.
