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
  applyPreset,
  presetOf,
  type PresetId,
} from '../core/presets';
import {
  getStoredGuideSetting,
  isGuideEnvOn,
  isShareEnvOn,
  setStoredGuideSetting,
} from '../config/features';
import {
  getStoredCornerHeartbeatSetting,
  getStoredDirectionsSetting,
  getStoredStickyLineSetting,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredStickyLineSetting,
} from '../drivers/storage';
import {
  getStoredFindingSoundSetting,
  getStoredGraphScanSetting,
  getStoredSpeechDetailSetting,
  setStoredFindingSoundSetting,
  setStoredGraphScanSetting,
  setStoredSpeechDetailSetting,
  type SpeechDetail,
} from '../flow/explore';
import { TEACH_HASH } from '../drivers/hashRoute';
import {
  getStoredTeacherSetting,
  setStoredTeacherSetting,
} from '../flow/teach';
import type { Drivers } from '../drivers';
import { MemoryDiagramStore } from '../drivers';
import { describeSettings, getLang, LANG_BCP47, t } from '../i18n';
import '../styles/settings.css';

export { describeSettings };

export interface LabSettingsProps {
  open: boolean;
  onClose: () => void;
  speak?: (text: string, lang?: string) => void;
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
  const [directionsEnabled, setDirectionsEnabled] = useState(() => getStoredDirectionsSetting());
  const [findingSoundEnabled, setFindingSoundEnabled] = useState(() => getStoredFindingSoundSetting());
  const [stickyLineEnabled, setStickyLineEnabled] = useState(() => getStoredStickyLineSetting());
  const [graphScanEnabled, setGraphScanEnabled] = useState(() => getStoredGraphScanSetting());
  const [cornerHeartbeatEnabled, setCornerHeartbeatEnabled] = useState(() => getStoredCornerHeartbeatSetting());
  const [teacherEnabled, setTeacherEnabled] = useState(() => getStoredTeacherSetting());
  const [speechDetail, setSpeechDetail] = useState<SpeechDetail>(() => getStoredSpeechDetailSetting());
  const [moreOpen, setMoreOpen] = useState(false);

  const doSpeak = (text: string, lang = LANG_BCP47[getLang()] ?? 'en-IN'): void => {
    if (speak) {
      speak(text, lang);
    } else if (drivers?.speech?.speak) {
      drivers.speech.speak(text, lang);
    }
  };

  const currentPreset = presetOf({
    speechDetail,
    directions: directionsEnabled,
    findingSound: findingSoundEnabled,
    graphScan: graphScanEnabled,
    stickyLine: stickyLineEnabled,
    cornerHeartbeat: cornerHeartbeatEnabled,
  });

  const handleSelectPreset = (id: PresetId): void => {
    const nextSettings = applyPreset(id);
    setSpeechDetail(nextSettings.speechDetail);
    setStoredSpeechDetailSetting(nextSettings.speechDetail);

    setDirectionsEnabled(nextSettings.directions);
    setStoredDirectionsSetting(nextSettings.directions);

    setFindingSoundEnabled(nextSettings.findingSound);
    setStoredFindingSoundSetting(nextSettings.findingSound);

    setGraphScanEnabled(nextSettings.graphScan);
    setStoredGraphScanSetting(nextSettings.graphScan);

    setStickyLineEnabled(nextSettings.stickyLine);
    setStoredStickyLineSetting(nextSettings.stickyLine);

    setCornerHeartbeatEnabled(nextSettings.cornerHeartbeat);
    setStoredCornerHeartbeatSetting(nextSettings.cornerHeartbeat);

    const spokenMap: Record<PresetId, string> = {
      simple: t('lab.settings.presetAppliedSimple'),
      standard: t('lab.settings.presetAppliedStandard'),
      explorer: t('lab.settings.presetAppliedExplorer'),
    };
    doSpeak(spokenMap[id]);
  };

  const handleReset = (): void => {
    const nextSettings = applyPreset('standard');
    setSpeechDetail(nextSettings.speechDetail);
    setStoredSpeechDetailSetting(nextSettings.speechDetail);

    setDirectionsEnabled(nextSettings.directions);
    setStoredDirectionsSetting(nextSettings.directions);

    setFindingSoundEnabled(nextSettings.findingSound);
    setStoredFindingSoundSetting(nextSettings.findingSound);

    setGraphScanEnabled(nextSettings.graphScan);
    setStoredGraphScanSetting(nextSettings.graphScan);

    setStickyLineEnabled(nextSettings.stickyLine);
    setStoredStickyLineSetting(nextSettings.stickyLine);

    setCornerHeartbeatEnabled(nextSettings.cornerHeartbeat);
    setStoredCornerHeartbeatSetting(nextSettings.cornerHeartbeat);

    doSpeak(t('lab.settings.resetApplied'));
  };

  const handleToggleMore = (): void => {
    const next = !moreOpen;
    setMoreOpen(next);
    doSpeak(next ? t('lab.settings.moreSettingsExpanded') : t('lab.settings.moreSettingsCollapsed'));
  };

  const handleSelectSpeechDetail = (detail: SpeechDetail): void => {
    setSpeechDetail(detail);
    setStoredSpeechDetailSetting(detail);
    const spoken =
      detail === 'short'
        ? t('lab.settings.speechDetailSetShort')
        : t('lab.settings.speechDetailSetFull');
    doSpeak(spoken);
  };

  const handleToggleDirections = (): void => {
    const next = !directionsEnabled;
    setDirectionsEnabled(next);
    setStoredDirectionsSetting(next);
    const spoken = next ? t('lab.settings.directionsOn') : t('lab.settings.directionsOff');
    doSpeak(spoken);
  };

  const handleToggleFindingSound = (): void => {
    const next = !findingSoundEnabled;
    setFindingSoundEnabled(next);
    setStoredFindingSoundSetting(next);
    const spoken = next ? t('lab.settings.findingSoundOn') : t('lab.settings.findingSoundOff');
    doSpeak(spoken);
  };

  const handleToggleStickyLine = (): void => {
    const next = !stickyLineEnabled;
    setStickyLineEnabled(next);
    setStoredStickyLineSetting(next);
    const spoken = next ? t('lab.settings.stickyLineOn') : t('lab.settings.stickyLineOff');
    doSpeak(spoken);
  };

  const handleToggleGraphScan = (): void => {
    const next = !graphScanEnabled;
    setGraphScanEnabled(next);
    setStoredGraphScanSetting(next);
    const spoken = next ? t('lab.settings.graphScanOn') : t('lab.settings.graphScanOff');
    doSpeak(spoken);
  };

  const handleToggleCornerHeartbeat = (): void => {
    const next = !cornerHeartbeatEnabled;
    setCornerHeartbeatEnabled(next);
    setStoredCornerHeartbeatSetting(next);
    const spoken = next ? t('lab.settings.cornerHeartbeatOn') : t('lab.settings.cornerHeartbeatOff');
    doSpeak(spoken);
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
    if (silent === true) {
      hasSpokenClose.current = true;
    } else if (!hasSpokenClose.current && (open || wasOpen.current)) {
      hasSpokenClose.current = true;
      doSpeak(t('lab.settings.closed'), LANG_BCP47[getLang()] ?? 'en-IN');
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
      if (!wasOpen.current) {
        hasSpokenClose.current = false;
        doSpeak(t('lab.settings.opened'), LANG_BCP47[getLang()] ?? 'en-IN');
      }
      setGuideEnabled(getStoredGuideSetting());
      setDirectionsEnabled(getStoredDirectionsSetting());
      setFindingSoundEnabled(getStoredFindingSoundSetting());
      setStickyLineEnabled(getStoredStickyLineSetting());
      setGraphScanEnabled(getStoredGraphScanSetting());
      setCornerHeartbeatEnabled(getStoredCornerHeartbeatSetting());
      setTeacherEnabled(getStoredTeacherSetting());
      setSpeechDetail(getStoredSpeechDetailSetting());
      setMoreOpen(false);
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        previouslyFocusedElement.current = document.activeElement;
      }
      const focusTarget = closeButtonRef.current ?? dialogRef.current;
      focusTarget?.focus();
    } else if (wasOpen.current) {
      if (!hasSpokenClose.current) {
        hasSpokenClose.current = true;
        doSpeak(t('lab.settings.closed'), LANG_BCP47[getLang()] ?? 'en-IN');
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

          <section
            className="gt-lab-settings__section"
            aria-labelledby="lab-settings-section-presets"
          >
            <div className="gt-lab-settings__presets-header">
              <h3 id="lab-settings-section-presets" className="gt-lab-settings__section-title">
                {t('lab.settings.presets')}
              </h3>
              {currentPreset === 'custom' && (
                <span className="gt-preset-status" role="status">
                  {t('lab.settings.presetCustom')}
                </span>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label={t('lab.settings.presets')}
              className="gt-preset-radiogroup"
            >
              <AccessibleButton
                type="button"
                role="radio"
                aria-checked={currentPreset === 'simple'}
                aria-label={t('lab.settings.presetSimple')}
                aria-describedby="lab-preset-hint-simple"
                className={`gt-control gt-preset-radio ${
                  currentPreset === 'simple' ? 'gt-preset-radio--active' : ''
                }`}
                onClick={() => handleSelectPreset('simple')}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                }}
              >
                <span className="gt-preset-radio__label">
                  {t('lab.settings.presetSimple')}
                </span>
                <span id="lab-preset-hint-simple" className="gt-preset-radio__hint">
                  {t('lab.settings.presetSimpleHint')}
                </span>
              </AccessibleButton>

              <AccessibleButton
                type="button"
                role="radio"
                aria-checked={currentPreset === 'standard'}
                aria-label={t('lab.settings.presetStandard')}
                aria-describedby="lab-preset-hint-standard"
                className={`gt-control gt-preset-radio ${
                  currentPreset === 'standard' ? 'gt-preset-radio--active' : ''
                }`}
                onClick={() => handleSelectPreset('standard')}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                }}
              >
                <span className="gt-preset-radio__label">
                  {t('lab.settings.presetStandard')}
                </span>
                <span id="lab-preset-hint-standard" className="gt-preset-radio__hint">
                  {t('lab.settings.presetStandardHint')}
                </span>
              </AccessibleButton>

              <AccessibleButton
                type="button"
                role="radio"
                aria-checked={currentPreset === 'explorer'}
                aria-label={t('lab.settings.presetExplorer')}
                aria-describedby="lab-preset-hint-explorer"
                className={`gt-control gt-preset-radio ${
                  currentPreset === 'explorer' ? 'gt-preset-radio--active' : ''
                }`}
                onClick={() => handleSelectPreset('explorer')}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                }}
              >
                <span className="gt-preset-radio__label">
                  {t('lab.settings.presetExplorer')}
                </span>
                <span id="lab-preset-hint-explorer" className="gt-preset-radio__hint">
                  {t('lab.settings.presetExplorerHint')}
                </span>
              </AccessibleButton>
            </div>

            <div className="gt-preset-reset-container">
              <AccessibleButton
                type="button"
                className="gt-control gt-btn gt-btn--secondary gt-preset-reset-btn"
                onClick={handleReset}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                }}
              >
                {t('lab.settings.reset')}
              </AccessibleButton>
            </div>
          </section>

          <AccessibleButton
            type="button"
            aria-expanded={moreOpen}
            aria-controls="lab-settings-more-content"
            className="gt-control gt-btn gt-btn--secondary gt-lab-settings__more-toggle"
            onClick={handleToggleMore}
            style={{
              minWidth: '48px',
              minHeight: '48px',
            }}
          >
            <span>{t('lab.settings.moreSettings')}</span>
            <span aria-hidden="true">{moreOpen ? '▲' : '▼'}</span>
          </AccessibleButton>

          <div
            id="lab-settings-more-content"
            className="gt-lab-settings__more-content"
            hidden={!moreOpen}
          >
            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-speech-detail"
            >
              <h3
                id="lab-settings-section-speech-detail"
                className="gt-lab-settings__section-title"
              >
                {t('lab.settings.speechDetail')}
              </h3>
              <p
                id="lab-settings-hint-speech-detail"
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.speechDetailHint')}
              </p>
              <div
                className="gt-rate-selector"
                role="group"
                aria-label={t('lab.settings.speechDetail')}
              >
                <AccessibleButton
                  type="button"
                  className={`gt-control gt-rate-selector__btn ${
                    speechDetail === 'full' ? 'gt-rate-selector__btn--active' : ''
                  }`}
                  aria-pressed={speechDetail === 'full'}
                  aria-label={t('lab.settings.speechDetailFull')}
                  aria-describedby="lab-settings-hint-speech-detail"
                  onClick={() => handleSelectSpeechDetail('full')}
                  style={{
                    minWidth: '48px',
                    minHeight: '48px',
                  }}
                >
                  <span className="gt-rate-selector__label">
                    {t('lab.settings.speechDetailFull')}
                  </span>
                </AccessibleButton>
                <AccessibleButton
                  type="button"
                  className={`gt-control gt-rate-selector__btn ${
                    speechDetail === 'short' ? 'gt-rate-selector__btn--active' : ''
                  }`}
                  aria-pressed={speechDetail === 'short'}
                  aria-label={t('lab.settings.speechDetailShort')}
                  aria-describedby="lab-settings-hint-speech-detail"
                  onClick={() => handleSelectSpeechDetail('short')}
                  style={{
                    minWidth: '48px',
                    minHeight: '48px',
                  }}
                >
                  <span className="gt-rate-selector__label">
                    {t('lab.settings.speechDetailShort')}
                  </span>
                </AccessibleButton>
              </div>
            </section>

            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-directions"
            >
              <h3 id="lab-settings-section-directions" className="gt-lab-settings__section-title">
                {t('lab.settings.directions')}
              </h3>
              <p
                id="lab-settings-hint-directions"
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.directionsHint')}
              </p>
              <AccessibleButton
                type="button"
                role="switch"
                aria-checked={directionsEnabled}
                aria-describedby="lab-settings-hint-directions"
                className={`gt-control gt-btn ${
                  directionsEnabled ? 'gt-btn--primary' : 'gt-btn--secondary'
                }`}
                onClick={handleToggleDirections}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px 20px',
                  width: '100%',
                }}
              >
                {t('lab.settings.directions')}
              </AccessibleButton>
            </section>

            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-finding-sound"
            >
              <h3 id="lab-settings-section-finding-sound" className="gt-lab-settings__section-title">
                {t('lab.settings.findingSound')}
              </h3>
              <p
                id="lab-settings-hint-finding-sound"
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.findingSoundHint')}
              </p>
              <AccessibleButton
                type="button"
                role="switch"
                aria-checked={findingSoundEnabled}
                aria-describedby="lab-settings-hint-finding-sound"
                className={`gt-control gt-btn ${
                  findingSoundEnabled ? 'gt-btn--primary' : 'gt-btn--secondary'
                }`}
                onClick={handleToggleFindingSound}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px 20px',
                  width: '100%',
                }}
              >
                {t('lab.settings.findingSound')}
              </AccessibleButton>
            </section>

            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-sticky-line"
            >
              <h3 id="lab-settings-section-sticky-line" className="gt-lab-settings__section-title">
                {t('lab.settings.stickyLine')}
              </h3>
              <p
                id="lab-settings-hint-sticky-line"
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.stickyLineHint')}
              </p>
              <AccessibleButton
                type="button"
                role="switch"
                aria-checked={stickyLineEnabled}
                aria-describedby="lab-settings-hint-sticky-line"
                className={`gt-control gt-btn ${
                  stickyLineEnabled ? 'gt-btn--primary' : 'gt-btn--secondary'
                }`}
                onClick={handleToggleStickyLine}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px 20px',
                  width: '100%',
                }}
              >
                {t('lab.settings.stickyLine')}
              </AccessibleButton>
            </section>

            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-graph-scan"
            >
              <h3 id="lab-settings-section-graph-scan" className="gt-lab-settings__section-title">
                {t('lab.settings.graphScan')}
              </h3>
              <p
                id="lab-settings-hint-graph-scan"
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.graphScanHint')}
              </p>
              <AccessibleButton
                type="button"
                role="switch"
                aria-checked={graphScanEnabled}
                aria-describedby="lab-settings-hint-graph-scan"
                className={`gt-control gt-btn ${
                  graphScanEnabled ? 'gt-btn--primary' : 'gt-btn--secondary'
                }`}
                onClick={handleToggleGraphScan}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px 20px',
                  width: '100%',
                }}
              >
                {t('lab.settings.graphScan')}
              </AccessibleButton>
            </section>

            <section
              className="gt-lab-settings__section"
              aria-labelledby="lab-settings-section-corner-heartbeat"
            >
              <h3 id="lab-settings-section-corner-heartbeat" className="gt-lab-settings__section-title">
                {t('lab.settings.cornerHeartbeat')}
              </h3>
              <p
                id="lab-settings-hint-corner-heartbeat"
                className="gt-lab-settings__hint"
                style={{
                  margin: '0 0 var(--gt-space-sm, 8px) 0',
                  fontSize: '0.9rem',
                  color: 'var(--gt-bone, #ded6c4)',
                }}
              >
                {t('lab.settings.cornerHeartbeatHint')}
              </p>
              <AccessibleButton
                type="button"
                role="switch"
                aria-checked={cornerHeartbeatEnabled}
                aria-describedby="lab-settings-hint-corner-heartbeat"
                className={`gt-control gt-btn ${
                  cornerHeartbeatEnabled ? 'gt-btn--primary' : 'gt-btn--secondary'
                }`}
                onClick={handleToggleCornerHeartbeat}
                style={{
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px 20px',
                  width: '100%',
                }}
              >
                {t('lab.settings.cornerHeartbeat')}
              </AccessibleButton>
            </section>

            <section
              className="gt-lab-settings__section gt-lab-settings__vibration-help"
              aria-labelledby="lab-settings-section-vibration"
            >
              <h3 id="lab-settings-section-vibration" className="gt-lab-settings__section-title">
                {t('lab.settings.vibrationHelpTitle')}
              </h3>
              <p
                id="lab-settings-vibration-intro"
                className="gt-lab-settings__vibration-intro"
                role="note"
              >
                {t('lab.settings.vibrationHelpIntro')}
              </p>
              <ul
                className="gt-lab-settings__vibration-list"
                aria-describedby="lab-settings-vibration-intro"
              >
                <li>{t('lab.settings.vibrationHelpSamsung')}</li>
                <li>{t('lab.settings.vibrationHelpStock')}</li>
                <li>{t('lab.settings.vibrationHelpOnePlus')}</li>
                <li>{t('lab.settings.vibrationHelpXiaomi')}</li>
              </ul>
              <p className="gt-lab-settings__vibration-note">
                {t('lab.settings.vibrationHelpNote')}
              </p>
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
                  id="lab-settings-hint-guide"
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
                  aria-describedby="lab-settings-hint-guide"
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
                  {t('lab.settings.guide')}
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
                  id="lab-settings-hint-teacher"
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
                  aria-describedby="lab-settings-hint-teacher"
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
                  {t('lab.settings.teacher')}
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
    </div>
  );
}
