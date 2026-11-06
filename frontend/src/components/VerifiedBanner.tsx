/**
 * VerifiedBanner — displays teacher verification details on the Explore screen.
 *
 * Requirements:
 * - Rendered with `role="status"` and accessible text.
 * - Teacher name, note, and labels render as React text children only (no dangerouslySetInnerHTML).
 * - Note is hidden initially and shown/spoken on request only via "Read note" button.
 * - Touch targets >= 48x48 px via `.gt-control`.
 */

import { useState, type JSX } from 'react';
import { AccessibleButton } from './AccessibleButton';
import { t } from '../i18n';

export interface VerifiedBannerProps {
  by: string;
  note?: string;
  at?: string;
  onSpeak?: (text: string) => void;
}

export function VerifiedBanner({
  by,
  note,
  onSpeak,
}: VerifiedBannerProps): JSX.Element {
  const [showNote, setShowNote] = useState(false);
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  const hasNote = cleanNote.length > 0;

  const handleToggleNote = (): void => {
    const next = !showNote;
    setShowNote(next);
    if (next && hasNote && onSpeak) {
      onSpeak(cleanNote);
    }
  };

  const nameText = by.trim() !== '' ? by : t('share.verified');
  const verifiedText = t('share.verifiedBy').replace('{name}', nameText);

  return (
    <aside className="gt-verified-banner" role="status" aria-label={verifiedText}>
      <div className="gt-verified-banner__main">
        <span className="gt-verified-banner__badge" aria-hidden="true">
          ✓
        </span>
        <span className="gt-verified-banner__by">
          {verifiedText}
        </span>
        {hasNote && (
          <AccessibleButton
            className="gt-control gt-verified-banner__note-btn"
            onClick={handleToggleNote}
          >
            {showNote ? t('share.hideNote') : t('share.readNote')}
          </AccessibleButton>
        )}
      </div>
      {hasNote && showNote && (
        <div className="gt-verified-banner__note-body">
          <p className="gt-verified-banner__note-text">{cleanNote}</p>
        </div>
      )}
    </aside>
  );
}
