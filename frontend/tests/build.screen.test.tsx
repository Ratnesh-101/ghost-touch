// @vitest-environment jsdom
/**
 * Unit tests for Ghost Hand Build screen & flow (Requirement 52, Lane hi12).
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  clampX,
  clampY,
  initialBuildHistory,
  initialSliders,
  pressPin,
  pressStitch,
  pressUndo,
} from '../src/flow/build';
import { t } from '../src/i18n';
import { Build } from '../src/screens/Build';
import { setupRigEnv, teardownRigEnv } from './support/exploreRig';

describe('flow/build.ts pure functions', () => {
  it('initial state produces empty draft history and zero sliders', () => {
    const history = initialBuildHistory();
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
    expect(history.present.points).toEqual([]);
    expect(history.present.segments).toEqual([]);

    const sliders = initialSliders();
    expect(sliders).toEqual({ x: 0, y: 0 });
  });

  it('clampX and clampY constrain to grid bounds [0, 6] and [0, 8]', () => {
    expect(clampX(-5)).toBe(0);
    expect(clampX(3.4)).toBe(3);
    expect(clampX(10)).toBe(6);
    expect(clampX(NaN)).toBe(0);

    expect(clampY(-1)).toBe(0);
    expect(clampY(5.6)).toBe(6);
    expect(clampY(20)).toBe(8);
    expect(clampY(Infinity)).toBe(0);
  });

  it('pressPin pins a point and returns build.pinned', () => {
    const h0 = initialBuildHistory();
    const res1 = pressPin(h0, 2, 5);
    expect(res1.history.past).toHaveLength(1);
    expect(res1.history.present.points).toHaveLength(1);
    expect(res1.speech).toEqual({
      key: 'build.pinned',
      params: { id: 'A', label: 'x 2 y 5' },
    });
  });

  it('pressPin refuses occupied crossing and returns build.occupied', () => {
    const h0 = initialBuildHistory();
    const res1 = pressPin(h0, 2, 5);
    const res2 = pressPin(res1.history, 2, 5);
    expect(res2.history).toBe(res1.history);
    expect(res2.speech).toEqual({
      key: 'build.occupied',
      params: { id: 'A', label: 'x 2 y 5' },
    });
  });

  it('pressPin handles badInput for invalid coords', () => {
    const h0 = initialBuildHistory();
    const res = pressPin(h0, NaN, 5);
    expect(res.history).toBe(h0);
    expect(res.speech.key).toBe('build.badInput');
  });

  it('pressStitch refuses fewer than 2 pins with build.stitchNone', () => {
    const h0 = initialBuildHistory();
    const res0 = pressStitch(h0);
    expect(res0.history).toBe(h0);
    expect(res0.speech.key).toBe('build.stitchNone');

    const res1 = pressPin(h0, 0, 1);
    const resStitch1 = pressStitch(res1.history);
    expect(resStitch1.history).toBe(res1.history);
    expect(resStitch1.speech.key).toBe('build.stitchNone');
  });

  it('pressStitch joins 2 or more pins and is idempotent', () => {
    let h = initialBuildHistory();
    h = pressPin(h, 0, 1).history;
    h = pressPin(h, 2, 3).history;
    h = pressPin(h, 4, 5).history;

    const res = pressStitch(h);
    expect(res.history.present.segments).toHaveLength(2);
    expect(res.speech).toEqual({
      key: 'build.stitched',
      params: { count: 2 },
    });

    // Press stitch again on already stitched scene
    const res2 = pressStitch(res.history);
    expect(res2.history).toBe(res.history);
    expect(res2.speech).toEqual({
      key: 'build.stitched',
      params: { count: 2 },
    });
  });

  it('pressUndo on empty history returns build.undoNothing', () => {
    const h0 = initialBuildHistory();
    const res = pressUndo(h0);
    expect(res.history).toBe(h0);
    expect(res.speech.key).toBe('build.undoNothing');
  });

  it('pressUndo undoes pinned point with build.undoPin', () => {
    const h0 = initialBuildHistory();
    const h1 = pressPin(h0, 1, 1).history;
    const res = pressUndo(h1);
    expect(res.history.present.points).toHaveLength(0);
    expect(res.speech).toEqual({
      key: 'build.undoPin',
      params: { id: 'A' },
    });
  });

  it('pressUndo undoes stitch with build.undoStitch', () => {
    let h = initialBuildHistory();
    h = pressPin(h, 1, 1).history;
    h = pressPin(h, 2, 2).history;
    h = pressStitch(h).history;
    expect(h.present.segments).toHaveLength(1);

    const res = pressUndo(h);
    expect(res.history.present.segments).toHaveLength(0);
    expect(res.history.present.points).toHaveLength(2);
    expect(res.speech).toEqual({
      key: 'build.undoStitch',
      params: {},
    });
  });
});

describe('screens/Build.tsx component', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  interface TestRig {
    container: HTMLDivElement;
    speak: ReturnType<typeof vi.fn>;
    onBack: ReturnType<typeof vi.fn>;
    button: (name: string) => HTMLButtonElement;
    sliders: () => HTMLInputElement[];
    root: () => HTMLElement;
  }

  async function withTestBuild(body: (rig: TestRig) => Promise<void> | void): Promise<void> {
    const speak = vi.fn();
    const onBack = vi.fn();
    const drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(() => true), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        setGuideTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        playClick: vi.fn(),
        state: 'running',
      },
      speech: {
        speak,
        listen: vi.fn(() => new Promise<string>(() => {})),
        stopSpeaking: vi.fn(),
        cancelListen: vi.fn(),
        isSpeaking: vi.fn(() => false),
        getRate: () => 'normal',
        canSpeak: true,
        canListen: true,
      },
      diagramStore: new MemoryDiagramStore(),
    } as unknown as Drivers;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const reactRoot = createRoot(container);
    await act(async () => {
      reactRoot.render(createElement(Build, { drivers, onBack }));
    });

    const rig: TestRig = {
      container,
      speak,
      onBack,
      button: (name: string) => {
        const all = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
        const found = all.find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name);
        if (!found) throw new Error(`no button named "${name}"`);
        return found;
      },
      sliders: () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="range"]')),
      root: () => {
        const el = container.querySelector<HTMLElement>('[data-testid="build-root"]');
        if (!el) throw new Error('no build-root');
        return el;
      },
    };

    try {
      await body(rig);
    } finally {
      act(() => reactRoot.unmount());
      container.remove();
    }
  }

  function setSlider(el: HTMLInputElement, val: number): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(el, String(val));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  it('clicking disabled Feel or Hand in speaks build.needPin', async () => {
    await withTestBuild((rig) => {
      const feelBtn = rig.button(t('build.feel'));
      const handInBtn = rig.button(t('build.handIn'));

      expect(feelBtn.getAttribute('aria-disabled')).toBe('true');
      expect(handInBtn.getAttribute('aria-disabled')).toBe('true');

      act(() => feelBtn.click());
      expect(rig.speak).toHaveBeenCalledWith(t('build.needPin'), expect.any(String));

      rig.speak.mockClear();
      act(() => handInBtn.click());
      expect(rig.speak).toHaveBeenCalledWith(t('build.needPin'), expect.any(String));
    });
  });

  it('Hand in button speaks build.handin.soon when enabled', async () => {
    await withTestBuild((rig) => {
      const [sx, sy] = rig.sliders();
      if (!sx || !sy) throw new Error('sliders missing');
      setSlider(sx, 1);
      setSlider(sy, 1);
      act(() => rig.button(t('build.pin')).click());

      const handInBtn = rig.button(t('build.handIn'));
      expect(handInBtn.getAttribute('aria-disabled')).toBe('false');

      rig.speak.mockClear();
      act(() => handInBtn.click());
      expect(rig.speak).toHaveBeenCalledWith(t('build.handin.soon'), expect.any(String));
    });
  });

  it('header Back button triggers onBack prop', async () => {
    await withTestBuild((rig) => {
      const backBtn = rig.button(t('common.back'));
      act(() => backBtn.click());
      expect(rig.onBack).toHaveBeenCalledTimes(1);
    });
  });

  it('speaks build.feelSmall when scale is under 352', async () => {
    const origInnerWidth = window.innerWidth;
    const origInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 320 });

    try {
      await withTestBuild((rig) => {
        const [sx, sy] = rig.sliders();
        if (!sx || !sy) throw new Error('sliders missing');
        setSlider(sx, 3);
        setSlider(sy, 4);
        act(() => rig.button(t('build.pin')).click());

        rig.speak.mockClear();
        act(() => rig.button(t('build.feel')).click());
        expect(rig.speak).toHaveBeenCalledWith(t('build.feelSmall'), expect.any(String));
        expect(rig.root().getAttribute('data-mode')).toBe('feel');
      });
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: origInnerWidth });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: origInnerHeight });
    }
  });
});
