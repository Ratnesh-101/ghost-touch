/**
 * Pure flow logic for Ghostwriter (Requirement 20: Teach mode adding of points and edges).
 *
 * Requirements:
 * - Pure flow module: no React, no DOM, no browser API.
 * - Point and segment caps: min(LIMITS.max*, backend MAX_SCENE_*).
 * - Plan add point / plan add segment with ordered validation and no-op reasons.
 * - Describe undo for point/segment additions to speak specific undos.
 * - Mode state machine (idle, addPoint, addEdgeFirst, addEdgeSecond).
 * - Localized speech generation via t() / tf().
 */

import { addPoint, addSegment } from '../core/correct';
import type { DiagramScene, Point, Segment } from '../core/scene';
import { LIMITS } from '../share/limits';
import { t, tf } from '../i18n';

/**
 * Caps for points and segments allowed in Ghostwriter (Teach mode).
 * Point cap is smaller of LIMITS.maxPoints (300) and MAX_SCENE_POINTS (500) from validate.py.
 * Segment cap is smaller of LIMITS.maxSegments (300) and MAX_SCENE_SEGMENTS (1000).
 * Today both caps are 300, governed by sharing limits.
 */
export const GHOSTWRITER_POINT_CAP = Math.min(LIMITS.maxPoints, 500);
export const GHOSTWRITER_SEGMENT_CAP = Math.min(LIMITS.maxSegments, 1000);

export const GHOSTWRITER_KEYS = [
  'teach.addPoint',
  'teach.addPointArmed',
  'teach.pointAddedUnlabelled',
  'teach.pointAddedLabelled',
  'teach.pointLimit',
  'teach.pointBadCoords',
  'teach.addEdge',
  'teach.addEdgeFirst',
  'teach.addEdgeSecond',
  'teach.edgeAdded',
  'teach.edgeSamePoint',
  'teach.edgeAlreadyJoined',
  'teach.edgeUnknownPoint',
  'teach.edgeLimit',
  'teach.addCancelled',
  'teach.undidAddPoint',
  'teach.undidAddEdge',
] as const;

export type GhostwriterKey = (typeof GHOSTWRITER_KEYS)[number];

export type GhostwriterMode =
  | { kind: 'idle' }
  | { kind: 'addPoint' }
  | { kind: 'addEdgeFirst' }
  | { kind: 'addEdgeSecond'; first: string };

export type GhostwriterEvent =
  | { type: 'pressAddPoint' }
  | { type: 'pressAddEdge' }
  | { type: 'canvasTap'; x: number; y: number; pointId?: string }
  | { type: 'pickPoint'; id: string }
  | { type: 'escape' };

export type GhostwriterAction =
  | { kind: 'addPoint'; x: number; y: number }
  | { kind: 'addSegment'; a: string; b: string };

export interface NextModeResult {
  mode: GhostwriterMode;
  speech?: string;
  action?: GhostwriterAction;
}

/**
 * Clean an optional label: trim whitespace, truncate to maxLabel (60),
 * and return undefined if empty or whitespace-only.
 */
export function cleanLabel(label?: string): string | undefined {
  if (label === undefined || label === null) return undefined;
  const trimmed = label.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, LIMITS.maxLabel);
}

export type PlanAddPointOutcome =
  | { kind: 'added'; scene: DiagramScene; id: string; label?: string }
  | { kind: 'limit'; scene: DiagramScene }
  | { kind: 'badCoords'; scene: DiagramScene };

export type PlanAddSegmentOutcome =
  | { kind: 'added'; scene: DiagramScene; id: string; a: string; b: string }
  | { kind: 'samePoint'; scene: DiagramScene; a?: string; b?: string }
  | { kind: 'unknownPoint'; scene: DiagramScene; a?: string; b?: string }
  | { kind: 'alreadyJoined'; scene: DiagramScene; a?: string; b?: string }
  | { kind: 'limit'; scene: DiagramScene; a?: string; b?: string };

export type GhostwriterOutcome = PlanAddPointOutcome | PlanAddSegmentOutcome;

/**
 * Plan adding a point:
 * Checks in order:
 * 1. Non-finite coordinates -> badCoords (same scene)
 * 2. Point count >= cap -> limit (same scene)
 * 3. Otherwise addPoint(scene, x, y, cleanLabel(label)) -> added
 */
export function planAddPoint(
  scene: DiagramScene,
  x: number,
  y: number,
  label?: string,
): PlanAddPointOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { kind: 'badCoords', scene };
  }
  const currentPoints = scene.points ?? [];
  if (currentPoints.length >= GHOSTWRITER_POINT_CAP) {
    return { kind: 'limit', scene };
  }
  const cleaned = cleanLabel(label);
  const nextScene = addPoint(scene, x, y, cleaned);
  const newPoints = nextScene.points ?? [];
  const added = newPoints[newPoints.length - 1]!;
  return {
    kind: 'added',
    scene: nextScene,
    id: added.id,
    ...(added.label ? { label: added.label } : {}),
  };
}

/**
 * Plan adding a segment between two points:
 * Checks in order:
 * 1. a === b -> samePoint (same scene)
 * 2. Either point missing -> unknownPoint (same scene)
 * 3. Segment already exists in either direction -> alreadyJoined (same scene)
 * 4. Segment count >= cap -> limit (same scene)
 * 5. Otherwise addSegment(scene, a, b) -> added
 */
export function planAddSegment(
  scene: DiagramScene,
  a: string,
  b: string,
): PlanAddSegmentOutcome {
  if (a === b) {
    return { kind: 'samePoint', scene, a, b };
  }
  const points = scene.points ?? [];
  const hasA = points.some((p) => p.id === a);
  const hasB = points.some((p) => p.id === b);
  if (!hasA || !hasB) {
    return { kind: 'unknownPoint', scene, a, b };
  }
  const segments = scene.segments ?? [];
  const joined = segments.some(
    (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a),
  );
  if (joined) {
    return { kind: 'alreadyJoined', scene, a, b };
  }
  if (segments.length >= GHOSTWRITER_SEGMENT_CAP) {
    return { kind: 'limit', scene, a, b };
  }
  const nextScene = addSegment(scene, a, b);
  const newSegments = nextScene.segments ?? [];
  const added = newSegments[newSegments.length - 1]!;
  return { kind: 'added', scene: nextScene, id: added.id, a, b };
}

export type UndoDescription =
  | { kind: 'point'; id: string }
  | { kind: 'segment'; a: string; b: string };

function isSamePoint(p1: Point, p2: Point): boolean {
  return (
    p1.id === p2.id &&
    p1.x === p2.x &&
    p1.y === p2.y &&
    p1.label === p2.label
  );
}

function isSameSegment(s1: Segment, s2: Segment): boolean {
  return (
    s1.id === s2.id &&
    s1.a === s2.a &&
    s1.b === s2.b &&
    s1.label === s2.label
  );
}

/**
 * Describe an undo operation:
 * Returns { kind: 'point', id } or { kind: 'segment', a, b } ONLY when
 * `present` is `previous` plus exactly one appended point or segment,
 * with leading elements and all other properties unchanged.
 * Returns undefined for moves, renames, deletes, multiple changes, or missing previous.
 */
export function describeUndo(
  present: DiagramScene,
  previous?: DiagramScene,
): UndoDescription | undefined {
  if (!previous || present === previous) return undefined;

  const prevPoints = previous.points ?? [];
  const presPoints = present.points ?? [];
  const prevSegments = previous.segments ?? [];
  const presSegments = present.segments ?? [];

  if (
    present.title !== previous.title ||
    present.kind !== previous.kind ||
    present.version !== previous.version
  ) {
    return undefined;
  }

  const prevPoly = previous.polylines ?? [];
  const presPoly = present.polylines ?? [];
  if (prevPoly.length !== presPoly.length) return undefined;

  const prevBars = previous.bars ?? [];
  const presBars = present.bars ?? [];
  if (prevBars.length !== presBars.length) return undefined;

  // Case 1: Exactly one point added
  if (
    presPoints.length === prevPoints.length + 1 &&
    presSegments.length === prevSegments.length
  ) {
    for (let i = 0; i < prevSegments.length; i++) {
      if (!isSameSegment(presSegments[i]!, prevSegments[i]!)) return undefined;
    }
    for (let i = 0; i < prevPoints.length; i++) {
      if (!isSamePoint(presPoints[i]!, prevPoints[i]!)) return undefined;
    }
    const addedPoint = presPoints[presPoints.length - 1]!;
    return { kind: 'point', id: addedPoint.id };
  }

  // Case 2: Exactly one segment added
  if (
    presSegments.length === prevSegments.length + 1 &&
    presPoints.length === prevPoints.length
  ) {
    for (let i = 0; i < prevPoints.length; i++) {
      if (!isSamePoint(presPoints[i]!, prevPoints[i]!)) return undefined;
    }
    for (let i = 0; i < prevSegments.length; i++) {
      if (!isSameSegment(presSegments[i]!, prevSegments[i]!)) return undefined;
    }
    const addedSegment = presSegments[presSegments.length - 1]!;
    return { kind: 'segment', a: addedSegment.a, b: addedSegment.b };
  }

  return undefined;
}

/**
 * Generate user-facing speech string for a Ghostwriter outcome using i18n.
 */
export function ghostwriterSpeech(outcome: GhostwriterOutcome): string {
  switch (outcome.kind) {
    case 'added': {
      if ('a' in outcome && 'b' in outcome) {
        return tf('teach.edgeAdded', { a: outcome.a, b: outcome.b });
      }
      if (outcome.label) {
        return tf('teach.pointAddedLabelled', {
          id: outcome.id,
          label: outcome.label,
        });
      }
      const point = tf('vertex.unlabelled', { id: outcome.id });
      return tf('teach.pointAddedUnlabelled', { point });
    }
    case 'limit': {
      if ('a' in outcome || 'b' in outcome) {
        return tf('teach.edgeLimit', {
          max: String(GHOSTWRITER_SEGMENT_CAP),
        });
      }
      return tf('teach.pointLimit', {
        max: String(GHOSTWRITER_POINT_CAP),
      });
    }
    case 'badCoords':
      return t('teach.pointBadCoords');
    case 'samePoint':
      return t('teach.edgeSamePoint');
    case 'alreadyJoined':
      return tf('teach.edgeAlreadyJoined', {
        a: outcome.a ?? '',
        b: outcome.b ?? '',
      });
    case 'unknownPoint':
      return t('teach.edgeUnknownPoint');
  }
}

/**
 * Generate user-facing speech string for an undone addition.
 */
export function undoSpeech(description: UndoDescription): string {
  if (description.kind === 'point') {
    return tf('teach.undidAddPoint', { id: description.id });
  }
  return tf('teach.undidAddEdge', { a: description.a, b: description.b });
}

/**
 * Transition Ghostwriter mode given an incoming event.
 * Encodes 20.2.2, 20.2.3, 20.3.2, 20.3.5.
 */
export function nextMode(
  mode: GhostwriterMode,
  event: GhostwriterEvent,
): NextModeResult {
  switch (mode.kind) {
    case 'idle': {
      if (event.type === 'pressAddPoint') {
        return {
          mode: { kind: 'addPoint' },
          speech: t('teach.addPointArmed'),
        };
      }
      if (event.type === 'pressAddEdge') {
        return {
          mode: { kind: 'addEdgeFirst' },
          speech: t('teach.addEdgeFirst'),
        };
      }
      return { mode };
    }

    case 'addPoint': {
      if (event.type === 'pressAddPoint') {
        return {
          mode: { kind: 'idle' },
          action: { kind: 'addPoint', x: 0.5, y: 0.5 },
        };
      }
      if (event.type === 'canvasTap') {
        return {
          mode: { kind: 'idle' },
          action: { kind: 'addPoint', x: event.x, y: event.y },
        };
      }
      if (event.type === 'escape' || event.type === 'pressAddEdge') {
        return {
          mode: { kind: 'idle' },
          speech: t('teach.addCancelled'),
        };
      }
      return { mode };
    }

    case 'addEdgeFirst': {
      if (
        event.type === 'escape' ||
        event.type === 'pressAddPoint' ||
        event.type === 'pressAddEdge'
      ) {
        return {
          mode: { kind: 'idle' },
          speech: t('teach.addCancelled'),
        };
      }
      if (event.type === 'pickPoint') {
        return {
          mode: { kind: 'addEdgeSecond', first: event.id },
          speech: tf('teach.addEdgeSecond', { id: event.id }),
        };
      }
      if (event.type === 'canvasTap') {
        if (event.pointId) {
          return {
            mode: { kind: 'addEdgeSecond', first: event.pointId },
            speech: tf('teach.addEdgeSecond', { id: event.pointId }),
          };
        }
        return { mode };
      }
      return { mode };
    }

    case 'addEdgeSecond': {
      if (
        event.type === 'escape' ||
        event.type === 'pressAddPoint' ||
        event.type === 'pressAddEdge'
      ) {
        return {
          mode: { kind: 'idle' },
          speech: t('teach.addCancelled'),
        };
      }
      const secondId =
        event.type === 'pickPoint'
          ? event.id
          : event.type === 'canvasTap' && event.pointId
            ? event.pointId
            : undefined;

      if (secondId) {
        if (secondId === mode.first) {
          return {
            mode,
            action: { kind: 'addSegment', a: mode.first, b: secondId },
          };
        }
        return {
          mode: { kind: 'idle' },
          action: { kind: 'addSegment', a: mode.first, b: secondId },
        };
      }
      return { mode };
    }
  }
}
