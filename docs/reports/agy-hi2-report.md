# Lane hi2 Report: Teacher Guide and Deploy Docs

**Lane**: `hi2` (not EX)  
**Task**: I21 remainder — Teacher guide, deploy documentation, phone test alignment, and README link.  
**Tool**: Antigravity (`agy`)  
**Date**: 2026-11-20  

---

## 1. Files Changed

1. **`docs/TEACHER_GUIDE.md`** (NEW):
   - Comprehensive, one-page, plain-language 3-step guide for teachers given the live app link.
   - Grounded completely in the verified codebase: Step 1 (Turn Teacher tools ON in Settings, take photo, check by touch); Step 2 (Correct mistakes with Correct screen, save, and optionally verify & share link/QR via Teacher Editor); Step 3 (Turn Teacher tools OFF so Correct is hidden, hand phone to student).
   - Includes full disclosures on what AI vision can get wrong, data privacy flows (photos sent to third-party AI vision providers, no server disk storage, linked to `docs/PRIVACY.md`), and an honest acknowledgment that Guide and Share are untested on physical phones.

2. **`docs/DEPLOY.md`**:
   - Updated frontend environment variables section (Step 2, item 5) to document `VITE_FEATURE_SHARE` and `VITE_FEATURE_GUIDE` with exact value `1` and unambiguous descriptions of their purpose.
   - Removed any ambiguity, ensuring exactly one clean definition without duplicate entries or contradictions across the document.

3. **`docs/PHONE_TEST.md`**:
   - Added a prerequisite note to Step 11 ("Teacher Correct Mode") explicitly noting that "Teacher tools" (`lab.settings.teacher`) must be set to ON in Lab Settings (and `VITE_FEATURE_SHARE=1`), otherwise the Correct button is hidden on Explore (Requirement 48).
   - Updated Step 11.1 instruction row to confirm Teacher tools is ON before tapping the Correct button.

4. **`README.md`**:
   - Added exactly one link line under the Deployment section linking to `docs/TEACHER_GUIDE.md`:
     `See [docs/TEACHER_GUIDE.md](docs/TEACHER_GUIDE.md) for the three-step teacher guide to preparing, correcting, and sharing diagrams.`
   - Changed nothing else.

---

## 2. Tests Added

- **None** (per lane instructions: `hi2` is a documentation and teacher guide lane; code changes are prohibited; the code half for Requirement 48 is already implemented and passing).

---

## 3. What Could Not Be Verified

- **Physical Phone Testing of Share and Guide**: As stated honestly in `docs/TEACHER_GUIDE.md`, `README.md`, and `docs/DEPLOY.md`, while the pure core logic and UI components for "Guide my finger" and "Teacher verify & share" pass 100% of unit and property test suites, neither feature has yet been validated on a physical Android mobile device under real-world touch or TalkBack conditions.
- **Headless Shell Constraints**: Per headless runner rules, no shell commands (npm, pytest, git, etc.) were executed during this turn; all verification was conducted statically against source files.

---

## 4. Verification Register: Claims in the Teacher Guide and Source Files

Every single claim, control name, translation key, and behavior described in `docs/TEACHER_GUIDE.md` is cross-referenced with its exact source file below:

| # | Claim in Teacher Guide | Source File & Location | Verification / Code Invariant |
|---|---|---|---|
| 1 | Target environment is Android Chrome over HTTPS | `frontend/src/i18n/index.ts:88-90, 114-115`<br>`docs/DEPLOY.md:215-219` | `start.noVibration` and `common.vibrationUnsupported` announce requirement for Chrome on Android over HTTPS for Vibration API. |
| 2 | Guide and Share ship in app but are untested on a physical phone | `docs/DEPLOY.md:248, 269`<br>`README.md:44-45, 171` | Explicit honest status maintained across repo: unit/property tested, physical phone test pending. |
| 3 | Photos sent over HTTPS to third-party AI vision providers (Gemini, OpenAI, Nebius) | `backend/app/vision/chain.py:40-120`<br>`frontend/src/api/scene.ts:40-80`<br>`docs/PRIVACY.md:46, 59-71` | `send_scene_request` posts image to `/api/v1/scene`; backend dispatches to configured provider chain. |
| 4 | Photos not kept on server or disk; RAM scene cache has 6-hour TTL / 64 entry cap | `backend/app/scene_cache.py:20-60`<br>`docs/PRIVACY.md:46, 96-105, 227-229` | `SceneCache` stores only parsed `DiagramScene` JSON; raw image bytes are discarded after request; 64 entries, 21,600 s TTL. |
| 5 | Settings button located in top header toolbar, labeled e.g. "Settings: English, 1.0×" | `frontend/src/screens/Capture.tsx:284-293`<br>`frontend/src/screens/Explore.tsx:2247-2250`<br>`frontend/src/components/SettingsLauncher.tsx:66-86` | `AccessibleButton` displays `describeSettings(currentLang, activeRate)`; class `.gt-capture__button--settings` / `.gt-settings-launcher__button`. |
| 6 | "More settings" toggle button in Lab Settings sheet | `frontend/src/components/LabSettings.tsx:485-504`<br>`frontend/src/i18n/index.ts:498` | Button `aria-expanded={moreOpen}` toggles `#lab-settings-more-content` and speaks `t('lab.settings.moreSettingsExpanded')` / `Collapsed`. |
| 7 | "Teacher tools" toggle switch and spoken confirmations | `frontend/src/components/LabSettings.tsx:828-864`<br>`frontend/src/i18n/index.ts:383-386` | Toggle switch `role="switch"` speaks `t('lab.settings.teacherOn')` (*"Teacher tools enabled."*) or `t('lab.settings.teacherOff')` (*"Teacher tools disabled."*). |
| 8 | Feature flag `VITE_FEATURE_SHARE=1` gates Teacher tools visibility | `frontend/src/config/features.ts:41-43, 50-52`<br>`frontend/src/flow/teach.ts:71-73`<br>`frontend/src/components/LabSettings.tsx:828` | `isShareEnvOn()` checks `import.meta.env.VITE_FEATURE_SHARE === '1'`. In `LabSettings.tsx`, Teacher tools is wrapped in `{isShareEnvOn() && ...}`. |
| 9 | Feature flag `VITE_FEATURE_GUIDE=1` gates "Guide my finger" visibility | `frontend/src/config/features.ts:37-39, 46-48`<br>`frontend/src/components/LabSettings.tsx:788` | `isGuideEnvOn()` checks `import.meta.env.VITE_FEATURE_GUIDE === '1'`. "Guide my finger" in `LabSettings.tsx` is wrapped in `{isGuideEnvOn() && ...}`. |
| 10 | Camera photo capture via `<input capture="environment">` and file upload | `frontend/src/screens/Capture.tsx:315-330, 370-388`<br>`frontend/src/i18n/index.ts:63-64` | `capture.takePhoto` launches environment camera; `capture.chooseImage` accepts JPEG, PNG, WebP, and PDF. |
| 11 | Progress tone and spoken status during capture | `frontend/src/screens/Capture.tsx:301-309`<br>`frontend/src/i18n/index.ts:66`<br>`frontend/src/drivers/audio.ts:70-80` | Announces `t('capture.reading')` (*"Reading your diagram"*) with periodic 1.5 s progress audio beeps (`audio.beep(440, 120)`). |
| 12 | Explore line vibration (`vibrate(80)` every 70 ms) | `frontend/src/flow/explore.ts:DEFAULT_HAPTICS`<br>`frontend/src/drivers/haptics.ts:15-35`<br>`README.md:37, 56` | Continuous line tracing vibration pattern `vibrate(80)` retriggered every 70 ms within 14 CSS px radius. |
| 13 | Explore corner double pulse (`[50, 90, 50]` ms) and 450 ms line buzz suppression | `frontend/src/flow/explore.ts:DEFAULT_HAPTICS`<br>`frontend/src/core/hapticEngine.ts:25-35`<br>`README.md:38, 58` | Hitting vertex triggers `vibrate([50, 90, 50])`, speaks vertex name, and enforces 450 ms line buzz suppression quiet window. |
| 14 | Explore function graph curve pitch (200–1000 Hz) | `frontend/src/core/pitch.ts:10-40`<br>`frontend/src/drivers/audio.ts:40-60`<br>`README.md:39, 59` | Web Audio continuous sine wave pitch mapped to normalized y-coordinate between 200 Hz and 1000 Hz. |
| 15 | AI fallback to Raw Mode (Canny edge detection) on timeout or provider error | `backend/app/vision/chain.py:90-140`<br>`backend/app/raw_mode.py:20-60`<br>`frontend/src/screens/Explore.tsx:2267-2272`<br>`frontend/src/i18n/index.ts:83, 317` | Sets `mode: 'raw'`, speaks `t('raw.announce')` (*"I couldn't fully read this diagram. You can still feel its outlines."*), and shows notice `t('lab.raw.notice')`. |
| 16 | Correct button conditionally rendered on Explore (Requirement 48) | `frontend/src/App.tsx:779`<br>`frontend/src/screens/Explore.tsx:2410-2418` | In `App.tsx`: `onCorrect={isTeacherActive() ? handleCorrect : undefined}`. In `Explore.tsx`: `{onCorrect && <AccessibleButton ...>{t('explore.correct')}</AccessibleButton>}`. |
| 17 | Teacher Correction screen intro and photo underlay with scrim | `frontend/src/screens/Correct.tsx:1-12, 137-138`<br>`frontend/src/i18n/index.ts:137-138` | Displays photo underlay with 40% contrast scrim. Speaks `t('correct.intro')` (*"Correction mode. Tap elements to select, drag points to adjust, and save when done."*). |
| 18 | Teacher Correction dragging, labeling, deleting, undo/redo | `frontend/src/screens/Correct.tsx:320-410`<br>`frontend/src/i18n/index.ts:139-150` | Handles point dragging (`t('correct.pointMoved')`), label editing (`t('correct.applyLabel')`), deletion (`t('correct.delete')`), and undo/redo (`correct.undo` / `correct.redo`). |
| 19 | Correct screen Save and validation against `POST /api/v1/validate` | `frontend/src/screens/Correct.tsx:92-150`<br>`frontend/src/api/validate.ts:20-50`<br>`backend/app/validate.py:15-60`<br>`frontend/src/i18n/index.ts:152-154` | `executeCorrectSave` sends `POST /api/v1/validate` to backend (or checks local invariants offline). On success speaks `t('correct.saved')` (*"Corrections saved."*). |
| 20 | "Open Teacher Editor" in Settings navigates to `#/teach` | `frontend/src/components/LabSettings.tsx:865-885`<br>`frontend/src/drivers/hashRoute.ts:25-35`<br>`frontend/src/App.tsx:273-276, 394-403` | Button sets `window.location.hash = TEACH_HASH` (`#/teach`). `App.tsx` routes to `Teach` screen only if `isTeachHash(hash) && isTeacherActive()`. |
| 21 | Teacher verification form: name ($\le 60$), note ($\le 280$), "Ready to share" | `frontend/src/flow/teach.ts:248-271`<br>`frontend/src/share/index.ts:LIMITS`<br>`frontend/src/screens/Teach.tsx:552-583`<br>`frontend/src/i18n/index.ts:423-428` | Name required $\le 60$ chars (`LIMITS.maxName`); note optional $\le 280$ chars (`LIMITS.maxNote`). Button "Ready to share" (`teach.markVerified`). |
| 22 | Share payload compressed to URL hash `#s=...` and QR code | `frontend/src/share/codec.ts:15-40`<br>`frontend/src/screens/Teach.tsx:552-583`<br>`frontend/src/share/index.ts:qrDataUrl` | Encodes payload via `LZString.compressToEncodedURIComponent` into `#s=...`. If length $\le 2000$ chars, `qrDataUrl` renders on-screen QR code. |
| 23 | Turning Teacher tools OFF hides Correct button on Explore (Requirement 48) | `frontend/src/App.tsx:779`<br>`frontend/src/flow/teach.ts:71-73`<br>`frontend/src/components/LabSettings.tsx:238-244` | Toggling teacher setting OFF sets `gt_teacher_enabled` to `'false'`. `isTeacherActive()` evaluates to `false`. `onCorrect` becomes `undefined` and Correct button is omitted from DOM. |
| 24 | TalkBack pass-through gesture (double-tap-and-hold then drag) | `frontend/src/screens/Explore.tsx:51-60, 2333-2338`<br>`frontend/src/i18n/index.ts:117-120`<br>`README.md:40, 60` | TalkBack pass-through exploration gesture. Delivers 25 ms centre tick (`vibrate(25)`) and speaks `t('explore.centre')` (*"Centre."*). |
| 25 | Student opening shared link opens Share Gate | `frontend/src/components/ShareGate.tsx:1-67`<br>`frontend/src/App.tsx:277-283, 602-609`<br>`frontend/src/i18n/index.ts:371-375` | Opening `#s=...` renders `ShareGate` with button `t('share.gate.open')` (*"Open the shared diagram"*). Tapping unlocks audio and opens Explore with banner `t('share.sharedBy')` (*"Shared by {name}, not checked"*). |
