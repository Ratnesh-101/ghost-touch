# Antigravity Lane UX8 Report — Hindi phone starts in Hindi

## Summary
Implemented first-run device locale detection and startup language initialization:
- Created `frontend/src/drivers/locale.ts` which exports `deviceLang(): 'en' | 'hi' | 'gu'` matching the first language prefix in `navigator.languages` (falling back safely to `'en'`), wrapped entirely in `try/catch`.
- Updated `frontend/src/i18n/index.ts` so that on start, if no language preference is stored in `localStorage`, the app resolves and uses `deviceLang()` without persisting anything until the user explicitly selects a language (`setLang`).
- Added `start.langOffer` in `en`, `hi`, and `gu` to name the other two languages and where to change them in Settings.
- Preserved `lab.start.wake` in `hi` ('जीव को जगाएं') and `gu` ('પ્રાણીને જગાડો') for creature theme parity matching existing test suites.
- Updated `frontend/src/flow/start.ts` and `frontend/src/screens/Start.tsx` to announce `start.langOffer` once per install after the intro with `{ queue: true }`.
- Added unit and invariant test suite in `frontend/tests/locale.firstRun.test.ts`.

## Files Changed
- `frontend/src/drivers/locale.ts` (NEW): Safe `deviceLang()` detector with prefix matching against supported languages ('en' | 'hi' | 'gu').
- `frontend/src/i18n/index.ts`: Integrated `deviceLang()`, `resolveInitialLang()`, `initLang()`, `getStoredLang()` returning `Lang | null`, added `start.langOffer` (en, hi, gu), and preserved `lab.start.wake` creature theme translations in `hi` ('जीव को जगाएं') and `gu` ('પ્રાણીને જગાડો').
- `frontend/src/flow/start.ts`: Added `speakLangOffer(drivers, lang)` with once-per-install storage key `gt_lang_offer_spoken` and queued speech.
- `frontend/src/screens/Start.tsx`: Wires `speakLangOffer(drivers)` to run on mount after `speakIntro(drivers)`.
- `frontend/tests/locale.firstRun.test.ts` (NEW): 13 tests covering deviceLang prefix matching, error fallback, first-run storage invariants (no stored value + hi-IN gives hi, stored en + hi-IN gives en, missing navigator.languages gives en, store nothing until user chooses), plain verb checks, and once-per-install language offer announcement.

## Tests Added
In `frontend/tests/locale.firstRun.test.ts`:
1. `navigator.languages missing gives en`
2. `returns hi for hi-IN or hi locale`
3. `returns gu for gu-IN or gu locale`
4. `returns en for en-US or en locale`
5. `picks the first match on prefix (e.g. ['fr-FR', 'hi-IN', 'en-US'] -> 'hi')`
6. `returns en when no languages match prefix`
7. `returns en for empty array`
8. `accepts explicit language list parameter`
9. `safely catches errors and returns en inside try/catch`
10. `no stored value + hi-IN gives hi, and stores nothing until user chooses`
11. `stored en + hi-IN gives en`
12. `start.begin and lab.start.wake in hi ('जीव को जगाएं') and gu ('પ્રાણીને જગાડો')`
13. `start.langOffer in en, hi, gu and once-per-install speech with queue: true`

## Follow-Up Pass 2 Gate Fix
- Fixed assertion in `frontend/tests/locale.firstRun.test.ts` where `t('lab.start.wake')` was expecting `'शुरू करें'` instead of creature phrasing `'जीव को जगाएं'` (and explicitly asserting `t('start.begin')` for `'शुरू करें'`). Zero tests weakened.

## What Could Not Be Verified
- Physical hardware validation on a phone configured in Hindi or Gujarati with TalkBack.
- OEM-specific TTS voice installations (e.g. Google Speech Services vs Samsung TTS hindi voice pack).
