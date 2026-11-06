# Verdict: SHIP

The Frankenstein Laboratory redesign (`main` compared against base commit `f60b0f7`) passes all functional regression guards, preserves the core state machine and tuned haptics intact, maintains WCAG AAA accessibility contracts, and introduces a cohesive visual identity across all screens.

---

## Checks (A to D)

### A. NOTHING FUNCTIONAL CHANGED where it must not

#### A.1 Core module and tuned haptic vocabulary: PASS
- **`frontend/src/core/**` diff**: Verified completely empty via `docs/review/10-core.diff` (0 bytes) and `docs/review/00-src-stat.txt`. No files under `frontend/src/core/` were touched.
- **`frontend/src/drivers/haptics.ts`**: Not present in `docs/review/20-drivers.diff`. The haptic driver was completely untouched.
- **Tuned haptic constants check**: None of the tuned constants from `.kiro/steering/tech.md` (`80`, `70`, `[50, 90, 50]`, `450`, or pitch mapping `1000 - y * 800`) were modified, moved, or redefined anywhere in the codebase or diffs.

#### A.2 Drivers diff (`audio.ts`, `speech.ts`, `navigation.ts`): PASS
- **`audio.ts` (`WebAudioDriver`)**:
  - Earcon definitions (`getEarconSteps`) and tone constant `TONE_GAIN = 0.15` remain unchanged.
  - Fix for stuck theremin tones: Gain and frequency now cancel scheduled automation values before tone changes (`cancelScheduledValues`), and theremin tone restoration waits for active earcons to complete (`earconRestoreAt`).
  - Memory leak prevention: WebAudio oscillator and gain nodes are disconnected on the `onended` event (`osc.disconnect()`, `gain.disconnect()`).
  - AudioContext auto-resume: Added `resumeIfSuspended` on audio cue triggers and lifecycle listeners on `visibilitychange`, `pointerdown`, `touchstart`, and `keydown`.
- **`speech.ts` (`WebSpeechDriver`)**:
  - Extended failure union with `'cancelled'` and updated `cancelListen()` to abort active Web Speech API recognition instances when supported (`recognition.abort()`).
  - Cleaned up lifecycle event listeners (`pagehide`, `visibilitychange`) upon completion.
- **`navigation.ts`**:
  - Added dedicated history entries and popstate handlers for secondary screens: `pushSavedEntry`, `leaveSavedEntry`, `onSavedBack`, `pushCorrectEntry`, `leaveCorrectEntry`, `onCorrectBack`, `replaceSavedEntry`.
  - Enables Android system Back gesture and TalkBack back navigation across SavedDiagrams and Teacher Correct modes without affecting the existing Explore navigation model.
- Accidental behavior changes: None observed.

#### A.3 Screens diff & Explore interaction chain: PASS
- **Canvas element**: `<canvas ref={canvasRef} className="gt-explore__canvas" ...>` in `frontend/src/screens/Explore.tsx` remains the direct interaction target.
- **Pointer event handlers**: `onPointerDown={handlePointerDown}`, `onPointerMove={handlePointerMove}`, `onPointerUp={handlePointerUp}`, `onPointerCancel={handlePointerCancel}`, and `onLostPointerCapture={handleLostPointerCapture}` are intact.
- **Touch action**: CSS `touch-action: none` is preserved on `.gt-explore__canvas`.
- **Pointer capture**: `canvasRef.current?.setPointerCapture(e.pointerId)` remains active on initial pointer contact.
- **State machine & haptic execution chain**: The execution path from `hitTest` to `step` to `runEffects(effects, drivers)` inside `stepHaptics()` is 100% intact.
- **Two-finger swipe & long-press Ask gesture**: Both multi-touch exit gesture (`activePointers.size === 2`) and 500 ms stationary long-press Ask gesture (`longPressTimer`) remain unchanged.
- **TalkBack relative cursor**: Relative touch navigation (`handleRelativeMove`, `pendingCursor`, relative coordinate conversion in `stepHaptics`) is intact.

#### A.4 Spoken strings, i18n tables, and accessible names: PASS
- **Translation tables (`frontend/src/i18n/index.ts`)**:
  - **Removed / Changed existing strings**: Exactly one existing string was modified in `en`:
    - `app.tagline`: changed from `"Feel diagrams you cannot see."` to `"Feel diagrams you can't see."` (diff line 830).
  - **Hindi (`hi`) & Gujarati (`gu`)**: Zero existing strings were removed or modified.
  - **New strings added**: All 24 new keys under the `lab.*` namespace were cleanly added across `en`, `hi`, and `gu`:
    `lab.start.wake`, `lab.start.tagline`, `lab.start.subhint`, `lab.organ.nerves.title`, `lab.organ.nerves.line`, `lab.organ.eyes.title`, `lab.organ.eyes.line`, `lab.organ.voice.title`, `lab.organ.voice.line`, `lab.settings.button`, `lab.settings.title`, `lab.settings.close`, `lab.settings.language`, `lab.settings.rate`, `lab.settings.opened`, `lab.settings.closed`, `lab.loading.title`, `lab.loading.hint`, `lab.raw.notice`, `lab.specimen.triangle`, `lab.specimen.sine`, `lab.specimen.bars`, `lab.empty.saved`, `lab.empty.generic`.
- **Accessibility attributes (`aria-label`, `role`, `aria-live`, `aria-hidden`) in `40-screens.diff`**:
  - `Capture.tsx`:
    - Replaced redundant top toolbar with an AccessibleButton settings launcher: `aria-haspopup="dialog"`, `aria-expanded={settingsOpen}`, labelled by `{describeSettings(currentLang, activeRate)}`.
    - Added `aria-labelledby="gt-capture-samples-title"` to samples section and `id="gt-capture-samples-title"` to heading.
    - Added explicit `aria-label={t(labelKey)}` to specimen sample buttons.
    - Added `aria-busy={busy}` on `<main>` and `aria-hidden="true"` on the decorative Logo mark and LabLoading meter.
  - `Correct.tsx`:
    - Added `tabIndex={-1}` and `ref={headingRef}` to `<h1>` for programmatic focus transfer upon entry; heading text and role are unchanged.
    - Canvas retains `tabIndex={0}`, `role="img"`, and `aria-label={t('correct.photoOverlay')}` while removing fixed pixel width/height attributes in favor of responsive DPR sizing.
  - `Explore.tsx`:
    - Added `role="status"` on the Raw Mode notice chip (`.gt-lab-raw-notice`).
    - Added `aria-hidden="true"` to decorative specimen table frame elements (suture border, corner rivets, and Spark animation wrapper).
    - StatusText live region management and canvas accessibility label (`canvasAriaLabel`) are preserved.
  - `SavedDiagrams.tsx`:
    - Added `tabIndex={-1}` and `ref={headingRef}` to `<h1>` for focus placement on mount.
    - Added decorative Mascot SVG (`aria-hidden="true"`, `focusable="false"`) to empty state.
  - `Start.tsx`:
    - Screen remains one full-screen button with `aria-label={t('start.intro')}`. All decorative hero elements (Logo, Mascot, Seam, OrganTiles, Action badge, Subhint) reside within `<span className="gt-start__hero" aria-hidden="true">`, ensuring no audio clobbering for TalkBack users.

#### A.5 Removed test lines audit (`60-tests-removed-lines.txt`): PASS
- `frontend/tests/api.scene.test.ts`:
  - Lines removed: `- timeoutMs: 20_000`, `- await vi.advanceTimersByTimeAsync(20_000)`.
  - Reason: Legitimate adjustment. Base `SCENE_TIMEOUT_MS` was increased from 20 s to 45 s to reliably accommodate Render free-tier cold starts (~32 s). The mock timer advance was updated to 45 s.
- `frontend/tests/drivers.audio.earcons.test.ts` & `frontend/tests/drivers.audio.test.ts`:
  - Lines removed: Mock interface definitions for `fakeParam`, `OscillatorLike`, and `GainLike`.
  - Reason: Legitimate mock typing update to support the new `cancelScheduledValues` and `disconnect` driver lifecycle methods.
- `frontend/tests/polish.test.ts` & `frontend/tests/screens.render.test.ts`:
  - Lines removed: `- expect(html).not.toContain('aria-hidden')`.
  - Reason: Legitimate markup evolution. The original test asserted that no `aria-hidden` attribute existed anywhere in static HTML. With the redesign, decorative SVGs (the brand Logo mark, SpecimenPreview vector paths) must have `aria-hidden="true"` to comply with WCAG 1.1.1. The assertion was updated to `expect(html).not.toMatch(/<button[^>]*aria-hidden="true"/)`, guaranteeing that no interactive buttons are hidden from screen readers. Not a weakened test; a necessary refinement.

---

## B. ACCESSIBILITY of the new UI

#### B.1 Touch targets (>= 48×48 CSS px): PASS
- All new and restyled interactive elements enforce a minimum of 48×48 CSS px:
  - Lab button primitives: `.gt-btn`, `.gt-btn--primary`, `.gt-btn--secondary`, `.gt-btn--quiet` use `min-width: var(--gt-target, 48px); min-height: var(--gt-target, 48px)`.
  - Settings launchers: `.gt-capture__button--settings` and `.gt-settings-launcher__button` have `min-width: 48px; min-height: 48px`.
  - Capture controls: `.gt-capture__button--secondary` (min-height 52px), `.gt-capture__button--saved` (min-height 52px), and specimen buttons `.gt-capture__sample-btn` (min-height 108px, min-width 48px).
  - Explore actions: `.gt-explore__ask` (52px), `.gt-explore__back` (52px), `.gt-explore__correct` (52px), `.gt-explore__send` (52px), `.gt-explore__ask-input` (48px).
  - Modal sheet: `.gt-lab-settings__close` (48×48px).
  - Teacher Correct: `.gt-correct__btn` variants (48×48px), `.gt-correct__label-input` (48px).
  - Saved diagrams: `.gt-saved__back` and `.gt-saved__btn` variants (48×48px).
- Verified by automated target test suite `tests/a11y.targets.test.ts`.

#### B.2 Visible focus indicators: PASS
- All interactive controls provide high-contrast visible focus rings using voltage cyan (`#00f0ff`) or creature green (`#39ff88`):
  - `.gt-btn:focus-visible`: `outline: 3px solid var(--gt-cyan); outline-offset: 3px; box-shadow: 0 0 0 3px var(--gt-bg), 0 0 12px var(--gt-cyan-glow)`.
  - `.gt-settings-launcher__button:focus-visible`: `outline: 3px solid var(--gt-cyan, #39ff88); outline-offset: 2px`.
  - `.gt-lab-settings__close:focus-visible`: `outline: 3px solid var(--gt-copper, #39ff88); outline-offset: 2px`.
  - High Contrast / Windows Forced Colors: explicitly styled with `outline: 3px solid Highlight !important` and `border: 2px solid ButtonText !important`.

#### B.3 Motion reduction (`prefers-reduced-motion`): PASS
- Every animation respects `prefers-reduced-motion: reduce`:
  - `Spark.tsx`: Listens via `matchMedia` and applies `.gt-spark--reduced`. Completes within 50 ms rather than 950 ms, disabling keyframes and drop-shadows.
  - `LabLoading.tsx`: Keyframes disabled; displays a static half-filled meter state (4 of 8 cells filled).
  - `explore.css`: Disables alive pulse keyframes (`gt-alive-border-pulse`, `gt-alive-hud-pulse`) with `animation: none !important`.
  - `global.css`, `correct.css`, `saved.css`, `settings.css`: All reset `animation: none !important; transition: none !important`.

#### B.4 Flash limits (WCAG 2.3.1): PASS
- "IT'S ALIVE" spark: Total animation duration is 950 ms (strictly under 1.2 s). Pulse animation consists of 2 brightness peaks over 0.95 s (~2.1 Hz), strictly below the WCAG 2.3.1 threshold of 3 flashes per second.
- Loading charge meter: 1.8 s cycle with smooth opacity transitions.

#### B.5 Text & UI contrast tokens: PASS (with minor observation)
- All primary and secondary text tokens meet WCAG AAA (>= 7:1) on dark surfaces:
  - `--gt-text` (`#eafff5`) on `--gt-bg` (`#0b0e0c`): contrast ratio > 18:1.
  - `--gt-text-primary` (`#f5fff8`) on `--gt-surface` (`#141c17`): contrast ratio > 18:1.
  - `--gt-bone` / `--gt-text-secondary` (`#ded6c4`) on `--gt-bg` (`#0b0e0c`): contrast ratio > 13:1.
  - `--gt-text-muted` (`#a8c5b5`) on `--gt-bg` (`#0b0e0c`): contrast ratio > 10:1.
  - `--gt-text-dark` (`#051309`) on `--gt-green` (`#39ff88`): contrast ratio > 15:1.
- *Observation*: The Raw Mode badge text (`#0b0e0c` on `--gt-copper` `#c88a4b`) has a contrast ratio of 6.65:1. This easily exceeds the 4.5:1 requirement for UI badges and bold text, but is not registered in `tests/a11y.contrast.test.ts`.

#### B.6 Decorative SVGs & semantics: PASS
- All decorative graphics feature `aria-hidden="true"` and `focusable="false"`:
  - `Logo` (when `decorative={true}`)
  - `Mascot`
  - `SpecimenPreview`
  - `Rivets` and `Seam`
  - `Spark`
  - `LabLoading` charge track and spark glyph
  - `OrganIcons` (`NervesIcon`, `EyesIcon`, `VoiceIcon`)

#### B.7 Modal settings dialog: PASS
- `LabSettings.tsx` implements full WAI-ARIA Dialog (Modal) semantics:
  - Container attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="lab-settings-title"`.
  - Focus trap: Constrains `Tab` and `Shift+Tab` cycles within the dialog.
  - Initial focus: Moves focus to the close button on mount.
  - Exit focus: Restores focus to the triggering launcher button upon dismissal.
  - Dismissal: Supports `Escape` key and backdrop click.
  - Speech cues: Announces `lab.settings.opened` and `lab.settings.closed` via TTS.

#### B.8 Heading structure & programmatic focus: PASS
- Exactly one `h1` per screen:
  - Start: Single accessible button with `aria-label` (decorative hero text aria-hidden).
  - Capture: `<h1 className="gt-capture__title">{t('app.name')}</h1>`.
  - Explore: `<h1 className="gt-explore__title">{sceneName(scene)}</h1>`.
  - Correct: `<h1 className="gt-correct__title">{t('correct.title')}</h1>`.
  - SavedDiagrams: `<h1 className="gt-saved__heading">{t('saved.heading')}</h1>`.
- Both Correct and SavedDiagrams feature `tabIndex={-1}` and `ref={headingRef}` on their `h1` to set assistive focus on mount.

#### B.9 Non-reliance on colour alone: PASS
- Canvas interactions in Correct mode use stroke width (6px vs 4px) and point radius (12px vs 8px) in addition to colour.
- Buttons pair distinct shapes, borders, and text labels.
- Raw mode pairs colour with an explicit text badge ("RAW") and spoken announcements.

---

## C. DESIGN CONSISTENCY

#### C.1 Hard-coded colour literals outside `tokens.css`: CONCERN
Per the brief: `var(--x, #hex)` fallbacks are allowed, bare literals are not, except inside logo, mascot, and brand SVG assets. The review identified several bare colour literals in CSS and component files:
- **`frontend/src/styles/explore.css`**:
  - Line 116 (`.gt-lab-rivet`): `background: radial-gradient(circle at 35% 35%, #e0a370 0%, var(--gt-copper, #b87333) 50%, #4a2810 100%)` (bare hex `#e0a370` and `#4a2810`).
  - Line 256 (`.gt-explore__raw-badge`): `color: #0b0e0c;` (bare hex for dark text).
  - Line 284 & 336 (`.gt-explore__ask`, `.gt-explore__send`): `background: linear-gradient(180deg, #13271f 0%, #0d1a15 100%)`.
  - Line 291 & 342 (`.gt-explore__ask:hover`, `.gt-explore__send:hover`): `color: #051309;`.
- **`frontend/src/styles/global.css`**:
  - Line 74: `linear-gradient(to right, rgba(0, 240, 255, 0.035) 1px, transparent 1px)` (blueprint grid; rgba literal instead of var).
  - Line 132 (`.gt-btn--primary:hover`): `background: #4dff95;` (bare hex bright green hover).
- **`frontend/src/styles/settings.css`**:
  - Line 18 (`.gt-lab-settings__backdrop`): `background: rgba(0, 0, 0, 0.75);`.
- **`frontend/src/components/lab/Rivets.tsx`**:
  - SVG internal accents: `stroke="rgba(0, 0, 0, 0.6)"`, `fill="rgba(255, 255, 255, 0.4)"`, `stroke="rgba(0, 0, 0, 0.7)"`.
- **Canvas 2D Rendering Contexts** (`Correct.tsx` line 226, `Explore.tsx` line 414):
  - Canvas 2D contexts cannot evaluate CSS custom properties directly without DOM computed styles, so `#0b0e0c`, `#58a6ff`, `#3fb950`, `#ffffff` are hardcoded in canvas drawing commands. This is functionally necessary and standard for HTML5 Canvas.

#### C.2 Typography, text wrapping, and internationalization (Hindi/Gujarati): PASS
- Removed `white-space: nowrap` from `.gt-explore__title`, replacing it with `-webkit-line-clamp: 2` and `word-break: break-word`.
- All text styles in `start.css`, `explore.css`, and `tokens.css` declare `white-space: normal; overflow-wrap: break-word;`.
- Font stack declares Atkinson Hyperlegible first with explicit Indian system font fallbacks (`'Nirmala UI'`, `'Noto Sans Devanagari'`, `'Noto Sans Gujarati'`).
- Start screen organ tiles dynamically transition to horizontal rows on viewports <= 640px and under 200% zoom with `height: auto`, avoiding text truncation.

#### C.3 `@import` rules ordering: PASS
- `frontend/src/styles/global.css` declares all `@import` statements at the very top:
  ```css
  @import './tokens.css';
  @import './lab.css';
  @import './explore.css';
  ```
- No other CSS file uses `@import`.
- Validated by automated guard test `frontend/tests/css.imports.test.ts`.

#### C.4 CSS file imports & orphan check: PASS
- All 10 stylesheets in `src/styles/` are actively imported and used:
  - `tokens.css`, `lab.css`, `explore.css`: imported by `global.css`.
  - `global.css`: imported by `main.tsx`.
  - `correct.css`: imported by `Correct.tsx`.
  - `saved.css`: imported by `SavedDiagrams.tsx`.
  - `settings.css`: imported by `LabSettings.tsx`.
  - `loading.css`: imported by `LabLoading.tsx`.
  - `specimen.css`: imported by `SpecimenPreview.tsx`.
  - `start.css`: imported by `OrganTiles.tsx`.
- Zero orphaned CSS files. Verified by `tests/css.imports.test.ts`.

---

## D. RISKS & ARCHITECTURAL DISCIPLINE

#### D.1 Render-phase side effects: PASS
- `App.tsx`: `createPhotoUrlTracker()` produces a pure reference wrapper inside `useRef()`; `warmBackend()` executes solely in `useEffect()`.
- `Explore.tsx`: `shouldPlayAlive(scene)` is a pure read against a WeakSet. State updates and `markAlivePlayed(scene)` occur inside `useEffect()` (SSR test environment explicitly isolated).
- `SpecimenPreview.tsx`: Synchronous cache read in `useState` initializer is pure; asynchronous `loadSample` fetch runs in `useEffect()`.

#### D.2 Module-level mutable state: PASS
- Managed instances:
  - `frontend/src/api/health.ts`: `let warmed = false;` (page-load warm-up guard).
  - `frontend/src/flow/alive.ts`: `playedScenes = new WeakSet<DiagramScene>()`, `isReturningFromCorrect = false`.
  - `frontend/src/drivers/navigation.ts`: Screen push flags and pop suppression timer.
  - `frontend/src/components/SpecimenPreview.tsx`: `sampleCache = new Map<SampleId, DiagramScene>()`.
- All instances provide exported reset helpers for unit test isolation (`resetWarmGuardForTesting`, `resetAliveForTesting`, `_resetNavigationState`, `clearSampleCache`). WeakSet usage guarantees automatic garbage collection of scene objects.

#### D.3 Event listener lifecycle & cleanups: PASS
- `Capture.tsx`: File input `cancel` listeners removed on unmount.
- `Correct.tsx`: Window resize listener and `ResizeObserver` disconnected in effect cleanup.
- `LabSettings.tsx`: Window `keydown` listener removed in effect cleanup.
- `Spark.tsx`: `mediaQueryList` change listener removed in effect cleanup.
- `speech.ts`: Visibility and pagehide listeners removed before promise resolution.
- `navigation.ts`: `onSavedBack` and `onCorrectBack` return removal callbacks.
- `audio.ts`: Single-attach guard (`this.listenersAttached`) for lifetime document gesture listeners.

#### D.4 TypeScript strictness & browser API isolation: PASS
- Zero `any` types added in application code (`tsc --noEmit` exits with code 0).
- Zero `console.*` calls added outside unit test mocks.
- Zero direct `localStorage` access outside `drivers/storage.ts`.
- Browser APIs remain strictly confined to `frontend/src/drivers/`.

#### D.5 Offline PWA durability: PASS
- Atkinson Hyperlegible woff2 font files (`400-normal` and `700-normal`) reside locally in `frontend/src/assets/fonts/` and are included in the ServiceWorker precache manifest (18 entries, 502.95 KiB).
- `SpecimenPreview` loads diagram data via `loadSample(id)` from precached JSON.
- `warmBackend()` checks online status and silently swallows fetch rejections without throwing or interrupting user workflows when offline.

---

## Prioritised Findings List

| ID | Severity | File | Problem | Suggested Fix |
|:---|:---|:---|:---|:---|
| **F-01** | Low | `frontend/src/styles/explore.css` | Hard-coded bare hex colour literals in button gradients (`#13271f`, `#0d1a15`), hover text (`#051309`), and raw badge text (`#0b0e0c`). | Replace with `var(--gt-surface-active)`, `var(--gt-text-dark)`, and `var(--gt-bg)`. |
| **F-02** | Low | `frontend/src/styles/global.css` | Bare hex `#4dff95` used on `.gt-btn--primary:hover`. | Replace with `var(--gt-green-bright, #4dff95)`. |
| **F-03** | Low | `frontend/tests/a11y.contrast.test.ts` | The Raw Mode badge color pair (`#0b0e0c` on `--gt-copper` `#c88a4b`, contrast 6.65:1) is not explicitly listed in the contrast test table. | Add `{ text: '--gt-bg', bg: '--gt-copper', label: 'raw badge text on copper' }` to UI component pairs (>= 4.5:1). |

---

## What Looks Good

1. **Frankenstein Lab Aesthetics**: The thematic concept (buzzing nerves, vision AI eyes, synthesizer voice) is executed consistently across the UI without compromising tactile clarity or resorting to insensitive blindness tropes.
2. **Accessible Settings Consolidation**: Moving language and speech rate into a dedicated modal bottom sheet declutters the Capture and Explore screens while meeting all WAI-ARIA Modal Dialog specifications.
3. **Specimen Jar Cards**: Converting sample diagram buttons into real mini SVG previews (`SpecimenPreview`) provides sighted teachers and low-vision users with an immediate visual reference while remaining completely accessible to screen readers via clear `aria-label` text.
4. **Resilient Teacher Correct Canvas**: DPR-aware scaling and the letterbox coordinate conversion (`pointerToScene`) eliminate alignment discrepancies across diverse device pixel ratios.
5. **System Back Navigation**: Implementing proper history management on secondary screens (`SavedDiagrams`, `Correct`) ensures a natural mobile experience for Android gestures and TalkBack swipe actions.

---

## Proof & Verification Commands Executed

The following allowable headless verification commands were executed from the repository root:

1. **Frontend Test Suite**:
   ```bash
   npm --prefix frontend test
   ```
   *Result*: **1049 passed** (74 test files, 0 failures, 1.46 s duration).

2. **Frontend Type Check**:
   ```bash
   npm --prefix frontend exec -- tsc -p frontend --noEmit
   ```
   *Result*: Exited with code 0 (zero type errors).

3. **Frontend Production Build & PWA Generation**:
   ```bash
   npm --prefix frontend run build
   ```
   *Result*: Built successfully in 170 ms. PWA v2.0.0 precached 18 entries (502.95 KiB), generating `dist/sw.js` and font assets.

4. **Backend Test Suite**:
   ```bash
   backend/.venv/Scripts/python -m pytest backend
   ```
   *Result*: **348 passed**, 1 skipped, 1 warning in 32.51 s.

5. **Backend Ruff Lint Check**:
   ```bash
   backend/.venv/Scripts/python -m ruff check backend
   ```
   *Result*: All checks passed.

6. **Backend Ruff Format Check**:
   ```bash
   backend/.venv/Scripts/python -m ruff format --check backend
   ```
   *Result*: 52 files already formatted.

7. **Git Status & History**:
   ```bash
   git status --short
   git log --oneline -5
   ```
   *Result*: Clean worktree on branch `agy/lab-review`.
