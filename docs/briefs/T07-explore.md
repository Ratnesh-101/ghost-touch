# T07 — Explore screen (relative cursor, works with TalkBack on and off)

Builder: Antigravity (Claude Code is the stand-in when the owner is away) | Reviewer: Claude Code (Kiro paused) | Planner: Claude Code
Spec: `.kiro/specs/ghost-touch/tasks.md` Task 7 (7.1 to 7.5) | Requirements: 4.*, 5.*, 6.*, 12.3, and the new Requirement 13 draft in `docs/kiro-evidence/spec-change-req13.md`
Depends on: T05 drivers, T06 screens (done), the real `core/geometry.ts`, `core/hitTest.ts`, `core/scene.ts` (exist), and the haptic engine and pitch from T04 (**Kiro-owned, not built yet**). Kiro is paused, so follow `AGENTS.md` rule 3 and create TEMP stubs, listed below. Do not wait.

## Read first
1. `docs/research/talkback-spike.md` (Gate A result: what the gesture does, what is still unconfirmed)
2. `.kiro/steering/tech.md` (tuned haptic values; pure-core rule), `.kiro/specs/ghost-touch/design.md` (Input/Effect types, engine rules 1 to 6)
3. `prototypes/haptics-test.html` — `handle()` and the pointer wiring are the reference behaviour on a phone with TalkBack off.
4. `frontend/src/screens/ExploreStub.tsx`, `frontend/src/App.tsx`, `frontend/src/flow/*.ts`, `frontend/src/drivers/*`.

## The fact this design rests on (Gate A, A1 passes)
With TalkBack on, the pass-through gesture (double-tap, hold on the second tap, then drag without lifting) delivers pointer events to the page, and the phone vibrates when the cursor crosses a line. TalkBack starts the **virtual finger at the centre of the focused element**, and movement is **relative**. The same gesture is an ordinary touch with TalkBack off. So:
- one gesture is announced for everyone, and **one code path** serves both modes: the cursor is simply the pointer position the browser gives us;
- we do not try to detect TalkBack (there is no reliable API for it);
- with TalkBack off, a direct touch anywhere also works.

## Behaviour

### Entry (7.4, Requirement 13)
- App speaks, in one utterance, inside the tap that opens Explore: **"Double-tap and hold, then drag to feel the diagram. You start at the centre."** For a Raw Mode scene, prefix the exact Raw Mode sentence from Requirement 8.1: "I couldn't fully read this diagram. You can still feel its outlines." Then add the scene name. All text through `t()` (new keys).
- Move focus to the Explore canvas element (`tabIndex={0}`, `role="img"` with `aria-label` = scene name plus the same gesture hint; do not use `role="application"`, it changes TalkBack's behaviour in ways we have not tested). TalkBack's virtual finger starts at the centre of the focused element, so the canvas must be the focused element and must fill the area (centre of the canvas = centre of the diagram, because the unit square is letterboxed to the centre).
- The visible text mirrors the hint using the existing `StatusText` (aria-hidden when the app speaks it).

### Pointer handling (7.2)
- Canvas: `touch-action: none`; `pointerdown` calls `setPointerCapture`; every `pointermove` feeds the engine. `pointerup` and `pointercancel` send a `lift` (stops motor and tone, resets engine state). `lostpointercapture` also lifts.
- Per move: `target = hitTest(scene, finger, view, DEFAULT_RADII)` using the real `core/hitTest.ts`; `yNorm = toNorm(finger, view).y`; `{state, effects} = step(state, {kind:'move', t: performance.now(), target, yNorm}, cfg)`; `runEffects(effects, drivers)`. Keep `EngineState` in a `useRef`, not React state (no re-render per move). Finger coordinates are relative to the canvas's `getBoundingClientRect()`.
- Use coalesced/high-rate events only if cheap; do **not** throttle: line re-trigger timing lives in the engine.
- Draw the scene (7.1): dark canvas, glowing green strokes (`#39ff88`, line width 4, shadow blur 12) like the prototype, point labels in light text; devicePixelRatio-correct; redraw on resize. Also draw a small cursor dot at the pointer and a faint cross at the centre. These are for sighted observers (demo, teacher) and must not affect the engine.

### Relative cursor: centre tick and re-centre (new)
- **Centre reference tick:** when a hold starts (`pointerdown`) within `CENTRE_RADIUS_PX = 24` of the canvas centre, or whenever the cursor moves **into** that radius from outside, fire the centre tick once (re-arm after the cursor leaves the radius by more than `CENTRE_RADIUS_PX * 1.5`). Pattern: a single `vibrate(25)`. This is a **new pattern, proposed, not yet approved by the owner**: keep it as one named constant `CENTRE_TICK_MS` in `flow/explore.ts`, do not edit `tech.md` or the tuned values, and tell the owner in the report. Never fire it during the corner quiet window.
- **Re-centre on each new hold:** every `pointerdown` starts a fresh engine state (a lift already resets it). With TalkBack the virtual finger is back at the centre automatically; the first `pointerdown` position is logged for the phone test (below).
- First hold per Explore visit only: also speak "Centre." right after the tick (one short word). Later holds: tick only.
- Gain: none. Pointer coordinates are used as delivered. If the owner finds the cursor too slow or fast on the phone, a gain constant is a follow-up, not part of this task.

### Axis crossings and bars (7.3)
- Axis crossing: remember on which side of each axis the cursor was (the axes come from `scene.axes`); speak "x-axis" or "y-axis" once per crossing. This lives in the screen/flow layer, not the engine.
- Bar label and value speech, bar tone, and bar-edge buzz come from the engine and `hitTest`. **Known gap:** the real `hitTest` has no bar-edge hits yet (Kiro to fix). Do not work around it in the screen.

### Exit that works with TalkBack (7.4, Requirement 12.3)
TalkBack uses two-finger swipes itself, so the two-finger swipe cannot be the only exit. Provide all three:
1. **Android Back** (the system Back button or gesture, and TalkBack's own Back gesture, which both end up as browser history navigation). On entering Explore push one history entry (`history.pushState`), and leave Explore on `popstate`. This lives in a small driver (`drivers/navigation.ts`, browser API) with a testable interface: `pushExploreEntry(): void`, `onBack(handler): () => void`. Back from Explore returns to Capture and speaks the Capture prompt (same as the on-screen Back button).
2. **A labelled "Back" button** (`AccessibleButton`, 48×48 px at least) placed **outside** the canvas, reachable by TalkBack swipe navigation and by keyboard.
3. **Two-finger swipe down** (TalkBack off shortcut): with two active pointers both moving down at least 80 px within 600 ms, with little horizontal drift. Pure function in `flow/explore.ts` so it is unit tested. It must never fire during a normal single-finger hold.
Announce on entry only the explore gesture (above) plus "Press Back to leave." in the same utterance; do not add a third sentence.

## TEMP stubs (AGENTS.md rule 3). Register each in `docs/handoffs/KIRO-PAUSE.md`.
Kiro's real modules do not exist yet; create these exactly matching `design.md`, first line `// TEMP-STUB: replaced by core/<file>.ts (Task 4, Kiro). Do not extend.`
- `frontend/src/_temp/hapticEngine.stub.ts`: `EngineState`, `initialState()`, `HapticConfig`/`DEFAULT_HAPTICS` (reuse the T05 stub file, do not duplicate), `Input`, and `step(state, input, cfg)`. Implement engine rules 1 to 6 from `design.md` (a straight port of the prototype's `handle()`, plus bar interior: speak "label, value" once per new bar and tone by value). Use only the tuned values from `tech.md`. No new rules, no tuning.
- `frontend/src/_temp/pitch.stub.ts`: `pitchForY(y) = clamp(1000 - y * 800, 200, 1000)`, `pitchForValue(v, max)` linear from 200 to 1000 (guard `max <= 0`).
- Import them in **one** place each (`flow/explore.ts`), so Kiro's swap is two lines. The stubs get **no property tests**; Kiro's real `step` and P3 to P7 replace them and are the evidence for the write-up. Say so in the report so nobody counts the stub as the haptic engine.

## Files you own
`frontend/src/screens/Explore.tsx` (replaces `ExploreStub.tsx`; delete the stub and its test references only after Explore works, and say so in the report), `frontend/src/flow/explore.ts` (centre tick decision, axis-crossing tracker, two-finger swipe detector, the per-move pipeline), `frontend/src/drivers/navigation.ts`, `frontend/src/_temp/*.stub.ts`, `frontend/src/App.tsx` (wire it), `frontend/src/i18n/index.ts` (new strings), `frontend/src/styles/global.css` (additions), tests in `frontend/tests/`.
Do **not** edit `frontend/src/core/**`, property tests, `schema.py`, `validate.py`, `scene.gen.ts`, `.kiro/**`.

## Rules
Browser APIs only in `drivers/` (history/popstate go in `drivers/navigation.ts`; the canvas `getContext`, pointer events and `getBoundingClientRect` in the screen component are allowed since they are DOM event wiring of the component, but keep every decision in `flow/explore.ts` as pure functions). Every string through `t()`. Every control named and at least 48×48 px. No new dependencies. No `any`, no `console.log`. Do not change the tuned haptic values.

## Definition of Done
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` pass (a flaky Kiro-owned P1 test may fail; confirm it is the only failure).
- [ ] Unit tests for: centre tick fires on a hold at the centre, not on a hold far from it, re-arms only after leaving 1.5× the radius, never during the quiet window; axis-crossing speaks once per crossing in each direction; two-finger swipe detector (fires on a clear two-finger down swipe, not on one finger, not on a slow drag, not on sideways movement); exit via `popstate` and via the Back button both return to Capture and speak the prompt; lift on `pointercancel`; the per-move pipeline calls `step` then `runEffects` with the right `yNorm`.
- [ ] Server-render check: Explore markup has the canvas with `aria-label`, a Back button outside it, and the status text `aria-hidden` when speech is available.
- [ ] **Phone, TalkBack off:** trace all three samples eyes-closed; lines, corners, quiet window and theremin match the prototype.
- [ ] **Phone, TalkBack on:** the entry hint is spoken; double-tap-and-hold then drag vibrates on lines; the centre tick fires on each new hold; Android Back and TalkBack's Back gesture leave Explore; the Back button is reachable by swiping. Record honestly what works and what does not.
- [ ] **Log, for the spike:** on the first `pointerdown`, store its position relative to the canvas centre and show it in `#/debug`-style text (a small hidden status line is enough). Report the numbers: with TalkBack on, is it at the centre? Are later `pointermove` coordinates centre plus movement?
- [ ] Device checklist from `design.md` → Testing Strategy: line vs corner with eyes closed; trace a triangle and name it; follow the sine curve and count peaks; highest bar (if bar edges are fixed).
- [ ] No edits to Kiro-owned files.

## Report
Write `docs/handoffs/T07-report.md` last (then tell Claude Code "review T07"). Include the stub register entries, the centre-tick pattern as a decision for the owner, the first-`pointerdown` measurements, and "Needs from Kiro" (bar edges in `hitTest`, replace the two stubs, P1 flake). Add a `docs/BUILD_LOG.md` entry (tool = Antigravity, or "Claude Code (builder stand-in for agy)"). Do not tick `tasks.md`; do not commit or push.
