# Audit Report: a5-integration (Whole-App Regressions & Integration)

**Auditor:** Antigravity (lane: a5-integration)  
**Date:** 2026-11-06  
**Scope:** Whole-app regressions and integration for Guide-my-finger (`VITE_FEATURE_GUIDE`) and Teacher-verify-and-share (`VITE_FEATURE_SHARE`). Focus: flags OFF parity, bundle size / lazy-loading, service worker & offline, back button & routing, i18n key parity and translations, a11y, CSS, test hygiene, env typing, CI & dependency hygiene.  
**Reference Contracts:** `docs/briefs/guide-share-contract.md`, `docs/briefs/audit-common.md`, `docs/briefs/audit-a5-integration.md`, `AGENTS.md`.

---

## Executive Summary

The Guide-my-finger and Teacher-verify-and-share features provide strong standalone logic and test coverage (1420 frontend unit tests passing, 454 backend pytest tests passing, clean TypeScript check). However, whole-app integration auditing revealed several regressions and integration gaps:

1. **Unconditional Network Call on Student Open / Offline:** A duplicate `useEffect(() => { void warmBackend(); }, [])` in `App.tsx` fires `GET /api/v1/health` on mount, violating the contract requirement that Student Open makes 0 network calls.
2. **Audio Node Leak with Flags OFF:** When leaving the Explore screen, `GuideController.destroy()` calls `setGuideTone(null)`, which lazily instantiates and starts a running Web Audio `OscillatorNode` even when `VITE_FEATURE_GUIDE` is unset / flags are OFF.
3. **P20 Design Token Bypass:** `frontend/src/styles/teach.css` contains over 20 bare hex literals without `var(--gt-*)` token wrappers. This was masked because `teach.css` was omitted from the Property P20 test runner in `labTheme.prop.test.ts`.
4. **Broken CI Workflows:** `.github/workflows/ci.yml` references non-existent GitHub action versions (`@v7`), which will fail on GitHub Actions runners.
5. **Mid-Flow Language Switch Desynchronization:** `Explore.tsx` and `Teach.tsx` do not subscribe to `subscribeLang`, causing on-screen status cards to freeze in the old language and `GuideController` to continue using the previous TTS voice.
6. **Main Bundle Bloat:** `qrcode` (~60 kB) and `lz-string` (~10 kB) and the entire Teacher Editor are statically bundled in the main chunk (`474 kB`), increasing initial precache by >108 KiB for every user even when flags are OFF.
7. **Accessibility Test Gaps:** `Teach`, `ShareError`, and `VerifiedBanner` are completely missing from the central multi-language accessibility suite `a11y.screens.test.tsx`.
8. **Untranslated i18n Keys:** Key `teach.qrTooLong` contains untranslated English text in both Hindi and Gujarati dictionaries.

---

## Verification of Whitelisted Commands
- `npm --prefix frontend test`: **105 test files passed (1420 tests)**
- `npm --prefix frontend run build`: **Built clean in 237ms** (dist/assets/index-CGrZz_Dw.js 474.16 kB, pdf 430.16 kB, CSS 73.20 kB, precache 639.79 KiB)
- `npm --prefix frontend exec -- tsc -p frontend --noEmit`: **Clean (0 errors)**
- `backend/.venv/Scripts/python -m pytest backend`: **454 passed, 1 skipped**
- `backend/.venv/Scripts/python -m ruff check backend`: **Clean (all checks passed)**
- `backend/.venv/Scripts/python -m ruff format --check backend`: **Clean (60 files formatted)**

---

## Sound Areas (Verified Clean)
- **Dependency Hygiene & Licensing:** `lz-string` (1.5.0) and `qrcode` (1.5.4) and all transitive dependencies (`dijkstrajs`, `pngjs`, `yargs`) are permissively licensed under MIT/ISC/BSD/Apache-2.0. No copyleft dependencies.
- **XSS & Injection Protection:** User-controlled fields (diagram titles, labels, teacher name, note) in `VerifiedBanner.tsx`, `TeachCanvas.tsx`, `VerifyForm.tsx`, and `ShareError.tsx` are rendered strictly as React text children without `dangerouslySetInnerHTML`.
- **Core Engine Isolation:** `frontend/src/core/**` remains 100% untouched (zero-line diff). All tuned haptic and audio parameters in `tech.md` remain locked.
- **Backend Ask Target Contract:** Backend `AskResponse.target` mapping correctly validates and sanitizes targets against the scene's element IDs; client gracefully ignores corrupt or missing targets without throwing.
- **Touch Target Sizing:** All controls across `VerifiedBanner`, `Teach`, `SharePanel`, `VerifyForm`, `LoadModal`, and `LabSettings` meet or exceed 48×48 CSS px.

---

## Findings (Ranked by Severity)

### CONFIRMED Findings

#### A5-01 · high · `frontend/src/App.tsx:280` · Duplicate unconditional `warmBackend()` fires network request on Student Open and flags OFF
- **What is wrong:**  
  `frontend/src/App.tsx` has two `useEffect` hooks calling `warmBackend()`. Lines 207–212 guarded against calling it on `#s=` and `#/teach`, but lines 280–282 retain a duplicate unconditional `useEffect`:
  ```ts
  // Lines 280-282 in App.tsx
  useEffect(() => {
    void warmBackend();
  }, []);
  ```
  This causes `GET /api/v1/health` to execute unconditionally on every page load, violating the contract requirement for Student Open (`/#s=...`): *"no network call"*. In `share.open.routing.test.tsx:162`, the test asserting `fetchSpy.not.toHaveBeenCalled()` passed only because it used `renderToStaticMarkup` which does not execute React `useEffect` hooks.
- **Concrete failure scenario:**
  1. Student opens a shared diagram link `https://ghost-touch.org/#s=<payload>` in an offline or metered environment.
  2. Service Worker serves cached `index.html`.
  3. React mounts `App`.
  4. Line 280 runs `warmBackend()`, immediately issuing a network request (`fetch(`${baseUrl}/api/v1/health`)`).
- **Proposed minimal fix:**  
  Delete lines 280–282 from `frontend/src/App.tsx`.
- **Proposed test:**
  ```tsx
  it('App mount does not invoke fetch when opening a share route', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Using a test renderer that executes useEffect hooks
    const { unmount } = renderHook(() => App());
    expect(fetchSpy).not.toHaveBeenCalled();
    unmount();
  });
  ```

---

#### A5-02 · high · `frontend/src/drivers/audio.ts:265` & `frontend/src/screens/Explore.tsx:738,794` · Active Web Audio oscillator created & started on Explore unmount when Guide flag is OFF
- **What is wrong:**  
  `Explore.tsx` instantiates `new GuideController(...)` unconditionally (line 738). When `Explore` unmounts, its cleanup hook runs `gc.destroy()` (line 794), which calls `audio.setGuideTone?.(null)`. In `frontend/src/drivers/audio.ts` (line 265), `setGuideTone` calls `this.ensureGuideOsc()` unconditionally without checking whether `hz === null`. `ensureGuideOsc()` instantiates `ctx.createOscillator()`, `ctx.createGain()`, connects them to destination, and calls `osc.start()`. This permanently allocates and starts an audio oscillator even when `VITE_FEATURE_GUIDE` is unset / feature is OFF.
- **Concrete failure scenario:**
  1. App runs with `VITE_FEATURE_GUIDE` unset.
  2. User opens any diagram in Explore and presses Back.
  3. Explore unmounts; `GuideController.destroy()` calls `setGuideTone(null)`.
  4. An oscillator is created and started in the AudioContext with gain 0, violating the rule that flags OFF must leave audio nodes unchanged.
- **Proposed minimal fix:**  
  In `frontend/src/drivers/audio.ts`, add a guard at the top of `setGuideTone`:
  ```ts
  if (hz === null && this.guideOsc === undefined) {
    return;
  }
  ```
  Additionally, in `Explore.tsx`, instantiate `GuideController` only when `isGuideActive()` or flag is ON.
- **Proposed test:**
  ```ts
  it('calling setGuideTone(null) does not create or start an oscillator when none was active', () => {
    const fakeCtx = createFakeAudioContext();
    const driver = new WebAudioDriver(() => fakeCtx);
    driver.unlock();
    driver.setGuideTone(null);
    expect(fakeCtx.oscillators.length).toBe(1); // Only the initial theremin oscillator
  });
  ```

---

#### A5-03 · high · `frontend/src/styles/teach.css:54-406` & `frontend/tests/labTheme.prop.test.ts:410` · 20+ unmanaged bare hex color literals violating Design Token Color Property P20
- **What is wrong:**  
  `frontend/src/styles/teach.css` contains over 20 raw hex color literals without `var(--gt-*)` fallback wrappers (e.g. `border-color: #f85149;`, `color: #ff7b72;`, `background: #0b0b10;`, `border: 1px solid #30363d;`, `color: #58a6ff;`, `color: #ffdf5d;`, `background: #161b22;`). This was masked because `frontend/tests/labTheme.prop.test.ts` line 410 hardcoded `const screenStylesheets = ['lab.css', 'explore.css', 'correct.css', 'saved.css', 'settings.css', 'global.css']`, omitting `teach.css`. If `teach.css` is added, Property P20 immediately fails with 20+ violations.
- **Concrete failure scenario:**
  1. Add `'teach.css'` to `screenStylesheets` in `frontend/tests/labTheme.prop.test.ts:410`.
  2. Run `npm --prefix frontend test`.
  3. Vitest reports multiple property test failures on P20: `Unmanaged bare hex literal #f85149 at teach.css:54`.
- **Proposed minimal fix:**  
  1. Replace all bare hex occurrences in `frontend/src/styles/teach.css` with Design Token custom properties and fallbacks:
     - `#0b0e0c`, `#0b0b10` $\rightarrow$ `var(--gt-charcoal, #0b0e0c)`
     - `#39ff88` $\rightarrow$ `var(--gt-phosphor, #39ff88)`
     - `#58a6ff` $\rightarrow$ `var(--gt-electric, #58a6ff)`
     - `#f85149`, `#ff7b72` $\rightarrow$ `var(--gt-danger, #f85149)`
     - `#ffdf5d` $\rightarrow$ `var(--gt-accent, #ffdf5d)`
     - `#161b22`, `#0d1117` $\rightarrow$ `var(--gt-metal-dark, #161b22)`
     - `#30363d` $\rightarrow$ `var(--gt-suture, #30363d)`
     - `#ded6c4`, `#f0f6fc`, `#ffffff` $\rightarrow$ `var(--gt-bone, #ded6c4)`
  2. Add `'teach.css'` to `screenStylesheets` in `labTheme.prop.test.ts`.
- **Proposed test:**
  ```ts
  expect(screenStylesheets).toContain('teach.css');
  // Property P20 assertion passes with zero unmanaged hex literals in teach.css
  ```

---

#### A5-04 · high · `frontend/src/screens/Explore.tsx:52,738` & `frontend/src/screens/Teach.tsx:63` · Missing `subscribeLang` subscription causes status text freeze & wrong TTS voice after mid-flow language switch
- **What is wrong:**  
  Neither `Explore.tsx` nor `Teach.tsx` subscribes to `subscribeLang` via `useSyncExternalStore`. In `Explore.tsx`:
  - `statusMessage` is initialized via `useState(announced)` and never updates when language changes.
  - `GuideController` is instantiated once in `useEffect` (line 738) with `lang: LANG_BCP47[getLang()] ?? 'en-IN'`.
  When the user opens Settings from Explore, switches language (e.g. English $\rightarrow$ Hindi), and closes Settings, `Explore` does not re-render, the status card remains in English, and `GuideController` continues dispatching speech with the English voice (`en-IN`) instead of Hindi (`hi-IN`).
- **Concrete failure scenario:**
  1. User starts diagram exploration in English.
  2. User taps Settings, selects Hindi (`hi`), and closes Settings.
  3. User triggers voice command or Ask "Guide me".
  4. Directional hints are spoken by speech synthesis with `lang: 'en-IN'` instead of `'hi-IN'`.
- **Proposed minimal fix:**  
  1. In `Explore.tsx` and `Teach.tsx`, add:
     ```ts
     const currentLang = useSyncExternalStore(subscribeLang, getLang, getLang);
     ```
  2. In `Explore.tsx`, add a reactive effect:
     ```ts
     useEffect(() => {
       guideController.current?.setDeps({ lang: LANG_BCP47[currentLang] ?? 'en-IN' });
     }, [currentLang]);
     ```
- **Proposed test:**
  ```tsx
  it('updates GuideController language when language changes mid-flow', () => {
    setLang('en');
    const gc = new GuideController({ drivers, lang: LANG_BCP47['en'] });
    setLang('hi');
    gc.setDeps({ lang: LANG_BCP47[getLang()] });
    // Assert effect speech uses hi-IN
  });
  ```

---

#### A5-05 · high · `.github/workflows/ci.yml:22,25,54,57` · Invalid action tags (`@v7`) will fail CI runs on GitHub Actions
- **What is wrong:**  
  `.github/workflows/ci.yml` specifies:
  - `uses: actions/checkout@v7` (lines 22 & 54)
  - `uses: actions/setup-node@v7` (line 25)
  - `uses: actions/setup-python@v7` (line 57)
  None of these action tags exist in the official GitHub Actions ecosystem (`actions/checkout` is at `v4`, `actions/setup-node` is at `v4`, `actions/setup-python` is at `v5`). Any push or pull request to GitHub will fail immediately at runner initialization.
- **Concrete failure scenario:**
  1. A commit is pushed or PR created targeting `main`.
  2. GitHub Actions initiates workflow `CI`.
  3. Runner fails with `Action not found: actions/checkout@v7`.
- **Proposed minimal fix:**  
  In `.github/workflows/ci.yml`:
  - Change `actions/checkout@v7` to `actions/checkout@v4`
  - Change `actions/setup-node@v7` to `actions/setup-node@v4`
  - Change `actions/setup-python@v7` to `actions/setup-python@v5`
- **Proposed test:**
  Verify action versions against official GitHub releases.

---

#### A5-06 · high · `frontend/src/App.tsx:250-259` · Hardware Back from `#/teach` silently dumps user on Start screen without announcement & corrupts history stack
- **What is wrong:**  
  `Teach.tsx` does not wire a `pushTeachEntry` or listen to `popstate`. When a teacher enters `#/teach` from Explore via Settings, `Explore` pushed an entry (`pushExploreEntry()`). When the user presses the Android hardware Back button:
  1. Browser pops hash to `""`.
  2. `App.tsx` lines 250–259 handles `hash === '' || hash === '#'` and runs:
     ```ts
     if (prev.screen === 'teach') return { screen: 'start' };
     ```
  3. No announcement is spoken (silent screen transition, violating Rule 7: "Every state change is spoken").
  4. It switches to `start` instead of returning to the explored diagram.
  5. `explorePushed` in `navigation.ts` remains `true`, corrupting subsequent navigation entries.
- **Concrete failure scenario:**
  1. User is on Explore with a diagram.
  2. Opens Settings $\rightarrow$ taps "Open Teacher Editor".
  3. Presses Android system Back button.
  4. Screen changes to Start with 0 speech output.
- **Proposed minimal fix:**  
  In `App.tsx`: when leaving `teach` via hash change, if `lastExploreScene.current` exists, transition to `explore` and speak `exploreAnnouncement(scene, 'ai')`; otherwise transition to `start` and speak `t('start.intro')`. Reset navigation entries appropriately.
- **Proposed test:**
  ```tsx
  it('speaks announcement when returning from #/teach to empty hash', () => {
    // Dispatch hashchange from #/teach to ''
    // Assert speech driver was called with an announcement
  });
  ```

---

#### A5-07 · med · `frontend/src/App.tsx:46` & `frontend/vite.config.ts` · `qrcode` and `lz-string` are not lazy-loaded, bloating main chunk by >108 KiB
- **What is wrong:**  
  `App.tsx` directly imports `Teach` (line 46) and `decodeShare` (line 47). `Teach.tsx` imports `qrDataUrl` which pulls `QRCode` from `qrcode` and `lz-string`. As a result, both packages and all teacher editing components are statically compiled into `dist/assets/index-*.js` (474.16 kB raw). The Service Worker precache grew from 531.6 KiB to 639.79 KiB. Mobile users exploring standard diagrams download and parse QR code and LZ compression libraries even when feature flags are OFF.
- **Concrete failure scenario:**
  1. Run `npm --prefix frontend run build`.
  2. Build outputs only `pdf-*.js` and `index-*.js`.
  3. Inspecting `dist/assets/index-*.js` reveals the complete `qrcode` generator and `lz-string` engine inside the entry bundle.
- **Proposed minimal fix:**  
  In `frontend/src/App.tsx`, load `Teach` via `React.lazy(() => import('./screens/Teach'))` inside a `<Suspense>`. In `frontend/src/share/qr.ts`, dynamically import `qrcode`: `const { default: QRCode } = await import('qrcode')`.
- **Proposed test:**
  Verify `npm run build` outputs a separate chunk for `teach` and `qrcode`, reducing `index-*.js` bundle size.

---

#### A5-08 · med · `frontend/tests/a11y.screens.test.tsx:200-369` · `Teach`, `ShareError`, and `VerifiedBanner` omitted from central accessibility test suite
- **What is wrong:**  
  `frontend/tests/a11y.screens.test.tsx` tests `Start`, `Capture`, `Explore`, `SavedDiagrams`, `Correct`, and `LabSettings` across English, Hindi, and Gujarati for heading structure, accessible names, touch targets, and polite live regions. Neither `Teach` nor `ShareError` nor Explore with `VerifiedBanner` was added to this suite.
- **Concrete failure scenario:**
  1. A regression in accessible names or heading hierarchy is introduced in `Teach.tsx` or `ShareError.tsx`.
  2. `npm test tests/a11y.screens.test.tsx` passes because the new screens are not in the test matrix.
- **Proposed minimal fix:**  
  Add test blocks for `Teach`, `ShareError`, and Explore with `VerifiedBanner` to `a11y.screens.test.tsx` in `en`, `hi`, and `gu`.
- **Proposed test:**
  ```tsx
  it('Teach screen passes a11y DOM checks', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(createElement(Teach, { drivers, onBack: vi.fn() }));
    const result = validateScreenMarkup(html);
    expect(result.violations).toEqual([]);
    expect(result.h1Count).toBe(1);
  });
  ```

---

#### A5-09 · med · `frontend/src/i18n/index.ts:615,905` · Key `teach.qrTooLong` untranslated in Hindi and Gujarati
- **What is wrong:**  
  In `frontend/src/i18n/index.ts`:
  - Line 615 (`hi`): `'teach.qrTooLong': 'Link too long for a QR code; use Copy link'`
  - Line 905 (`gu`): `'teach.qrTooLong': 'Link too long for a QR code; use Copy link'`
  Both dictionaries have the English string verbatim.
- **Concrete failure scenario:**
  1. Teacher uses the app in Hindi or Gujarati.
  2. Teacher verifies a diagram with a large URL (> 2000 chars).
  3. Sighted fallback notice displays English text on an otherwise localized interface.
- **Proposed minimal fix:**  
  Update `frontend/src/i18n/index.ts`:
  - `hi`: `'क्यूआर कोड के लिए लिंक बहुत लंबा है; लिंक कॉपी करें का उपयोग करें'`
  - `gu`: `'ક્યુઆર કોડ માટે લિંક ખૂબ લાંબી છે; લિંક કોપી કરો વાપરો'`
- **Proposed test:**
  ```ts
  it('teach.qrTooLong is localized in hi and gu', () => {
    expect(tables.hi['teach.qrTooLong']).not.toBe(tables.en['teach.qrTooLong']);
    expect(tables.gu['teach.qrTooLong']).not.toBe(tables.en['teach.qrTooLong']);
  });
  ```

---

#### A5-10 · med · `frontend/src/components/teach/LoadModal.tsx:95-101` · `LoadModal` lacks keyboard focus trap
- **What is wrong:**  
  `frontend/src/components/teach/LoadModal.tsx` specifies `role="dialog"` and `aria-modal="true"`, but its `handleKeyDown` only listens for `Escape`. It does not trap `Tab` or `Shift+Tab`, allowing keyboard focus to escape into background elements behind the modal sheet.
- **Concrete failure scenario:**
  1. Sighted user on Teacher Editor opens "Load diagram".
  2. User presses Tab repeatedly past the last focusable element in the modal.
  3. Focus moves to background buttons on the main screen while the modal remains open.
- **Proposed minimal fix:**  
  Implement the standard focus trap logic from `LabSettings.tsx:166-193` in `LoadModal.tsx`.
- **Proposed test:**
  ```tsx
  it('traps Tab focus within LoadModal', () => {
    // Simulate Tab on last button; assert focus wraps to first element
  });
  ```

---

#### A5-11 · low · `frontend/src/drivers/hashRoute.ts:65` · Redundant `loc.hash = ''` assignment after `replaceState`
- **What is wrong:**  
  In `frontend/src/drivers/hashRoute.ts` lines 63–66:
  ```ts
  history.replaceState(null, '', path || '/');
  if (loc && typeof loc.hash === 'string') {
    loc.hash = '';
  }
  ```
  `history.replaceState` already clears the URL hash. In standard browsers, immediately assigning `location.hash = ''` can append a bare `#` to the address bar or trigger an extra hashchange event.
- **Concrete failure scenario:**
  1. Student exits shared diagram via Back button.
  2. `clearHash()` calls `replaceState(null, '', '/')` and then `loc.hash = ''`.
  3. Browser URL becomes `http://domain/#` instead of `http://domain/`.
- **Proposed minimal fix:**  
  Remove `loc.hash = ''` when `history.replaceState` is available and has run.
- **Proposed test:**
  Verify `clearHash` does not assign `loc.hash` when `history.replaceState` is defined.

---

#### A5-12 · low · `frontend/src/vite-env.d.ts:3-7` & `frontend/src/drivers/clipboard.ts:99` · `VITE_SITE_URL` missing from `ImportMetaEnv` typing
- **What is wrong:**  
  `frontend/src/drivers/clipboard.ts` line 99 reads `import.meta.env.VITE_SITE_URL`, but `frontend/src/vite-env.d.ts` only declares `VITE_API_URL`, `VITE_FEATURE_GUIDE`, and `VITE_FEATURE_SHARE`.
- **Concrete failure scenario:**
  1. A strict TypeScript check or IDE inspection highlights `VITE_SITE_URL` as an undeclared property on `ImportMetaEnv`.
- **Proposed minimal fix:**  
  Add `readonly VITE_SITE_URL?: string;` to `interface ImportMetaEnv` in `frontend/src/vite-env.d.ts`.
- **Proposed test:**
  `tsc --noEmit` verifies strict property resolution.

---

#### A5-13 · low · `frontend/.env.example:1-10` & `docs/DEPLOY.md` · Missing documentation for `VITE_FEATURE_GUIDE` and `VITE_FEATURE_SHARE`
- **What is wrong:**  
  `frontend/.env.example` only lists `VITE_API_URL`. `docs/DEPLOY.md` explains deploying to Vercel and configuring `VITE_API_URL` and `VITE_SITE_URL`, but makes no mention of `VITE_FEATURE_GUIDE=1` or `VITE_FEATURE_SHARE=1`. An operator following `DEPLOY.md` will deploy with the features permanently disabled.
- **Concrete failure scenario:**
  1. Operator follows `docs/DEPLOY.md` step-by-step on Vercel.
  2. Operator does not set `VITE_FEATURE_GUIDE` or `VITE_FEATURE_SHARE`.
  3. Both features remain disabled in production.
- **Proposed minimal fix:**  
  Add `VITE_FEATURE_GUIDE=1` and `VITE_FEATURE_SHARE=1` with commentary to `frontend/.env.example` and Section 3 of `docs/DEPLOY.md`.
- **Proposed test:**
  Inspect documentation files to confirm keys are present.

---

#### A5-14 · low · `frontend/tests/guide.ui.explore.test.tsx:70` · Use of `any` violates AGENTS.md Rule 7
- **What is wrong:**  
  In `frontend/tests/guide.ui.explore.test.tsx` line 70:
  `diagramStore: {} as any`
  violates AGENTS.md Rule 7 ("No any").
- **Concrete failure scenario:**
  1. Codebase audit for `any` flags line 70.
- **Proposed minimal fix:**  
  Replace with `new MemoryDiagramStore()`.
- **Proposed test:**
  `tsc` passes with strict typing.

---

### SUSPECTED Findings

#### A5-15 · low · `frontend/src/flow/guide.ts:26,153` · Fixed 250 ms ticker interval timer overhead in background tabs
- **What is wrong:**  
  `GuideController` uses a standard `setInterval` running every 250 ms to tick the 20-second timeout. If the user switches away from the browser tab while guidance is active, `setInterval` continues running (though throttled by browser background timer rules).
- **Concrete failure scenario:**
  1. User starts finger guidance.
  2. User switches to another app without stopping guidance.
  3. `setInterval` continues firing ticks until the 20-second timeout occurs.
- **Proposed minimal fix:**  
  Pause the ticker on `visibilitychange` (`document.hidden`) or allow timeout to be calculated on next touch event.
- **Proposed test:**
  Test `GuideController` with mock document visibility.

---

## Top 5 to Fix First

1. **A5-01 (`App.tsx:280`)**: Delete duplicate unconditional `warmBackend()` call to guarantee 0 network calls on Student Open and offline.
2. **A5-02 (`audio.ts:265`)**: Guard `audio.setGuideTone(null)` to prevent creating and starting an oscillator when no guide tone was active (audio node leak with flags OFF).
3. **A5-05 (`ci.yml:22,25,54,57`)**: Correct invalid GitHub Action tags (`@v7` $\rightarrow$ `@v4`/`@v5`) so CI runs pass on GitHub.
4. **A5-04 (`Explore.tsx:52` & `Teach.tsx:63`)**: Subscribe `Explore` and `Teach` to `subscribeLang` and update `GuideController.deps.lang` on language change to fix frozen status text and wrong TTS voice.
5. **A5-03 (`teach.css:54-406`)**: Convert bare hex colors in `teach.css` to `var(--gt-*)` tokens and add `teach.css` to Property P20 test runner in `labTheme.prop.test.ts`.
