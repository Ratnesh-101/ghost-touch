# Lane finaldocs-b: screenshots in the theme doc, and current test counts in README and the submission draft

A previous attempt at the docs task produced NO file changes (it only printed directory listings, with invented filenames). Do not repeat that. START EDITING WITHIN YOUR FIRST FEW STEPS. Documentation only; no code, no tests.

## Allowed files
`docs/design/LAB_THEME.md`, `README.md`, `docs/STEMERGENT_SUBMISSION.md`, `docs/reports/agy-lab-finaldocs-b-report.md`. Nothing else. Leave every `[FILL]` marker exactly as it is.

## Facts
- The screenshots are in `docs/design/screenshots/`. The EXACT existing filenames (use these and no others; do not invent names such as "phone" or "desktop"):
  before: `before-start-390x844.png`, `before-start-1440x900.png`, `before-capture-390x844.png`, `before-capture-1440x900.png`, `before-loading-390x844.png`, `before-loading-1440x900.png`, `before-explore-390x844.png`, `before-explore-1440x900.png`, `before-ask-390x844.png`, `before-ask-1440x900.png`, `before-raw-390x844.png`, `before-raw-1440x900.png`
  after: `after-start-390x844.png`, `after-start-1440x900.png`, `after-capture-390x844.png`, `after-capture-1440x900.png`, `after-settings-390x844.png`, `after-settings-1440x900.png`, `after-loading-390x844.png`, `after-loading-1440x900.png`, `after-explore-390x844.png`, `after-explore-1440x900.png`, `after-ask-390x844.png`, `after-ask-1440x900.png`, `after-raw-390x844.png`, `after-raw-1440x900.png`, `after-correct-390x844.png`
  (There is no "before" for the settings sheet or Correct, because the settings sheet is new and the Correct screenshot was taken only after the redesign.)
- Current numbers on `main`: frontend 1049 tests in 74 files, all passing, `tsc` clean, build clean. Measure the backend count yourself with the allowed command `backend/.venv/Scripts/python -m pytest backend` and quote what it prints.

## Do (edit as you go)
1. `docs/design/LAB_THEME.md`: first list the directory contents with the file tools to confirm the names above, then add a "Screenshots" section with a small table (screen, before, after) using relative markdown image links (`screenshots/after-start-390x844.png` relative to `docs/design/`) and one line describing what changed on each screen (Start: logo, mascot, compact organ tiles and "Wake the creature" now fit one phone screen; Capture: one settings button, Take photo primary, specimen cards with previews; Settings: new sheet; Loading: "the lab is powering up" meter; Explore: one settings button, full title, canvas fills its frame, stitched frame; Ask and Raw Mode: lab styling and the Raw Mode notice; Correct: canvas fills its frame). Do not claim anything the screenshots do not show.
2. `README.md`: update the "As of 2026-11-04 ... 473 frontend tests and 347 backend tests" sentence and the "(473 tests)" comment to the verified current numbers and today's date (2026-11-06). Change nothing else.
3. `docs/STEMERGENT_SUBMISSION.md`: update the "Automated Verification" line (473 frontend tests across 42 files; 347 backend) to the verified current numbers. Change nothing else.
4. Write `docs/reports/agy-lab-finaldocs-b-report.md` listing each change (before, after) and the measured backend number. End with **Commit groups**.

## Rules
Allowed commands: `backend/.venv/Scripts/python -m pytest backend`, `git status`, `git diff`, `git log --oneline -10`. Never open `.env*`.
