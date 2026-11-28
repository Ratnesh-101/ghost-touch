import { describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  CONFIRM_VIBRATION_MS,
  capturePrompt,
  handleStartTap,
  speakIntro,
} from '../src/flow/start';
import { t } from '../src/i18n';

function fakeDrivers(vibrationSupported: boolean): { drivers: Drivers; calls: string[]; spoken: string[] } {
  const calls: string[] = [];
  const spoken: string[] = [];
  const drivers: Drivers = {
    haptics: {
      supported: vibrationSupported,
      lastResult: null,
      vibrate: (pattern) => (calls.push(`vibrate:${String(pattern)}`), vibrationSupported),
      stop: vi.fn(),
    },
    audio: { unlock: () => void calls.push('unlock'), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: {
      speak: (text) => void (calls.push('speak'), spoken.push(text)),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  };
  return { drivers, calls, spoken };
}

describe('Start flow', () => {
  it('speaks the Ghost Host greeting once when the app loads (Requirement 53.1)', () => {
    const { drivers, spoken } = fakeDrivers(true);
    speakIntro(drivers);
    expect(spoken).toEqual([t('host.start.greeting')]);
    expect(spoken[0]).toContain('Ghost Host');
    expect(spoken[0]).toMatch(/double-tap/i);
  });

  it('on tap: unlocks audio, buzzes once, then speaks the next prompt, in that order', () => {
    const { drivers, calls, spoken } = fakeDrivers(true);
    handleStartTap(drivers);
    expect(calls).toEqual(['unlock', `vibrate:${CONFIRM_VIBRATION_MS}`, 'speak']);
    expect(CONFIRM_VIBRATION_MS).toBe(50);
    expect(spoken).toEqual([t('host.capture.next')]);
  });

  it('speaks twice overall: once on load and once on the tap', () => {
    const { drivers, spoken } = fakeDrivers(true);
    speakIntro(drivers);
    handleStartTap(drivers);
    expect(spoken).toHaveLength(2);
  });

  it('warns about missing vibration, in the same utterance as the prompt, and still advances', () => {
    const { drivers, spoken } = fakeDrivers(false);
    expect(() => handleStartTap(drivers)).not.toThrow();
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain('Vibration is not supported on this device');
    expect(spoken[0]).toContain('Chrome on Android');
    expect(spoken[0]).toContain('Audio-only mode');
    expect(spoken[0]).toContain(t('host.capture.next'));
  });

  it('capturePrompt only adds the warning when vibration is unsupported', () => {
    expect(capturePrompt(true)).toBe(t('host.capture.next'));
    expect(capturePrompt(false)).not.toBe(t('host.capture.next'));
  });
});
