/**
 * VerifiedBanner — displays teacher verification details on the Explore screen.
 *
 * Requirements:
 * - Rendered with `role="status"` and accessible text.
 * - Teacher name, note, and labels render as React text children only (no dangerouslySetInnerHTML).
 * - Note is hidden initially and shown/spoken on request only via "Read note" button.
 * - Touch targets >= 48x48 px via `.gt-control`.
 * - Displays name, note, and labels isolated with `<bdi>` (SEC-02).
 * - Honesty line displayed in student banner area and spoken only on request (SEC-03).
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

  const nameText = by.trim() !== '' ? by : t('share.verified');
  const template = t('share.verifiedBy');
  const nameIndex = template.indexOf('{name}');
  const prefix = nameIndex !== -1 ? template.slice(0, nameIndex) : '';
  const suffix = nameIndex !== -1 ? template.slice(nameIndex + '{name}'.length) : '';
  const verifiedText = template.replace('{name}', nameText);

  return (
    <aside className="gt-verified-banner" role="status" aria-label={verifiedText}>
      <div className="gt-verified-banner__main">
        <span className="gt-verified-banner__badge" aria-hidden="true">
          ✓
        </span>
        <span className="gt-verified-banner__by">
          <bdi>
            {nameIndex !== -1 ? (
              <>
                {prefix}
                <bdi className="gt-verified-banner__name">{nameText}</bdi>
                {suffix}
              </>
            ) : (
              <bdi className="gt-verified-banner__name">{nameText}</bdi>
            )}
          </bdi>
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
        <div className="gt-verified-banner__note-body">
          <p className="gt-verified-banner__note-text">
            <bdi>{cleanNote}</bdi>
          </p>
        </div>
      )}
    </aside>
  );
}
