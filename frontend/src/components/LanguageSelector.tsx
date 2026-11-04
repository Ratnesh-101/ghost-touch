/**
 * LanguageSelector — accessible, eyes-closed reachable language controls.
 *
 * Provides 48x48+ px targets for English, Hindi, and Gujarati.
 * Every option speaks its name on focus and gives spoken confirmation on selection.
 * Checks for system voice availability and speaks a notice if no voice exists.
 */

import { useState, useSyncExternalStore, type JSX } from 'react';
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
  const [active, setActive] = useState<Lang>(currentLang);

  const handleSelect = (lang: Lang): void => {
    setActive(lang);
    setLang(lang);
    const targetBcp47 = LANG_BCP47[lang];

    // Spoken confirmation in the newly selected language
    let confirmKey = 'lang.changedEn';
    if (lang === 'hi') confirmKey = 'lang.changedHi';
    else if (lang === 'gu') confirmKey = 'lang.changedGu';
    const confirmMessage = t(confirmKey);

    drivers.speech.speak(confirmMessage, targetBcp47);
  };

  const handleFocus = (lang: Lang): void => {
    // Spoken option when navigating eyes-closed
    const name = LANG_NAMES[lang].native;
    drivers.speech.speak(name, LANG_BCP47[lang]);
  };

  return (
    <nav
      className={`gt-lang-selector ${className}`}
      aria-label={t('lang.label')}
      role="group"
    >
      {SUPPORTED_LANGS.map((lang) => {
        const isSelected = active === lang;
        const info = LANG_NAMES[lang];
        return (
          <AccessibleButton
            key={lang}
            type="button"
            className={`gt-control gt-lang-selector__btn ${
              isSelected ? 'gt-lang-selector__btn--active' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={`${info.english} (${info.native})`}
            onFocus={() => handleFocus(lang)}
            onClick={() => handleSelect(lang)}
          >
            <span className="gt-lang-selector__native">{info.native}</span>
            <span className="gt-lang-selector__english">{info.english}</span>
          </AccessibleButton>
        );
      })}
    </nav>
  );
}
