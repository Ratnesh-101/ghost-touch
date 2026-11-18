/**
 * Pure overview generator for DiagramScene on Explore entry and 'describe' voice command.
 *
 * Output per scene kind:
 * - geometry: title; "N corners, M sides"; then up to 6 labelled corners with their coarse position
 *   from getCoarsePosition ("A top left, B bottom right, C bottom left").
 * - function_graph: title; number of curves; where the axes are in coarse words.
 * - bar_chart: title; "N bars, left to right: Q1, Q2, ..." (up to 8 labels, sorted by x0).
 * - unknown / Raw Mode: return an empty string (the Raw Mode announcement stays as it is).
 *
 * Keeps total length under 40 words. Never reads coordinates as numbers.
 * Pure core/flow: no React, no DOM or browser APIs.
 */

import type { DiagramScene, Point } from '../core/scene';
import { speakableName } from '../core/speakable';
import { getCoarsePosition } from './commands';
import { joinAnnouncements } from './explore';
import { localizedSceneKind } from './navigation';
import { t, tf } from '../i18n';

function resolveTitle(scene: DiagramScene, titleOverride?: string): string {
  if (typeof titleOverride === 'string' && titleOverride.trim() !== '') {
    return titleOverride.trim();
  }
  const rawTitle = scene.title;
  if (typeof rawTitle === 'string' && rawTitle.trim() !== '') {
    return rawTitle.trim();
  }
  return localizedSceneKind(scene.kind);
}

function getPointLabel(p: Point): string | null {
  return speakableName(p.label ?? undefined, p.id);
}

function buildGeometryOverview(scene: DiagramScene, title: string): string {
  const points = scene.points ?? [];
  const segments = scene.segments ?? [];
  const cornersCount = points.length;
  const sidesCount = segments.length;

  const cornersStr =
    cornersCount === 1
      ? tf('overview.geometry.corners_one', { count: '1' })
      : tf('overview.geometry.corners_other', { count: String(cornersCount) });

  const sidesStr =
    sidesCount === 1
      ? tf('overview.geometry.sides_one', { count: '1' })
      : tf('overview.geometry.sides_other', { count: String(sidesCount) });

  const summary = tf('overview.geometry.summary', {
    corners: cornersStr,
    sides: sidesStr,
  });

  const labelled: { label: string; x: number; y: number }[] = [];
  for (const p of points) {
    const lbl = getPointLabel(p);
    if (lbl) {
      labelled.push({ label: lbl, x: p.x, y: p.y });
    }
  }

  const top6 = labelled.slice(0, 6);
  const cornerItems = top6.map((p) => {
    const pos = getCoarsePosition({ x: p.x, y: p.y });
    return tf('overview.geometry.cornerItem', { label: p.label, pos });
  });

  const cornersList = cornerItems.join(', ');

  const parts = [title, summary];
  if (cornersList.length > 0) {
    parts.push(cornersList);
  }
  return joinAnnouncements(parts);
}

function buildFunctionGraphOverview(scene: DiagramScene, title: string): string {
  const polylines = scene.polylines ?? [];
  const curvesCount = polylines.length;

  const curvesStr =
    curvesCount === 1
      ? tf('overview.function.curves_one', { count: '1' })
      : tf('overview.function.curves_other', { count: String(curvesCount) });

  let axesDesc = '';
  const axes = scene.axes;
  if (axes) {
    const hasX = axes.x_axis_y != null;
    const hasY = axes.y_axis_x != null;
    if (hasX && hasY) {
      const xPos = getCoarsePosition({ x: 0.5, y: axes.x_axis_y! });
      const yPos = getCoarsePosition({ x: axes.y_axis_x!, y: 0.5 });
      axesDesc = tf('overview.axes.both', { xPos, yPos });
    } else if (hasX) {
      const xPos = getCoarsePosition({ x: 0.5, y: axes.x_axis_y! });
      axesDesc = tf('overview.axes.xOnly', { xPos });
    } else if (hasY) {
      const yPos = getCoarsePosition({ x: axes.y_axis_x!, y: 0.5 });
      axesDesc = tf('overview.axes.yOnly', { yPos });
    } else {
      axesDesc = t('overview.axes.none');
    }
  } else {
    axesDesc = t('overview.axes.none');
  }

  return joinAnnouncements([title, curvesStr, axesDesc]);
}

function buildBarChartOverview(scene: DiagramScene, title: string): string {
  const bars = scene.bars ?? [];
  const count = bars.length;

  if (count === 0) {
    const noneStr = t('overview.bars.none');
    return joinAnnouncements([title, noneStr]);
  }

  const sorted = [...bars].sort((a, b) => a.x0 - b.x0);
  const top8 = sorted.slice(0, 8);
  const labels = top8
    .map((b) => speakableName(b.label, b.id))
    .filter((l): l is string => Boolean(l));

  let barsStr = '';
  if (labels.length > 0) {
    const labelsFormatted = labels.join(', ');
    barsStr =
      count === 1
        ? tf('overview.bars.summary_one', { count: '1', labels: labelsFormatted })
        : tf('overview.bars.summary_other', { count: String(count), labels: labelsFormatted });
  } else {
    barsStr =
      count === 1
        ? tf('overview.bars.count_one', { count: '1' })
        : tf('overview.bars.count_other', { count: String(count) });
  }

  return joinAnnouncements([title, barsStr]);
}

export function buildOverview(scene: DiagramScene, titleOverride?: string): string {
  if (!scene || scene.kind === 'unknown') {
    return '';
  }

  const title = resolveTitle(scene, titleOverride);

  switch (scene.kind) {
    case 'geometry':
      return buildGeometryOverview(scene, title);
    case 'function_graph':
      return buildFunctionGraphOverview(scene, title);
    case 'bar_chart':
      return buildBarChartOverview(scene, title);
    default:
      return '';
  }
}
