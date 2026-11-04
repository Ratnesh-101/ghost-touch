/**
 * App — root component and screen state machine:
 * Start → Capture → Explore ⇄ Correct
 *
 * Every screen change is spoken here, inside the event handler that causes it
 * (so the first utterance happens within the user's gesture), and the same
 * text is shown on the next screen. The hidden `#/debug` page (Task 5) shows
 * driver support on a phone.
 */
import { useState, useSyncExternalStore, type JSX } from 'react';
import type { SceneMode } from './api/scene';
import type { DiagramScene } from './core/scene';
import { createBrowserDrivers, type Drivers } from './drivers';
import { DEBUG_HASH, readHash, subscribeHash } from './drivers/hashRoute';
import { capturePrompt } from './flow/start';
import { exploreAnnouncement } from './flow/navigation';
import { getLang, LANG_BCP47, t } from './i18n';
import { Capture } from './screens/Capture';
import { Correct } from './screens/Correct';
import { Debug } from './screens/Debug';
import { Explore } from './screens/Explore';
import { Start } from './screens/Start';

type View =
  | { screen: 'start' }
  | { screen: 'capture'; announced: string }
  | { screen: 'explore'; scene: DiagramScene; announced: string }
  | { screen: 'correct'; scene: DiagramScene };

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

  const handleScene = (scene: DiagramScene, mode: SceneMode, photo?: string): void => {
    setPhotoUrl(photo ?? null);
    const announced = exploreAnnouncement(scene, mode);
    drivers.speech.speak(announced, LANG_BCP47[getLang()]);
    setView({ screen: 'explore', scene, announced });
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

  switch (view.screen) {
    case 'start':
      return <Start drivers={drivers} onBegin={openCapture} />;
    case 'capture':
      return <Capture drivers={drivers} initialStatus={view.announced} onScene={handleScene} />;
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
  }
}
