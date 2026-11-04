import { describe, expect, it } from 'vitest';
import {
  applyAdd,
  capExceeded,
  chooseEviction,
  deserialise,
  makeId,
  orderForDisplay,
  SAVED_DIAGRAMS_CAP,
  SavedDiagram,
  savedTitle,
  serialise,
} from '../src/core/savedDiagrams';
import type { DiagramScene } from '../src/core/scene';

describe('savedTitle', () => {
  it('uses scene.title when present and non-empty', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      title: 'Right-angled triangle ABC',
      points: [{ id: 'p1', x: 0, y: 0, label: 'A' }],
    };
    expect(savedTitle(scene)).toBe('Right-angled triangle ABC');
  });

  it('trims leading and trailing whitespace from scene.title', () => {
    const scene: DiagramScene = {
      kind: 'function_graph',
      title: '  Sine curve over [0, 2pi]  ',
    };
    expect(savedTitle(scene)).toBe('Sine curve over [0, 2pi]');
  });

  it('synthesises kind + first labelled point names when title is absent', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0, y: 0, label: 'A' },
        { id: 'p2', x: 0.5, y: 0.5, label: 'B' },
        { id: 'p3', x: 1, y: 1, label: 'C' },
      ],
    };
    expect(savedTitle(scene)).toBe('geometry: A, B, C');
  });

  it('limits synthesised point labels to the first 3', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0, y: 0, label: 'P' },
        { id: 'p2', x: 0.2, y: 0.2, label: 'Q' },
        { id: 'p3', x: 0.4, y: 0.4, label: 'R' },
        { id: 'p4', x: 0.6, y: 0.6, label: 'S' },
      ],
    };
    expect(savedTitle(scene)).toBe('geometry: P, Q, R');
  });

  it('skips unlabelled or blank point labels', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0, y: 0 },
        { id: 'p2', x: 0.2, y: 0.2, label: '  ' },
        { id: 'p3', x: 0.4, y: 0.4, label: 'X' },
        { id: 'p4', x: 0.6, y: 0.6, label: 'Y' },
      ],
    };
    expect(savedTitle(scene)).toBe('geometry: X, Y');
  });

  it('returns just the kind if title is absent and no points have labels', () => {
    const scene: DiagramScene = {
      kind: 'bar_chart',
      bars: [
        { id: 'b1', label: 'Bar 1', value: 10, x0: 0.1, x1: 0.3, y_base: 0.9, y_top: 0.2 },
      ],
    };
    expect(savedTitle(scene)).toBe('bar_chart');
  });

  it('returns just the kind if title is an empty string and points array is empty', () => {
    const scene: DiagramScene = {
      kind: 'unknown',
      title: '   ',
      points: [],
    };
    expect(savedTitle(scene)).toBe('unknown');
  });
});

describe('makeId', () => {
  it('generates a formatted id <base36 timestamp>-<6 random base36 chars>', () => {
    const id = makeId(1700000000000, () => 0.5);
    expect(id).toMatch(/^[0-9a-z]+-[0-9a-z]{6}$/);
  });

  it('is deterministic when clock and rng are injected', () => {
    const now = 1700000000000;
    const rng = () => 0.123456789;
    const id1 = makeId(now, rng);
    const id2 = makeId(now, rng);
    expect(id1).toBe(id2);
  });

  it('pads the random portion with leading zeros to exactly 6 characters', () => {
    const id = makeId(1000, () => 0);
    expect(id).toBe(`${(1000).toString(36)}-000000`);
  });

  it('handles clock at 0, negative values, and NaN safely', () => {
    expect(makeId(0, () => 0)).toBe('0-000000');
    expect(makeId(-500, () => 0)).toBe('0-000000');
    expect(makeId(NaN, () => 0)).toBe('0-000000');
  });
});

describe('chooseEviction', () => {
  const dummyScene: DiagramScene = { kind: 'geometry' };

  it('returns undefined for empty array', () => {
    expect(chooseEviction([])).toBeUndefined();
  });

  it('returns undefined when all entries are pinned', () => {
    const entries: SavedDiagram[] = [
      { id: '1', createdAt: 100, title: 'T1', thumbnailDataUrl: '', scene: dummyScene, pinned: true },
      { id: '2', createdAt: 200, title: 'T2', thumbnailDataUrl: '', scene: dummyScene, pinned: true },
    ];
    expect(chooseEviction(entries)).toBeUndefined();
  });

  it('returns the oldest unpinned entry even if newer entries are unpinned', () => {
    const entries: SavedDiagram[] = [
      { id: '1', createdAt: 300, title: 'T1', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: '2', createdAt: 100, title: 'T2', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: '3', createdAt: 200, title: 'T3', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ];
    const victim = chooseEviction(entries);
    expect(victim?.id).toBe('2');
  });

  it('ignores pinned entries even if they are older than unpinned entries', () => {
    const entries: SavedDiagram[] = [
      { id: 'pinned-old', createdAt: 50, title: 'P', thumbnailDataUrl: '', scene: dummyScene, pinned: true },
      { id: 'unpinned-med', createdAt: 150, title: 'M', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: 'unpinned-new', createdAt: 250, title: 'N', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ];
    const victim = chooseEviction(entries);
    expect(victim?.id).toBe('unpinned-med');
  });

  it('does not mutate the input array', () => {
    const entries: readonly SavedDiagram[] = Object.freeze([
      { id: '1', createdAt: 100, title: 'T1', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ]);
    expect(() => chooseEviction(entries)).not.toThrow();
  });
});

describe('capExceeded', () => {
  it('returns false when count is below cap', () => {
    expect(capExceeded(0)).toBe(false);
    expect(capExceeded(19)).toBe(false);
  });

  it('returns true when count equals or exceeds cap', () => {
    expect(capExceeded(SAVED_DIAGRAMS_CAP)).toBe(true);
    expect(capExceeded(21)).toBe(true);
  });

  it('supports custom cap', () => {
    expect(capExceeded(4, 5)).toBe(false);
    expect(capExceeded(5, 5)).toBe(true);
  });
});

describe('orderForDisplay', () => {
  const dummyScene: DiagramScene = { kind: 'geometry' };

  it('sorts entries newest first (descending createdAt)', () => {
    const entries: SavedDiagram[] = [
      { id: 'a', createdAt: 100, title: 'A', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: 'b', createdAt: 500, title: 'B', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: 'c', createdAt: 300, title: 'C', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ];
    const sorted = orderForDisplay(entries);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the original array', () => {
    const entries: SavedDiagram[] = [
      { id: 'a', createdAt: 100, title: 'A', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: 'b', createdAt: 200, title: 'B', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ];
    const clone = [...entries];
    orderForDisplay(entries);
    expect(entries).toEqual(clone);
  });
});

describe('applyAdd', () => {
  const dummyScene: DiagramScene = { kind: 'geometry' };

  it('adds an entry when count is below cap without eviction', () => {
    const entries: SavedDiagram[] = [
      { id: '1', createdAt: 100, title: '1', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ];
    const newEntry: SavedDiagram = {
      id: '2',
      createdAt: 200,
      title: '2',
      thumbnailDataUrl: '',
      scene: dummyScene,
      pinned: false,
    };
    const res = applyAdd(entries, newEntry, 3);
    expect(res).toEqual({
      ok: true,
      next: [entries[0], newEntry],
    });
  });

  it('evicts the oldest unpinned entry when store is at cap', () => {
    const entries: SavedDiagram[] = [
      { id: 'p1', createdAt: 100, title: 'P1', thumbnailDataUrl: '', scene: dummyScene, pinned: true },
      { id: 'u1', createdAt: 200, title: 'U1', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: 'u2', createdAt: 300, title: 'U2', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ];
    const newEntry: SavedDiagram = {
      id: 'new',
      createdAt: 400,
      title: 'New',
      thumbnailDataUrl: '',
      scene: dummyScene,
      pinned: false,
    };
    const res = applyAdd(entries, newEntry, 3);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.evictedId).toBe('u1');
      expect(res.next.map((e) => e.id)).toEqual(['p1', 'u2', 'new']);
    }
  });

  it('returns all_pinned when at cap and all entries are pinned', () => {
    const entries: SavedDiagram[] = [
      { id: 'p1', createdAt: 100, title: 'P1', thumbnailDataUrl: '', scene: dummyScene, pinned: true },
      { id: 'p2', createdAt: 200, title: 'P2', thumbnailDataUrl: '', scene: dummyScene, pinned: true },
    ];
    const newEntry: SavedDiagram = {
      id: 'new',
      createdAt: 300,
      title: 'New',
      thumbnailDataUrl: '',
      scene: dummyScene,
      pinned: false,
    };
    const res = applyAdd(entries, newEntry, 2);
    expect(res).toEqual({
      ok: false,
      reason: 'all_pinned',
    });
  });

  it('updates existing entry in place without eviction even when at cap', () => {
    const entries: SavedDiagram[] = [
      { id: '1', createdAt: 100, title: 'Old 1', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
      { id: '2', createdAt: 200, title: '2', thumbnailDataUrl: '', scene: dummyScene, pinned: false },
    ];
    const updated1: SavedDiagram = {
      id: '1',
      createdAt: 100,
      title: 'New 1',
      thumbnailDataUrl: '',
      scene: dummyScene,
      pinned: true,
    };
    const res = applyAdd(entries, updated1, 2);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.evictedId).toBeUndefined();
      expect(res.next.find((e) => e.id === '1')?.title).toBe('New 1');
      expect(res.next.length).toBe(2);
    }
  });
});

describe('serialise and deserialise', () => {
  const sampleEntry: SavedDiagram = {
    id: 'test-123',
    createdAt: 1700000000000,
    title: 'Triangle ABC',
    thumbnailDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    scene: {
      version: 1,
      kind: 'geometry',
      title: 'Triangle ABC',
      points: [
        { id: 'p1', x: 0.1, y: 0.2, label: 'A' },
        { id: 'p2', x: 0.5, y: 0.8, label: 'B' },
      ],
      segments: [{ id: 's1', a: 'p1', b: 'p2' }],
    },
    pinned: true,
  };

  it('serialises to a JSON string and deserialises back identically', () => {
    const jsonStr = serialise(sampleEntry);
    expect(typeof jsonStr).toBe('string');
    const restored = deserialise(jsonStr);
    expect(restored).toEqual(sampleEntry);
  });

  it('deserialises from a plain JavaScript object (e.g. from IndexedDB)', () => {
    const rawObj = JSON.parse(JSON.stringify(sampleEntry)) as unknown;
    const restored = deserialise(rawObj);
    expect(restored).toEqual(sampleEntry);
  });

  it('returns undefined for invalid or corrupt data', () => {
    expect(deserialise(null)).toBeUndefined();
    expect(deserialise(undefined)).toBeUndefined();
    expect(deserialise(123)).toBeUndefined();
    expect(deserialise('not valid json')).toBeUndefined();
    expect(deserialise([])).toBeUndefined();
    expect(deserialise({})).toBeUndefined();

    // Missing id
    expect(deserialise({ ...sampleEntry, id: '' })).toBeUndefined();
    expect(deserialise({ ...sampleEntry, id: 123 })).toBeUndefined();

    // Invalid createdAt
    expect(deserialise({ ...sampleEntry, createdAt: NaN })).toBeUndefined();
    expect(deserialise({ ...sampleEntry, createdAt: Infinity })).toBeUndefined();

    // Missing scene or invalid kind
    expect(deserialise({ ...sampleEntry, scene: null })).toBeUndefined();
    expect(deserialise({ ...sampleEntry, scene: { kind: 'invalid_kind' } })).toBeUndefined();
  });
});
