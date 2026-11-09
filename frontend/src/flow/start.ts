/**
 * Start-screen behaviour, kept out of the component so it can be unit tested.
 *
 * Everything here must run inside the tap's click handler: browsers only
 * allow audio, vibration and speech to start after a user gesture.
 */
import type { Drivers } from '../drivers';
import { getLang, LANG_BCP47, t } from '../i18n';

/** Short confirmation pulse on the first tap (Requirement 1.2). */
export const CONFIRM_VIBRATION_MS = 50;

/** What the user hears when the Capture screen opens. */
export function capturePrompt(vibrationSupported: boolean): string {
  return vibrationSupported
    ? t('capture.prompt')
    : `${t('start.noVibration')} ${t('capture.prompt')}`;
}

/** Speak the opening line when the app loads (Chrome may block it until a tap). */
export function speakIntro(drivers: Drivers, lang: string = LANG_BCP47[getLang()]): void {
  drivers.speech.speak(t('start.intro'), lang);
}

/**
 * The tap: unlock audio and speech, play start earcon, buzz once, and speak the next prompt.
 * Speaking here (not in the next screen) keeps the first utterance inside the
 * gesture and gives one clean utterance per transition. Never blocks progress,
 * even when vibration is unsupported (Requirement 1.3).
 */
export function handleStartTap(drivers: Drivers, lang: string = LANG_BCP47[getLang()]): void {
  drivers.audio.unlock();
  drivers.audio.playEarcon?.('start');
  drivers.haptics.vibrate(CONFIRM_VIBRATION_MS);
  drivers.speech.speak(capturePrompt(drivers.haptics.supported), lang);
}
