/**
 * RateSelector — speech-rate controls (slow / normal / fast).
 *
 * 0.8 / 1.0 / 1.25 x base speech rate.
 * Persisted in localStorage and changeable with spoken confirmation.
 * Native accessible labels announce the rate cleanly on focus without TTS collision.
 * Selection produces exactly ONE spoken confirmation (A11Y-02).
 * Touch targets >= 48x48 CSS px.
 */

import { useState, type JSX } from 'react';
import { AccessibleButton } from './AccessibleButton';
import type { Drivers, SpeechRateSetting } from '../drivers';
import { getLang, LANG_BCP47, t } from '../i18n';

interface RateSelectorProps {
  drivers: Drivers;
  className?: string;
}

const RATES: readonly { id: SpeechRateSetting; labelKey: string; multiplierText: string }[] = [
  { id: 'slow', labelKey: 'rate.slow', multiplierText: '0.8x' },
  { id: 'normal', labelKey: 'rate.normal', multiplierText: '1.0x' },
  { id: 'fast', labelKey: 'rate.fast', multiplierText: '1.25x' },
];

export function RateSelector({ drivers, className = '' }: RateSelectorProps): JSX.Element {
  const [currentRate, setCurrentRate] = useState<SpeechRateSetting>(() =>
    drivers.speech.getRate ? drivers.speech.getRate() : 'normal',
  );

  const handleSelect = (rate: SpeechRateSetting): void => {
    setCurrentRate(rate);
    drivers.speech.setRate?.(rate);

    let confirmKey = 'rate.setNormal';
    if (rate === 'slow') confirmKey = 'rate.setSlow';
    else if (rate === 'fast') confirmKey = 'rate.setFast';

    const lang = LANG_BCP47[getLang()];
    drivers.speech.speak(t(confirmKey), lang);
  };

  return (
    <div
      className={`gt-rate-selector ${className}`}
      role="group"
      aria-label={t('rate.label')}
    >
      {RATES.map(({ id, labelKey, multiplierText }) => {
        const isSelected = currentRate === id;
        return (
          <AccessibleButton
            key={id}
            type="button"
            className={`gt-control gt-rate-selector__btn ${
              isSelected ? 'gt-rate-selector__btn--active' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={`${t(labelKey)} (${multiplierText})`}
            onClick={() => handleSelect(id)}
          >
            <span className="gt-rate-selector__label">{t(labelKey)}</span>
            <span className="gt-rate-selector__multiplier">{multiplierText}</span>
          </AccessibleButton>
        );
      })}
    </div>
  );
}
