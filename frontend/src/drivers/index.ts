/**
 * Drivers entry point: the only module screens import browser capabilities from.
 *
 * `runEffects` is pure dispatch: it turns the haptic engine's plain-data
 * effects into driver calls. All decisions live in the engine (core/).
 */

// TEMP-STUB import: when Kiro's core/hapticEngine.ts exists, change this one line.
import type { Effect } from '../core/hapticEngine';
import { WebAudioDriver, type AudioDriver } from './audio';
import { WebHapticDriver, type HapticDriver } from './haptics';
import { WebSpeechDriver, type SpeechDriver } from './speech';

export type { AudioDriver } from './audio';
export type { HapticDriver } from './haptics';
export { ListenError, type ListenFailure, type SpeechDriver } from './speech';
export { WebAudioDriver } from './audio';
export { WebHapticDriver } from './haptics';
export { WebSpeechDriver } from './speech';

export interface Drivers {
  haptics: HapticDriver;
  audio: AudioDriver;
  speech: SpeechDriver;
}

export function createBrowserDrivers(): Drivers {
  return {
    haptics: new WebHapticDriver(),
    audio: new WebAudioDriver(),
    speech: new WebSpeechDriver(),
  };
}

function assertUnreachable(_effect: never): void {
  // Compile-time exhaustiveness check: adding an Effect kind without handling
  // it here fails `tsc`. At runtime an unknown effect is ignored.
}

export function runEffects(
  effects: readonly Effect[],
  drivers: Drivers,
  lang?: string,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'vibrate':
        drivers.haptics.vibrate(effect.pattern);
        break;
      case 'speak':
        drivers.speech.speak(effect.text, lang);
        break;
      case 'tone':
        drivers.audio.setTone(effect.hz);
        break;
      default:
        assertUnreachable(effect);
    }
  }
}
