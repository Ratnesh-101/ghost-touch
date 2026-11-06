# Lane t2-teach-editor (agy)
Read `docs/briefs/guide-share-contract.md` (Global rules + Share contract) and AGENTS.md first.
Starts from a branch that already contains T1 and T3 (`share/`, hash routing, `config/features.ts`, student open).
Goal: the sighted teacher route `#/teach`.
Allowed files: `frontend/src/screens/Teach.tsx` (new), `frontend/src/components/teach/**` (new), `frontend/src/flow/teach.ts` (new), `frontend/src/drivers/hashRoute.ts` (add `TEACH_HASH`), `frontend/src/drivers/clipboard.ts` (new: copy + Web Share API wrapper; browser APIs live in drivers), `frontend/src/App.tsx`, `frontend/src/screens/Correct.tsx` + `frontend/src/flow/correct*.ts` ONLY to extract reusable pieces without changing Correct's behaviour or tests, `frontend/src/components/LabSettings.tsx` (teacher-tools toggle), `frontend/src/i18n/index.ts`, `frontend/src/styles/*.css`, new tests `frontend/tests/teach.*.test.ts(x)`, translation-review md + csv, report, BUILD_LOG.
Forbidden: `frontend/src/core/**`, `.kiro/**`, `.env*`, `share/` internals.
Requirements (REUSE the Correct pipeline, `core/correct.ts` history/undo, hit-testing and canvas; do not rebuild):
- Load a scene from: the current capture/Explore scene, a saved diagram, or a pasted/opened share link (decodeShare).
- Edit: rename labels, delete / add / move vertices (keyboard accessible: arrow keys nudge, Delete removes, Tab order sane, visible focus), undo/redo, live preview canvas. If `kind === 'function_graph'`: fields for axis ranges (x_axis_y, y_axis_x) validated to [0,1] or empty.
- Every edit result goes through `validateShareScene`; show errors in plain language; "Mark verified" disabled until valid.
- Verify form: teacher name (required, <=60), note (optional, <=280), verifiedAt = now ISO. Honest copy on screen: "Verified means a person reviewed this diagram. It is not cryptographic proof." (i18n en/hi/gu).
- Share panel: generated link, "Copy link" button, "Share" (Web Share API only when available), QR via `qrDataUrl` when the URL fits, else the message "Link too long for a QR code; use Copy link". Show size in characters. Link origin = `VITE_SITE_URL` or `window.location.origin` (via a driver).
- Gated by `VITE_FEATURE_SHARE === '1'` AND the teacher-tools setting. Works at 390 px and 1440 px width; 48x48 targets; labelled controls; spoken confirmations ("Link copied").
Acceptance: tests for editing flow, validation blocking, verify form limits, QR present/absent, copy via mocked clipboard, flag off, keyboard operation, a11y names; a round trip test: edit -> encode -> decodeShare equals edited scene; suite, tsc, build pass.
