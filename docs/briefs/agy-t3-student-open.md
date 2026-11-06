# Lane t3-student-open (agy)
Read `docs/briefs/guide-share-contract.md` (Global rules + Share contract) and AGENTS.md first.
Starts from a branch that already contains T1 (`frontend/src/share/`).
Goal: a student opens `/#s=<payload>` and lands in Explore with a "Verified by <name>" banner.
Allowed files: `frontend/src/config/features.ts` (create if absent, else reuse), `frontend/src/drivers/hashRoute.ts` (add `SHARE_HASH_PREFIX`, `parseShareHash`; keep `#/debug` behaviour and its tests), `frontend/src/App.tsx` (route handling), `frontend/src/screens/Explore.tsx` (optional `verified?: {by, note, at}` prop and banner only), `frontend/src/components/VerifiedBanner.tsx` (new), `frontend/src/screens/ShareError.tsx` (new, friendly error + "Go to start" button), `frontend/src/i18n/index.ts`, `frontend/src/styles/*.css`, new tests `frontend/tests/share.open.*.test.ts(x)`, translation-review md + csv (append new keys), report, BUILD_LOG.
Forbidden: `frontend/src/core/**`, `.kiro/**`, `.env*`, `share/` internals (use its public API; report real bugs).
Requirements:
- Flag `VITE_FEATURE_SHARE === '1'` gates share routes (setting not needed to OPEN a link; it gates the teacher tools). Flag off => hash ignored, normal start screen.
- Flow: read hash -> `decodeShare` -> on success set view to Explore with the scene and `verified`, announce scene then "Verified by <name>" (spoken + visible banner, role=status). The note is shown/spoken on request only (a "Read note" button).
- Errors (ShareError codes too-large, bad-format, bad-version, bad-scene, empty): speak a friendly message and show it with a "Go to start" button; never show a stack or raw payload. i18n en/hi/gu for each code.
- No network call at all (assert `fetch` is not called). After the first load the app works offline (the route is the PWA shell; verify `vercel.json` rewrite and the service worker do not break `/#s=` and add a test if config tests exist).
- Name/note/labels render as React text only. Test a `<img onerror>` name renders as literal text.
- Changing the hash while the app is open re-routes. Back from Explore goes to start, and clears the hash with `history.replaceState` inside `drivers/hashRoute.ts`.
Acceptance: tests for valid link, each error code, flag off, no-fetch, XSS-literal rendering, spoken order; suite, tsc, build pass.
