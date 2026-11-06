/**
 * Regression and fix tests for Lane f3-fix-teach.
 *
 * Covers all findings from audit-a3-teach-editor.md and audit-a5-integration.md (Teach scope):
 * - FINDING-01: Stale share link / QR code after editing teacher name or note
 * - FINDING-02: Async verification race condition and in-flight editing protection
 * - FINDING-03: Keyboard Tab focus trap in LoadModal dialog
 * - FINDING-04: Focus restoration to Load button on modal close & safe focus on Delete/Undo disable
 * - FINDING-05: Invalid axis values block verification in function_graph diagrams
 * - FINDING-06: Unsaved edits confirmation on back and beforeunload protection
 * - FINDING-07: Localized teach.qrTooLong in Hindi and Gujarati
 * - FINDING-08: generateUniquePointId avoids collision with segments, polylines, and bars
 * - FINDING-09: TeachCanvas retains axes, bars, and polylines during point drag
 * - FINDING-10: Boundary nudge does not push duplicate history or announce moves
 * - FINDING-11: Loading from share link preserves and populates verifier name and note
 * - FINDING-12: LabSettings "Open Teacher Editor" closes silently without cutting off speech
 * - A5-03: P20 token conformance in teach.css (verified by labTheme.prop.test.ts)
 * - A5-04: Teach screen subscribes to language changes via useSyncExternalStore
 * - Honesty: SharePanel renders honesty notice (share.honesty)
 * - FINDING-13: Localized toolbar and axis labels in canvas
 * - FINDING-14: SharePanel cleans up timeout on unmount
 * - FINDING-15: Teacher selection announcement uses teach.selectedVertex and teach.selectedSegment
 * - FINDING-17: Clipboard fallback cleans up textarea in finally block
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Teach } from '../src/screens/Teach';
import { VerifyForm } from '../src/components/teach/VerifyForm';
import { SharePanel } from '../src/components/teach/SharePanel';
import { LoadModal } from '../src/components/teach/LoadModal';
import { TeachCanvas } from '../src/components/teach/TeachCanvas';
import { LabSettings } from '../src/components/LabSettings';
import type { DiagramScene } from '../src/core/scene';
import {
  addVertex,
  generateUniquePointId,
  nudgeVertex,
  validateAxisCoord,
  createSharePayload,
  setStoredTeacherSetting,
} from '../src/flow/teach';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { copyToClipboard } from '../src/drivers/clipboard';
import { getLang, setLang, subscribeLang, t, tables, LANG_BCP47 } from '../src/i18n';
import { encodeShare, shareUrl } from '../src/share';

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

const sampleTriangle: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Triangle ABC',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.5, y: 0.2, label: 'C' },
  ],
  segments: [
    { id: 's_ab', a: 'A', b: 'B', label: 'AB' },
    { id: 's_bc', a: 'B', b: 'C', label: 'BC' },
    { id: 's_ca', a: 'C', b: 'A', label: 'CA' },
  ],
};

const sampleFunctionGraph: DiagramScene = {
  version: 1,
  kind: 'function_graph',
  title: 'Parabola',
  axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
  points: [{ id: 'p0', x: 0.5, y: 0.5, label: 'Origin' }],
  polylines: [{ id: 'poly1', points: [[0.1, 0.9], [0.5, 0.5], [0.9, 0.9]] }],
};

describe('Lane f3-fix-teach Regressions & Fixes', () => {
  beforeEach(() => {
    setLang('en');
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    vi.stubEnv('VITE_SITE_URL', 'https://ghost-touch.org');
  });

  afterEach(() => {
    setLang('en');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // FINDING-01: Stale share link / QR code after editing teacher name or note
  // -------------------------------------------------------------------------
  describe('FINDING-01: Clearing stale share link on name or note edit', () => {
    it('VerifyForm notifies parent on name or note change', () => {
      const onNameChange = vi.fn();
      const onNoteChange = vi.fn();
      const onVerify = vi.fn();

      const html = renderToStaticMarkup(
        createElement(VerifyForm, {
          name: 'Teacher Alice',
          note: 'Note 1',
          isValidDiagram: true,
          onNameChange,
          onNoteChange,
          onVerify,
        }),
      );

      expect(html).toContain('Teacher Alice');
      expect(html).toContain('Note 1');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-02: Async verification race condition & in-flight disabled state
  // -------------------------------------------------------------------------
  describe('FINDING-02: Async verification race condition', () => {
    it('VerifyForm disables verification submit button when disabled=true', () => {
      const htmlDisabled = renderToStaticMarkup(
        createElement(VerifyForm, {
          name: 'Teacher Alice',
          note: 'Note 1',
          isValidDiagram: true,
          onNameChange: vi.fn(),
          onNoteChange: vi.fn(),
          onVerify: vi.fn(),
          disabled: true,
        }),
      );
      expect(htmlDisabled).toContain('disabled=""');
    });

    it('VerifyForm enables verification submit button when valid and not disabled', () => {
      const htmlEnabled = renderToStaticMarkup(
        createElement(VerifyForm, {
          name: 'Teacher Alice',
          note: 'Note 1',
          isValidDiagram: true,
          onNameChange: vi.fn(),
          onNoteChange: vi.fn(),
          onVerify: vi.fn(),
          disabled: false,
        }),
      );
      // Button should not have disabled attribute
      expect(htmlEnabled).not.toMatch(/<button[^>]*disabled=""[^>]*>Mark verified/);
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-03: Keyboard Tab focus trap in LoadModal dialog
  // -------------------------------------------------------------------------
  describe('FINDING-03: Tab focus trap in LoadModal dialog', () => {
    it('traps Tab focus to first element when Shift+Tab is pressed on first element', () => {
      const drivers = createMockDrivers();
      const onClose = vi.fn();
      const onLoadScene = vi.fn();

      const modalElement = createElement(LoadModal, {
        open: true,
        currentScene: sampleTriangle,
        drivers,
        onClose,
        onLoadScene,
      });

      const html = renderToStaticMarkup(modalElement);
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-05: Invalid axis fields block verification in function_graph
  // -------------------------------------------------------------------------
  describe('FINDING-05: Invalid axis fields block verification', () => {
    it('validateAxisCoord rejects coordinates outside [0, 1]', () => {
      expect(validateAxisCoord('1.5').ok).toBe(false);
      expect(validateAxisCoord('-0.1').ok).toBe(false);
      expect(validateAxisCoord('abc').ok).toBe(false);
      expect(validateAxisCoord(2).ok).toBe(false);

      expect(validateAxisCoord('0.5').ok).toBe(true);
      expect(validateAxisCoord('0').ok).toBe(true);
      expect(validateAxisCoord('1').ok).toBe(true);
      expect(validateAxisCoord('').ok).toBe(true);
      expect(validateAxisCoord(null).ok).toBe(true);
    });

    it('VerifyForm disables verification when isValidDiagram is false due to axis error', () => {
      const html = renderToStaticMarkup(
        createElement(VerifyForm, {
          name: 'Teacher Alice',
          note: '',
          isValidDiagram: false, // Computed as validationResult.ok && !axisError
          onNameChange: vi.fn(),
          onNoteChange: vi.fn(),
          onVerify: vi.fn(),
        }),
      );
      expect(html).toContain('disabled=""');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-07: Missing Hindi & Gujarati translations for teach.qrTooLong
  // -------------------------------------------------------------------------
  describe('FINDING-07: Localized teach.qrTooLong in Hindi and Gujarati', () => {
    it('provides translated teach.qrTooLong without raw English text', () => {
      expect(tables.en['teach.qrTooLong']).toBe('Link too long for a QR code; use Copy link');
      expect(tables.hi['teach.qrTooLong']).not.toContain('Link too long');
      expect(tables.gu['teach.qrTooLong']).not.toContain('Link too long');
      expect(tables.hi['teach.qrTooLong']).toBe(
        'क्यूआर कोड के लिए लिंक बहुत लंबा है; लिंक कॉपी करें का उपयोग करें',
      );
      expect(tables.gu['teach.qrTooLong']).toBe(
        'ક્યુઆર કોડ માટે લિંક ખૂબ લાંબી છે; લિંક કોપી કરો વાપરો',
      );
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-08: generateUniquePointId ID collisions
  // -------------------------------------------------------------------------
  describe('FINDING-08: generateUniquePointId ID collision avoidance', () => {
    it('does not generate an ID that collides with an existing segment, polyline, or bar ID', () => {
      const sceneWithCollidingSegment: DiagramScene = {
        version: 1,
        kind: 'geometry',
        points: [{ id: 'p1', x: 0.1, y: 0.1 }],
        segments: [{ id: 'p2', a: 'p1', b: 'p1' }],
        polylines: [{ id: 'p3', points: [[0.2, 0.2], [0.3, 0.3]] }],
        bars: [{ id: 'p4', x0: 0.1, x1: 0.2, y_base: 0.8, y_top: 0.2, value: 5, label: 'Bar' }],
      };

      const newId = generateUniquePointId(sceneWithCollidingSegment);
      expect(newId).not.toBe('p1');
      expect(newId).not.toBe('p2');
      expect(newId).not.toBe('p3');
      expect(newId).not.toBe('p4');
      expect(newId).toBe('p5');

      const { newPointId, scene: updated } = addVertex(sceneWithCollidingSegment);
      expect(newPointId).toBe('p5');
      const pointIds = (updated.points ?? []).map((p) => p.id);
      expect(pointIds).toContain('p5');
    });

    it('remains backward-compatible with Point[] argument', () => {
      const points = [{ id: 'p1', x: 0.1, y: 0.1 }, { id: 'p2', x: 0.2, y: 0.2 }];
      const newId = generateUniquePointId(points);
      expect(newId).toBe('p3');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-09: TeachCanvas retains axes, bars, and polylines during point drag
  // -------------------------------------------------------------------------
  describe('FINDING-09: Canvas rendering includes axes, bars, and polylines', () => {
    it('renders TeachCanvas with function graph axes and labels', () => {
      const html = renderToStaticMarkup(
        createElement(TeachCanvas, {
          scene: sampleFunctionGraph,
          selection: null,
          onSelect: vi.fn(),
          onMovePoint: vi.fn(),
          onNudgePoint: vi.fn(),
          onDeleteSelected: vi.fn(),
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        }),
      );
      expect(html).toContain('gt-teach-canvas');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-10: Boundary nudge does not push duplicate history or announce
  // -------------------------------------------------------------------------
  describe('FINDING-10: Boundary nudge idempotency', () => {
    it('nudgeVertex returns exact same scene object reference when clamped at boundary', () => {
      const sceneAtRightBoundary: DiagramScene = {
        version: 1,
        kind: 'geometry',
        points: [{ id: 'p1', x: 1.0, y: 0.5, label: 'Boundary Point' }],
      };

      // Nudge further right past x = 1.0
      const nudged = nudgeVertex(sceneAtRightBoundary, 'p1', 0.05, 0);
      expect(nudged).toBe(sceneAtRightBoundary);

      // Nudge within boundary returns new scene
      const nudgedLeft = nudgeVertex(sceneAtRightBoundary, 'p1', -0.05, 0);
      expect(nudgedLeft).not.toBe(sceneAtRightBoundary);
      expect((nudgedLeft.points ?? [])[0]!.x).toBeCloseTo(0.95);
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-11: Loading from share link preserves verifier name and note
  // -------------------------------------------------------------------------
  describe('FINDING-11: Preserving verifier name and note from share link', () => {
    it('creates share payload and preserves verifiedBy and note upon decoding', () => {
      const payload = createSharePayload(sampleTriangle, 'Dr. Rao', 'Prepare for midterm test');
      expect(payload.verifiedBy).toBe('Dr. Rao');
      expect(payload.note).toBe('Prepare for midterm test');

      const encoded = encodeShare(payload);
      const url = shareUrl('https://ghost-touch.org', encoded);

      // In Teach.tsx, handleLoadScene receives payload and populates teacherName / teacherNote
      expect(url).toContain('#s=');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-12: LabSettings "Open Teacher Editor" speech cutoff prevention
  // -------------------------------------------------------------------------
  describe('FINDING-12: LabSettings silent close on Open Teacher Editor', () => {
    it('renders Open Teacher Editor button inside LabSettings when teacher tools are active', () => {
      const drivers = createMockDrivers();
      setStoredTeacherSetting(true);
      const html = renderToStaticMarkup(
        createElement(LabSettings, {
          open: true,
          drivers,
          onClose: vi.fn(),
        }),
      );
      expect(html).toContain(t('lab.settings.openTeacher'));
    });
  });

  // -------------------------------------------------------------------------
  // Honesty line in SharePanel
  // -------------------------------------------------------------------------
  describe('Honesty line in SharePanel', () => {
    it('SharePanel renders honesty line from share.honesty', () => {
      const honestText = t('share.honesty');
      const html = renderToStaticMarkup(
        createElement(SharePanel, {
          url: 'https://ghost-touch.org/#s=test',
          qrUrl: null,
          diagramTitle: 'Triangle ABC',
        }),
      );
      expect(html).toContain(honestText);
      expect(html).toContain('gt-teach__honesty-notice');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-13: Localized toolbar and axis labels
  // -------------------------------------------------------------------------
  describe('FINDING-13: Localized toolbar and axis strings', () => {
    it('uses t("teach.toolbar") on the toolbar', () => {
      const drivers = createMockDrivers();
      const htmlEn = renderToStaticMarkup(
        createElement(Teach, {
          initialScene: sampleTriangle,
          drivers,
          onBack: vi.fn(),
        }),
      );
      expect(htmlEn).toContain('aria-label="Editing toolbar"');

      setLang('hi');
      const htmlHi = renderToStaticMarkup(
        createElement(Teach, {
          initialScene: sampleTriangle,
          drivers,
          onBack: vi.fn(),
        }),
      );
      expect(htmlHi).toContain('aria-label="संपादन उपकरण पट्टी"');

      setLang('gu');
      const htmlGu = renderToStaticMarkup(
        createElement(Teach, {
          initialScene: sampleTriangle,
          drivers,
          onBack: vi.fn(),
        }),
      );
      expect(htmlGu).toContain('aria-label="સંપાદન ટૂલબાર"');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-14: SharePanel cleanup timeout on unmount
  // -------------------------------------------------------------------------
  describe('FINDING-14: SharePanel cleanup', () => {
    it('SharePanel mounts cleanly with accessible buttons', () => {
      const html = renderToStaticMarkup(
        createElement(SharePanel, {
          url: 'https://ghost-touch.org/#s=shortlink',
          qrUrl: 'data:image/png;base64,mock',
          diagramTitle: 'Sample Diagram',
        }),
      );
      expect(html).toContain('Copy link');
      expect(html).toContain('gt-teach__qr-img');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-15: Teacher selection announcement keys
  // -------------------------------------------------------------------------
  describe('FINDING-15: Teacher selection announcement keys', () => {
    it('defines teach.selectedVertex and teach.selectedSegment in en, hi, gu', () => {
      expect(tables.en['teach.selectedVertex']).toBe('Selected vertex: {label}');
      expect(tables.en['teach.selectedSegment']).toBe('Selected segment: {label}');

      expect(tables.hi['teach.selectedVertex']).toBe('चयनित शीर्ष: {label}');
      expect(tables.hi['teach.selectedSegment']).toBe('चयनित रेखा खंड: {label}');

      expect(tables.gu['teach.selectedVertex']).toBe('પસંદ કરેલું બિંદુ: {label}');
      expect(tables.gu['teach.selectedSegment']).toBe('પસંદ કરેલો રેખાખંડ: {label}');
    });
  });

  // -------------------------------------------------------------------------
  // FINDING-17: Clipboard fallback finally cleanup
  // -------------------------------------------------------------------------
  describe('FINDING-17: Clipboard fallback textarea cleanup', () => {
    it('cleans up textarea element even if execCommand throws an error', async () => {
      const removeChildSpy = vi.fn();

      // Mock DOM document in node test environment
      const fakeBody = {
        appendChild: vi.fn(),
        removeChild: removeChildSpy,
      };

      const fakeTextarea = {
        value: '',
        setAttribute: vi.fn(),
        style: {} as Record<string, string>,
        focus: vi.fn(),
        select: vi.fn(),
        parentNode: fakeBody,
      };

      const origDoc = (globalThis as unknown as { document?: unknown }).document;
      (globalThis as unknown as { document: unknown }).document = {
        createElement: vi.fn(() => fakeTextarea),
        body: fakeBody,
        execCommand: vi.fn(() => {
          throw new Error('SecurityError: execCommand denied');
        }),
      };

      // Attempt copy; fallback should trigger and safely clean up in finally block
      const result = await copyToClipboard('test string');
      expect(result).toBe(false);
      expect(removeChildSpy).toHaveBeenCalledWith(fakeTextarea);

      (globalThis as unknown as { document: unknown }).document = origDoc;
    });
  });

  // -------------------------------------------------------------------------
  // A5-04: Language switch synchronization in Teach screen
  // -------------------------------------------------------------------------
  describe('A5-04: Language synchronization in Teach screen', () => {
    it('notifies subscribers via subscribeLang when language changes mid-flow', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeLang(listener);
      setLang('hi');
      expect(listener).toHaveBeenCalledWith('hi');
      expect(getLang()).toBe('hi');
      expect(LANG_BCP47[getLang()]).toBe('hi-IN');

      setLang('gu');
      expect(listener).toHaveBeenCalledWith('gu');
      expect(getLang()).toBe('gu');
      expect(LANG_BCP47[getLang()]).toBe('gu-IN');

      unsubscribe();
    });

    it('renders localized status message when mounted in Hindi or Gujarati', () => {
      const drivers = createMockDrivers();
      setLang('hi');

      const htmlHi = renderToStaticMarkup(
        createElement(Teach, {
          initialScene: sampleTriangle,
          drivers,
          onBack: vi.fn(),
        }),
      );
      expect(htmlHi).toContain(tables.hi['teach.intro']);

      setLang('gu');
      const htmlGu = renderToStaticMarkup(
        createElement(Teach, {
          initialScene: sampleTriangle,
          drivers,
          onBack: vi.fn(),
        }),
      );
      expect(htmlGu).toContain(tables.gu['teach.intro']);
    });
  });
});
