/**
 * Start — one full-screen button. Tap (or screen-reader double-tap) anywhere.
 *
 * It listens for `click`, not `pointerdown`: TalkBack's double-tap and
 * keyboard activation both produce a click, while a screen reader may swallow
 * the raw pointer events. The click handler also satisfies the browser's
 * user-gesture rule for audio, speech and vibration (Requirement 1.2).
 */
import { useEffect, useRef } from 'react';
import type { Drivers } from '../drivers';
import { handleStartTap, speakIntro } from '../flow/start';
import { t } from '../i18n';

interface StartProps {
  drivers: Drivers;
  onBegin: () => void;
}

export function Start({ drivers, onBegin }: StartProps): JSX.Element {
  const surface = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Chrome may refuse to speak before the first tap; the tap speaks again.
    speakIntro(drivers);
    surface.current?.focus();
  }, [drivers]);

  const begin = (): void => {
    handleStartTap(drivers);
    onBegin();
  };

  return (
    <button
      ref={surface}
      type="button"
      className="gt-start-surface"
      aria-label={t('start.intro')}
      onClick={begin}
    >
      <span className="gt-start__hero" aria-hidden="true">
        {/* Creature emblem: stitched Frankenstein beast with neural pulse and eye sensor */}
        <span className="gt-start__creature-emblem">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="44" stroke="#39ff88" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.4" />
            <path
              d="M30 50 C36 32, 64 32, 70 50 C64 68, 36 68, 30 50 Z"
              stroke="#39ff88"
              strokeWidth="2.5"
              fill="rgba(57, 255, 136, 0.06)"
            />
            {/* Center aperture / iris */}
            <circle cx="50" cy="50" r="8" fill="#39ff88" />
            <circle cx="50" cy="50" r="16" stroke="#39ff88" strokeWidth="1.5" opacity="0.6" />
            {/* Theremin sound wave / neural vibration stitch */}
            <path
              d="M16 50 H28 L36 34 L44 66 L52 42 L60 58 L68 46 L76 50 H84"
              stroke="#39ff88"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Frankenstein circuit stitches */}
            <path d="M40 18 V26 M60 18 V26 M50 74 V82" stroke="#39ff88" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          </svg>
        </span>

        <span className="gt-start__title">{t('app.name')}</span>
        <span className="gt-start__tagline">{t('app.tagline')}</span>

        {/* Creature triad: Nerves, Eyes, Voice */}
        <span className="gt-start__triad">
          <span className="gt-start__chip gt-start__chip--green">Nerves · Vibration</span>
          <span className="gt-start__chip">Eyes · Vision AI</span>
          <span className="gt-start__chip">Voice · Synthesizer</span>
        </span>

        {/* Primary action callout badge */}
        <span className="gt-start__action-badge">
          <span className="gt-start__pulse-dot" />
          <span className="gt-start__hint">{t('start.tapToBegin')}</span>
        </span>

        <span className="gt-start__subhint">TalkBack &amp; touch ready</span>
      </span>
    </button>
  );
}
