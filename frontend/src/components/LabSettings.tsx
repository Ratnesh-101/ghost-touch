/**
 * LabSettings — accessible modal lab settings sheet.
 *
 * Wraps LanguageSelector and RateSelector in a modal bottom sheet
 * (centred panel on wide screens).
 *
 * Conforms to WAI-ARIA Modal Dialog requirements:
 * - role="dialog", aria-modal="true"
 * - aria-labelledby pointing to visible title
 * - Focus moves into dialog on open (to close button or first control)
 * - Focus returns to opening control on close
 * - Focus is trapped within the dialog
 * - Escape key and close button dismiss the sheet
 * - Calls speak(text) on open and close with lab.settings.opened/closed
 * - Reuses existing selectors for seamless persistence
 */

import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { AccessibleButton } from './AccessibleButton';
import { LanguageSelector } from './LanguageSelector';
import { RateSelector } from './RateSelector';
import {
  getStoredGuideSetting,
  isGuideEnvOn,
  isShareEnvOn,
  setStoredGuideSetting,
} from '../config/features';
import { TEACH_HASH } from '../drivers/hashRoute';
import {
  getStoredTeacherSetting,
  setStoredTeacherSetting,
} from '../flow/teach';
import type { Drivers } from '../drivers';
import { MemoryDiagramStore } from '../drivers';
import { describeSettings, t } from '../i18n';
import '../styles/settings.css';

export { describeSettings };

export interface LabSettingsProps {
  open: boolean;
  onClose: () => void;
  speak?: (text: string) => void;
  drivers?: Drivers;
  className?: string;
  triggerRef?: RefObject<HTMLElement | null>;
}

const defaultDrivers: Drivers = {
  haptics: { supported: false, lastResult: null, vibrate: () => false, stop: () => {} },
  audio: { unlock: () => {}, setTone: () => {}, beep: () => {}, playEarcon: () => {}, state: 'locked' },
  speech: { speak: () => {}, listen: () => Promise.reject(new Error('unsupported')), canSpeak: false, canListen: false },
  diagramStore: new MemoryDiagramStore(),
};

export function LabSettings({
  open,
  onClose,
  speak,
  drivers = defaultDrivers,
  className = '',
  triggerRef,
}: LabSettingsProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const hasSpokenClose = useRef(false);
  const [guideEnabled, setGuideEnabled] = useState(() => getStoredGuideSetting());
  const [teacherEnabled, setTeacherEnabled] = useState(() => getStoredTeacherSetting());

  const doSpeak = (text: string): void => {
    if (speak) {
      speak(text);
    } else if (drivers?.speech?.speak) {
      drivers.speech.speak(text);
    }
  };

  const handleToggleGuide = (): void => {
    const next = !guideEnabled;
    setGuideEnabled(next);
    setStoredGuideSetting(next);
    const spoken = next ? t('lab.settings.guideOn') : t('lab.settings.guideOff');
    doSpeak(spoken);
  };

  const handleToggleTeacher = (): void => {
    const next = !teacherEnabled;
    setTeacherEnabled(next);
    setStoredTeacherSetting(next);
    const spoken = next ? t('lab.settings.teacherOn') : t('lab.settings.teacherOff');
    doSpeak(spoken);
  };

  const handleClose = (silent?: boolean | unknown): void => {
    const isSilent = silent === true;
    if (!hasSpokenClose.current) {
      hasSpokenClose.current = true;
      if (!isSilent) {
        doSpeak(t('lab.settings.closed'));
      }
    }
    onClose();
    if (triggerRef?.current) {
      triggerRef.current.focus();
    } else if (previouslyFocusedElement.current && typeof previouslyFocusedElement.current.focus === 'function') {
      previouslyFocusedElement.current.focus();
    }
  };

  useEffect(() => {
    if (open) {
      setGuideEnabled(getStoredGuideSetting());
      setTeacherEnabled(getStoredTeacherSetting());
      hasSpokenClose.current = false;
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        previouslyFocusedElement.current = document.activeElement;
      }
      doSpeak(t('lab.settings.opened'));
      const focusTarget = closeButtonRef.current ?? dialogRef.current;
      focusTarget?.focus();
    } else if (wasOpen.current) {
      if (!hasSpokenClose.current) {
        hasSpokenClose.current = true;
        doSpeak(t('lab.settings.closed'));
      }
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (previouslyFocusedElement.current && typeof previouslyFocusedElement.current.focus === 'function') {
        previouslyFocusedElement.current.focus();
      }
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const onWindowKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }

    if (e.key === 'Tab') {
      if (!dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  return (
    <div className={`gt-lab-settings ${className}`} onKeyDown={handleKeyDown}>
      <div
        className="gt-lab-settings__backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-settings-title"
        className="gt-lab-settings__sheet"
        tabIndex={-1}
      >
        <header className="gt-lab-settings__header">
          <h2 id="lab-settings-title" className="gt-lab-settings__title">
            {t('lab.settings.title')}
          </h2>
          <AccessibleButton
            ref={closeButtonRef}
            type="button"
            className="gt-control gt-lab-settings__close"
            onClick={handleClose}
            aria-label={t('lab.settings.close')}
          >
            {t('lab.settings.close')}
          </AccessibleButton>
        </header>

        <div className="gt-lab-settings__content">
          <section className="gt-lab-settings__section" aria-labelledby="lab-settings-section-lang">
            <h3 id="lab-settings-section-lang" className="gt-lab-settings__section-title">
              {t('lab.settings.language')}
            </h3>
            <LanguageSelector drivers={drivers} />
          </section>

          <section className="gt-lab-settings__section" aria-labelledby="lab-settings-section-rate">
            <h3 id="lab-settings-section-rate" className="gt-lab-settings__section-title">
              {t('lab.settings.rate')}
            </h3>
            <RateSelector drivers={drivers} />
          </section>

          {isGuideEnvOn() && (
            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-guide"
            >
              <h3 id="lab-settings-section-guide" className="gt-lab-settings__section-title">
                {t('lab.settings.guide')}
              </h3>
              <p
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.guideHint')}
              </p>
              <AccessibleButton
                type="button"
                role="switch"
                aria-checked={guideEnabled}
                className={`gt-control gt-btn ${
                  guideEnabled ? 'gt-btn--primary' : 'gt-btn--secondary'
                }`}
                onClick={handleToggleGuide}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px 20px',
                  width: '100%',
                }}
              >
                {guideEnabled ? t('lab.settings.guideOn') : t('lab.settings.guideOff')}
              </AccessibleButton>
            </section>
          )}

          {isShareEnvOn() && (
            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-teacher"
            >
              <h3 id="lab-settings-section-teacher" className="gt-lab-settings__section-title">
                {t('lab.settings.teacher')}
              </h3>
              <p
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.teacherHint')}
              </p>
              <AccessibleButton
                type="button"
                role="switch"
                aria-checked={teacherEnabled}
                className={`gt-control gt-btn ${
                  teacherEnabled ? 'gt-btn--primary' : 'gt-btn--secondary'
                }`}
                onClick={handleToggleTeacher}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px 20px',
                  width: '100%',
                }}
              >
                {teacherEnabled ? t('lab.settings.teacherOn') : t('lab.settings.teacherOff')}
              </AccessibleButton>
              {teacherEnabled && (
                <AccessibleButton
                  type="button"
                  className="gt-control gt-btn gt-btn--secondary"
                  onClick={() => {
                    handleClose(true);
                    if (typeof window !== 'undefined') {
                      window.location.hash = TEACH_HASH;
                    }
                  }}
                  style={{
                    minWidth: '48px',
                    minHeight: '48px',
                    padding: '12px 20px',
                    width: '100%',
                    marginTop: 'var(--gt-space-sm, 8px)',
                  }}
                >
                  {t('lab.settings.openTeacher')}
                </AccessibleButton>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
