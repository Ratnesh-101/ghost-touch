# Antigravity Lane Report: lab-capture

**Lane:** `lab-capture`  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-06  
**Status:** Complete & verified  

---

## 1. Executive Summary

This lane delivered the Frankenstein's Laboratory Capture screen according to the specifications in `docs/briefs/lab-spec.md`, `docs/briefs/agy-lab-capture.md`, and the audit recommendations in `docs/reports/audit-layout.md` and `docs/reports/audit-csstests.md`.

Key achievements:
1. **Header (Brand First):** Positioned Ghost Touch creature Logo mark (`variant="mark"`, `decorative={true}`, `aria-hidden="true"`, `focusable="false"`) beside a real text `<h1>{t('app.name')}</h1>` and tagline `<p>{t('app.tagline')}</p>`. Heading and tagline remain semantic HTML text elements.
2. **Lab Settings Consolidation:** Removed the individual `LanguageSelector` and `RateSelector` components from the top of the Capture screen. Replaced them with a single accessible button labelled dynamically using `describeSettings(currentLang, currentRate)` (e.g. `"Settings: English, 1.0×"`, `"सेटिंग्स: हिन्दी, 1.0×"`). The button triggers the `<LabSettings>` modal bottom sheet with focus restoration to the trigger ref and spoken announcements via `say()`. Changes to language or speech rate update the button descriptor immediately.
3. **Action Hierarchy:** "Take photo" is elevated as the large primary action (`.gt-capture__button--primary`, 64px min-height, prominent green border and glow). "Choose image / PDF" and "Saved diagrams" are styled as secondary companion actions with an aged copper outline (`.gt-capture__button--secondary`, `.gt-capture__button--saved`, 52px min-height) in a wrapping flex row.
4. **Specimen Jar Sample Cards:** Redesigned sample diagrams into larger tactile specimen jar cards (`.gt-capture__sample-btn`, 108px min-height) rendering real mini previews via `<SpecimenPreview id={id} />` above localized short names (`lab.specimen.triangle`, `lab.specimen.sine`, `lab.specimen.bars`). Every card preserves its existing accessible name via `aria-label={t(labelKey)}` (`Sample: triangle`, etc.) so screen readers and tests remain unchanged. Previews are strictly decorative (`aria-hidden="true"`).
5. **Lab Loading State:** While `busy`, replaces the legacy progress bar with `<LabLoading title={t('lab.loading.title')} hint={t('lab.loading.hint')} />` containing the copper charging power meter and spark glyph. The live-region status text, `aria-busy` attribute, spoken "Reading your diagram" announcement, and 1.5s progress tone operate with zero modifications.
6. **Layout & Zoom Resilience:** Added safe-area padding (`env(safe-area-inset-*)`), `min-height: 100vh; min-height: 100dvh;`, wrapping flex rows (`flex-wrap: wrap`) on header row and secondary action row, removed fixed heights, avoided `white-space: nowrap`, and tuned narrow 380px device media queries.
7. **Test Suite Compatibility:** Updated `polish.test.ts` and `screens.render.test.ts` to replace blanket `expect(html).not.toContain('aria-hidden')` checks with `expect(html).not.toMatch(/<button[^>]*aria-hidden="true"/)`, following the intentional addition of decorative SVGs (`Logo`, `SpecimenPreview`) while preserving strict protection for interactive buttons. Added 16 new tests in `frontend/tests/capture.lab.test.tsx`.

---

## 2. Definition of Done Proof (Real Results)

All allow-listed commands were run from repository root:

### 2.1 TypeScript Type Check
```bash
npm --prefix frontend exec -- tsc -p frontend --noEmit
```
- **Exit code:** 0
- **Output:** Clean (0 errors across entire frontend codebase and test suite)

### 2.2 Frontend Test Suite
```bash
npm --prefix frontend test
```
- **Exit code:** 0
- **Test files:** 54 passed (54)
- **Tests:** 753 passed (753)
- **Duration:** 791ms
*(53 baseline test files + 1 new test file `capture.lab.test.tsx` with 16 tests = 753 passing tests)*

### 2.3 Frontend Production Build
```bash
npm --prefix frontend run build
```
- **Exit code:** 0
- **Output:**
```
vite v8.3.5 building client environment for production...
✓ 68 modules transformed.
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.59 kB │ gzip:   0.61 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-aYPK24X2.css                                        40.18 kB │ gzip:   7.51 kB
dist/assets/index-CqL4wasv.js                                        353.53 kB │ gzip: 105.20 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB
PWA v2.0.0 generateSW: 22 precache entries (473.58 KiB)
```

### 2.4 Backend Health
Per brief instruction ("Run NO backend commands"), zero backend commands were executed.

---

## 3. Diff Stat for `Capture.tsx` and Touched Files

### 3.1 Diff Stat
```text
 frontend/src/screens/Capture.tsx      | 155 +++++++++++++++++++++++++---------
 frontend/src/styles/global.css        | 135 +++++++++++++++++++++++++----
 frontend/tests/polish.test.ts         |   6 +-
 frontend/tests/screens.render.test.ts |   2 +-
 4 files changed, 239 insertions(+), 59 deletions(-)
```

### 3.2 Key Changes in `Capture.tsx`
- Mounted `<Logo variant="mark" decorative height={48} className="gt-capture__brand-logo" />` inside `.gt-capture__brand` alongside `<h1>{t('app.name')}</h1>` and `<p className="gt-capture__tagline">{t('app.tagline')}</p>`.
- Mounted `<AccessibleButton ref={settingsButtonRef} className="gt-control gt-capture__button gt-capture__button--settings" onClick={() => setSettingsOpen(true)}>{describeSettings(currentLang, activeRate)}</AccessibleButton>`.
- Subscribed to `subscribeLang` and wrapped `drivers.speech.setRate` so the settings descriptor reflects changes synchronously in both client-side and server-side contexts.
- Rendered `<LabLoading title={t('lab.loading.title')} hint={t('lab.loading.hint')} />` inside `.gt-capture__status-card` when `busy === true`.
- Upgraded sample diagram loop to render `<SpecimenPreview id={id} className="gt-capture__sample-preview" />` and `<span className="gt-capture__sample-name">{t(specimenKey)}</span>` while maintaining `aria-label={t(labelKey)}`.
- Placed `<LabSettings open={settingsOpen} onClose={handleSettingsClose} speak={say} drivers={drivers} triggerRef={settingsButtonRef} />` at the bottom of the screen.

---

## 4. Needs from Kiro

None. No Kiro-owned files (`frontend/src/core/**`, `backend/app/schema.py`, etc.) required changes or stubs.

---

## 5. Commit Groups

Suggested ordered logical commits for the reviewer:

### Commit Group 1: `feat(capture): build Frankenstein's Lab Capture screen and layout`
- **Message:** `feat(capture): build Frankenstein's Lab Capture screen and layout`
- **Files:**
  - `frontend/src/screens/Capture.tsx`
  - `frontend/src/styles/global.css`

### Commit Group 2: `test(capture): update existing assertions and add lab capture test suite`
- **Message:** `test(capture): update existing assertions and add lab capture test suite`
- **Files:**
  - `frontend/tests/polish.test.ts`
  - `frontend/tests/screens.render.test.ts`
  - `frontend/tests/capture.lab.test.tsx`

### Commit Group 3: `docs(capture): add lane completion report and build log entry`
- **Message:** `docs(capture): add lane completion report and build log entry`
- **Files:**
  - `docs/reports/agy-lab-capture-report.md`
  - `docs/BUILD_LOG.md`
