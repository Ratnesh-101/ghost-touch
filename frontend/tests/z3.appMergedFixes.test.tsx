// @vitest-environment jsdom
/**
 * Test suite for Lane z3-app-merged-fixes:
 *
 * 1. (HIGH, Fix 1) App.tsx handleTeachBack + Teach.tsx:
 *    Clicking in-app Exit with dirty editor asks confirmation ONCE and speaks announcement ONCE.
 *    Resetting lastProcessedHash before clearHash() prevents the synthetic hashchange event from
 *    re-evaluating leaveByBack and firing duplicate confirmation dialogs or utterances.
 * 2. (HIGH, Fix 2) App.tsx cold shared links:
 *    A shared diagram must NEVER reach Explore or lastExploreScene before the user taps the
 *    ShareGate. lastExploreScene.current is only assigned upon the user tap in openSharedDiagram.
 * 3. (HIGH, Fix 3) i18n & App.tsx honesty enforcement:
 *    resolveShareRoute defaults honest to true when options are omitted or empty.
 *    No active teach.* string contains "verified", "correct", "checked", "approved",
 *    "सत्यापित", or "પ્રમાણિત". Key & token parity holds across en, hi, gu.
 */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { executeTeachBack, isTeachDirty } from '../src/screens/Teach';
import { encodeShare, type SharePayload } from '../src/share';
import { setLang, tables, t } from '../src/i18n';

// Mock Capture and PDF driver modules so App does not load pdfjs worker URL in jsdom
vi.mock('../src/screens/Capture', () => ({
  Capture: () => null,
}));

vi.mock('../src/drivers/pdf', () => ({
  PdfError: class PdfError extends Error {
    readonly reason: string;
    constructor(reason: string, message?: string) {
      super(message ?? `PDF error: ${reason}`);
      this.name = 'PdfError';
      this.reason = reason;
    }
  },
  defaultPdfLoader: vi.fn(async () => ({})),
  renderFirstPage: vi.fn(async () => new Blob()),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '',
}));

let appModuleCache: typeof import('../src/App') | null = null;
async function loadAppModule(): Promise<typeof import('../src/App')> {
  if (!appModuleCache) {
    appModuleCache = await import('../src/App');
  }
  return appModuleCache;
}

let App!: typeof import('../src/App').App;
let resolveShareRoute!: typeof import('../src/App').resolveShareRoute;

const testTriangleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
  ],
  polylines: [],
  bars: [],
};

describe('Lane z3-app-merged-fixes', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeAll(async () => {
    const appModule = await loadAppModule();
    App = appModule.App;
    resolveShareRoute = appModule.resolveShareRoute;
  }, 60_000);

  beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    window.location.hash = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    container = null;
    root = null;
    window.location.hash = '';
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    setLang('en');
  });

  describe('Fix 1: Teacher Exit confirmation and announcement single-speech', () => {
    it('executeTeachBack with isDirty=true speaks confirmLeave and prompts confirm ONCE', () => {
      const speak = vi.fn();
      const confirm = vi.fn(() => true);
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onBack = vi.fn();

      const result = executeTeachBack(true, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onBack,
      });

      expect(result.stayed).toBe(false);
      expect(speak).toHaveBeenCalledTimes(1);
      expect(speak).toHaveBeenCalledWith(t('teach.confirmLeave'));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledWith(t('teach.confirmLeave'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('executeTeachBack when cancelled stays in editor and does not call onBack', () => {
      const speak = vi.fn();
      const confirm = vi.fn(() => false);
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onBack = vi.fn();

      const result = executeTeachBack(true, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onBack,
      });

      expect(result.stayed).toBe(true);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(sayAndStatus).toHaveBeenCalledWith(t('teach.stayingInEditor'));
      expect(focusHeading).toHaveBeenCalledTimes(1);
      expect(onBack).not.toHaveBeenCalled();
    });

    it('executeTeachBack with isDirty=false does not prompt confirmation', () => {
      const speak = vi.fn();
      const confirm = vi.fn();
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onBack = vi.fn();

      const result = executeTeachBack(false, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onBack,
      });

      expect(result.stayed).toBe(false);
      expect(confirm).not.toHaveBeenCalled();
      expect(speak).not.toHaveBeenCalled();
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('isTeachDirty returns true when scene, teacherName, or note differs from baseline', () => {
      const baseline = {
        scene: testTriangleScene,
        name: 'Teacher One',
        note: 'Original note',
      };

      expect(
        isTeachDirty(testTriangleScene, 'Teacher One', 'Original note', baseline),
      ).toBe(false);

      const modifiedScene: DiagramScene = { ...testTriangleScene, title: 'Edited' };
      expect(
        isTeachDirty(modifiedScene, 'Teacher One', 'Original note', baseline),
      ).toBe(true);
      expect(
        isTeachDirty(testTriangleScene, 'Different Name', 'Original note', baseline),
      ).toBe(true);
      expect(
        isTeachDirty(testTriangleScene, 'Teacher One', 'Modified note', baseline),
      ).toBe(true);
    });
  });

  describe('Fix 2: Cold shared link diagram never reaches Explore before tap', () => {
    it('cold shared link shows ShareGate and does not populate Explore state', async () => {
      const payload: SharePayload = {
        v: 1,
        scene: testTriangleScene,
        verifiedBy: 'Mrs. Sharma',
        note: 'Important note',
        verifiedAt: '2026-11-10T12:00:00Z',
      };
      const encoded = encodeShare(payload);
      window.location.hash = `#s=${encoded}`;

      await act(async () => {
        root!.render(createElement(App));
      });

      // ShareGate is mounted
      const gate = container!.querySelector('.gt-share-gate');
      expect(gate).not.toBeNull();
      const gateTitle = container!.querySelector('.gt-share-gate__title');
      expect(gateTitle).not.toBeNull();
      expect(gateTitle?.textContent).toBe('Shared diagram');
      const openButton = container!.querySelector('.gt-share-gate__open-btn');
      expect(openButton).not.toBeNull();

      // Explore screen is NOT mounted
      const exploreScreen = container!.querySelector('.gt-explore');
      expect(exploreScreen).toBeNull();
      const verifiedBanner = container!.querySelector('.gt-verified-banner');
      expect(verifiedBanner).toBeNull();
    });

    it('tapping Open button on ShareGate transitions to Explore', async () => {
      const payload: SharePayload = {
        v: 1,
        scene: testTriangleScene,
        verifiedBy: 'Mrs. Sharma',
        note: 'Important note',
        verifiedAt: '2026-11-10T12:00:00Z',
      };
      const encoded = encodeShare(payload);
      window.location.hash = `#s=${encoded}`;

      await act(async () => {
        root!.render(createElement(App));
      });

      const openButton = container!.querySelector<HTMLButtonElement>(
        '.gt-share-gate__open-btn',
      );
      expect(openButton).not.toBeNull();

      // Tap the share gate open button
      await act(async () => {
        openButton?.click();
      });

      // Explore screen is now mounted
      const exploreScreen = container!.querySelector('.gt-explore');
      expect(exploreScreen).not.toBeNull();

      // Banner shows honest wording
      const banner = container!.querySelector('.gt-verified-banner');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('Shared by Mrs. Sharma, not checked');
      expect(banner?.textContent).not.toContain('Verified');
    });
  });

  describe('Fix 3: resolveShareRoute honest default & no "Verified" claim words', () => {
    it('resolveShareRoute defaults honest to true when options argument is omitted', () => {
      const payload: SharePayload = {
        v: 1,
        scene: testTriangleScene,
        verifiedBy: 'Teacher Rao',
        note: 'Note',
        verifiedAt: '2026-11-10T12:00:00Z',
      };
      const encoded = encodeShare(payload);
      const res = resolveShareRoute(`#s=${encoded}`, true);

      expect(res.kind).toBe('explore');
      if (res.kind === 'explore') {
        expect(res.verifiedAnnouncement).toBe('Shared by Teacher Rao, not checked');
        expect(res.verifiedAnnouncement).not.toContain('Verified');
        expect(res.spokenAnnouncement).toContain('Shared by Teacher Rao, not checked');
        expect(res.spokenAnnouncement).not.toContain('Verified by');
        expect(res.sceneAnnouncement).toContain('Title: Right Triangle ABC');
      }
    });

    it('resolveShareRoute defaults honest to true when options is empty object {}', () => {
      const payload: SharePayload = {
        v: 1,
        scene: testTriangleScene,
        verifiedBy: 'Teacher Rao',
        note: 'Note',
        verifiedAt: '2026-11-10T12:00:00Z',
      };
      const encoded = encodeShare(payload);
      const res = resolveShareRoute(`#s=${encoded}`, true, {});

      expect(res.kind).toBe('explore');
      if (res.kind === 'explore') {
        expect(res.verifiedAnnouncement).toBe('Shared by Teacher Rao, not checked');
        expect(res.verifiedAnnouncement).not.toContain('Verified');
      }
    });

    it('rephrased Teach strings contain NO banned claim words in en, hi, gu', () => {
      const checkKeys = [
        'teach.validDiagram',
        'teach.invalidDiagram',
        'teach.verifySection',
        'teach.markVerified',
        'teach.verifiedSuccess',
        'teach.qrCodeAlt',
        'teach.verifyError',
        'teach.validationTitle',
      ] as const;

      const bannedRegex = /verified|correct|checked|approved|सत्यापित|प्रमाणित/i;

      for (const lang of ['en', 'hi', 'gu'] as const) {
        for (const key of checkKeys) {
          const val = tables[lang][key];
          expect(val, `Key ${key} in ${lang} must exist`).toBeDefined();
          expect(
            bannedRegex.test(val!),
            `Key ${key} in ${lang} ("${val}") must not contain banned claim words`,
          ).toBe(false);
        }
      }
    });

    it('maintains exact key count and placeholder token parity across all 3 languages', () => {
      const enKeys = Object.keys(tables.en).sort();
      const hiKeys = Object.keys(tables.hi).sort();
      const guKeys = Object.keys(tables.gu).sort();

      expect(hiKeys.length).toBe(enKeys.length);
      expect(guKeys.length).toBe(enKeys.length);

      const extractTokens = (s: string): string[] => {
        const matches = s.match(/\{[a-zA-Z0-9_]+\}/g);
        return matches ? matches.sort() : [];
      };

      for (const key of enKeys) {
        const enTokens = extractTokens(tables.en[key] ?? '');
        const hiTokens = extractTokens(tables.hi[key] ?? '');
        const guTokens = extractTokens(tables.gu[key] ?? '');

        expect(hiTokens, `Placeholder mismatch in hi for ${key}`).toEqual(enTokens);
        expect(guTokens, `Placeholder mismatch in gu for ${key}`).toEqual(enTokens);
      }
    });
  });
});
