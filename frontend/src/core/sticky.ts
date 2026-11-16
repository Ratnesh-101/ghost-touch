/**
 * Sticky line following (Requirement 33, task 58). Optional, OFF by default, phone-untested.
 *
 * Pure core (tech.md rule 1): no DOM, React, browser API, audio, speech or timer, and no state.
 * The caller measures how long the same line has been the target (`heldMs`) and feeds the target
 * it followed back in as `prevTarget`; a lift is `{ kind: 'none' }`.
 *
 * `followTarget` returns what `hitTest` returns, with one exception: when `hitTest` finds
 * nothing (or only a bar interior) and the finger is still within `stickyRadiusPx` of the line
 * that has been held for at least `STICKY_HOLD_MS`, the held line stays the target. A vertex or a
 * line that `hitTest` reports always wins, so acquisition keeps the normal line radius and
 * Requirement 4.6 (vertex beats line) and 5.5 (curve beats axis) are untouched.
 *
 * "Within the sticky radius" is asked of `hitTest` itself, on a reduced scene that holds only the
 * held element, so no second distance routine exists that could drift from the real one.
 *
 * Both numbers are PROPOSED, pending owner approval and a phone test (tech.md).
 */

import type { ScreenPoint, Viewport } from './geometry';
import { hitTest } from './hitTest';
import type { Radii, Target } from './hitTest';
import type { DiagramScene } from './scene';

/** Proposed: how long a line must have been the target before it can stick. */
export const STICKY_HOLD_MS = 200;

/** Proposed: how far from the held line (CSS px) the finger may drift and keep it. */
export const STICKY_RADIUS_PX = 24;

type LineTarget = Extract<Target, { kind: 'line' }>;

/**
 * The scene reduced to the elements of one held line. Points stay for segments only; the caller
 * gives `hitTest` a vertex radius of -1, so a point can never be reported.
 */
function reduceToHeld(scene: DiagramScene, held: LineTarget): DiagramScene {
  const id = held.id;
  const only = <T extends { id: string }>(items: readonly T[] | undefined): T[] =>
    Array.isArray(items) ? items.filter((e) => e.id === id) : [];
  const axes = scene.axes ?? null;
  let reducedAxes: DiagramScene['axes'] = null;
  if (held.elementKind === 'axis' && axes !== null && typeof axes === 'object') {
    if (id === 'x-axis') reducedAxes = { x_axis_y: axes.x_axis_y ?? null, y_axis_x: null };
    else if (id === 'y-axis') reducedAxes = { x_axis_y: null, y_axis_x: axes.y_axis_x ?? null };
  }
  return {
    ...scene,
    points: held.elementKind === 'segment' && Array.isArray(scene.points) ? scene.points : [],
    segments: held.elementKind === 'segment' ? only(scene.segments) : [],
    polylines: held.elementKind === 'polyline' ? only(scene.polylines) : [],
    bars: held.elementKind === 'bar-edge' ? only(scene.bars) : [],
    axes: reducedAxes,
  };
}

/**
 * The target to follow: `hitTest`'s answer, or the held line when it sticks (Requirement 33).
 *
 * @param prevTarget     the target followed on the previous move (`{ kind: 'none' }` after a lift)
 * @param heldMs         how long that same line has been the target without a break
 * @param stickyRadiusPx finite and larger than `radii.line` to switch the feature on
 */
export function followTarget(
  prevTarget: Target,
  heldMs: number,
  scene: DiagramScene,
  finger: ScreenPoint,
  view: Viewport,
  radii: Radii,
  stickyRadiusPx: number,
): Target {
  const base = hitTest(scene, finger, view, radii);
  if (base.kind === 'vertex' || base.kind === 'line') return base;
  if (prevTarget.kind !== 'line') return base;
  if (!Number.isFinite(heldMs) || heldMs < STICKY_HOLD_MS) return base;
  if (!Number.isFinite(stickyRadiusPx) || !(stickyRadiusPx > radii.line)) return base;

  const reduced = hitTest(reduceToHeld(scene, prevTarget), finger, view, {
    vertex: -1,
    line: stickyRadiusPx,
  });
  if (
    reduced.kind === 'line' &&
    reduced.id === prevTarget.id &&
    reduced.elementKind === prevTarget.elementKind
  ) {
    return { kind: 'line', id: prevTarget.id, elementKind: prevTarget.elementKind };
  }
  return base;
}
