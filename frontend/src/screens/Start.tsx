/**
 * Start — one full-screen button. Tap (or screen-reader double-tap) anywhere.
 *
 * It listens for `click`, not `pointerdown`: TalkBack's double-tap and
 * keyboard activation both produce a click, while a screen reader may swallow
 * the raw pointer events. The click handler also satisfies the browser's
 * user-gesture rule for audio, speech and vibration (Requirement 1.2).
 */
import { useEffect, useRef, type JSX } from 'react';
import { Mascot } from '../components/Mascot';
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
        {/* Creature emblem: Frankenstein phone mascot with buzzer, eye, and theremin */}
        <span className="gt-start__creature-emblem">
          <Mascot />
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
