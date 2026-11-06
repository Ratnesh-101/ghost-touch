# Lane lab-fixes: the three findings of the independent review, and a lost submission marker

Read `docs/reports/review-lab-final.md` (findings F-01, F-02, F-03). Fix exactly the items below and nothing else. DO NOT RUN pytest or any backend command. Allowed commands: `npm --prefix frontend test`, `npm --prefix frontend run build`, `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `git status`, `git diff`. Create your report file `docs/reports/agy-lab-fixes-report.md` FIRST (a short skeleton) and update it as you go.

## Allowed files
`frontend/src/styles/explore.css`, `frontend/src/styles/global.css` (the `.gt-btn--primary:hover` rule only), `frontend/src/styles/tokens.css` (ONLY to add new tokens; never change an existing token value), `frontend/tests/a11y.contrast.test.ts` (add one pair; never weaken or remove anything), `frontend/tests/lab.tokens.test.ts` (extend if you add tokens), `docs/KIRO_WRITEUP.md` (one line, see 4), `docs/reports/agy-lab-fixes-report.md`.

## Do
1. F-01: in `explore.css` replace the bare hex colour literals (button gradients `#13271f` and `#0d1a15`, hover text `#051309`, raw badge text `#0b0e0c`) with design tokens. Use existing tokens where the value matches (`--gt-bg`, `--gt-text-dark`, `--gt-surface-active`); where no token has that value, add a new token in `tokens.css` with the SAME hex value (for example `--gt-surface-raised`) so the look does not change, then reference it. Keep the existing `var(--x, fallback)` fallbacks.
2. F-02: replace the bare `#4dff95` on `.gt-btn--primary:hover` in `global.css` with a token (add `--gt-green-bright: #4dff95;` to `tokens.css`) and reference it.
3. F-03: add the Raw Mode badge pair to the contrast test (`--gt-bg` text on `--gt-copper`, minimum 4.5:1 as a UI component pair) in `tests/a11y.contrast.test.ts`, following the file's existing table format. Also add contrast pairs for any new token you introduce for text.
4. `docs/KIRO_WRITEUP.md`, section "Verification & Proof": a submission marker was removed by mistake. Re-add, as the LAST bullet of that list, exactly this line (it must contain the literal marker text so the submission guard still sees it): `- **Submission Day Verification:** [FILL: re-run the counts and gates on submission day]`
5. Verify: `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all pass; the count rises by your new tests), `npm --prefix frontend run build` clean with no CSS warnings. Search `explore.css` afterwards to prove no bare hex literal remains outside `var(--x, #hex)` fallbacks.
6. Finish the report with the real results and a **Commit groups** section.
