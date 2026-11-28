# End-of-day test runbook (2026-11-28, before STEMergent judging)

One ordered list. Do it top to bottom. Each line says what to do and what "pass" means. Detailed rows live in `docs/PHONE_TEST.md` (Steps 2 to 22). Paste results back to Claude Code; anything that fails gets fixed or reverted before judging.

Pass/fail rule: if something is broken that a judge would hit in the first minute (Start, a sample, Ask, a photo), fix or revert before going live. Cosmetic or rare items can wait.

## A. Before you test (10 min)
1. Review the diff and tell Claude Code `COMMIT <name>` for each group, or `COMMIT all`. Planned order: spec, core, copy, speech, wire, a11y and speech fixes, e2e, docs, readme, agents.
   - Pass: `git status` shows only `SUBMISSION_AUDIT.md`, `submission/` and local logs untracked.
2. Decide the `.kiro/agents/*.json` permission rules (`git diff .kiro/agents`). The upgrade added unconditional write and shell allow entries. Keep for the newer Kiro engine, or ask Claude Code to tighten.
3. Push to GitHub, then wait for Vercel to finish deploying. Note the commit hash: ____
4. Open `https://<render-url>/api/v1/health`. Pass: `{"ok": true}`. First answer after idle can take 30 s.
5. Set up the uptime monitor: UptimeRobot or cron-job.org, HTTP check on `/api/v1/health` every 5 minutes. Never point it at upload or Ask.

## B. Phone, live URL, TalkBack OFF (15 min)
Use Chrome on your OnePlus over HTTPS, in a fresh tab, on the live URL (not localhost).
1. Start screen: tap. Pass: vibrates once, speaks a greeting and the next step, and Capture opens.
2. Samples, eyes closed: triangle, sine, bars. Pass: line buzz, corner "bzzzz-tap" with the label spoken, quiet after a corner, theremin rises and falls on the sine.
3. Ask by voice on the triangle: "How long is AB?" Pass: "3 centimetres". Then "What colour is it?" Pass: "I don't know from this diagram."
4. Ask error path: turn mobile data off, then Ask. Pass: a short funny clause then a clear action, and focus moves to the typing box. Ask again. Pass: the second error has no joke.
5. Real photo of a printed textbook triangle. Pass: AI mode within about 30 s, and "reading" is spoken while you wait. Then a messy photo. Pass: Raw Mode outlines, no crash.
6. Airplane mode: open a sample. Pass: it works. Reload while offline. Pass: still works (PWA).
7. Install as PWA from the Chrome menu and open it.
8. Largest display size and font size in Android settings: Start, Capture and Explore are not cut off.
9. Hindi, then Gujarati: switch language. Pass: text shows, a voice exists or the English no-voice notice plays, nothing overflows.

## C. Phone, TalkBack ON (15 min)
Run `docs/PHONE_TEST.md` Step 21 in full. The ones that matter most:
1. Speech and TalkBack do not talk over each other on Start, Capture, Explore.
2. Settings sheet: swipe past the last control. Pass: focus does not escape to Capture behind it.
3. Build ("Make my own graph"): you hear the next-step line, not only "Plot a graph".
4. Correct: intro spoken once. Raw notice: once. Teach then Back: Capture.
5. Saved: Delete, then Confirm or Cancel keeps focus on the new button.
6. Ghost Host tone: does the greeting make you smile AND tell you what to tap next?
7. Ask by voice with TalkBack on, including the two-finger long-press.

## D. Live deployment (5 min)
Run `docs/PHONE_TEST.md` Step 22.
1. Logged-out incognito window on desktop and phone: the live app loads.
2. After 20 minutes idle, `/api/v1/health` answers in under 2 s (the uptime monitor works).
3. Do not hammer upload or Ask afterwards (Gemini free tier). Three or four calls total.

## E. STEMergent entry (10 min)
1. Open your STEMergent Devpost entry. Confirm it is submitted and the live link works logged out.
2. If it is editable, update `docs/STEMERGENT_SUBMISSION.md`: remove the "as submitted before" line, fill the `[FILL]` links, update test counts (3444 vitest, 220 Playwright, 268 test files).
3. Keep the honest line: no blind student has used it yet. Mention BPA only if a session happened.
4. Confirm the repo is public if STEMergent needs it, and that `.kiro/` shows at the root logged out.
5. Run gitleaks on the final HEAD yourself: `gitleaks detect --source . --log-opts="--all"`.

## F. Automated checks Claude Code already ran (2026-11-28, on the uncommitted tree)
- `tsc --noEmit` clean. vitest 269 files and 3444 tests pass. Production build ok.
- Playwright on two emulated Galaxy S24 viewports: all pass after one stale assertion was updated (`e2e/phone-test-emulated-2.spec.ts:174`).
- Emulated probes found no unnamed controls, no targets under 48 px, no overflow at 200% font, and the triangle sample opens offline. Real TalkBack, vibration feel, voices and the microphone are NOT covered. That is what sections B and C are for.
- Backend pytest passed on its last run; one rate-limit test was flaky once and passed 3 of 3 on re-run.

## G. Known open items (not blockers)
- Task 93.3 in `.kiro/specs/ghost-touch/tasks.md`: the Ask screen's `host.ask.next` has no caller, and the empty Saved list has no next-step line. Needs your decision.
- Hindi and Gujarati text is machine-translated and unreviewed. English is the reviewed language. Say so on Devpost.
- Kiroween things (video, Devpost form, native speakers, user-testing placeholders) are in `submission/HUMAN_ONLY.md`, due before Dec 5, 3:30 AM IST.
