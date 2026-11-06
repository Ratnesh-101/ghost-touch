/**
 * Capture — take a photo, choose an image (photo or screenshot), or open a
 * bundled sample. Samples never touch the network (Requirement 2.4).
 *
 * Header displays Ghost Touch creature brand mark beside real title text and tagline.
 * Language and speech-rate selectors are consolidated into a modal Lab Settings sheet
 * behind a single accessible button describing the current configuration.
 *
 * Samples are presented as "specimen jar" cards with real mini previews.
 * While reading a diagram, renders LabLoading copper power meter.
 * Behaviour lives in `flow/capture.ts`; this component wires controls to it,
 * mirrors every spoken line into a visible `aria-live` status, and moves
 * focus back to "Take photo" after a failure.
 */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type JSX,
  type ReactEventHandler,
  type RefObject,
} from 'react';

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    onCancel?: ReactEventHandler<T> | undefined;
  }
}
import { loadSample, type SampleId, type SceneMode } from '../api/scene';
import { AccessibleButton } from '../components/AccessibleButton';
import { LabLoading } from '../components/loading/LabLoading';
import { LabSettings, describeSettings } from '../components/LabSettings';
import { Logo } from '../components/Logo';
import { SpecimenPreview } from '../components/SpecimenPreview';
import { StatusText } from '../components/StatusText';
import type { DiagramScene } from '../core/scene';
import type { Drivers, SpeechRateSetting } from '../drivers';
import { ACCEPTED_IMAGE_TYPES } from '../drivers/camera';
import { processImageFile, type FileSource } from '../flow/capture';
import { getLang, subscribeLang, t } from '../i18n';

interface CaptureProps {
  drivers: Drivers;
  /** The line already spoken on arrival, shown in the status area. */
  initialStatus: string;
  onScene: (
    scene: DiagramScene,
    mode: SceneMode,
    photoUrl?: string,
    source?: 'camera' | 'file' | 'sample',
  ) => void;
  /** Opens the saved-diagrams list. */
  onSavedDiagrams?: () => void;
}

const SAMPLES: ReadonlyArray<{
  id: SampleId;
  labelKey: string;
  specimenKey: string;
}> = [
  { id: 'triangle', labelKey: 'capture.sampleTriangle', specimenKey: 'lab.specimen.triangle' },
  { id: 'sine', labelKey: 'capture.sampleSine', specimenKey: 'lab.specimen.sine' },
  { id: 'barchart', labelKey: 'capture.sampleBarchart', specimenKey: 'lab.specimen.bars' },
];

export function Capture({
  drivers,
  initialStatus,
  onScene,
  onSavedDiagrams,
}: CaptureProps): JSX.Element {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const takeButton = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lifetime = useRef<AbortController>(new AbortController());

  // Subscribe to i18n language store
  const currentLang = useSyncExternalStore(subscribeLang, getLang, getLang);

  // Track speech rate
  const [currentRate, setCurrentRate] = useState<SpeechRateSetting>(() =>
    drivers.speech.getRate ? drivers.speech.getRate() : 'normal',
  );

  useEffect(() => {
    const originalSetRate = drivers.speech.setRate;
    drivers.speech.setRate = (newRate: SpeechRateSetting) => {
      originalSetRate?.call(drivers.speech, newRate);
      setCurrentRate(newRate);
    };
    return () => {
      drivers.speech.setRate = originalSetRate;
    };
  }, [drivers]);

  const activeRate = drivers.speech.getRate ? drivers.speech.getRate() : currentRate;

  useEffect(() => {
    takeButton.current?.focus();
    const controller = new AbortController();
    lifetime.current = controller;
    const photoEl = photoInput.current;
    const fileEl = fileInput.current;
    photoEl?.addEventListener('cancel', handleCancel);
    fileEl?.addEventListener('cancel', handleCancel);
    // Leaving the screen cancels an upload and silences its progress tone.
    return () => {
      controller.abort();
      photoEl?.removeEventListener('cancel', handleCancel);
      fileEl?.removeEventListener('cancel', handleCancel);
    };
  }, []);

  const say = (text: string): void => {
    drivers.speech.speak(text);
    setStatus(text);
  };

  const handleSettingsClose = (): void => {
    setSettingsOpen(false);
    if (drivers.speech.getRate) {
      setCurrentRate(drivers.speech.getRate());
    }
  };

  // Do not open a picker while an upload is running; say why instead of ignoring the tap.
  const openPicker = (picker: RefObject<HTMLInputElement | null>): void => {
    if (busy || busyRef.current) say(t('capture.busy'));
    else picker.current?.click();
  };

  const handleCancel = (): void => {
    busyRef.current = false;
    setBusy(false);
    takeButton.current?.focus();
  };

  const handleFile = async (
    event: ChangeEvent<HTMLInputElement>,
    source: FileSource,
  ): Promise<void> => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be chosen again
    if (file === undefined) {
      handleCancel();
      return;
    }
    if (busy || busyRef.current) {
      say(t('capture.busy'));
      return;
    }
    const signal = lifetime.current.signal;
    busyRef.current = true;
    setBusy(true);
    const outcome = await processImageFile(file, { audio: drivers.audio, say, signal, source });
    if (signal.aborted) {
      busyRef.current = false;
      return;
    }
    busyRef.current = false;
    setBusy(false);
    if (outcome.kind === 'scene') {
      drivers.audio.playEarcon?.('success');
      let photoUrl: string | undefined;
      try {
        photoUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : undefined;
      } catch {
        photoUrl = undefined;
      }
      onScene(outcome.response.scene, outcome.response.mode, photoUrl, source);
    } else if (outcome.kind !== 'cancelled') {
      drivers.audio.playEarcon?.('error');
      takeButton.current?.focus();
    }
  };

  const handleSample = async (id: SampleId): Promise<void> => {
    if (busy || busyRef.current) {
      say(t('capture.busy'));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    let scene: DiagramScene;
    try {
      scene = await loadSample(id);
      drivers.audio.playEarcon?.('success');
    } catch {
      busyRef.current = false;
      setBusy(false);
      drivers.audio.playEarcon?.('error');
      say(t('capture.errorSample'));
      return;
    }
    if (lifetime.current.signal.aborted) {
      busyRef.current = false;
      return;
    }
    busyRef.current = false;
    setBusy(false);
    onScene(scene, 'ai', undefined, 'sample');
  };

  return (
    <main className="gt-capture" aria-busy={busy}>
      {/* Brand-first header with decorative mark beside real heading & tagline */}
      <header className="gt-capture__header">
        <div className="gt-capture__top-row">
          <div className="gt-capture__brand">
            <Logo variant="mark" decorative height={48} className="gt-capture__brand-logo" />
            <div className="gt-capture__brand-text">
              <h1 className="gt-capture__title">{t('app.name')}</h1>
              <p className="gt-capture__tagline">{t('app.tagline')}</p>
            </div>
          </div>
          <AccessibleButton
            ref={settingsButtonRef}
            type="button"
            className="gt-control gt-capture__button gt-capture__button--settings"
            onClick={() => setSettingsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          >
            {describeSettings(currentLang, activeRate)}
          </AccessibleButton>
        </div>
      </header>

      {/* Progress & Status Card */}
      <div className="gt-capture__status-card">
        <div className="gt-capture__status-row">
          <span className="gt-capture__status-indicator" />
          <StatusText className="gt-capture__status" spoken={drivers.speech.canSpeak}>
            {status}
          </StatusText>
        </div>
        {busy && (
          <LabLoading
            title={t('lab.loading.title')}
            hint={t('lab.loading.hint')}
          />
        )}
      </div>

      {/* Primary & Secondary Capture Actions */}
      <div className="gt-capture__actions">
        <AccessibleButton
          ref={takeButton}
          className="gt-capture__button gt-capture__button--primary"
          onClick={() => openPicker(photoInput)}
        >
          {t('capture.takePhoto')}
        </AccessibleButton>

        <div className="gt-capture__secondary-row">
          <AccessibleButton
            className="gt-capture__button gt-capture__button--secondary"
            onClick={() => openPicker(fileInput)}
          >
            {t('capture.chooseImage')}
          </AccessibleButton>

          <AccessibleButton
            className="gt-capture__button gt-capture__button--saved"
            aria-label={t('capture.savedDiagrams')}
            onClick={onSavedDiagrams}
          >
            {t('capture.savedDiagrams')}
          </AccessibleButton>
        </div>
      </div>

      {/* Sample Diagrams Section & Grid ("Specimen Jars") */}
      <section className="gt-capture__samples-section" aria-labelledby="gt-capture-samples-title">
        <h2 id="gt-capture-samples-title" className="gt-capture__subtitle">
          {t('capture.samples')}
        </h2>
        <div className="gt-capture__samples-grid">
          {SAMPLES.map(({ id, labelKey, specimenKey }) => (
            <AccessibleButton
              key={id}
              className={`gt-capture__button gt-capture__sample-btn gt-capture__sample-btn--${id}`}
              aria-label={t(labelKey)}
              onClick={() => void handleSample(id)}
            >
              <SpecimenPreview id={id} className="gt-capture__sample-preview" />
              <span className="gt-capture__sample-name">{t(specimenKey)}</span>
            </AccessibleButton>
          ))}
        </div>
      </section>

      {/* Modal Lab Settings Sheet */}
      <LabSettings
        open={settingsOpen}
        onClose={handleSettingsClose}
        speak={say}
        drivers={drivers}
        triggerRef={settingsButtonRef}
      />

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void handleFile(e, 'camera')}
        onCancel={handleCancel}
      />
      <input
        ref={fileInput}
        type="file"
        accept={`${ACCEPTED_IMAGE_TYPES.join(',')},application/pdf,.pdf`}
        hidden
        onChange={(e) => void handleFile(e, 'file')}
        onCancel={handleCancel}
      />
    </main>
  );
}
