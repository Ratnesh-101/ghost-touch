# Task 94 follow-up: inset viewport in walk anchors and e2e helpers (Kiro)

## Cause A (real bug, fixed)
`core/walkAnchor.ts` `isAnchorReachable` built its viewport with `makeViewport(scale, scale)`.
Explore draws and hit-tests with `makeInsetViewport` (task 94, 24 px inset). A Walk/Planchette spot
was therefore checked for reachability on a different mapping from the one a finger meets.
Fix: `makeInsetViewport(scale, scale)`; file stays pure. `REACH_SCALES` (200, 360, 600) are canvas sides and are unchanged.

Other Explore-side consumers checked, no change needed (they take the `Viewport` they are given, from `viewportRef`):
`flow/explore.ts` (`hitTest`, `toNorm`, `view.scale`), `flow/commands.ts` (`toScreen`, `view.offsetX/Y/scale`), `Explore.tsx` (`toNorm`, `whereAmI`).
`Correct.tsx`, `TeachCanvas.tsx` keep `makeViewport` on purpose.

Test: `tests/walkAnchor.prop.test.ts`
- existing P170 cases now use `makeInsetViewport`;
- new property (400 runs): the Explore mapping is written out independently from the task 94 formula; the anchor screen position equals `toScreen` under `makeInsetViewport`, and `isAnchorReachable(blocked, peak, [side])` equals a direct `hitTest` under that mapping, for sides 40 to 900 and a blocking point up to 0.2 away;
- pinned example: a point 0.13 above the peak at side 200 blocks the peak (15.2 px inset; 26 px under the full mapping, which would not block).
- Mutation check: putting `makeViewport` back in `walkAnchor.ts` fails both new tests. Restored.

## Cause B (stale tests, fixed)
`toPage` in `e2e/support/phoneSpies.ts` now uses the inset mapping (side = min(w, h); inset = min(24, side/4); scale = side - 2*inset; centred).
The local copies in `build`, `explore.help-fixes`, `explore.help-highlight`, `explore.raw-guide`, `explore.walk-speech`, `explore.walk` specs were deleted and replaced by `import { toPage } from './support/phoneSpies'`. No assertion changed.
`build.spec.ts`: its `toPage` targets `canvas.gt-explore__canvas`, which in Feel mode is the unchanged Explore screen (`Build.tsx` mounts `Explore`), so it uses the inset mapping too.
Left alone: `phone-test-emulated-2.spec.ts` line 176 (Correct canvas, full mapping).

## Results
- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 270 files passed, 3449 tests passed, 1 todo.
- `npx playwright test --reporter=line`: 220 passed, 0 failed (output in `docs/kiro-evidence/b-inset-playwright.txt`).

## Open, not changed
`Build.tsx` `feelSmall` check uses the canvas side (`min(w, h)`) against `pinSpacingOk` (352). Explore now draws the graph 48 px smaller, so pin spacing on screen is smaller than that check assumes. Needs a decision on whether the threshold should use `side - 48`.

No commits made.
