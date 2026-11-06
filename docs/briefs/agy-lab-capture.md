# Lane lab-capture: build the Lab Capture screen (brand first, primary action second)

Read `docs/briefs/lab-spec.md` first, then `docs/reports/audit-layout.md` (sections 2.2, 3, 6) and `docs/reports/audit-csstests.md`. These parts are already merged and ready: `components/Logo.tsx`, `components/LabSettings.tsx` (props documented in `docs/reports/agy-lab-i18n-report.md`), `components/SpecimenPreview.tsx` (see `docs/reports/agy-lab-specimen-report.md`), `components/loading/LabLoading.tsx`, `components/lab/*`, the `lab.*` strings and `describeSettings` in `i18n/index.ts`.

## Allowed files
- `frontend/src/screens/Capture.tsx`, the `.gt-capture*` rules in `frontend/src/styles/global.css` (keep them in `global.css`: the CSS tests scan that file), `frontend/src/i18n/index.ts` (ONLY to add new keys in all three languages; never change existing keys or spoken strings)
- Existing tests only if an assertion must follow an intentional markup change (never weaken what it protects), especially `tests/flow.capture.test.ts`, `tests/screens.render.test.ts`, `tests/a11y.targets.test.ts`; new `frontend/tests/capture.lab.test.tsx`
- `docs/reports/agy-lab-capture-report.md`

## Forbidden
`flow/**`, `core/**`, `drivers/**`, haptics, other screens, `vite.config.ts`, backend, `.env*`, prop tests, the logic of the photo, PDF, sample and Saved flows.

## Do
1. Header (brand first): the Logo (mark, decorative) beside a REAL text `<h1>{t('app.name')}</h1>` and the tagline. The heading stays real text; the Logo is `aria-hidden`.
2. Lab settings: remove the language and speech-rate selectors from the Capture toolbar and put them behind ONE button labelled `describeSettings(language, rate)` (for example "Settings: English, 1.0×"; use the existing helper; read `LabSettings.tsx` and `i18n/index.ts` for the exact signatures and how the current language and rate are read). The button is at least 48x48 CSS px, shows the current choice, and opens `<LabSettings open onClose speak triggerRef>`; `speak` is the same `say` function Capture already uses. Language and rate must still persist exactly as before (the sheet reuses the existing selectors).
3. Hierarchy: Take photo is the big primary button; Choose image / PDF and Saved diagrams are secondary (smaller, copper outline). Keep every existing accessible name (`aria-label`s, `capture.*` keys) and the same handlers.
4. Samples become "specimen jar" cards: larger tiles with `<SpecimenPreview id={...} />` above a visible short name from `t('lab.specimen.triangle' | 'lab.specimen.sine' | 'lab.specimen.bars')`. The button's ACCESSIBLE NAME stays what it is today (the existing `capture.sample*` key via `aria-label`), so spoken output and tests do not change. The preview is decorative.
5. Loading: while `busy`, show `<LabLoading title={t('lab.loading.title')} hint={t('lab.loading.hint')} />` in place of the plain progress bar. Keep the existing live-region status text, `aria-busy`, the spoken "Reading your diagram" message and the 1.5 s progress tone exactly as they are (this is logic in `flow/capture.ts`; do not touch it).
6. Layout fixes from the audit: allow header and button rows to wrap (`flex-wrap`), no fixed heights, no `white-space: nowrap` on text, `min-height` instead of `height`; safe-area padding (`env(safe-area-inset-*)`); correct at 320 px width, at 200 percent zoom and in landscape. Hindi and Gujarati strings are up to 2x longer: nothing may clip.
7. Colours only from tokens (`tokens.css`); 7:1 text contrast; visible copper or cyan focus rings; every control at least 48x48. Motion: none beyond what `LabLoading` already does; extend the reduced-motion block if you add any (`tests/a11y.motion.test.ts` must pass).
8. IMPORTANT CSS rule: new CSS files are imported from the component that uses them. Never add an `@import` after other rules in a CSS file (bundlers ignore it). After your change run the build and confirm your rules exist in `frontend/dist/assets/*.css`.
9. Tests: Take photo is primary; the settings button label shows the current language and rate and updates after a change; the sheet opens and closes and returns focus; the three specimen buttons keep their accessible names and each renders a decorative preview; `LabLoading` shows while busy and the live region still exists.

## Done
tsc clean, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report with the diff stat for `Capture.tsx` and **Commit groups**. Write the report even if something failed.
