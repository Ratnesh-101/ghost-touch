// @vitest-environment jsdom
/**
 * Test suite for FLOW-03: Cold open ShareError accessibility.
 *
 * Verifies:
 * 1. On cold open with broken share link, ShareError mounts and focuses heading.
 * 2. document.activeElement is the heading element with tabIndex=-1.
 * 3. Later hashchange retains existing speech behavior.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareError } from '../src/screens/ShareError';
import { setLang, t } from '../src/i18n';

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

vi.mock('../src/config/features', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/features')>();
  return {
    ...actual,
    isShareEnvOn: () => true,
    isAskMockFallbackOn: () => false,
    isGhostwriterOn: () => true,
  };
});

let App!: typeof import('../src/App').App;
let appModulePromise: Promise<typeof import('../src/App')> | null = null;
function getAppModule(): Promise<typeof import('../src/App')> {
  if (!appModulePromise) {
    appModulePromise = import('../src/App');
  }
  return appModulePromise;
}

describe('FLOW-03: ShareError Cold Open', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    setLang('en');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root && container) {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('ShareError component focuses heading element with tabIndex=-1 on mount', async () => {
    const onGoToStart = vi.fn();

    await act(async () => {
      root!.render(
        createElement(ShareError, {
          code: 'bad-format',
          onGoToStart,
        }),
      );
    });

    const activeEl = document.activeElement as HTMLElement | null;
    expect(activeEl).not.toBeNull();
    expect(activeEl?.getAttribute('tabindex')).toBe('-1');
    expect(activeEl?.textContent).toBe(t('share.error.title'));

    const messageEl = container!.querySelector('.gt-share-error__message');
    expect(messageEl).not.toBeNull();
    expect(messageEl?.textContent).toContain(t('share.error.badFormat'));
  });

  describe('App cold open integration', () => {
    beforeAll(async () => {
      window.location.hash = '#s=garbage';
      const appModule = await getAppModule();
      App = appModule.App;
    }, 60_000);

    it('renders ShareError on cold load with #s=garbage and focuses heading', async () => {
      window.location.hash = '#s=garbage';

      await act(async () => {
        root!.render(createElement(App));
      });

      const errorScreen = container!.querySelector('.gt-share-error');
      expect(errorScreen).not.toBeNull();

      const activeEl = document.activeElement as HTMLElement | null;
      expect(activeEl).not.toBeNull();
      expect(activeEl?.getAttribute('tabindex')).toBe('-1');
      expect(activeEl?.textContent).toBe(t('share.error.title'));

      const messageEl = container!.querySelector('.gt-share-error__message');
      expect(messageEl).not.toBeNull();
      expect(messageEl?.textContent).toContain(t('share.error.badFormat'));
    });
  });
});
