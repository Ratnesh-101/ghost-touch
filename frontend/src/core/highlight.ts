/**
 * "Show me" highlight (Requirement 49): which drawn element the finger is on.
 *
 * Pure: type imports only, no DOM, React or browser API. The screen passes the same target it
 * gives the haptic engine and draws the answer thicker and brighter. Nothing here changes what
 * is felt or said.
 *
 * Total: any hit (including junk) and any scene (including missing arrays) give a Highlight.
 * An id is returned only when an element of the matching kind in the scene has it. Lookups are
 * plain loops, so an id such as `__proto__` is just a string.
 */

import type { Target } from './hitTest';
import type { DiagramScene } from './scene';

export type HighlightKind = 'vertex' | 'segment' | 'polyline' | 'axis' | 'bar' | 'none';

export interface Highlight {
  kind: HighlightKind;
  id: string | null;
}

function none(): Highlight {
  return { kind: 'none', id: null };
}

function hasId(list: unknown, id: string): boolean {
  if (!Array.isArray(list)) return false;
  for (let i = 0; i < list.length; i += 1) {
    const el: unknown = list[i];
    if (typeof el === 'object' && el !== null && (el as { id?: unknown }).id === id) return true;
  }
  return false;
}

function axisIsSet(scene: DiagramScene, id: string): boolean {
  const axes: unknown = (scene as { axes?: unknown }).axes;
  if (typeof axes !== 'object' || axes === null) return false;
  const a = axes as { x_axis_y?: unknown; y_axis_x?: unknown };
  if (id === 'x-axis') return typeof a.x_axis_y === 'number';
  if (id === 'y-axis') return typeof a.y_axis_x === 'number';
  return false;
}

/** The element under the finger, or `none`. Never throws; never returns an id absent from `scene`. */
export function highlightFor(hit: Target | null | undefined, scene: DiagramScene): Highlight {
  if (typeof hit !== 'object' || hit === null || typeof scene !== 'object' || scene === null) {
    return none();
  }
  const h = hit as { kind?: unknown; id?: unknown; elementKind?: unknown };
  if (typeof h.id !== 'string') return none();
  const id = h.id;
  const s = scene as unknown as Record<string, unknown>;

  if (h.kind === 'vertex') {
    return hasId(s.points, id) ? { kind: 'vertex', id } : none();
  }
  if (h.kind === 'bar') {
    return hasId(s.bars, id) ? { kind: 'bar', id } : none();
  }
  if (h.kind === 'line') {
    switch (h.elementKind) {
      case 'segment':
        return hasId(s.segments, id) ? { kind: 'segment', id } : none();
      case 'polyline':
        return hasId(s.polylines, id) ? { kind: 'polyline', id } : none();
      case 'axis':
        return axisIsSet(scene, id) ? { kind: 'axis', id } : none();
      case 'bar-edge':
        return hasId(s.bars, id) ? { kind: 'bar', id } : none();
      default:
        return none();
    }
  }
  return none();
}
