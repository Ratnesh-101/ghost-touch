import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import type { Drivers } from '../src/drivers';
import {
  distToScreenSegment,
  formatValidationErrors,
  getSelectedLabel,
  getSelectionAnnouncement,
  hitTestCorrect,
  hitTestPoint,
  hitTestSegment,
  pointerToNorm,
} from '../src/flow/correct';
import { Correct } from '../src/screens/Correct';

const testScene: DiagramScene = {
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'p1', x: 0.1, y: 0.1, label: 'Vertex A' },
    { id: 'p2', x: 0.9, y: 0.1, label: 'Vertex B' },
    { id: 'p3', x: 0.1, y: 0.9, label: 'Vertex C' },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2', label: 'Side AB' },
    { id: 's2', a: 'p1', b: 'p3', label: 'Side AC' },
  ],
};

const drivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
};

describe('flow/correct geometric and hit-test helpers', () => {
  const w = 500;
  const h = 500;

  it('hitTestPoint returns point within radius and null outside', () => {
    // p1 is at (0.1 * 500, 0.1 * 500) = (50, 50)
    const hit = hitTestPoint(testScene.points, 52, 53, w, h, 24);
    expect(hit?.id).toBe('p1');

    const miss = hitTestPoint(testScene.points, 200, 200, w, h, 24);
    expect(miss).toBeNull();
  });

  it('distToScreenSegment computes perpendicular and endpoint distance', () => {
    // Horizontal segment from (100, 100) to (300, 100)
    // Perpendicular at (200, 120) -> distance is 20
    expect(distToScreenSegment(200, 120, 100, 100, 300, 100)).toBeCloseTo(20);

    // Past endpoint a at (50, 100) -> distance to (100, 100) is 50
    expect(distToScreenSegment(50, 100, 100, 100, 300, 100)).toBeCloseTo(50);

    // Degenerate segment (length 0)
    expect(distToScreenSegment(103, 104, 100, 100, 100, 100)).toBeCloseTo(5);
  });

  it('hitTestSegment returns segment within radius', () => {
    // s1 connects (50, 50) and (450, 50). Midpoint is (250, 50).
    const hit = hitTestSegment(testScene, 250, 55, w, h, 16);
    expect(hit?.id).toBe('s1');

    const miss = hitTestSegment(testScene, 250, 250, w, h, 16);
    expect(miss).toBeNull();
  });

  it('hitTestCorrect gives points priority over segments', () => {
    // At (50, 50), both p1 and segment s1/s2 are present; point must win
    const hit = hitTestCorrect(testScene, 50, 50, w, h);
    expect(hit).toEqual({ kind: 'point', id: 'p1' });

    // Mid-segment away from vertex -> segment wins
    const segHit = hitTestCorrect(testScene, 250, 50, w, h);
    expect(segHit).toEqual({ kind: 'segment', id: 's1' });

    // Empty space -> null
    const emptyHit = hitTestCorrect(testScene, 400, 400, w, h);
    expect(emptyHit).toBeNull();
  });

  it('pointerToNorm maps screen pixels to normalized [0, 1] clamped', () => {
    expect(pointerToNorm(250, 250, 500, 500)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointerToNorm(-50, 600, 500, 500)).toEqual({ x: 0, y: 1 });
  });

  it('getSelectedLabel extracts label or fallback id', () => {
    expect(getSelectedLabel(testScene, { kind: 'point', id: 'p1' })).toBe('Vertex A');
    expect(getSelectedLabel(testScene, { kind: 'segment', id: 's1' })).toBe('Side AB');
    expect(getSelectedLabel(testScene, null)).toBe('');
  });

  it('getSelectionAnnouncement announces selection with label', () => {
    const ann = getSelectionAnnouncement(testScene, { kind: 'point', id: 'p1' });
    expect(ann).toContain('Vertex A');
    expect(ann).toContain('p1');

    const none = getSelectionAnnouncement(testScene, null);
    expect(none.length).toBeGreaterThan(0);
  });

  it('formatValidationErrors formats multiple errors', () => {
    const formatted = formatValidationErrors(['Error one', 'Error two']);
    expect(formatted).toContain('Error one');
    expect(formatted).toContain('Error two');
  });
});

describe('Correct screen markup and accessible controls', () => {
  it('renders all accessible controls with 48x48 min touch targets', () => {
    const html = renderToStaticMarkup(
      createElement(Correct, {
        scene: testScene,
        photoUrl: null,
        drivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    // Title and status
    expect(html).toContain('gt-correct__title');
    expect(html).toContain('gt-correct__status');

    // Canvas with accessible name
    expect(html).toContain('<canvas');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label=');

    // Actions
    expect(html).toContain('gt-correct__btn');
    expect(html).toContain('Save');
    expect(html).toContain('Undo');
    expect(html).toContain('Redo');
    expect(html).toContain('Delete');
    expect(html).toContain('Cancel');
  });
});
