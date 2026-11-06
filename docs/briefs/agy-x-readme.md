# Lane x-readme: bring README.md up to date for the judges

Documentation only. DO NOT edit `docs/BUILD_LOG.md`. Create your report `docs/reports/agy-x-readme-report.md` FIRST as a short skeleton and update it as you go. START EDITING README.md EARLY. Allowed commands: `git status`, `git diff`. No tests, no other commands.

README.md is the first thing the Kiroween and STEMergent judges and the owner's school contacts will read. It must be accurate, honest and easy to scan. Read: `README.md`, `docs/KIRO_WRITEUP.md` (section "How the tools were used"), `docs/STEMERGENT_SUBMISSION.md`, `docs/design/LAB_THEME.md`, `docs/design/LOGO.md`, `docs/PHONE_TEST.md` (the title only), `docs/DEPLOY.md`, `docs/BOTS.md`, `CLAUDE.md` (the project facts only), `docs/design/screenshots/` (list the exact file names with the file tools first).

## Facts (verified 2026-11-06; do not invent others)
- Live frontend `https://ghost-touch-iota.vercel.app` (Vercel), live backend `https://ghost-touch-api.onrender.com` (Render free tier: the first request after idle takes about 30 seconds). The live vision AI sometimes falls back to Raw Mode (outline detection) when the AI providers are slow or unconfigured; the app never leaves the user with nothing.
- The app is a PWA for Android Chrome (iOS has no web vibration, so it is out of scope). Not yet tested on a physical phone by the owner. Hindi and Gujarati text is machine-translated and not yet reviewed by a native speaker.
- Current numbers on `main`: frontend 1109 tests in 76 files, backend passing (see `docs/KIRO_WRITEUP.md` for the last measured count), `tsc` and builds clean.
- Tool credit (honest): Kiro wrote the specs, steering docs, hooks, the haptic engine, schema, validator and property tests; Antigravity (agy) built most of the app and the whole Lab redesign; Claude Code supervised (briefs, reviews, merges, verification). Git authorship is NOT a reliable record (303 commits sit under the owner's name), so the README points to `docs/KIRO_WRITEUP.md` and `docs/BUILD_LOG.md`. Never claim Kiro built the redesign.
- Screenshots exist as `docs/design/screenshots/after-<screen>-390x844.png` and `-1440x900.png` for start, capture, settings, loading, explore, ask, raw, plus `after-correct-390x844.png`, and `before-...` for comparison.

## Allowed files
`README.md`, `docs/reports/agy-x-readme-report.md`.

## Forbidden
Everything else (no code, no other docs). README currently has NO `[FILL]` markers: do not add any.

## Do
1. Keep what is already correct (the logo at the very top, the project description, the Kiro and tool sections, the commands). Restructure only where it helps a reader: a one-paragraph pitch ("a creature stitched from a notification buzzer (nerves), a vision LLM (eyes) and a synthesizer (voice)"; what it does; who it helps), a "Try it" section with the two live URLs and the cold-start note, a "How it feels" section with 3 or 4 phone screenshots (relative image links to `docs/design/screenshots/after-start-390x844.png`, `after-capture-390x844.png`, `after-explore-390x844.png`, `after-correct-390x844.png`; use only names you confirmed exist), the architecture in a few lines (pure core, drivers, FastAPI, the vision chain OpenAI then Gemini then Nebius then Raw Mode), the haptic design in two lines (lines vibrate, corners "bzzzz-tap", quiet period, theremin pitch), accessibility commitments (48 px targets, 7:1 contrast, Atkinson Hyperlegible, spoken state changes, reduced motion, offline PWA), "Built with Kiro, Antigravity and Claude Code" with the honest table of who did what and a link to `docs/KIRO_WRITEUP.md`, "Run it locally" (copy the exact commands from the existing README and `CLAUDE.md`; do not invent flags), "Tests" with the current numbers, "Status and honest limitations" (not yet phone-tested, machine-translated Hindi and Gujarati, AI fallback to Raw Mode on the free tier, Android only), and a licence line (keep the existing one).
2. Every claim must be checkable in the repo; where unsure, leave the existing wording or add "(verify)" in your report, not in the README. No marketing superlatives, no claims about user results, no blindness jokes.
3. Keep the length reasonable (roughly 150 to 250 lines) and make sure every relative link and image path points to a file that exists (check each with the file tools).
4. Report: list what changed, every link you verified, and anything you could not verify. End with **Commit groups**.
