# Lane lab-phonetest: ONE 20-minute phone test script for the owner's OnePlus Nord CE6

Documentation only. You change no code. Read `docs/PHONE_CHECKLIST_LAB.md` (a longer checklist already exists: you are writing a different, shorter, ordered script), `docs/briefs/lab-spec.md`, `docs/DEPLOY.md`, `docs/user-test/` (look at what exists), `frontend/src/flow/commands.ts` (the real voice commands, in all three languages: quote the exact phrases), `frontend/src/i18n/index.ts` (spoken strings) and `.kiro/steering/tech.md` (haptic table).

## Allowed files
`docs/PHONE_TEST.md` (new) and `docs/reports/agy-lab-phonetest-report.md`.

## Forbidden
Everything else.

## Facts to put at the top of the script (verified by the supervisor today)
- Live frontend: `https://ghost-touch-iota.vercel.app` (Vercel). It currently serves the OLDER build (legacy theme colour `#0b0b10`, no brand files) until the owner pushes `main` and Vercel redeploys; after a redeploy, steps that mention the Lab look apply; before it, mark those steps "n/a (old build)".
- Live backend: `https://ghost-touch-api.onrender.com`. It is on Render's free tier: the FIRST request after idle can take about 35 seconds (measured 32 s for `/api/v1/health`). Step 0 is therefore: open `https://ghost-touch-api.onrender.com/api/v1/health` in Chrome and wait for `{"ok":true}` BEFORE starting the timer.
- On 2026-11-06 a live request with a clean triangle image returned Raw Mode with reason "timeout" because the vision providers were slow or unavailable (Gemini returned 503 "high demand" locally). So expect AI mode to be flaky until the owner fixes the provider keys and timeouts on Render; the script must say how to tell AI mode from Raw Mode (the spoken announcement and the notice text) and to record which one happened.

## Do
Write ONE script, total about 20 minutes, with a time budget per step (minutes), numbered steps and the expected result for each, in exactly this order: 0 wake the backend; 1 install as a PWA; 2 start; 3 settings sheet (open, change language and speed, close, focus returns, the choice persists after a reload); 4 the three samples in Explore with TalkBack OFF (triangle, sine, bars: lines vibrate, corners "bzzzz-tap", 450 ms quiet window, theremin rises on the curve); 5 the same three samples with TalkBack ON (double-tap-hold-drag pass-through, centre reference tick); 6 voice commands (list the exact phrases from `flow/commands.ts`); 7 Ask by voice and by text ("How long is AB?" on the triangle sample answers "3 centimetres"; "What colour is it?" answers "I don't know from this diagram."); 8 Take photo of a real textbook diagram (record AI or Raw mode and the time it took); 9 PDF upload; 10 Saved diagrams offline (save one, switch to airplane mode, reopen it, explore it); 11 Correct mode (drag a wrong point, validate, save); 12 Hindi and Gujarati speech (does the phone have the voices installed? if not, where to install them; what is spoken).

Format: one markdown table per phase with columns `#`, `Do this`, `Expected`, `Result (pass / fail / notes)`, leaving the Result column EMPTY for the owner. End with a "Paste this back" block: a compact list the owner can fill in and send (`step: PASS/FAIL - note`), plus a short list of data to include if something fails (Chrome version, TalkBack on or off, the exact text of any spoken error, the time the step took). Keep every instruction short, in plain words, usable with one hand and a stopwatch. Mark anything you cannot verify from the repo as "(verify)".

## Done
Report lists the file and anything marked "(verify)". Run NO commands except reading files, `git status` and `git diff`. End with **Commit groups**.
