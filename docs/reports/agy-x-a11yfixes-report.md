# Lane x-a11yfixes Report: Accessibility Fixes from Automated Accessibility Test Findings

## Status
Complete. TypeScript check passes with 0 errors, all 1,109 frontend tests pass, and Vite production build succeeds cleanly.

---

## Overview
This lane resolves two specific accessibility findings flagged during the automated static DOM accessibility evaluation documented in `docs/reports/agy-x-a11ytests-report.md`:

1. **Finding 1 (Hidden file inputs in Capture lack accessible names):**
   - Added `aria-label={t('capture.takePhoto')}` to the camera file `<input>` in `frontend/src/screens/Capture.tsx`.
   - Added `aria-label={t('capture.chooseImage')}` to the diagram file `<input>` in `frontend/src/screens/Capture.tsx`.
   - Reused existing translation keys (`capture.takePhoto`, `capture.chooseImage`); added no new strings.
   - Retained the `hidden` attribute and all existing handlers, refs, `accept`, `capture`, `onChange`, and `onCancel` attributes untouched.

2. **Finding 2 (LabSettings dialog heading hierarchy):**
   - Left untouched, as confirmed by the brief (heading level `<h2>` is correct for a modal dialog sheet labeled via `aria-labelledby="lab-settings-title"`).

3. **Finding 3 (English loanword in Gujarati saved.back translation):**
   - Changed `'saved.back'` in `frontend/src/i18n/index.ts` from `'Capture પર પાછા'` to `'કેપ્ચર પર પાછા'`.
   - The string is machine-translated like the rest of the Gujarati table.
   - Verified that no existing tests asserted the old Gujarati text; no test updates were required for this change.

4. **Test Extension (`frontend/tests/a11y.screens.test.tsx`):**
   - Extended the Capture screen accessibility test to assert that both hidden file inputs carry a non-empty `aria-label` attribute across all tested languages (`en`, `hi`, `gu`).

---

## Exact Diffs

```diff
diff --git a/frontend/src/i18n/index.ts b/frontend/src/i18n/index.ts
index 8381a7c..b7148ee 100644
--- a/frontend/src/i18n/index.ts
+++ b/frontend/src/i18n/index.ts
@@ -521,7 +521,7 @@ const gu: Record<string, string> = {
   'saved.pin': 'પિન કરો',
   'saved.unpin': 'પિન દૂર કરો',
   'saved.pinned': 'પિન કર્યું',
-  'saved.back': 'Capture પર પાછા',
+  'saved.back': 'કેપ્ચર પર પાછા',
   'saved.opened': '{title} ખોલી રહ્યા છીએ.',
   'saved.deleted': '{title} ભૂંસી નાખ્યું.',
   'saved.pinned.announced': '{title} પિન કર્યું.',
diff --git a/frontend/src/screens/Capture.tsx b/frontend/src/screens/Capture.tsx
index bfe1f7c..0ddb3f7 100644
--- a/frontend/src/screens/Capture.tsx
+++ b/frontend/src/screens/Capture.tsx
@@ -315,6 +315,7 @@ export function Capture({
         accept="image/*"
         capture="environment"
         hidden
+        aria-label={t('capture.takePhoto')}
         onChange={(e) => void handleFile(e, 'camera')}
         onCancel={handleCancel}
       />
@@ -323,6 +324,7 @@ export function Capture({
         type="file"
         accept={`${ACCEPTED_IMAGE_TYPES.join(',')},application/pdf,.pdf`}
         hidden
+        aria-label={t('capture.chooseImage')}
         onChange={(e) => void handleFile(e, 'file')}
         onCancel={handleCancel}
       />
diff --git a/frontend/tests/a11y.screens.test.tsx b/frontend/tests/a11y.screens.test.tsx
index 945c586..16e7b3b 100644
--- a/frontend/tests/a11y.screens.test.tsx
+++ b/frontend/tests/a11y.screens.test.tsx
@@ -224,6 +224,17 @@ describe('Accessibility validation: all screens in en, hi, gu', () => {
         expect(result.violations).toEqual([]);
         expect(result.h1Count).toBe(1);
         expect(result.interactiveCount).toBeGreaterThanOrEl(5);
+
+        // Verify finding 1: both hidden file inputs carry a non-empty aria-label
+        const root = parseHtml(html);
+        const hiddenFileInputs = getAllElements(root).filter(
+          (el) => el.tag === 'input' && el.attrs.type === 'file' && 'hidden' in el.attrs,
+        );
+        expect(hiddenFileInputs.length).toBe(2);
+        for (const input of hiddenFileInputs) {
+          expect(input.attrs['aria-label']).toBeDefined();
+          expect(input.attrs['aria-label']?.trim().length).toBeGreaterThan(0);
+        }
       });
 
       it('Explore with triangle sample passes a11y DOM checks', () => {
```

---

## Proof & Verification Commands

### 1. TypeScript Check
**Command:** `npm --prefix frontend exec -- tsc -p frontend --noEmit`  
**Exit code:** 0  
**Output:** Clean (no errors).

### 2. Full Test Suite
**Command:** `npm --prefix frontend test`  
**Exit code:** 0  
**Output:**
```text
> ghost-touch-frontend@0.1.0 test
> vitest run


 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-x-a11yfixes/frontend


 Test Files  76 passed (76)
      Tests  1109 passed (1109)
   Start at  12:26:11
   Duration  1.35s (transform 62%, import 21%, tests 13%, worker 4%)
```

### 3. Production Build
**Command:** `npm --prefix frontend run build`  
**Exit code:** 0  
**Output:**
```text
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.72 kB │ gzip:   0.63 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-BTsYWoe7.css                                        63.84 kB │ gzip:  10.00 kB
dist/assets/index-DOul7d_f.js                                        370.20 kB │ gzip: 108.97 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB

✓ built in 179ms

PWA v2.0.0
mode      generateSW
precache  22 entries (529.13 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```

---

## Commit Groups

### Group 1: Accessibility and Localization Fixes
- **Files touched:**
  - `frontend/src/screens/Capture.tsx`: Add `aria-label` to hidden photo and file input elements.
  - `frontend/src/i18n/index.ts`: Fix Gujarati transliteration for `saved.back` (`'કેપ્ચર પર પાછા'`).
  - `frontend/tests/a11y.screens.test.tsx`: Extend Capture test to assert non-empty `aria-label` on hidden file inputs.
- **Commit message:**
  `fix(a11y): add aria-labels to hidden capture file inputs and fix Gujarati saved.back translation`
