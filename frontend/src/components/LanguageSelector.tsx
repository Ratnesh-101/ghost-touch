/**
 * LanguageSelector — accessible, eyes-closed reachable language controls.
 *
 * Provides 48x48+ px targets for English, Hindi, and Gujarati.
 * Native accessible names announce the language cleanly on focus without TTS collision.
 * Selection produces exactly ONE spoken confirmation in the newly selected language.
 */

import { useSyncExternalStore, type JSX } from 'react';
import { AccessibleButton } from './AccessibleButton';
import type { Drivers } from '../drivers';
import {
  getLang,
  LANG_BCP47,
  LANG_NAMES,
  setLang,
  subscribeLang,
  SUPPORTED_LANGS,
  t,
  type Lang,
} from '../i18n';

interface LanguageSelectorProps {
  drivers: Drivers;
  className?: string;
}

export function LanguageSelector({ drivers, className = '' }: LanguageSelectorProps): JSX.Element {
  const currentLang = useSyncExternalStore(subscribeLang, getLang, () => 'en' as Lang);

  const handleSelect = (lang: Lang): void => {
    setLang(lang);
    const targetBcp47 = LANG_BCP47[lang];

    // Spoken confirmation in the newly selected language (exactly ONE utterance, A11Y-02)
    let confirmKey = 'lang.changedEn';
    if (lang === 'hi') confirmKey = 'lang.changedHi';
    else if (lang === 'gu') confirmKey = 'lang.changedGu';
    const confirmMessage = t(confirmKey);

    drivers.speech.speak(confirmMessage, targetBcp47);
  };

  return (
    <div
      className={`gt-lang-selector ${className}`}
      aria-label={t('lang.label')}
      role="group"
    >
      {SUPPORTED_LANGS.map((lang) => {
        const isSelected = currentLang === lang;
        const info = LANG_NAMES[lang];
        return (
          <AccessibleButton
            key={lang}
            type="button"
            className={`gt-control gt-lang-selector__btn ${
              isSelected ? 'gt-lang-selector__btn--active' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={
              info.english === info.native
                ? info.english
                : `${info.english} (${info.native})`
            }
            onClick={() => handleSelect(lang)}
          >
            <span className="gt-lang-selector__native">{info.native}</span>
            <span className="gt-lang-selector__english">{info.english}</span>
          </AccessibleButton>
        );
      })}
    </div>
  );
}
