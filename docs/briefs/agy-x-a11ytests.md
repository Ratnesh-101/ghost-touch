# Lane x-a11ytests: automated accessibility tests for every screen in all three languages

DO NOT edit `docs/BUILD_LOG.md`. Create your report `docs/reports/agy-x-a11ytests-report.md` FIRST as a skeleton and update it as you go. Allowed commands: `npm --prefix frontend test`, `npm --prefix frontend run build`, `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `git status`, `git diff`. NO backend commands. No new dependencies (`axe-core` and `jest-axe` are NOT installed and you must not install anything: write the checks yourself).

Accessibility is the product (CLAUDE.md rule 6). Existing tests cover CSS (contrast tokens, 48 px targets, reduced motion) but nothing walks the rendered DOM of every screen. Add that.

## Allowed files
New `frontend/tests/a11y.screens.test.tsx` (and a small helper `frontend/tests/helpers/a11yDom.ts` if useful), `docs/reports/agy-x-a11ytests-report.md`. You may NOT edit `frontend/src/**`, existing tests, or any CSS. If your tests expose a REAL defect in the app, do not fix it: record it as a finding in the report and mark that single assertion with `it.fails`/a documented `todo` so the suite stays green while the defect stays visible (and say so loudly in the report).

## Do
1. Read `frontend/tests/screens.render.test.ts` and `frontend/tests/polish.test.ts` for how screens are rendered to static markup (react-dom/server) with fake drivers, and `frontend/src/i18n/index.ts` for how to switch language in a test (and restore it afterwards).
2. For each screen (Start, Capture, Explore with the triangle, sine and bar chart sample scenes, Explore in Raw Mode, Saved diagrams empty and with two entries, Correct, and the Lab settings sheet when open) and for each language (en, hi, gu), render and assert on the markup string (parse it with a minimal tolerant approach such as regexes or the DOM parser available in the test environment; check what `vitest.config.ts` provides before choosing):
   - every `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>` has a non-empty accessible name (visible text, `aria-label`, or a valid `aria-labelledby`/`<label>`);
   - no empty `aria-label` or `aria-labelledby`, every `aria-labelledby` and `aria-describedby` target id exists in the same markup, and there are no duplicate `id`s;
   - exactly one `<h1>` per screen, except Start (a single button); heading levels never skip downward more than one step;
   - no `tabindex` greater than 0; elements with `aria-hidden="true"` contain no focusable descendants (buttons, links, inputs, or `tabindex="0"`);
   - every `<svg>` is either `aria-hidden="true"` or has a `<title>`/`aria-label` and `role="img"`; every `<img>` has `alt`;
   - live regions (`aria-live`, `role="status"`, `role="alert"`) exist where the app speaks (Capture status, Explore status);
   - the document language is not asserted here (it lives in `index.html`): instead assert `frontend/index.html` has `lang` set;
   - in hi and gu, the visible text of the main controls differs from English (a control that still shows the English label is a missing translation): compare the accessible names of the primary controls between en and hi/gu and report matches (allow brand words like "Ghost Touch" and units like "1.0×").
3. Also assert, as a table-driven test over the i18n tables: every key used by `t('...')` calls in `frontend/src/**/*.tsx` exists in en, hi and gu (scan the source files with `node:fs` and a regex for `t\('([^']+)'\)`; ignore dynamic keys).
4. Keep every test deterministic and fast; no network, no timers left running.
5. Run tsc, the full suite and the build; record real results (the suite was 1049 tests at the start; yours add to it).

## Done
Report: the checks added, the number of tests, EVERY real defect found (file, what, where, suggested fix) and **Commit groups**. Write the report even if something failed.
