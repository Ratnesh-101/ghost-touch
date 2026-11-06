/**
 * Pure flow logic and state helpers for Teacher Editor mode.
 *
 * Requirements:
 * - Load scene from current scene, saved diagram, or pasted share link
 * - Edit vertices: add, move, delete, rename labels, undo/redo
 * - Validate function_graph axis ranges (x_axis_y, y_axis_x in [0, 1] or empty)
 * - Validate editor scenes via validateShareScene
 * - Validate verify form (name <= 60, note <= 280) and build SharePayload
 * - Feature flag gating (VITE_FEATURE_SHARE === '1' and teacher tools setting)
 *
 * Pure flow (AGENTS.md rule 7): no DOM, React, or browser APIs.
 */

import {
  applyEdit,
  canRedo,
  canUndo,
  clamp01,
  createHistory,
  deletePoint,
  deleteSegment,
  movePoint,
  redo,
  renameLabel,
  undo,
  type HistoryState,
} from '../core/correct';
import type { DiagramScene, Point } from '../core/scene';
import { safeGet, safeSet } from '../drivers/storage';
import { isShareEnvOn } from '../config/features';
import {
  decodeShare,
  encodeShare,
  LIMITS,
  SHARE_VERSION,
  type SharePayload,
} from '../share';
import { validateShareScene } from '../share/validate';
import { t } from '../i18n';

export const STORAGE_KEY_TEACHER = 'gt_teacher_enabled';

let inMemoryTeacherSetting: boolean | null = null;

export function getStoredTeacherSetting(): boolean {
  const stored = safeGet(STORAGE_KEY_TEACHER);
  if (stored !== null) {
    return stored === 'true';
  }
  return inMemoryTeacherSetting ?? false;
}

export function setStoredTeacherSetting(enabled: boolean): void {
  safeSet(STORAGE_KEY_TEACHER, enabled ? 'true' : 'false');
  inMemoryTeacherSetting = enabled;
}

/** Active = env flag on AND the user's teacher setting on. */
export function isTeacherActive(settingOn: boolean = getStoredTeacherSetting()): boolean {
  return isShareEnvOn() && settingOn;
}

/**
 * Generate a new unique vertex point ID not already present in the scene.
 */
export function generateUniquePointId(existingPoints: Point[] = []): string {
  const ids = new Set(existingPoints.map((p) => p.id));
  let counter = existingPoints.length + 1;
  while (ids.has(`p${counter}`) || ids.has(`p_${counter}`)) {
    counter++;
  }
  return `p${counter}`;
}

/**
 * Add a new vertex to the scene at the given normalized coordinates (default [0.5, 0.5]).
 */
export function addVertex(
  scene: DiagramScene,
  coords?: { x: number; y: number },
  id?: string,
  label?: string,
): { scene: DiagramScene; newPointId: string } {
  const currentPoints = scene.points ?? [];
  const pointId = id && !currentPoints.some((p) => p.id === id)
    ? id
    : generateUniquePointId(currentPoints);

  const x = coords ? clamp01(coords.x) : 0.5;
  const y = coords ? clamp01(coords.y) : 0.5;

  const newPoint: Point = {
    id: pointId,
    x,
    y,
    ...(label ? { label: label.trim() } : {}),
  };

  const updatedScene: DiagramScene = {
    ...scene,
    points: [...currentPoints, newPoint],
  };

  return { scene: updatedScene, newPointId: pointId };
}

/**
 * Nudge a point's position by dx and dy, clamping to [0, 1].
 */
export function nudgeVertex(
  scene: DiagramScene,
  pointId: string,
  dx: number,
  dy: number,
): DiagramScene {
  const pt = (scene.points ?? []).find((p) => p.id === pointId);
  if (!pt) return scene;
  return movePoint(scene, pointId, pt.x + dx, pt.y + dy);
}

/**
 * Validate an axis coordinate for function_graph (must be in [0, 1] or empty/null).
 */
export function validateAxisCoord(val: string | number | null | undefined): {
  ok: boolean;
  num: number | null;
  error?: string;
} {
  if (val === null || val === undefined) {
    return { ok: true, num: null };
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') {
      return { ok: true, num: null };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return { ok: false, num: null, error: t('teach.axisInvalid') };
    }
    if (parsed < 0 || parsed > 1) {
      return { ok: false, num: null, error: t('teach.axisInvalid') };
    }
    return { ok: true, num: parsed };
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0 || val > 1) {
      return { ok: false, num: null, error: t('teach.axisInvalid') };
    }
    return { ok: true, num: val };
  }
  return { ok: false, num: null, error: t('teach.axisInvalid') };
}

/**
 * Update axis coordinates for a function_graph scene.
 */
export function updateSceneAxes(
  scene: DiagramScene,
  xAxisY: number | null,
  yAxisX: number | null,
): DiagramScene {
  const existingAxes = scene.axes ?? {};
  const newAxes = {
    ...existingAxes,
    x_axis_y: xAxisY,
    y_axis_x: yAxisX,
  };

  // If both are null/undefined, axes can be cleared or set to null
  if (newAxes.x_axis_y == null && newAxes.y_axis_x == null) {
    return {
      ...scene,
      axes: null,
    };
  }

  return {
    ...scene,
    axes: newAxes,
  };
}

/**
 * Validate verify form fields (teacher name required <= 60 chars, note optional <= 280 chars).
 */
export function validateVerifyForm(
  name: string,
  note: string,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (trimmedName.length === 0) {
    errors.push('Teacher name is required');
  } else if (trimmedName.length > LIMITS.maxName) {
    errors.push(`Teacher name exceeds ${LIMITS.maxName} characters`);
  }

  if (typeof note === 'string' && note.length > LIMITS.maxNote) {
    errors.push(`Note exceeds ${LIMITS.maxNote} characters`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Create a SharePayload for verification, throwing or failing if invalid.
 */
export function createSharePayload(
  scene: DiagramScene,
  verifiedBy: string,
  note: string,
  verifiedAt: string = new Date().toISOString(),
): SharePayload {
  const valResult = validateShareScene(scene);
  if (!valResult.ok) {
    throw new Error(`Invalid scene: ${valResult.errors.join('; ')}`);
  }

  const formVal = validateVerifyForm(verifiedBy, note);
  if (!formVal.ok) {
    throw new Error(`Invalid verify form: ${formVal.errors.join('; ')}`);
  }

  return {
    v: SHARE_VERSION,
    scene: valResult.scene,
    verifiedBy: verifiedBy.trim(),
    note: note.trim(),
    verifiedAt,
  };
}

/**
 * Load a diagram scene from pasted share input (URL, hash #s=..., or encoded payload).
 */
export function loadSceneFromShareInput(input: string): {
  ok: boolean;
  scene?: DiagramScene;
  payload?: SharePayload;
  error?: string;
} {
  if (typeof input !== 'string' || input.trim() === '') {
    return { ok: false, error: 'Empty share input' };
  }

  const trimmed = input.trim();
  let hash = trimmed;

  const hashIdx = trimmed.indexOf('#s=');
  if (hashIdx !== -1) {
    hash = trimmed.slice(hashIdx);
  } else if (!trimmed.startsWith('#s=')) {
    hash = `#s=${trimmed}`;
  }

  try {
    const payload = decodeShare(hash);
    return {
      ok: true,
      scene: payload.scene,
      payload,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to decode share link';
    return {
      ok: false,
      error: message,
    };
  }
}

/**
 * Round trip test helper: encode -> decode.
 */
export function roundTripShare(
  scene: DiagramScene,
  verifiedBy: string,
  note: string,
): DiagramScene {
  const payload = createSharePayload(scene, verifiedBy, note);
  const encoded = encodeShare(payload);
  const decoded = decodeShare(`#s=${encoded}`);
  return decoded.scene;
}

export {
  applyEdit,
  canRedo,
  canUndo,
  clamp01,
  createHistory,
  deletePoint,
  deleteSegment,
  movePoint,
  redo,
  renameLabel,
  undo,
  type HistoryState,
};
