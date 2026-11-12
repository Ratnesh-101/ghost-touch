/**
 * ShareError screen — friendly error display when a shared diagram link cannot be opened.
 *
 * Requirements:
 * - Friendly messages for all ShareErrorCode variants (too-large, bad-format, bad-version, bad-scene, empty).
 * - "Go to start" button to return to the Start screen and clear hash.
 * - Never renders raw payload strings, tracebacks, or stack traces.
 * - Touch targets >= 48x48 px via `.gt-control`.
 * - R5-04: Follows StatusText pattern (no live region when speech synthesis speaks).
 */

import { useEffect, useRef, type JSX } from 'react';
import { AccessibleButton } from '../components/AccessibleButton';
import { StatusText } from '../components/StatusText';
import { t } from '../i18n';
import type { ShareErrorCode } from '../share';

export function shareErrorMessage(code: ShareErrorCode): string {
  switch (code) {
    case 'too-large':
      return t('share.error.tooLarge');
    case 'bad-format':
      return t('share.error.badFormat');
    case 'bad-version':
      return t('share.error.badVersion');
    case 'bad-scene':
      return t('share.error.badScene');
    case 'empty':
      return t('share.error.empty');
    default:
      return t('share.error.generic');
  }
}

export interface ShareErrorProps {
  code: ShareErrorCode;
  onGoToStart: () => void;
  canSpeak?: boolean;
}

export function ShareError({
  code,
  onGoToStart,
  canSpeak,
}: ShareErrorProps): JSX.Element {
  const message = shareErrorMessage(code);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const speechAvailable =
    canSpeak ?? (typeof window !== 'undefined' && 'speechSynthesis' in window);

  return (
    <main className="gt-share-error gt-lab-explore">
      <header className="gt-share-error__header">
        <h1 ref={headingRef} tabIndex={-1} className="gt-share-error__title">
          {t('share.error.title')}
        </h1>
      </header>

      <section
        className="gt-share-error__card"
        role={speechAvailable ? undefined : 'alert'}
      >
        <StatusText spoken={Boolean(speechAvailable)} className="gt-share-error__message">
          {message}
        </StatusText>
      </section>

      <footer className="gt-share-error__footer">
        <AccessibleButton
          className="gt-control gt-share-error__start-btn"
          onClick={onGoToStart}
        >
          {t('share.goToStart')}
        </AccessibleButton>
      </footer>
    </main>
  );
}
