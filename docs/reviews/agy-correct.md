# Review: lane T11a (Teacher Correct mode, frontend), branch agy/correct
Reviewer: Claude Code. Builder: Antigravity (agy), at the owner's explicit request (2026-11-04). Date: 2026-11-04.

**Verdict: APPROVE.** This is agent-written code, including a core module, the P16/P17 property tests and spec edits. It is NOT Kiro's work and must not be described as such in the write-up.

- Scope: `core/correct.ts` (new, pure), `api/validate.ts`, `flow/correct.ts`, `screens/Correct.tsx`, `styles/correct.css`, `App.tsx`, `Explore.tsx` (one optional "Correct" button; gesture handling untouched), `Capture.tsx` and `flow/capture.ts` (hand the photo over), `i18n` keys, four test files, and `.kiro/specs` additions (Req 9 criteria, P16, P17, sub-tasks). No haptic engine, hit-test, pitch, geometry, backend or scene.gen.ts change.
- Seam with the backend (lane T11b): the client sends `{scene}` and parses `{ok, scene, errors}`, exactly the contract implemented by `POST /api/v1/validate`.
- Verified by me in the lane: `tsc` clean, 351 frontend tests pass (34 files), build OK. P16 and P17 each run 250 cases.
- Not verifiable here: the drag/edit UI on a real phone; Hindi and Gujarati strings are machine-translated.
