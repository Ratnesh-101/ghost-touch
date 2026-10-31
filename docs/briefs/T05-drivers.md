# T05 — Browser drivers

Builder: Antigravity | Reviewer: Claude Code (Kiro paused) | Planner: Claude Code
Spec: `.kiro/specs/ghost-touch/tasks.md` Task 5 (5.1–5.3) | Requirements: 1.2, 1.3, 5.3, 7.1
Depends on: T1 (scaffold) and the `Effect` type and `DEFAULT_HAPTICS` from T4 (`frontend/src/core/hapticEngine.ts`, Kiro-owned). **Kiro is paused and T4 does not exist, so do not wait: follow `AGENTS.md` rule 3.** Create `frontend/src/_temp/hapticTypes.stub.ts` (first line `// TEMP-STUB: replaced by core/hapticEngine.ts (Task 4, Kiro). Do not extend.`) exporting exactly the `design.md` shapes:
```ts
export type Effect =
  | { kind: 'vibrate'; pattern: number | number[] }
  | { kind: 'speak'; text: string }
  | { kind: 'tone'; hz: number | null };
export interface HapticConfig { lineMs: number; retriggerMs: number; cornerPattern: number[]; quietMs: number; vertexRadius: number; lineRadius: number; }
export const DEFAULT_HAPTICS: HapticConfig = { lineMs: 80, retriggerMs: 70, cornerPattern: [50, 90, 50], quietMs: 450, vertexRadius: 22, lineRadius: 14 };
```
Import them in only two places (`drivers/index.ts`, `screens/Debug.tsx`) so Kiro's swap is two import lines. Register the stub in `docs/handoffs/KIRO-PAUSE.md`. The stub holds types and the `tech.md` constants only; no engine logic.

## Read first
1. `.kiro/steering/tech.md` (architecture rules, tuned haptic values)
2. `.kiro/specs/ghost-touch/design.md` → "Frontend drivers" and the `Input`/`Effect` types
3. `prototypes/haptics-test.html` — reference behaviour for vibrate, oscillator and speech. Port it, don't redesign it.

## Goal
Thin wrappers over the browser APIs, plus `runEffects`, plus a hidden `/debug` page to prove it works on the phone. No decision logic here; the engine decides, drivers only execute.

## Files you own (create)
- `frontend/src/_temp/hapticTypes.stub.ts` (TEMP stub, see above)
- `frontend/src/drivers/haptics.ts`
- `frontend/src/drivers/audio.ts`
- `frontend/src/drivers/speech.ts`
- `frontend/src/drivers/index.ts` (exports + `runEffects`)
- `frontend/src/screens/Debug.tsx`
- a small hook in `frontend/src/App.tsx` to render `Debug` (see below)
- unit tests in `frontend/tests/drivers.*.test.ts` using fake/mocked browser objects

## Files you must NOT edit
`frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**`. If core needs a change, list it under "Needs from Kiro" in your report.

## Spec

### 5.1 `haptics.ts`
```ts
export interface HapticDriver {
  readonly supported: boolean;
  readonly lastResult: boolean | null;   // last navigator.vibrate return, for the debug overlay
  vibrate(pattern: number | number[]): boolean;
  stop(): void;                          // vibrate(0)
}
export class WebHapticDriver implements HapticDriver { ... }
```
- `supported = typeof navigator !== 'undefined' && 'vibrate' in navigator`.
- Unsupported → `vibrate` returns `false` and never throws.
- Do not change pattern values. They arrive via effects from the engine.

### 5.2 `audio.ts`
```ts
export interface AudioDriver {
  unlock(): void;                        // create/resume AudioContext + the single oscillator, on a user gesture
  setTone(hz: number | null): void;
}
```
- One sine oscillator created on `unlock`, started once, never recreated.
- Non-null hz: `osc.frequency.setTargetAtTime(hz, now, 0.02)` and `gain.gain.setTargetAtTime(0.15, now, 0.02)`.
- Null: `gain.gain.setTargetAtTime(0, now, 0.03)`. The tone must be inaudible within 100 ms (Req 5.3). Note this in a code comment, with the maths.
- `setTone` before `unlock` is a safe no-op.
- Add `beep(hz, ms)`, a short one-shot (separate oscillator, auto-stopped), for the T06 progress tone and listening tone. Must not disturb the main oscillator.

### 5.3 `speech.ts`
```ts
export interface SpeechDriver {
  speak(text: string, lang?: string): void;       // cancels any previous utterance first; rate 1.1
  listen(lang?: string): Promise<string>;         // webkitSpeechRecognition, 6000 ms timeout
  readonly canListen: boolean;
}
```
- `speak`: `speechSynthesis.cancel()` then speak. If `speechSynthesis` is missing, no-op.
- `listen`: wraps `SpeechRecognition || webkitSpeechRecognition`, single result, `interimResults=false`. Rejects with a typed `Error` whose `message` is one of `'unsupported' | 'timeout' | 'no-speech' | 'denied'`. Must stop the recogniser on timeout and never leave it running.
- Default `lang` = `'en-IN'`. Accept any BCP-47 string (Hindi/Gujarati arrive in T12).

### `index.ts`
```ts
export interface Drivers { haptics: HapticDriver; audio: AudioDriver; speech: SpeechDriver; }
export function createBrowserDrivers(): Drivers;
export function runEffects(effects: readonly Effect[], drivers: Drivers, lang?: string): void;
```
- `runEffects` maps: `vibrate` → `haptics.vibrate`, `speak` → `speech.speak(text, lang)`, `tone` → `audio.setTone`.
- It is pure dispatch. No state, no timers, no `if` on engine rules.
- Exhaustive `switch` with a `never` check on `Effect['kind']`.

### `/debug` route (DoD item)
No router dependency exists and **adding one needs the user's approval**. Use `window.location.hash === '#/debug'` in `App.tsx` to render `<Debug />` instead of the normal app. `Debug.tsx`:
- Shows `Vibration API: supported/NOT supported`, the AudioContext state, whether speech synthesis and recognition exist.
- Shows `vibrate(<pattern>) returned <bool>` after every press.
- Buttons (all `AccessibleButton`, ≥48×48 px) ported from the prototype: line 80, corner `[50,90,50]`, stop, tone low/high/off, speak sample, listen. First tap anywhere calls `audio.unlock()`.
- Take the pattern numbers from `DEFAULT_HAPTICS` (the TEMP stub for now); don't hardcode second copies.
- Strings through `frontend/src/i18n/` (`t()`); the debug page may use English only.

## Architecture rules (reviewer will check)
- Browser APIs (`navigator`, `window`, `AudioContext`, `speechSynthesis`, `SpeechRecognition`) appear **only** in `frontend/src/drivers/` (the `#/debug` hash check in `App.tsx` is the single allowed exception, and nothing else in `screens/`).
- No `any`. `strict` stays on. Named exports only.
- No new npm dependencies.
- No `console.log`.

## Definition of Done
- [ ] `cd frontend && npm test` passes, new driver tests included.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds.
- [ ] Unit tests cover: unsupported vibrate returns false; `runEffects` dispatches each effect kind to the right driver; `speak` cancels before speaking; `listen` rejects `timeout` after 6 s (fake timers) and stops the recogniser; `setTone(null)` before `unlock` doesn't throw.
- [ ] `grep -rn "navigator\|AudioContext\|speechSynthesis" frontend/src --include=*.ts --include=*.tsx` hits only `drivers/` (plus the one hash check noted above).
- [ ] `#/debug` renders, shows support status, and each button fires its pattern (verify on the Nord CE6 over HTTPS; record results).
- [ ] No edits to files outside "Files you own".

## Report
Write `docs/handoffs/T05-report.md` **last** (then tell Claude Code "review T05"; Kiro's review hook is dormant while Kiro is paused): files changed, commands run with results, phone test results, deviations from this brief, "Needs from Kiro". Also add an entry to `docs/BUILD_LOG.md` with tool = Antigravity.

Do not tick checkboxes in `tasks.md`; Kiro does that. Do not commit or push.
