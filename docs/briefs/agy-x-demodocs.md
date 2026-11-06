# Lane x-demodocs: refresh the demo script, social post and user-test sheets for the Lab redesign

Documentation only. DO NOT edit `docs/BUILD_LOG.md`. Create your report `docs/reports/agy-x-demodocs-report.md` FIRST as a short skeleton and update it as you go. Allowed commands: `git status`, `git diff`. No other commands, no tests. START EDITING EARLY; do not stop to print directory listings.

## Read first
`docs/DEMO_SCRIPT.md`, `docs/design/LAB_DEMO_NOTES.md`, `docs/SOCIAL.md`, `docs/user-test/` (all files: `plan.md`, `task-sheet.md`, `facilitator-checklist.md`, `consent-script.md`, `results-template.md`, `outreach-email-draft.md`), `docs/PHONE_TEST.md`, `docs/design/LAB_THEME.md`, `docs/STEMERGENT_SUBMISSION.md` (for the pitch wording), `docs/KIRO_WRITEUP.md` (section "How the tools were used").

## Facts about the current app (verified 2026-11-06; do not invent others)
- Screens: Start (logo, mascot, three organ rows Nerves, Eyes, Voice, one big "Wake the creature" button; the whole screen is one button and the intro is spoken); Capture (header with logo, ONE "Settings: <language>, <speed>" button that opens the Lab settings sheet, a large "Take photo" button, secondary "Choose image" and "Saved diagrams", three sample "specimen" cards with mini previews: Right triangle, Sine wave, Bar chart; while reading a diagram a "The lab is powering up" meter shows); Explore (the diagram on a stitched specimen-table frame; vibration on lines, a "bzzzz-tap" at corners, a quiet period after corners, a rising theremin tone on graphs; Ask, Correct and Back buttons; a short spark when a diagram has loaded; a Raw Mode notice "The creature's eyes are blurry, you can still feel the outlines" when the AI could not read the diagram); Ask by voice or text; Saved diagrams (works offline); Teacher Correct mode.
- Languages: English, Hindi, Gujarati (Hindi and Gujarati are machine-translated and NOT yet reviewed by a native speaker: say so wherever they appear in user-facing plans).
- The app has NOT been tested on a physical phone yet; the live backend sometimes falls back to Raw Mode because of provider keys and timeouts (the owner is fixing the deployment settings). The first request after the backend is idle can take about 30 seconds.
- Pitch: a creature stitched from a notification buzzer (nerves), a vision LLM (eyes) and a synthesizer (voice). The spookiness lives in the creature and the lab, NEVER in blindness: no blindfold jokes, no "darkness" jokes, no eye-gore.
- Tools disclosure (keep it honest): Kiro for specs, steering, hooks and property tests; Antigravity (agy) built the redesign; Claude Code supervised. Do not claim Kiro built the redesign.

## Allowed files
`docs/DEMO_SCRIPT.md`, `docs/SOCIAL.md`, `docs/user-test/task-sheet.md`, `docs/user-test/facilitator-checklist.md`, `docs/user-test/plan.md`, `docs/user-test/results-template.md`, `docs/reports/agy-x-demodocs-report.md`.

## Forbidden
Everything else. Leave every `[FILL]` marker exactly as it is (do not fill or delete any). Do not change `consent-script.md` or `outreach-email-draft.md`. No code, no tests.

## Do
1. `docs/DEMO_SCRIPT.md`: keep it a 3-minute script (the outline in the file already has timings: problem, the creature, live demo, graph, "never fails", impact and Kiro), but update every on-screen step and spoken line to the CURRENT screens above. Make the live part robust: start from the sample cards (no network needed), mention warming the backend first (open the health URL a minute before recording), show Raw Mode deliberately as a feature ("the app never leaves you with nothing") instead of hoping the AI works, and show the settings sheet switching to Hindi. Keep timings summing to at most 3:00 and add a "what can go wrong and the fallback" table (cold backend, AI fallback to Raw Mode, speech blocked before a tap, no vibration on the recording device).
2. `docs/SOCIAL.md`: refresh every draft post for the redesign (logo, "creature", the three organs) with correct claims only; keep hashtags and the structure; keep every `[FILL]` placeholder.
3. `docs/user-test/task-sheet.md`, `facilitator-checklist.md`, `plan.md`, `results-template.md`: update screen names, button labels and steps to the current UI (for example "Settings: English, 1.0×" button, "Wake the creature", specimen cards), add a short facilitator note that Hindi and Gujarati text is machine-translated and that the participant's feedback on wording is part of the test, and keep the existing structure, consent steps and scoring fields. Do not add claims about results.
4. Report: list each file with a one-line summary of what changed and anything you could not verify. End with **Commit groups**.
