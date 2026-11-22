// @vitest-environment jsdom
/**
 * Task 86 oracles for Requirement 52 (Ghost Hand) on the Build screen. Kiro.
 *
 * The screen does not exist yet. `import.meta.glob` returns nothing when `screens/Build.tsx` is
 * missing, so each `it.fails` oracle is red for that reason and the file still loads. When lane
 * C-screen lands, vitest reports "expected to fail but passed", the lane removes `.fails`, and the
 * test then guards the screen. Tests without `.fails` pass today: controls (the unchanged Explore
 * already speaks a pin and buzzes a stitched side, so Feel needs no new behaviour).
 *
 * Contract (design.md "Screen contract for the lanes"): `Build` takes `{ drivers, onBack }`; root
 * `data-testid="build-root"` with `data-pins`, `data-segments`, `data-mode` (`form` | `feel`); two
 * `input[type=range]` with accessible names and `aria-valuetext` "x 3" / "y 5"; buttons named by
 * `t('build.pin' | 'build.undo' | 'build.stitch' | 'build.feel' | 'build.handIn')`. Expected wording
 * is built with `t()` / `tf()` so the oracle follows the lane's words and fixes only WHAT is said
 * and WHEN.
 */
import { act, createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDraft, pin, stitchInOrder } from '../src/core/pegboard';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { t, tf } from '../src/i18n';
import { decodeShare } from '../src/share/codec';
import { setupRigEnv, teardownRigEnv, withExplore } from './support/exploreRig';

interface BuildProps {
  drivers: Drivers;
  onBack: () => void;
}

const modules = import.meta.glob('../src/screens/Build.tsx');

async function loadBuild(): Promise<ComponentType<BuildProps>> {
  const loader = Object.values(modules)[0];
  if (loader === undefined) throw new Error('screens/Build.tsx does not exist yet (lane C-screen)');
  const mod = (await loader()) as { Build?: ComponentType<BuildProps> };
  if (mod.Build === undefined) throw new Error('screens/Build.tsx exports no Build');
  return mod.Build;
}

interface BuildRig {
  container: HTMLDivElement;
  speak: ReturnType<typeof vi.fn>;
  vibrate: ReturnType<typeof vi.fn>;
  setTone: ReturnType<typeof vi.fn>;
  playEarcon: ReturnType<typeof vi.fn>;
  onBack: ReturnType<typeof vi.fn>;
  root: () => HTMLElement;
  spoken: () => string[];
}

async function withBuild(body: (rig: BuildRig) => Promise<void> | void): Promise<void> {
  const Build = await loadBuild();
  const speak = vi.fn();
  const vibrate = vi.fn(() => true);
  const setTone = vi.fn();
  const playEarcon = vi.fn();
  const onBack = vi.fn();
  const drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone,
      setGuideTone: vi.fn(),
      beep: vi.fn(),
      playEarcon,
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
  const rig: BuildRig = {
    container,
    speak,
    vibrate,
    setTone,
    playEarcon,
    onBack,
    root: () => {
      const el = container.querySelector<HTMLElement>('[data-testid="build-root"]');
      if (el === null) throw new Error('no build-root element');
      return el;
    },
    spoken: () => speak.mock.calls.map((c) => String(c[0])),
  };
  try {
    await body(rig);
  } finally {
    act(() => reactRoot.unmount());
    container.remove();
  }
}

function button(rig: BuildRig, name: string): HTMLButtonElement {
  const all = Array.from(rig.container.querySelectorAll<HTMLButtonElement>('button'));
  const found = all.find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name);
  if (found === undefined) throw new Error(`no button named "${name}"`);
  return found;
}

function sliders(rig: BuildRig): HTMLInputElement[] {
  return Array.from(rig.container.querySelectorAll<HTMLInputElement>('input[type="range"]'));
}

function setSlider(el: HTMLInputElement, value: number): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function click(el: HTMLElement): void {
  act(() => el.click());
}

function pinAt(rig: BuildRig, gx: number, gy: number): void {
  const [sx, sy] = sliders(rig);
  if (sx === undefined || sy === undefined) throw new Error('sliders missing');
  setSlider(sx, gx);
  setSlider(sy, gy);
  click(button(rig, t('build.pin')));
}

const isDisabled = (b: HTMLButtonElement): boolean => b.disabled || b.getAttribute('aria-disabled') === 'true';

describe('task 86: Requirement 52 oracles (lanes C-screen, C-wire, C-hand-in)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('controls: Feel needs no new behaviour from Explore (52.8)', () => {
    function draft(points: Array<[number, number]>, stitched: boolean): DiagramScene {
      let s = emptyDraft();
      for (const [gx, gy] of points) {
        const r = pin(s, gx, gy);
        if (r.kind === 'pinned') s = r.scene;
      }
      return stitched ? stitchInOrder(s) : s;
    }

    it('control: a touch on a pin speaks its label in the unchanged Explore', async () => {
      // pin (3, 4) is at norm (0.5, 0.5), screen (200, 200) on the 400 px rig canvas
      await withExplore({ scene: draft([[3, 4]], false), announced: 'Draft' }, (rig) => {
        rig.clearCalls();
        rig.down(200, 200);
        rig.advance(100);
        expect(rig.spoken().join(' | ')).toContain('x 3 y 4');
      });
    });

    it('control: a touch on a stitched side buzzes as a line', async () => {
      // pins (1, 4) and (5, 4) are joined; their midpoint is screen (200, 200)
      await withExplore({ scene: draft([[1, 4], [5, 4]], true), announced: 'Draft' }, (rig) => {
        rig.clearCalls();
        rig.down(200, 200);
        rig.advance(200);
        expect(rig.vibrations().some((c) => c[0] === 80)).toBe(true);
      });
    });
  });

  describe('B1 and B2: the form and its disabled states (52.3, 52.8)', () => {
    it('B1 two named sliders with aria-valuetext, and the five buttons', async () => {
      await withBuild((rig) => {
        const s = sliders(rig);
        expect(s).toHaveLength(2);
        for (const el of s) {
          const name = el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby') ?? '';
          expect(name.length).toBeGreaterThan(0);
        }
        expect(s[0]?.getAttribute('aria-valuetext')).toMatch(/^x \d$/);
        expect(s[1]?.getAttribute('aria-valuetext')).toMatch(/^y \d$/);
        expect([s[0]?.min, s[0]?.max]).toEqual(['0', '6']);
        expect([s[1]?.min, s[1]?.max]).toEqual(['0', '8']);
        for (const key of ['build.pin', 'build.undo', 'build.stitch', 'build.feel', 'build.handIn']) {
          expect(button(rig, t(key))).toBeTruthy();
        }
        expect(rig.root().getAttribute('data-pins')).toBe('0');
        expect(rig.root().getAttribute('data-mode')).toBe('form');
      });
    });

    it('B2 Feel and Hand in are disabled with no pin and enabled after one', async () => {
      await withBuild((rig) => {
        expect(isDisabled(button(rig, t('build.feel')))).toBe(true);
        expect(isDisabled(button(rig, t('build.handIn')))).toBe(true);
        pinAt(rig, 2, 5);
        expect(rig.root().getAttribute('data-pins')).toBe('1');
        expect(isDisabled(button(rig, t('build.feel')))).toBe(false);
        expect(isDisabled(button(rig, t('build.handIn')))).toBe(false);
        expect(sliders(rig)[0]?.getAttribute('aria-valuetext')).toBe('x 2');
        expect(sliders(rig)[1]?.getAttribute('aria-valuetext')).toBe('y 5');
      });
    });
  });

  describe('B3 and B4: pin, refuse, stitch, undo (52.4, 52.6, 52.7)', () => {
    it('B3 a pin is spoken, the same crossing again adds nothing and says why', async () => {
      await withBuild((rig) => {
        pinAt(rig, 2, 5);
        expect(rig.spoken().at(-1)).toBe(tf('build.pinned', { id: 'A', label: 'x 2 y 5' }));
        click(button(rig, t('build.pin')));
        expect(rig.root().getAttribute('data-pins')).toBe('1');
        expect(rig.spoken().at(-1)).toBe(tf('build.occupied', { id: 'A', label: 'x 2 y 5' }));
      });
    });

    it('B4 Stitch makes n - 1 segments in one step and Undo takes them back in one step', async () => {
      await withBuild((rig) => {
        pinAt(rig, 0, 1);
        pinAt(rig, 1, 3);
        pinAt(rig, 2, 5);
        click(button(rig, t('build.stitch')));
        expect(rig.root().getAttribute('data-segments')).toBe('2');
        click(button(rig, t('build.undo')));
        expect(rig.root().getAttribute('data-segments')).toBe('0');
        expect(rig.root().getAttribute('data-pins')).toBe('3');
        click(button(rig, t('build.undo')));
        expect(rig.root().getAttribute('data-pins')).toBe('2');
      });
    });
  });

  describe('B5: Feel mounts the real Explore and Back keeps the pins (52.8)', () => {
    it('Feel shows the Explore canvas, a pin speaks its label, Back returns to the form with the pins', async () => {
      await withBuild((rig) => {
        pinAt(rig, 3, 4);
        pinAt(rig, 6, 8);
        click(button(rig, t('build.feel')));
        expect(rig.root().getAttribute('data-mode')).toBe('feel');
        const canvas = rig.container.querySelector('canvas.gt-explore__canvas');
        expect(canvas).not.toBeNull();
        const back = rig.container.querySelector<HTMLButtonElement>('.gt-explore__back');
        expect(back).not.toBeNull();
        if (back) click(back);
        expect(rig.root().getAttribute('data-mode')).toBe('form');
        expect(rig.root().getAttribute('data-pins')).toBe('2');
        expect(rig.onBack).not.toHaveBeenCalled();
      });
    });
  });

  describe('B6: the form adds no vibration, tone or earcon (52.16)', () => {
    it('pinning, stitching and undoing call no vibrate, setTone or playEarcon', async () => {
      await withBuild((rig) => {
        pinAt(rig, 1, 1);
        pinAt(rig, 4, 6);
        click(button(rig, t('build.stitch')));
        click(button(rig, t('build.undo')));
        expect(rig.root().getAttribute('data-pins')).toBe('2');
        expect(rig.vibrate).not.toHaveBeenCalled();
        expect(rig.setTone).not.toHaveBeenCalled();
        expect(rig.playEarcon).not.toHaveBeenCalled();
      });
    });
  });

  describe('B7: Hand in shows the point list and a link that decodes to the draft (52.14)', () => {
    it('the list has every pin, the text says not checked, the link decodes to the scene', async () => {
      await withBuild((rig) => {
        pinAt(rig, 0, 1);
        pinAt(rig, 1, 3);
        click(button(rig, t('build.stitch')));
        click(button(rig, t('build.handIn')));
        const text = rig.container.querySelector('[data-testid="build-handin-text"]')?.textContent ?? '';
        expect(text).toContain('A: x 0 y 1');
        expect(text).toContain('B: x 1 y 3');
        expect(text.toLowerCase()).toContain(t('build.handin.notChecked').toLowerCase());
        expect(/verified|correct|approved/i.test(text)).toBe(false);
        const link = rig.container.querySelector<HTMLAnchorElement>('a[data-testid="build-handin-link"]');
        expect(link).not.toBeNull();
        const hash = (link?.getAttribute('href') ?? '').split('#s=')[1] ?? '';
        const scene = decodeShare(hash).scene;
        expect(scene.points?.map((p) => p.label)).toEqual(['x 0 y 1', 'x 1 y 3']);
        expect(scene.segments).toHaveLength(1);
      });
    });
  });
});
