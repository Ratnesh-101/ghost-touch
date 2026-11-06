/**
 * Share Open Routing and End-to-End Flow Tests
 *
 * Requirements:
 * - Student opens /#s=<payload> and lands in Explore with "Verified by <name>" banner.
 * - Spoken order: scene announcement first, then "Verified by <name>".
 * - Flag VITE_FEATURE_SHARE === '1' gates share routes (flag off => hash ignored, start screen).
 * - No network call at all (assert fetch is not called).
 * - XSS prevention: teacher name <img onerror> renders as literal text.
 * - Changing hash while app is open re-routes.
 * - Back from Explore clears hash via history.replaceState and returns to start screen.
 * - Friendly error screens for each error code without stacks or raw payload.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LZString from 'lz-string';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, joinShareAnnouncements, resolveShareRoute, speakShareAnnouncements } from '../src/App';
import type { DiagramScene } from '../src/core/scene';
import type { Drivers } from '../src/drivers';
import { clearHash } from '../src/drivers/hashRoute';
import { encodeShare, LIMITS, type SharePayload } from '../src/share';
import { exploreAnnouncement } from '../src/flow/navigation';
import { setLang } from '../src/i18n';
import { parseHtml, getAllElements } from './helpers/a11yDom';

const sampleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.1, y: 0.1, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.1, y: 0.8, label: 'C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
  ],
  polylines: [],
  bars: [],
};

const secondScene: DiagramScene = {
  version: 1,
  kind: 'function_graph',
  title: 'Parabola Curve',
  points: [
    { id: 'V', x: 0.5, y: 0.8, label: 'Vertex' },
  ],
  segments: [],
  polylines: [
    {
      id: 'P',
      points: [
        [0.1, 0.2],
        [0.5, 0.8],
        [0.9, 0.2],
      ],
      label: 'y = x^2',
    },
  ],
  bars: [],
};

interface MockWindow {
  location: { hash: string; pathname: string; search: string };
  history: { replaceState: (state: unknown, title: string, url: string) => void };
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  dispatchEvent: (event: { type: string }) => boolean;
}

function setupMockBrowser(initialHash = ''): {
  mockWindow: MockWindow;
  listeners: Map<string, Set<() => void>>;
  replaceStateSpy: ReturnType<typeof vi.fn>;
  dispatchHashChange: (newHash?: string) => void;
} {
  const listeners = new Map<string, Set<() => void>>();
  const replaceStateSpy = vi.fn((_state: unknown, _title: string, _url: string) => {
    mockWindow.location.hash = '';
  });

  const mockWindow: MockWindow = {
    location: { hash: initialHash, pathname: '/', search: '' },
    history: { replaceState: replaceStateSpy },
    addEventListener: (event: string, handler: () => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
    },
    removeEventListener: (event: string, handler: () => void) => {
      const set = listeners.get(event);
      if (set) {
        set.delete(handler);
      }
    },
    dispatchEvent: (event: { type: string }) => {
      const set = listeners.get(event.type);
      if (set) {
        for (const cb of [...set]) {
          cb();
        }
      }
      return true;
    },
  };

  const dispatchHashChange = (newHash?: string) => {
    if (newHash !== undefined) {
      mockWindow.location.hash = newHash;
    }
    mockWindow.dispatchEvent({ type: 'hashchange' });
  };

  return { mockWindow, listeners, replaceStateSpy, dispatchHashChange };
}

describe('Share Open Routing & Flow', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origHistory = (globalThis as unknown as { history?: unknown }).history;
  const origEnv = import.meta.env.VITE_FEATURE_SHARE;

  beforeEach(() => {
    import.meta.env.VITE_FEATURE_SHARE = '1';
    setLang('en');
  });

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
    (globalThis as unknown as { history?: unknown }).history = origHistory;
    import.meta.env.VITE_FEATURE_SHARE = origEnv;
    vi.restoreAllMocks();
  });

  it('valid link opens Explore screen with verified banner and diagram title', () => {
    const payload: SharePayload = {
      v: 1,
      scene: sampleScene,
      verifiedBy: 'Mrs. Sharma',
      note: 'Notice the 90 degree angle at vertex C.',
      verifiedAt: '2026-11-06T10:00:00Z',
    };
    const encoded = encodeShare(payload);
    const { mockWindow } = setupMockBrowser(`#s=${encoded}`);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));

    // Verify Explore screen rendered with scene title and verified banner
    expect(html).toContain('Right Triangle ABC');
    expect(html).toContain('Verified by Mrs. Sharma');
    expect(html).toContain('role="status"');
  });

  it('no network call at all (asserts fetch is NOT called)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const payload: SharePayload = {
      v: 1,
      scene: sampleScene,
      verifiedBy: 'Teacher A',
      note: '',
      verifiedAt: '2026-11-06T10:00:00Z',
    };
    const encoded = encodeShare(payload);
    const { mockWindow } = setupMockBrowser(`#s=${encoded}`);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    renderToStaticMarkup(createElement(App));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('flag OFF: gates share route and stays on Start screen', () => {
    import.meta.env.VITE_FEATURE_SHARE = '0';

    const payload: SharePayload = {
      v: 1,
      scene: sampleScene,
      verifiedBy: 'Teacher B',
      note: '',
      verifiedAt: '2026-11-06T10:00:00Z',
    };
    const encoded = encodeShare(payload);
    const { mockWindow } = setupMockBrowser(`#s=${encoded}`);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));

    // Must be on Start screen, NOT Explore or ShareError
    expect(html).not.toContain('Verified by Teacher B');
    expect(html).not.toContain('Right Triangle ABC');
    expect(html).toContain('Ghost Touch');
  });

  it('XSS prevention: teacher name with <img onerror> renders as safe literal text', () => {
    const maliciousName = '<img src=x onerror="alert(\'xss\')">';
    const payload: SharePayload = {
      v: 1,
      scene: sampleScene,
      verifiedBy: maliciousName,
      note: '<script>alert(1)</script>',
      verifiedAt: '2026-11-06T10:00:00Z',
    };
    const encoded = encodeShare(payload);
    const { mockWindow } = setupMockBrowser(`#s=${encoded}`);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));
    const root = parseHtml(html);

    // No img elements must be present anywhere in the document
    const imgElements = getAllElements(root).filter((el) => el.tag === 'img');
    expect(imgElements.length).toBe(0);

    // Rendered as escaped text only
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(&#x27;xss&#x27;)&quot;&gt;');
  });

  it('empty hash (#s=) displays ShareError screen for code "empty" without stack or raw payload', () => {
    const { mockWindow } = setupMockBrowser('#s=');
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('Could not open diagram');
    expect(html).toContain('This shared link has no diagram.');
    expect(html).toContain('Go to start');
    expect(html).not.toContain('Error:');
    expect(html).not.toContain('stack');
  });

  it('corrupted hash string displays ShareError screen for code "bad-format"', () => {
    const { mockWindow } = setupMockBrowser('#s=not-valid-lz-string-garbage!!!');
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('Could not open diagram');
    expect(html).toContain('This shared link is corrupted or incomplete.');
    expect(html).toContain('Go to start');
  });

  it('unsupported version (v: 2) displays ShareError screen for code "bad-version"', () => {
    // Manually create payload with v: 2 and compress
    const v2Payload = {
      v: 2,
      scene: sampleScene,
      verifiedBy: 'Teacher',
      note: '',
      verifiedAt: new Date().toISOString(),
    };
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(v2Payload));

    const { mockWindow } = setupMockBrowser(`#s=${encoded}`);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('Could not open diagram');
    expect(html).toContain('This shared link was created by an incompatible version.');
  });

  it('invalid scene displays ShareError screen for code "bad-scene"', () => {
    // Manually create payload with coordinates 5.0 (invalid out of bounds)
    const badScenePayload = {
      v: 1,
      scene: {
        version: 1,
        kind: 'geometry',
        title: 'Bad Scene',
        points: [{ id: 'A', x: 5.0, y: 5.0, label: 'A' }],
        segments: [],
        polylines: [],
        bars: [],
      },
      verifiedBy: 'Teacher',
      note: '',
      verifiedAt: new Date().toISOString(),
    };
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(badScenePayload));

    const { mockWindow } = setupMockBrowser(`#s=${encoded}`);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('Could not open diagram');
    expect(html).toContain('This shared diagram could not be read.');
  });

  it('spoken order: announces scene first, then "Verified by <name>" in a single combined utterance', () => {
    const payload: SharePayload = {
      v: 1,
      scene: sampleScene,
      verifiedBy: 'Dr. Rao',
      note: 'Note content',
      verifiedAt: '2026-11-06T12:00:00Z',
    };
    const encoded = encodeShare(payload);
    const hash = `#s=${encoded}`;

    const resolution = resolveShareRoute(hash, true);
    expect(resolution.kind).toBe('explore');
    if (resolution.kind !== 'explore') return;

    expect(resolution.sceneAnnouncement).toBe(exploreAnnouncement(sampleScene, 'ai'));
    expect(resolution.verifiedAnnouncement).toBe('Verified by Dr. Rao');

    const spokenLines: string[] = [];
    const mockSpeech = {
      speak: vi.fn((text: string) => {
        spokenLines.push(text);
      }),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    };

    speakShareAnnouncements(mockSpeech as unknown as Drivers['speech'], resolution, 'en-IN');

    // Exactly ONE speak call so speech driver cancel() does not drop scene announcement
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    expect(spokenLines.length).toBe(1);
    const spoken = spokenLines[0]!;
    expect(spoken).toContain(resolution.sceneAnnouncement);
    expect(spoken).toContain(resolution.verifiedAnnouncement);

    // Contract order assertion: scene FIRST, verified SECOND
    const sceneIndex = spoken.indexOf(resolution.sceneAnnouncement);
    const verifiedIndex = spoken.indexOf(resolution.verifiedAnnouncement);
    expect(sceneIndex).toBeGreaterThanOrEqual(0);
    expect(verifiedIndex).toBeGreaterThan(sceneIndex);
    expect(spoken).not.toContain('..');
  });

  it('fake speech driver (each speak replaces previous): asserts exactly one speak call containing scene announcement AND verified line in order for en, hi, gu', () => {
    const langs: Array<{ code: 'en' | 'hi' | 'gu'; bcp47: string; teacher: string }> = [
      { code: 'en', bcp47: 'en-IN', teacher: 'Mrs. Sharma' },
      { code: 'hi', bcp47: 'hi-IN', teacher: 'शर्मा जी' },
      { code: 'gu', bcp47: 'gu-IN', teacher: 'પટેલ સાહેબ' },
    ];

    for (const { code, bcp47, teacher } of langs) {
      setLang(code);
      const payload: SharePayload = {
        v: 1,
        scene: sampleScene,
        verifiedBy: teacher,
        note: 'Teacher note',
        verifiedAt: '2026-11-06T12:00:00Z',
      };
      const encoded = encodeShare(payload);
      const hash = `#s=${encoded}`;

      const resolution = resolveShareRoute(hash, true);
      expect(resolution.kind).toBe('explore');
      if (resolution.kind !== 'explore') continue;

      // Fake speech driver that behaves like the real one: each speak replaces the previous
      let lastUtterance: string | null = null;
      let callCount = 0;
      const fakeSpeech = {
        speak(text: string) {
          callCount++;
          lastUtterance = text; // Each call replaces the previous
        },
        listen: vi.fn(),
        canSpeak: true,
        canListen: true,
      };

      speakShareAnnouncements(fakeSpeech as unknown as Drivers['speech'], resolution, bcp47);

      // Exactly ONE speak call
      expect(callCount).toBe(1);
      expect(lastUtterance).not.toBeNull();
      const spoken = lastUtterance!;

      // Spoken text contains scene announcement AND verified line
      expect(spoken).toContain(resolution.sceneAnnouncement);
      expect(spoken).toContain(resolution.verifiedAnnouncement);

      // Scene announcement appears FIRST, verified line appears SECOND
      const sceneIndex = spoken.indexOf(resolution.sceneAnnouncement);
      const verifiedIndex = spoken.indexOf(resolution.verifiedAnnouncement);
      expect(sceneIndex).toBeGreaterThanOrEqual(0);
      expect(verifiedIndex).toBeGreaterThan(sceneIndex);

      // Avoid double full stop
      expect(spoken).not.toContain('..');
      expect(spoken).not.toContain('।.');
    }
  });

  it('joinShareAnnouncements: avoids double full stops and handles terminal punctuation and empty strings', () => {
    // English with terminal dot: avoids double full stop
    expect(joinShareAnnouncements('Press Back to leave.', 'Verified by Alice')).toBe(
      'Press Back to leave. Verified by Alice',
    );
    // English without dot: joined with ". "
    expect(joinShareAnnouncements('Press Back to leave', 'Verified by Alice')).toBe(
      'Press Back to leave. Verified by Alice',
    );
    // Double dot normalized
    expect(joinShareAnnouncements('Press Back to leave..', 'Verified by Alice')).toBe(
      'Press Back to leave. Verified by Alice',
    );
    // Hindi with danda: avoids danda + dot
    expect(joinShareAnnouncements('वापस जाने के लिए बैक दबाएं।', 'सत्यापित')).toBe(
      'वापस जाने के लिए बैक दबाएं। सत्यापित',
    );
    // Exclamation / question mark
    expect(joinShareAnnouncements('Look here!', 'Verified by Alice')).toBe(
      'Look here! Verified by Alice',
    );
    expect(joinShareAnnouncements('Ready?', 'Verified by Alice')).toBe(
      'Ready? Verified by Alice',
    );
    // Empty strings
    expect(joinShareAnnouncements('', 'Verified by Alice')).toBe('Verified by Alice');
    expect(joinShareAnnouncements('Scene text.', '')).toBe('Scene text.');
    expect(joinShareAnnouncements('', '')).toBe('');
  });

  it('too-large error: displays ShareError screen when payload exceeds maxHashChars', () => {
    // Generate an oversized hash string exceeding LIMITS.maxHashChars (12000)
    const oversizedHash = `#s=${'A'.repeat(LIMITS.maxHashChars + 50)}`;

    const resolution = resolveShareRoute(oversizedHash, true);
    expect(resolution.kind).toBe('error');
    if (resolution.kind !== 'error') return;

    expect(resolution.code).toBe('too-large');
    expect(resolution.errorMessage).toBe('This shared link is too large to open.');

    const { mockWindow } = setupMockBrowser(oversizedHash);
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Could not open diagram');
    expect(html).toContain('This shared link is too large to open.');
    expect(html).toContain('Go to start');
  });

  it('dynamic hash re-routing: changing hash switches between scenes and error screen', () => {
    const payload1: SharePayload = {
      v: 1,
      scene: sampleScene,
      verifiedBy: 'Teacher 1',
      note: '',
      verifiedAt: '2026-11-06T10:00:00Z',
    };
    const payload2: SharePayload = {
      v: 1,
      scene: secondScene,
      verifiedBy: 'Teacher 2',
      note: '',
      verifiedAt: '2026-11-06T11:00:00Z',
    };

    const hash1 = `#s=${encodeShare(payload1)}`;
    const hash2 = `#s=${encodeShare(payload2)}`;

    // Resolve route 1
    const res1 = resolveShareRoute(hash1, true);
    expect(res1.kind).toBe('explore');
    if (res1.kind === 'explore') {
      expect(res1.scene.title).toBe('Right Triangle ABC');
      expect(res1.verified.by).toBe('Teacher 1');
    }

    // Change to route 2
    const res2 = resolveShareRoute(hash2, true);
    expect(res2.kind).toBe('explore');
    if (res2.kind === 'explore') {
      expect(res2.scene.title).toBe('Parabola Curve');
      expect(res2.verified.by).toBe('Teacher 2');
    }

    // Change to invalid hash
    const resErr = resolveShareRoute('#s=broken', true);
    expect(resErr.kind).toBe('error');
    if (resErr.kind === 'error') {
      expect(resErr.code).toBe('bad-format');
    }

    // Change to empty hash
    const resEmpty = resolveShareRoute('', true);
    expect(resEmpty.kind).toBe('ignored');
  });

  it('clearing hash with clearHash removes hash from URL via history.replaceState', () => {
    const { mockWindow, replaceStateSpy } = setupMockBrowser('#s=test');
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    expect(mockWindow.location.hash).toBe('#s=test');

    clearHash();

    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/');
    expect(mockWindow.location.hash).toBe('');
  });
});
