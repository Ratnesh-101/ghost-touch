import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Effect } from '../src/core/hapticEngine';
import { MemoryDiagramStore, runEffects, runProximityEffects, type Drivers } from '../src/drivers';
import type { ProximityEffect } from '../src/core/proximity';
import { Debug } from '../src/screens/Debug';

function fakeDrivers(): { drivers: Drivers; vibrate: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn>; setTone: ReturnType<typeof vi.fn> } {
  const vibrate = vi.fn().mockReturnValue(true);
  const speak = vi.fn();
  const setTone = vi.fn();
  const drivers: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone, beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: { speak, listen: vi.fn(), canSpeak: true, canListen: true },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, vibrate, speak, setTone };
}

describe('runEffects', () => {
  it('dispatches vibrate, speak and tone to the matching drivers', () => {
    const { drivers, vibrate, speak, setTone } = fakeDrivers();
    const effects: Effect[] = [
      { kind: 'vibrate', pattern: [50, 90, 50] },
      { kind: 'speak', text: 'Point B' },
      { kind: 'tone', hz: 640 },
      { kind: 'tone', hz: null },
      { kind: 'vibrate', pattern: 0 },
    ];
    runEffects(effects, drivers, 'hi-IN');
    expect(vibrate.mock.calls).toEqual([[[50, 90, 50]], [0]]);
    expect(speak).toHaveBeenCalledWith('Point B', 'hi-IN');
    expect(setTone.mock.calls).toEqual([[640], [null]]);
  });

  it('runs effects in order', () => {
    const order: string[] = [];
    const { drivers } = fakeDrivers();
    drivers.haptics.vibrate = () => (order.push('vibrate'), true);
    drivers.speech.speak = () => void order.push('speak');
    drivers.audio.setTone = () => void order.push('tone');
    runEffects(
      [
        { kind: 'tone', hz: null },
        { kind: 'vibrate', pattern: 80 },
        { kind: 'speak', text: 'x' },
      ],
      drivers,
    );
    expect(order).toEqual(['tone', 'vibrate', 'speak']);
  });

  it('does nothing for an empty list', () => {
    const { drivers, vibrate, speak, setTone } = fakeDrivers();
    runEffects([], drivers);
    expect(vibrate).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(setTone).not.toHaveBeenCalled();
  });

  it('ignores an unknown effect kind instead of throwing', () => {
    const { drivers } = fakeDrivers();
    const bogus = { kind: 'explode' } as unknown as Effect;
    expect(() => runEffects([bogus], drivers)).not.toThrow();
  });
});

describe('runProximityEffects', () => {
  it('dispatches click effects to drivers.audio.playClick', () => {
    const playClick = vi.fn();
    const drivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), playClick, state: 'running' },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: new MemoryDiagramStore(),
    };

    const effects: ProximityEffect[] = [
      { kind: 'click', hz: 600, pan: -0.5, gain: 0.35 },
      { kind: 'click', hz: 1100, pan: 0.8, gain: 0.55 },
    ];
    runProximityEffects(effects, drivers);

    expect(playClick).toHaveBeenCalledTimes(2);
    expect(playClick).toHaveBeenNthCalledWith(1, 600, -0.5, 0.35);
    expect(playClick).toHaveBeenNthCalledWith(2, 1100, 0.8, 0.55);
  });

  it('safely handles driver without playClick method', () => {
    const drivers: Drivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: new MemoryDiagramStore(),
    };

    expect(() =>
      runProximityEffects([{ kind: 'click', hz: 800, pan: 0, gain: 0.4 }], drivers),
    ).not.toThrow();
  });
});

describe('Debug screen', () => {
  it('renders status and every control with an accessible name', () => {
    const html = renderToStaticMarkup(createElement(Debug));
    expect(html).toContain('Vibration API');
    for (const label of ['Line buzz', 'Corner pattern', 'Stop vibration', 'Tone low', 'Tone high', 'Beep', 'Speak sample', 'Listen']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-live="polite"');
  });
});
