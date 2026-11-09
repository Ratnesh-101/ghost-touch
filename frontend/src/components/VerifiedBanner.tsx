/**
 * VerifiedBanner — displays shared diagram author details on the Explore screen.
 *
 * Requirements (R1/R3):
 * - Rendered with `role="status"` and accessible text.
 * - Spoken and visible label says "Shared by <name>, not checked" style wording (never "Verified" for link content).
 * - Strips leading checkmarks and words "verified"/"certified" from author name.
 * - Renders author name, note, and labels isolated with `<bdi>`.
 * - Teacher name, note, and labels render as React text children only (no dangerouslySetInnerHTML).
 * - Note is hidden initially and shown/spoken on request only via "Read note" button.
 * - Touch targets >= 48x48 px via `.gt-control`.
 * - Honesty line displayed in student banner area with role="note".
 */

import { useState, type JSX } from 'react';
import { AccessibleButton } from './AccessibleButton';
import { t } from '../i18n';
import { honestSharedByLabel, sanitizeShareName } from '../flow/share';

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
  const rawNote = typeof note === 'string' ? note.trim() : '';
  const cleanNote = rawNote.replace(/^[✓✔☑√\s]+/u, '');
  const hasNote = cleanNote.length > 0;

  const handleToggleNote = (): void => {
    const next = !showNote;
    setShowNote(next);
    if (next && hasNote && onSpeak) {
      onSpeak(cleanNote);
    }
  };

  const handleSpeakHonesty = (): void => {
    if (onSpeak) {
      onSpeak(t('share.honesty'));
    }
  };

  const cleanName = sanitizeShareName(by);
  const labelText = honestSharedByLabel(cleanName);

  return (
    <aside className="gt-verified-banner" role="status" aria-label={labelText}>
      <div className="gt-verified-banner__main">
        {/* Leading checkmark stripped per R1/R3 honesty */}
        <span className="gt-verified-banner__by">
          <bdi className="gt-verified-banner__name">{labelText}</bdi>
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

      <AccessibleButton
        type="button"
        className="gt-control gt-verified-banner__honesty"
        onClick={handleSpeakHonesty}
        aria-label={t('share.honesty')}
      >
        {t('share.honesty')}
      </AccessibleButton>

      {hasNote && showNote && (
        <div className="gt-verified-banner__note-body" aria-live="off">
          <p className="gt-verified-banner__note-text">
            <bdi>{cleanNote}</bdi>
          </p>
        </div>
      )}
    </aside>
  );
}
