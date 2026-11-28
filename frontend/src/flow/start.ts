/**
 * Start-screen behaviour, kept out of the component so it can be unit tested.
 *
 * Everything here must run inside the tap's click handler: browsers only
 * allow audio, vibration and speech to start after a user gesture.
 */
import type { Drivers } from '../drivers';
import { safeGet, safeRemove, safeSet } from '../drivers/storage';
import { getLang, LANG_BCP47, t } from '../i18n';

/** Short confirmation pulse on the first tap (Requirement 1.2). */
export const CONFIRM_VIBRATION_MS = 50;

/** Storage key to track whether the language offer has been spoken (once per install). */
export const STORAGE_KEY_LANG_OFFER = 'gt_lang_offer_spoken';

export function hasSpokenLangOffer(): boolean {
  return safeGet(STORAGE_KEY_LANG_OFFER) === 'true';
}

export function setSpokenLangOffer(spoken: boolean = true): void {
  if (spoken) {
    safeSet(STORAGE_KEY_LANG_OFFER, 'true');
  } else {
    safeRemove(STORAGE_KEY_LANG_OFFER);
  }
}

/**
 * After the intro, speak one line once per install naming the other two languages
 * and where to change them (Requirement UX8).
 */
export function speakLangOffer(drivers: Drivers, lang: string = LANG_BCP47[getLang()]): boolean {
  if (hasSpokenLangOffer()) return false;
  // The flag is written only when the offer has been heard to its end (GH-05, Requirement 53.14d).
  // A blocked, cancelled or replaced utterance leaves it unset, so the offer is tried again.
  drivers.speech.speak(t('start.langOffer'), lang, {
    queue: true,
    onEnd: () => setSpokenLangOffer(true),
  });
  return true;
}

/** What the user hears when the Capture screen opens (one host line, Requirement 53.2). */
export function capturePrompt(vibrationSupported: boolean): string {
  return vibrationSupported
    ? t('host.capture.next')
    : `${t('start.noVibration')} ${t('host.capture.next')}`;
}

/**
 * Speak the host greeting when the app loads (Chrome may block it until a tap).
 * One utterance, spoken once per Start opening (Requirement 53.1).
 */
export function speakIntro(
  drivers: Drivers,
  lang: string = LANG_BCP47[getLang()],
  options?: { offerLang?: boolean },
): void {
  drivers.speech.speak(t('host.start.greeting'), lang);
  if (options?.offerLang) {
    speakLangOffer(drivers, lang);
  }
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
