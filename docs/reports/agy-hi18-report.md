# Antigravity Lane hi18 Report: LabSettings Open and Close Speech Announcements

## Summary
- **Lane**: hi18
- **Goal**: Fix a finding from the Playwright pass over `docs/PHONE_TEST.md` rows 3.1 and 3.8. The strings `lab.settings.opened` ("Lab settings opened") and `lab.settings.closed` ("Lab settings closed") existed in English, Hindi, and Gujarati, but were never spoken when opening or closing the settings sheet. Students without screen readers opening or closing the settings sheet heard nothing.
- **Solution**:
  - In `frontend/src/components/LabSettings.tsx`, wired speech announcements:
    - When the sheet opens (`open` transitions from false to true), speaks `t('lab.settings.opened')` once through `doSpeak` with the localized BCP-47 language tag (`LANG_BCP47[getLang()]`).
    - When the sheet closes via `handleClose` (close button, scrim backdrop click, or Escape key) or when `open` prop transitions from true to false (e.g. Android Back / parent state change), speaks `t('lab.settings.closed')` once.
    - Guarded against double utterances using `wasOpen` and `hasSpokenClose` refs: React StrictMode effect re-runs, component re-renders, and language store updates do not cause duplicate speech.
    - Initial render with `open: false` is completely silent.
    - Silent close (`handleClose(true)`, such as opening the Teacher Editor) remains silent.
    - All other behavior (focus handling, preset selection, switch toggles, 48×48 px targets) remains completely preserved.

## Files Changed
1. `frontend/src/components/LabSettings.tsx`:
   - Imported `getLang` and `LANG_BCP47` from `../i18n`.
   - Updated `LabSettingsProps` so `speak` accepts `(text: string, lang?: string) => void`.
   - Added `hasSpokenClose` ref alongside `wasOpen`.
   - Updated `doSpeak` to default its language parameter to `LANG_BCP47[getLang()] ?? 'en-IN'` and pass it to `speak(text, lang)` or `drivers.speech.speak(text, lang)`.
   - Updated `handleClose` to speak `t('lab.settings.closed')` once when not silent (`silent !== true`) and guard with `hasSpokenClose.current = true`.
   - Updated `useEffect` on `[open]` to speak `t('lab.settings.opened')` once when opening (`open && !wasOpen.current`), and speak `t('lab.settings.closed')` once when closing (`!open && wasOpen.current && !hasSpokenClose.current`).

## Tests Added
1. `frontend/tests/lab.settingsSpeech.test.tsx` (new, 12 test cases):
   - `no speech on first render with open false`: Verifies initial render with `open: false` triggers zero speech calls.
   - `opening speaks opened once`: Verifies opening the sheet triggers `drivers.speech.speak("Lab settings opened", "en-IN")` exactly once.
   - `closing by the close button speaks closed once`: Verifies clicking the close button (`.gt-lab-settings__close`) speaks `"Lab settings closed"` once.
   - `closing by scrim click speaks closed once`: Verifies clicking the backdrop overlay (`.gt-lab-settings__backdrop`) speaks `"Lab settings closed"` once.
   - `closing by Escape speaks closed once`: Verifies dispatching an Escape keydown event speaks `"Lab settings closed"` once.
   - `opening twice speaks twice in total`: Verifies opening, closing, and re-opening speaks `"Lab settings opened"` exactly twice in total.
   - `closing by open prop becoming false directly (Android Back / parent update) speaks closed once`: Verifies external dismissal without invoking `handleClose` speaks `"Lab settings closed"` once.
   - `speaks through explicit speak prop when provided`: Verifies custom `speak` callback prop receives the text and language arguments instead of `drivers.speech.speak`.
   - `does not double speech when wrapped in React StrictMode`: Verifies React StrictMode double effect runs do not produce duplicate speech.
   - `does not speak when sheet is closed silently (handleClose(true))`: Verifies navigating to Teacher Editor via `handleClose(true)` produces no close speech.
   - `does not re-speak open or close when re-rendered with open true (e.g. language change)`: Verifies updating language while open does not trigger open or close speech.
   - `speaks in Hindi with hi-IN language code and localized strings`: Verifies Hindi strings (`'लैब सेटिंग्स खुली'`, `'लैब सेटिंग्स बंद'`) and `'hi-IN'` language code.
   - `speaks in Gujarati with gu-IN language code and localized strings`: Verifies Gujarati strings (`'લેબ સેટિંગ્સ ખુલી'`, `'લેબ સેટિંગ્સ બંધ'`) and `'gu-IN'` language code.

## Verification & Guardrails
- **No Kiro-owned files edited**: Only `frontend/src/components/LabSettings.tsx` and `frontend/tests/lab.settingsSpeech.test.tsx` (new) were touched in `frontend/`.
- **No Shell Commands Run**: Under UX rules for Antigravity in headless runs, zero shell commands were executed; all gate validation is run by the orchestrator.
- **Touch Targets Preserved**: All buttons remain >= 48×48 px (`min-width: 48px`, `min-height: 48px`).
- **Focus Management Intact**: Close button / dialog container focus on open and triggerRef / previouslyFocusedElement focus on close are preserved without modification.

## What Could Not Be Verified
- Under headless run rules, automated shell execution (npm, playwright, vitest) is handled exclusively by the orchestrator gates. All React component lifecycle transitions, event handlers, ref guards, and speech arguments were analytically verified against the design constraints, i18n tables, and test harness specifications.
