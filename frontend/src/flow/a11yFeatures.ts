/**
 * Accessible diagram feature extractor for screen-reader (TalkBack) exploration.
 *
 * Pure helper (no React, no browser APIs).
 * Lists vertices, sides, bars, curves, and axes as focusable features with
 * accessible names and bounding boxes so TalkBack users can explore diagrams
 * feature-by-feature when direct touch gestures are swallowed by Android.
 */

import type { Target } from '../core/hitTest';
import type { DiagramScene } from '../core/scene';
import { t, tf } from '../i18n';

/** Maximum focusable features emitted for a single scene to prevent huge trees. */
export const MAX_A11Y_FEATURES = 60;

/** One screen-reader-reachable feature of the diagram (TalkBack exploration). */
export interface A11yFeature {
  key: string;
  kind: 'point' | 'segment' | 'bar' | 'polyline' | 'axis';
  /** Accessible name; also the sentence spoken on activation. */
  label: string;
  /** What the haptic engine is told is under the "finger". */
  target: Target;
  /** Normalized y used for curve pitch. */
  yNorm: number;
  /** Centre and size of the feature's bounding box, normalized to [0, 1]. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function boxOf(xs: number[], ys: number[]): Pick<A11yFeature, 'cx' | 'cy' | 'w' | 'h'> {
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

/**
 * Lists every vertex, side, bar, curve and axis of a scene as an accessible feature.
 * Capped to maxFeatures (default MAX_A11Y_FEATURES = 60) so complex scenes do not
 * create an unwieldy accessibility tree.
 *
 * Distributes feature share so every kind present (points, segments, bars, curves, axes)
 * is reachable without any one kind (e.g. many points) starving the others.
 */
export function buildA11yFeatures(
  scene: DiagramScene,
  maxFeatures: number = MAX_A11Y_FEATURES,
): A11yFeature[] {
  if (maxFeatures <= 0) return [];

  const rawPoints = scene.points ?? [];
  const points = rawPoints.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const byId = new Map(points.map((p) => [p.id, p]));
  const nameOf = (id: string): string => {
    const p = byId.get(id);
    return p?.label && p.label.trim() !== '' ? p.label : id;
  };

  const pointFeatures: A11yFeature[] = [];
  for (const p of points) {
    const name = nameOf(p.id);
    pointFeatures.push({
      key: `point-${p.id}`,
      kind: 'point',
      label: tf('a11y.corner', { name }),
      target: { kind: 'vertex', id: p.id, label: p.label ?? undefined },
      yNorm: p.y,
      ...boxOf([p.x], [p.y]),
    });
  }

  const segmentFeatures: A11yFeature[] = [];
  for (const s of scene.segments ?? []) {
    const a = byId.get(s.a);
    const b = byId.get(s.b);
    if (!a || !b) continue;
    const name = s.label && s.label.trim() !== '' ? s.label : `${nameOf(s.a)}${nameOf(s.b)}`;
    segmentFeatures.push({
      key: `segment-${s.id}`,
      kind: 'segment',
      label: tf('a11y.side', { name }),
      target: { kind: 'line', id: s.id, elementKind: 'segment' },
      yNorm: (a.y + b.y) / 2,
      ...boxOf([a.x, b.x], [a.y, b.y]),
    });
  }

  const barFeatures: A11yFeature[] = [];
  // CORE-A3: Skip bars with non-finite values (hitTest drops them), never put "NaN" into label/target
  const finiteBars = (scene.bars ?? []).filter(
    (b) =>
      Number.isFinite(b.value) &&
      Number.isFinite(b.x0) &&
      Number.isFinite(b.x1) &&
      Number.isFinite(b.y_top) &&
      Number.isFinite(b.y_base),
  );
  const finiteValues = finiteBars.map((b) => b.value);
  const maxValue = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
  for (const bar of finiteBars) {
    const label = tf('a11y.bar', { label: bar.label, value: String(bar.value) });
    barFeatures.push({
      key: `bar-${bar.id}`,
      kind: 'bar',
      label,
      target: { kind: 'bar', id: bar.id, label: bar.label, value: bar.value, maxValue },
      yNorm: bar.y_top,
      ...boxOf([bar.x0, bar.x1], [bar.y_top, bar.y_base]),
    });
  }

  const polylineFeatures: A11yFeature[] = [];
  for (const poly of scene.polylines ?? []) {
    if (poly.points.length === 0) continue;
    const xs = poly.points.map((pt) => Number(pt[0])).filter((x) => Number.isFinite(x));
    const ys = poly.points.map((pt) => Number(pt[1])).filter((y) => Number.isFinite(y));
    if (xs.length === 0 || ys.length === 0) continue;
    const name = poly.label && poly.label.trim() !== '' ? poly.label : poly.id;
    polylineFeatures.push({
      key: `polyline-${poly.id}`,
      kind: 'polyline',
      label: tf('a11y.curve', { name }),
      target: { kind: 'line', id: poly.id, elementKind: 'polyline' },
      yNorm: ys.reduce((sum, y) => sum + y, 0) / ys.length,
      ...boxOf(xs, ys),
    });
  }

  const axisFeatures: A11yFeature[] = [];
  if (scene.axes?.x_axis_y != null && Number.isFinite(scene.axes.x_axis_y)) {
    axisFeatures.push({
      key: 'axis-x',
      kind: 'axis',
      label: t('explore.xAxis'),
      target: { kind: 'line', id: 'x-axis', elementKind: 'axis' },
      yNorm: scene.axes.x_axis_y,
      cx: 0.5,
      cy: scene.axes.x_axis_y,
      w: 1,
      h: 0,
    });
  }

  if (scene.axes?.y_axis_x != null && Number.isFinite(scene.axes.y_axis_x)) {
    axisFeatures.push({
      key: 'axis-y',
      kind: 'axis',
      label: t('explore.yAxis'),
      target: { kind: 'line', id: 'y-axis', elementKind: 'axis' },
      yNorm: 0.5,
      cx: scene.axes.y_axis_x,
      cy: 0.5,
      w: 0,
      h: 1,
    });
  }

  // CORE-A2: Reserve a share per kind so complex point sets don't starve other features
  const otherCandidates = [segmentFeatures, barFeatures, polylineFeatures, axisFeatures];
  const otherTotal = otherCandidates.reduce((sum, g) => sum + g.length, 0);

  if (otherTotal === 0) {
    return pointFeatures.slice(0, maxFeatures);
  }

  const pointQuota =
    pointFeatures.length > 0
      ? Math.min(pointFeatures.length, Math.floor(maxFeatures / 2))
      : 0;

  let remaining = maxFeatures - pointQuota;
  const activeOtherGroups = otherCandidates.filter((g) => g.length > 0);
  const allocated = new Map<A11yFeature[], number>();
  for (const g of activeOtherGroups) allocated.set(g, 0);

  while (remaining > 0) {
    const needed = activeOtherGroups.filter((g) => (allocated.get(g) ?? 0) < g.length);
    if (needed.length === 0) break;
    const share = Math.max(1, Math.floor(remaining / needed.length));
    let progress = false;
    for (const g of needed) {
      const current = allocated.get(g) ?? 0;
      const canTake = Math.min(g.length - current, share, remaining);
      if (canTake > 0) {
        allocated.set(g, current + canTake);
        remaining -= canTake;
        progress = true;
        if (remaining === 0) break;
      }
    }
    if (!progress) break;
  }

  const out: A11yFeature[] = [];
  if (pointQuota > 0) {
    out.push(...pointFeatures.slice(0, pointQuota));
  }
  for (const g of activeOtherGroups) {
    const count = allocated.get(g) ?? 0;
    if (count > 0) {
      out.push(...g.slice(0, count));
    }
  }

  return out;
}
