# Antigravity Lane hi19 Report: Wire Held Touch into Explore (Task 89)

## Summary
- **Lane**: hi19 (EX)
- **Goal**: Implement task 89: wire Kiro's held touch into `Explore.tsx`. A stationary finger that rests perfectly still on a wrong part during the Planchette "Your turn" phase was previously never counted as a try, so the answer was never spoken (discovered by the Playwright pass over `docs/PHONE_TEST.md`, row 17.4; finding F3).
- **Solution**:
  - In `frontend/src/screens/Explore.tsx`:
    - Updated `stepWalkTouch(target, finger, view, now, held = false)` to accept an optional 5th parameter `held = false` and pass `held` into `walkStep` as `{ kind: 'touch', t: now, target, finger, view, held }`.
    - In `createHoldKeepAliveTimer`'s `onTick`, replaced the old `{ kind: 'tick', t: now }` call with `stepWalkTouch(moveResult.target, coords, view, now, true)` under the condition `walk !== null && walkRef.current.phase !== 'idle'`.
    - Passed returned `walkLines` from the keep-alive touch to `applyMoveResult` joined with `compassAnnouncements`: `applyMoveResult(moveResult, lang, [], [...compassAnnouncements, ...walkLines], true, coords)`.
    - This joins keep-alive announcements and walk lines into one single utterance (Requirement 17.2, 51.8) and protects the held step sentence from premature lift cutoff via `walkSpeechRef.current = true`.
    - Kept `{ kind: 'tick', t }` in the 5 s walk interval (`startWalkInterval`) and in button/voice handlers for idle-timeout when no finger is down.
    - Preserved all vibration, tone, earcon, and highlight behaviors (W5 remains intact).
  - In `frontend/tests/explore.walk.oracle.test.tsx`:
    - Changed `it.fails` to `it` on oracle W8 ("a still finger resting on a wrong part during Your turn gives the answer after the second rest").
  - In `frontend/tests/explore.walkHeld.test.tsx`:
    - Created unit/integration tests covering:
      1. Still finger on wrong parts twice speaks the answer once (with pointer move to second part, and with lift/down to second part).
      2. Still finger on the right anchor speaks the step once, not repeatedly across keep-alive ticks.
      3. 120 s idle timeout fires even when a stationary finger remains resting (because `held: true` does not refresh `lastActivity`).
  - In `frontend/e2e/explore.walk-held.spec.ts`:
    - Created end-to-end CDP touch spec for triangle sample: steps through the walk, enters "Your turn", rests still for 1.3 s on two wrong sides with zero `touchMove` events, and verifies the spoken answer contains `"It is AB"`.

## Files Changed
1. `frontend/src/screens/Explore.tsx`:
   - `stepWalkTouch` updated to take `held = false` and forward `held` to `walkStep`.
   - `onTick` inside `createHoldKeepAliveTimer` now calls `stepWalkTouch(moveResult.target, coords, view, now, true)` and feeds the resulting lines to `applyMoveResult` via the `compassAnnouncements` parameter.
2. `frontend/tests/explore.walk.oracle.test.tsx`:
   - Updated oracle W8 from `it.fails` to `it`.

## Tests Added
1. `frontend/tests/explore.walkHeld.test.tsx` (new):
   - `still finger on a wrong part twice then the answer is spoken once (with move to second part)`: Verifies resting on CA, moving to BC, and resting on BC with zero moves after touch emits the answer once and doesn't repeat.
   - `still finger on a wrong part twice then the answer is spoken once (with lift and touch)`: Verifies resting on CA, lifting, and resting on BC with zero pointer moves emits the answer once.
   - `a still finger on the right anchor speaks the step once not repeatedly`: Verifies resting on side CA speaks the step sentence once and does not repeat across keep-alive intervals.
   - `the idle end still fires after 120 s even with a finger resting`: Verifies resting on the canvas for >120 s resets the walk to idle, changing the button from `Next step` back to `Walk me through`.
2. `frontend/e2e/explore.walk-held.spec.ts` (new):
   - `a perfectly still finger during Your turn gives the answer after two rests`: Real CDP touch on triangle sample, walk completed to Your turn, 1.3 s rest on each of two wrong sides, and assertion that `spoken` includes `"It is AB"`.

## Verification & Guardrails
- **No Kiro-owned files edited**: `frontend/src/core/**` (including `core/walk.ts`), `tests/*.prop.test.ts`, and `.kiro/**` were untouched.
- **Allowed list respected**: Only `frontend/src/screens/Explore.tsx`, `frontend/tests/explore.walk.oracle.test.tsx`, `frontend/tests/explore.walkHeld.test.tsx`, and `frontend/e2e/explore.walk-held.spec.ts` were touched in `frontend/`.
- **No shell commands executed**: Adhered strictly to UX rules for Antigravity in headless runs. Gate checks are executed by the orchestrator.
- **Accessible controls & touch targets preserved**: No control size or accessible names altered; button minimum dimensions (48×48 px) preserved.
- **No haptic or audio constants altered**: Values in `.kiro/steering/tech.md` untouched.

## What Could Not Be Verified
- Real phone hardware verification (physical vibrator motor, TalkBack double-tap-and-drag gesture, hardware speech synthesizer).
- Shell execution (running `npm --prefix frontend test`, `tsc`, or `playwright`) was not performed per UX instructions prohibiting shell commands; verification relies on static analysis, contract adherence to `core/walk.ts`, and orchestrator gate execution.
