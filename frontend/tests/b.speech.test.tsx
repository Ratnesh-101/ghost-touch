// @vitest-environment jsdom
/**
 * Task 93.5 (Requirement 53.19 to 53.23): speech integrity fixes from
 * docs/reports/wb-playwright-probe.md.
 *
 * 1. Build: the title and the next step are ONE utterance (speak() cancels the previous line).
 * 2. Correct: the intro is spoken once (App no longer speaks it; the screen does on mount).
 * 3. Explore: the Raw Mode notice is not a live region while the app speaks the entry line.
 * 4. Teach Back with no diagram to return to goes to Capture, not Start.
 * 5. The cursor debug line is absent unless `showDebug` is on.
 * 6. The Settings spoken title matches the sheet title.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { setLang, t } from '../src/i18n';
import { Build } from '../src/screens/Build';
import { Explore } from '../src/screens/Explore';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeDrivers(canSpeak: boolean): { drivers: Drivers; speak: ReturnType<typeof vi.fn> } {
  const speak = vi.fn();
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
      canSpeak,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  } as unknown as Drivers;
  return { drivers, speak };
}

const rawScene: DiagramScene = { kind: 'unknown', title: 'Raw Diagram' };

function src(rel: string): string {
  return fs.readFileSync(new URL(rel, import.meta.url), 'utf-8') as string;
}

afterEach(() => {
  setLang('en');
});

describe('Build entry is one utterance (53.19)', () => {
  it('speaks title and prompt together, never the prompt cut off by the title', async () => {
    const { drivers, speak } = makeDrivers(true);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(Build, { drivers, onBack: vi.fn() }));
    });
    const lines = speak.mock.calls.map((c) => String(c[0]));
    const entry = lines.filter((l) => l.includes(t('build.title')));
    expect(entry).toHaveLength(1);
    expect(entry[0]).toContain(t('host.build.next'));
    expect(entry[0]!.indexOf(t('build.title'))).toBeLessThan(entry[0]!.indexOf(t('host.build.next')));
    // The last utterance is the combined one, so nothing cancels the next step.
    expect(lines[lines.length - 1]).toBe(entry[0]);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('App does not speak build.prompt on its own before Build mounts', () => {
    const app = src('../src/App.tsx');
    const body = app.slice(app.indexOf('const openBuild'), app.indexOf('const handleBuildBack'));
    expect(body).not.toContain("t('build.prompt')");
    expect(body).not.toContain('speech.speak');
  });
});

describe('Correct intro is spoken once (53.20)', () => {
  it('App.handleCorrect does not speak correct.intro; Correct speaks it on mount', () => {
    const app = src('../src/App.tsx');
    const body = app.slice(app.indexOf('const handleCorrect'), app.indexOf('const handleSaveCorrect'));
    expect(body).not.toContain('correct.intro');
    expect(body).not.toContain('host.correct.next');
    expect(body).not.toContain('speech.speak');
    const screen = src('../src/screens/Correct.tsx');
    expect(screen.split("speak(hostEntryAnnouncement('correct'")).toHaveLength(2);
  });
});

describe('Raw Mode notice is announced once (53.21)', () => {
  const render = (canSpeak: boolean): string =>
    renderToStaticMarkup(
      createElement(Explore, {
        scene: rawScene,
        announced: t('raw.announce'),
        drivers: makeDrivers(canSpeak).drivers,
        onBack: vi.fn(),
        isRaw: true,
      }),
    );

  it('is plain text, not a live region, when the app speaks', () => {
    const html = render(true);
    expect(html).toContain('gt-lab-raw-notice');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('aria-live');
  });

  it('is a polite live region only when the app cannot speak', () => {
    const html = render(false);
    expect(html).toContain('gt-lab-raw-notice');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe('Teach Back goes to the screen it came from (53.22)', () => {
  it('without an Explore scene, Back returns to Capture with the Capture line, not Start', () => {
    const app = src('../src/App.tsx');
    const start = app.indexOf('const handleTeachBack');
    const body = app.slice(start, app.indexOf('// Every hook', start));
    const elseBranch = body.slice(body.indexOf('} else {'));
    expect(elseBranch).toContain("screen: 'capture'");
    expect(elseBranch).toContain("t('host.capture.next')");
    expect(elseBranch).not.toContain("screen: 'start'");
    expect(elseBranch).not.toContain('host.start.next');
  });
});

describe('Debug cursor text is hidden by default (53.23)', () => {
  const render = (showDebug?: boolean): string =>
    renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', points: [{ id: 'A', x: 0.2, y: 0.2, label: 'A' }], segments: [] },
        announced: 'Entry',
        drivers: makeDrivers(true).drivers,
        onBack: vi.fn(),
        ...(showDebug === undefined ? {} : { showDebug }),
      }),
    );

  it('renders no debug line by default', () => {
    const html = render();
    expect(html).not.toContain('gt-explore__debug');
    expect(html).not.toContain(t('explore.debugWaiting'));
  });

  it('renders it, hidden from the accessibility tree, when the flag is on', () => {
    const html = render(true);
    expect(html).toContain('gt-explore__debug');
    expect(html).toContain(t('explore.debugWaiting'));
    expect(html).toMatch(/gt-explore__debug[^>]*aria-hidden="true"/);
  });
});

describe('Settings spoken title matches the sheet title (53.23)', () => {
  it('lab.settings.opened names the same word as lab.settings.title', () => {
    expect(t('lab.settings.opened')).toContain(t('lab.settings.title'));
    expect(t('lab.settings.opened')).not.toMatch(/\blab\b/i);
  });
});
