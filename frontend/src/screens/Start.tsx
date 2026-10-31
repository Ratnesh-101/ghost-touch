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
      <span className="gt-start__title" aria-hidden="true">
        {t('app.name')}
      </span>
      <span className="gt-start__hint" aria-hidden="true">
        {t('start.tapToBegin')}
      </span>
    </button>
  );
}
