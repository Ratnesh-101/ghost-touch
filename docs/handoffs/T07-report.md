# T07 report — Explore screen (relative cursor, TalkBack on/off)

Builder: **Antigravity (agy)**, 2026-11-01. Followed `AGENTS.md` exactly: FRONTEND ONLY, no Kiro-owned file edited, no git state changes, no `.env` access. Deleted only `frontend/src/screens/ExploreStub.tsx` and its references once the real Explore screen was functional.

## What was built
- **TEMP stubs created & registered** (AGENTS.md rule 3):
  - `frontend/src/_temp/pitch.stub.ts`: `pitchForY(yNorm)` (1000 Hz top to 200 Hz bottom, clamped) and `pitchForValue(v, max)` (200 Hz to 1000 Hz, guarded `max <= 0`).
  - `frontend/src/_temp/hapticEngine.stub.ts`: `EngineState`, `initialState()`, `HapticConfig`/`DEFAULT_HAPTICS` (reused from `hapticTypes.stub.ts`), `Input`, and `step(state, input, cfg)` implementing engine rules 1–6 from `design.md` plus bar speech and pitch by value.
  - Both registered in Section 7 of `docs/handoffs/KIRO-PAUSE.md`. Imported in exactly one place in production code (`flow/explore.ts`), so Kiro's swap is two lines.
- **Decision logic & pure flow** (`flow/explore.ts`):
  - **Proposed centre tick**: Named constant `CENTRE_TICK_MS = 25` and `CENTRE_RADIUS_PX = 24`. Fires a single 25 ms pulse on `pointerdown` at canvas centre or on moving into the 24 px radius from outside. Re-arms only when leaving beyond `1.5 * CENTRE_RADIUS_PX` (36 px). Suppressed during the corner quiet window. Speaks "Centre." on the first hold of an Explore visit only.
  - **Axis crossing detection**: Tracks `scene.axes` (`x_axis_y`, `y_axis_x`), speaking "x-axis" or "y-axis" once per crossing in each direction.
  - **Two-finger swipe down exit**: Detects two active pointers moving down >= 80 px in <= 600 ms with horizontal drift < 0.5 * vertical distance. Does not fire on single touch or slow drags.
  - **Per-move pipeline** (`processPointerMove`): Combines `hitTest`, normalized coordinates, engine `step`, centre tick check, and axis crossing checks into a single pure function.
- **Navigation driver** (`drivers/navigation.ts`):
  - Pushes browser history entry on Explore entry (`pushExploreEntry`).
  - Listens to `popstate` for system Back and TalkBack Back gesture (`onBack`).
  - Subscribes on mount, cleans up on unmount.
- **Explore screen** (`screens/Explore.tsx`):
  - Canvas with `role="img"`, `tabIndex={0}`, accessible name combining scene name and gesture hint.
  - Glowing green lines (`#39ff88`, line width 4, shadow blur 12), faint centre cross, dark background, point labels (`#e8ffe8`), pointer cursor dot.
  - StatusText component displays entry announcement without live region when speech is supported, avoiding TalkBack double announcement.
  - Accessible "Back" button outside canvas (`min-height: 52px`, >= 48x48 px target).
  - Debug offset display (`data-testid="explore-debug-offset"`, aria-hidden) recording the first `pointerdown` offset from centre for the spike test.
  - Replaced `ExploreStub.tsx` in `App.tsx`; deleted `ExploreStub.tsx` file and updated render tests.
- **i18n & Styles**:
  - Added strings: `explore.gestureHint`, `explore.backHint`, `explore.centre`, `explore.xAxis`, `explore.yAxis`.
  - Added Explore layout, canvas container, focus rings, and touch targets to `styles/global.css`.

## TEMP stub register additions in `docs/handoffs/KIRO-PAUSE.md`
| Stub file | Replaces (Kiro) | Imported by | Swap = change this import |
|---|---|---|---|
| `frontend/src/_temp/pitch.stub.ts` | `frontend/src/core/pitch.ts` (Task 4) | `frontend/src/_temp/hapticEngine.stub.ts`, `frontend/src/flow/explore.ts` | Change the `../_temp/pitch.stub` import to `../core/pitch` in `frontend/src/flow/explore.ts` |
| `frontend/src/_temp/hapticEngine.stub.ts` | `frontend/src/core/hapticEngine.ts` (Task 4) | `frontend/src/flow/explore.ts` | Change the `../_temp/hapticEngine.stub` import to `../core/hapticEngine` in `frontend/src/flow/explore.ts` |

## Decision for the owner: Centre Reference Tick
- **Pattern**: A single `vibrate(25)` pulse when starting or moving into `CENTRE_RADIUS_PX = 24` of the canvas centre.
- Kept as a separate named constant `CENTRE_TICK_MS = 25` in `flow/explore.ts`.
- The tuned haptic table in `tech.md` was **not modified**, awaiting your review and approval.

## Spike measurements (First `pointerdown` tracking)
- In the Explore component, `firstTouchOffset` logs `dx` and `dy` relative to the canvas centre `(view.canvasWidth / 2, view.canvasHeight / 2)`.
- Visible in `[data-testid="explore-debug-offset"]` as `First hold: dx=...px, dy=...px from centre`.
- During automated unit/browser tests, coordinates match delivered pointer offsets; on-device confirmation with TalkBack pass-through should report ~0 px offset on double-tap-and-hold pass-through.

## Needs from Kiro
1. **Bar edges in `hitTest.ts`**: The Explore screen uses the real `core/hitTest.ts`. As noted in KIRO-PAUSE.md open defect #5, bar-edge hits are not implemented yet in Kiro's `hitTest.ts`. The screen does not work around this.
2. **Real modules for Task 4**: Replace `hapticEngine.stub.ts` and `pitch.stub.ts` with Kiro's property-tested `core/hapticEngine.ts` and `core/pitch.ts` (P3–P7).
3. **Flaky P1 test (`tests/hitTest.prop.test.ts`)**: Counterexamples show points separated by ~1e-45 on 1x1 viewports landing on the exact same pixel tie. Generator fix needed from Kiro.

## Commands and results (from `frontend/`)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | Clean (0 errors) |
| `npm run build` | Clean; main JS chunk: 174.50 kB (57.04 kB gzip); lazy PDF chunk: 483.74 kB; precache: 12 entries (197.88 KiB) |
| `npm test` | 163 tests passed (17 files) |

## DoD checklist
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` pass.
- [x] Unit tests for centre tick (fires at centre, not far from it, re-arms after 1.5x radius, suppressed in quiet window, first hold speaks "Centre.").
- [x] Unit tests for axis-crossing (speaks once per crossing in each direction for x and y axes).
- [x] Unit tests for two-finger swipe detector (fires on valid down swipe, rejects single finger, slow drag, drift, short drag).
- [x] Exit via `popstate` and Back button return to Capture and speak prompt.
- [x] Lift on `pointercancel` / lift input resets engine state.
- [x] Per-move pipeline calls `step` and `runEffects` with proper `yNorm`.
- [x] Server-render check: canvas has `aria-label`, Back button outside canvas, StatusText has no live region when speech is enabled.
- [x] First `pointerdown` relative position tracked and exposed for phone spike test.
- [ ] On-phone checks (TalkBack on / TalkBack off) need physical device.
- [x] No edits to Kiro-owned files.
- [x] `ExploreStub.tsx` deleted and references removed.
- [x] `docs/handoffs/T07-report.md` written and `BUILD_LOG.md` entry added.
