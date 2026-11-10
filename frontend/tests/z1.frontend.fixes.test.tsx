// @vitest-environment jsdom
/**
 * Test suite for Lane z1-r6-frontend-fixes
 *
 * Verifies the 4 active requirements from docs/briefs/agy-z1-r6-frontend-fixes.md:
 * 1. Focus transfer to canvas and announcement on Teach Add point second press and Add edge.
 * 2. Teacher note and name sanitization in VerifiedBanner.
 * 3. Deleted announcement string replacer preventing template injection with $, $&, $1, $'.
 * 6. Reserved ID prevention in flow/teach.ts (title, scene:title, __proto__, etc.).
 *
 * Requirements 4 and 5 were reverted and deferred in pass 2 per supervisor direction.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  MemoryDiagramStore,
  type Drivers,
  type SpeechRateSetting,
} from '../src/drivers';
import { Teach } from '../src/screens/Teach';
import { VerifiedBanner } from '../src/components/VerifiedBanner';
import { deletedAnnouncement } from '../src/flow/saved';
import {
  addVertex,
  generateUniquePointId,
  isReservedId,
  RESERVED_IDS,
} from '../src/flow/teach';
import { setLang, t } from '../src/i18n';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const CANVAS_SIZE = 400;

function createTestTriangle(): DiagramScene {
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

describe('Lane z1-r6-frontend-fixes', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreRect: () => void;
  let restoreContext: () => void;
  let spokenTexts: string[];
  let testDrivers: Drivers;

  beforeEach(() => {
    setLang('en');
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
        right: CANVAS_SIZE,
        bottom: CANVAS_SIZE,
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
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
        getRate: vi.fn((): SpeechRateSetting => 'normal'),
        setRate: vi.fn(),
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
          initialScene: initialScene ?? createTestTriangle(),
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
      throw new Error(`Button "${nameOrText}" not found.`);
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
          clientX: normX * CANVAS_SIZE,
          clientY: normY * CANVAS_SIZE,
          pointerId: 1,
        }),
      );
    });
  }

  // ---------------------------------------------------------------------------
  // 1. MED, screens/Teach.tsx + components/teach/TeachCanvas.tsx
  // ---------------------------------------------------------------------------
  describe('Requirement 1: Teach focus transfer & speech on Add point and Add edge', () => {
    it('moves focus to canvas when second press of Add point places centre point', () => {
      mountTeach();
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();

      // First press: arms Add point mode
      const addPointBtn = clickButton(t('teach.addPoint'));
      expect(spokenTexts).toContain(t('teach.addPointArmed'));

      // Second press: places point at centre (0.5, 0.5)
      clickButton(t('teach.addPoint'));

      // Focus must NOT remain on the Add point button; it must move to the canvas
      expect(document.activeElement).not.toBe(addPointBtn);
      expect(document.activeElement).toBe(canvas);

      // Point addition announcement was spoken
      const addedSpeech = spokenTexts.find((s) => s.includes('Added Point'));
      expect(addedSpeech).toBeDefined();
    });

    it('moves focus to canvas and announces when Add edge completes', () => {
      mountTeach();
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();

      // Click Add edge toolbar button
      clickButton(t('teach.addEdge'));
      expect(spokenTexts).toContain(t('teach.addEdgeFirst'));

      // Pick first point A at (0.2, 0.8)
      pointerDownCanvas(0.2, 0.8);
      expect(spokenTexts.some((s) => s.includes('A') && s.includes('second point'))).toBe(true);

      // Pick second point C at (0.5, 0.2) to complete the edge
      pointerDownCanvas(0.5, 0.2);

      // Focus must be moved to the canvas
      expect(document.activeElement).toBe(canvas);

      // Spoken announcement confirms the edge was joined
      const joinedSpeech = spokenTexts.some(
        (s) => s.includes('Joined') && s.includes('A') && s.includes('C'),
      );
      expect(joinedSpeech).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. MED, components/VerifiedBanner.tsx
  // ---------------------------------------------------------------------------
  describe('Requirement 2: VerifiedBanner sanitizes note and teacher name', () => {
    it('strips check-mark emoji, invisible marks and badge words from note and name', () => {
      const onSpeak = vi.fn();
      act(() => {
        root.render(
          createElement(VerifiedBanner, {
            by: '✅ Verified Dr Sharma',
            note: '✅ Verified exam solution for chapter 3',
            onSpeak,
          }),
        );
      });

      // Name sanitized: no checkmark or "Verified"
      const authorText = container.querySelector('.gt-verified-banner__name')?.textContent ?? '';
      expect(authorText).not.toContain('✅');
      expect(authorText).not.toContain('Verified');
      expect(authorText).toContain('Dr Sharma');

      // Click "Read note" button
      const readNoteBtn = clickButton(t('share.readNote'));
      expect(readNoteBtn).toBeDefined();

      // Note rendered without checkmark or "Verified"
      const noteBody = container.querySelector('.gt-verified-banner__note-text');
      expect(noteBody).not.toBeNull();
      expect(noteBody?.textContent).not.toContain('✅');
      expect(noteBody?.textContent).not.toContain('Verified');
      expect(noteBody?.textContent).toBe('exam solution for chapter 3');

      // Note spoken via onSpeak without checkmark or "Verified"
      expect(onSpeak).toHaveBeenCalledWith('exam solution for chapter 3');
    });

    it('does not render note button if note is only checkmark and badge words', () => {
      act(() => {
        root.render(
          createElement(VerifiedBanner, {
            by: 'Teacher Alex',
            note: '✅ Verified',
          }),
        );
      });

      // When note is only badge words/emojis, sanitized note is empty, no button rendered
      const buttons = Array.from(container.querySelectorAll('button'));
      const noteBtn = buttons.find((b) => b.textContent?.trim() === t('share.readNote'));
      expect(noteBtn).toBeUndefined();
      expect(container.querySelector('.gt-verified-banner__note-body')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. MED, flow/saved.ts around line 52
  // ---------------------------------------------------------------------------
  describe('Requirement 3: deletedAnnouncement preserves $, $&, $1, $\' verbatim', () => {
    it('preserves $1 pattern without backreference corruption', () => {
      const announced = deletedAnnouncement('Quarterly Revenue: $100M', 3);
      expect(announced).toBe('Deleted Quarterly Revenue: $100M.');
    });

    it('preserves $& match pattern verbatim', () => {
      const announced = deletedAnnouncement('Cost of $& item', 2);
      expect(announced).toBe('Deleted Cost of $& item.');
    });

    it('preserves $\' and $` patterns verbatim', () => {
      const announced = deletedAnnouncement('Prices: $\' and $` test', 1);
      expect(announced).toBe('Deleted Prices: $\' and $` test.');
    });

    it('joins empty message when remaining is 0', () => {
      const announced = deletedAnnouncement('Budget $1', 0);
      expect(announced).toContain('Budget $1');
      expect(announced).toContain(t('saved.empty'));
    });
  });

  // ---------------------------------------------------------------------------
  // 6. HIGH (frontend half only), flow/teach.ts reserved id check
  // ---------------------------------------------------------------------------
  describe('Requirement 6: Teach ID generator never produces reserved IDs', () => {
    it('isReservedId recognizes reserved keywords case-insensitively', () => {
      for (const id of RESERVED_IDS) {
        expect(isReservedId(id)).toBe(true);
        expect(isReservedId(id.toUpperCase())).toBe(true);
        expect(isReservedId(`  ${id}  `)).toBe(true);
      }
      expect(isReservedId('title')).toBe(true);
      expect(isReservedId('TITLE')).toBe(true);
      expect(isReservedId('scene:title')).toBe(true);
      expect(isReservedId('__proto__')).toBe(true);
      expect(isReservedId('constructor')).toBe(true);
      expect(isReservedId('prototype')).toBe(true);

      // Safe IDs
      expect(isReservedId('p1')).toBe(false);
      expect(isReservedId('pointA')).toBe(false);
      expect(isReservedId('title_point')).toBe(false);
    });

    it('generateUniquePointId never produces a reserved id', () => {
      const scene: DiagramScene = {
        version: 1,
        kind: 'geometry',
        title: 'Collision test',
        points: [],
      };
      const id = generateUniquePointId(scene);
      expect(isReservedId(id)).toBe(false);
      expect(id).toMatch(/^p\d+$/);
    });

    it('addVertex rejects reserved IDs and generates a safe replacement ID', () => {
      const scene: DiagramScene = {
        version: 1,
        kind: 'geometry',
        title: 'Reserved ID scene',
        points: [],
      };

      // Disallowed: title
      const resTitle = addVertex(scene, { x: 0.1, y: 0.2 }, 'title');
      expect(resTitle.newPointId).not.toBe('title');
      expect(isReservedId(resTitle.newPointId)).toBe(false);
      expect(resTitle.scene.points?.[0]?.id).not.toBe('title');

      // Disallowed: __proto__
      const resProto = addVertex(scene, { x: 0.1, y: 0.2 }, '__proto__');
      expect(resProto.newPointId).not.toBe('__proto__');
      expect(isReservedId(resProto.newPointId)).toBe(false);

      // Disallowed: CONSTRUCTOR (case-insensitive)
      const resConstructor = addVertex(scene, { x: 0.1, y: 0.2 }, 'CONSTRUCTOR');
      expect(resConstructor.newPointId.toLowerCase()).not.toBe('constructor');
      expect(isReservedId(resConstructor.newPointId)).toBe(false);

      // Disallowed: scene:title
      const resSceneTitle = addVertex(scene, { x: 0.1, y: 0.2 }, 'scene:title');
      expect(resSceneTitle.newPointId).not.toBe('scene:title');
      expect(isReservedId(resSceneTitle.newPointId)).toBe(false);

      // Allowed valid ID:
      const resValid = addVertex(scene, { x: 0.1, y: 0.2 }, 'customPointA');
      expect(resValid.newPointId).toBe('customPointA');
      expect(resValid.scene.points?.[0]?.id).toBe('customPointA');
    });
  });
});
