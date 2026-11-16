/**
 * Debug — hidden `#/debug` page for checking the drivers on a real phone.
 *
 * Shows what the browser supports and lets you fire each haptic / audio /
 * speech output by hand, ported from prototypes/haptics-test.html. It is not
 * linked from anywhere; open the site with `#/debug` appended.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { DEFAULT_HAPTICS } from '../core/hapticEngine';
import { AccessibleButton } from '../components/AccessibleButton';
import { createBrowserDrivers, ListenError, type Drivers } from '../drivers';
import {
  DEMO_PERIODS_MS,
  DEMO_REPEAT_MAX_MS,
  HEARTBEAT_CANDIDATES,
  type HeartbeatCandidate,
} from '../flow/heartbeatDemo';
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

export interface DebugProps {
  drivers?: Drivers;
}

export function Debug(props: DebugProps): JSX.Element;
export function Debug(): JSX.Element;
export function Debug({ drivers: customDrivers }: DebugProps = {}): JSX.Element {
  const [drivers] = useState<Drivers>(() => customDrivers ?? createBrowserDrivers());
  const [message, setMessage] = useState<string>(t('debug.ready'));
  const [, setRefresh] = useState(0);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('H1');
  const [pickedPeriodMs, setPickedPeriodMs] = useState<number | null>(null);

  const activeIntervalRef = useRef<number | null>(null);
  const activeTimeoutRef = useRef<number | null>(null);
  const padPointerIdRef = useRef<number | null>(null);

  const fallbackCandidate: HeartbeatCandidate =
    HEARTBEAT_CANDIDATES[0] ?? {
      id: 'H1',
      nameKey: 'debug.hbH1',
      pattern: [50, 90, 50],
      periodMs: 900,
    };
  const selectedCandidate: HeartbeatCandidate =
    HEARTBEAT_CANDIDATES.find((c) => c.id === selectedCandidateId) ?? fallbackCandidate;

  const effectivePeriodMs = pickedPeriodMs !== null ? pickedPeriodMs : selectedCandidate.periodMs;

  const clearAllTimers = (): void => {
    if (activeIntervalRef.current !== null) {
      window.clearInterval(activeIntervalRef.current);
      activeIntervalRef.current = null;
    }
    if (activeTimeoutRef.current !== null) {
      window.clearTimeout(activeTimeoutRef.current);
      activeTimeoutRef.current = null;
    }
  };

  const stopAll = (): void => {
    clearAllTimers();
    padPointerIdRef.current = null;
    drivers.haptics.stop();
  };

  // Leaving the page, window blur, or document hidden must stop vibration and clear all timers.
  useEffect(() => {
    const onBlur = (): void => {
      stopAll();
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        stopAll();
      }
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopAll();
      drivers.audio.setTone(null);
    };
  }, [drivers]);

  // First tap or click anywhere unlocks audio (a screen reader's double-tap
  // arrives as a click, so listen for both).
  const unlock = (): void => {
    drivers.audio.unlock();
    setRefresh((n) => n + 1);
  };

  const buzz = (pattern: number | number[]): boolean => {
    const ok = drivers.haptics.vibrate(pattern);
    setMessage(`vibrate(${formatPattern(pattern)}) ${t('debug.returned')} ${String(ok)}`);
    return ok;
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

  const startRepeat = (candidate: HeartbeatCandidate, period: number): void => {
    stopAll();
    setSelectedCandidateId(candidate.id);

    // Initial beat
    buzz(candidate.pattern);

    // Repeat beat
    const intervalId = window.setInterval(() => {
      buzz(candidate.pattern);
    }, period);
    activeIntervalRef.current = intervalId;

    // Cap at DEMO_REPEAT_MAX_MS
    const timeoutId = window.setTimeout(() => {
      clearAllTimers();
      drivers.haptics.stop();
      setMessage(`vibrate(0) ${t('debug.returned')} ${String(drivers.haptics.lastResult ?? true)}`);
    }, DEMO_REPEAT_MAX_MS);
    activeTimeoutRef.current = timeoutId;
  };

  const handleOnce = (candidate: HeartbeatCandidate): void => {
    stopAll();
    setSelectedCandidateId(candidate.id);
    buzz(candidate.pattern);
  };

  const handleRepeat = (candidate: HeartbeatCandidate): void => {
    const period = pickedPeriodMs !== null ? pickedPeriodMs : candidate.periodMs;
    startRepeat(candidate, period);
  };

  const startLineBuzz2s = (): void => {
    stopAll();
    buzz(DEFAULT_HAPTICS.lineMs);

    const intervalId = window.setInterval(() => {
      buzz(DEFAULT_HAPTICS.lineMs);
    }, DEFAULT_HAPTICS.retriggerMs);
    activeIntervalRef.current = intervalId;

    const timeoutId = window.setTimeout(() => {
      clearAllTimers();
      buzz(0);
    }, 2000);
    activeTimeoutRef.current = timeoutId;
  };

  const startLineThenCorner = (): void => {
    stopAll();
    const candidate = selectedCandidate;
    const period = effectivePeriodMs;

    buzz(DEFAULT_HAPTICS.lineMs);
    const intervalId = window.setInterval(() => {
      buzz(DEFAULT_HAPTICS.lineMs);
    }, DEFAULT_HAPTICS.retriggerMs);
    activeIntervalRef.current = intervalId;

    const timeoutId = window.setTimeout(() => {
      clearAllTimers();
      buzz(DEFAULT_HAPTICS.cornerPattern);

      const repeatTimeoutId = window.setTimeout(() => {
        startRepeat(candidate, period);
      }, period);
      activeTimeoutRef.current = repeatTimeoutId;
    }, 1000);
    activeTimeoutRef.current = timeoutId;
  };

  const handlePadPointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    stopAll();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if unsupported in test environment
    }
    padPointerIdRef.current = e.pointerId;

    buzz(DEFAULT_HAPTICS.cornerPattern);

    const candidate = selectedCandidate;
    const period = effectivePeriodMs;

    const timeoutId = window.setTimeout(() => {
      buzz(candidate.pattern);
      const intervalId = window.setInterval(() => {
        buzz(candidate.pattern);
      }, period);
      activeIntervalRef.current = intervalId;
    }, period);
    activeTimeoutRef.current = timeoutId;
  };

  const handlePadPointerUpOrCancel = (e: React.PointerEvent<HTMLButtonElement>): void => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    padPointerIdRef.current = null;
    clearAllTimers();
    drivers.haptics.stop();
    setMessage(`vibrate(0) ${t('debug.returned')} ${String(drivers.haptics.lastResult ?? true)}`);
  };

  const handlePadPointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (padPointerIdRef.current === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!isInside) {
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore
        }
        padPointerIdRef.current = null;
        clearAllTimers();
        drivers.haptics.stop();
        setMessage(
          `vibrate(0) ${t('debug.returned')} ${String(drivers.haptics.lastResult ?? true)}`,
        );
      }
    }
  };

  const handlePadLostPointerCapture = (): void => {
    padPointerIdRef.current = null;
    clearAllTimers();
    drivers.haptics.stop();
    setMessage(`vibrate(0) ${t('debug.returned')} ${String(drivers.haptics.lastResult ?? true)}`);
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
        <AccessibleButton
          onClick={() => {
            stopAll();
            buzz(DEFAULT_HAPTICS.lineMs);
          }}
        >
          {t('debug.btnLine')}
        </AccessibleButton>
        <AccessibleButton
          onClick={() => {
            stopAll();
            buzz(DEFAULT_HAPTICS.cornerPattern);
          }}
        >
          {t('debug.btnCorner')}
        </AccessibleButton>
        <AccessibleButton
          onClick={() => {
            stopAll();
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

      {/* Heartbeat candidates test bench */}
      <section className="gt-debug__section" aria-labelledby="debug-hb-heading">
        <h2 id="debug-hb-heading" className="gt-debug__subtitle">
          {t('debug.hbTitle')}
        </h2>

        {/* Period Selector */}
        <div className="gt-debug__period-group" role="group" aria-label={t('debug.hbPeriod')}>
          <span className="gt-debug__period-label">{t('debug.hbPeriod')}:</span>
          {DEMO_PERIODS_MS.map((period) => (
            <AccessibleButton
              key={period}
              className="gt-debug__period-btn"
              aria-pressed={effectivePeriodMs === period}
              onClick={() => {
                stopAll();
                setPickedPeriodMs(period);
              }}
            >
              {period}
            </AccessibleButton>
          ))}
        </div>

        {/* Candidates List */}
        <div className="gt-debug__candidates">
          {HEARTBEAT_CANDIDATES.map((candidate) => {
            const isSelected = candidate.id === selectedCandidateId;
            return (
              <div
                key={candidate.id}
                className={`gt-debug__candidate ${isSelected ? 'gt-debug__candidate--selected' : ''}`}
                data-testid={`candidate-${candidate.id}`}
              >
                <div className="gt-debug__candidate-info">
                  <span className="gt-debug__candidate-name">{t(candidate.nameKey)}</span>
                </div>
                <div className="gt-debug__candidate-actions">
                  <AccessibleButton
                    aria-label={`${candidate.id} ${t('debug.btnOnce')}`}
                    data-testid={`btn-once-${candidate.id}`}
                    onClick={() => handleOnce(candidate)}
                  >
                    {t('debug.btnOnce')}
                  </AccessibleButton>
                  <AccessibleButton
                    aria-label={`${candidate.id} ${t('debug.btnRepeat')}`}
                    data-testid={`btn-repeat-${candidate.id}`}
                    onClick={() => handleRepeat(candidate)}
                  >
                    {t('debug.btnRepeat')}
                  </AccessibleButton>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sequence & Comparison Demos */}
        <div className="gt-debug__sequence-row">
          <AccessibleButton onClick={startLineBuzz2s}>
            {t('debug.btnLine2s')}
          </AccessibleButton>
          <AccessibleButton onClick={startLineThenCorner}>
            {t('debug.btnLineThenCorner')}
          </AccessibleButton>
        </div>

        {/* Resting Pad */}
        <div className="gt-debug__pad-container">
          <AccessibleButton
            className="gt-debug__pad"
            aria-label={t('debug.restingPad')}
            data-testid="resting-pad"
            style={{ minWidth: 160, minHeight: 160, touchAction: 'none' }}
            onPointerDown={handlePadPointerDown}
            onPointerUp={handlePadPointerUpOrCancel}
            onPointerCancel={handlePadPointerUpOrCancel}
            onPointerMove={handlePadPointerMove}
            onLostPointerCapture={handlePadLostPointerCapture}
          >
            <span>{t('debug.restingPad')}</span>
            <span className="gt-debug__pad-hint">{t('debug.restingPadHint')}</span>
          </AccessibleButton>
        </div>
      </section>
    </main>
  );
}
