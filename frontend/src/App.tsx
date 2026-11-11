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
  makeId,
  savedTitle,
  SAVED_DIAGRAMS_CAP,
  type SavedDiagram,
} from './core/savedDiagrams';
import { saveDiagramWithEviction } from './flow/saved';
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
import {
  exploreAnnouncement,
  leaveByBack,
  verifyCaveatForScene,
  type ScreenName,
} from './flow/navigation';
import { joinAnnouncements } from './flow/explore';
import { type VerifyMode } from './verify/verify';
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
import { ShareGate } from './components/ShareGate';
import {
  buildHonestShareAnnouncement,
  honestSharedByLabel,
  sanitizeShareName,
  sanitizeShareTitle,
} from './flow/share';
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

export interface ResolveShareOptions {
  honest?: boolean;
}

/**
 * Pure route resolver for shared diagram links.
 * Returns the resolved screen state, announcements, or error code.
 */
export function resolveShareRoute(
  hash: string,
  isFeatureOn: boolean = isShareEnvOn(),
  options?: ResolveShareOptions,
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
    const useHonest = options?.honest ?? true;

    // R3 sanitization: strip leading checkmarks and "verified"/"certified" from author name
    const cleanName = sanitizeShareName(decoded.verifiedBy);

    // Honest scene announcement with "Title: " prefix and stripped words
    const honestSceneAnnouncement = exploreAnnouncement(
      decoded.scene,
      'shared',
      'shared',
      { honestTitle: true },
    );
    const honestSharedBy = honestSharedByLabel(cleanName);
    const honestSpokenAnnouncement = buildHonestShareAnnouncement({
      sceneAnnouncement: honestSceneAnnouncement,
      verifiedBy: cleanName,
    });

    // Legacy announcement for backward-compatibility with k1 test suite
    const legacySceneAnnouncement = exploreAnnouncement(decoded.scene, 'shared');
    const legacyVerifiedName =
      decoded.verifiedBy.trim() !== '' ? decoded.verifiedBy : t('legacy.verified');
    const legacyVerifiedAnnouncement = t('legacy.verifiedBy').replace('{name}', legacyVerifiedName);
    const legacySpokenAnnouncement = joinShareAnnouncements(
      legacySceneAnnouncement,
      legacyVerifiedAnnouncement,
    );

    return {
      kind: 'explore',
      scene: decoded.scene,
      verified: {
        by: cleanName,
        note: decoded.note,
        at: decoded.verifiedAt,
      },
      sceneAnnouncement: useHonest ? honestSceneAnnouncement : legacySceneAnnouncement,
      verifiedAnnouncement: useHonest ? honestSharedBy : legacyVerifiedAnnouncement,
      spokenAnnouncement: useHonest ? honestSpokenAnnouncement : legacySpokenAnnouncement,
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
 * Pure route resolver for shared diagram links with R1/R3 honesty enforcement.
 */
export function resolveHonestShareRoute(
  hash: string,
  isFeatureOn: boolean = isShareEnvOn(),
): ShareRouteResolution {
  return resolveShareRoute(hash, isFeatureOn, { honest: true });
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
    if (speech.canSpeak) {
      speech.speak(resolution.errorMessage, langBcp47);
    }
  }
}

export interface SharedExploreViewState {
  screen: 'explore';
  scene: DiagramScene;
  announced: string;
  verified: { by: string; note: string; at: string };
  fromShare: true;
}

/**
 * Handles user activation tap on the share gate:
 * Unlocks audio, plays greeting earcon, speaks diagram announcements,
 * and transitions view state to Explore.
 */
export function openSharedDiagram(
  drivers: Drivers,
  resolution: Extract<ShareRouteResolution, { kind: 'explore' }>,
  langBcp47: string,
): SharedExploreViewState {
  drivers.audio.unlock();
  drivers.audio.playEarcon?.('start');
  speakShareAnnouncements(drivers.speech, resolution, langBcp47);
  return {
    screen: 'explore',
    scene: resolution.scene,
    announced: resolution.sceneAnnouncement,
    verified: resolution.verified,
    fromShare: true,
  };
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
  | { screen: 'shareError'; code: ShareErrorCode; announced: string }
  | {
      screen: 'shareGate';
      resolution: Extract<ShareRouteResolution, { kind: 'explore' }>;
    };

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
    const resolution = resolveShareRoute(currentHash, isShareEnvOn(), { honest: true });
    if (resolution.kind === 'explore') {
      return {
        screen: 'shareGate',
        resolution,
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
  const lastProcessedHash = useRef<string | null>(readHash());
  // The hash handler runs after the browser has already moved the URL, so it reads the screen
  // that is showing through a ref instead of a stale closure.
  const viewRef = useRef(view);
  viewRef.current = view;
  // The Teacher editor reports unsaved changes here so Back can ask before discarding them.
  const teachDirty = useRef(false);
  const setTeachDirty = useCallback((dirty: boolean): void => {
    teachDirty.current = dirty;
  }, []);
  const correctDirty = useRef(false);
  const pendingStorageError = useRef<string | null>(null);
  const lastSavedDiagramId = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const makeExploreAnnounced = useCallback((baseAnnounced: string): string => {
    const err = pendingStorageError.current;
    pendingStorageError.current = null;
    return err ? `${baseAnnounced} ${err}` : baseAnnounced;
  }, []);

  const setStorageError = useCallback((errKey: string): void => {
    const err = t(errKey);
    setView((prev) => {
      if (prev.screen === 'explore') {
        pendingStorageError.current = null;
        return { ...prev, announced: `${prev.announced} ${err}` };
      }
      pendingStorageError.current = err;
      return prev;
    });
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

    const resolution = resolveShareRoute(hash, isShareEnvOn(), { honest: true });
    if (resolution.kind === 'explore') {
      setView({
        screen: 'shareGate',
        resolution,
      });
    } else if (resolution.kind === 'error') {
      if (drivers.speech.canSpeak) {
        speakShareAnnouncements(drivers.speech, resolution, LANG_BCP47[currentLang]);
      }
      setView({
        screen: 'shareError',
        code: resolution.code,
        announced: resolution.errorMessage,
      });
    } else if (hash === '' || hash === '#') {
      // Back from `#/teach`, a shared diagram, the share gate or the share error screen.
      const current = viewRef.current;
      const fromShare =
        (current.screen === 'explore' && current.fromShare === true) ||
        current.screen === 'shareGate';
      const leaving: ScreenName | null =
        current.screen === 'teach' ||
        current.screen === 'shareError' ||
        current.screen === 'shareGate'
          ? current.screen
          : fromShare
            ? 'explore'
            : null;
      if (leaving !== null) {
        const hasScene = Boolean(lastExploreScene.current);
        const step = leaveByBack(leaving, {
          dirty: teachDirty.current,
          correctDirty: correctDirty.current,
          fromShare,
          hasScene,
        });
        if (step.needsConfirm) {
          drivers.speech.speak(t('teach.confirmLeave'), LANG_BCP47[currentLang]);
          const confirmed =
            typeof window !== 'undefined' && typeof window.confirm === 'function'
              ? window.confirm(t('teach.confirmLeave'))
              : true;
          if (!confirmed) {
            // Stay in the editor: put the URL back.
            window.location.hash = TEACH_HASH;
            drivers.speech.speak(t('teach.stayingInEditor'), LANG_BCP47[currentLang]);
            document.querySelector<HTMLElement>('.gt-teach__title')?.focus();
            return;
          }
        }
        if (step.next === 'explore' && lastExploreScene.current) {
          const scene = lastExploreScene.current;
          const announced = exploreAnnouncement(scene, 'ai');
          drivers.speech.speak(announced, LANG_BCP47[currentLang]);
          setView({ screen: 'explore', scene, announced });
        } else {
          drivers.speech.speak(t(step.announceKey), LANG_BCP47[currentLang]);
          setView({ screen: 'start' });
        }
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
        const step = leaveByBack('correct', {
          dirty: teachDirty.current,
          correctDirty: correctDirty.current,
          fromShare: false,
        });
        if (step.needsConfirm) {
          drivers.speech.speak(t('correct.confirmLeave'), LANG_BCP47[currentLang]);
          const confirmed =
            typeof window !== 'undefined' && typeof window.confirm === 'function'
              ? window.confirm(t('correct.confirmLeave'))
              : true;
          if (!confirmed) {
            pushCorrectEntry();
            drivers.speech.speak(t('correct.stayingInEditor'), LANG_BCP47[currentLang]);
            document.querySelector<HTMLElement>('.gt-correct__title')?.focus();
            return;
          }
        }
        correctDirty.current = false;
        leaveCorrectEntry();
        const baseAnnounced = exploreAnnouncement(scene, 'ai');
        drivers.speech.speak(baseAnnounced, LANG_BCP47[currentLang]);
        setView({
          screen: 'explore',
          scene,
          announced: makeExploreAnnounced(baseAnnounced),
        });
      });
    }
  }, [view, drivers, currentLang, makeExploreAnnounced]);

  // After Start, the vibration warning (if any) was already spoken by the tap.
  const openCapture = (): void => {
    setView({ screen: 'capture', announced: capturePrompt(drivers.haptics.supported) });
  };

  /**
   * Save a diagram entry to the store, evicting oldest unpinned entry if needed.
   * Called inside handleScene after navigation so it doesn't block exploration.
   * GT-06: Storage failures update status text only; never speak or cancel exploration.
   * R5-03 + R5-05: Serialised via promise chain and tracks entry ID to prevent duplication
   * and preserve pinned/createdAt on in-place updates.
   */
  const saveDiagram = useCallback(
    (
      scene: DiagramScene,
      explicitTarget?: string | DiagramScene | null,
    ): Promise<void> => {
      const task = async (): Promise<void> => {
        try {
          const listResult = await drivers.diagramStore.list();
          if (!listResult.ok) {
            setStorageError('saved.errorStorageUnavailable');
            return;
          }

          const existing = listResult.value;
          let targetId =
            typeof explicitTarget === 'string'
              ? explicitTarget
              : explicitTarget === null
                ? null
                : lastSavedDiagramId.current;

          if (!targetId && explicitTarget && typeof explicitTarget === 'object') {
            const prev = existing.find(
              (e) =>
                e.scene === explicitTarget ||
                JSON.stringify(e.scene) === JSON.stringify(explicitTarget),
            );
            if (prev) targetId = prev.id;
          }

          const matchingEntry = targetId
            ? existing.find((e) => e.id === targetId)
            : undefined;

          const thumbnailDataUrl = renderSceneThumbnail(scene);
          const entryToSave: SavedDiagram = matchingEntry
            ? {
                ...matchingEntry,
                title: savedTitle(scene, currentLang),
                thumbnailDataUrl,
                scene,
              }
            : {
                id: makeId(Date.now(), Math.random),
                createdAt: Date.now(),
                title: savedTitle(scene, currentLang),
                thumbnailDataUrl,
                scene,
                pinned: false,
              };

          const result = await saveDiagramWithEviction(
            drivers.diagramStore,
            existing,
            entryToSave,
            SAVED_DIAGRAMS_CAP,
          );
          if (!result.ok) {
            const key =
              result.error === 'all_pinned'
                ? 'saved.errorAllPinned'
                : 'saved.errorSave';
            setStorageError(key);
            return;
          }

          lastSavedDiagramId.current = entryToSave.id;
        } catch {
          setStorageError('saved.errorSave');
        }
      };

      const chained = saveQueue.current.then(task, task);
      saveQueue.current = chained;
      return chained;
    },
    [drivers, currentLang, setStorageError],
  );

  const handleOpenSharedDiagram = (
    resolution: Extract<ShareRouteResolution, { kind: 'explore' }>,
  ): void => {
    lastExploreScene.current = resolution.scene;
    setView(openSharedDiagram(drivers, resolution, LANG_BCP47[currentLang]));
  };

  const handleScene = (
    scene: DiagramScene,
    mode: SceneMode,
    photo?: string,
    source?: 'camera' | 'file' | 'sample',
  ): void => {
    updatePhotoUrl(photo ?? null);
    lastExploreScene.current = scene;
    lastSavedDiagramId.current = null;
    const verifyMode: VerifyMode = source === 'sample' ? 'sample' : mode;
    const baseAnnounced = exploreAnnouncement(scene, mode, verifyMode);
    drivers.speech.speak(baseAnnounced, LANG_BCP47[currentLang]);
    setView({
      screen: 'explore',
      scene,
      announced: makeExploreAnnounced(baseAnnounced),
    });
    if (source !== 'sample') {
      void saveDiagram(scene, null);
    }
  };

  // Coming back from Explore: just the prompt, not the one-time vibration warning.
  // When opened via share link, goes back to start and clears hash via history.replaceState.
  const handleBack = (): void => {
    updatePhotoUrl(null);
    if ((view.screen === 'explore' && view.fromShare) || view.screen === 'shareGate') {
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

  const handleSaveCorrect = (scene: DiagramScene, notice?: string): void => {
    correctDirty.current = false;
    leaveCorrectEntry();
    lastExploreScene.current = scene;
    const exploreMsg = exploreAnnouncement(scene, 'ai');
    const prefix = notice ?? t('correct.saved');
    const spokenAnnounced = `${prefix} ${exploreMsg}`;
    drivers.speech.speak(spokenAnnounced, LANG_BCP47[currentLang]);
    setView({
      screen: 'explore',
      scene,
      announced: makeExploreAnnounced(spokenAnnounced),
    });
    void saveDiagram(scene);
  };

  const handleCancelCorrect = (): void => {
    if (view.screen !== 'correct') return;
    correctDirty.current = false;
    leaveCorrectEntry();
    const baseAnnounced = exploreAnnouncement(view.scene, 'ai');
    drivers.speech.speak(baseAnnounced, LANG_BCP47[currentLang]);
    setView({
      screen: 'explore',
      scene: view.scene,
      announced: makeExploreAnnounced(baseAnnounced),
    });
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

  const handleSavedOpen = (scene: DiagramScene, title: string, id?: string): void => {
    replaceSavedEntry();
    updatePhotoUrl(null);
    lastExploreScene.current = scene;
    lastSavedDiagramId.current = id ?? null;
    // Open an offline saved diagram: goes straight to Explore, no network call, no re-save
    const base = `${title}. ${t('explore.gestureHint')} ${t('explore.backHint')}`;
    const caveat = verifyCaveatForScene(scene, 'ai');
    const baseAnnounced = caveat ? joinAnnouncements([base, caveat]) : base;
    drivers.speech.speak(baseAnnounced, LANG_BCP47[currentLang]);
    setView({
      screen: 'explore',
      scene,
      announced: makeExploreAnnounced(baseAnnounced),
    });
  };

  const handleTeachBack = (): void => {
    teachDirty.current = false;
    lastProcessedHash.current = '';
    clearHash();
    if (lastExploreScene.current) {
      const scene = lastExploreScene.current;
      const baseAnnounced = exploreAnnouncement(scene, 'ai');
      drivers.speech.speak(baseAnnounced, LANG_BCP47[currentLang]);
      setView({
        screen: 'explore',
        scene,
        announced: makeExploreAnnounced(baseAnnounced),
      });
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
          canSpeak={drivers.speech.canSpeak}
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
          onDirtyChange={(dirty) => {
            correctDirty.current = dirty;
          }}
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
    case 'shareGate':
      return (
        <ShareGate
          onOpen={() => handleOpenSharedDiagram(view.resolution)}
          title={
            typeof view.resolution.scene.title === 'string'
              ? sanitizeShareTitle(view.resolution.scene.title)
              : undefined
          }
          sharedBy={view.resolution.verified.by}
        />
      );
  }
}
