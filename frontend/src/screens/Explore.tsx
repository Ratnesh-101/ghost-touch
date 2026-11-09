/**
 * Explore screen — feel STEM diagrams by touch using relative cursor and haptic engine.
 *
 * Works with TalkBack on (pass-through gesture: double-tap, hold and drag)
 * and TalkBack off (direct touch or same gesture).
 *
 * Pure decisions live in `flow/explore.ts`, `flow/ask.ts`, and `flow/commands.ts`;
 * browser APIs live in `drivers/` (navigation history, canvas context & DOM events here).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type JSX, type PointerEvent } from 'react';
import { AccessibleButton } from '../components/AccessibleButton';
import { Spark } from '../components/lab/Spark';
import { SettingsLauncher } from '../components/SettingsLauncher';
import { StatusText } from '../components/StatusText';
import { VerifiedBanner } from '../components/VerifiedBanner';
import {
  makeViewport,
  toNorm,
  toScreen,
  type ScreenPoint,
  type Viewport,
} from '../core/geometry';
import type { DiagramScene } from '../core/scene';
import { runEffects, type Drivers } from '../drivers';
import { leaveExploreEntry, onBack as subscribeBack, pushExploreEntry } from '../drivers/navigation';
import { askErrorMessage, AskManager, LISTENING_BEEP_HZ, LISTENING_BEEP_MS, type AskOutcome } from '../flow/ask';
import type { GuideTarget } from '../api/ask';
import { isGuideActive } from '../config/features';
import { GuideController } from '../flow/guide';
import { resolveTarget } from '../guide';
import { executeExploreCommand, parseExploreCommand } from '../flow/commands';
import {
  CENTRE_TICK_MS,
  checkCentreTick,
  checkTwoFingerLongPress,
  checkTwoFingerSwipeDown,
  initialAxisState,
  initialCentreTickState,
  initialState,
  mergeAnnouncements,
  processPointerMove,
  rearmCentreTick,
  seedAxisState,
  step,
  TWO_FINGER_LONG_PRESS_MS,
  TWO_FINGER_MAX_MOVE_PX,
  type AxisTrackerState,
  type CentreTickState,
  type EngineState,
  type PointerHistory,
} from '../flow/explore';
import { canvasAriaLabel, sceneName } from '../flow/navigation';
import { getLang, subscribeLang, LANG_BCP47, t } from '../i18n';
import {
  markAlivePlayed,
  markReturningFromCorrect,
  resetAliveForTesting,
  shouldPlayAlive,
} from '../flow/alive';

export { resetAliveForTesting };

export interface PointerPromotionResult {
  promotedPointerId: number | null;
  promotedCoords: ScreenPoint | null;
}

/**
 * Promotes the oldest surviving pointer to primary when the active primary pointer lifts (Finding 14, Requirement 4.8).
 * Pure helper for unit testing and screen state tracking.
 */
export function promoteOldestPointer(
  activePointers: Map<number, PointerHistory>,
  liftedPointerId: number,
  currentPrimaryId: number | null,
): PointerPromotionResult {
  activePointers.delete(liftedPointerId);
  if (liftedPointerId !== currentPrimaryId) {
    return { promotedPointerId: currentPrimaryId, promotedCoords: null };
  }
  if (activePointers.size === 0) {
    return { promotedPointerId: null, promotedCoords: null };
  }
  const nextEntry = activePointers.entries().next().value as [number, PointerHistory] | undefined;
  if (!nextEntry) {
    return { promotedPointerId: null, promotedCoords: null };
  }
  const [nextId, history] = nextEntry;
  return {
    promotedPointerId: nextId,
    promotedCoords: { x: history.current.x, y: history.current.y },
  };
}

/**
 * Self-heals the tracked primary pointer id if it was orphaned
 * without a pointercancel/pointerup event (GT-04).
 */
export function selfHealPrimaryPointer(
  primaryId: number | null,
  activePointers: Map<number, unknown>,
): number | null {
  if (primaryId !== null && !activePointers.has(primaryId)) {
    return null;
  }
  return primaryId;
}

/**
 * Determines whether the Explore canvas aria-label should be suppressed to prevent
 * simultaneous speech collisions with Web Speech synthesis (Finding 5, Requirement 13.8).
 */
export function shouldSuppressCanvasAriaLabel(
  canSpeak: boolean,
  announced?: string | boolean,
): boolean {
  return canSpeak && Boolean(announced);
}

/**
 * Resolves the accessible label for the Explore canvas, suppressing it when speech
 * synthesis is active to prevent TalkBack speech collision (Finding 5, Requirement 13.8).
 */
export function resolveCanvasAriaLabel(
  scene: DiagramScene,
  canSpeak: boolean,
  announced?: string | boolean,
): string | undefined {
  if (shouldSuppressCanvasAriaLabel(canSpeak, announced)) {
    return undefined;
  }
  return canvasAriaLabel(scene);
}

/**
 * Caps canvas devicePixelRatio to at most maxDpr (PERF-03).
 * Prevents VRAM exhaustion and LMK tab discards on high-DPI budget phones.
 */
export function computeCanvasDpr(rawDpr: number, maxDpr = 2): number {
  if (!Number.isFinite(rawDpr) || rawDpr <= 0) return 1;
  return Math.min(rawDpr, maxDpr);
}

export interface CanvasRectCache {
  getRect(): DOMRect | null;
  setRect(rect: DOMRect | null): void;
  update(canvas: HTMLCanvasElement | null): DOMRect | null;
  getCoords(clientX: number, clientY: number, canvas: HTMLCanvasElement | null): ScreenPoint;
}

/**
 * Caches canvas bounding rectangle to eliminate layout thrashing from
 * getBoundingClientRect calls on the high-frequency pointermove path (PERF-02).
 */
export function createCanvasRectCache(): CanvasRectCache {
  let cached: DOMRect | null = null;
  return {
    getRect: () => cached,
    setRect: (rect: DOMRect | null) => {
      cached = rect;
    },
    update: (canvas: HTMLCanvasElement | null) => {
      if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return null;
      const rect = canvas.getBoundingClientRect();
      cached = rect;
      return rect;
    },
    getCoords: (
      clientX: number,
      clientY: number,
      canvas: HTMLCanvasElement | null,
    ): ScreenPoint => {
      let rect = cached;
      if (!rect && canvas && typeof canvas.getBoundingClientRect === 'function') {
        rect = canvas.getBoundingClientRect();
        cached = rect;
      }
      if (!rect) return { x: 0, y: 0 };
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
  };
}

interface ExploreProps {
  scene: DiagramScene;
  /** The entry announcement spoken aloud and shown in status text. */
  announced: string;
  drivers: Drivers;
  onBack: () => void;
  onCorrect?: () => void;
  isRaw?: boolean;
  /** Optional override to suppress redundant canvas aria-label (Finding 5). */
  suppressAriaLabel?: boolean;
  /** Optional teacher verification details from a shared diagram link. */
  verified?: {
    by: string;
    note?: string;
    at?: string;
  };
}

export function Explore({
  scene,
  announced,
  drivers,
  onBack,
  onCorrect,
  isRaw,
  suppressAriaLabel,
  verified,
}: ExploreProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRectCache = useRef<CanvasRectCache>(createCanvasRectCache());
  const askButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const engineState = useRef<EngineState>(initialState());
  const centreTickState = useRef<CentreTickState>(initialCentreTickState());
  const axisState = useRef<AxisTrackerState>(initialAxisState());
  const activePointers = useRef<Map<number, PointerHistory>>(new Map());
  const primaryPointerId = useRef<number | null>(null);
  const leaving = useRef(false);
  const viewportRef = useRef<Viewport>(makeViewport(300, 300));
  const firstTouchOffset = useRef<{ dx: number; dy: number } | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafId = useRef<number | null>(null);
  const pendingCursor = useRef<ScreenPoint | null>(null);
  const lastSpokenRef = useRef<string>(announced);
  const cornerIndexRef = useRef<number>(-1);

  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const askManager = useRef<AskManager>(new AskManager());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const askActive = useRef(false);

  const currentLang = useSyncExternalStore(subscribeLang, getLang, getLang);
  const [statusMessage, setStatusMessage] = useState(announced);
  const [isBusy, setIsBusy] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(!drivers.speech.canListen);
  const [questionText, setQuestionText] = useState('');
  const [debugText, setDebugText] = useState(() => t('explore.debugWaiting'));
  const [offeredTarget, setOfferedTarget] = useState<GuideTarget | null>(null);
  const [isGuiding, setIsGuiding] = useState(false);
  const guideController = useRef<GuideController | null>(null);
  const isSpeechActive = drivers.speech.canSpeak && Boolean(announced);
  const [speechAnnounced, setSpeechAnnounced] = useState(
    suppressAriaLabel ?? false,
  );
  const initialAliveRef = useRef<boolean>(shouldPlayAlive(scene));
  const [isAlive, setIsAlive] = useState(initialAliveRef.current);
  const prevSceneRef = useRef<DiagramScene>(scene);

  if (typeof window === 'undefined' && initialAliveRef.current) {
    markAlivePlayed(scene);
  }

  useEffect(() => {
    if (initialAliveRef.current) {
      markAlivePlayed(scene);
    }
  }, [scene]);

  useEffect(() => {
    guideController.current?.setDeps({ lang: LANG_BCP47[currentLang] ?? 'en-IN' });
  }, [currentLang]);

  useEffect(() => {
    if (prevSceneRef.current !== scene) {
      prevSceneRef.current = scene;
      if (guideController.current?.isGuiding()) {
        guideController.current.stop('user');
      }
      setOfferedTarget(null);
      if (shouldPlayAlive(scene)) {
        markAlivePlayed(scene);
        setIsAlive(true);
      }
    }
  }, [scene]);

  const handleAliveDone = useCallback((): void => {
    setIsAlive(false);
  }, []);

  const handleCorrectClick = (): void => {
    markReturningFromCorrect();
    onCorrect?.();
  };
  const isRawScene = isRaw ?? (scene.kind === 'unknown' || announced.includes(t('raw.announce')));
  const rawNoticeTranslation = t('lab.raw.notice');
  const rawNoticeText =
    rawNoticeTranslation !== 'lab.raw.notice'
      ? rawNoticeTranslation
      : t('raw.announce');

  const clearLongPressTimer = (): void => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /** Re-arm the two-finger long-press timer (GT-09). */
  const armTwoFingerLongPressTimer = (now: number): void => {
    clearLongPressTimer();
    if (activePointers.current.size !== 2) return;
    for (const pointer of activePointers.current.values()) {
      pointer.start = { x: pointer.current.x, y: pointer.current.y, t: now };
    }
    longPressTimer.current = setTimeout(() => {
      if (activePointers.current.size === 2) {
        const entries = Array.from(activePointers.current.values());
        const p1 = entries[0];
        const p2 = entries[1];
        if (p1 && p2 && checkTwoFingerLongPress(p1, p2, performance.now())) {
          void handleVoiceAsk();
        }
      }
    }, TWO_FINGER_LONG_PRESS_MS);
  };

  /** Controls are disabled while busy; focus only works once React re-enables them. */
  const focusAfterRender = (ref: { current: HTMLElement | null }): void => {
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleStartGuideFromOffer = (): void => {
    if (!offeredTarget) return;
    const resolved = resolveTarget(sceneRef.current, offeredTarget);
    if (resolved && guideController.current) {
      setOfferedTarget(null);
      drivers.audio.unlock();
      drivers.audio.setTone(null);
      engineState.current = initialState();
      guideController.current.start(resolved);
      setIsGuiding(true);
      const msg = t('guide.start').replace('{label}', resolved.label);
      setStatusMessage(msg);
      lastSpokenRef.current = msg;
    }
  };

  const handleExit = (): void => {
    if (guideController.current?.isGuiding()) {
      guideController.current.stop('back');
      return;
    }
    if (leaving.current) return;
    leaving.current = true;
    try {
      drivers.speech.cancelListen?.();
    } catch {
      // ignore
    }
    askManager.current.abort();
    drivers.audio.playEarcon?.('back');
    clearLongPressTimer();
    activePointers.current.clear();
    primaryPointerId.current = null;
    leaveExploreEntry();
    onBack();
  };

  const handleVoiceAsk = async (): Promise<void> => {
    // GT-01: Re-entry guard for handleVoiceAsk
    if (busyRef.current || askManager.current.isBusy()) return;
    busyRef.current = true;
    clearLongPressTimer();
    setIsBusy(true);

    // GT-02: Stop tone and haptics and mark askActive while voice listening is open
    askActive.current = true;
    try {
      drivers.audio.setTone(null);
      drivers.haptics.stop();
    } catch {
      // ignore
    }

    const lang = LANG_BCP47[getLang()] ?? 'en-IN';

    try {
      if (!drivers.speech.canListen || typeof drivers.speech.listen !== 'function') {
        const msg = t('ask.errorUnsupported');
        setStatusMessage(msg);
        try {
          drivers.speech.speak(msg, lang);
        } catch {
          // ignore
        }
        lastSpokenRef.current = msg;
        setShowTextFallback(true);
        return;
      }

      // Stop TTS and play listening earcon / beep
      try {
        drivers.speech.stopSpeaking?.();
        if (drivers.audio.playEarcon) {
          drivers.audio.playEarcon('listening');
        } else {
          drivers.audio.beep(LISTENING_BEEP_HZ, LISTENING_BEEP_MS);
        }
      } catch {
        // audio cues are best-effort
      }
      setStatusMessage(t('ask.listening'));

      askManager.current.setActiveSpeech(drivers.speech);

      let transcript = '';
      try {
        transcript = await drivers.speech.listen(lang);
      } catch (err: unknown) {
        if (leaving.current) return;
        try {
          drivers.audio.playEarcon?.('error');
        } catch {
          // ignore
        }
        const msg = askErrorMessage(err);
        setStatusMessage(msg);
        try {
          drivers.speech.speak(msg, lang);
        } catch {
          // ignore
        }
        lastSpokenRef.current = msg;
        setShowTextFallback(true);
        return;
      } finally {
        askActive.current = false;
        askManager.current.setActiveSpeech(null);
      }

      if (leaving.current) return;

      const isGuide = isGuideActive();
      // Check if recognized phrase is an Explore voice command
      const cmd = parseExploreCommand(transcript, isGuide);
      if (cmd.type !== 'unknown') {
        const currentNorm = pendingCursor.current
          ? toNorm(pendingCursor.current, viewportRef.current)
          : null;
        const currentRate = drivers.speech.getRate ? drivers.speech.getRate() : 'normal';
        const result = executeExploreCommand(cmd, {
          scene,
          view: viewportRef.current,
          cursorNorm: currentNorm,
          lastSpoken: lastSpokenRef.current,
          currentCornerIndex: cornerIndexRef.current,
          currentRate,
          isGuiding: guideController.current?.isGuiding(),
          isGuideActive: isGuide,
        });

        if (result.stopGuide) {
          guideController.current?.stop('voice');
        } else if (result.guideTarget) {
          drivers.audio.setTone(null);
          engineState.current = initialState();
          guideController.current?.start(result.guideTarget);
          setIsGuiding(true);
        }

        if (result.nextCornerIndex !== undefined) {
          cornerIndexRef.current = result.nextCornerIndex;
        }
        if (result.nextCursor) {
          pendingCursor.current = result.nextCursor;
          scheduleDraw(viewportRef.current, result.nextCursor);
        }
        if (result.nextRate) {
          drivers.speech.setRate?.(result.nextRate);
        }
        if (result.earcon) {
          try {
            drivers.audio.playEarcon?.(result.earcon);
          } catch {
            // ignore
          }
        }

        setStatusMessage(result.speech);
        if (!result.stopGuide && !result.guideTarget) {
          try {
            drivers.speech.speak(result.speech, lang);
          } catch {
            // ignore
          }
        }
        lastSpokenRef.current = result.speech;
        return;
      }

      // If not a local command, submit to Ask backend
      setStatusMessage(t('ask.thinking'));
      try {
        drivers.speech.speak(t('ask.thinking'), lang);
      } catch {
        // ignore
      }

      const outcome = await askManager.current.submitTextAsk(transcript, {
        audio: drivers.audio,
        speech: drivers.speech,
        scene,
        lang,
        formatAnswer: (ans: string, target?: GuideTarget) => {
          if (target && isGuide) {
            return `${ans} ${t('ask.guideOffer')}`;
          }
          return ans;
        },
        say: (text: string) => {
          setStatusMessage(text);
          try {
            drivers.speech.speak(text, lang);
          } catch {
            // ignore
          }
          lastSpokenRef.current = text;
        },
        onStatusChange: (status: string) => {
          setStatusMessage(status);
        },
        onFallbackNeeded: () => {
          setShowTextFallback(true);
        },
      });

      if (leaving.current) return;
      if (outcome.kind === 'success') {
        if (outcome.target && isGuide) {
          setOfferedTarget(outcome.target);
        }
      } else if (outcome.kind === 'failed') {
        setShowTextFallback(true);
      }
    } catch (err: unknown) {
      if (leaving.current) return;
      try {
        drivers.audio.playEarcon?.('error');
      } catch {
        // ignore
      }
      const msg = askErrorMessage(err);
      setStatusMessage(msg);
      try {
        drivers.speech.speak(msg, lang);
      } catch {
        // ignore
      }
      lastSpokenRef.current = msg;
      setShowTextFallback(true);
    } finally {
      busyRef.current = false;
      if (!leaving.current) {
        setIsBusy(false);
        focusAfterRender(askButtonRef);
      }
    }
  };

  const handleTextSubmit = async (): Promise<void> => {
    // GT-01: Re-entry guard
    if (busyRef.current || askManager.current.isBusy()) return;
    if (!questionText.trim()) {
      const msg = t('ask.errorEmpty');
      setStatusMessage(msg);
      try {
        drivers.speech.speak(msg, LANG_BCP47[getLang()]);
      } catch {
        // ignore
      }
      lastSpokenRef.current = msg;
      return;
    }
    setIsBusy(true);
    const q = questionText;
    const lang = LANG_BCP47[getLang()] ?? 'en-IN';
    let outcome: AskOutcome | null = null;
    try {
      outcome = await askManager.current.submitTextAsk(q, {
        audio: drivers.audio,
        speech: drivers.speech,
        scene,
        lang,
        formatAnswer: (ans: string, target?: GuideTarget) => {
          if (target && isGuideActive()) {
            return `${ans} ${t('ask.guideOffer')}`;
          }
          return ans;
        },
        say: (text: string) => {
          setStatusMessage(text);
          try {
            drivers.speech.speak(text, lang);
          } catch {
            // ignore
          }
          lastSpokenRef.current = text;
        },
        onStatusChange: (status: string) => {
          setStatusMessage(status);
        },
        onFallbackNeeded: () => {
          setShowTextFallback(true);
        },
      });
    } catch (err: unknown) {
      if (leaving.current) return;
      try {
        drivers.audio.playEarcon?.('error');
      } catch {
        // ignore
      }
      const msg = askErrorMessage(err);
      setStatusMessage(msg);
      try {
        drivers.speech.speak(msg, lang);
      } catch {
        // ignore
      }
      lastSpokenRef.current = msg;
      outcome = { kind: 'failed', message: msg, error: err };
    } finally {
      if (!leaving.current) {
        setIsBusy(false);
        if (outcome?.kind === 'success') {
          if (outcome.target && isGuideActive()) {
            setOfferedTarget(outcome.target);
          }
          setQuestionText('');
          focusAfterRender(askButtonRef);
        } else {
          // Keep the typed question so it can be retried; return focus to the input.
          focusAfterRender(textInputRef.current ? textInputRef : askButtonRef);
        }
      }
    }
  };

  const renderStaticScene = (view: Viewport, dpr: number): void => {
    const scene = sceneRef.current;
    const { canvasWidth: w, canvasHeight: h } = view;
    if (typeof document === 'undefined') return;
    let offscreen = offscreenCanvasRef.current;
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offscreenCanvasRef.current = offscreen;
    }
    offscreen.width = Math.round(w * dpr);
    offscreen.height = Math.round(h * dpr);
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0b0e0c';
    ctx.fillRect(0, 0, w, h);

    // Faint cross at canvas centre for sighted observers
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();

    // Glowing green lines (#39ff88, lineWidth 4, shadowBlur 12)
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#39ff88';
    ctx.shadowBlur = 12;

    // Coordinate axes if present
    if (scene.axes?.x_axis_y != null) {
      const p1 = toScreen({ x: 0, y: scene.axes.x_axis_y }, view);
      const p2 = toScreen({ x: 1, y: scene.axes.x_axis_y }, view);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    if (scene.axes?.y_axis_x != null) {
      const p1 = toScreen({ x: scene.axes.y_axis_x, y: 0 }, view);
      const p2 = toScreen({ x: scene.axes.y_axis_x, y: 1 }, view);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Segments
    const pointMap = new Map<string, { x: number; y: number }>();
    if (scene.points) {
      for (const p of scene.points) {
        pointMap.set(p.id, p);
      }
    }
    if (scene.segments) {
      for (const s of scene.segments) {
        const a = pointMap.get(s.a);
        const b = pointMap.get(s.b);
        if (a && b) {
          const sa = toScreen(a, view);
          const sb = toScreen(b, view);
          ctx.beginPath();
          ctx.moveTo(sa.x, sa.y);
          ctx.lineTo(sb.x, sb.y);
          ctx.stroke();
        }
      }
    }

    // Polylines
    if (scene.polylines) {
      for (const poly of scene.polylines) {
        if (poly.points && poly.points.length > 1) {
          const first = poly.points[0];
          if (first) {
            ctx.beginPath();
            const start = toScreen({ x: Number(first[0]), y: Number(first[1]) }, view);
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i < poly.points.length; i++) {
              const pt = poly.points[i];
              if (pt) {
                const sp = toScreen({ x: Number(pt[0]), y: Number(pt[1]) }, view);
                ctx.lineTo(sp.x, sp.y);
              }
            }
            ctx.stroke();
          }
        }
      }
    }

    // Bars
    if (scene.bars) {
      for (const b of scene.bars) {
        const topLeft = toScreen({ x: Math.min(b.x0, b.x1), y: Math.min(b.y_top, b.y_base) }, view);
        const bottomRight = toScreen({ x: Math.max(b.x0, b.x1), y: Math.max(b.y_top, b.y_base) }, view);
        const bw = bottomRight.x - topLeft.x;
        const bh = bottomRight.y - topLeft.y;
        ctx.strokeRect(topLeft.x, topLeft.y, bw, bh);
      }
    }

    // Vertex dots and labels
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8ffe8';
    ctx.font = '16px system-ui, sans-serif';
    if (scene.points) {
      for (const p of scene.points) {
        const sp = toScreen(p, view);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
        ctx.fill();
        if (p.label) {
          ctx.fillText(p.label, sp.x + 10, sp.y - 10);
        }
      }
    }
  };

  const draw = (view: Viewport, cursor: ScreenPoint | null): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { canvasWidth: w, canvasHeight: h } = view;
    ctx.clearRect(0, 0, w, h);

    const offscreen = offscreenCanvasRef.current;
    if (offscreen) {
      ctx.drawImage(offscreen, 0, 0, w, h);
    }

    // Cursor indicator for sighted observers
    if (cursor !== null) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Guide target indicator for sighted observers
    const guideTarget = guideController.current?.getTarget();
    if (isGuiding && guideTarget) {
      const sp = toScreen(guideTarget, view);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const scheduleDraw = (view: Viewport, cursor: ScreenPoint | null): void => {
    pendingCursor.current = cursor;
    if (rafId.current === null && typeof requestAnimationFrame !== 'undefined') {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        draw(view, pendingCursor.current);
      });
    } else if (typeof requestAnimationFrame === 'undefined') {
      draw(view, cursor);
    }
  };

  const updateRect = (): DOMRect | null => {
    return canvasRectCache.current.update(canvasRef.current);
  };

  const updateDimensions = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = updateRect();
    if (!rect) return;
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const dpr = computeCanvasDpr(rawDpr, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const view = makeViewport(width, height);
    viewportRef.current = view;
    renderStaticScene(view, dpr);
    draw(view, pendingCursor.current);
  };

  useEffect(() => {
    pushExploreEntry();

    const gc = new GuideController({
      drivers,
      lang: LANG_BCP47[getLang()] ?? 'en-IN',
      onArrived: (target) => {
        setIsGuiding(false);
        const msg = t('guide.arrived').replace('{label}', target.label);
        setStatusMessage(msg);
        lastSpokenRef.current = msg;
      },
      onStopped: (_reason) => {
        setIsGuiding(false);
        const msg = t('guide.stopped');
        setStatusMessage(msg);
        lastSpokenRef.current = msg;
      },
      onStateChange: (st) => {
        setIsGuiding(st.phase === 'guiding');
      },
    });
    guideController.current = gc;

    const unbindBack = subscribeBack(() => {
      if (guideController.current?.isGuiding()) {
        guideController.current.stop('back');
        pushExploreEntry();
        return;
      }
      if (leaving.current) return;
      leaving.current = true;
      drivers.audio.playEarcon?.('back');
      clearLongPressTimer();
      activePointers.current.clear();
      primaryPointerId.current = null;
      onBackRef.current();
    });

    // GT-04: Clear active pointers, primary pointer, and engine tone on visibilitychange hidden or window blur
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        if (guideController.current?.isGuiding()) {
          guideController.current.stop('user');
        }
        drivers.audio.setTone(null);
        drivers.audio.setGuideTone?.(null);
        clearLongPressTimer();
        activePointers.current.clear();
        primaryPointerId.current = null;
        const { state, effects } = step(engineState.current, { kind: 'lift', t: performance.now() });
        engineState.current = state;
        runEffects(effects, drivers);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleWindowBlur = (): void => {
      if (guideController.current?.isGuiding()) {
        guideController.current.stop('user');
      }
      drivers.audio.setTone(null);
      drivers.audio.setGuideTone?.(null);
      clearLongPressTimer();
      activePointers.current.clear();
      primaryPointerId.current = null;
      const { state, effects } = step(engineState.current, { kind: 'lift', t: performance.now() });
      engineState.current = state;
      runEffects(effects, drivers);
    };
    window.addEventListener('blur', handleWindowBlur);

    if (isSpeechActive) {
      setSpeechAnnounced(true);
      canvasRef.current?.removeAttribute('aria-label');
    }

    canvasRef.current?.focus();
    updateDimensions();

    const handleResize = (): void => updateDimensions();
    const handleScroll = (): void => {
      updateRect();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    const canvas = canvasRef.current;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      observer = new ResizeObserver(() => {
        updateDimensions();
      });
      observer.observe(canvas);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      gc.destroy();
      guideController.current = null;
      clearLongPressTimer();
      askManager.current.abort();
      unbindBack();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      observer?.disconnect();
      if (rafId.current !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      // Lift on unmount
      const { effects } = step(engineState.current, { kind: 'lift', t: performance.now() });
      runEffects(effects, drivers);
    };
  }, []);

  const getCanvasCoords = (e: PointerEvent<HTMLCanvasElement>): ScreenPoint => {
    return canvasRectCache.current.getCoords(e.clientX, e.clientY, canvasRef.current);
  };

  /**
   * Unified move pipeline result applicator (R3-03).
   * Updates engine/centre/axis states and runs merged announcements and effects.
   */
  const applyMoveResult = (
    moveResult: ReturnType<typeof processPointerMove>,
    lang: string,
    extraAnnouncements: readonly string[] = [],
  ): void => {
    engineState.current = moveResult.nextEngineState;
    centreTickState.current = moveResult.centreCheck.nextState;
    axisState.current = moveResult.nextAxisState;

    if (moveResult.centreCheck.tick) {
      drivers.haptics.vibrate(CENTRE_TICK_MS);
    }
    // R3-01 / R3-03: Unified move pipeline calls mergeAnnouncements (previously in pointerdown, move, promotion)
    // PointerDown: mergeAnnouncements([centreMsg, ...axisCrossings], effects) (R3-01)
    // PointerMove: mergeAnnouncements(moveResult.axisCrossings, moveResult.effects)
    // Promotion: mergeAnnouncements(moveResult.axisCrossings, moveResult.effects)
    const moveEffects = mergeAnnouncements(
      [...extraAnnouncements, ...moveResult.axisCrossings],
      moveResult.effects,
    );
    // R3-02: update lastSpokenRef unconditionally from the merged speak effect
    const joined = moveEffects.find((e) => e.kind === 'speak');
    if (joined?.kind === 'speak') {
      lastSpokenRef.current = joined.text;
    }
    runEffects(moveEffects, drivers, lang);
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>): void => {
    if (leaving.current) return;
    drivers.audio.unlock();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A synthesized or already-released pointer (TalkBack's double-tap hold) can be refused
      // with InvalidPointerId. Exploring still works without capture, so carry on (CORE-08).
    }
    updateDimensions();
    const coords = getCanvasCoords(e);
    const now = performance.now();
    const view = viewportRef.current;
    const lang = LANG_BCP47[getLang()] ?? 'en-IN';

    // Track active pointer for gesture detection
    activePointers.current.set(e.pointerId, {
      start: { x: coords.x, y: coords.y, t: now },
      current: { x: coords.x, y: coords.y, t: now },
    });

    // Check two-finger long-press timer setup (GT-09)
    if (activePointers.current.size === 2) {
      armTwoFingerLongPressTimer(now);
    } else {
      clearLongPressTimer();
    }

    if (guideController.current?.isGuiding()) {
      primaryPointerId.current = e.pointerId;
      const norm = toNorm(coords, view);
      guideController.current.move(norm, now);
      scheduleDraw(view, coords);
      return;
    }

    // GT-04: Self-heal if the tracked primary pointer is not in activePointers
    primaryPointerId.current = selfHealPrimaryPointer(
      primaryPointerId.current,
      activePointers.current,
    );

    // Only the first active pointer drives the engine (finding 11)
    if (primaryPointerId.current !== null) {
      return;
    }
    primaryPointerId.current = e.pointerId;

    // Re-centre on each new hold (Requirement 13)
    engineState.current = initialState();
    // Re-arm centre tick state on every new hold (finding 2)
    centreTickState.current = rearmCentreTick(centreTickState.current);

    // Reset axis tracking on every pointerdown and seed side without speaking (finding 7)
    const norm = toNorm(coords, view);
    axisState.current = seedAxisState(norm, scene.axes);

    // Check centre reference tick
    const cx = view.canvasWidth / 2;
    const cy = view.canvasHeight / 2;
    const dx = coords.x - cx;
    const dy = coords.y - cy;
    const distFromCentre = Math.hypot(dx, dy);

    if (firstTouchOffset.current === null) {
      firstTouchOffset.current = { dx, dy };
      setDebugOffset(dx, dy);
    }

    const centreResult = checkCentreTick(
      distFromCentre,
      centreTickState.current,
      false,
      true,
    );
    centreTickState.current = centreResult.nextState;

    if (centreResult.tick) {
      drivers.haptics.vibrate(CENTRE_TICK_MS);
    }
    // R3-01: Centre announcement merged into applyMoveResult instead of speaking directly
    const centreAnnouncements = centreResult.speakCentre ? [t('explore.centre')] : [];

    // Process move pipeline at the touch point
    const moveResult = processPointerMove(
      scene,
      coords,
      view,
      now,
      engineState.current,
      centreTickState.current,
      axisState.current,
    );
    applyMoveResult(moveResult, lang, centreAnnouncements);
    scheduleDraw(view, coords);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>): void => {
    if (leaving.current) return;
    const coords = getCanvasCoords(e);
    const now = performance.now();
    const view = viewportRef.current;
    const lang = LANG_BCP47[getLang()] ?? 'en-IN';

    const pointer = activePointers.current.get(e.pointerId);
    if (pointer) {
      pointer.current = { x: coords.x, y: coords.y, t: now };
    }

    // Check two-finger gestures: swipe down exit or long-press drift cancel
    if (activePointers.current.size >= 2) {
      const entries = Array.from(activePointers.current.values());
      const p1 = entries[0];
      const p2 = entries[1];
      if (p1 && p2) {
        if (checkTwoFingerSwipeDown(p1, p2)) {
          handleExit();
          return;
        }
        const d1 = Math.hypot(p1.current.x - p1.start.x, p1.current.y - p1.start.y);
        const d2 = Math.hypot(p2.current.x - p2.start.x, p2.current.y - p2.start.y);
        if (d1 > TWO_FINGER_MAX_MOVE_PX || d2 > TWO_FINGER_MAX_MOVE_PX) {
          clearLongPressTimer();
        }
      }
    }

    // Only primary pointer drives the engine (finding 11)
    if (e.pointerId !== primaryPointerId.current) {
      return;
    }

    if (guideController.current?.isGuiding()) {
      const norm = toNorm(coords, view);
      guideController.current.move(norm, now);
      scheduleDraw(view, coords);
      return;
    }

    // GT-02: When Ask starts, skip runEffects and axis speech until listening ends
    if (askActive.current) {
      const moveResult = processPointerMove(
        scene,
        coords,
        view,
        now,
        engineState.current,
        centreTickState.current,
        axisState.current,
      );
      engineState.current = moveResult.nextEngineState;
      centreTickState.current = moveResult.centreCheck.nextState;
      axisState.current = moveResult.nextAxisState;
      scheduleDraw(view, coords);
      return;
    }

    // Per-move pipeline (R3-03)
    const moveResult = processPointerMove(
      scene,
      coords,
      view,
      now,
      engineState.current,
      centreTickState.current,
      axisState.current,
    );
    applyMoveResult(moveResult, lang);
    scheduleDraw(view, coords);
  };

  const handlePointerLift = (e: PointerEvent<HTMLCanvasElement>): void => {
    const now = performance.now();
    clearLongPressTimer();
    const isPrimaryLift = e.pointerId === primaryPointerId.current;
    const { promotedPointerId, promotedCoords } = promoteOldestPointer(
      activePointers.current,
      e.pointerId,
      primaryPointerId.current,
    );

    // GT-09: Re-arm the two-finger long-press timer when finger count drops back to exactly two
    if (activePointers.current.size === 2) {
      armTwoFingerLongPressTimer(now);
    }

    if (guideController.current?.isGuiding()) {
      if (isPrimaryLift) {
        primaryPointerId.current = promotedPointerId;
        if (promotedPointerId === null || promotedCoords === null) {
          guideController.current.lift(performance.now());
          scheduleDraw(viewportRef.current, null);
        } else {
          const norm = toNorm(promotedCoords, viewportRef.current);
          guideController.current.move(norm, performance.now());
          scheduleDraw(viewportRef.current, promotedCoords);
        }
      }
      return;
    }

    if (isPrimaryLift) {
      if (promotedPointerId !== null && promotedCoords !== null) {
        // Promote oldest surviving pointer to primary (Finding 14, Requirement 4.8)
        primaryPointerId.current = promotedPointerId;
        const view = viewportRef.current;
        const lang = LANG_BCP47[getLang()] ?? 'en-IN';

        // GT-03: On promotion of a second finger to primary, first run step(state, {kind: 'lift'})
        // and its effects (tone off, vibrate stop) before resetting and processing the promoted point
        const liftResult = step(engineState.current, { kind: 'lift', t: now });
        runEffects(liftResult.effects, drivers);

        engineState.current = initialState();
        const norm = toNorm(promotedCoords, view);
        axisState.current = seedAxisState(norm, scene.axes);

        const moveResult = processPointerMove(
          scene,
          promotedCoords,
          view,
          now,
          engineState.current,
          centreTickState.current,
          axisState.current,
        );
        applyMoveResult(moveResult, lang);
        scheduleDraw(view, promotedCoords);
      } else {
        // All fingers lifted: silence effects
        primaryPointerId.current = null;
        const { state, effects } = step(engineState.current, { kind: 'lift', t: performance.now() });
        engineState.current = state;
        runEffects(effects, drivers);
        scheduleDraw(viewportRef.current, null);
      }
    }
  };

  const setDebugOffset = (dx: number, dy: number): void => {
    setDebugText(
      t('explore.debugOffset')
        .replace('{dx}', dx.toFixed(1))
        .replace('{dy}', dy.toFixed(1)),
    );
  };

  return (
    <main className={`gt-explore gt-lab-explore${isGuiding ? ' gt-explore--guiding' : ''}`}>
      <header className="gt-explore__header gt-lab-header">
        <div className="gt-toolbar">
          <SettingsLauncher drivers={drivers} speak={(text) => drivers.speech.speak(text)} />
        </div>
        <div className="gt-explore__title-row">
          <h1 className="gt-explore__title">{sceneName(scene)}</h1>
          <span className="gt-explore__badge gt-lab-badge" aria-hidden="true">Diagram</span>
        </div>
      </header>

      {verified && (
        <VerifiedBanner
          by={verified.by}
          note={verified.note}
          at={verified.at}
          onSpeak={(text) => drivers.speech.speak(text, LANG_BCP47[getLang()])}
        />
      )}

      {isRawScene && (
        <div className="gt-explore__raw-notice gt-lab-raw-notice" role="status">
          <span className="gt-explore__raw-badge" aria-hidden="true">Raw</span>
          <span className="gt-explore__raw-text">{rawNoticeText}</span>
        </div>
      )}

      <div className={`gt-explore__status-card gt-lab-status-card${isAlive ? ' gt-lab-status-card--alive' : ''}`}>
        <StatusText className="gt-explore__status" spoken={drivers.speech.canSpeak}>
          {statusMessage}
        </StatusText>
      </div>

      <div className="gt-explore__canvas-container gt-lab-specimen-table" data-lab-specimen-table="true">
        <div className="gt-lab-frame" data-lab-frame aria-hidden="true">
          <span className="gt-lab-rivet gt-lab-rivet--tl" aria-hidden="true" />
          <span className="gt-lab-rivet gt-lab-rivet--tr" aria-hidden="true" />
          <span className="gt-lab-rivet gt-lab-rivet--bl" aria-hidden="true" />
          <span className="gt-lab-rivet gt-lab-rivet--br" aria-hidden="true" />
          <span className="gt-lab-suture-border" aria-hidden="true" />
          {isAlive && (
            <div className="gt-explore__spark-wrapper" aria-hidden="true">
              <Spark
                className="gt-explore__spark"
                overlay={false}
                onDone={handleAliveDone}
              />
            </div>
          )}
        </div>
        <canvas
          ref={canvasRef}
          className="gt-explore__canvas"
          tabIndex={0}
          role="img"
          aria-label={
            speechAnnounced && drivers.speech.canSpeak
              ? undefined
              : canvasAriaLabel(scene)
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerLift}
          onPointerCancel={handlePointerLift}
          onLostPointerCapture={handlePointerLift}
        />
      </div>

      <div className="gt-explore__debug" data-testid="explore-debug-offset" aria-hidden="true">
        {debugText}
      </div>

      {showTextFallback && (
        <form
          className="gt-explore__ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleTextSubmit();
          }}
        >
          <label htmlFor="gt-ask-input" className="gt-visually-hidden">
            {t('ask.placeholder')}
          </label>
          <input
            id="gt-ask-input"
            ref={textInputRef}
            type="text"
            className="gt-control gt-explore__ask-input"
            placeholder={t('ask.placeholder')}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            maxLength={500}
            disabled={isBusy}
          />
          <AccessibleButton
            type="submit"
            className="gt-control gt-explore__send"
            disabled={isBusy}
          >
            {t('ask.send')}
          </AccessibleButton>
        </form>
      )}

      <footer className="gt-explore__footer">
        <div className="gt-explore__actions">
          {offeredTarget && isGuideActive() && (
            <AccessibleButton
              data-testid="explore-guide-me"
              className="gt-control gt-btn gt-btn--primary gt-explore__guide-me"
              onClick={handleStartGuideFromOffer}
              disabled={isBusy}
              aria-label={t('ask.guideMe')}
              style={{ minWidth: '48px', minHeight: '48px' }}
            >
              {t('ask.guideMe')}
            </AccessibleButton>
          )}
          <AccessibleButton
            ref={askButtonRef}
            className="gt-control gt-explore__ask"
            onClick={() => void handleVoiceAsk()}
            disabled={isBusy}
          >
            {t('ask.button')}
          </AccessibleButton>
          {onCorrect && (
            <AccessibleButton
              className="gt-control gt-explore__correct"
              onClick={handleCorrectClick}
              disabled={isBusy}
            >
              {t('explore.correct')}
            </AccessibleButton>
          )}
          <AccessibleButton
            ref={backButtonRef}
            className="gt-control gt-explore__back"
            onClick={handleExit}
          >
            {t('common.back')}
          </AccessibleButton>
        </div>
      </footer>
    </main>
  );
}
