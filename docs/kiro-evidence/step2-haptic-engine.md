# Step 2 & 3 evidence: haptic engine (T4) and property tests P3–P7

## What the spec said
design.md §"Frontend core":
```
step(state, input, cfg) -> { state, effects }
```
Engine rules 1–6 (design.md):
1. New vertex → vibrate(cornerPattern), speak(label), tone(null); quietUntil = t + quietMs
2. Same vertex → no effects
3. On a line, t ≥ quietUntil, t − lastBuzz > retriggerMs → vibrate(lineMs)
4. On a curve → tone(pitchForY(yNorm))
5. Leave all lines → vibrate(0) if t ≥ quietUntil; tone(null)
6. Lift → vibrate(0), tone(null); reset state

tech.md locked values: lineMs 80, retriggerMs 70, cornerPattern [50,90,50],
quietMs 450, vertexRadius 22, lineRadius 14.

pitch.ts: pitchForY(0) = 1000 Hz, pitchForY(1) = 200 Hz. Range [200, 1000].

## What was built
| File | Content |
|---|---|
| `frontend/src/core/hapticEngine.ts` | Full state machine with all 6 rules, DEFAULT_HAPTICS matching tech.md exactly, bar hit logic (speak once, tone by value), `initialState()`. |
| `frontend/src/core/pitch.ts` | `pitchForY` (monotonic, clamped 200–1000, non-finite → 200), `pitchForValue`. |
| `frontend/tests/hapticEngine.prop.test.ts` | P3, P4, P5, P6 (each 200 runs) + scripted triangle trace. |
| `frontend/tests/pitch.prop.test.ts` | P7 (monotonic, bounded, strict for well-separated values) + P11 (bar pitch order). |

## Which tests caught what
- **P3 corner never merged**: caught a missing `Array.isArray` check during development — the guard `t < quietUntil` needs to track corner pattern emission independently (not re-read engine state after the step).
- **P4 no repeated corner**: verifies the `lastVertexId` guard is correct for all vertex ids.
- **P5 continuous buzz**: non-vacuous form (requires ≥ 2 buzzes) caught an off-by-one in the retrigger check during prototype iterations.
- **P6 lift silences**: quick but critical — ensures the lift branch always emits both effects.
- **P7 pitch monotonic**: strictly decreasing for separation ≥ 1e-4; catches any accidental rounding in the linear map.

## Verification
`npx vitest run` — 249 tests, 25 files, all green.
Explore screen imports `step`, `initialState`, `DEFAULT_HAPTICS` from
`../flow/explore` → `../core/hapticEngine` directly; no TEMP stubs remain.
