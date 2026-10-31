/**
 * Replays the minimal counterexample of the flaky P1 property test.
 * Run from the frontend folder:  npx vite-node ../docs/kiro-evidence/pbt-p1-replay.ts
 * Not part of the test suite (it lives outside frontend/tests).
 */
import { makeViewport, toScreen } from '../../frontend/src/core/geometry';
import { hitTest, DEFAULT_RADII } from '../../frontend/src/core/hitTest';

// Shrunk by fast-check from seed -732699702 (run 2 in pbt-p1-flake.md).
const points = [
  { id: 'p0', x: 0.9999992847442627, y: 0, label: null },
  { id: 'p1', x: 0.9999992847442627, y: 1.401298464324817e-45, label: null },
];
const view = makeViewport(1, 1.0000001192092896);
const screen = points.map((p) => toScreen({ x: p.x, y: p.y }, view));

console.log('viewport', JSON.stringify(view));
console.log('screen positions', JSON.stringify(screen));
console.log('same pixel:', screen[0]!.x === screen[1]!.x && screen[0]!.y === screen[1]!.y);
points.forEach((p, i) => {
  const result = hitTest({ kind: 'geometry', points, segments: [] }, screen[i]!, view, DEFAULT_RADII);
  console.log(`hitTest at ${p.id} ->`, JSON.stringify(result));
});
