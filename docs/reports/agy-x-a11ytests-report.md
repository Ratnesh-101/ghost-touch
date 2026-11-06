# Lane x-a11ytests Report: Automated Accessibility Tests for Every Screen

## Status
Complete. All 1,109 frontend tests pass (including 41 newly added automated accessibility and translation tests). TypeScript check and Vite build succeed with 0 errors.

---

## Overview
This lane implements automated accessibility tests covering the rendered static DOM of every screen in all three supported languages (`en`, `hi`, `gu`). In accordance with CLAUDE.md Rule 6 ("Accessibility is the product"), these tests walk the server-rendered markup and validate accessible names, ARIA attribute integrity, heading structures, focus management, SVG/image labeling contracts, live regions, document language, and translation parity across languages.

Per the brief's instructions, no new dependencies (`axe-core`, `jest-axe`, etc.) were installed; a dedicated, lightweight static DOM parser and accessibility validator was implemented in `frontend/tests/helpers/a11yDom.ts`.

---

## Checks Added

### 1. Static Screen Markup Accessibility Validations (`frontend/tests/a11y.screens.test.tsx` + `frontend/tests/helpers/a11yDom.ts`)
Each screen was rendered to static markup (`react-dom/server`) with mock drivers across English (`en`), Hindi (`hi`), and Gujarati (`gu`):
- **Start** screen
- **Capture** screen
- **Explore** with Right Triangle (`sampleTriangle`)
- **Explore** with Sine wave (`sampleSine`)
- **Explore** with Bar chart (`sampleBarchart`)
- **Explore in Raw Mode** (`rawScene`, with raw banner notice)
- **Saved diagrams (Empty state)**
- **Saved diagrams (Two entries with open/pin/delete buttons)**
- **Teacher Correct mode**
- **Lab Settings modal sheet (open)**

Across all 30 screen renders (10 screens × 3 languages), the validator asserted:
1. **Interactive Accessible Names**: Every `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>` has a non-empty accessible name resolved via W3C AccName resolution priority (`aria-labelledby` -> `aria-label` -> `<label for="...">` / `value` -> visible text).
2. **ARIA Attribute Integrity**:
   - No empty `aria-label=""` or `aria-labelledby=""`.
   - All target IDs referenced by `aria-labelledby` and `aria-describedby` exist in the same markup.
   - Zero duplicate `id` attributes across each screen document.
3. **Heading Hierarchy**:
   - Exactly one `<h1>` per screen (except Start, which is a full-screen accessible button, and LabSettings when evaluated as an isolated modal sheet).
   - Heading levels never skip downward by more than one step (e.g. `h1` -> `h2` -> `h3`, no `h1` -> `h3` skips).
4. **Focusability and `aria-hidden`**:
   - No `tabindex` greater than 0 (no positive tabindex).
   - Elements with `aria-hidden="true"` contain no focusable descendants (`button`, `a[href]`, `input`, `select`, `textarea`, or `tabindex="0"`).
5. **SVGs and Images**:
   - Every `<svg>` is either `aria-hidden="true"` or has `role="img"` with an accessible `<title>` or `aria-label`.
   - Every `<img>` has an `alt` attribute (`alt=""` for decorative thumbnails).

### 2. Live Region Announcer Tests
- Validated that `Capture` and `Explore` render polite live regions (`role="status"`, `aria-live="polite"`) when speech synthesis is unavailable (`speech.canSpeak: false`).
- Validated that `Explore in Raw Mode` renders its notice banner with `role="status"` across `en`, `hi`, and `gu`.

### 3. Document Language
- Validated that `frontend/index.html` has the `lang` attribute set on the `<html>` root (`<html lang="en">`).

### 4. Primary Controls Language Parity & Missing Translation Detection
- Tested that the visible accessible names of primary controls in Hindi (`hi`) and Gujarati (`gu`) differ from English (`en`), confirming all primary interactive controls are properly localized and not falling back to English strings (allowing brand words like "Ghost Touch" and multipliers like "1.0×").

### 5. Static `t('...')` Key Coverage
- Scanned all TSX source files under `frontend/src/**/*.tsx` via regex and confirmed that every static translation key exists in all three dictionaries (`tables.en`, `tables.hi`, `tables.gu`).

---

## Test Results and Proof

### 1. TypeScript Check
**Command:** `npm --prefix frontend exec -- tsc -p frontend --noEmit`
**Result:** Exit code 0 (clean, 0 errors).

### 2. Full Test Suite Run
**Command:** `npm --prefix frontend test`
**Result:** Exit code 0.
```text
 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-x-a11ytests/frontend

 Test Files  76 passed (76)
      Tests  1109 passed (1109)
   Start at  12:21:31
   Duration  1.27s (transform 59%, import 23%, tests 13%, worker 4%)
```
- Total test files: 76 passed.
- Total tests: 1,109 passed (baseline was 1,068 tests; 41 new accessibility and localization tests added).

### 3. Frontend Production Build
**Command:** `npm --prefix frontend run build`
**Result:** Exit code 0.
```text
vite v8.3.5 building client environment for production...
transforming...
✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.72 kB │ gzip:   0.64 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-BTsYWoe7.css                                        63.84 kB │ gzip:  10.00 kB
dist/assets/index-DU7H69Dc.js                                        370.12 kB │ gzip: 108.96 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB

✓ built in 214ms

PWA v2.0.0
mode      generateSW
precache  22 entries (529.05 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```

---

## Real Defects & Observations Found

In accordance with rule 8 and the brief ("If your tests expose a REAL defect in the app, do not fix it: record it as a finding in the report"):

### Finding 1: Hidden File Inputs in `Capture.tsx` Lack Accessible Names
- **File:** `frontend/src/screens/Capture.tsx`, lines 312–328
- **What:** The camera file input `<input ref={photoInput} type="file" accept="image/*" capture="environment" hidden ... />` and diagram file input `<input ref={fileInput} type="file" ... hidden ... />` have no `aria-label`, `<label>`, or `aria-labelledby`.
- **Impact:** Because these elements use the HTML `hidden` attribute, they are excluded from the accessibility tree by browsers, and screen reader users activate the visible `<AccessibleButton>` controls ("Take photo" / "Choose image"). However, in automated strict linting or headless scanners that do not prune hidden DOM nodes, this is flagged as an unlabeled form control.
- **Suggested Fix:** Add `aria-label={t('capture.takePhoto')}` and `aria-label={t('capture.chooseImage')}` to the hidden `<input>` elements in `Capture.tsx`.

### Finding 2: `LabSettings.tsx` Heading Hierarchy When Rendered Standalone
- **File:** `frontend/src/components/LabSettings.tsx`, line 180
- **What:** `LabSettings` uses `<h2 id="lab-settings-title" className="gt-lab-settings__title">{t('lab.settings.title')}</h2>` as its dialog header, followed by `<h3 id="lab-settings-section-lang">` and `<h3 id="lab-settings-section-rate">`.
- **Impact:** When embedded inside `Capture` or `Explore`, this correctly maintains a single `<h1>` on the screen with `<h2>` for the dialog sheet and `<h3>` for sections. In complete isolation, the dialog has no `<h1>`.
- **Suggested Fix:** Maintain current structure as it adheres to WAI-ARIA Modal Dialog conventions (`role="dialog" aria-labelledby="lab-settings-title"`), or add a visually-hidden `<h1>` if standalone routing is ever introduced.

### Finding 3: English Word Retained in Gujarati Translation for Saved Diagrams Back Button
- **File:** `frontend/src/i18n/index.ts`, line 524
- **What:** Key `'saved.back'` in Gujarati is `'Capture પર પાછા'` which retains the English word "Capture" rather than using the Gujarati transliteration.
- **Impact:** Minor localization inconsistency. Hindi translates this as `'कैप्चर पर वापस'`.
- **Suggested Fix:** Change `gu['saved.back']` to `'કેપ્ચર પર પાછા'` for script consistency.

---

## Commit Groups

Files created/touched:
1. `frontend/tests/helpers/a11yDom.ts`
   - Tolerant static markup parser, text extraction, focusability detection, accessible name calculator, and full accessibility rule validator.
2. `frontend/tests/a11y.screens.test.tsx`
   - 41 automated tests verifying all screens in `en`, `hi`, and `gu`, live region behavior, document language, primary control translation parity, and static i18n key coverage.
3. `docs/reports/agy-x-a11ytests-report.md`
   - Comprehensive test report and verification proof.

Suggested commit group:
- `test(a11y): add static DOM accessibility tests for all screens in en, hi, gu`
