/**
 * Start — one full-screen button. Tap (or screen-reader double-tap) anywhere.
 *
 * Frankenstein's Laboratory Start Screen:
 * - Brand logo (full variant, decorative wordmark & creature mark).
 * - Friendly stitched Frankenstein phone mascot emblem (nerves, eyes, voice).
 * - Tagline ("Feel diagrams you can't see").
 * - Three organ tiles via OrganTiles: Nerves (vibration), Eyes (vision AI), Voice (speech + theremin).
 * - Huge "Wake the creature" call to action badge with idle pulse dot.
 * - Entire screen remains ONE button with aria-label={t('start.intro')}.
 * - All hero contents are aria-hidden="true" for screen readers.
 * - All visible strings flow through t() with full en, hi, gu translations.
 */
import { useEffect, useRef, type JSX } from 'react';
import { Logo } from '../components/Logo';
import { Mascot } from '../components/Mascot';
import { Seam } from '../components/lab/Seam';
import { OrganTiles, type OrganItem } from '../components/start/OrganTiles';
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

  const organs: OrganItem[] = [
    {
      id: 'nerves',
      title: t('lab.organ.nerves.title'),
      line: t('lab.organ.nerves.line'),
    },
    {
      id: 'eyes',
      title: t('lab.organ.eyes.title'),
      line: t('lab.organ.eyes.line'),
    },
    {
      id: 'voice',
      title: t('lab.organ.voice.title'),
      line: t('lab.organ.voice.line'),
    },
  ];

  return (
    <button
      ref={surface}
      type="button"
      className="gt-start-surface"
      aria-label={t('start.intro')}
      onClick={begin}
    >
      <span className="gt-start__hero" aria-hidden="true">
        {/* Brand logo (full variant, decorative copy) */}
        <Logo variant="full" decorative className="gt-start__logo" />

        {/* Creature emblem: Frankenstein phone mascot with buzzer, eye, and theremin */}
        <span className="gt-start__creature-emblem">
          <Mascot />
        </span>

        {/* Tagline */}
        <span className="gt-start__tagline">{t('app.tagline')}</span>

        {/* Decorative lab suture seam divider */}
        <Seam className="gt-start__seam" />

        {/* Creature triad: three organ tiles */}
        <span className="gt-start__triad">
          <OrganTiles organs={organs} />
        </span>

        {/* Primary action callout badge: huge "Wake the creature" CTA */}
        <span className="gt-start__action-badge">
          <span className="gt-start__pulse-dot" />
          <span className="gt-start__hint gt-start__wake">{t('lab.start.wake')}</span>
        </span>

        {/* Accessible subhint: TalkBack & touch ready */}
        <span className="gt-start__subhint">{t('lab.start.subhint')}</span>
      </span>
    </button>
  );
}
