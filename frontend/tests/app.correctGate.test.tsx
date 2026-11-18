// @vitest-environment jsdom

/**
 * Requirement 48 (owner decision D6): the Correct button is offered in Explore only when
 * Teacher tools is on (VITE_FEATURE_SHARE=1 and the Settings switch).
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore } from '../src/drivers';
import { _resetTeacherSettingForTesting, setStoredTeacherSetting } from '../src/flow/teach';
import { setLang } from '../src/i18n';

const sampleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Gate Scene',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
  ],
  segments: [{ id: 's_ab', a: 'A', b: 'B', label: 'AB' }],
  polylines: [],
  bars: [],
};

vi.mock('../src/screens/Capture', () => ({
  Capture: ({
    onScene,
  }: {
    onScene?: (scene: DiagramScene, mode: string, photo?: string, source?: string) => void;
  }) => (
    <div className="gt-capture">
      <button
        type="button"
        className="mock-open-scene-btn"
        onClick={() => onScene?.(sampleScene, 'ai', undefined, 'file')}
      >
        Open File Scene
      </button>
    </div>
  ),
}));

vi.mock('../src/drivers/pdf', () => ({
  PdfError: class PdfError extends Error {},
  defaultPdfLoader: vi.fn(async () => ({})),
  renderFirstPage: vi.fn(async () => new Blob()),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));

const observed = vi.hoisted(() => ({
  store: null as import('../src/drivers').MemoryDiagramStore | null,
}));
vi.mock('../src/drivers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/drivers')>();
  return {
    ...actual,
    createBrowserDrivers: (...args: Parameters<typeof actual.createBrowserDrivers>) => {
      const real = actual.createBrowserDrivers(...args);
      return { ...real, speech: { ...real.speech, speak: vi.fn() }, diagramStore: observed.store! };
    },
  };
});

describe('Requirement 48: Correct button gated by Teacher tools', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLang('en');
    observed.store = new MemoryDiagramStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllEnvs();
    _resetTeacherSettingForTesting();
    window.location.hash = '';
  });

  async function openExplore(): Promise<void> {
    await act(async () => {
      root.render(createElement(App));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.gt-start-surface')!.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.mock-open-scene-btn')!.click();
    });
    expect(container.querySelector('.gt-explore')).not.toBeNull();
  }

  function correctButtons(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
      (b) => b.classList.contains('gt-explore__correct') || b.textContent?.trim() === 'Correct',
    );
  }

  it('has no Correct button when the env flag is on but the setting is off', async () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    setStoredTeacherSetting(false);
    await openExplore();
    expect(correctButtons()).toHaveLength(0);
    // The other footer controls are still there.
    expect(container.querySelector('.gt-explore__ask')).not.toBeNull();
    expect(container.querySelector('.gt-explore__back')).not.toBeNull();
  });

  it('has no Correct button when the setting is on but the env flag is off', async () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '');
    setStoredTeacherSetting(true);
    await openExplore();
    expect(correctButtons()).toHaveLength(0);
  });

  it('shows the Correct button when Teacher tools is on', async () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    setStoredTeacherSetting(true);
    await openExplore();
    expect(correctButtons()).toHaveLength(1);
  });
});
