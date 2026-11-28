// @vitest-environment jsdom
/**
 * Task 93.3a (Requirement 53.24): Correct, Teach, Saved diagrams and Settings each speak ONE
 * utterance when they open: the screen's lead, then its `host.<screen>.next` line. `speak()`
 * cancels the previous line, so a second utterance would cut the first off, and a live region
 * next to the speech would be read twice (StatusText convention).
 */
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import type { DiagramScene } from '../src/core/scene';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { joinAnnouncements } from '../src/flow/explore';
import { hostEntryAnnouncement } from '../src/flow/host';
import { savedEntryAnnouncement } from '../src/flow/saved';
import { setLang, t, type Lang } from '../src/i18n';
import { Correct } from '../src/screens/Correct';
import { SavedDiagrams } from '../src/screens/SavedDiagrams';
import { Teach } from '../src/screens/Teach';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LANGS: readonly Lang[] = ['en', 'hi', 'gu'];

const scene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.2, y: 0.2, label: 'C' },
  ],
  segments: [{ id: 's_ab', a: 'A', b: 'B', label: 'AB' }],
  polylines: [],
  bars: [],
};

type SpeakMock = ReturnType<typeof vi.fn<(text: string, lang?: string) => void>>;

function makeDrivers(store = new MemoryDiagramStore()): { drivers: Drivers; speak: SpeakMock } {
  const speak = vi.fn<(text: string, lang?: string) => void>();
  const drivers = {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(() => true), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: {
      speak,
      listen: vi.fn(),
      stopSpeaking: vi.fn(),
      getRate: () => 'normal',
      setRate: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: store,
  } as unknown as Drivers;
  return { drivers, speak };
}

async function mount(element: ReactElement): Promise<{ container: HTMLElement; unmount: () => Promise<void> }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const lines = (speak: SpeakMock): string[] => speak.mock.calls.map((c) => String(c[0]));

/** The next-step line is inside exactly one spoken utterance, after its lead, and nothing follows. */
function expectOneUtterance(spoken: string[], lead: string, next: string): void {
  const withNext = spoken.filter((l) => l.includes(next));
  expect(withNext).toHaveLength(1);
  expect(withNext[0]).toBe(joinAnnouncements([lead, next]));
  expect(spoken[spoken.length - 1]).toBe(withNext[0]);
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  setLang('en');
  vi.restoreAllMocks();
});

describe.each(LANGS)('next-step line on screen open (%s)', (lang) => {
  beforeEach(() => setLang(lang));

  it('Correct speaks its title and host.correct.next as one utterance', async () => {
    const { drivers, speak } = makeDrivers();
    const view = await mount(
      createElement(Correct, { scene, photoUrl: null, drivers, onSave: vi.fn(), onCancel: vi.fn() }),
    );
    expectOneUtterance(lines(speak), t('correct.title'), t('host.correct.next'));
    // correct.intro would be a second next step; it stays visual only.
    expect(lines(speak).some((l) => l.includes(t('correct.intro')))).toBe(false);
    await view.unmount();
  });

  it('Teach speaks its intro and host.teach.next as one utterance', async () => {
    const { drivers, speak } = makeDrivers();
    const view = await mount(createElement(Teach, { drivers, onBack: vi.fn() }));
    expectOneUtterance(lines(speak), t('teach.intro'), t('host.teach.next'));
    await view.unmount();
  });

  it('Settings speaks "opened" and host.settings.next as one utterance', async () => {
    const { drivers, speak } = makeDrivers();
    const view = await mount(
      createElement(LabSettings, { open: true, onClose: vi.fn(), drivers, speak }),
    );
    expectOneUtterance(lines(speak), t('lab.settings.opened'), t('host.settings.next'));
    await view.unmount();
  });
});

describe('Saved diagrams entry (53.24b)', () => {
  const entry = (id: string, createdAt: number): SavedDiagram => ({
    id,
    createdAt,
    title: `T${id}`,
    thumbnailDataUrl: '',
    scene: { ...scene, title: `Diagram ${id}` },
    pinned: false,
  });

  it.each(LANGS)('with entries: heading, next step, then titles, once (%s)', async (lang) => {
    setLang(lang);
    const store = new MemoryDiagramStore();
    await store.put(entry('1', 1));
    await store.put(entry('2', 2));
    const { drivers, speak } = makeDrivers(store);
    const view = await mount(
      createElement(SavedDiagrams, { diagramStore: store, speech: drivers.speech, onOpen: vi.fn(), onBack: vi.fn() }),
    );
    const spoken = lines(speak);
    const withNext = spoken.filter((l) => l.includes(t('host.saved.next')));
    expect(withNext).toHaveLength(1);
    expect(spoken[spoken.length - 1]).toBe(withNext[0]);
    const w = withNext[0]!;
    expect(w.indexOf(t('saved.heading'))).toBe(0);
    expect(w.indexOf(t('saved.heading'))).toBeLessThan(w.indexOf(t('host.saved.next')));
    expect(w.indexOf(t('host.saved.next'))).toBeLessThan(w.indexOf('Diagram 2'));
    // The heading is never a separate utterance that the list would cut off.
    expect(spoken.filter((l) => l === t('saved.heading'))).toHaveLength(0);
    await view.unmount();
  });

  it('empty list: heading and notice, and no "choose a saved diagram" line', async () => {
    const store = new MemoryDiagramStore();
    const { drivers, speak } = makeDrivers(store);
    const view = await mount(
      createElement(SavedDiagrams, { diagramStore: store, speech: drivers.speech, onOpen: vi.fn(), onBack: vi.fn() }),
    );
    const spoken = lines(speak);
    expect(spoken[spoken.length - 1]).toBe(joinAnnouncements([t('saved.heading'), t('saved.empty')]));
    expect(spoken.some((l) => l.includes(t('host.saved.next')))).toBe(false);
    await view.unmount();
  });

  it('savedEntryAnnouncement leaves out the next step for empty and error views', () => {
    for (const phase of ['empty', 'error'] as const) {
      const text = savedEntryAnnouncement({ phase, entries: [], announcement: 'notice' });
      expect(text).toBe(joinAnnouncements([t('saved.heading'), 'notice']));
    }
    const list = savedEntryAnnouncement({ phase: 'list', entries: [], announcement: 'one. two' });
    expect(list).toBe(joinAnnouncements([t('saved.heading'), t('host.saved.next'), 'one. two']));
  });
});

describe('hostEntryAnnouncement', () => {
  it('joins the lead and the screen line, and a lead of nothing gives the line alone', () => {
    expect(hostEntryAnnouncement('teach', 'Lead')).toBe(`Lead. ${t('host.teach.next')}`);
    expect(hostEntryAnnouncement('settings')).toBe(t('host.settings.next'));
  });
});

describe('Ask (53.24d)', () => {
  it('every path that opens the typing box already speaks a line naming where it is', () => {
    for (const lang of LANGS) {
      setLang(lang);
      for (const key of [
        'ask.errorNoSpeech',
        'ask.errorDenied',
        'ask.errorTimeout',
        'ask.errorListenTimeout',
        'ask.errorBusy',
        'ask.errorServer',
        'ask.errorBadResponse',
        'ask.errorFailed',
        'ask.errorUnsupported',
      ]) {
        expect(t(key).trim()).not.toBe('');
      }
    }
    setLang('en');
    for (const key of ['ask.errorUnsupported', 'ask.errorEmpty', 'ask.errorNoSpeech']) {
      expect(t(key)).toMatch(/box below the diagram/);
    }
  });
});
