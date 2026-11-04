import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  canRedo,
  canUndo,
  clamp01,
  createHistory,
  deletePoint,
  deleteSegment,
  historyReducer,
  movePoint,
  redo,
  renameLabel,
  undo,
  validateSceneInvariants,
} from '../src/core/correct';
import type { DiagramScene } from '../src/core/scene';

const baseScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Triangle',
  points: [
    { id: 'p1', x: 0.1, y: 0.1, label: 'A' },
    { id: 'p2', x: 0.9, y: 0.1, label: 'B' },
    { id: 'p3', x: 0.5, y: 0.8, label: 'C' },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2', label: 'Side AB' },
    { id: 's2', a: 'p2', b: 'p3', label: 'Side BC' },
    { id: 's3', a: 'p3', b: 'p1', label: 'Side CA' },
  ],
};

describe('clamp01', () => {
  it('clamps numbers to [0, 1] range and handles non-finite numbers', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.35)).toBe(0.35);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('movePoint', () => {
  it('moves existing point and clamps out-of-bounds coordinates', () => {
    const moved = movePoint(baseScene, 'p1', -0.2, 1.2);
    expect(moved.points?.[0]).toEqual({ id: 'p1', x: 0, y: 1, label: 'A' });
    // Other points untouched
    expect(moved.points?.[1]).toEqual(baseScene.points?.[1]);
    expect(moved.points?.[2]).toEqual(baseScene.points?.[2]);
  });

  it('returns same scene if point ID does not exist', () => {
    const same = movePoint(baseScene, 'unknown', 0.5, 0.5);
    expect(same).toBe(baseScene);
  });
});

describe('renameLabel', () => {
  it('trims whitespace and updates label on points, segments, or title', () => {
    const renamedPt = renameLabel(baseScene, 'p1', '  Vertex Alpha  ');
    expect(renamedPt.points?.[0]?.label).toBe('Vertex Alpha');

    const renamedSeg = renameLabel(baseScene, 's1', '  Hypotenuse  ');
    expect(renamedSeg.segments?.[0]?.label).toBe('Hypotenuse');

    const renamedTitle = renameLabel(baseScene, 'title', '  New Title  ');
    expect(renamedTitle.title).toBe('New Title');
  });

  it('rejects empty and whitespace-only labels by throwing an error', () => {
    expect(() => renameLabel(baseScene, 'p1', '')).toThrow('Label cannot be empty');
    expect(() => renameLabel(baseScene, 'p1', '   \t\n  ')).toThrow('Label cannot be empty');
  });

  it('returns same scene if element ID does not match any element', () => {
    const same = renameLabel(baseScene, 'nonexistent', 'Label');
    expect(same).toBe(baseScene);
  });
});

describe('deletePoint', () => {
  it('removes point and all connected segments (no dangling references)', () => {
    const updated = deletePoint(baseScene, 'p2');
    // p2 is removed
    expect(updated.points?.map((p) => p.id)).toEqual(['p1', 'p3']);
    // s1 (p1-p2) and s2 (p2-p3) are removed; s3 (p3-p1) remains
    expect(updated.segments?.map((s) => s.id)).toEqual(['s3']);
  });

  it('removes nothing if point ID not found', () => {
    const updated = deletePoint(baseScene, 'unknown');
    expect(updated.points).toHaveLength(3);
    expect(updated.segments).toHaveLength(3);
  });
});

describe('deleteSegment', () => {
  it('removes segment and keeps endpoints intact', () => {
    const updated = deleteSegment(baseScene, 's2');
    expect(updated.segments?.map((s) => s.id)).toEqual(['s1', 's3']);
    expect(updated.points).toHaveLength(3);
  });

  it('removes nothing if segment ID not found', () => {
    const updated = deleteSegment(baseScene, 'unknown');
    expect(updated.segments).toHaveLength(3);
  });
});

describe('history and undo/redo reducer', () => {
  it('tracks edits, undos, and redos correctly', () => {
    let hist = createHistory(baseScene);
    expect(canUndo(hist)).toBe(false);
    expect(canRedo(hist)).toBe(false);

    const step1 = movePoint(baseScene, 'p1', 0.2, 0.2);
    hist = applyEdit(hist, step1);
    expect(hist.present).toBe(step1);
    expect(canUndo(hist)).toBe(true);
    expect(canRedo(hist)).toBe(false);

    const step2 = deleteSegment(step1, 's1');
    hist = historyReducer(hist, { type: 'apply', scene: step2 });
    expect(hist.present).toBe(step2);

    // Undo step 2
    hist = historyReducer(hist, { type: 'undo' });
    expect(hist.present).toBe(step1);
    expect(canRedo(hist)).toBe(true);

    // Undo step 1
    hist = undo(hist);
    expect(hist.present).toBe(baseScene);
    expect(canUndo(hist)).toBe(false);

    // Redo step 1
    hist = redo(hist);
    expect(hist.present).toBe(step1);

    // Redo step 2
    hist = historyReducer(hist, { type: 'redo' });
    expect(hist.present).toBe(step2);
    expect(canRedo(hist)).toBe(false);
  });

  it('clears redo history when new edit is applied after undo', () => {
    let hist = createHistory(baseScene);
    const step1 = movePoint(baseScene, 'p1', 0.2, 0.2);
    hist = applyEdit(hist, step1);

    hist = undo(hist);
    expect(hist.present).toBe(baseScene);
    expect(canRedo(hist)).toBe(true);

    const alternativeStep = movePoint(baseScene, 'p2', 0.8, 0.2);
    hist = applyEdit(hist, alternativeStep);
    expect(hist.present).toBe(alternativeStep);
    expect(canRedo(hist)).toBe(false); // cleared
  });

  it('no-ops when undoing empty past or redoing empty future', () => {
    let hist = createHistory(baseScene);
    expect(undo(hist)).toBe(hist);
    expect(redo(hist)).toBe(hist);
  });
});

describe('validateSceneInvariants', () => {
  it('validates a correct scene', () => {
    const res = validateSceneInvariants(baseScene);
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('detects duplicate IDs', () => {
    const dupScene: DiagramScene = {
      ...baseScene,
      points: [
        { id: 'same', x: 0.1, y: 0.1 },
        { id: 'same', x: 0.5, y: 0.5 },
      ],
      segments: [],
    };
    const res = validateSceneInvariants(dupScene);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("Duplicate ID: 'same'"))).toBe(true);
  });

  it('detects dangling segment references', () => {
    const danglingScene: DiagramScene = {
      ...baseScene,
      segments: [{ id: 's_bad', a: 'p1', b: 'missing' }],
    };
    const res = validateSceneInvariants(danglingScene);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("endpoint b 'missing' does not exist"))).toBe(true);
  });

  it('detects coordinates out of [0, 1]', () => {
    const outOfBoundsScene: DiagramScene = {
      ...baseScene,
      points: [{ id: 'p_out', x: 1.5, y: -0.1 }],
      segments: [],
    };
    const res = validateSceneInvariants(outOfBoundsScene);
    expect(res.ok).toBe(false);
    expect(res.errors).toHaveLength(2);
  });
});

describe('i18n parity for Correct mode', () => {
  it('ensures all correct keys exist in en, hi, and gu', async () => {
    const { tables } = await import('../src/i18n');
    const enKeys = Object.keys(tables.en).filter((k) => k.startsWith('correct.') || k === 'explore.correct');
    for (const key of enKeys) {
      expect(tables.hi).toHaveProperty(key);
      expect(tables.gu).toHaveProperty(key);
      expect(tables.hi[key]?.length).toBeGreaterThan(0);
      expect(tables.gu[key]?.length).toBeGreaterThan(0);
    }
  });

  it('ensures complete parity between en, hi, and gu translation tables', async () => {
    const { tables } = await import('../src/i18n');
    const enKeys = Object.keys(tables.en).sort();
    const hiKeys = Object.keys(tables.hi).sort();
    const guKeys = Object.keys(tables.gu).sort();
    expect(hiKeys).toEqual(enKeys);
    expect(guKeys).toEqual(enKeys);
  });
});

