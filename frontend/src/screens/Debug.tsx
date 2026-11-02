/**
 * Debug — hidden `#/debug` page for checking the drivers on a real phone.
 *
 * Shows what the browser supports and lets you fire each haptic / audio /
 * speech output by hand, ported from prototypes/haptics-test.html. It is not
 * linked from anywhere; open the site with `#/debug` appended.
 */
import { useEffect, useState } from 'react';
import { DEFAULT_HAPTICS } from '../core/hapticEngine';
import { AccessibleButton } from '../components/AccessibleButton';
import { createBrowserDrivers, ListenError, type Drivers } from '../drivers';
import { t } from '../i18n';

const TONE_LOW_HZ = 200;
const TONE_HIGH_HZ = 1000;
const BEEP_HZ = 440;
const BEEP_MS = 150;

function yesNo(value: boolean): string {
  return value ? t('debug.yes') : t('debug.no');
}

function formatPattern(pattern: number | number[]): string {
  return Array.isArray(pattern) ? `[${pattern.join(', ')}]` : String(pattern);
}

export function Debug(): JSX.Element {
  const [drivers] = useState<Drivers>(() => createBrowserDrivers());
  const [message, setMessage] = useState<string>(t('debug.ready'));
  const [, setRefresh] = useState(0);

  // Leaving the page must not leave a tone playing or the motor running.
  useEffect(
    () => () => {
      drivers.audio.setTone(null);
      drivers.haptics.stop();
    },
    [drivers],
  );

  // First tap or click anywhere unlocks audio (a screen reader's double-tap
  // arrives as a click, so listen for both).
  const unlock = (): void => {
    drivers.audio.unlock();
    setRefresh((n) => n + 1);
  };

  const buzz = (pattern: number | number[]): void => {
    const ok = drivers.haptics.vibrate(pattern);
    setMessage(`vibrate(${formatPattern(pattern)}) ${t('debug.returned')} ${String(ok)}`);
  };

  const tone = (hz: number | null): void => {
    drivers.audio.setTone(hz);
    setMessage(hz === null ? t('debug.toneOff') : `${t('debug.tone')} ${hz} Hz`);
  };

  const listen = (): void => {
    setMessage(t('debug.listening'));
    drivers.audio.beep(BEEP_HZ, BEEP_MS);
    drivers.speech.listen().then(
      (heard) => setMessage(`${t('debug.heard')} ${heard}`),
      (error: unknown) =>
        setMessage(
          `${t('debug.listenFailed')} ${error instanceof ListenError ? error.reason : 'failed'}`,
        ),
    );
  };

  return (
    <main className="gt-debug" onPointerDownCapture={unlock} onClickCapture={unlock}>
      <h1 className="gt-debug__title">{t('debug.title')}</h1>
      <dl className="gt-debug__status">
        <dt>{t('debug.vibration')}</dt>
        <dd>{drivers.haptics.supported ? t('debug.supported') : t('debug.notSupported')}</dd>
        <dt>{t('debug.audio')}</dt>
        <dd>{drivers.audio.state}</dd>
        <dt>{t('debug.speechOut')}</dt>
        <dd>{yesNo(drivers.speech.canSpeak)}</dd>
        <dt>{t('debug.speechIn')}</dt>
        <dd>{yesNo(drivers.speech.canListen)}</dd>
      </dl>
      <p className="gt-debug__message" role="status" aria-live="polite">
        {message}
      </p>
      <div className="gt-debug__row">
        <AccessibleButton onClick={() => buzz(DEFAULT_HAPTICS.lineMs)}>
          {t('debug.btnLine')}
        </AccessibleButton>
        <AccessibleButton onClick={() => buzz(DEFAULT_HAPTICS.cornerPattern)}>
          {t('debug.btnCorner')}
        </AccessibleButton>
        <AccessibleButton
          onClick={() => {
            drivers.haptics.stop();
            setMessage(t('debug.stopped'));
          }}
        >
          {t('debug.btnStop')}
        </AccessibleButton>
      </div>
      <div className="gt-debug__row">
        <AccessibleButton onClick={() => tone(TONE_LOW_HZ)}>{t('debug.btnToneLow')}</AccessibleButton>
        <AccessibleButton onClick={() => tone(TONE_HIGH_HZ)}>
          {t('debug.btnToneHigh')}
        </AccessibleButton>
        <AccessibleButton onClick={() => tone(null)}>{t('debug.btnToneOff')}</AccessibleButton>
        <AccessibleButton onClick={() => drivers.audio.beep(BEEP_HZ, BEEP_MS)}>
          {t('debug.btnBeep')}
        </AccessibleButton>
      </div>
      <div className="gt-debug__row">
        <AccessibleButton onClick={() => drivers.speech.speak(t('debug.sample'))}>
          {t('debug.btnSpeak')}
        </AccessibleButton>
        <AccessibleButton onClick={listen}>{t('debug.btnListen')}</AccessibleButton>
      </div>
    </main>
  );
}
