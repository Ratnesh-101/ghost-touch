# Lane lab-phonetest Report: 20-Minute OnePlus Nord CE6 Phone Test Script

**Builder:** Antigravity (agy)  
**Lane:** `lab-phonetest`  
**Brief:** [`docs/briefs/agy-lab-phonetest.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-phonetest/docs/briefs/agy-lab-phonetest.md)  
**Date:** 2026-11-06  

---

## 1. Summary of Completed Work

In strict accordance with `docs/briefs/agy-lab-phonetest.md` and `AGENTS.md`:
- **Documentation only:** Zero code files or tests were modified.
- **Created [`docs/PHONE_TEST.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-phonetest/docs/PHONE_TEST.md):** A concise, ordered, single-hand test script formatted for the owner to execute on an Android OnePlus Nord CE6 running Google Chrome over HTTPS with a stopwatch.
- **Sequential Structure (Steps 0 through 12 in exact requested order):**
  - **Step 0: Wake the Render Backend (0 min pre-test):** Instructions to open `/api/v1/health` in Chrome and wait for `{"ok":true}` before starting the stopwatch, accounting for Render's 32–35s free-tier container cold start.
  - **Step 1: Install as a PWA (1 min):** Home screen installation prompt, standalone display mode verification, and Frankenstein creature mascot icon.
  - **Step 2: Start Screen & Audio Unlock (1 min):** Audio-first intro speech (`start.intro`), visual organ tiles, and single-tap activation with `vibrate(50)` haptic feedback, `start` earcon (440 → 660 Hz), and Web Audio oscillator unlock.
  - **Step 3: Settings Sheet & Persistence (2 min):** Lab settings modal sheet, language switching (English, Hindi, Gujarati) with immediate native spoken confirmation, speech rate adjustments (0.8× Slow, 1.0× Normal, 1.25× Fast), focus management on dismiss, and persistence via `localStorage`.
  - **Step 4: Explore Samples with TalkBack OFF (3 min):** Direct-touch tactile testing of Right Triangle, Sine Wave, and Bar Chart; line buzz (`vibrate(80)` every 70 ms), immediate silence on departure (`vibrate(0)`), vertex "bzzzz-tap" double-pulse (`vibrate([50, 90, 50])`), 450 ms line-buzz suppression quiet window, spoken point labels, and Web Audio theremin curve sonification (200–1000 Hz).
  - **Step 5: Explore Samples with TalkBack ON (3 min):** Screen-reader pass-through exploration using the double-tap-and-hold drag gesture, calibrated centre reference tick (`vibrate(25)`), relative cursor tracking, and vertex speech output without TalkBack speech collision.
  - **Step 6: Voice Commands in Explore (2 min):** Verbatim phrases quoted in English, Hindi, and Gujarati from [`frontend/src/flow/commands.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-phonetest/frontend/src/flow/commands.ts) for `where am I`, `repeat`, `next corner`, `describe`, `help`, and speech rate control (`faster` / `normal speed`).
  - **Step 7: Ask by Voice and by Text (2 min):** Diagram-grounded voice QA on triangle facts (`"How long is AB?"`), unanswerable question grounding check (`"What colour is it?"` -> `"I don't know from this diagram."`), and text fallback input.
  - **Step 8: Take Photo of Real Textbook Diagram (2 min):** Rear camera capture via `capture="environment"`, progress audio tone (`beep(440, 120)` every 1.5s), "It's Alive" spark animation, and concrete instructions for identifying AI Mode vs. Raw Mode fallback.
  - **Step 9: PDF Upload (1.5 min):** First-page client-side extraction and downscaling ($\le 1600$ px) via PDF.js worker, spoken announcement, and server scene parsing.
  - **Step 10: Saved Diagrams Offline (1.5 min):** Automatic IndexedDB persistence, Airplane Mode offline verification, diagram pinning, and instant offline reopening in Explore with zero network access.
  - **Step 11: Teacher Correct Mode (1.5 min):** Photo overlay inspection, interactive point handle dragging, undo/redo controls, and backend `POST /api/v1/validate` validation with live save.
  - **Step 12: Hindi and Gujarati Speech Voices (1.5 min):** Evaluation of native Android Indian language TTS voices, missing voice warning detection (`No system voice found for {LANG}. Using default voice.`), and exact Android Settings navigation path for installing Google TTS Hindi and Gujarati offline voice packs.
- **Table Formatting:** One clean Markdown table per phase with `#`, `Do this`, `Expected`, and an empty `Result (pass / fail / notes)` column for the tester.
- **Paste-Back Summary:** Concludes with a pre-formatted, compact `step: PASS/FAIL - note` block and failure anomaly fields (Chrome version, Android OS version, TalkBack state, exact spoken error text, stopwatch time) ready for copy-pasting back into GitHub issues or team chat.

---

## 2. Allowed Files Touched

Per lane rules, strictly the allowed documentation files:
- [`docs/PHONE_TEST.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-phonetest/docs/PHONE_TEST.md) (new test script)
- [`docs/reports/agy-lab-phonetest-report.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-phonetest/docs/reports/agy-lab-phonetest-report.md) (this lane report)

---

## 3. Items Marked `(verify)`

The following 4 items could not be 100% verified from repo code alone and depend on the physical OnePlus Nord CE6 device hardware, operating system state, or live cloud deployment:

1. **Vercel Deployment State (Step 1 & Step 2):**  
   - `(verify)` whether `https://ghost-touch-iota.vercel.app` has been redeployed with the latest `main` commit containing the Frankenstein Lab theme (mascot emblem, specimen table frame, and brand assets), or if it still serves the legacy pre-lab build (`#0b0b10`). Visual lab checks are noted as "n/a (old build)" until redeployment occurs.
2. **OnePlus Nord CE6 Haptic Motor Sensitivity for Centre Tick (Step 5.2):**  
   - `(verify)` whether the subtle 25 ms single pulse (`vibrate(25)`) indicating entry calibration at the center of the screen is distinctly perceivable on the OnePlus Nord CE6's physical haptic actuator when initiating the TalkBack double-tap-and-hold pass-through gesture.
3. **Triangle Fact Answer Token Matching (Step 7.1):**  
   - `(verify)` whether asking *"How long is AB?"* answers with 5 cm or 3 cm. In `frontend/public/samples/triangle.json`, the facts are: `angle C = 90 degrees`, `AC = 4 cm`, `BC = 3 cm`, and `AB = 5 cm`. If the vision LLM or backend `facts_lookup` matcher returns `"AB = 5 cm."` or `"BC = 3 cm."`, this should be verified during the live run against Render.
4. **Android / Google TTS Indian Voice Pack Pre-installation (Step 12.3 & 12.4):**  
   - `(verify)` whether the owner's OnePlus Nord CE6 already has the Google Text-to-speech offline voice data installed for `Hindi (India)` and `Gujarati (India)`, or whether the user hears the WebSpeechDriver fallback announcement (*"No system voice found for HI/GU. Using default voice."*) and must download the packs via Android Settings > Accessibility > Text-to-speech output > Google TTS settings > Install voice data.

---

## 4. Definition of Done Command Proof

In compliance with the headless run rules:
- No code or package commands were run.
- Allowed inspection commands executed:

### A. Git Status Check
**Command:** `git status`  
**Output:**
```
On branch agy/lab-phonetest
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/PHONE_TEST.md
	docs/briefs/agy-lab-phonetest.md
	docs/reports/agy-lab-phonetest-report.md

nothing added to commit but untracked files present (use "git add" to track)
```

### B. Git Diff Check
**Command:** `git diff`  
**Output:** Clean (0 lines changed on tracked files; only new documentation files created).

---

## 5. Commit Groups

Recommended logical conventional commit for review:

### Commit 1: `docs(test): add 20-minute phone test script for OnePlus Nord CE6`
**Files:**
- `docs/PHONE_TEST.md`
- `docs/reports/agy-lab-phonetest-report.md`

**Description:**  
Adds the single-hand 20-minute test script (`docs/PHONE_TEST.md`) for the owner's OnePlus Nord CE6, covering all 13 phases (Render backend wake, PWA installation, Start screen, Lab settings sheet, TalkBack OFF exploration, TalkBack ON pass-through exploration, voice commands in all 3 languages, Ask QA, textbook photo capture, PDF upload, offline saved diagrams, Teacher Correct mode, and Hindi/Gujarati TTS voices). Includes empty result tables, failure data collection fields, and lane report.
