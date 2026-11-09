// @vitest-environment jsdom
/**
 * Component and integration tests for Ghostwriter on the Teach screen (Task 36, Requirement 20).
 *
 * Verifies:
 * - Controls have accessible names and min 48×48 px targets
 * - Add point by tap and by second press
 * - Add edge by picking two points
 * - No-op reasons are spoken (samePoint, alreadyJoined, unknownPoint, badCoords)
 * - Undo of each add is spoken with specific details
 * - Refusal at point cap
 * - Explore screen renders no add controls
 * - Spec Ghost 20.6 example
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Teach } from '../src/screens/Teach';
import { Explore } from '../src/screens/Explore';
import { exploreAnnouncement, verifyCaveatForScene } from '../src/flow/navigation';
import {
  GHOSTWRITER_POINT_CAP,
  ghostwriterSpeech,
  planAddPoint,
  planAddSegment,
} from '../src/flow/ghostwriter';
import { t } from '../src/i18n';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const SIZE = 400;

function createTestScene(): DiagramScene {
  return {
    version: 1,
    kind: 'geometry',
    title: 'Test Triangle',
    points: [
      { id: 'A', x: 0.2, y: 0.8, label: 'A' },
      { id: 'B', x: 0.8, y: 0.8, label: 'B' },
      { id: 'C', x: 0.5, y: 0.2, label: 'C' },
    ],
    segments: [
      { id: 's_ab', a: 'A', b: 'B', label: 'AB' },
      { id: 's_bc', a: 'B', b: 'C', label: 'BC' },
    ],
  };
}

let container: HTMLDivElement;
let root: Root;
let restoreRect: () => void;
let restoreContext: () => void;
let spokenTexts: string[] = [];

let testDrivers: Drivers;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  spokenTexts = [];

  const proto = HTMLCanvasElement.prototype;
  const originalRect = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function rect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: SIZE,
      bottom: SIZE,
      width: SIZE,
      height: SIZE,
      toJSON: () => ({}),
    } as DOMRect;
  };
  restoreRect = () => {
    proto.getBoundingClientRect = originalRect;
  };

  const originalContext = proto.getContext;
  proto.getContext = (() => null) as typeof proto.getContext;
  restoreContext = () => {
    proto.getContext = originalContext;
  };

  testDrivers = {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn((text: string) => {
        spokenTexts.push(text);
      }),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  };

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  restoreRect();
  restoreContext();
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
});

function mountTeach(initialScene?: DiagramScene): void {
  act(() => {
    root.render(
      createElement(Teach, {
        initialScene: initialScene ?? createTestScene(),
        drivers: testDrivers,
        onBack: vi.fn(),
      }),
    );
  });
}

function clickButton(nameOrText: string): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'));
  const found = buttons.find(
    (b) =>
      b.textContent?.trim() === nameOrText ||
      b.getAttribute('aria-label') === nameOrText,
  );
  if (!found) {
    throw new Error(
      `Button "${nameOrText}" not found. Available buttons: ${buttons.map((b) => b.textContent?.trim()).join(', ')}`,
    );
  }
  act(() => {
    found.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  return found;
}

function pointerDownCanvas(normX: number, normY: number): void {
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('Canvas not found');
  act(() => {
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: normX * SIZE,
        clientY: normY * SIZE,
        pointerId: 1,
      }),
    );
  });
}

describe('Ghostwriter in Teach mode (Task 36)', () => {
  it('both controls have an accessible name and are at least 48 × 48 CSS px', () => {
    mountTeach();

    const buttons = Array.from(container.querySelectorAll('button'));
    const pointBtn = buttons.find((b) => b.textContent?.trim() === t('teach.addPoint'));
    const edgeBtn = buttons.find((b) => b.textContent?.trim() === t('teach.addEdge'));

    expect(pointBtn).toBeDefined();
    expect(edgeBtn).toBeDefined();

    expect(pointBtn!.textContent?.trim()).toBe(t('teach.addPoint'));
    expect(edgeBtn!.textContent?.trim()).toBe(t('teach.addEdge'));

    // Both use the .gt-control class which enforces 48×48 px targets
    expect(pointBtn!.classList.contains('gt-control')).toBe(true);
    expect(edgeBtn!.classList.contains('gt-control')).toBe(true);
  });

  it('add point by tap and by a second press', () => {
    mountTeach();

    // 1. Add point by tap
    clickButton(t('teach.addPoint'));
    expect(spokenTexts).toContain(t('teach.addPointArmed'));

    // Tap at (0.3, 0.4)
    pointerDownCanvas(0.3, 0.4);
    const addedTapSpeech = spokenTexts.find((s) => s.includes('Added Point'));
    expect(addedTapSpeech).toBeDefined();

    // 2. Add point by second press (placed at centre 0.5, 0.5)
    clickButton(t('teach.addPoint'));
    clickButton(t('teach.addPoint'));
    const addedCenterSpeech = spokenTexts.filter((s) => s.includes('Added Point'));
    expect(addedCenterSpeech.length).toBeGreaterThanOrEqual(2);
  });

  it('add edge between two existing points', () => {
    mountTeach();

    // Triangle has points A at (0.2, 0.8), B at (0.8, 0.8), C at (0.5, 0.2).
    // Segment AC is currently missing.
    clickButton(t('teach.addEdge'));
    expect(spokenTexts).toContain(t('teach.addEdgeFirst'));

    // Tap point A (0.2, 0.8)
    pointerDownCanvas(0.2, 0.8);
    expect(spokenTexts.some((s) => s.includes('A') && s.includes('second point'))).toBe(true);

    // Tap point C (0.5, 0.2)
    pointerDownCanvas(0.5, 0.2);
    expect(spokenTexts.some((s) => s.includes('Joined') && s.includes('A') && s.includes('C'))).toBe(
      true,
    );
  });

  it('each no-op reason is spoken', () => {
    mountTeach();

    // 1. Same point
    clickButton(t('teach.addEdge'));
    pointerDownCanvas(0.2, 0.8); // Pick A
    pointerDownCanvas(0.2, 0.8); // Pick A again
    expect(spokenTexts).toContain(t('teach.edgeSamePoint'));

    // 2. Already joined (A and B are joined)
    pointerDownCanvas(0.8, 0.8); // Pick B while still in addEdgeSecond
    expect(spokenTexts.some((s) => s.includes('already joined'))).toBe(true);

    // 3. Unknown point (pure flow contract)
    const scene = createTestScene();
    const unknownRes = planAddSegment(scene, 'A', 'Z');
    expect(unknownRes.kind).toBe('unknownPoint');
    expect(ghostwriterSpeech(unknownRes)).toBe(t('teach.edgeUnknownPoint'));

    // 4. Bad coordinates (pure flow contract)
    const badCoordsRes = planAddPoint(scene, NaN, 0.5);
    expect(badCoordsRes.kind).toBe('badCoords');
    expect(ghostwriterSpeech(badCoordsRes)).toBe(t('teach.pointBadCoords'));
  });

  it('undo of each add is spoken', () => {
    mountTeach();

    // 1. Add point then undo
    clickButton(t('teach.addPoint'));
    clickButton(t('teach.addPoint')); // Adds at centre (id D)
    clickButton(t('teach.undo'));
    expect(spokenTexts.some((s) => s.includes('Undone: point') && s.includes('removed'))).toBe(
      true,
    );

    // 2. Add edge then undo
    clickButton(t('teach.addEdge'));
    pointerDownCanvas(0.2, 0.8); // A
    pointerDownCanvas(0.5, 0.2); // C
    clickButton(t('teach.undo'));
    expect(spokenTexts.some((s) => s.includes('Undone: edge from') && s.includes('removed'))).toBe(
      true,
    );
  });

  it('refuses add at the point cap (300 points)', () => {
    const fullPoints = Array.from({ length: GHOSTWRITER_POINT_CAP }, (_, i) => ({
      id: `P${i}`,
      x: 0.5,
      y: 0.5,
    }));
    const cappedScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: fullPoints,
      segments: [],
    };

    mountTeach(cappedScene);

    clickButton(t('teach.addPoint'));
    clickButton(t('teach.addPoint'));

    expect(
      spokenTexts.some(
        (s) =>
          s.includes(String(GHOSTWRITER_POINT_CAP)) &&
          s.includes('points') &&
          s.includes('shared'),
      ),
    ).toBe(true);
  });

  it('Explore renders no add control', () => {
    act(() => {
      root.render(
        createElement(Explore, {
          scene: createTestScene(),
          announced: 'Explore test',
          drivers: testDrivers,
          onBack: vi.fn(),
        }),
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const addControls = buttons.filter((b) => {
      const text = b.textContent?.trim().toLowerCase() ?? '';
      const aria = b.getAttribute('aria-label')?.toLowerCase() ?? '';
      return (
        text.includes('add point') ||
        text.includes('add edge') ||
        text.includes('add vertex') ||
        aria.includes('add point') ||
        aria.includes('add edge') ||
        aria.includes('add vertex')
      );
    });

    expect(addControls).toHaveLength(0);
  });

  it('20.6 Spec Ghost example: silent until missing element is added in Teach', () => {
    // Triangle with vertices A, B, C and facts for AB, BC, CD.
    // CD is in facts but missing from points/segments, so verifyScene is silent/consistent.
    const initialScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      title: 'Triangle with missing CD',
      points: [
        { id: 'A', x: 0.1, y: 0.8, label: 'A' },
        { id: 'B', x: 0.7, y: 0.8, label: 'B' },
        { id: 'C', x: 0.1, y: 0.2, label: 'C' },
      ],
      segments: [
        { id: 's_ab', a: 'A', b: 'B', label: 'AB' },
        { id: 's_ca', a: 'C', b: 'A', label: 'CA' },
      ],
      facts: ['AB = 6 cm', 'CA = 6 cm', 'CD = 50 cm'],
    };

    // Before adding: caveat is null, announcement contains no disagreement
    const beforeCaveat = verifyCaveatForScene(initialScene, 'shared');
    expect(beforeCaveat).toBeNull();
    const beforeAnnounce = exploreAnnouncement(initialScene, 'shared');
    expect(beforeAnnounce).not.toContain('disagree');

    // In Teach mode: add missing point D and segment CD
    const step1 = planAddPoint(initialScene, 0.2, 0.2, 'D');
    expect(step1.kind).toBe('added');
    if (step1.kind !== 'added') throw new Error('expected added');
    const step2 = planAddSegment(step1.scene, 'C', step1.id);
    expect(step2.kind).toBe('added');
    if (step2.kind !== 'added') throw new Error('expected added');

    const editedScene = step2.scene;

    // After adding: drawn CD (drawn length ~0.1) wildly disagrees with fact CD = 50 cm
    const afterCaveat = verifyCaveatForScene(editedScene, 'shared');
    expect(afterCaveat).not.toBeNull();
    expect(afterCaveat).toContain('Facts and drawing disagree on CD');
    expect(afterCaveat).not.toContain('verified');
    expect(afterCaveat).not.toContain('correct');

    const afterAnnounce = exploreAnnouncement(editedScene, 'shared');
    expect(afterAnnounce).toContain('Facts and drawing disagree on CD');
  });
});
