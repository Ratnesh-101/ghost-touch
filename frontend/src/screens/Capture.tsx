/**
 * Capture — take a photo, choose an image (photo or screenshot), or open a
 * bundled sample. Samples never touch the network (Requirement 2.4).
 *
 * Behaviour lives in `flow/capture.ts`; this component wires controls to it,
 * mirrors every spoken line into a visible `aria-live` status, and moves
 * focus back to "Take photo" after a failure.
 */
import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { loadSample, type SampleId, type SceneMode } from '../api/scene';
import { AccessibleButton } from '../components/AccessibleButton';
import { StatusText } from '../components/StatusText';
import type { DiagramScene } from '../core/scene';
import type { Drivers } from '../drivers';
import { ACCEPTED_IMAGE_TYPES } from '../drivers/camera';
import { processImageFile, type FileSource } from '../flow/capture';
import { t } from '../i18n';

interface CaptureProps {
  drivers: Drivers;
  /** The line already spoken on arrival, shown in the status area. */
  initialStatus: string;
  onScene: (scene: DiagramScene, mode: SceneMode) => void;
}

const SAMPLES: ReadonlyArray<{ id: SampleId; labelKey: string }> = [
  { id: 'triangle', labelKey: 'capture.sampleTriangle' },
  { id: 'sine', labelKey: 'capture.sampleSine' },
  { id: 'barchart', labelKey: 'capture.sampleBarchart' },
];

export function Capture({ drivers, initialStatus, onScene }: CaptureProps): JSX.Element {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const takeButton = useRef<HTMLButtonElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lifetime = useRef<AbortController>(new AbortController());

  useEffect(() => {
    takeButton.current?.focus();
    const controller = new AbortController();
    lifetime.current = controller;
    // Leaving the screen cancels an upload and silences its progress tone.
    return () => controller.abort();
  }, []);

  const say = (text: string): void => {
    drivers.speech.speak(text);
    setStatus(text);
  };

  // Do not open a picker while an upload is running; say why instead of ignoring the tap.
  const openPicker = (picker: RefObject<HTMLInputElement>): void => {
    if (busy) say(t('capture.busy'));
    else picker.current?.click();
  };

  const handleFile = async (
    event: ChangeEvent<HTMLInputElement>,
    source: FileSource,
  ): Promise<void> => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be chosen again
    if (file === undefined) return;
    if (busy) {
      say(t('capture.busy'));
      return;
    }
    const signal = lifetime.current.signal;
    setBusy(true);
    const outcome = await processImageFile(file, { audio: drivers.audio, say, signal, source });
    if (signal.aborted) return;
    setBusy(false);
    if (outcome.kind === 'scene') onScene(outcome.response.scene, outcome.response.mode);
    else if (outcome.kind !== 'cancelled') takeButton.current?.focus();
  };

  const handleSample = async (id: SampleId): Promise<void> => {
    if (busy) {
      say(t('capture.busy'));
      return;
    }
    let scene: DiagramScene;
    try {
      scene = await loadSample(id);
    } catch {
      say(t('capture.errorSample'));
      return;
    }
    onScene(scene, 'ai');
  };

  return (
    <main className="gt-capture" aria-busy={busy}>
      <h1 className="gt-capture__title">{t('app.name')}</h1>
      <StatusText className="gt-capture__status" spoken={drivers.speech.canSpeak}>
        {status}
      </StatusText>
      <AccessibleButton
        ref={takeButton}
        className="gt-capture__button"
        onClick={() => openPicker(photoInput)}
      >
        {t('capture.takePhoto')}
      </AccessibleButton>
      <AccessibleButton className="gt-capture__button" onClick={() => openPicker(fileInput)}>
        {t('capture.chooseImage')}
      </AccessibleButton>
      <h2 className="gt-capture__subtitle">{t('capture.samples')}</h2>
      {SAMPLES.map(({ id, labelKey }) => (
        <AccessibleButton key={id} className="gt-capture__button" onClick={() => void handleSample(id)}>
          {t(labelKey)}
        </AccessibleButton>
      ))}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void handleFile(e, 'camera')}
      />
      <input
        ref={fileInput}
        type="file"
        accept={`${ACCEPTED_IMAGE_TYPES.join(',')},application/pdf`}
        hidden
        onChange={(e) => void handleFile(e, 'file')}
      />
    </main>
  );
}
