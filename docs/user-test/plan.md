# User Test Plan (BPA Session and Follow-Ups)

Written by Claude Code from `docs/WIN_PLAN.md` §4 (read in full on 2026-11-01) plus the project docs; updated 2026-11-06 for the Frankenstein's Laboratory redesign. Window: Nov 7 to 14 in Ahmedabad, in person (WIN_PLAN §4). Fallback: VIT Bhopal disability support cell or blind student groups in late November, or an online follow-up on students' own phones (still useful as the budget-phone test).

## Goal
Find out whether a blind or low-vision student can understand a diagram with Ghost Touch **with TalkBack on**, and what breaks first. Produces the numbers and quotes for both submissions and the demo (WIN_PLAN §6, "Evidence" slot). Be honest about limits: tiny sample, one or two phone models. TouchSight, the closest project, was never tested with blind users (see `docs/research/competitors.md`); a real session is our differentiator.  
*(Note: The app has not yet been validated on a physical phone; physical motor and gesture testing is pending).*

## Consent and Ethics (Before Anything Else)
- Verbal **and** written consent per student; a guardian for anyone under 18; BPA approval before any recording.
- Offer a **no-recording** option. Never record faces without explicit consent; hands-and-phone shots are enough for the demo.
- Tell everyone the app is an unfinished prototype and they can stop at any time. Keep notes anonymous (P1, P2, ...). No personal data in the repo; do not store phone numbers or contact details in files.
- If a participant is uncomfortable with vibration or sound, stop immediately.
- **Theme stance:** The Frankenstein lab theme is playful retro-futurism (screws, stitches, glowing circuits). It strictly never jokes about blindness, visual impairment, or sightlessness.

## Facilitator Note on Language Localization
> **Important:** Ghost Touch supports English, Hindi (`hi`), and Gujarati (`gu`). Hindi and Gujarati interface text and speech synthesis are currently **machine-translated** and have **not yet been reviewed by a native speaker**. Gathering participant, teacher, and guardian feedback on wording, pronunciation, and terminology naturalness is an explicit part of this user test.

## Kit & Testing Documents
2 charged Android phones (Nord CE6 and a cheap one), printed sample diagrams, offline sample specimen cards in the app, a Bluetooth speaker if the room is noisy. A short written card for the facilitator with the explore gesture (below).

### Ready-to-Use Kit Documents
- **Consent & Assent:** `docs/user-test/consent-script.md` (spoken consent script for participants and guardians; no faces, voluntary).
- **Task Protocol:** `docs/user-test/task-sheet.md` (verbatim facilitator wording, tasks 1–5, time boxes, and fail-safes).
- **Results & Write-up Sheet:** `docs/user-test/results-template.md` (per-participant recording table, spoken 5-point survey, and STEMergent aggregate summary).
- **School Outreach:** `docs/user-test/outreach-email-draft.md` (polite draft for school administration with 30-second prototype video attachment).
- **Facilitator Checklist:** `docs/user-test/facilitator-checklist.md` (phone setup, TalkBack testing, offline samples, and teardown).

## Teaching the Gesture (First 2 Minutes)
From the Start screen, double-tap the full-screen "Wake the creature" button to reach Capture. Select a specimen card (e.g. "Right triangle") to enter Explore.  
With TalkBack on, Explore uses: **double-tap and hold, then drag** (the app speaks *"Double-tap and hold, then drag to feel the diagram. You start at the centre."*; the virtual cursor starts at screen centre with a 25 ms tick and spoken *"Centre."*). Show it once on the facilitator's hand, then let the student try on the triangle. Note whether the student needed more than one explanation. With TalkBack off, the same gesture works, and a direct touch anywhere also works.

## Tasks (Measure Time and Success for Each)
Matches WIN_PLAN §4, in this order:
| # | Task | UI Path | Measure |
|---|---|---|---|
| 1 | Find all corners of the **triangle** and name them | Capture > "Right triangle" specimen card > Explore | Corners found and named (0 to 3); seconds |
| 2 | Which corner is the **right angle**? | Remain on Right triangle in Explore | Correct (yes/no) |
| 3 | On the **sine graph**: how many peaks? | Capture > "Sine wave" specimen card > Explore | Count correct (yes/no); theremin pitch clarity |
| 4 | On the **bar chart**: which bar is tallest? | Capture > "Bar chart" specimen card > Explore | Correct (yes/no); bar pitch/speech comparison |
| 5 | **Ask one question by voice or text** (for example "How long is AB?") | Tap "Ask" button in Explore (or hold 2 fingers) | Answer heard and understood (yes/no) |

Baseline for comparison, for half the group first: a verbal description of the same diagram, or a raised/tactile print if available. Alternate who starts so order effects balance out.

## Questions (WIN_PLAN §4)
- What was confusing? Which vibration felt unclear?
- Would you use this for homework? (yes / maybe / no, and why)
- What diagrams are hardest for you in class?
- Anything that hurt, startled, or felt unsafe?
- One thing to change first.
- **Language feedback (if tested in Hindi/Gujarati):** Was the wording natural? Which terms sounded strange or inaccurate?

## Also Ask the Teacher
- Which diagrams do students struggle with most?
- Would you correct the AI's mistakes if it took one minute in Teacher Correct mode?
- How does digital haptic exploration compare to embossed tactile paper?

## Local Session Logging (WIN_PLAN "Must-Have 3")
The app may log, on the device only and with no personal data: corners found, time to identify a shape, whether TalkBack was on. If automated device logging is not ready, the note-taker records the numbers by hand.

## Pre-Agreed Readout (Decide Before Testing, So the Result Is Honest)
- **Good enough to demo:** tasks 1 to 3 answered correctly by most participants (for example 3 of 4), and nobody unable to start.
- **Needs work:** anyone cannot start (Start screen, TalkBack gesture), or fewer than half find all three corners.
- Report counts, not percentages, with the sample size. Example of the kind of line we want, only if true: "3 of 4 students named all corners in under 40 s".

## Observation Sheet (Copy Per Participant)
```text
Participant: P__   Date:        TalkBack on? Y/N   Phone:        Order: app first / baseline first
Language tested: English / Hindi / Gujarati (machine-translated)
Task | success | time | confusion notes
1 corners
2 right angle
3 sine peaks
4 tallest bar
5 voice question
Gesture taught in __ attempts.   Vibration felt on lines? Y/N   Corner distinct from line? Y/N
Would use for homework? Y / maybe / N   Why:
Language wording naturalness (if HI/GU):
What to change first:
Anything that hurt, startled, or felt unsafe:
Permission to quote (words only)? Y/N
```

## Output
`docs/user-test/results.md` with numbers and 2 or 3 quotes (with permission). These go into the STEMergent description, the Kiroween write-up and the demo. Each issue found gets a severity and becomes a task or a brief.
