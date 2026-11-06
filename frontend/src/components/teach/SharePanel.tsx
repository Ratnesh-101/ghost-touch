/**
 * SharePanel — share presentation panel for verified diagrams in Teacher Editor mode.
 *
 * Requirements:
 * - Display generated share link and size in characters
 * - "Copy link" button with spoken confirmation ("Link copied") and clipboard driver
 * - "Share" button via Web Share API ONLY when available
 * - QR code via qrDataUrl when URL fits, else message:
 *   "Link too long for a QR code; use Copy link"
 * - 48x48 px touch targets, labelled controls
 */

import { useState, type JSX } from 'react';
import { AccessibleButton } from '../AccessibleButton';
import { canWebShare, copyToClipboard, shareViaWebShare } from '../../drivers/clipboard';
import { t } from '../../i18n';

export interface SharePanelProps {
  url: string;
  qrUrl: string | null;
  onSpeak?: (text: string) => void;
  diagramTitle?: string | null;
}

export function SharePanel({
  url,
  qrUrl,
  onSpeak,
  diagramTitle,
}: SharePanelProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const webShareSupported = canWebShare();

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      const confirmation = t('teach.linkCopied');
      onSpeak?.(confirmation);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleWebShare = async (): Promise<void> => {
    await shareViaWebShare({
      title: diagramTitle ?? t('teach.title'),
      text: t('teach.intro'),
      url,
    });
  };

  return (
    <section className="gt-teach__share-panel" aria-labelledby="gt-teach-share-heading">
      <h2 id="gt-teach-share-heading" className="gt-teach__section-heading">
        {t('teach.shareLink')}
      </h2>

      <div className="gt-teach__share-meta">
        <span className="gt-teach__char-count">
          {t('teach.linkSize').replace('{chars}', String(url.length))}
        </span>
      </div>

      <div className="gt-teach__url-box">
        <label htmlFor="gt-teach-share-url" className="gt-visually-hidden">
          {t('teach.shareLink')}
        </label>
        <input
          id="gt-teach-share-url"
          type="text"
          readOnly
          className="gt-control gt-teach__url-input"
          value={url}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
      </div>

      <div className="gt-teach__share-actions">
        <AccessibleButton
          type="button"
          className="gt-control gt-btn gt-btn--primary gt-teach__action-btn"
          onClick={() => void handleCopy()}
        >
          {copied ? t('teach.linkCopied') : t('teach.copyLink')}
        </AccessibleButton>

        {webShareSupported && (
          <AccessibleButton
            type="button"
            className="gt-control gt-btn gt-btn--secondary gt-teach__action-btn"
            onClick={() => void handleWebShare()}
          >
            {t('teach.share')}
          </AccessibleButton>
        )}
      </div>

      <div className="gt-teach__qr-container">
        {qrUrl ? (
          <div className="gt-teach__qr-box">
            <img
              src={qrUrl}
              alt={t('teach.qrCodeAlt')}
              className="gt-teach__qr-img"
              width={200}
              height={200}
            />
          </div>
        ) : (
          <p className="gt-teach__qr-toolong" role="status">
            {t('teach.qrTooLong')}
          </p>
        )}
      </div>
    </section>
  );
}
