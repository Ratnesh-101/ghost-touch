# Lane x-fillurls: fill every [FILL] marker that has a known, verifiable answer (and ONLY those)

Create `docs/reports/agy-x-fillurls-report.md` FIRST. Run no tests (docs only). Edit only: `docs/STEMERGENT_SUBMISSION.md`, `docs/SOCIAL.md`, `docs/KIRO_WRITEUP.md`, `docs/BUILD_LOG.md` and the report.

## Known facts you may use (nothing else)
- Repository URL: `https://github.com/Ratnesh-101/ghost-touch`
- Live app (frontend): `https://ghost-touch-iota.vercel.app`
- Live API health: `https://ghost-touch-api.onrender.com/api/v1/health`
- Test counts on main (2026-11-06): 1203 frontend tests in 82 files, 422 backend tests, `tsc`, `ruff check`, `ruff format --check` and the production build all clean.
- Tool credit is already written in `docs/KIRO_WRITEUP.md`; do not change it.

## Do
1. `docs/STEMERGENT_SUBMISSION.md`: replace the `[FILL]` markers for the GitHub repository URL and the Vercel deployment URL (the "Repository" and "Live App" bullets) with the real URLs. In the checklist line about screenshots, demo video, repo link and live URL, keep the unchecked box and keep a `[FILL: ...]` only for what is still missing (screenshots/GIFs and the demo video); mention the repo and live URL are done.
2. `docs/SOCIAL.md`: in every `Repo`/`repo or live URL` line replace the `[FILL: repo or live URL]` with the right URL (repo link for "Repo"/"codebase" lines, live app for "try the app" lines, both where a line says "repo & live demo"). Leave every `[FILL: video URL]` exactly as is.
3. `docs/KIRO_WRITEUP.md` line with `Submission Day Verification`: replace the marker with the counts above and the date 2026-11-06, and add "re-run before submitting" so it is not presented as final.

## Do NOT touch (leave the marker exactly as written)
- The demo video URL and the screenshots/GIF media.
- Team member names, roles and student details.
- The school-session sentence (BPA Ahmedabad).
- The TalkBack Compatibility row (hardware verification is still pending).
Never invent a URL, name, quote, number or event. If unsure, leave the marker.

## Report
List every marker you filled (file:line, old, new) and every marker you deliberately left, with the reason. Add a BUILD_LOG entry (tool = Antigravity (agy)). End with **Commit groups**: one commit `docs: fill in the repo, live app and verification markers that have known answers`.
