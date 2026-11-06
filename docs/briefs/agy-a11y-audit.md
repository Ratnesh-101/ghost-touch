# Lane a11y-audit (REPORT ONLY)
Read AGENTS.md first. Never open `.env*`. You change NO source, test or config file. You write only `docs/reports/agy-a11y-audit.md` (create it first, save as you go) and one `docs/BUILD_LOG.md` entry (tool = "agy, reviewed by Claude").
Task: accessibility and UX audit of the deployed app https://ghost-touch-iota.vercel.app (only if you can reach it; otherwise say so) and the frontend source in `frontend/src/`. Cover:
- screen-reader names/roles/labels on every screen and control; live regions and spoken state changes
- focus order and keyboard operability
- touch targets at least 48x48 dp
- colour contrast (compute ratios from the CSS tokens)
- reduced motion (`prefers-reduced-motion`) handling in CSS and the audio/pulse cues
- the TalkBack flow described in `docs/PHONE_TEST.md`: trace it through the code and note where a blind user could get stuck
- spoken error messages in en, hi and gu (are all error paths localized and spoken, not only shown?)
Mark anything you cannot verify without a phone or screen reader as UNVERIFIED. Do not claim hardware verification.
Report format per finding: `ID · severity · file:line · what is wrong · concrete scenario · minimal fix`. Separate CONFIRMED from UNVERIFIED. If an area is sound, say so in one line with what you checked. End with "Top 5 to fix first". Ignore `frontend/src/core/**`.
You may run `npm --prefix frontend test` and tsc. Do not run backend tests or ruff.
