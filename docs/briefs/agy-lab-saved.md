# Lane lab-saved: Saved diagrams and Correct screens in the lab style

Read `docs/briefs/lab-spec.md` first. Restyle the Saved diagrams screen and the Teacher Correct screen. Markup and classes only; behaviour does not change.

## Allowed files
- `frontend/src/screens/SavedDiagrams.tsx`, `frontend/src/screens/Correct.tsx` (class names and wrapper markup only; keep every handler, effect, spoken message, `aria-*`, role and live region as it is)
- `frontend/src/styles/saved.css`, `frontend/src/styles/correct.css` (they already exist; you may restructure them)
- `frontend/src/components/Mascot.tsx` may be IMPORTED and used (do not edit it; another lane is redrawing it behind the same props `className` and `size`)
- New tests `frontend/tests/saved.lab.test.tsx`, `frontend/tests/correct.lab.test.tsx`
- `docs/reports/agy-lab-saved-report.md`

## Forbidden
`flow/**`, `core/**`, `drivers/**`, `i18n/**`, `global.css`, `tokens.css`, other screens, backend, prop tests, `.env*`, and the existing tests' assertions (extend, do not weaken).

## Do
1. Saved diagrams: lab cards (stitched edge, copper border, small rivets), clear list rhythm, 48x48 targets for every control, a visible focus ring, the heading as real text. Empty state: the Mascot (`aria-hidden`) above the existing `t('saved.empty')` text, calm and centred. Do not add new strings: use existing keys only (the i18n lane adds `lab.empty.*` later; if you want those, note it in the report as a pending swap).
2. Correct: same system, including the point and segment lists, the drag handles' surrounding UI, and the buttons. The correction canvas keeps max contrast (no texture inside it). Do not touch the canvas element's handlers or `touch-action`.
3. Colours only from CSS variables with fallbacks (`var(--gt-copper, var(--gt-green-dim))`, `var(--gt-cyan, var(--gt-green))`, `var(--gt-bone, var(--gt-text-secondary))`); the foundation lane adds those tokens. No hard-coded colours.
4. Keep `tests/a11y.targets.test.ts`, `tests/a11y.motion.test.ts`, `tests/a11y.contrast.test.ts`, `tests/screens.render.test.ts`, `tests/saved.flow.test.ts` and `tests/correct.*.test.ts` passing unchanged. These screens' CSS lives in separate files that those tests do not scan: add your own test (reading the CSS files with `node:fs`) that asserts every interactive class in `saved.css` and `correct.css` has `min-height` and `min-width` of at least 48px and that a `:focus-visible` rule exists.
5. Reduced motion: no animation in these screens.

## Done
tsc clean, `npm --prefix frontend test` (old tests pass, same count plus yours), `npm --prefix frontend run build` pass. Report lists what changed in each `.tsx` (should be classes and wrappers only; give the diff stat) and **Commit groups**.
