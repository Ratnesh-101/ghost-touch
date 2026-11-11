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
 */
export function buildA11yFeatures(
  scene: DiagramScene,
  maxFeatures: number = MAX_A11Y_FEATURES,
): A11yFeature[] {
  const out: A11yFeature[] = [];
  const points = scene.points ?? [];
  const byId = new Map(points.map((p) => [p.id, p]));
  const nameOf = (id: string): string => {
    const p = byId.get(id);
    return p?.label && p.label.trim() !== '' ? p.label : id;
  };

  for (const p of points) {
    if (out.length >= maxFeatures) return out;
    const name = nameOf(p.id);
    out.push({
      key: `point-${p.id}`,
      kind: 'point',
      label: tf('a11y.corner', { name }),
      target: { kind: 'vertex', id: p.id, label: p.label ?? undefined },
      yNorm: p.y,
      ...boxOf([p.x], [p.y]),
    });
  }

  for (const s of scene.segments ?? []) {
    if (out.length >= maxFeatures) return out;
    const a = byId.get(s.a);
    const b = byId.get(s.b);
    if (!a || !b) continue;
    const name = s.label && s.label.trim() !== '' ? s.label : `${nameOf(s.a)}${nameOf(s.b)}`;
    out.push({
      key: `segment-${s.id}`,
      kind: 'segment',
      label: tf('a11y.side', { name }),
      target: { kind: 'line', id: s.id, elementKind: 'segment' },
      yNorm: (a.y + b.y) / 2,
      ...boxOf([a.x, b.x], [a.y, b.y]),
    });
  }

  const finiteValues = (scene.bars ?? []).map((b) => b.value).filter((v) => Number.isFinite(v));
  const maxValue = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
  for (const bar of scene.bars ?? []) {
    if (out.length >= maxFeatures) return out;
    out.push({
      key: `bar-${bar.id}`,
      kind: 'bar',
      label: tf('a11y.bar', { label: bar.label, value: String(bar.value) }),
      target: { kind: 'bar', id: bar.id, label: bar.label, value: bar.value, maxValue },
      yNorm: bar.y_top,
      ...boxOf([bar.x0, bar.x1], [bar.y_top, bar.y_base]),
    });
  }

  for (const poly of scene.polylines ?? []) {
    if (out.length >= maxFeatures) return out;
    if (poly.points.length === 0) continue;
    const xs = poly.points.map((pt) => Number(pt[0]));
    const ys = poly.points.map((pt) => Number(pt[1]));
    const name = poly.label && poly.label.trim() !== '' ? poly.label : poly.id;
    out.push({
      key: `polyline-${poly.id}`,
      kind: 'polyline',
      label: tf('a11y.curve', { name }),
      target: { kind: 'line', id: poly.id, elementKind: 'polyline' },
      yNorm: ys.reduce((sum, y) => sum + y, 0) / ys.length,
      ...boxOf(xs, ys),
    });
  }

  if (scene.axes?.x_axis_y != null && out.length < maxFeatures) {
    out.push({
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

  if (scene.axes?.y_axis_x != null && out.length < maxFeatures) {
    out.push({
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

  return out;
}
