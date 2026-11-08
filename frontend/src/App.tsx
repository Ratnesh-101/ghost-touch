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
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type JSX } from 'react';
import { warmBackend } from './api/health';
import type { SceneMode } from './api/scene';
import { isShareEnvOn } from './config/features';
import type { DiagramScene } from './core/scene';
import {
  applyAdd,
  makeId,
  savedTitle,
  SAVED_DIAGRAMS_CAP,
  type SavedDiagram,
} from './core/savedDiagrams';
import { createBrowserDrivers, renderSceneThumbnail, type Drivers } from './drivers';
import {
  clearHash,
  DEBUG_HASH,
  isTeachHash,
  parseShareHash,
  readHash,
  subscribeHash,
  TEACH_HASH,
} from './drivers/hashRoute';
import {
  leaveCorrectEntry,
  leaveSavedEntry,
  onCorrectBack,
  onSavedBack,
  pushCorrectEntry,
  pushSavedEntry,
  replaceSavedEntry,
} from './drivers/navigation';
import { capturePrompt } from './flow/start';
import { exploreAnnouncement, leaveByBack, type ScreenName } from './flow/navigation';
import { createPhotoUrlTracker, type PhotoUrlTracker } from './flow/capture';
import { isTeacherActive } from './flow/teach';
import { getLang, LANG_BCP47, subscribeLang, t } from './i18n';
import { Capture } from './screens/Capture';
import { Correct } from './screens/Correct';
import { Debug } from './screens/Debug';
import { Explore } from './screens/Explore';
import { SavedDiagrams } from './screens/SavedDiagrams';
import { ShareError as ShareErrorScreen, shareErrorMessage } from './screens/ShareError';
import { Start } from './screens/Start';
import { Teach } from './screens/Teach';
import { decodeShare, ShareError, type ShareErrorCode } from './share';

export type ShareRouteResolution =
  | {
      kind: 'explore';
      scene: DiagramScene;
      verified: { by: string; note: string; at: string };
      sceneAnnouncement: string;
      verifiedAnnouncement: string;
      spokenAnnouncement?: string;
    }
  | { kind: 'error'; code: ShareErrorCode; errorMessage: string }
  | { kind: 'ignored' };

/**
 * Joins scene announcement and verified banner text into a single spoken utterance.
 * Joins with a period and space (". ") while avoiding a double full stop if the scene
 * announcement already ends with terminal punctuation (e.g. "." or Hindi "।").
 */
export function joinShareAnnouncements(
  sceneAnnouncement: string,
  verifiedAnnouncement: string,
): string {
  const scene = sceneAnnouncement.trim();
  const verified = verifiedAnnouncement.trim();
  if (!scene) return verified;
  if (!verified) return scene;

  if (scene.endsWith('.') || scene.endsWith('।') || scene.endsWith('!') || scene.endsWith('?')) {
    const normalizedScene = scene.replace(/\.+$/, '.');
    return `${normalizedScene} ${verified}`;
  }
  return `${scene}. ${verified}`;
}

/**
 * Pure route resolver for shared diagram links.
 * Returns the resolved screen state, announcements, or error code.
 */
export function resolveShareRoute(
  hash: string,
  isFeatureOn: boolean = isShareEnvOn(),
): ShareRouteResolution {
  if (!isFeatureOn) {
    return { kind: 'ignored' };
  }
  const payload = parseShareHash(hash);
  if (payload === null) {
    return { kind: 'ignored' };
  }
  try {
    const decoded = decodeShare(hash);
    const sceneAnnouncement = exploreAnnouncement(decoded.scene, 'ai');
    const verifiedName =
      decoded.verifiedBy.trim() !== '' ? decoded.verifiedBy : t('share.verified');
    const verifiedAnnouncement = t('share.verifiedBy').replace('{name}', verifiedName);
    const spokenAnnouncement = joinShareAnnouncements(sceneAnnouncement, verifiedAnnouncement);
    return {
      kind: 'explore',
      scene: decoded.scene,
      verified: {
        by: decoded.verifiedBy,
        note: decoded.note,
        at: decoded.verifiedAt,
      },
      sceneAnnouncement,
      verifiedAnnouncement,
      spokenAnnouncement,
    };
  } catch (err) {
    const code: ShareErrorCode = err instanceof ShareError ? err.code : 'bad-format';
    const errorMessage = shareErrorMessage(code);
    return {
      kind: 'error',
      code,
      errorMessage,
    };
  }
}

/**
 * Dispatches spoken announcements in exact contract order:
 * Speaks ONE utterance that joins the scene announcement and the verified line,
 * avoiding speech driver cancellation of back-to-back utterances.
 */
export function speakShareAnnouncements(
  speech: Drivers['speech'],
  resolution: ShareRouteResolution,
  langBcp47: string,
): void {
  if (resolution.kind === 'explore') {
    const utterance =
      resolution.spokenAnnouncement ??
      joinShareAnnouncements(resolution.sceneAnnouncement, resolution.verifiedAnnouncement);
    speech.speak(utterance, langBcp47);
  } else if (resolution.kind === 'error') {
    speech.speak(resolution.errorMessage, langBcp47);
  }
}

type View =
  | { screen: 'start' }
  | { screen: 'capture'; announced: string }
  | {
      screen: 'explore';
      scene: DiagramScene;
      announced: string;
      verified?: { by: string; note?: string; at?: string };
      fromShare?: boolean;
    }
  | { screen: 'correct'; scene: DiagramScene }
  | { screen: 'saved' }
  | { screen: 'teach'; scene?: DiagramScene }
  | { screen: 'shareError'; code: ShareErrorCode; announced: string };

export function App(): JSX.Element {
  const hash = useSyncExternalStore(subscribeHash, readHash, readHash);
  const currentLang = useSyncExternalStore(subscribeLang, getLang, getLang);
  const [drivers] = useState<Drivers>(() => createBrowserDrivers());
  const lastExploreScene = useRef<DiagramScene | null>(null);
  const [view, setView] = useState<View>(() => {
    const currentHash = readHash();
    if (isTeachHash(currentHash) && isTeacherActive()) {
      return { screen: 'teach' };
    }
    const resolution = resolveShareRoute(currentHash);
    if (resolution.kind === 'explore') {
      lastExploreScene.current = resolution.scene;
      return {
        screen: 'explore',
        scene: resolution.scene,
        announced: resolution.sceneAnnouncement,
        verified: resolution.verified,
        fromShare: true,
      };
    }
    if (resolution.kind === 'error') {
      return {
        screen: 'shareError',
        code: resolution.code,
        announced: resolution.errorMessage,
      };
    }
    return { screen: 'start' };
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoTracker = useRef<PhotoUrlTracker>(createPhotoUrlTracker());
  const lastProcessedHash = useRef<string | null>(null);
  // The hash handler runs after the browser has already moved the URL, so it reads the screen
  // that is showing through a ref instead of a stale closure.
  const viewRef = useRef(view);
  viewRef.current = view;
  // The Teacher editor reports unsaved changes here so Back can ask before discarding them.
  const teachDirty = useRef(false);
  const setTeachDirty = useCallback((dirty: boolean): void => {
    teachDirty.current = dirty;
  }, []);

  const updatePhotoUrl = useCallback((newUrl: string | null): void => {
    photoTracker.current.update(newUrl);
    setPhotoUrl(newUrl);
  }, []);

  useEffect(() => {
    return () => {
      photoTracker.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (isShareEnvOn() && (parseShareHash(readHash()) !== null || isTeachHash(readHash()))) {
      return;
    }
    void warmBackend();
  }, []);

  useEffect(() => {
    if (hash === lastProcessedHash.current) {
      return;
    }
    lastProcessedHash.current = hash;

    if (isTeachHash(hash)) {
      if (isTeacherActive()) {
        setView((prev) => {
          if (prev.screen === 'teach') return prev;
          const scene = prev.screen === 'explore' ? prev.scene : lastExploreScene.current ?? undefined;
          return { screen: 'teach', scene };
        });
      }
      return;
    }

    const resolution = resolveShareRoute(hash, isShareEnvOn());
    if (resolution.kind === 'explore') {
      lastExploreScene.current = resolution.scene;
      speakShareAnnouncements(drivers.speech, resolution, LANG_BCP47[currentLang]);
      setView({
        screen: 'explore',
        scene: resolution.scene,
        announced: resolution.sceneAnnouncement,
        verified: resolution.verified,
        fromShare: true,
      });
    } else if (resolution.kind === 'error') {
      speakShareAnnouncements(drivers.speech, resolution, LANG_BCP47[currentLang]);
      setView({
        screen: 'shareError',
        code: resolution.code,
        announced: resolution.errorMessage,
      });
    } else if (hash === '' || hash === '#') {
      // Back from `#/teach`, a shared diagram or the share error screen. This used to drop to
      // Start in silence and throw away unsaved Teacher edits (CORE-01, Requirement 17.1).
      const current = viewRef.current;
      const fromShare = current.screen === 'explore' && current.fromShare === true;
      const leaving: ScreenName | null =
        current.screen === 'teach' || current.screen === 'shareError'
          ? current.screen
          : fromShare
            ? 'explore'
            : null;
      if (leaving !== null) {
        const step = leaveByBack(leaving, { dirty: teachDirty.current, fromShare });
        if (step.needsConfirm && !window.confirm(t('teach.confirmLeave'))) {
          // Stay in the editor: put the URL back.
          window.location.hash = TEACH_HASH;
          return;
        }
        drivers.speech.speak(t(step.announceKey), LANG_BCP47[currentLang]);
        setView({ screen: 'start' });
      }
    }
  }, [hash, drivers, currentLang]);

  useEffect(() => {
    if (view.screen === 'saved') {
      return onSavedBack(() => {
        const announced = t('capture.prompt');
        drivers.speech.speak(announced, LANG_BCP47[getLang()]);
        setView({ screen: 'capture', announced });
      });
    }
    if (view.screen === 'correct') {
      const scene = view.scene;
      return onCorrectBack(() => {
        const announced = exploreAnnouncement(scene, 'ai');
        setView({ screen: 'explore', scene, announced });
      });
    }
  }, [view, drivers]);

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
          drivers.speech.speak(t('saved.errorStorageUnavailable'), LANG_BCP47[currentLang]);
          return;
        }

        const existing = listResult.value;
        const thumbnailDataUrl = renderSceneThumbnail(scene);
        const newEntry: SavedDiagram = {
          id: makeId(Date.now(), Math.random),
          createdAt: Date.now(),
          title: savedTitle(scene, currentLang),
          thumbnailDataUrl,
          scene,
          pinned: false,
        };

        const decision = applyAdd(existing, newEntry, SAVED_DIAGRAMS_CAP);
        if (!decision.ok) {
          drivers.speech.speak(t('saved.errorAllPinned'), LANG_BCP47[currentLang]);
          return;
        }

        if (decision.evictedId !== undefined) {
          await drivers.diagramStore.delete(decision.evictedId);
        }

        const putResult = await drivers.diagramStore.put(newEntry);
        if (!putResult.ok) {
          drivers.speech.speak(t('saved.errorSave'), LANG_BCP47[currentLang]);
        }
      } catch {
        drivers.speech.speak(t('saved.errorSave'), LANG_BCP47[currentLang]);
      }
    },
    [drivers, currentLang],
  );

  const handleScene = (
    scene: DiagramScene,
    mode: SceneMode,
    photo?: string,
    source?: 'camera' | 'file' | 'sample',
  ): void => {
    updatePhotoUrl(photo ?? null);
    lastExploreScene.current = scene;
    const announced = exploreAnnouncement(scene, mode);
    drivers.speech.speak(announced, LANG_BCP47[currentLang]);
    setView({ screen: 'explore', scene, announced });
    if (source !== 'sample') {
      void saveDiagram(scene);
    }
  };

  // Coming back from Explore: just the prompt, not the one-time vibration warning.
  // When opened via share link, goes back to start and clears hash via history.replaceState.
  const handleBack = (): void => {
    updatePhotoUrl(null);
    if (view.screen === 'explore' && view.fromShare) {
      clearHash();
      const announced = t('start.intro');
      drivers.speech.speak(announced, LANG_BCP47[currentLang]);
      setView({ screen: 'start' });
      return;
    }
    const announced = t('capture.prompt');
    drivers.speech.speak(announced, LANG_BCP47[currentLang]);
    setView({ screen: 'capture', announced });
  };

  const handleGoToStart = (): void => {
    clearHash();
    const announced = t('start.intro');
    drivers.speech.speak(announced, LANG_BCP47[currentLang]);
    setView({ screen: 'start' });
  };

  const handleCorrect = (): void => {
    if (view.screen !== 'explore') return;
    pushCorrectEntry();
    const intro = t('correct.intro');
    drivers.speech.speak(intro, LANG_BCP47[currentLang]);
    setView({ screen: 'correct', scene: view.scene });
  };

  const handleSaveCorrect = (scene: DiagramScene): void => {
    leaveCorrectEntry();
    const announced = exploreAnnouncement(scene, 'ai');
    drivers.speech.speak(announced, LANG_BCP47[currentLang]);
    setView({ screen: 'explore', scene, announced });
  };

  const handleCancelCorrect = (): void => {
    if (view.screen !== 'correct') return;
    leaveCorrectEntry();
    const announced = exploreAnnouncement(view.scene, 'ai');
    setView({ screen: 'explore', scene: view.scene, announced });
  };

  const openSaved = (): void => {
    pushSavedEntry();
    const msg = t('saved.heading');
    drivers.speech.speak(msg, LANG_BCP47[currentLang]);
    setView({ screen: 'saved' });
  };

  const handleSavedBack = (): void => {
    leaveSavedEntry();
    const announced = t('capture.prompt');
    drivers.speech.speak(announced, LANG_BCP47[currentLang]);
    setView({ screen: 'capture', announced });
  };

  const handleSavedOpen = (scene: DiagramScene, title: string): void => {
    replaceSavedEntry();
    updatePhotoUrl(null);
    lastExploreScene.current = scene;
    // Open an offline saved diagram: goes straight to Explore, no network call, no re-save
    const announced = `${title}. ${t('explore.gestureHint')} ${t('explore.backHint')}`;
    drivers.speech.speak(announced, LANG_BCP47[currentLang]);
    setView({ screen: 'explore', scene, announced });
  };

  const handleTeachBack = (): void => {
    clearHash();
    if (lastExploreScene.current) {
      const scene = lastExploreScene.current;
      const announced = exploreAnnouncement(scene, 'ai');
      drivers.speech.speak(announced, LANG_BCP47[currentLang]);
      setView({ screen: 'explore', scene, announced });
    } else {
      const announced = t('start.intro');
      drivers.speech.speak(announced, LANG_BCP47[currentLang]);
      setView({ screen: 'start' });
    }
  };

  // Every hook above runs on every render. Returning earlier crashed React (error #300) when
  // `#/debug` was opened while the app was running (found by the round 2 CSP browser check).
  if (hash === DEBUG_HASH) return <Debug />;

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
          verified={view.verified}
        />
      );
    case 'shareError':
      return (
        <ShareErrorScreen
          code={view.code}
          onGoToStart={handleGoToStart}
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
    case 'teach':
      return (
        <Teach
          initialScene={view.scene ?? lastExploreScene.current ?? undefined}
          currentExploreScene={lastExploreScene.current}
          drivers={drivers}
          onBack={handleTeachBack}
          onDirtyChange={setTeachDirty}
        />
      );
  }
}
