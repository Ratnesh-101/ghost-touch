/**
 * App — root component and screen state machine:
 * Start → Capture → Explore ⇄ Correct
 * Capture → SavedDiagrams (Task 13) ⇄ Capture.
 *
 * Every screen change is spoken here, inside the event handler that causes it
 * (so the first utterance happens within the user's gesture), and the same
 * text is shown on the next screen. The hidden `#/debug` page (Task 5) shows
 * driver support on a phone.
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { SceneMode } from './api/scene';
import type { DiagramScene } from './core/scene';
import {
  applyAdd,
  makeId,
  savedTitle,
  SAVED_DIAGRAMS_CAP,
  type SavedDiagram,
} from './core/savedDiagrams';
import { createBrowserDrivers, renderSceneThumbnail, type Drivers } from './drivers';
import { DEBUG_HASH, readHash, subscribeHash } from './drivers/hashRoute';
import { capturePrompt } from './flow/start';
import { exploreAnnouncement } from './flow/navigation';
import { getLang, LANG_BCP47, t } from './i18n';
import { Capture } from './screens/Capture';
import { Correct } from './screens/Correct';
import { Debug } from './screens/Debug';
import { Explore } from './screens/Explore';
import { SavedDiagrams } from './screens/SavedDiagrams';
import { Start } from './screens/Start';

type View =
  | { screen: 'start' }
  | { screen: 'capture'; announced: string }
  | { screen: 'explore'; scene: DiagramScene; announced: string }
  | { screen: 'correct'; scene: DiagramScene }
  | { screen: 'saved' };

export function App(): JSX.Element {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => '');
  const [drivers] = useState<Drivers>(() => createBrowserDrivers());
  const [view, setView] = useState<View>({ screen: 'start' });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  if (hash === DEBUG_HASH) return <Debug />;

  // After Start, the vibration warning (if any) was already spoken by the tap.
  const openCapture = (): void => {
    setView({ screen: 'capture', announced: capturePrompt(drivers.haptics.supported) });
  };

  /**
   * Save a diagram entry to the store, evicting oldest unpinned entry if needed.
   * Called inside handleScene after navigation so it doesn't block exploration.
   * All errors are spoken but never prevent exploration.
   */
  const saveDiagram = useCallback(
    async (scene: DiagramScene): Promise<void> => {
      try {
        const listResult = await drivers.diagramStore.list();
        if (!listResult.ok) {
          drivers.speech.speak(t('saved.errorStorageUnavailable'), LANG_BCP47[getLang()]);
          return;
        }

        const existing = listResult.value;
        const thumbnailDataUrl = renderSceneThumbnail(scene);
        const newEntry: SavedDiagram = {
          id: makeId(Date.now(), Math.random),
          createdAt: Date.now(),
          title: savedTitle(scene, getLang()),
          thumbnailDataUrl,
          scene,
          pinned: false,
        };

        const decision = applyAdd(existing, newEntry, SAVED_DIAGRAMS_CAP);
        if (!decision.ok) {
          drivers.speech.speak(t('saved.errorAllPinned'), LANG_BCP47[getLang()]);
          return;
        }

        if (decision.evictedId !== undefined) {
          await drivers.diagramStore.delete(decision.evictedId);
        }

        const putResult = await drivers.diagramStore.put(newEntry);
        if (!putResult.ok) {
          drivers.speech.speak(t('saved.errorSave'), LANG_BCP47[getLang()]);
        }
      } catch {
        drivers.speech.speak(t('saved.errorSave'), LANG_BCP47[getLang()]);
      }
    },
    [drivers],
  );

  const handleScene = (
    scene: DiagramScene,
    mode: SceneMode,
    photo?: string,
    source?: 'camera' | 'file' | 'sample',
  ): void => {
    setPhotoUrl(photo ?? null);
    const announced = exploreAnnouncement(scene, mode);
    drivers.speech.speak(announced, LANG_BCP47[getLang()]);
    setView({ screen: 'explore', scene, announced });
    if (source !== 'sample') {
      void saveDiagram(scene);
    }
  };

  // Coming back from Explore: just the prompt, not the one-time vibration warning.
  const handleBack = (): void => {
    const announced = t('capture.prompt');
    drivers.speech.speak(announced, LANG_BCP47[getLang()]);
    setView({ screen: 'capture', announced });
  };

  const handleCorrect = (): void => {
    if (view.screen !== 'explore') return;
    const intro = t('correct.intro');
    drivers.speech.speak(intro, LANG_BCP47[getLang()]);
    setView({ screen: 'correct', scene: view.scene });
  };

  const handleSaveCorrect = (scene: DiagramScene): void => {
    const announced = exploreAnnouncement(scene, 'ai');
    drivers.speech.speak(announced, LANG_BCP47[getLang()]);
    setView({ screen: 'explore', scene, announced });
  };

  const handleCancelCorrect = (): void => {
    if (view.screen !== 'correct') return;
    const announced = exploreAnnouncement(view.scene, 'ai');
    setView({ screen: 'explore', scene: view.scene, announced });
  };

  const openSaved = (): void => {
    const msg = t('saved.heading');
    drivers.speech.speak(msg, LANG_BCP47[getLang()]);
    setView({ screen: 'saved' });
  };

  const handleSavedBack = (): void => {
    const announced = t('capture.prompt');
    drivers.speech.speak(announced, LANG_BCP47[getLang()]);
    setView({ screen: 'capture', announced });
  };

  const handleSavedOpen = (scene: DiagramScene, title: string): void => {
    // Open an offline saved diagram: goes straight to Explore, no network call, no re-save
    const announced = `${title}. ${t('explore.gestureHint')} ${t('explore.backHint')}`;
    drivers.speech.speak(announced, LANG_BCP47[getLang()]);
    setView({ screen: 'explore', scene, announced });
  };

  switch (view.screen) {
    case 'start':
      return <Start drivers={drivers} onBegin={openCapture} />;
    case 'capture':
      return (
        <Capture
          drivers={drivers}
          initialStatus={view.announced}
          onScene={handleScene}
          onSavedDiagrams={openSaved}
        />
      );
    case 'explore':
      return (
        <Explore
          scene={view.scene}
          announced={view.announced}
          drivers={drivers}
          onBack={handleBack}
          onCorrect={handleCorrect}
        />
      );
    case 'correct':
      return (
        <Correct
          scene={view.scene}
          photoUrl={photoUrl}
          drivers={drivers}
          onSave={handleSaveCorrect}
          onCancel={handleCancelCorrect}
        />
      );
    case 'saved':
      return (
        <SavedDiagrams
          diagramStore={drivers.diagramStore}
          speech={drivers.speech}
          onOpen={handleSavedOpen}
          onBack={handleSavedBack}
        />
      );
  }
}
