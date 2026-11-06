# Phone Test Checklist (Antigravity Notes)

**Author:** Antigravity (agy), awaiting Kiro review  
**Date:** 2026-11-06  
**Target Hardware:** Physical Android device running Chrome with TalkBack screen reader  
**Purpose:** Isolated device-dependent test procedures for findings that cannot be validated in automated desktop environments.

---

## 1. Finding 6 (HIGH): AudioContext Suspension During Native Camera App Switch

### Background
When a user on Android taps "Take photo" in `Capture.tsx`, Android switches focus to the native camera application (`<input type="file" capture="environment">`). Android Chrome transitions to the background and suspends the Web Audio `AudioContext` (`ctx.state === 'suspended'`). When the user captures a diagram and returns to Chrome, the app navigates to `Explore.tsx`. If `audio.unlock()` or `ctx.resume()` is not invoked on subsequent touch interactions, the `AudioContext` remains suspended, resulting in total silence during tactile diagram exploration (no theremin pitch, no landmark earcons).

### Manual Test Procedure
1. **Device Setup:**
   - Real Android smartphone (e.g. Pixel, Samsung Galaxy, or Xiaomi).
   - Ensure system media volume is at 70% or higher.
   - Launch Ghost Touch in Chrome (`https://ghost-touch-api.onrender.com` or local network IP).
2. **Execution Steps:**
   - Tap anywhere on the Start screen to unlock audio and vibration.
   - On the Capture screen, tap **"Take photo"**.
   - Verify the device launches the native system camera app (confirming backgrounding of Chrome).
   - Take a clear photo of a diagram (or any sample shape) and confirm "OK" / checkmark to return to Chrome.
   - Wait for the diagram to be analyzed and the Explore screen to open.
   - Touch the canvas and drag across a curve or line.
3. **Verification Criterion:**
   - **PASS:** The theremin tone immediately sounds and modulates as the finger moves across curves, and earcons play at vertices.
   - **FAIL:** The canvas produces vibration but complete audio silence until an explicit non-canvas button is tapped.
4. **Remediation Note for Owner:**
   - If audio silence occurs, add `if (this.ctx?.state === 'suspended') { void this.ctx.resume(); }` at the start of `WebAudioDriver.setTone` and `playEarcon`, or call `drivers.audio.unlock()` inside `handlePointerDown` in `Explore.tsx`.

---

## 2. Finding 12 (MEDIUM): Vibration Capability Misreporting on Devices Where `navigator.vibrate` Returns False

### Background
The Web Vibration API may be exposed on `window.navigator` (so `'vibrate' in navigator` and `typeof navigator.vibrate === 'function'` are true), but the actual invocation `navigator.vibrate(...)` returns `false`. This commonly occurs on:
- Android tablets lacking physical vibration motors.
- Phones with "Touch feedback" or system vibration disabled in Android OS Settings.
- Battery saver / low-power mode active.
Currently, `capturePrompt` checks `drivers.haptics.supported` (method presence) rather than inspecting `drivers.haptics.lastResult` from the initial unlock tap. As a result, the required Requirement 1.3 spoken warning ("Vibration is not supported on this device. Audio-only mode.") is omitted, leaving the student expecting vibration and receiving none without explanation.

### Manual Test Procedure
1. **Device Setup:**
   - On an Android phone, navigate to **Settings > Sound & vibration > Touch & haptic feedback** and turn it **OFF** (or test on an Android tablet lacking vibration hardware).
   - Open Ghost Touch in Chrome.
2. **Execution Steps:**
   - On the Start screen ("Ghost Touch. Tap anywhere to begin."), tap the screen once.
   - Listen to the entry announcement on the Capture screen.
3. **Verification Criterion:**
   - **PASS:** The app announces: *"Vibration is not supported on this device. Audio-only mode. Capture a diagram to explore..."* (confirming detection of `lastResult === false`).
   - **FAIL:** The app announces standard capture text without warning that vibration is inoperative, leaving the user unaware of why haptics do not fire in Explore.
4. **Remediation Note for Owner:**
   - In `App.tsx` and `handleStartTap`, condition the audio-only mode announcement on `drivers.haptics.lastResult === false` as well as `!drivers.haptics.supported`.
