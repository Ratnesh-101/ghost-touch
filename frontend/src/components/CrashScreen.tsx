import { useEffect, useRef, type JSX } from 'react';
import { reloadApp } from '../drivers/crashGuard';
import { t } from '../i18n';

export interface CrashScreenProps {
  message?: string;
  onRestart?: () => void;
}

/**
 * CrashScreen — full-screen recovery surface for a blind user when the app crashes.
 *
 * Requirements:
 * - role="alert"
 * - the crash message sentence as text
 * - one full-screen button with accessible name t('crash.restart') that calls reloadApp() (window.location.reload())
 * - focus button on mount
 * - 48x48 px minimum target class (.gt-control)
 */
export function CrashScreen({ message, onRestart }: CrashScreenProps): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const handleRestart = (): void => {
    if (onRestart) {
      onRestart();
      return;
    }
    reloadApp();
  };

  const displayText = message ?? t('crash.message');
  const restartLabel = t('crash.restart');

  return (
    <div className="gt-crash-screen" role="alert">
      <p className="gt-crash-message">{displayText}</p>
      <button
        ref={buttonRef}
        type="button"
        className="gt-crash-button gt-control"
        onClick={handleRestart}
        aria-label={restartLabel}
      >
        {restartLabel}
      </button>
    </div>
  );
}
