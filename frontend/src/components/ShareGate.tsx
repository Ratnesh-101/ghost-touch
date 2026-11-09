/**
 * ShareGate — user activation screen for shared diagram links opened cold.
 *
 * Requirements (GT-05):
 * - Shared links opened cold (new tab) are silent without a user activation.
 * - Shows a first screen/gate with a large, labelled button ("Open the shared diagram").
 * - Button is focused on load so TalkBack reads its visible text and aria-label immediately.
 * - Tapping unlocks audio and speech inside the user activation, then opens Explore.
 * - Localised across en, hi, and gu.
 * - Touch target >= 48x48 CSS px.
 */

import { useEffect, useRef, type JSX } from 'react';
import { AccessibleButton } from './AccessibleButton';
import { t } from '../i18n';

export interface ShareGateProps {
  onOpen: () => void;
  title?: string;
  sharedBy?: string;
}

export function ShareGate({ onOpen, title, sharedBy }: ShareGateProps): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const openLabel = t('share.gate.open');
  const headingText = t('share.gate.heading');

  return (
    <main className="gt-share-gate gt-lab-explore" role="main">
      <header className="gt-share-gate__header">
        <h1 className="gt-share-gate__title">{headingText}</h1>
      </header>

      {(title || sharedBy) && (
        <section className="gt-share-gate__card">
          {title && <p className="gt-share-gate__diagram-title">{title}</p>}
          {sharedBy && <p className="gt-share-gate__diagram-by">{sharedBy}</p>}
        </section>
      )}

      <div className="gt-share-gate__actions">
        <AccessibleButton
          ref={buttonRef}
          className="gt-control gt-btn gt-btn--primary gt-share-gate__open-btn"
          onClick={onOpen}
          aria-label={openLabel}
        >
          {openLabel}
        </AccessibleButton>
      </div>
    </main>
  );
}
