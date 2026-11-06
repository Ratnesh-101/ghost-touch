# Lane lab-i18n: all new lab copy (en, hi, gu) and the Lab settings sheet component

Read `docs/briefs/lab-spec.md` first. You own `i18n/index.ts` and the new settings sheet. The screen lanes (next phase) will mount your sheet and use your keys, so keep names exactly as listed.

## Allowed files
- `frontend/src/i18n/index.ts`, `frontend/tests/i18n.*.test.ts` and new tests `frontend/tests/lab.i18n.test.ts`, `frontend/tests/labSettings.test.tsx`
- `frontend/src/components/LabSettings.tsx` (new), `frontend/src/styles/settings.css` (new; imported by the component or via a single import line you add in `global.css` at its very end, in a clearly marked line)
- `frontend/src/components/LanguageSelector.tsx` and `RateSelector.tsx`: only if needed to embed them in the sheet without changing their behaviour or accessible names
- `docs/reports/agy-lab-i18n-report.md`

## Forbidden
`screens/**`, `tokens.css`, other `global.css` rules, `Mascot`, `Logo`, `public/**`, drivers, flow, core, backend, `.env*`.

## Do
1. Add these keys to ALL THREE tables (en, hi, gu). English text is fixed; hi and gu are machine-translated (say so in the report, keep wording simple and short). Check how `t()` handles parameters first; if there is no interpolation helper, build the settings button label from two existing translated parts without changing `t()`'s signature, or add a tiny pure helper next to it with tests.
   - `lab.start.wake`: "Wake the creature"
   - `lab.start.tagline`: keep `app.tagline` as is ("Feel diagrams you can't see" must be the English tagline: change `app.tagline` only if it differs, and tell the owner in the report)
   - `lab.organ.nerves.title` "Nerves" / `lab.organ.nerves.line` "Feel lines and corners as vibration"
   - `lab.organ.eyes.title` "Eyes" / `lab.organ.eyes.line` "AI reads your diagram"
   - `lab.organ.voice.title` "Voice" / `lab.organ.voice.line` "Tones and speech tell you more"
   - `lab.settings.button` (label shown on Capture, with the current choice, for example "Settings: English, 1.0×"), `lab.settings.title` "Lab settings", `lab.settings.close` "Close settings", `lab.settings.language` "Language", `lab.settings.rate` "Speech speed", `lab.settings.opened` (spoken when the sheet opens), `lab.settings.closed` (spoken when it closes)
   - `lab.loading.title` "The lab is powering up", `lab.loading.hint` "Reading your diagram…" (the existing SPOKEN message key is NOT changed)
   - `lab.raw.notice`: "The creature's eyes are blurry — you can still feel the outlines." (visual notice; the existing spoken `raw.announce` stays unchanged)
   - `lab.specimen.triangle` / `lab.specimen.sine` / `lab.specimen.bars` (short names for the sample cards, for example "Right triangle", "Sine wave", "Bar chart")
   - `lab.empty.saved` "No saved diagrams yet. Take a photo and save one.", `lab.empty.generic` "Nothing here yet."
   Existing keys, spoken strings and their wording must not change. Tests in `tests/i18n.languages.test.ts` (same keys in all languages, no empty strings) must keep passing.
2. `LabSettings.tsx`: a modal bottom sheet (or centred panel on wide screens) that wraps the existing language selector and speech-rate selector. Requirements: `role="dialog"`, `aria-modal="true"`, labelled by its visible title; focus moves into it on open and returns to the opening control on close; focus is trapped; Escape and a clear "Close settings" button (48x48 minimum, accessible name from `lab.settings.close`) close it; the sheet calls a `speak(text)` prop on open and close with the new `lab.settings.opened/closed` strings; choices persist exactly the way the existing selectors already persist them (reuse, do not duplicate). Props: `open`, `onClose`, `speak`, plus whatever the existing selectors need (read `LanguageSelector.tsx` and `RateSelector.tsx` and keep their prop contracts). It is presentational plus focus management only. Style with CSS variables from `tokens.css` that already exist (`--gt-*`); for the lab accents use the names `--gt-copper`, `--gt-cyan`, `--gt-bone` with the existing tokens as fallbacks (the foundation lane adds them), for example `var(--gt-copper, var(--gt-green-dim))`.
3. Tests: key parity across the three tables for every new key, settings label composition, the sheet's dialog semantics (role, aria-modal, label, focus return, Escape), and the speak calls. Use the same render style as `tests/screens.render.test.ts` or `tests/polish.test.ts` (read them first).
4. Export a small `describeSettings(language, rate)`-style pure helper if it makes the button label testable.

## Done
tsc clean, `npm --prefix frontend test` (all old tests plus new ones, real counts), `npm --prefix frontend run build` pass. Report: the list of new keys, anything uncertain about the hi/gu text, how the screen lanes should mount `<LabSettings>` (exact props), and **Commit groups**.
