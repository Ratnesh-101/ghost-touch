# Lane lab-docs: phone checklist and demo notes for the Lab redesign

Read `docs/briefs/lab-spec.md` first. Documentation only; you change no code.

## Allowed files
- `docs/PHONE_CHECKLIST_LAB.md` (new), `docs/design/LAB_DEMO_NOTES.md` (new), `docs/reports/agy-lab-docs-report.md`

## Forbidden
Everything else (code, tests, other docs, `.kiro/**`, `.env*`).

## Do
1. `docs/PHONE_CHECKLIST_LAB.md`: a copy-paste checklist for the owner to run on a real Android phone, once with TalkBack OFF and once with TalkBack ON. Cover: install the PWA and open it offline (airplane mode), fonts and icons still show; Start (spoken intro, "Wake the creature" via double-tap); Capture (hierarchy: Take photo first; secondary actions; the Lab settings button with its spoken current choice); the Lab settings sheet (opens with focus inside, spoken, Escape or back closes, focus returns, language and speed persist after reload); sample diagram to Explore (haptics unchanged: lines vibrate, corners "bzzzz-tap", the 450 ms quiet period, the theremin tone); the "it's alive" animation (short, no strobing; with "Remove animations" ON it is static); Ask by voice and by text box; the Raw Mode notice text; Saved diagrams (empty state, save, reopen offline); Correct mode; 200% font size and a 320 px-wide viewport; the OS dark or light setting does not break contrast; the app icon and splash on the home screen. Use `- [ ]` boxes, each with the expected result in one line, and a "Result" line the owner can fill in.
2. `docs/design/LAB_DEMO_NOTES.md`: how to show the Lab design in the demo video (3 minutes max; shots, what to say, which screens, the order). Keep the pitch: "a creature stitched from a notification buzzer (nerves), a vision LLM (eyes) and a synthesizer (voice)". Never joke about blindness; the Halloween spirit belongs to the creature and the lab only. Add a short list of what NOT to show.
3. Only state facts that exist in the repo today or are described in `docs/briefs/lab-spec.md`. Mark anything uncertain as "(verify)".

## Done
Report lists the files and **Commit groups**. You run no commands except reading files and `git status` or `git diff`.
