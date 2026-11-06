/**
 * Flow & pure logic tests for Teacher Editor (Lane t2-teach-editor).
 *
 * Verifies:
 * - addVertex / nudgeVertex
 * - validateAxisCoord / updateSceneAxes (function_graph)
 * - validateVerifyForm & createSharePayload (limits: name <= 60, note <= 280)
 * - loadSceneFromShareInput (URL, hash, raw)
 * - roundTripShare: edit -> encode -> decodeShare equals edited scene
 * - Feature flag & settings gating (isTeacherActive)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  addVertex,
  createSharePayload,
  generateUniquePointId,
  getStoredTeacherSetting,
  isTeacherActive,
  loadSceneFromShareInput,
  nudgeVertex,
  roundTripShare,
  setStoredTeacherSetting,
  updateSceneAxes,
  validateAxisCoord,
  validateVerifyForm,
} from '../src/flow/teach';
import { encodeShare, LIMITS, type SharePayload } from '../src/share';
import { validateShareScene } from '../src/share/validate';

const baseScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'A', x: 0.1, y: 0.1, label: 'Point A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'Point B' },
    { id: 'C', x: 0.1, y: 0.8, label: 'Point C' },
  ],
  segments: [
    { id: 's1', a: 'A', b: 'B', label: 'AB' },
    { id: 's2', a: 'B', b: 'C', label: 'BC' },
    { id: 's3', a: 'C', b: 'A', label: 'CA' },
  ],
};

describe('teach.flow — pure logic and editing helpers', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    setStoredTeacherSetting(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('addVertex & nudgeVertex', () => {
    it('generates unique point IDs that do not collide with existing ones', () => {
      const existing = [
        { id: 'p1', x: 0, y: 0 },
        { id: 'p2', x: 0, y: 0 },
        { id: 'p_3', x: 0, y: 0 },
      ];
      const nextId = generateUniquePointId(existing);
      expect(nextId).toBe('p4');
    });

    it('adds a vertex with default center coordinates [0.5, 0.5]', () => {
      const { scene, newPointId } = addVertex(baseScene);
      expect(scene.points?.length).toBe(4);
      const added = scene.points?.find((p) => p.id === newPointId);
      expect(added).toBeDefined();
      expect(added?.x).toBe(0.5);
      expect(added?.y).toBe(0.5);
    });

    it('adds a vertex with custom clamped coordinates', () => {
      const { scene, newPointId } = addVertex(baseScene, { x: 1.5, y: -0.2 }, 'custom_p', 'Custom Point');
      const added = scene.points?.find((p) => p.id === newPointId);
      expect(added?.id).toBe('custom_p');
      expect(added?.label).toBe('Custom Point');
      expect(added?.x).toBe(1.0); // clamped to 1
      expect(added?.y).toBe(0.0); // clamped to 0
    });

    it('nudges a vertex by dx and dy, clamping to [0, 1]', () => {
      const nudged = nudgeVertex(baseScene, 'A', 0.05, -0.2);
      const ptA = nudged.points?.find((p) => p.id === 'A');
      expect(ptA?.x).toBeCloseTo(0.15);
      expect(ptA?.y).toBe(0); // 0.1 - 0.2 clamped to 0
    });

    it('nudgeVertex returns original scene if point does not exist', () => {
      const res = nudgeVertex(baseScene, 'non_existent', 0.1, 0.1);
      expect(res).toBe(baseScene);
    });
  });

  describe('validateAxisCoord & updateSceneAxes (function_graph)', () => {
    it('accepts null, undefined, and empty string as valid cleared axis', () => {
      expect(validateAxisCoord(null)).toEqual({ ok: true, num: null });
      expect(validateAxisCoord(undefined)).toEqual({ ok: true, num: null });
      expect(validateAxisCoord('')).toEqual({ ok: true, num: null });
      expect(validateAxisCoord('   ')).toEqual({ ok: true, num: null });
    });

    it('accepts numbers in [0, 1]', () => {
      expect(validateAxisCoord(0)).toEqual({ ok: true, num: 0 });
      expect(validateAxisCoord(0.5)).toEqual({ ok: true, num: 0.5 });
      expect(validateAxisCoord(1)).toEqual({ ok: true, num: 1 });
      expect(validateAxisCoord('0.75')).toEqual({ ok: true, num: 0.75 });
    });

    it('rejects numbers outside [0, 1] or invalid strings', () => {
      expect(validateAxisCoord(-0.01).ok).toBe(false);
      expect(validateAxisCoord(1.01).ok).toBe(false);
      expect(validateAxisCoord('abc').ok).toBe(false);
      expect(validateAxisCoord(NaN).ok).toBe(false);
    });

    it('updates function_graph axes correctly', () => {
      const graphScene: DiagramScene = {
        version: 1,
        kind: 'function_graph',
        title: 'Sine Wave',
        axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
      };

      const updated = updateSceneAxes(graphScene, 0.7, 0.3);
      expect(updated.axes?.x_axis_y).toBe(0.7);
      expect(updated.axes?.y_axis_x).toBe(0.3);

      const cleared = updateSceneAxes(graphScene, null, null);
      expect(cleared.axes).toBeNull();
    });
  });

  describe('validateVerifyForm & createSharePayload', () => {
    it('validates teacher name requirements (required, <= 60 chars)', () => {
      expect(validateVerifyForm('', '').ok).toBe(false);
      expect(validateVerifyForm('   ', '').ok).toBe(false);
      expect(validateVerifyForm('Valid Teacher', '').ok).toBe(true);

      const longName = 'A'.repeat(LIMITS.maxName + 1);
      expect(validateVerifyForm(longName, '').ok).toBe(false);

      const exactName = 'A'.repeat(LIMITS.maxName);
      expect(validateVerifyForm(exactName, '').ok).toBe(true);
    });

    it('validates teacher note limits (optional, <= 280 chars)', () => {
      expect(validateVerifyForm('Teacher', '').ok).toBe(true);
      expect(validateVerifyForm('Teacher', 'Short note').ok).toBe(true);

      const longNote = 'N'.repeat(LIMITS.maxNote + 1);
      expect(validateVerifyForm('Teacher', longNote).ok).toBe(false);

      const exactNote = 'N'.repeat(LIMITS.maxNote);
      expect(validateVerifyForm('Teacher', exactNote).ok).toBe(true);
    });

    it('creates a valid SharePayload with ISO verifiedAt timestamp', () => {
      const payload = createSharePayload(baseScene, 'Prof. Ramanujan', 'Notice the hypotenuse.');
      expect(payload.v).toBe(1);
      expect(payload.verifiedBy).toBe('Prof. Ramanujan');
      expect(payload.note).toBe('Notice the hypotenuse.');
      expect(typeof payload.verifiedAt).toBe('string');
      expect(() => new Date(payload.verifiedAt).toISOString()).not.toThrow();
    });

    it('throws when creating share payload with an invalid scene or invalid form', () => {
      const emptyScene: DiagramScene = {
        version: 1,
        kind: 'geometry',
        points: [],
        segments: [],
      };
      expect(() => createSharePayload(emptyScene, 'Teacher', 'Note')).toThrow(/Invalid scene/);
      expect(() => createSharePayload(baseScene, '', 'Note')).toThrow(/Invalid verify form/);
    });
  });

  describe('loadSceneFromShareInput', () => {
    it('loads a diagram from a full URL containing #s=', () => {
      const payload: SharePayload = {
        v: 1,
        scene: baseScene,
        verifiedBy: 'Teacher One',
        note: 'Note One',
        verifiedAt: new Date().toISOString(),
      };
      const encoded = encodeShare(payload);
      const url = `https://ghost-touch.org/#s=${encoded}`;

      const res = loadSceneFromShareInput(url);
      expect(res.ok).toBe(true);
      expect(res.scene?.title).toBe('Right Triangle');
      expect(res.payload?.verifiedBy).toBe('Teacher One');
    });

    it('loads a diagram from a hash #s=...', () => {
      const payload: SharePayload = {
        v: 1,
        scene: baseScene,
        verifiedBy: 'Teacher Two',
        note: 'Note Two',
        verifiedAt: new Date().toISOString(),
      };
      const encoded = encodeShare(payload);

      const res = loadSceneFromShareInput(`#s=${encoded}`);
      expect(res.ok).toBe(true);
      expect(res.scene?.title).toBe('Right Triangle');
    });

    it('handles empty input and corrupted input gracefully', () => {
      expect(loadSceneFromShareInput('').ok).toBe(false);
      expect(loadSceneFromShareInput('   ').ok).toBe(false);
      expect(loadSceneFromShareInput('#s=corrupted_lz_string').ok).toBe(false);
    });
  });

  describe('roundTripShare', () => {
    it('round trips: edit scene -> encode -> decodeShare equals edited scene', () => {
      // 1. Start with base scene
      // 2. Add vertex D
      const { scene: sceneWithD, newPointId } = addVertex(baseScene, { x: 0.5, y: 0.5 }, 'D', 'Point D');
      expect(newPointId).toBe('D');

      // 3. Nudge point A
      const nudgedScene = nudgeVertex(sceneWithD, 'A', 0.05, 0.05);

      // 4. Validate before encoding
      const val = validateShareScene(nudgedScene);
      expect(val.ok).toBe(true);

      // 5. Round trip through encode and decode
      const roundTripped = roundTripShare(nudgedScene, 'Master Teacher', 'Check vertex D.');

      // Check structural equality of points and segments
      expect(roundTripped.points?.length).toBe(4);
      const ptD = roundTripped.points?.find((p) => p.id === 'D');
      expect(ptD?.label).toBe('Point D');
      expect(ptD?.x).toBe(0.5);
      expect(ptD?.y).toBe(0.5);

      const ptA = roundTripped.points?.find((p) => p.id === 'A');
      expect(ptA?.x).toBeCloseTo(0.15);
      expect(ptA?.y).toBeCloseTo(0.15);

      expect(roundTripped.title).toBe(nudgedScene.title);
      expect(roundTripped.segments?.length).toBe(3);
    });
  });

  describe('Feature flag and stored setting gating', () => {
    it('isTeacherActive is false when env flag is off', () => {
      vi.stubEnv('VITE_FEATURE_SHARE', '0');
      setStoredTeacherSetting(true);
      expect(isTeacherActive(true)).toBe(false);
    });

    it('isTeacherActive is false when stored setting is false', () => {
      vi.stubEnv('VITE_FEATURE_SHARE', '1');
      setStoredTeacherSetting(false);
      expect(isTeacherActive(false)).toBe(false);
    });

    it('isTeacherActive is true only when env flag is "1" AND setting is true', () => {
      vi.stubEnv('VITE_FEATURE_SHARE', '1');
      setStoredTeacherSetting(true);
      expect(isTeacherActive(true)).toBe(true);
      expect(getStoredTeacherSetting()).toBe(true);
    });
  });
});
