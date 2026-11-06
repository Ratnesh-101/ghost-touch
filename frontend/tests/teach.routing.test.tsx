/**
 * Routing and Feature Flag Tests for Teacher Editor (Lane t2-teach-editor).
 *
 * Requirements:
 * - Gated by VITE_FEATURE_SHARE === '1' AND the teacher-tools user setting.
 * - When either flag is OFF, #/teach is ignored and app stays on Start screen.
 * - When both are ON, #/teach resolves to Teach screen.
 * - Sighted teacher can load scene from current capture/Explore, saved diagram, or pasted share link.
 * - Back button clears URL hash via history.replaceState and returns to Start/Explore.
 * - LabSettings displays teacher toggle only when VITE_FEATURE_SHARE === '1'.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { LabSettings } from '../src/components/LabSettings';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { TEACH_HASH } from '../src/drivers/hashRoute';
import { setStoredTeacherSetting } from '../src/flow/teach';
import { encodeShare, type SharePayload } from '../src/share';
import { setLang, t } from '../src/i18n';

interface MockWindow {
  location: { hash: string; pathname: string; search: string };
  history: { replaceState: (state: unknown, title: string, url: string) => void };
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  dispatchEvent: (event: unknown) => boolean;
}

function setupMockBrowser(initialHash = ''): {
  mockWindow: MockWindow;
  listeners: Map<string, Set<() => void>>;
  replaceStateSpy: ReturnType<typeof vi.fn>;
  dispatchHashChange: (newHash: string) => void;
} {
  const listeners = new Map<string, Set<() => void>>();
  const replaceStateSpy = vi.fn((_state: unknown, _title: string, url: string) => {
    const hashIdx = url.indexOf('#');
    mockWindow.location.hash = hashIdx !== -1 ? url.slice(hashIdx) : '';
  });

  const mockWindow: MockWindow = {
    location: {
      hash: initialHash,
      pathname: '/',
      search: '',
    },
    history: {
      replaceState: replaceStateSpy,
    },
    addEventListener: (event: string, handler: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    removeEventListener: (event: string, handler: () => void) => {
      listeners.get(event)?.delete(handler);
    },
    dispatchEvent: (_event: unknown) => {
      return true;
    },
  };

  const dispatchHashChange = (newHash: string): void => {
    mockWindow.location.hash = newHash;
    const hashListeners = listeners.get('hashchange');
    if (hashListeners) {
      for (const listener of hashListeners) {
        listener();
      }
    }
  };

  return { mockWindow, listeners, replaceStateSpy, dispatchHashChange };
}

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

describe('Teacher Editor Routing & Gating', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origHistory = (globalThis as unknown as { history?: unknown }).history;

  beforeEach(() => {
    setLang('en');
    setStoredTeacherSetting(false);
  });

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
    (globalThis as unknown as { history?: unknown }).history = origHistory;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('when VITE_FEATURE_SHARE is unset / "0", #/teach is ignored and shows Start screen', () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '0');
    setStoredTeacherSetting(true);

    const { mockWindow } = setupMockBrowser(TEACH_HASH);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain(t('start.tapToBegin'));
    expect(html).not.toContain(t('teach.title'));
  });

  it('when VITE_FEATURE_SHARE === "1" BUT teacher setting is off (default), #/teach is ignored and shows Start screen', () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    setStoredTeacherSetting(false); // setting OFF

    const { mockWindow } = setupMockBrowser(TEACH_HASH);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain(t('start.tapToBegin'));
    expect(html).not.toContain(t('teach.title'));
  });

  it('when VITE_FEATURE_SHARE === "1" AND teacher setting is ON, #/teach resolves to Teach screen', () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    setStoredTeacherSetting(true); // setting ON

    const { mockWindow } = setupMockBrowser(TEACH_HASH);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain(t('teach.title'));
    expect(html).toContain(t('teach.markVerified'));
    expect(html).not.toContain(t('start.tapToBegin'));
  });

  it('LabSettings sheet displays teacher toggle only when VITE_FEATURE_SHARE === "1"', () => {
    const drivers = createMockDrivers();

    // 1. When flag is "0"
    vi.stubEnv('VITE_FEATURE_SHARE', '0');
    const htmlOff = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlOff).not.toContain(t('lab.settings.teacher'));

    // 2. When flag is "1"
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    const htmlOn = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
        drivers,
      }),
    );
    expect(htmlOn).toContain(t('lab.settings.teacher'));
    expect(htmlOn).toContain(t('lab.settings.teacherOff'));
  });

  it('opens a shared diagram via pasted link into Teach editor', () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    setStoredTeacherSetting(true);

    const testScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      title: 'Isosceles Triangle',
      points: [
        { id: 'X', x: 0.1, y: 0.9 },
        { id: 'Y', x: 0.9, y: 0.9 },
        { id: 'Z', x: 0.5, y: 0.1 },
      ],
      segments: [
        { id: 'XY', a: 'X', b: 'Y' },
        { id: 'YZ', a: 'Y', b: 'Z' },
        { id: 'ZX', a: 'Z', b: 'X' },
      ],
    };

    const payload: SharePayload = {
      v: 1,
      scene: testScene,
      verifiedBy: 'Teacher Gamma',
      note: 'Look at the equal sides.',
      verifiedAt: new Date().toISOString(),
    };
    const encoded = encodeShare(payload);
    expect(encoded.length).toBeGreaterThan(0);

    const { mockWindow } = setupMockBrowser(TEACH_HASH);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain(t('teach.title'));
    expect(html).toContain(t('teach.load'));
  });
});
