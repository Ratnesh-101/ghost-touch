/**
 * VerifyForm — teacher verification form for Teacher Editor mode.
 *
 * Requirements:
 * - Teacher name (required, <= 60 chars)
 * - Note (optional, <= 280 chars)
 * - Honest copy displayed on screen:
 *   "Verified means a person reviewed this diagram. It is not cryptographic proof." (i18n en/hi/gu)
 * - "Mark verified" button disabled until valid
 * - 48x48 px touch targets, labelled form controls
 */

import { type FormEvent, type JSX } from 'react';
import { AccessibleButton } from '../AccessibleButton';
import { LIMITS } from '../../share';
import { t } from '../../i18n';

export interface VerifyFormProps {
  name: string;
  note: string;
  isValidDiagram: boolean;
  onNameChange: (name: string) => void;
  onNoteChange: (note: string) => void;
  onVerify: () => void;
  disabled?: boolean;
}

export function VerifyForm({
  name,
  note,
  isValidDiagram,
  onNameChange,
  onNoteChange,
  onVerify,
  disabled = false,
}: VerifyFormProps): JSX.Element {
  const isNameValid = name.trim().length > 0 && name.length <= LIMITS.maxName;
  const isNoteValid = note.length <= LIMITS.maxNote;
  const canVerify = isValidDiagram && isNameValid && isNoteValid && !disabled;

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (canVerify) {
      onVerify();
    }
  };

  return (
    <section className="gt-teach__verify-section" aria-labelledby="gt-teach-verify-heading">
      <h2 id="gt-teach-verify-heading" className="gt-teach__section-heading">
        {t('teach.verifySection')}
      </h2>

      <p className="gt-teach__honesty-notice" role="note">
        {t('share.honesty')}
      </p>

      <form className="gt-teach__verify-form" onSubmit={handleSubmit} noValidate>
        <div className="gt-teach__field">
          <label htmlFor="gt-teach-name" className="gt-teach__field-label">
            {t('teach.teacherName')}
            <span className="gt-teach__field-counter">
              {name.length}/{LIMITS.maxName}
            </span>
          </label>
          <input
            id="gt-teach-name"
            type="text"
            className="gt-control gt-teach__input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('teach.teacherNamePlaceholder')}
            maxLength={LIMITS.maxName}
            required
            disabled={disabled}
            aria-required="true"
          />
        </div>

        <div className="gt-teach__field">
          <label htmlFor="gt-teach-note" className="gt-teach__field-label">
            {t('teach.teacherNote')}
            <span className="gt-teach__field-counter">
              {note.length}/{LIMITS.maxNote}
            </span>
          </label>
          <textarea
            id="gt-teach-note"
            className="gt-control gt-teach__textarea"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t('teach.teacherNotePlaceholder')}
            maxLength={LIMITS.maxNote}
            rows={3}
            disabled={disabled}
          />
        </div>

        <AccessibleButton
          type="submit"
          className="gt-control gt-btn gt-btn--primary gt-teach__verify-btn"
          disabled={!canVerify}
        >
          {t('teach.markVerified')}
        </AccessibleButton>
      </form>
    </section>
  );
}
