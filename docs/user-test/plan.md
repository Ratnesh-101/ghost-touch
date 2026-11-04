# User test plan (BPA session and follow-ups)

Written by Claude Code from `docs/WIN_PLAN.md` §4 (read in full on 2026-11-01) plus the project docs. Window: Nov 7 to 14 in Ahmedabad, in person (WIN_PLAN §4). Fallback: VIT Bhopal disability support cell or blind student groups in late November, or an online follow-up on students' own phones (still useful as the budget-phone test).

## Goal
Find out whether a blind or low-vision student can understand a diagram with Ghost Touch **with TalkBack on**, and what breaks first. Produces the numbers and quotes for both submissions and the demo (WIN_PLAN §6, "Evidence" slot). Be honest about limits: tiny sample, one or two phone models. TouchSight, the closest project, was never tested with blind users (see `docs/research/competitors.md`); a real session is our differentiator.

## Consent and ethics (before anything else)
- Verbal **and** written consent per student; a guardian for anyone under 18; BPA approval before any recording.
- Offer a **no-recording** option. Never record faces without explicit consent; hands-and-phone shots are enough for the demo.
- Tell everyone the app is an unfinished prototype and they can stop at any time. Keep notes anonymous (P1, P2, ...). No personal data in the repo; do not store phone numbers or contact details in files.
- If a participant is uncomfortable with vibration or sound, stop immediately.

## Kit & Testing Documents
2 charged Android phones (Nord CE6 and a cheap one), printed sample diagrams, offline samples in the app, a Bluetooth speaker if the room is noisy. A short written card for the facilitator with the explore gesture (below).

### Ready-to-Use Kit Documents
- **Consent & Assent:** `docs/user-test/consent-script.md` (spoken consent script for participants and guardians; no faces, voluntary).
- **Task Protocol:** `docs/user-test/task-sheet.md` (verbatim facilitator wording, tasks 1–5, time boxes, and fail-safes).
- **Results & Write-up Sheet:** `docs/user-test/results-template.md` (per-participant recording table, spoken 5-point survey, and STEMergent aggregate summary).
- **School Outreach:** `docs/user-test/outreach-email-draft.md` (polite draft for school administration with 30-second prototype video attachment).
- **Facilitator Checklist:** `docs/user-test/facilitator-checklist.md` (phone setup, TalkBack testing, offline samples, and teardown).

## Teaching the gesture (first 2 minutes)
With TalkBack on, Explore uses: **double-tap and hold, then drag** (the app says so on entry; the virtual finger starts at the centre). Show it once on the facilitator's hand, then let the student try on the triangle. Note whether the student needed more than one explanation. With TalkBack off, the same gesture works, and a direct touch anywhere also works.

## Tasks (measure time and success for each)
Matches WIN_PLAN §4, in this order:
| # | Task | Measure |
|---|---|---|
| 1 | Find all corners of the **triangle** and name them | Corners found and named (0 to 3); seconds |
| 2 | Which corner is the **right angle**? | Correct (yes/no) |
| 3 | On the **sine graph**: how many peaks? | Count correct (yes/no) |
| 4 | (If built) On the **bar chart**: which bar is tallest? | Correct (yes/no) |
| 5 | **Ask one question by voice** (for example "How long is AB?") | Answer heard and understood (yes/no) |

Baseline for comparison, for half the group first: a verbal description of the same diagram, or a raised/tactile print if available. Alternate who starts so order effects balance out.

## Questions (WIN_PLAN §4)
- What was confusing? Which vibration felt unclear?
- Would you use this for homework? (yes / maybe / no, and why)
- What diagrams are hardest for you in class?
- Anything that hurt, startled, or felt unsafe?
- One thing to change first.

## Also ask the teacher
- Which diagrams do students struggle with most?
- Would you correct the AI's mistakes if it took one minute?

## Local session logging (WIN_PLAN "must-have 3")
The app may log, on the device only and with no personal data: corners found, time to identify a shape, whether TalkBack was on. Not built yet; if it is not ready, the note-taker records the same numbers by hand.

## Pre-agreed readout (decide before testing, so the result is honest)
- **Good enough to demo:** tasks 1 to 3 answered correctly by most participants (for example 3 of 4), and nobody unable to start.
- **Needs work:** anyone cannot start (Start screen, TalkBack gesture), or fewer than half find all three corners.
- Report counts, not percentages, with the sample size. Example of the kind of line we want, only if true: "3 of 4 students named all corners in under 40 s".

## Observation sheet (copy per participant)
```
Participant: P__   Date:        TalkBack on? Y/N   Phone:        Order: app first / baseline first
Task | success | time | confusion notes
1 corners
2 right angle
3 sine peaks
4 tallest bar
5 voice question
Gesture taught in __ attempts.   Vibration felt on lines? Y/N   Corner distinct from line? Y/N
Would use for homework? Y / maybe / N   Why:
What to change first:
Anything that hurt, startled, or felt unsafe:
Permission to quote (words only)? Y/N
```

## Output
`docs/user-test/results.md` with numbers and 2 or 3 quotes (with permission). These go into the STEMergent description, the Kiroween write-up and the demo. Each issue found gets a severity and becomes a task or a brief.
