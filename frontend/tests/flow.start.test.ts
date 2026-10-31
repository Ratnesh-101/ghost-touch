import { describe, expect, it, vi } from 'vitest';
import type { Drivers } from '../src/drivers';
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
    audio: { unlock: () => void calls.push('unlock'), setTone: vi.fn(), beep: vi.fn(), state: 'running' },
    speech: {
      speak: (text) => void (calls.push('speak'), spoken.push(text)),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
  };
  return { drivers, calls, spoken };
}

describe('Start flow', () => {
  it('speaks "Ghost Touch. Tap anywhere to begin." when the app loads', () => {
    const { drivers, spoken } = fakeDrivers(true);
    speakIntro(drivers);
    expect(spoken).toEqual(['Ghost Touch. Tap anywhere to begin.']);
    expect(t('start.intro')).toBe('Ghost Touch. Tap anywhere to begin.');
  });

  it('on tap: unlocks audio, buzzes once, then speaks the next prompt, in that order', () => {
    const { drivers, calls, spoken } = fakeDrivers(true);
    handleStartTap(drivers);
    expect(calls).toEqual(['unlock', `vibrate:${CONFIRM_VIBRATION_MS}`, 'speak']);
    expect(CONFIRM_VIBRATION_MS).toBe(50);
    expect(spoken).toEqual([t('capture.prompt')]);
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
    expect(spoken[0]).toContain(t('capture.prompt'));
  });

  it('capturePrompt only adds the warning when vibration is unsupported', () => {
    expect(capturePrompt(true)).toBe(t('capture.prompt'));
    expect(capturePrompt(false)).not.toBe(t('capture.prompt'));
  });
});
