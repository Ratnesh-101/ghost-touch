/**
 * App — root component and screen state machine:
 * Start → Capture → Explore (Task 7 replaces the stub) ⇄ Capture.
 *
 * Every screen change is spoken here, inside the event handler that causes it
 * (so the first utterance happens within the user's gesture), and the same
 * text is shown on the next screen. The hidden `#/debug` page (Task 5) shows
 * driver support on a phone.
 */
import { useState, useSyncExternalStore } from 'react';
import type { SceneMode } from './api/scene';
import type { DiagramScene } from './core/scene';
import { createBrowserDrivers, type Drivers } from './drivers';
import { DEBUG_HASH, readHash, subscribeHash } from './drivers/hashRoute';
import { capturePrompt } from './flow/start';
import { exploreAnnouncement } from './flow/navigation';
import { t } from './i18n';
import { Capture } from './screens/Capture';
import { Debug } from './screens/Debug';
import { Explore } from './screens/Explore';
import { Start } from './screens/Start';

type View =
  | { screen: 'start' }
  | { screen: 'capture'; announced: string }
  | { screen: 'explore'; scene: DiagramScene; announced: string };

export function App(): JSX.Element {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => '');
  const [drivers] = useState<Drivers>(() => createBrowserDrivers());
  const [view, setView] = useState<View>({ screen: 'start' });

  if (hash === DEBUG_HASH) return <Debug />;

  // After Start, the vibration warning (if any) was already spoken by the tap.
  const openCapture = (): void => {
    setView({ screen: 'capture', announced: capturePrompt(drivers.haptics.supported) });
  };

  const handleScene = (scene: DiagramScene, mode: SceneMode): void => {
    const announced = exploreAnnouncement(scene, mode);
    drivers.speech.speak(announced);
    setView({ screen: 'explore', scene, announced });
  };

  // Coming back from Explore: just the prompt, not the one-time vibration warning.
  const handleBack = (): void => {
    const announced = t('capture.prompt');
    drivers.speech.speak(announced);
    setView({ screen: 'capture', announced });
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
        />
      );
  }
}
