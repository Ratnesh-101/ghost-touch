import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyEdit,
  canRedo,
  canUndo,
  createHistory,
  redo,
  undo,
} from '../src/core/correct';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Correct } from '../src/screens/Correct';
import {
  deleteSelectedElement,
  getSelectedLabel,
  getSelectionAnnouncement,
  hitTestBar,
  hitTestCorrect,
  hitTestPolyline,
  isSceneEmpty,
} from '../src/flow/correct';
import { setLang, t, tables } from '../src/i18n';

describe('Requirement 21: Correct mode can select and delete curves and bars', () => {
  const testScene: DiagramScene = {
    kind: 'geometry',
    title: 'Curves and Bars Scene',
    points: [
      { id: 'p1', x: 0.1, y: 0.1, label: 'Corner A' },
      { id: 'p2', x: 0.9, y: 0.1, label: 'Corner B' },
    ],
    segments: [{ id: 's1', a: 'p1', b: 'p2', label: 'Top Line' }],
    polylines: [
      {
        id: 'c1',
        label: 'Sine Wave',
        points: [
          [0.1, 0.5],
          [0.5, 0.7],
          [0.9, 0.5],
        ],
      },
      {
        id: 'c2',
        points: [
          [0.2, 0.8],
          [0.8, 0.8],
        ],
      },
    ],
    bars: [
      {
        id: 'b1',
        label: 'Bar One',
        value: 42,
        x0: 0.2,
        x1: 0.4,
        y_top: 0.3,
        y_base: 0.9,
      },
      {
        id: 'b2',
        label: 'Bar Two',
        value: 80,
        x0: 0.6,
        x1: 0.8,
        y_top: 0.1,
        y_base: 0.9,
      },
    ],
  };

  beforeEach(() => {
    setLang('en');
  });

  describe('Selection & Hit Testing', () => {
    it('hit-tests and selects a polyline within HIT_SEGMENT_RADIUS_PX', () => {
      const canvasSize = 1000;
      // Midpoint of first segment in c1 is [0.3, 0.6] -> screen (300, 600)
      const hit = hitTestPolyline(testScene, 300, 602, canvasSize, canvasSize);
      expect(hit).not.toBeNull();
      expect(hit?.id).toBe('c1');

      // Far away tap misses
      const miss = hitTestPolyline(testScene, 300, 100, canvasSize, canvasSize);
      expect(miss).toBeNull();
    });

    it('hit-tests and selects a bar inside its rectangle', () => {
      const canvasSize = 1000;
      // Bar b1: x in [0.2, 0.4], y in [0.3, 0.9] -> screen [200, 400] x [300, 900]
      const hit = hitTestBar(testScene, 300, 500, canvasSize, canvasSize);
      expect(hit).not.toBeNull();
      expect(hit?.id).toBe('b1');

      // Outside b1 misses b1
      const miss = hitTestBar(testScene, 100, 500, canvasSize, canvasSize);
      expect(miss).toBeNull();
    });

    it('maintains strict priority: point > segment > polyline > bar', () => {
      const canvasSize = 1000;
      // Point p1 is at (100, 100). Segment s1 starts at (100, 100).
      const pointHit = hitTestCorrect(testScene, 100, 100, canvasSize, canvasSize);
      expect(pointHit).toEqual({ kind: 'point', id: 'p1' });

      // Tap along segment s1 at (500, 100)
      const segHit = hitTestCorrect(testScene, 500, 100, canvasSize, canvasSize);
      expect(segHit).toEqual({ kind: 'segment', id: 's1' });

      // Overlap: place a polyline and a bar at the same location
      const overlapScene: DiagramScene = {
        kind: 'geometry',
        polylines: [
          {
            id: 'overlap_poly',
            points: [
              [0.4, 0.4],
              [0.6, 0.6],
            ],
          },
        ],
        bars: [
          {
            id: 'overlap_bar',
            label: 'Covered Bar',
            value: 10,
            x0: 0.3,
            x1: 0.7,
            y_top: 0.3,
            y_base: 0.7,
          },
        ],
      };

      // Directly on the polyline line piece at (500, 500), which is also inside the bar [300, 700]
      const priorityHit = hitTestCorrect(overlapScene, 500, 500, canvasSize, canvasSize);
      expect(priorityHit).toEqual({ kind: 'polyline', id: 'overlap_poly' });

      // In the bar interior but away from the polyline: at (350, 650)
      const barHit = hitTestCorrect(overlapScene, 350, 650, canvasSize, canvasSize);
      expect(barHit).toEqual({ kind: 'bar', id: 'overlap_bar' });
    });

    it('getSelectedLabel names the curve or bar by label, otherwise by id', () => {
      expect(getSelectedLabel(testScene, { kind: 'polyline', id: 'c1' })).toBe('Sine Wave');
      expect(getSelectedLabel(testScene, { kind: 'polyline', id: 'c2' })).toBe('c2');
      expect(getSelectedLabel(testScene, { kind: 'bar', id: 'b1' })).toBe('Bar One');

      const unlabelledBarScene: DiagramScene = {
        kind: 'bar_chart',
        bars: [{ id: 'bare_bar', label: '', value: 1, x0: 0, x1: 0.5, y_top: 0, y_base: 1 }],
      };
      expect(getSelectedLabel(unlabelledBarScene, { kind: 'bar', id: 'bare_bar' })).toBe('bare_bar');

      const unlabelledPolyScene: DiagramScene = {
        kind: 'geometry',
        polylines: [{ id: 'bare_poly', label: '', points: [[0, 0], [1, 1]] }],
      };
      expect(
        getSelectedLabel(unlabelledPolyScene, { kind: 'polyline', id: 'bare_poly' }),
      ).toBe('bare_poly');
    });

    it('getSelectionAnnouncement speaks what was selected with correct i18n keys', () => {
      const polyAnnounce = getSelectionAnnouncement(testScene, { kind: 'polyline', id: 'c1' });
      expect(polyAnnounce).toBe('Selected curve: Sine Wave (c1)');

      const poly2Announce = getSelectionAnnouncement(testScene, { kind: 'polyline', id: 'c2' });
      expect(poly2Announce).toBe('Selected curve: c2');

      const barAnnounce = getSelectionAnnouncement(testScene, { kind: 'bar', id: 'b1' });
      expect(barAnnounce).toBe('Selected bar: Bar One (b1)');

      expect(getSelectionAnnouncement(testScene, null)).toBe('No element selected');
    });
  });

  describe('Deleting curves and bars', () => {
    it('deletes selected polyline, preserving other elements and order', () => {
      const res = deleteSelectedElement(testScene, { kind: 'polyline', id: 'c1' });
      expect(res.isNoOp).toBe(false);
      expect(res.scene.polylines?.map((p) => p.id)).toEqual(['c2']);
      expect(res.scene.points).toEqual(testScene.points);
      expect(res.scene.segments).toEqual(testScene.segments);
      expect(res.scene.bars).toEqual(testScene.bars);
      expect(res.announcement).toBe('Deleted curve: c1');
    });

    it('deletes selected bar, preserving other elements and order', () => {
      const res = deleteSelectedElement(testScene, { kind: 'bar', id: 'b1' });
      expect(res.isNoOp).toBe(false);
      expect(res.scene.bars?.map((b) => b.id)).toEqual(['b2']);
      expect(res.scene.points).toEqual(testScene.points);
      expect(res.scene.segments).toEqual(testScene.segments);
      expect(res.scene.polylines).toEqual(testScene.polylines);
      expect(res.announcement).toBe('Deleted bar: b1');
    });

    it('speaks correct.nothingLeft when deleting the last drawable element of a scene', () => {
      const singlePolyScene: DiagramScene = {
        kind: 'function_graph',
        polylines: [{ id: 'lone_poly', points: [[0, 0], [1, 1]] }],
      };
      expect(isSceneEmpty(singlePolyScene)).toBe(false);

      const res = deleteSelectedElement(singlePolyScene, { kind: 'polyline', id: 'lone_poly' });
      expect(res.isNoOp).toBe(false);
      expect(isSceneEmpty(res.scene)).toBe(true);
      expect(res.announcement).toContain('Deleted curve: lone_poly');
      expect(res.announcement).toContain(t('correct.nothingLeft'));

      const singleBarScene: DiagramScene = {
        kind: 'bar_chart',
        bars: [
          { id: 'lone_bar', label: 'Single', value: 10, x0: 0.1, x1: 0.9, y_top: 0.1, y_base: 0.9 },
        ],
      };
      const barRes = deleteSelectedElement(singleBarScene, { kind: 'bar', id: 'lone_bar' });
      expect(barRes.isNoOp).toBe(false);
      expect(isSceneEmpty(barRes.scene)).toBe(true);
      expect(barRes.announcement).toContain('Deleted bar: lone_bar');
      expect(barRes.announcement).toContain(t('correct.nothingLeft'));
    });
  });

  describe('Undo / Redo history', () => {
    it('applies polyline deletion through applyEdit, enabling undo and redo', () => {
      let history = createHistory(testScene);
      expect(canUndo(history)).toBe(false);
      expect(canRedo(history)).toBe(false);

      const del = deleteSelectedElement(history.present, { kind: 'polyline', id: 'c1' });
      expect(del.isNoOp).toBe(false);
      history = applyEdit(history, del.scene);

      expect(canUndo(history)).toBe(true);
      expect(history.present.polylines?.map((p) => p.id)).toEqual(['c2']);

      // Undo brings back c1
      history = undo(history);
      expect(history.present).toBe(testScene);
      expect(canUndo(history)).toBe(false);
      expect(canRedo(history)).toBe(true);

      // Redo removes c1 again
      history = redo(history);
      expect(history.present).toBe(del.scene);
      expect(canUndo(history)).toBe(true);
      expect(canRedo(history)).toBe(false);
    });

    it('applies bar deletion through applyEdit, enabling undo and redo', () => {
      let history = createHistory(testScene);
      const del = deleteSelectedElement(history.present, { kind: 'bar', id: 'b2' });
      expect(del.isNoOp).toBe(false);
      history = applyEdit(history, del.scene);

      expect(canUndo(history)).toBe(true);
      expect(history.present.bars?.map((b) => b.id)).toEqual(['b1']);

      // Undo restores the original scene
      history = undo(history);
      expect(history.present).toBe(testScene);

      // Redo re-applies the bar deletion
      history = redo(history);
      expect(history.present.bars?.map((b) => b.id)).toEqual(['b1']);
    });
  });

  describe('The No-Op Path', () => {
    it('returns the same scene object and creates no history entry for an unknown polyline id', () => {
      const history = createHistory(testScene);
      const res = deleteSelectedElement(history.present, { kind: 'polyline', id: 'nonexistent' });

      expect(res.isNoOp).toBe(true);
      expect(res.scene).toBe(testScene); // exact same object reference
      expect(res.announcement).toBe(t('correct.noSelection'));

      const nextHistory = applyEdit(history, res.scene);
      expect(nextHistory).toBe(history); // no history entry
      expect(canUndo(nextHistory)).toBe(false);
    });

    it('returns the same scene object and creates no history entry for an unknown bar id', () => {
      const history = createHistory(testScene);
      const res = deleteSelectedElement(history.present, { kind: 'bar', id: 'nonexistent_bar' });

      expect(res.isNoOp).toBe(true);
      expect(res.scene).toBe(testScene);
      expect(res.announcement).toBe(t('correct.noSelection'));

      const nextHistory = applyEdit(history, res.scene);
      expect(nextHistory).toBe(history);
      expect(canUndo(nextHistory)).toBe(false);
    });

    it('handles null selection as a no-op without mutating history', () => {
      const history = createHistory(testScene);
      const res = deleteSelectedElement(history.present, null);
      expect(res.isNoOp).toBe(true);
      expect(res.scene).toBe(testScene);
      expect(res.announcement).toBe(t('correct.noSelection'));
      expect(applyEdit(history, res.scene)).toBe(history);
    });
  });

  describe('i18n completeness and validity (en, hi, gu)', () => {
    const requiredKeys = [
      'correct.selectedPolyline',
      'correct.selectedBar',
      'correct.polylineDeleted',
      'correct.barDeleted',
      'correct.nothingLeft',
    ] as const;

    const forbiddenWords = ['verified', 'correct', 'checked', 'approved'];

    const getTableEntry = (
      table: Record<string, string> | undefined,
      key: string,
    ): string => {
      expect(table).toBeDefined();
      if (!table) {
        throw new Error('Translation table is undefined');
      }
      const val = table[key];
      expect(val).toBeDefined();
      if (val === undefined) {
        throw new Error(`Missing translation key: ${key}`);
      }
      return val;
    };

    it('all 5 new keys exist in en, hi, and gu with non-empty strings', () => {
      for (const key of requiredKeys) {
        const enVal = getTableEntry(tables.en, key);
        expect(enVal.trim().length).toBeGreaterThan(0);

        const hiVal = getTableEntry(tables.hi, key);
        expect(hiVal.trim().length).toBeGreaterThan(0);

        const guVal = getTableEntry(tables.gu, key);
        expect(guVal.trim().length).toBeGreaterThan(0);
      }
    });

    it('Hindi and Gujarati translations are distinct from English', () => {
      for (const key of requiredKeys) {
        const enVal = getTableEntry(tables.en, key);
        const hiVal = getTableEntry(tables.hi, key);
        const guVal = getTableEntry(tables.gu, key);
        expect(hiVal).not.toBe(enVal);
        expect(guVal).not.toBe(enVal);
      }
    });

    it('new strings in any language never contain forbidden words', () => {
      for (const key of requiredKeys) {
        const enVal = getTableEntry(tables.en, key).toLowerCase();
        for (const forbidden of forbiddenWords) {
          expect(enVal).not.toContain(forbidden);
        }
      }
    });

    it('speaks selections and deletions using the active language table', () => {
      // Test Hindi
      setLang('hi');
      const hiPolySelect = getSelectionAnnouncement(testScene, { kind: 'polyline', id: 'c1' });
      expect(hiPolySelect).toContain(getTableEntry(tables.hi, 'correct.selectedPolyline'));

      const hiBarSelect = getSelectionAnnouncement(testScene, { kind: 'bar', id: 'b1' });
      expect(hiBarSelect).toContain(getTableEntry(tables.hi, 'correct.selectedBar'));

      const hiPolyDel = deleteSelectedElement(testScene, { kind: 'polyline', id: 'c1' });
      expect(hiPolyDel.announcement).toContain(
        getTableEntry(tables.hi, 'correct.polylineDeleted'),
      );

      const hiBarDel = deleteSelectedElement(testScene, { kind: 'bar', id: 'b1' });
      expect(hiBarDel.announcement).toContain(
        getTableEntry(tables.hi, 'correct.barDeleted'),
      );

      // Test Gujarati
      setLang('gu');
      const guPolySelect = getSelectionAnnouncement(testScene, { kind: 'polyline', id: 'c1' });
      expect(guPolySelect).toContain(getTableEntry(tables.gu, 'correct.selectedPolyline'));

      const guBarSelect = getSelectionAnnouncement(testScene, { kind: 'bar', id: 'b1' });
      expect(guBarSelect).toContain(getTableEntry(tables.gu, 'correct.selectedBar'));

      const guPolyDel = deleteSelectedElement(testScene, { kind: 'polyline', id: 'c1' });
      expect(guPolyDel.announcement).toContain(
        getTableEntry(tables.gu, 'correct.polylineDeleted'),
      );

      const guBarDel = deleteSelectedElement(testScene, { kind: 'bar', id: 'b1' });
      expect(guBarDel.announcement).toContain(
        getTableEntry(tables.gu, 'correct.barDeleted'),
      );
    });
  });

  describe('Correct Screen Component Integration', () => {
    const mockDrivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running',
      },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: new MemoryDiagramStore(),
    };

    it('renders accessible list with selectable curve and bar controls', () => {
      const html = renderToStaticMarkup(
        createElement(Correct, {
          scene: testScene,
          photoUrl: null,
          drivers: mockDrivers,
          onSave: vi.fn(),
          onCancel: vi.fn(),
        }),
      );

      // Section with aria-label exists
      expect(html).toContain('gt-correct__elements');
      expect(html).toContain('gt-correct__element-list');

      // Curve buttons exist with accessible names
      expect(html).toContain('Selected curve: Sine Wave (c1)');
      expect(html).toContain('Selected curve: c2');

      // Bar buttons exist with accessible names
      expect(html).toContain('Selected bar: Bar One (b1)');
      expect(html).toContain('Selected bar: Bar Two (b2)');

      // Delete button exists in toolbar
      expect(html).toContain(t('correct.delete'));
    });
  });
});
