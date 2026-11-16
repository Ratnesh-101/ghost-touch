# Lane hb1 Report: Debug Heartbeat Candidates Test Bench

**Builder:** Antigravity (agy) — Lane `hb1`  
**Date:** 2026-11-16  
**Status:** Completed and verified  

---

## 1. Executive Summary

Implemented the heartbeat corner candidate test bench on the hidden `#/debug` screen. This test bench allows the project owner to feel candidate "heartbeat" corner patterns on the phone (OnePlus Nord CE6, Chrome on Android) and evaluate them against line buzz, corner entry pulses, and long holds before tuning or adopting any pattern in `Explore`.

All logic in `flow/heartbeatDemo.ts` is pure data and helpers with no browser APIs, marked with the exact header `"PROPOSED test values, not tuned, not used by Explore"`. `Explore.tsx` and `core/` files were untouched.

---

## 2. Files Changed

### New Files
1. [frontend/src/flow/heartbeatDemo.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hb1/frontend/src/flow/heartbeatDemo.ts)
   - Header: `// PROPOSED test values, not tuned, not used by Explore`
   - Exports `HEARTBEAT_CANDIDATES` with all 6 candidates (H1 to H6), their patterns, periods, and i18n name keys.
   - Exports `DEMO_PERIODS_MS = [700, 900, 1100]`.
   - Exports `DEMO_REPEAT_MAX_MS = 10000`.
   - Pure helper `patternDurationMs(pattern: readonly number[]): number`.

2. [frontend/tests/heartbeatDemo.test.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hb1/frontend/tests/heartbeatDemo.test.ts)
   - 10 automated test suites covering fake timers, fake `VibrateHost`, pure helpers, lifecycle events, resting pad gestures, and i18n keys across English, Hindi, and Gujarati.

3. [docs/reports/agy-hb1-debug-heartbeat-report.md](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hb1/docs/reports/agy-hb1-debug-heartbeat-report.md)
   - This handoff report.

### Modified Files
4. [frontend/src/screens/Debug.tsx](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hb1/frontend/src/screens/Debug.tsx)
   - Added `DebugProps` interface (`{ drivers?: Drivers }`) for clean test injection with fake drivers.
   - Added Heartbeat test bench section below existing controls.
   - For each candidate: "Once" and "Repeat" buttons using `AccessibleButton`.
   - Period selector buttons (700, 900, 1100 ms) with dynamic `aria-pressed` state (defaults to candidate's own period until selected).
   - "Line buzz 2 s" demo: vibrates `DEFAULT_HAPTICS.lineMs` every `DEFAULT_HAPTICS.retriggerMs` for 2 s, then `vibrate(0)`.
   - "Line, then corner" demo: 1 s of line buzz, corner pattern, then one period later starts "Repeat" for the selected candidate.
   - Resting pad: large button (160 × 160 px minimum target, `touch-action: none`, accessible name) firing corner pattern on `pointerdown`, one beat every period starting one period after down, and `vibrate(0)` on `pointerup`, `pointercancel`, `lostpointercapture`, or boundary leave.
   - Lifecycle cleanup: window `blur`, `document.visibilitychange` to hidden, and component unmount all clear active timers and call `drivers.haptics.stop()`.
   - Stop button integration: the existing "Stop vibration" button clears all new section timers as well.
   - Live status message: updates on every beat with `vibrate(...) returned true/false` using the existing format.

5. [frontend/src/i18n/index.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hb1/frontend/src/i18n/index.ts)
   - Added 14 new keys under `debug.*` in English (`en`), Hindi (`hi`), and Gujarati (`gu`):
     - `debug.hbTitle`
     - `debug.hbH1`, `debug.hbH2`, `debug.hbH3`, `debug.hbH4`, `debug.hbH5`, `debug.hbH6`
     - `debug.btnOnce`, `debug.btnRepeat`
     - `debug.hbPeriod`
     - `debug.btnLine2s`, `debug.btnLineThenCorner`
     - `debug.restingPad`, `debug.restingPadHint`

6. [frontend/src/styles/global.css](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hb1/frontend/src/styles/global.css)
   - Added styles for `.gt-debug__section`, `.gt-debug__subtitle`, `.gt-debug__candidates`, `.gt-debug__candidate`, `.gt-debug__candidate--selected`, `.gt-debug__period-group`, `.gt-debug__period-btn`, `.gt-debug__sequence-row`, and `.gt-debug__pad` (enforcing `min-width: 160px; min-height: 160px; touch-action: none;`).

---

## 3. Tests Added

All tests are implemented in [frontend/tests/heartbeatDemo.test.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hb1/frontend/tests/heartbeatDemo.test.ts):

| Test Case | Description | Pass Verification |
|---|---|---|
| Pure constants & helpers | Validates H1–H6 specs, `DEMO_PERIODS_MS`, `DEMO_REPEAT_MAX_MS`, and `patternDurationMs` | Confirms durations and candidate configurations match specifications |
| "Repeat" timing & stop | Calls H1 pattern `[50, 90, 50]` at $t=0$, $900$, $1800\text{ ms}$, and stops cleanly before or at $10\text{ s}$ | Fake timers advance through $10\text{ s}$; confirms no vibration calls fire after $10\text{ s}$ |
| Resting pad interaction | Sends `cornerPattern` on `pointerdown`, one beat of selected candidate one period later, and `vibrate(0)` on `pointerup` with no calls after | Validates down, period delay, up cancel, and total silence afterwards |
| Demo mutual exclusion | Starting a second demo cancels the running interval of the first | Running H1 repeat then clicking H2 repeat cancels H1 interval immediately |
| Clean unmount | Unmounting component clears all active interval and timeout timers | `vi.getTimerCount()` drops from $>0$ to $0$ on `root.unmount()` |
| i18n completeness | All 14 new keys exist and are non-blank across `en`, `hi`, and `gu` | Validates every key across all three supported locales |
| Line buzz 2 s | Vibrates `DEFAULT_HAPTICS.lineMs` every `retriggerMs` for $2\text{ s}$, then `vibrate(0)` | Confirms line buzz pacing and final stop |
| Line, then corner | 1 s line buzz $\rightarrow$ corner pulse $\rightarrow$ 1 period later starts Repeat | Sequence and timing transitions verified |
| Period selector `aria-pressed` | Selected period has `aria-pressed="true"`, others `"false"`; updates on click | Accessibility state verified |
| Existing Stop button | Clears new heartbeat timers in addition to stopping vibration | Confirms zero timer leaks on Stop button |
| Resting pad dimensions | Validates `min-width: 160px`, `min-height: 160px`, `touch-action: none` | Inline & CSS properties checked |

---

## 4. Anything Unsure / Deviations

1. **Missing `docs/reports/fable-heartbeat-plan.md` on disk:**
   The file `docs/reports/fable-heartbeat-plan.md` referenced in the prompt did not exist in the working tree for `gt-lane-hb1` (likely created in another lane or pending a git merge). All requirements, candidate definitions, periods, and the evaluation checklist were reconstructed and documented directly from the task prompt and steering documentation (`.kiro/steering/tech.md`).
2. **Candidate H2 Period:**
   Candidate H2 is defined with `periodMs: 800` (while H1/H3 are 900 ms, H4/H5 are 1000 ms, H6 is 1100 ms). When the period selector override is clicked (700, 900, 1100 ms), the chosen period overrides the candidate default. If no period selector override has been chosen yet, H2 runs at its own 800 ms default as specified.
3. **Resting Pad Bounds Detection:**
   In real browser environments, sliding off the pad triggers the boundary check via `clientX/Y` and `getBoundingClientRect()`, terminating vibration immediately. In headless unit testing where bounding rects report 0 width/height, the component safely avoids false boundary exits and responds to `pointerup` and `pointercancel`.

---

## 5. Owner Checklist: Hardware Evaluation (Plan Section d)

Below is the phone evaluation checklist for the repository owner to execute on hardware:

### Environment Setup
- [ ] Device: OnePlus Nord CE6 (or target Android device).
- [ ] Browser: Google Chrome on Android.
- [ ] URL: `https://<deployed-url>/#/debug` (or local dev over HTTPS).
- [ ] System settings check: Sound & Vibration $\rightarrow$ Vibration & Haptics $\rightarrow$ Touch feedback enabled, battery saver disabled.

### Candidate Comparison Checklist
- [ ] **1. Individual Feel (Once & Repeat):**
  - [ ] **H1** (`[50, 90, 50]` ms, $900\text{ ms}$): Test Once and Repeat. Note sharpness and double-tap sensation.
  - [ ] **H2** (`[40, 60, 40]` ms, $800\text{ ms}$): Test Once and Repeat. Note lighter, crisper tap feel.
  - [ ] **H3** (`[30, 70, 60]` ms, $900\text{ ms}$): Test Once and Repeat. Note soft rise cadence.
  - [ ] **H4** (`[60, 80, 40]` ms, $1000\text{ ms}$): Test Once and Repeat. Note heavy leading pulse.
  - [ ] **H5** (`[40, 120, 80]` ms, $1000\text{ ms}$): Test Once and Repeat (classic prototype heartbeat).
  - [ ] **H6** (`[70, 110, 70]` ms, $1100\text{ ms}$): Test Once and Repeat. Note deep thump sensation.

- [ ] **2. Period Selection:**
  - [ ] Test preferred candidate at $700\text{ ms}$ (brisk/alert cadence).
  - [ ] Test preferred candidate at $900\text{ ms}$ (moderate resting cadence).
  - [ ] Test preferred candidate at $1100\text{ ms}$ (calm/slow resting cadence).

- [ ] **3. Contrast with Line Buzz:**
  - [ ] Press **"Line buzz 2 s"**: Feel the continuous line buzz ($80\text{ ms}$ on, $70\text{ ms}$ retrigger).
  - [ ] Verify that candidate heartbeat pulses feel distinctly different from the line buzz.

- [ ] **4. Transition Sequence:**
  - [ ] Press **"Line, then corner"**: Feel continuous line buzz for $1\text{ s}$, followed by the corner entry pulse, followed one period later by the candidate repeat.
  - [ ] Check whether the transition feels natural as if sliding along a line and arriving at a vertex.

- [ ] **5. Resting Pad Evaluation:**
  - [ ] Touch and hold the **Resting pad** ($160 \times 160\text{ px}$ target).
  - [ ] Verify initial corner pulse fires immediately on touch down.
  - [ ] Verify candidate heartbeat pulses every period while finger remains held.
  - [ ] Lift finger: verify vibration stops immediately with no trailing pulses.
  - [ ] Slide finger off pad box: verify vibration stops immediately upon leaving boundary.

- [ ] **6. Interruptibility & Safety:**
  - [ ] Start Repeat, switch browser tabs: verify vibration stops immediately.
  - [ ] Start Repeat, minimize Chrome: verify vibration stops immediately.
  - [ ] Press existing "Stop vibration" button during any demo: verify all timers and vibration stop.

- [ ] **7. Decision Record:**
  - [ ] Preferred candidate ID: `[ H1 / H2 / H3 / H4 / H5 / H6 ]`
  - [ ] Preferred resting period: `[ 700 ms / 900 ms / 1100 ms / custom ]`
  - [ ] Ready to promote to `core/hapticEngine.ts` tuned vocabulary: `[ YES / NO ]`
