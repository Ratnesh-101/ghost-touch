# Lane lab-flowbugsb: language, Ask and TalkBack findings from the bug audit

Read `docs/reports/audit-bugs.md` (in this worktree). Fix findings 10 and 11. For findings 5 and 14 you do INVESTIGATION ONLY (no behaviour change): they touch the hand-tuned TalkBack and pointer behaviour.

## Findings
- Finding 10 (MEDIUM): changing the language does not re-render the active screen's labels. Make the screens re-render on language change using the existing language state or a tiny subscription (read `i18n/index.ts` and how the language is stored; the new settings sheet on Capture changes it). Do not change any translation text. The spoken confirmation of a language change stays exactly as it is.
- Finding 11 (MEDIUM): unhandled promise rejections in the Explore Ask flow (voice recognition, the ask API call, speech). Make every async path in `screens/Explore.tsx` and `flow/ask.ts` end in a handled state: on failure the user hears the existing error message (`ask.error`-style strings already exist; reuse them, add none) and the screen returns to idle with focus restored; never silence. Keep the cancel and abort behaviour (`tests/flow.ask.abort.test.ts` must pass unchanged).
- Finding 5 and 14: do NOT fix. For each, write in the report: whether the finding is real (read the code and reason from it), the exact files and lines, the smallest possible fix, the risk it would change the tuned TalkBack or haptic behaviour, and your recommendation. The owner will decide after a phone test.

## Allowed files
`frontend/src/i18n/index.ts` (language-change subscription helper ONLY; no text changes), `frontend/src/App.tsx` (small targeted change only), `frontend/src/screens/Explore.tsx` (the Ask handlers only), `frontend/src/flow/ask.ts`, `frontend/src/components/LanguageSelector.tsx`, their tests (extend, never weaken), new tests `frontend/tests/lang.rerender.test.tsx`, `frontend/tests/ask.errors.test.tsx`, `docs/reports/agy-lab-flowbugsb-report.md`.

## Forbidden (hard)
`core/**`, haptic values, `drivers/**`, the Explore canvas, pointer handlers, the TalkBack relative cursor and anything about touch input, `screens/Capture.tsx`, `screens/Start.tsx` (another lane edits them), backend, `.env*`, prop tests.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report per finding (fixed ones with the proving test, investigated ones with the analysis above) and **Commit groups**; write the report even if something failed.
