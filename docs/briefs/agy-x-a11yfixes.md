# Lane x-a11yfixes: two small findings from the accessibility test lane

Read `docs/reports/agy-x-a11ytests-report.md` ("Real Defects & Observations Found", findings 1 and 3). DO NOT edit `docs/BUILD_LOG.md`. Create your report `docs/reports/agy-x-a11yfixes-report.md` FIRST as a skeleton and update it as you go. START EDITING EARLY. Allowed commands: `npm --prefix frontend test`, `npm --prefix frontend run build`, `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `git status`, `git diff`. No backend commands. Never open `.env*`.

## Fix exactly these
1. Finding 1: in `frontend/src/screens/Capture.tsx` the two hidden file inputs (camera and diagram file) have no accessible name. Add `aria-label={t('capture.takePhoto')}` to the camera input and `aria-label={t('capture.chooseImage')}` to the file input (reuse the existing keys; add no strings). They stay `hidden` and every handler, `ref`, `accept`, `capture` and `onChange` stays exactly as it is.
2. Finding 3: in `frontend/src/i18n/index.ts` the Gujarati `saved.back` value is `'Capture પર પાછા'` and keeps the English word. Change it to `'કેપ્ચર પર પાછા'` (machine-translated like the rest; say so in the report). Change no other string. Check that no test asserts the old Gujarati text; if one does, update only that expected value.
3. Do NOT change finding 2 (the heading level is correct for a dialog).

## Allowed files
`frontend/src/screens/Capture.tsx`, `frontend/src/i18n/index.ts`, existing tests only if they assert the old Gujarati string, `frontend/tests/a11y.screens.test.tsx` (extend: add one assertion that both hidden file inputs now carry a non-empty `aria-label`; never weaken anything), `docs/reports/agy-x-a11yfixes-report.md`.

## Forbidden
Everything else (all other screens, CSS, backend, handlers, other i18n keys).

## Done
tsc clean, the full suite passes (it was 1109 tests), the build is clean. The report lists the exact diff of both changes, the real command results and **Commit groups**.
