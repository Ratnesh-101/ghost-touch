import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Start } from '../src/screens/Start';
import { Capture } from '../src/screens/Capture';
import { Correct } from '../src/screens/Correct';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import type { DiagramScene } from '../src/core/scene';
import { createPhotoUrlTracker } from '../src/flow/capture';
import { t } from '../src/i18n';

const testScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test triangle',
  points: [
    { id: 'p1', x: 0.1, y: 0.1, label: 'A' },
    { id: 'p2', x: 0.9, y: 0.9, label: 'B' },
  ],
  segments: [{ id: 's1', a: 'p1', b: 'p2' }],
};

describe('capture lifecycle, object URLs, double-tap & cancel (Findings 4, 9, 16)', () => {
  let createdUrls: string[] = [];
  let revokedUrls: string[] = [];
  let origFetch: typeof fetch | undefined;

  const createDrivers = (): Drivers => ({
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
    diagramStore: new MemoryDiagramStore(),
  });

  beforeEach(() => {
    origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/samples/')) {
        return {
          ok: true,
          json: async () => testScene,
        } as unknown as Response;
      }
      return { ok: false } as unknown as Response;
    });

    createdUrls = [];
    revokedUrls = [];
    let counter = 0;
    (globalThis as unknown as Record<string, unknown>).URL = {
      createObjectURL: vi.fn().mockImplementation(() => {
        const url = `blob:http://localhost/test-blob-${++counter}`;
        createdUrls.push(url);
        return url;
      }),
      revokeObjectURL: vi.fn().mockImplementation((url: string) => {
        revokedUrls.push(url);
      }),
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).URL;
    if (origFetch !== undefined) {
      globalThis.fetch = origFetch;
    } else {
      delete (globalThis as unknown as Record<string, unknown>).fetch;
    }
  });

  describe('Finding 4: Raw photo object URL lifecycle and revocation', () => {
    it('createPhotoUrlTracker revokes old object URLs on replacement and unmount without breaking active views', () => {
      const revoked: string[] = [];
      const tracker = createPhotoUrlTracker((url) => revoked.push(url));

      expect(tracker.getCurrent()).toBeNull();

      // First photo capture
      tracker.update('blob:http://localhost/photo-1');
      expect(tracker.getCurrent()).toBe('blob:http://localhost/photo-1');
      expect(revoked).toEqual([]);

      // Same URL (re-render / no change) does not revoke
      tracker.update('blob:http://localhost/photo-1');
      expect(revoked).toEqual([]);

      // Second photo capture replaces photo-1
      tracker.update('blob:http://localhost/photo-2');
      expect(tracker.getCurrent()).toBe('blob:http://localhost/photo-2');
      expect(revoked).toEqual(['blob:http://localhost/photo-1']);

      // Navigating back to Capture clears photo and revokes photo-2
      tracker.update(null);
      expect(tracker.getCurrent()).toBeNull();
      expect(revoked).toEqual(['blob:http://localhost/photo-1', 'blob:http://localhost/photo-2']);

      // Repeated update(null) is a no-op
      tracker.update(null);
      expect(revoked).toHaveLength(2);

      // Third photo capture, then screen disposal (unmount)
      tracker.update('blob:http://localhost/photo-3');
      expect(tracker.getCurrent()).toBe('blob:http://localhost/photo-3');
      tracker.dispose();
      expect(tracker.getCurrent()).toBeNull();
      expect(revoked).toEqual([
        'blob:http://localhost/photo-1',
        'blob:http://localhost/photo-2',
        'blob:http://localhost/photo-3',
      ]);

      // Repeated dispose is a safe no-op
      tracker.dispose();
      expect(revoked).toHaveLength(3);
    });

    it('Correct overlay renders with photoUrl without prematurely revoking it', () => {
      const drivers = createDrivers();
      const photoUrl = 'blob:http://localhost/photo-correct-test';
      const onSave = vi.fn();
      const onCancel = vi.fn();

      let capturedCorrect: JSX.Element | null = null;
      function TestWrapper(): JSX.Element {
        capturedCorrect = Correct({
          scene: testScene,
          photoUrl,
          drivers,
          onSave,
          onCancel,
        });
        return capturedCorrect;
      }

      const html = renderToStaticMarkup(createElement(TestWrapper));
      expect(html).toContain('gt-correct');
      // RevokeObjectURL must NOT have been called while Correct is active
      expect(revokedUrls).not.toContain(photoUrl);
    });
  });

  describe('Finding 9: Double-tap on Start screen', () => {
    it('Start button ignores rapid second tap and triggers onBegin only once', () => {
      const drivers = createDrivers();
      const onBegin = vi.fn();

      let capturedStart: JSX.Element | null = null;
      function TestWrapper(): JSX.Element {
        capturedStart = Start({ drivers, onBegin });
        return capturedStart;
      }

      renderToStaticMarkup(createElement(TestWrapper));
      expect(capturedStart).not.toBeNull();

      const onClick = (capturedStart as unknown as { props: { onClick: () => void } }).props.onClick;
      expect(typeof onClick).toBe('function');

      // First tap begins the app
      onClick();
      expect(onBegin).toHaveBeenCalledTimes(1);

      // Second tap (e.g. TalkBack double-tap or rapid touch bounce) is ignored
      onClick();
      expect(onBegin).toHaveBeenCalledTimes(1);
    });
  });

  describe('Finding 9: Double-tap on Capture sample buttons', () => {
    it('handleSample sets busy synchronously so rapid second tap speaks busy', async () => {
      const drivers = createDrivers();
      const onScene = vi.fn();

      let capturedCapture: JSX.Element | null = null;
      function TestWrapper(): JSX.Element {
        capturedCapture = Capture({
          drivers,
          initialStatus: 'Take a photo.',
          onScene,
          onSavedDiagrams: vi.fn(),
        });
        return <div>dummy</div>;
      }

      renderToStaticMarkup(createElement(TestWrapper));
      expect(capturedCapture).not.toBeNull();

      const findNodes = (node: unknown, predicate: (n: { type?: unknown; props?: unknown }) => boolean): unknown[] => {
        if (!node || typeof node !== 'object') return [];
        const result: unknown[] = [];
        const n = node as { type?: unknown; props?: { children?: unknown } };
        if (predicate(n)) {
          result.push(n);
        }
        if (n.props?.children) {
          if (Array.isArray(n.props.children)) {
            for (const child of n.props.children) {
              result.push(...findNodes(child, predicate));
            }
          } else {
            result.push(...findNodes(n.props.children, predicate));
          }
        }
        return result;
      };

      const sampleButtons = findNodes(
        capturedCapture,
        (n) => Boolean((n.props as { className?: string })?.className?.includes('gt-capture__sample-btn')),
      );
      expect(sampleButtons.length).toBeGreaterThan(0);

      const firstBtn = sampleButtons[0] as { props: { onClick: () => Promise<void> } };
      expect(typeof firstBtn.props.onClick).toBe('function');

      // Click first time (initiates sample loading)
      firstBtn.props.onClick();
      // Click second time while busy
      firstBtn.props.onClick();

      // Wait for async loadSample to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The speech driver should have spoken capture.busy on the second click
      expect(drivers.speech.speak).toHaveBeenCalledWith(t('capture.busy'), expect.anything());
      // Only one successful scene delivery
      expect(onScene).toHaveBeenCalledTimes(1);
    });
  });

  describe('Finding 16: File input cancel and empty selection handling', () => {
    it('Capture renders onCancel handlers on camera and file inputs', () => {
      const drivers = createDrivers();
      const onScene = vi.fn();

      let capturedCapture: JSX.Element | null = null;
      function TestWrapper(): JSX.Element {
        capturedCapture = Capture({
          drivers,
          initialStatus: 'Take a photo.',
          onScene,
          onSavedDiagrams: vi.fn(),
        });
        return <div>dummy</div>;
      }

      renderToStaticMarkup(createElement(TestWrapper));
      expect(capturedCapture).not.toBeNull();

      const findNodes = (node: unknown, predicate: (n: { type?: unknown; props?: unknown }) => boolean): unknown[] => {
        if (!node || typeof node !== 'object') return [];
        const result: unknown[] = [];
        const n = node as { type?: unknown; props?: { children?: unknown } };
        if (predicate(n)) {
          result.push(n);
        }
        if (n.props?.children) {
          if (Array.isArray(n.props.children)) {
            for (const child of n.props.children) {
              result.push(...findNodes(child, predicate));
            }
          } else {
            result.push(...findNodes(n.props.children, predicate));
          }
        }
        return result;
      };

      const inputs = findNodes(
        capturedCapture,
        (n) => n.type === 'input' && (n.props as { type?: string })?.type === 'file',
      );
      expect(inputs.length).toBe(2);
      for (const input of inputs) {
        const props = (input as { props: { onCancel?: () => void } }).props;
        expect(typeof props.onCancel).toBe('function');
      }
    });

    it('onCancel restores idle state and speaks cancel message once', () => {
      const drivers = createDrivers();
      const onScene = vi.fn();

      let capturedCapture: JSX.Element | null = null;
      function TestWrapper(): JSX.Element {
        capturedCapture = Capture({
          drivers,
          initialStatus: 'Take a photo.',
          onScene,
          onSavedDiagrams: vi.fn(),
        });
        return <div>dummy</div>;
      }

      renderToStaticMarkup(createElement(TestWrapper));

      const findNodes = (
        node: unknown,
        predicate: (n: { type?: unknown; props?: unknown }) => boolean,
      ): unknown[] => {
        if (!node || typeof node !== 'object') return [];
        const result: unknown[] = [];
        const n = node as { type?: unknown; props?: { children?: unknown } };
        if (predicate(n)) {
          result.push(n);
        }
        if (n.props?.children) {
          if (Array.isArray(n.props.children)) {
            for (const child of n.props.children) {
              result.push(...findNodes(child, predicate));
            }
          } else {
            result.push(...findNodes(n.props.children, predicate));
          }
        }
        return result;
      };

      const inputs = findNodes(
        capturedCapture,
        (n) => n.type === 'input' && (n.props as { type?: string })?.type === 'file',
      );
      const photoInput = inputs[0] as { props: { onCancel: () => void } };

      const speakCalls = (
        drivers.speech.speak as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls;
      const speakCountBefore = speakCalls.length;
      // Trigger cancel event
      photoInput.props.onCancel();

      // Exactly one utterance with localized cancel message from i18n table
      expect(speakCalls.length - speakCountBefore).toBe(1);
      expect(speakCalls.at(-1)?.[0]).toBe(t('capture.cancelled'));
      expect(onScene).not.toHaveBeenCalled();
    });

    it('onChange with empty file list restores idle state and speaks cancel message once', async () => {
      const drivers = createDrivers();
      const onScene = vi.fn();

      let capturedCapture: JSX.Element | null = null;
      function TestWrapper(): JSX.Element {
        capturedCapture = Capture({
          drivers,
          initialStatus: 'Take a photo.',
          onScene,
          onSavedDiagrams: vi.fn(),
        });
        return <div>dummy</div>;
      }

      renderToStaticMarkup(createElement(TestWrapper));

      const findNodes = (
        node: unknown,
        predicate: (n: { type?: unknown; props?: unknown }) => boolean,
      ): unknown[] => {
        if (!node || typeof node !== 'object') return [];
        const result: unknown[] = [];
        const n = node as { type?: unknown; props?: { children?: unknown } };
        if (predicate(n)) {
          result.push(n);
        }
        if (n.props?.children) {
          if (Array.isArray(n.props.children)) {
            for (const child of n.props.children) {
              result.push(...findNodes(child, predicate));
            }
          } else {
            result.push(...findNodes(n.props.children, predicate));
          }
        }
        return result;
      };

      const inputs = findNodes(
        capturedCapture,
        (n) => n.type === 'input' && (n.props as { type?: string })?.type === 'file',
      );
      const photoInput = inputs[0] as {
        props: { onChange: (e: { target: { files: File[]; value: string } }) => Promise<void> };
      };

      const speakCalls = (
        drivers.speech.speak as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls;
      const speakCountBefore = speakCalls.length;

      // Empty selection event
      await photoInput.props.onChange({ target: { files: [], value: '' } });

      // Exactly one utterance with localized cancel message from i18n table
      expect(speakCalls.length - speakCountBefore).toBe(1);
      expect(speakCalls.at(-1)?.[0]).toBe(t('capture.cancelled'));
      expect(onScene).not.toHaveBeenCalled();
    });
  });
});
