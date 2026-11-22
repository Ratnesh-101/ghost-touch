/**
 * Ghost Hand build flow (Requirement 52, task 86).
 *
 * Pure flow module: no React, DOM, or browser APIs.
 * State machine and action helpers for the student plot form:
 * - HistoryState initialized with emptyDraft()
 * - Slider coordinates (x 0..6, y 0..8)
 * - pressPin: calls pin(), applies edit only when pinned, returns speech key and params
 * - pressStitch: calls stitchInOrder(), speaks build.stitchNone if <2 pins, returns speech key and params
 * - pressUndo: undos last action, describes whether pin or stitch was undone, returns speech key and params
 */

import {
  applyEdit,
  createHistory,
  undo,
  type HistoryState,
} from '../core/correct';
import {
  emptyDraft,
  GRID_MAX_X,
  GRID_MAX_Y,
  pin,
  pinLabel,
  pinsOf,
  snapCrossing,
  stitchInOrder,
} from '../core/pegboard';
import { describeUndo } from './ghostwriter';

export interface BuildSpeech {
  key: string;
  params: Record<string, string | number>;
}

export function stringifyParams(
  params: Readonly<Record<string, string | number>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = String(v);
  }
  return out;
}

export interface BuildActionResult {
  history: HistoryState;
  speech: BuildSpeech;
}

export interface BuildSliders {
  x: number;
  y: number;
}

export function initialBuildHistory(): HistoryState {
  return createHistory(emptyDraft());
}

export function initialSliders(): BuildSliders {
  return { x: 0, y: 0 };
}

export function clampX(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.min(GRID_MAX_X, Math.max(0, Math.round(val)));
}

export function clampY(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.min(GRID_MAX_Y, Math.max(0, Math.round(val)));
}

/**
 * Handle pressing the "Pin" button.
 * Snaps (gx, gy) to grid crossing.
 * If pinned: adds point, returns new history, speaks build.pinned.
 * If occupied: no history change, speaks build.occupied with id and crossing label.
 * If badInput: no history change, speaks build.badInput.
 */
export function pressPin(
  history: HistoryState,
  gx: number,
  gy: number,
): BuildActionResult {
  const result = pin(history.present, gx, gy);
  if (result.kind === 'pinned') {
    return {
      history: applyEdit(history, result.scene),
      speech: {
        key: 'build.pinned',
        params: { id: result.id, label: result.label },
      },
    };
  }
  if (result.kind === 'occupied') {
    const crossing = snapCrossing(gx, gy);
    const label = crossing ? pinLabel(crossing) : `x ${gx} y ${gy}`;
    return {
      history,
      speech: {
        key: 'build.occupied',
        params: { id: result.id, label },
      },
    };
  }
  return {
    history,
    speech: {
      key: 'build.badInput',
      params: {},
    },
  };
}

/**
 * Handle pressing the "Stitch in order" button.
 * If fewer than 2 pins: history unchanged, speaks build.stitchNone.
 * Otherwise: stitches pins left-to-right into segments in ONE apply edit, speaks build.stitched.
 */
export function pressStitch(history: HistoryState): BuildActionResult {
  const pins = pinsOf(history.present);
  if (pins.length < 2) {
    return {
      history,
      speech: {
        key: 'build.stitchNone',
        params: {},
      },
    };
  }
  const nextScene = stitchInOrder(history.present);
  const nextHistory = applyEdit(history, nextScene);
  const segmentCount = nextScene.segments?.length ?? 0;
  return {
    history: nextHistory,
    speech: {
      key: 'build.stitched',
      params: { count: segmentCount },
    },
  };
}

/**
 * Handle pressing the "Undo" button.
 * If past is empty: history unchanged, speaks build.undoNothing.
 * Otherwise: undos the last edit.
 * If a point was removed: speaks build.undoPin with id.
 * If stitch was removed: speaks build.undoStitch.
 */
export function pressUndo(history: HistoryState): BuildActionResult {
  if (history.past.length === 0) {
    return {
      history,
      speech: {
        key: 'build.undoNothing',
        params: {},
      },
    };
  }
  const current = history.present;
  const previous = history.past[history.past.length - 1]!;
  const nextHistory = undo(history);

  const desc = describeUndo(current, previous);
  if (desc && desc.kind === 'point') {
    return {
      history: nextHistory,
      speech: {
        key: 'build.undoPin',
        params: { id: desc.id },
      },
    };
  }

  return {
    history: nextHistory,
    speech: {
      key: 'build.undoStitch',
      params: {},
    },
  };
}
