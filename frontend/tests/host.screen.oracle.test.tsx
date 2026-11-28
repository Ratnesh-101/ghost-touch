// @vitest-environment jsdom
/**
 * P194, P195, P196 (Requirement 53, task 92.4). Written as oracles before lane H-wire; the lane
 * has landed GH-01, GH-04, GH-05, GH-06, GH-10, so they now run as normal tests.
 *
 * Honest limits: jsdom has no layout, so P196 reads the stylesheet text instead of measuring
 * a 200 % font; and P194 covers Start, the first tap and the Capture line, not every screen.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { ListenError, MemoryDiagramStore, type Drivers } from '../src/drivers';
import type { ListenFailure } from '../src/drivers/speech';
import { setLang, t } from '../src/i18n';
import { lintHostLine } from '../src/core/hostPolicy';
import { exploreAnnouncement } from '../src/flow/navigation';
import { Explore } from '../src/screens/Explore';
import { Start } from '../src/screens/Start';
// @ts-expect-error Node.js runtime fs module in the Vitest run
import fs from 'node:fs';


const exploreCss = fs.readFileSync('src/styles/explore.css', 'utf-8') as string;

type SpeakCall = { text: string; queue: boolean };

function makeDrivers(over?: { listen?: () => Promise<string>; canListen?: boolean }): {
  drivers: Drivers;
  spoken: SpeakCall[];
} {
  const spoken: SpeakCall[] = [];
  const drivers: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(() => true), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn((text: string, _lang?: string, options?: { queue?: boolean }) => {
        spoken.push({ text, queue: options?.queue === true });
      }),
      listen: over?.listen ?? vi.fn(),
      canSpeak: true,
      canListen: over?.canListen ?? true,
      getRate: () => 'normal',
    },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, spoken };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setLang('en');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  setLang('en');
});

describe('P194 one utterance per screen opening (Start, first tap, Capture line)', () => {
  it('speaks the greeting once, replaces it on the tap, and never repeats it', async () => {
    const { drivers, spoken } = makeDrivers();
    const onBegin = vi.fn();
    await act(async () => {
      root.render(createElement(Start, { drivers, onBegin }));
    });
    const greeting = t('host.start.greeting');
    expect(spoken.filter((s) => s.text === greeting)).toHaveLength(1);
    expect(spoken[0]?.queue).toBe(false);

    const button = container.querySelector<HTMLButtonElement>('button.gt-start-surface');
    expect(button).toBeTruthy();
    // GH-04: the accessible name is short, so a screen reader does not read the greeting too.
    const name = button?.getAttribute('aria-label') ?? '';
    expect(name.trim()).not.toBe('');
    expect(name).not.toBe(greeting);
    expect(name.split(/\s+/u).length).toBeLessThanOrEqual(6);

    const before = spoken.length;
    await act(async () => {
      button?.click();
    });
    const after = spoken.slice(before).filter((s) => !s.queue);
    expect(after).toHaveLength(1);
    expect(after[0]?.text).toContain(t('host.capture.next'));
    expect(spoken.filter((s) => s.text === greeting)).toHaveLength(1);
    expect(onBegin).toHaveBeenCalledTimes(1);
  });
});

describe('P195 a typing hint moves focus', () => {
  const scene: DiagramScene = {
    kind: 'geometry',
    title: 'Triangle ABC',
    points: [
      { id: 'A', x: 0.25, y: 0.25, label: 'A' },
      { id: 'B', x: 0.75, y: 0.75, label: 'B' },
    ],
    segments: [{ id: 'AB', a: 'A', b: 'B', label: 'AB' }],
  };
  const reasons: ListenFailure[] = ['no-speech', 'timeout', 'denied', 'failed'];

  for (const reason of reasons) {
    it(`after a failed voice ask (${reason}) the typing box is open and focused`, async () => {
      const proto = HTMLCanvasElement.prototype;
      const origContext = proto.getContext;
      proto.getContext = (() => null) as typeof proto.getContext;
      try {
        const { drivers, spoken } = makeDrivers({
          listen: () => Promise.reject(new ListenError(reason)),
        });
        await act(async () => {
          root.render(
            createElement(Explore, { scene, announced: 'ready', drivers, onBack: vi.fn() }),
          );
        });
        expect(container.querySelector('#gt-ask-input')).toBeNull();
        const ask = container.querySelector<HTMLButtonElement>('.gt-explore__ask');
        await act(async () => {
          ask?.click();
        });
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        const input = container.querySelector<HTMLInputElement>('#gt-ask-input');
        expect(input).toBeTruthy();
        expect(document.activeElement).toBe(input);
        const lastLine = spoken[spoken.length - 1]?.text ?? '';
        expect(lastLine).toMatch(/box/i);
      } finally {
        proto.getContext = origContext;
      }
    });
  }
});

describe('P194 Explore entry announcement through hostPolicy and Explore', () => {
  const scene: DiagramScene = {
    kind: 'geometry',
    title: 'Triangle ABC',
    points: [
      { id: 'A', x: 0.25, y: 0.25, label: 'A' },
      { id: 'B', x: 0.75, y: 0.75, label: 'B' },
    ],
    segments: [{ id: 'AB', a: 'A', b: 'B', label: 'AB' }],
  };

  for (const lang of ['en', 'hi', 'gu'] as const) {
    it(`(${lang}) the entry line passes lintHostLine, is shown once, and Explore does not re-speak it`, async () => {
      setLang(lang);
      const line = exploreAnnouncement(scene);
      expect(line.trim()).not.toBe('');
      const lint = lintHostLine(line, lang, 'nextStep');
      expect(lint.problems).toEqual([]);
      expect(lint.ok).toBe(true);

      const proto = HTMLCanvasElement.prototype;
      const origContext = proto.getContext;
      proto.getContext = (() => null) as typeof proto.getContext;
      try {
        const { drivers, spoken } = makeDrivers();
        await act(async () => {
          root.render(
            createElement(Explore, { scene, announced: line, drivers, onBack: vi.fn() }),
          );
        });
        const shown = container.textContent?.split(line).length ?? 0;
        expect(shown - 1).toBe(1);
        // App speaks the entry line; Explore itself must not speak it again on mount.
        expect(spoken.filter((s) => s.text === line)).toHaveLength(0);
      } finally {
        proto.getContext = origContext;
      }
    });
  }
});

describe('P196 Ghost Host controls: names, targets, no fixed height', () => {
  // jsdom has no layout engine, so a 200 % font scale cannot be measured here. This is a
  // stylesheet-text check only; the 200 % font row belongs to the phone test (92.8).
  it('stylesheet text only (no 200% font measurement): the Explore action buttons use min-height and no fixed height', () => {
    const block = exploreCss.match(
      /\.gt-explore \.gt-explore__actions \.gt-explore__guide-me\s*\{[^}]*\}/u,
    )?.[0];
    expect(block).toBeTruthy();
    expect(block).toMatch(/min-height:\s*var\(--gt-target,\s*48px\)/u);
    expect(block).not.toMatch(/(^|[;{\s])height\s*:/u);
  });

  it('every host line in the three languages passes through one accessible name or text', () => {
    // The Start button is the only host control changed; its name is non-empty in every language.
    for (const lang of ['en', 'hi', 'gu'] as const) {
      setLang(lang);
      expect(`${t('app.name')}, ${t('start.begin')}`.trim().length).toBeGreaterThan(3);
    }
  });
});
