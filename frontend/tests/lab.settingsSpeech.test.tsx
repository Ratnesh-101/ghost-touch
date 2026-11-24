/**
 * @vitest-environment jsdom
 *
 * LabSettings Speech Tests (Lane hi18)
 *
 * Verifies speech announcements when LabSettings opens and closes:
 * - Opening speaks lab.settings.opened ("Lab settings opened") once with appropriate BCP-47 language tag
 * - Closing by close button speaks lab.settings.closed ("Lab settings closed") once
 * - Closing by scrim click speaks lab.settings.closed once
 * - Closing by Escape key speaks lab.settings.closed once
 * - Closing by open prop becoming false (Android Back / parent state change) speaks lab.settings.closed once
 * - Opening twice speaks opened twice in total
 * - No speech on first render with open false
 * - React StrictMode / re-renders do not double speech
 * - Language change re-render does not speak open or close
 * - Silent close (handleClose(true)) produces no close speech
 * - Multi-language speech (Hindi and Gujarati) uses correct translation and BCP-47 code
 */

import { act, createElement, StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { getLang, LANG_BCP47, setLang, t, type Lang } from '../src/i18n';

function createMockDrivers(): {
  drivers: Drivers;
  speakMock: ReturnType<typeof vi.fn>;
} {
  const speakMock = vi.fn();
  const drivers: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: speakMock,
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, speakMock };
}

interface HarnessState {
  setOpen: (open: boolean) => void;
  getOpen: () => boolean;
}

let harnessControl: HarnessState | null = null;

function Harness({
  initialOpen = false,
  drivers,
  speak,
  onClose,
}: {
  initialOpen?: boolean;
  drivers?: Drivers;
  speak?: (text: string, lang?: string) => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  harnessControl = {
    setOpen,
    getOpen: () => open,
  };
  return (
    <LabSettings
      open={open}
      onClose={() => {
        setOpen(false);
        onClose?.();
      }}
      drivers={drivers}
      speak={speak}
    />
  );
}

describe('LabSettings spoken announcements on open and close (Lane hi18)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let prevLang: Lang;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    prevLang = getLang();
    setLang('en');
    harnessControl = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    setLang(prevLang);
    vi.unstubAllEnvs();
  });

  it('no speech on first render with open false', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: false, drivers }));
    });

    expect(speakMock).not.toHaveBeenCalled();
  });

  it('opening speaks opened once', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: false, drivers }));
    });

    expect(speakMock).not.toHaveBeenCalled();

    act(() => {
      harnessControl!.setOpen(true);
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith(t('lab.settings.opened'), LANG_BCP47['en']);
    expect(speakMock).toHaveBeenCalledWith('Lab settings opened', 'en-IN');
  });

  it('closing by the close button speaks closed once', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: true, drivers }));
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings opened', 'en-IN');
    speakMock.mockClear();

    const closeBtn = container.querySelector<HTMLButtonElement>('.gt-lab-settings__close');
    expect(closeBtn).not.toBeNull();

    act(() => {
      closeBtn!.click();
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith(t('lab.settings.closed'), LANG_BCP47['en']);
    expect(speakMock).toHaveBeenCalledWith('Lab settings closed', 'en-IN');
  });

  it('closing by scrim click speaks closed once', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: true, drivers }));
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    speakMock.mockClear();

    const backdrop = container.querySelector<HTMLDivElement>('.gt-lab-settings__backdrop');
    expect(backdrop).not.toBeNull();

    act(() => {
      backdrop!.click();
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings closed', 'en-IN');
  });

  it('closing by Escape speaks closed once', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: true, drivers }));
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    speakMock.mockClear();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings closed', 'en-IN');
  });

  it('opening twice speaks twice in total', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: false, drivers }));
    });

    expect(speakMock).not.toHaveBeenCalled();

    // First open
    act(() => {
      harnessControl!.setOpen(true);
    });
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenLastCalledWith('Lab settings opened', 'en-IN');

    // First close
    act(() => {
      harnessControl!.setOpen(false);
    });
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock).toHaveBeenLastCalledWith('Lab settings closed', 'en-IN');

    // Second open
    act(() => {
      harnessControl!.setOpen(true);
    });
    expect(speakMock).toHaveBeenCalledTimes(3);
    expect(speakMock).toHaveBeenLastCalledWith('Lab settings opened', 'en-IN');

    const openedCalls = speakMock.mock.calls.filter(([msg]) => msg === 'Lab settings opened');
    expect(openedCalls).toHaveLength(2);
  });

  it('closing by open prop becoming false directly (Android Back / parent update) speaks closed once', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: true, drivers }));
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    speakMock.mockClear();

    // Directly setting open to false simulates external dismiss (e.g. Android Back)
    act(() => {
      harnessControl!.setOpen(false);
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings closed', 'en-IN');
  });

  it('speaks through explicit speak prop when provided', () => {
    const { drivers, speakMock } = createMockDrivers();
    const customSpeak = vi.fn();

    act(() => {
      root.render(
        createElement(Harness, {
          initialOpen: true,
          drivers,
          speak: customSpeak,
        }),
      );
    });

    expect(customSpeak).toHaveBeenCalledWith('Lab settings opened', 'en-IN');
    expect(speakMock).not.toHaveBeenCalled();

    customSpeak.mockClear();

    const closeBtn = container.querySelector<HTMLButtonElement>('.gt-lab-settings__close');
    act(() => {
      closeBtn!.click();
    });

    expect(customSpeak).toHaveBeenCalledWith('Lab settings closed', 'en-IN');
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('does not double speech when wrapped in React StrictMode', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(Harness, { initialOpen: true, drivers }),
        ),
      );
    });

    // In StrictMode, effect re-runs must not double the open speech
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings opened', 'en-IN');

    speakMock.mockClear();

    const closeBtn = container.querySelector<HTMLButtonElement>('.gt-lab-settings__close');
    act(() => {
      closeBtn!.click();
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings closed', 'en-IN');
  });

  it('does not speak when sheet is closed silently (handleClose(true))', () => {
    vi.stubEnv('VITE_FEATURE_SHARE', '1');
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: true, drivers }));
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings opened', 'en-IN');
    speakMock.mockClear();

    // Expand More settings to reach Teacher tools
    const moreToggle = container.querySelector<HTMLButtonElement>('.gt-lab-settings__more-toggle');
    act(() => {
      moreToggle?.click();
    });
    speakMock.mockClear();

    // Toggle teacher on to reveal "Open Teacher Editor" button
    const teacherSwitch = container.querySelector<HTMLButtonElement>(
      '#lab-settings-section-teacher ~ button, section[aria-labelledby="lab-settings-section-teacher"] button[role="switch"]',
    );
    act(() => {
      teacherSwitch?.click();
    });
    speakMock.mockClear();

    // Click "Open Teacher Editor" button which triggers handleClose(true)
    const openTeacherBtn = container.querySelector<HTMLButtonElement>(
      'section[aria-labelledby="lab-settings-section-teacher"] button:not([role="switch"])',
    );
    expect(openTeacherBtn).not.toBeNull();

    act(() => {
      openTeacherBtn!.click();
    });

    // Ensure no close speech was made (silent close)
    const closedCalls = speakMock.mock.calls.filter(([msg]) =>
      msg === 'Lab settings closed' || msg === 'लैब सेटिंग्स बंद' || msg === 'લેબ સેટિંગ્સ બંધ',
    );
    expect(closedCalls).toHaveLength(0);
  });

  it('does not re-speak open or close when re-rendered with open true (e.g. language change)', () => {
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: true, drivers }));
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('Lab settings opened', 'en-IN');
    speakMock.mockClear();

    // Language change re-render
    act(() => {
      setLang('hi');
    });

    // Neither open nor close should be re-announced
    const settingsSpeech = speakMock.mock.calls.filter(([msg]) =>
      msg === 'Lab settings opened' ||
      msg === 'Lab settings closed' ||
      msg === 'लैब सेटिंग्स खुली' ||
      msg === 'लैब सेटिंग्स बंद',
    );
    expect(settingsSpeech).toHaveLength(0);
  });

  it('speaks in Hindi with hi-IN language code and localized strings', () => {
    setLang('hi');
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: false, drivers }));
    });

    expect(speakMock).not.toHaveBeenCalled();

    act(() => {
      harnessControl!.setOpen(true);
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('लैब सेटिंग्स खुली', 'hi-IN');
    speakMock.mockClear();

    const closeBtn = container.querySelector<HTMLButtonElement>('.gt-lab-settings__close');
    act(() => {
      closeBtn!.click();
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('लैब सेटिंग्स बंद', 'hi-IN');
  });

  it('speaks in Gujarati with gu-IN language code and localized strings', () => {
    setLang('gu');
    const { drivers, speakMock } = createMockDrivers();

    act(() => {
      root.render(createElement(Harness, { initialOpen: false, drivers }));
    });

    expect(speakMock).not.toHaveBeenCalled();

    act(() => {
      harnessControl!.setOpen(true);
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('લેબ સેટિંગ્સ ખુલી', 'gu-IN');
    speakMock.mockClear();

    const closeBtn = container.querySelector<HTMLButtonElement>('.gt-lab-settings__close');
    act(() => {
      closeBtn!.click();
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith('લેબ સેટિંગ્સ બંધ', 'gu-IN');
  });
});
