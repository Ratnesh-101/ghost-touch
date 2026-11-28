// @vitest-environment jsdom
/**
 * Lane B-a11y: A2-01 to A2-06 of docs/reports/wa-a2-a11y-semantics.md.
 * Static DOM behaviour only (jsdom); nothing here was checked in TalkBack.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { LabSettings } from '../src/components/LabSettings';
import { Build } from '../src/screens/Build';
import { Correct } from '../src/screens/Correct';
import { SavedDiagrams } from '../src/screens/SavedDiagrams';
import { Teach } from '../src/screens/Teach';
import { setLang, t } from '../src/i18n';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const scene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Tri',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.5, y: 0.2 },
  ],
  segments: [{ id: 'AB', a: 'A', b: 'B' }],
};

function makeDrivers(canSpeak = true): { drivers: Drivers; speak: ReturnType<typeof vi.fn> } {
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
      setRate: vi.fn(),
      canSpeak,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  } as unknown as Drivers;
  return { drivers, speak };
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
});

async function render(el: Parameters<Root['render']>[0]): Promise<void> {
  await act(async () => {
    root.render(el);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

describe('A2-01 settings Tab trap ignores the collapsed block', () => {
  it('Tab from the last visible control wraps to the first', async () => {
    const { drivers } = makeDrivers();
    await render(createElement(LabSettings, { open: true, onClose: vi.fn(), drivers }));
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const more = container.querySelector<HTMLElement>('#lab-settings-more-content');
    expect(more?.hasAttribute('hidden')).toBe(true);
    expect(more?.querySelector('button, input')).not.toBeNull();

    const visible = Array.from(
      dialog!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
    ).filter((el) => el.closest('[hidden]') === null);
    const first = visible[0]!;
    const last = visible[visible.length - 1]!;
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => {
      last.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });
});

describe('A2-02 picker names do not contradict aria-pressed', () => {
  it('Correct element buttons carry no "Selected" word', async () => {
    const { drivers } = makeDrivers();
    await render(
      createElement(Correct, {
        scene,
        photoUrl: null,
        drivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    const buttons = Array.from(
      container.querySelectorAll<HTMLElement>('.gt-correct__element-btn'),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    for (const b of buttons) {
      expect(b.hasAttribute('aria-pressed')).toBe(true);
      expect((b.getAttribute('aria-label') ?? b.textContent ?? '').toLowerCase()).not.toContain(
        'selected',
      );
    }
  });
});

describe('A2-03 Teach element list', () => {
  it('lists every point and segment as a named button and selects without a pointer', async () => {
    const { drivers } = makeDrivers();
    await render(createElement(Teach, { initialScene: scene, drivers, onBack: vi.fn() }));
    const list = container.querySelector('[data-testid="teach-element-list"]');
    expect(list).not.toBeNull();
    const buttons = Array.from(list!.querySelectorAll<HTMLButtonElement>('button'));
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect((b.textContent ?? '').trim().length).toBeGreaterThan(0);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false']);
    await act(async () => {
      buttons[1]!.click();
    });
    const after = Array.from(
      container
        .querySelector('[data-testid="teach-element-list"]')!
        .querySelectorAll<HTMLButtonElement>('button'),
    );
    expect(after[1]!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('A2-04 Build status is not a second announcement', () => {
  it('has no live region while speech is available', async () => {
    const { drivers } = makeDrivers(true);
    await render(createElement(Build, { drivers, onBack: vi.fn() }));
    const status = container.querySelector('.gt-build__status')!;
    expect(status.getAttribute('aria-live')).toBeNull();
  });

  it('is a polite live region when the app cannot speak', async () => {
    const { drivers } = makeDrivers(false);
    await render(createElement(Build, { drivers, onBack: vi.fn() }));
    const status = container.querySelector('.gt-build__status')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});

describe('A2-05 Saved diagrams keep focus through Delete, Confirm, Cancel', () => {
  async function mountWithEntry(): Promise<void> {
    const { drivers } = makeDrivers();
    const entry: SavedDiagram = {
      id: 'd1',
      createdAt: 1,
      title: 'Tri',
      thumbnailDataUrl: '',
      scene,
      pinned: false,
    };
    await drivers.diagramStore.put(entry);
    await render(
      createElement(SavedDiagrams, {
        diagramStore: drivers.diagramStore,
        speech: drivers.speech,
        onOpen: vi.fn(),
        onBack: vi.fn(),
      }),
    );
  }

  it('Delete moves focus to Confirm; Cancel returns it to Delete', async () => {
    await mountWithEntry();
    const del = container.querySelector<HTMLButtonElement>('[data-saved-action="delete"]')!;
    del.focus();
    await act(async () => {
      del.click();
    });
    const confirm = container.querySelector<HTMLButtonElement>('[data-saved-action="confirm"]')!;
    expect(confirm).not.toBeNull();
    expect(document.activeElement).toBe(confirm);
    const cancel = container.querySelector<HTMLButtonElement>('.gt-saved__btn--cancel')!;
    await act(async () => {
      cancel.click();
    });
    const del2 = container.querySelector<HTMLButtonElement>('[data-saved-action="delete"]')!;
    expect(document.activeElement).toBe(del2);
  });
});

describe('A2-06 Build landmark and focus', () => {
  it('form is a main landmark, heading is focused and the title is spoken once', async () => {
    const { drivers, speak } = makeDrivers();
    await render(createElement(Build, { drivers, onBack: vi.fn() }));
    const main = container.querySelector('[data-testid="build-root"] > main');
    expect(main).not.toBeNull();
    const h1 = container.querySelector('h1')!;
    expect(h1.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(h1);
    const titleCalls = speak.mock.calls.filter((c) => String(c[0]).startsWith(t('build.title')));
    expect(titleCalls).toHaveLength(1);
  });

  it('returning from Feel focuses the Feel button', async () => {
    const { drivers } = makeDrivers();
    let backToForm: (() => void) | null = null;
    await render(
      createElement(Build, {
        drivers,
        onBack: vi.fn(),
        onRegisterBackToForm: (fn: () => void) => {
          backToForm = fn;
        },
      }),
    );
    const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const pin = buttons().find((b) => b.className.includes('--primary'))!;
    await act(async () => {
      pin.click();
    });
    const feel = buttons().find((b) => b.getAttribute('aria-label') === t('build.feel'))!;
    await act(async () => {
      feel.click();
    });
    expect(container.querySelector('[data-testid="build-root"]')!.getAttribute('data-mode')).toBe(
      'feel',
    );
    await act(async () => {
      backToForm?.();
    });
    const feel2 = buttons().find((b) => b.getAttribute('aria-label') === t('build.feel'))!;
    expect(document.activeElement).toBe(feel2);
  });
});