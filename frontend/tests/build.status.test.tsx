// @vitest-environment jsdom
/**
 * Lane hi17: Ghost Hand Build form status line tests (Requirement 52).
 *
 * DO:
 * - The status line shows t('build.prompt') ONLY while the draft has no pins.
 * - Otherwise it shows the real state of the draft: the work summary (describeWork
 *   lines through tf: build.work.count "{count} points." and, when stitched, build.work.stitched)
 *   followed by the last outcome text that was just spoken (pinned / occupied / stitched / undo / needPin),
 *   so what a sighted helper reads equals what the student hears.
 * - Follows every Pin, Undo and Stitch (including Undo back to zero pins, which shows empty prompt again).
 * - aria-live polite retained.
 * - Same wording as the spoken line.
 * - Vitest coverage:
 *   - 0 pins prompt
 *   - after 1, 2 and 6 pins the status says the count and not the prompt
 *   - after Undo to 0 the prompt returns
 *   - Stitch adds the joins
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDraft, pin, stitchInOrder } from '../src/core/pegboard';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { buildStatusText } from '../src/flow/build';
import { getLang, setLang, t, tf } from '../src/i18n';
import { Build } from '../src/screens/Build';
import { setupRigEnv, teardownRigEnv } from './support/exploreRig';

interface TestRig {
  container: HTMLDivElement;
  speak: ReturnType<typeof vi.fn>;
  onBack: ReturnType<typeof vi.fn>;
  status: () => HTMLElement;
  button: (name: string) => HTMLButtonElement;
  sliders: () => HTMLInputElement[];
  root: () => HTMLElement;
  spoken: () => string[];
}

async function withBuildScreen(body: (rig: TestRig) => Promise<void> | void): Promise<void> {
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
    status: () => {
      const el = container.querySelector<HTMLElement>('.gt-build__status');
      if (!el) throw new Error('no .gt-build__status element');
      return el;
    },
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
    spoken: () => speak.mock.calls.map((c) => String(c[0])),
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

function pinAt(rig: TestRig, x: number, y: number): void {
  const [sx, sy] = rig.sliders();
  if (!sx || !sy) throw new Error('sliders missing');
  setSlider(sx, x);
  setSlider(sy, y);
  act(() => rig.button(t('build.pin')).click());
}

describe('Lane hi17: Build form status line', () => {
  const initialLang = getLang();

  beforeEach(() => {
    setupRigEnv();
    setLang('en');
  });

  afterEach(() => {
    teardownRigEnv();
    setLang(initialLang);
  });

  describe('Pure buildStatusText unit tests', () => {
    it('0 pins prompt: empty draft returns t("build.prompt")', () => {
      const draft = emptyDraft();
      expect(buildStatusText(draft)).toBe(t('build.prompt'));
      expect(buildStatusText(draft, null)).toBe(t('build.prompt'));
      // Even if lastSpeech was set (e.g. needPin or undo), 0 pins draft returns prompt
      expect(buildStatusText(draft, { key: 'build.needPin', params: {} })).toBe(t('build.prompt'));
      expect(buildStatusText(draft, { key: 'build.undoPin', params: { id: 'A' } })).toBe(t('build.prompt'));
    });

    it('after 1, 2 and 6 pins status says the count and not the prompt', () => {
      let draft = emptyDraft();
      const p1 = pin(draft, 1, 1);
      if (p1.kind !== 'pinned') throw new Error('pin failed');
      draft = p1.scene;

      const speech1 = { key: 'build.pinned', params: { id: p1.id, label: p1.label } };
      const text1 = buildStatusText(draft, speech1);
      expect(text1).not.toContain(t('build.prompt'));
      expect(text1).toContain(tf('build.work.count', { count: '1' }));
      expect(text1).toContain(tf('build.pinned', { id: 'A', label: 'x 1 y 1' }));
      expect(text1).toBe('1 points. Added point A at x 1 y 1.');

      const p2 = pin(draft, 2, 3);
      if (p2.kind !== 'pinned') throw new Error('pin failed');
      draft = p2.scene;

      const speech2 = { key: 'build.pinned', params: { id: p2.id, label: p2.label } };
      const text2 = buildStatusText(draft, speech2);
      expect(text2).not.toContain(t('build.prompt'));
      expect(text2).toContain(tf('build.work.count', { count: '2' }));
      expect(text2).toBe('2 points. Added point B at x 2 y 3.');

      // Add pins up to 6
      for (const [x, y] of [[3, 4], [4, 5], [5, 6], [6, 7]] as [number, number][]) {
        const res = pin(draft, x, y);
        if (res.kind !== 'pinned') throw new Error('pin failed');
        draft = res.scene;
      }
      const speech6 = { key: 'build.pinned', params: { id: 'F', label: 'x 6 y 7' } };
      const text6 = buildStatusText(draft, speech6);
      expect(text6).not.toContain(t('build.prompt'));
      expect(text6).toContain(tf('build.work.count', { count: '6' }));
      expect(text6).toBe('6 points. Added point F at x 6 y 7.');
    });

    it('Stitch adds the joins and describes pairs joined', () => {
      let draft = emptyDraft();
      const r1 = pin(draft, 1, 1);
      if (r1.kind !== 'pinned') throw new Error('pin failed');
      draft = r1.scene;
      const r2 = pin(draft, 2, 3);
      if (r2.kind !== 'pinned') throw new Error('pin failed');
      draft = r2.scene;
      const stitched = stitchInOrder(draft);

      const speech = { key: 'build.stitched', params: { count: 1 } };
      const text = buildStatusText(stitched, speech);
      expect(text).toContain(tf('build.work.count', { count: '2' }));
      expect(text).toContain(tf('build.work.stitched', { count: '1' }));
      expect(text).toContain(tf('build.stitched', { count: '1' }));
      expect(text).toBe('2 points. 1 joins. Joined 1 pairs of points, left to right.');
    });

    it('after Undo to 0 the prompt returns', () => {
      const empty = emptyDraft();
      // Even if previous action was undoPin, with 0 pins remaining, prompt returns
      const text = buildStatusText(empty, { key: 'build.undoPin', params: { id: 'A' } });
      expect(text).toBe(t('build.prompt'));
    });

    it('handles occupied crossing feedback while maintaining count', () => {
      let draft = emptyDraft();
      const p1 = pin(draft, 1, 1);
      if (p1.kind !== 'pinned') throw new Error('pin failed');
      draft = p1.scene;

      const occupiedSpeech = { key: 'build.occupied', params: { id: 'A', label: 'x 1 y 1' } };
      const text = buildStatusText(draft, occupiedSpeech);
      expect(text).toContain(tf('build.work.count', { count: '1' }));
      expect(text).toContain(tf('build.occupied', { id: 'A', label: 'x 1 y 1' }));
      expect(text).toBe('1 points. There is already a point at x 1 y 1. It is A.');
    });

    it('supports Hindi and Gujarati language modes', () => {
      let draft = emptyDraft();
      const p1 = pin(draft, 1, 1);
      if (p1.kind !== 'pinned') throw new Error('pin failed');
      draft = p1.scene;
      const speech = { key: 'build.pinned', params: { id: 'A', label: 'x 1 y 1' } };

      // Hindi
      setLang('hi');
      const textHi = buildStatusText(draft, speech);
      expect(textHi).toContain(tf('build.work.count', { count: '1' }));
      expect(textHi).toContain(tf('build.pinned', { id: 'A', label: 'x 1 y 1' }));

      // Gujarati
      setLang('gu');
      const textGu = buildStatusText(draft, speech);
      expect(textGu).toContain(tf('build.work.count', { count: '1' }));
      expect(textGu).toContain(tf('build.pinned', { id: 'A', label: 'x 1 y 1' }));
    });
  });

  describe('Component integration: Build screen status element', () => {
    it('0 pins prompt is rendered initially in .gt-build__status with aria-live="polite"', async () => {
      await withBuildScreen((rig) => {
        const statusEl = rig.status();
        expect(statusEl.getAttribute('aria-live')).toBe('polite');
        expect(statusEl.textContent).toBe(t('build.prompt'));
        expect(statusEl.textContent).toContain('Empty graph');
      });
    });

    it('after 1, 2 and 6 pins the status says the count and not the prompt', async () => {
      await withBuildScreen((rig) => {
        const statusEl = rig.status();
        expect(statusEl.textContent).toContain('Empty graph');

        // Pin 1
        pinAt(rig, 0, 0);
        expect(statusEl.textContent).not.toContain('Empty graph');
        expect(statusEl.textContent).toContain('1');
        expect(statusEl.textContent).toContain('1 points.');
        expect(statusEl.textContent).toContain(tf('build.pinned', { id: 'A', label: 'x 0 y 0' }));

        // Pin 2
        pinAt(rig, 1, 2);
        expect(statusEl.textContent).not.toContain('Empty graph');
        expect(statusEl.textContent).toContain('2');
        expect(statusEl.textContent).toContain('2 points.');
        expect(statusEl.textContent).toContain(tf('build.pinned', { id: 'B', label: 'x 1 y 2' }));

        // Pin 3, 4, 5, 6
        pinAt(rig, 2, 3);
        pinAt(rig, 3, 5);
        pinAt(rig, 4, 6);
        pinAt(rig, 5, 8);

        expect(rig.root().getAttribute('data-pins')).toBe('6');
        expect(statusEl.textContent).not.toContain('Empty graph');
        expect(statusEl.textContent).toContain('6');
        expect(statusEl.textContent).toContain('6 points.');
        expect(statusEl.textContent).toContain(tf('build.pinned', { id: 'F', label: 'x 5 y 8' }));
      });
    });

    it('Stitch adds the joins and Undo removes them', async () => {
      await withBuildScreen((rig) => {
        const statusEl = rig.status();
        pinAt(rig, 1, 1);
        pinAt(rig, 2, 3);
        pinAt(rig, 4, 5);

        // Before stitch: no joins mentioned
        expect(statusEl.textContent).not.toContain('joins');

        // Stitch in order
        act(() => rig.button(t('build.stitch')).click());
        expect(rig.root().getAttribute('data-segments')).toBe('2');
        expect(statusEl.textContent).toContain('3 points.');
        expect(statusEl.textContent).toContain('2 joins.');
        expect(statusEl.textContent).toContain(tf('build.stitched', { count: '2' }));

        // Undo stitch: joins removed, points kept
        act(() => rig.button(t('build.undo')).click());
        expect(rig.root().getAttribute('data-segments')).toBe('0');
        expect(statusEl.textContent).toContain('3 points.');
        expect(statusEl.textContent).not.toContain('joins.');
        expect(statusEl.textContent).toContain(t('build.undoStitch'));
      });
    });

    it('after Undo to 0 the prompt returns', async () => {
      await withBuildScreen((rig) => {
        const statusEl = rig.status();
        pinAt(rig, 1, 1);
        expect(statusEl.textContent).not.toContain('Empty graph');
        expect(statusEl.textContent).toContain('1');

        pinAt(rig, 2, 3);
        expect(statusEl.textContent).toContain('2');

        // Undo second pin: returns to 1 point
        act(() => rig.button(t('build.undo')).click());
        expect(statusEl.textContent).not.toContain('Empty graph');
        expect(statusEl.textContent).toContain('1');
        expect(statusEl.textContent).toContain(tf('build.undoPin', { id: 'B' }));

        // Undo first pin: returns to 0 pins -> prompt returns!
        act(() => rig.button(t('build.undo')).click());
        expect(statusEl.textContent).toContain('Empty graph');
        expect(statusEl.textContent).toBe(t('build.prompt'));
      });
    });

    it('attempting to pin occupied crossing updates outcome text without corrupting count', async () => {
      await withBuildScreen((rig) => {
        const statusEl = rig.status();
        pinAt(rig, 2, 4);
        expect(statusEl.textContent).toBe('1 points. Added point A at x 2 y 4.');

        // Try pinning same crossing (2, 4)
        act(() => rig.button(t('build.pin')).click());
        expect(statusEl.textContent).toBe('1 points. There is already a point at x 2 y 4. It is A.');
        expect(rig.root().getAttribute('data-pins')).toBe('1');
      });
    });
  });
});
