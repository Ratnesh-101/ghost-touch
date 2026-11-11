# What you need to test (owner sheet, before Nov 14)

Short, in priority order. Source of the priorities: `docs/reports/fable-win-plan.md`. For the exact tap-by-tap steps of the phone test, use `docs/PHONE_TEST.md` (this sheet says which steps matter). Nothing in this sheet has been done yet; every box is open. Do not write PASS for something you did not do.

**How to report back:** fill the tables below (PASS / FAIL / NOT DONE plus one line), then paste the FAIL rows to me. Each FAIL becomes a one-line bug and a small fix lane. Do not write names of real people in anything that goes in the repo.

## 0. Before you start (5 min)

| # | Check | Result |
|---|---|---|
| 0.1 | Which build are you testing? Local `main` is many commits ahead of the live site, so the live site does **not** have the latest fixes yet. Either ask me to push first (your decision), or test the live site knowing it is older. Write which: `live` / `pushed` / `local dev over https` | |
| 0.2 | Phone: OnePlus Nord CE6, Chrome for Android, battery above 50%, volume up, vibration on (not in silent/DND mode that blocks it), TalkBack installed | |
| 0.3 | Wake the backend: open `https://ghost-touch-api.onrender.com/api/v1/health` in Chrome and wait for `{"ok": true}` (the first call can take 30 s or more). Write the seconds it took. | |

Live frontend: `https://ghost-touch-iota.vercel.app`

## 1. Priority 1: the phone test (1.5 h, Nov 11)

Do steps **0 to 8** of `docs/PHONE_TEST.md` (skip Guide my finger and Teacher share: they have never run on hardware and must not be claimed). Record one result per row.

| Step | What to do and what you should feel or hear | Result | Notes (one line) |
|---|---|---|---|
| 1 | Install as a PWA (Add to Home screen) | | |
| 2 | Start screen: one tap anywhere starts it; the phone speaks | | |
| 3 | Settings: change language and speech speed, close and reopen the app, they persist | | |
| 4 | Samples, TalkBack **off**: Right triangle. Drag a finger along a side: **continuous buzz**. At a corner: **buzz, pause, buzz** and the corner label is spoken (it speaks the label, for example "C", not "right angle"). Off the line: silence. | | |
| 4b | **Edge check (important):** can you find all three corners of the triangle by finger? If a corner sits on the very edge of the screen and is hard to reach, write FAIL and which sample. | | |
| 4c | Sine wave sample: the **pitch rises and falls** as you follow the curve. Bar chart: each bar speaks its label and value. | | |
| 5 | Same samples with **TalkBack on**: double-tap and hold, then drag. Does the touch pass through so you still feel lines? (Verified only on the prototype on Nov 1, not in the full app.) | | |
| 6 | Voice commands in Explore (say "repeat", "ask", "back"; use the ones the screen tells you) | | |
| 7 | Ask by voice: "How long is AC?" on the triangle sample. Expected answer: **"AC is 4 cm long."** Then try typing the question. Then the nonsense question "What colour is it?" (expect "I don't know from this diagram."). | | |
| 8 | **Real photo of a textbook triangle** with the camera. Write: `AI mode` or `Raw mode`, seconds from photo to Explore, and whether you can trace it. Then one messy photo (clutter): expect Raw mode outlines, no crash. | | |

Also write down: anything you could not do with your eyes closed, and anything that was silent when it should have spoken.

## 2. Priority 1b: what a judge sees on a laptop or iPhone (10 min)

Most judges will not have an Android phone. Open the live URL on a laptop (Chrome) and on an iPhone if you have one.

| # | Check | Result |
|---|---|---|
| 2.1 | Start, pick the Right triangle sample, drag the mouse along a side. Expected: a short low buzz sound and a pulse ring on the sides, a double buzz and two rings at corners (laptops cannot vibrate), and one spoken note "No vibration on this device..." on entering Explore. Corners speak a letter. Write what you actually saw and heard. | |
| 2.2 | Sine wave sample: tone follows the curve? | |
| 2.3 | Ask: type "How long is AC?": answer in about 2 s once the backend is warm? | |
| 2.4 | Upload your own image on the laptop: how many seconds until Explore opens? | |

## 3. Priority 2: ten real textbook photos (20 min, Nov 11 or 12)

Take ten photos of real textbook diagrams (triangles, graphs, bar charts, a few awkward ones) and put them in `research/samples/real/`. Then I run them through the pipeline. Fill after the run:

| # | Photo | Result: usable / partly / unusable | Mode |
|---|---|---|---|
| 1 to 10 | | | |

The sentence we can then honestly write is "N of 10 real textbook photos were usable".

## 4. Priority 2: one real user session (2 to 3 h, before Nov 15)

You leave Ahmedabad on Nov 15. One 20-minute session with one TalkBack user, with consent, is worth more than any code change left. Use `docs/user-test/consent-script.md`, `task-sheet.md`, `results-template.md`. Save the result as `docs/user-test/results.md` with numbers and **no names**. If it does not happen, say so plainly and move on.

| # | Item | Done? |
|---|---|---|
| 4.1 | BPA (or another) contact sent or chased | |
| 4.2 | Session booked (date) | |
| 4.3 | Session done, `results.md` written | |

## 5. Priority 3: Hindi and Gujarati

`docs/user-test/translation-review.csv` has about 370 rows marked for native review (machine-translated). Ahmedabad is the easy place to find a Gujarati reader: do it before you leave. Spoken strings first. Include the new words for "angle" (कोण / ખૂણા) and the share wording (`share.honesty`).

| Language | Reader | Rows checked | Corrections sent? |
|---|---|---|---|
| Gujarati | | | |
| Hindi | | | |

## 6. Kiro evidence for Kiroween (40 min, Nov 12)

Open the repo in the Kiro IDE and capture images into `docs/kiro-evidence/` (none exist yet).

| # | Capture | Done? |
|---|---|---|
| 6.1 | Hooks panel showing all the hooks | |
| 6.2 | Save `frontend/src/core/pitch.ts` and record the hook that runs | |
| 6.3 | The spec with its task list, and a steering file in use | |
| 6.4 | A property test failing and then passing (short clip) | |
| 6.5 | Request the 4,000 Kiro credits now (do not wait for Nov 30) | |

## 7. Owner-only admin (about 1 h in total)

| # | Task | Done? |
|---|---|---|
| 7.1 | Open the official Kiroween Devpost rules and the STEMergent rubric; paste the criteria and the write-up questions into `docs/kiro-evidence/rules.md` (my fetch of the rules page was blocked) | |
| 7.2 | Spend caps on the OpenAI, Gemini and Nebius dashboards | |
| 7.3 | Decide: push `main` (I will not push without your yes, and only after Kiro's last two red tests are green) | |
| 7.4 | Decide: keep the backend warm during judging (a free scheduled health ping) yes / no | |
| 7.5 | Record the 3-minute video (Nov 13) using the storyboard in section 5 of `docs/reports/fable-win-plan.md` | |
| 7.6 | Fill the `[FILL]` markers (team details, video URL) and submit STEMergent (Nov 14) | |

## What I (Claude) will do in parallel

Merge the open agy lanes, clear Kiro's two red tests so a push keeps CI green, apply the docs honesty fixes, build the laptop buzz fallback, rewrite the STEMergent text for a human reader, and run the final test recount last. If your phone test finds a FAIL, that comes before everything else on my list.
