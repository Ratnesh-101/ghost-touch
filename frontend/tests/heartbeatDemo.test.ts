// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HAPTICS } from '../src/core/hapticEngine';
import { createBrowserDrivers } from '../src/drivers';
import type { VibrateHost } from '../src/drivers/haptics';
import {
  DEMO_PERIODS_MS,
  DEMO_REPEAT_MAX_MS,
  HEARTBEAT_CANDIDATES,
  patternDurationMs,
} from '../src/flow/heartbeatDemo';
import { setLang, t } from '../src/i18n';
import { Debug } from '../src/screens/Debug';

// Ensure PointerEvent is available in jsdom environment
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  } as unknown as typeof globalThis.PointerEvent;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

describe('heartbeatDemo pure helpers', () => {
  it('HEARTBEAT_CANDIDATES matches the specification exactly', () => {
    expect(HEARTBEAT_CANDIDATES).toHaveLength(6);
    expect(HEARTBEAT_CANDIDATES[0]).toEqual({
      id: 'H1',
      nameKey: 'debug.hbH1',
      pattern: [50, 90, 50],
      periodMs: 900,
    });
    expect(HEARTBEAT_CANDIDATES[1]).toEqual({
      id: 'H2',
      nameKey: 'debug.hbH2',
      pattern: [40, 60, 40],
      periodMs: 800,
    });
    expect(HEARTBEAT_CANDIDATES[2]).toEqual({
      id: 'H3',
      nameKey: 'debug.hbH3',
      pattern: [30, 70, 60],
      periodMs: 900,
    });
    expect(HEARTBEAT_CANDIDATES[3]).toEqual({
      id: 'H4',
      nameKey: 'debug.hbH4',
      pattern: [60, 80, 40],
      periodMs: 1000,
    });
    expect(HEARTBEAT_CANDIDATES[4]).toEqual({
      id: 'H5',
      nameKey: 'debug.hbH5',
      pattern: [40, 120, 80],
      periodMs: 1000,
    });
    expect(HEARTBEAT_CANDIDATES[5]).toEqual({
      id: 'H6',
      nameKey: 'debug.hbH6',
      pattern: [70, 110, 70],
      periodMs: 1100,
    });
  });

  it('DEMO_PERIODS_MS and DEMO_REPEAT_MAX_MS are correctly defined', () => {
    expect(DEMO_PERIODS_MS).toEqual([700, 900, 1100]);
    expect(DEMO_REPEAT_MAX_MS).toBe(10000);
  });

  it('patternDurationMs correctly sums pattern entries', () => {
    expect(patternDurationMs([50, 90, 50])).toBe(190);
    expect(patternDurationMs([40, 60, 40])).toBe(140);
    expect(patternDurationMs([30, 70, 60])).toBe(160);
    expect(patternDurationMs([])).toBe(0);
  });
});

describe('Debug heartbeat candidates test bench', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    setLang('en');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('"Repeat" for H1 at 900 ms calls vibrate([50,90,50]) at 0, 900, 1800 and stops by 10 s', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const patternCalls = () =>
      vibrate.mock.calls.filter((args) => Array.isArray(args[0]) && args[0].join(',') === '50,90,50');
    const repeatH1 = container.querySelector('[data-testid="btn-repeat-H1"]') as HTMLButtonElement;
    expect(repeatH1).not.toBeNull();

    await act(async () => {
      repeatH1.click();
    });

    // Call at t = 0
    expect(patternCalls()).toHaveLength(1);
    expect(vibrate).toHaveBeenLastCalledWith([50, 90, 50]);

    // Call at t = 900 ms
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(patternCalls()).toHaveLength(2);
    expect(vibrate).toHaveBeenLastCalledWith([50, 90, 50]);

    // Call at t = 1800 ms
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(patternCalls()).toHaveLength(3);
    expect(vibrate).toHaveBeenLastCalledWith([50, 90, 50]);

    // Advance up to 10,000 ms (DEMO_REPEAT_MAX_MS)
    await act(async () => {
      vi.advanceTimersByTime(10000 - 1800);
    });

    const callsCountAt10s = vibrate.mock.calls.filter(
      (args) => Array.isArray(args[0]) && args[0].join(',') === '50,90,50',
    ).length;

    // Advance by another 5000 ms to confirm no more calls to [50, 90, 50]
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    const callsCountAfter10s = vibrate.mock.calls.filter(
      (args) => Array.isArray(args[0]) && args[0].join(',') === '50,90,50',
    ).length;

    expect(callsCountAfter10s).toBe(callsCountAt10s);
  });

  it('the pad sends the corner pattern on down, a beat one period later, and vibrate(0) on up with no call after it', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const pad = container.querySelector('[data-testid="resting-pad"]') as HTMLButtonElement;
    expect(pad).not.toBeNull();

    // pointerdown on pad
    await act(async () => {
      pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
    });

    // Sends corner pattern on down
    expect(vibrate).toHaveBeenLastCalledWith(DEFAULT_HAPTICS.cornerPattern);
    const countAfterDown = vibrate.mock.calls.length;

    // Advance by 900 ms (default H1 period) -> a beat one period later
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(vibrate.mock.calls.length).toBe(countAfterDown + 1);
    expect(vibrate).toHaveBeenLastCalledWith([50, 90, 50]);

    // pointerup
    await act(async () => {
      pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    });

    // Sends vibrate(0) on up
    expect(vibrate).toHaveBeenLastCalledWith(0);
    const countAfterUp = vibrate.mock.calls.length;

    // Advance by 5000 ms -> no call after it
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(vibrate.mock.calls.length).toBe(countAfterUp);
  });

  it('starting a second demo stops the first', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const repeatH1 = container.querySelector('[data-testid="btn-repeat-H1"]') as HTMLButtonElement;
    const repeatH2 = container.querySelector('[data-testid="btn-repeat-H2"]') as HTMLButtonElement;

    // Start Demo 1: Repeat H1 ([50, 90, 50])
    await act(async () => {
      repeatH1.click();
    });
    expect(vibrate).toHaveBeenLastCalledWith([50, 90, 50]);

    // Start Demo 2: Repeat H2 ([40, 60, 40])
    await act(async () => {
      repeatH2.click();
    });
    expect(vibrate).toHaveBeenLastCalledWith([40, 60, 40]);

    vibrate.mockClear();

    // Advance by 800 ms (H2 period)
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    // Demo 2 fires [40, 60, 40], and demo 1 ([50, 90, 50]) does NOT fire
    expect(vibrate).toHaveBeenCalledWith([40, 60, 40]);
    expect(vibrate).not.toHaveBeenCalledWith([50, 90, 50]);
  });

  it('unmount leaves no timer', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const repeatH1 = container.querySelector('[data-testid="btn-repeat-H1"]') as HTMLButtonElement;
    await act(async () => {
      repeatH1.click();
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Unmount
    await act(async () => {
      root.unmount();
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('every new key exists and is non-blank in en, hi and gu', () => {
    const NEW_KEYS = [
      'debug.hbTitle',
      'debug.hbH1',
      'debug.hbH2',
      'debug.hbH3',
      'debug.hbH4',
      'debug.hbH5',
      'debug.hbH6',
      'debug.btnOnce',
      'debug.btnRepeat',
      'debug.hbPeriod',
      'debug.btnLine2s',
      'debug.btnLineThenCorner',
      'debug.restingPad',
      'debug.restingPadHint',
    ];

    for (const lang of ['en', 'hi', 'gu'] as const) {
      setLang(lang);
      for (const key of NEW_KEYS) {
        const val = t(key);
        expect(val, `Missing or blank translation for key "${key}" in "${lang}"`).toBeTruthy();
        expect(val).not.toBe(key);
        expect(val.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('"Line buzz 2 s" vibrates lineMs every retriggerMs for 2 s then vibrate(0)', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    // Find the Line buzz 2 s button
    const buttons = Array.from(container.querySelectorAll('button'));
    const lineBuzz2sBtn = buttons.find((b) => b.textContent?.includes(t('debug.btnLine2s')));
    expect(lineBuzz2sBtn).toBeDefined();

    await act(async () => {
      lineBuzz2sBtn?.click();
    });

    // At t = 0: vibrates lineMs
    expect(vibrate).toHaveBeenLastCalledWith(DEFAULT_HAPTICS.lineMs);

    // Advance by retriggerMs
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_HAPTICS.retriggerMs);
    });
    expect(vibrate).toHaveBeenLastCalledWith(DEFAULT_HAPTICS.lineMs);

    // Advance to 2000 ms
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });

  it('"Line, then corner" buzzes line for 1 s, then corner, then starts Repeat for selected candidate', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const lineThenCornerBtn = buttons.find((b) =>
      b.textContent?.includes(t('debug.btnLineThenCorner')),
    );
    expect(lineThenCornerBtn).toBeDefined();

    await act(async () => {
      lineThenCornerBtn?.click();
    });

    // Line buzz starts
    expect(vibrate).toHaveBeenLastCalledWith(DEFAULT_HAPTICS.lineMs);

    // Advance to 1000 ms -> corner pattern fires
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(vibrate).toHaveBeenLastCalledWith(DEFAULT_HAPTICS.cornerPattern);

    // Advance by selected period (900 ms for H1) -> Repeat starts
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(vibrate).toHaveBeenLastCalledWith([50, 90, 50]);
  });

  it('Period selector buttons have aria-pressed matching the effective period', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const periodBtns = Array.from(
      container.querySelectorAll('.gt-debug__period-btn'),
    ) as HTMLButtonElement[];
    expect(periodBtns).toHaveLength(3);

    // Default for H1 is 900 ms
    const btn700 = periodBtns.find((b) => b.textContent?.includes('700'));
    const btn900 = periodBtns.find((b) => b.textContent?.includes('900'));
    const btn1100 = periodBtns.find((b) => b.textContent?.includes('1100'));

    expect(btn700?.getAttribute('aria-pressed')).toBe('false');
    expect(btn900?.getAttribute('aria-pressed')).toBe('true');
    expect(btn1100?.getAttribute('aria-pressed')).toBe('false');

    // Click 700 ms
    await act(async () => {
      btn700?.click();
    });

    expect(btn700?.getAttribute('aria-pressed')).toBe('true');
    expect(btn900?.getAttribute('aria-pressed')).toBe('false');
    expect(btn1100?.getAttribute('aria-pressed')).toBe('false');
  });

  it('existing Stop button clears all timers and stops haptics', async () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const host: VibrateHost = { vibrate };
    const drivers = createBrowserDrivers(undefined, host);

    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const repeatH1 = container.querySelector('[data-testid="btn-repeat-H1"]') as HTMLButtonElement;
    await act(async () => {
      repeatH1.click();
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    const buttons = Array.from(container.querySelectorAll('button'));
    const stopBtn = buttons.find((b) => b.textContent?.includes(t('debug.btnStop')));
    expect(stopBtn).toBeDefined();

    await act(async () => {
      stopBtn?.click();
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });

  it('resting pad has at least 160x160 px dimensions and touch-action none', async () => {
    const drivers = createBrowserDrivers();
    await act(async () => {
      root.render(createElement(Debug, { drivers }));
    });

    const pad = container.querySelector('[data-testid="resting-pad"]') as HTMLButtonElement;
    expect(pad).not.toBeNull();
    expect(pad.style.minWidth).toBe('160px');
    expect(pad.style.minHeight).toBe('160px');
    expect(pad.style.touchAction).toBe('none');
  });
});
