/**
 * Drivers entry point: the only module screens import browser capabilities from.
 *
 * `runEffects` is pure dispatch: it turns the haptic engine's plain-data
 * effects into driver calls. All decisions live in the engine (core/).
 */

import type { Effect } from '../core/hapticEngine';
import { WebAudioDriver, type AudioDriver } from './audio';
import { WebHapticDriver, type HapticDriver } from './haptics';
import { WebSpeechDriver, type SpeechDriver } from './speech';

export type { AudioDriver, EarconKind } from './audio';
export { getEarconSteps, WebAudioDriver } from './audio';
export type { HapticDriver } from './haptics';
export { WebHapticDriver } from './haptics';
export {
  ListenError,
  type ListenFailure,
  type SpeechDriver,
  type SpeechRateSetting,
  BASE_SPEECH_RATE,
  SPEECH_RATE_MULTIPLIERS,
  DEFAULT_SPEECH_LANG,
  findVoiceForLang,
  WebSpeechDriver,
} from './speech';
export { safeGet, safeSet, safeRemove } from './storage';
export {
  type AudioElementLike,
  type AudioElementFactory,
  type AudioHostDriver,
  createAudioElement,
  defaultAudioHost,
  isAudioSupported,
} from './audioElement';

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
