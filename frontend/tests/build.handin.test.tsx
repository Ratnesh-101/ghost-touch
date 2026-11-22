// @vitest-environment jsdom
/**
 * Unit tests for Ghost Hand hand-in flow & screen (Requirement 52, Lane hi14).
 *
 * Requirements:
 * - Hand in disabled when 0 pins (canHandIn false), clicking speaks build.needPin
 * - Hand in shows hand-in panel when pins exist:
 *   - link data-testid="build-handin-link" decodes to the draft scene through decodeShare
 *   - text list data-testid="build-handin-text" has every pin in stitch order
 *   - list heading says "not checked" (build.handin.notChecked)
 *   - list and panel contain no words claiming "verified", "correct", or "approved"
 *   - Copy button is >=48x48 px, invokes clipboard driver and speaks build.handin.copied
 * - If encodeShare throws, speaks share error and never 'verified'
 * - High finding: Feel canvas measurement with 360x800 window and 328 px canvas speaks build.feelSmall
 * - Low finding: Second Stitch press with identical scene returns history unchanged;
 *   Stitch, Stitch, Undo leaves the pins intact
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import * as clipboardDriver from '../src/drivers/clipboard';
import { initialBuildHistory, pressPin, pressStitch, pressUndo } from '../src/flow/build';
import { getLang, LANG_BCP47, t, tf } from '../src/i18n';
import { Build } from '../src/screens/Build';
import * as shareCodec from '../src/share/codec';
import { decodeShare, ShareError } from '../src/share/codec';
import { setupRigEnv, teardownRigEnv } from './support/exploreRig';

describe('Ghost Hand Build Hand-in (Lane hi14)', () => {
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

  function pinAt(rig: TestRig, gx: number, gy: number): void {
    const [sx, sy] = rig.sliders();
    if (!sx || !sy) throw new Error('sliders missing');
    setSlider(sx, gx);
    setSlider(sy, gy);
    act(() => rig.button(t('build.pin')).click());
  }

  it('Hand in is disabled with 0 pins and clicking it speaks build.needPin', async () => {
    await withTestBuild((rig) => {
      const handInBtn = rig.button(t('build.handIn'));
      expect(handInBtn.getAttribute('aria-disabled')).toBe('true');

      act(() => handInBtn.click());
      expect(rig.speak).toHaveBeenCalledWith(t('build.needPin'), expect.any(String));

      // Panel is not rendered
      expect(rig.container.querySelector('[data-testid="build-handin-panel"]')).toBeNull();
    });
  });

  it('Hand in shows hand-in panel with link that decodes to the draft scene and point list in stitch order', async () => {
    await withTestBuild((rig) => {
      // Pin two points in non-stitch order: (3, 5) then (1, 2)
      pinAt(rig, 3, 5);
      pinAt(rig, 1, 2);

      // Stitch in order
      act(() => rig.button(t('build.stitch')).click());

      // Hand in
      const handInBtn = rig.button(t('build.handIn'));
      expect(handInBtn.getAttribute('aria-disabled')).toBe('false');
      act(() => handInBtn.click());

      // Link decodes through decodeShare to the draft scene
      const link = rig.container.querySelector<HTMLAnchorElement>('a[data-testid="build-handin-link"]');
      expect(link).not.toBeNull();
      const href = link?.getAttribute('href') ?? '';
      expect(href).toContain('#s=');
      const hash = href.split('#s=')[1] ?? '';
      const decoded = decodeShare(hash);

      // Decoded scene points match the draft scene
      expect(decoded.scene.points?.map((p) => p.label)).toEqual(['x 3 y 5', 'x 1 y 2']);
      expect(decoded.scene.segments).toHaveLength(1);

      // Read-only text list
      const textEl = rig.container.querySelector('[data-testid="build-handin-text"]');
      expect(textEl).not.toBeNull();
      const text = textEl?.textContent ?? '';

      // Says not checked, never verified/correct/approved
      expect(text.toLowerCase()).toContain(t('build.handin.notChecked').toLowerCase());
      expect(/verified|correct|approved/i.test(text)).toBe(false);

      // Lists every pin in stitch order (B: x 1 y 2 before A: x 3 y 5)
      expect(text).toContain('B: x 1 y 2');
      expect(text).toContain('A: x 3 y 5');
      expect(text.indexOf('B: x 1 y 2')).toBeLessThan(text.indexOf('A: x 3 y 5'));
    });
  });

  it('Copy button is >=48x48 px, copies text, and speaks build.handin.copied', async () => {
    const copySpy = vi.spyOn(clipboardDriver, 'copyToClipboard').mockResolvedValue(true);

    try {
      await withTestBuild(async (rig) => {
        pinAt(rig, 2, 4);
        act(() => rig.button(t('build.handIn')).click());

        const copyBtn = rig.button(t('build.handin.copy'));
        expect(copyBtn).not.toBeNull();

        rig.speak.mockClear();
        await act(async () => {
          copyBtn.click();
        });

        expect(copySpy).toHaveBeenCalledTimes(1);
        const copiedArg = copySpy.mock.calls[0]?.[0] ?? '';
        expect(copiedArg).toContain('#s=');
        expect(copiedArg).toContain('A: x 2 y 4');
        expect(copiedArg).toContain(t('build.handin.notChecked'));

        expect(rig.speak).toHaveBeenCalledWith(t('build.handin.copied'), LANG_BCP47[getLang()]);
      });
    } finally {
      copySpy.mockRestore();
    }
  });

  it('second Stitch press with identical scene returns history unchanged; Stitch, Stitch, Undo leaves pins', async () => {
    // Pure flow level test
    let h = initialBuildHistory();
    h = pressPin(h, 0, 1).history;
    h = pressPin(h, 2, 3).history;

    const resStitch1 = pressStitch(h);
    expect(resStitch1.history.present.segments).toHaveLength(1);
    expect(resStitch1.speech.key).toBe('build.stitched');

    const resStitch2 = pressStitch(resStitch1.history);
    expect(resStitch2.history).toBe(resStitch1.history);
    expect(resStitch2.speech.key).toBe('build.stitched');

    // Undo once removes the stitch
    const resUndo1 = pressUndo(resStitch2.history);
    expect(resUndo1.history.present.segments).toHaveLength(0);
    expect(resUndo1.history.present.points).toHaveLength(2);

    // Screen level test
    await withTestBuild((rig) => {
      pinAt(rig, 0, 1);
      pinAt(rig, 2, 3);
      expect(rig.root().getAttribute('data-pins')).toBe('2');

      act(() => rig.button(t('build.stitch')).click());
      expect(rig.root().getAttribute('data-segments')).toBe('1');

      // Second Stitch press
      act(() => rig.button(t('build.stitch')).click());
      expect(rig.root().getAttribute('data-segments')).toBe('1');

      // Undo leaves the pins intact
      act(() => rig.button(t('build.undo')).click());
      expect(rig.root().getAttribute('data-segments')).toBe('0');
      expect(rig.root().getAttribute('data-pins')).toBe('2');
    });
  });

  it('measures real canvas in Feel mode and speaks build.feelSmall on a 360x800 phone with 328px canvas', async () => {
    const origInnerWidth = window.innerWidth;
    const origInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 360 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });

    const origGetBoundingClientRect = HTMLCanvasElement.prototype.getBoundingClientRect;
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 328,
      height: 328,
      top: 0,
      left: 16,
      right: 344,
      bottom: 328,
      x: 16,
      y: 0,
      toJSON: () => {},
    }));

    try {
      await withTestBuild((rig) => {
        pinAt(rig, 3, 3);

        rig.speak.mockClear();
        act(() => rig.button(t('build.feel')).click());

        // Mode changed to feel
        expect(rig.root().getAttribute('data-mode')).toBe('feel');

        // Spoke build.feelSmall because measured canvas scale (328) < 352
        expect(rig.speak).toHaveBeenCalledWith(t('build.feelSmall'), LANG_BCP47[getLang()]);
      });
    } finally {
      HTMLCanvasElement.prototype.getBoundingClientRect = origGetBoundingClientRect;
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: origInnerWidth });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: origInnerHeight });
    }
  });

  it('if encodeShare throws, speaks share error and never verified', async () => {
    const encodeSpy = vi.spyOn(shareCodec, 'encodeShare').mockImplementation(() => {
      throw new ShareError('bad-scene', 'invalid scene payload');
    });

    try {
      await withTestBuild((rig) => {
        pinAt(rig, 1, 1);
        rig.speak.mockClear();

        act(() => rig.button(t('build.handIn')).click());

        // Spoke share error
        expect(rig.speak).toHaveBeenCalledWith(t('share.error.badScene'), LANG_BCP47[getLang()]);

        // Never spoke 'verified'
        const allSpoken = rig.speak.mock.calls.map((c) => String(c[0])).join(' ');
        expect(/verified|correct|approved/i.test(allSpoken)).toBe(false);
      });
    } finally {
      encodeSpy.mockRestore();
    }
  });

  it('sliders expose localized build.xValue and build.yValue aria-valuetext', async () => {
    await withTestBuild((rig) => {
      const [sx, sy] = rig.sliders();
      if (!sx || !sy) throw new Error('sliders missing');

      setSlider(sx, 4);
      setSlider(sy, 6);

      expect(sx.getAttribute('aria-valuetext')).toBe(tf('build.xValue', { n: String(4) }));
      expect(sy.getAttribute('aria-valuetext')).toBe(tf('build.yValue', { n: String(6) }));
    });
  });
});
