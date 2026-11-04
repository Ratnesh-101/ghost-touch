/**
 * Explore screen — feel STEM diagrams by touch using relative cursor and haptic engine.
 *
 * Works with TalkBack on (pass-through gesture: double-tap, hold and drag)
 * and TalkBack off (direct touch or same gesture).
 *
 * Pure decisions live in `flow/explore.ts`, `flow/ask.ts`, and `flow/commands.ts`;
 * browser APIs live in `drivers/` (navigation history, canvas context & DOM events here).
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AccessibleButton } from '../components/AccessibleButton';
import { LanguageSelector } from '../components/LanguageSelector';
import { RateSelector } from '../components/RateSelector';
import { StatusText } from '../components/StatusText';
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
import { askErrorMessage, AskManager, LISTENING_BEEP_HZ, LISTENING_BEEP_MS } from '../flow/ask';
import { executeExploreCommand, parseExploreCommand } from '../flow/commands';
import {
  CENTRE_TICK_MS,
  checkCentreTick,
  checkTwoFingerLongPress,
  checkTwoFingerSwipeDown,
  initialAxisState,
  initialCentreTickState,
  initialState,
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
import { getLang, LANG_BCP47, t } from '../i18n';

interface ExploreProps {
  scene: DiagramScene;
  /** The entry announcement spoken aloud and shown in status text. */
  announced: string;
  drivers: Drivers;
  onBack: () => void;
  onCorrect?: () => void;
}

export function Explore({ scene, announced, drivers, onBack, onCorrect }: ExploreProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const [statusMessage, setStatusMessage] = useState(announced);
  const [isBusy, setIsBusy] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(!drivers.speech.canListen);
  const [questionText, setQuestionText] = useState('');
  const [debugText, setDebugText] = useState(() => t('explore.debugWaiting'));

  const clearLongPressTimer = (): void => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /** Controls are disabled while busy; focus only works once React re-enables them. */
  const focusAfterRender = (ref: { current: HTMLElement | null }): void => {
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleExit = (): void => {
    if (leaving.current) return;
    leaving.current = true;
    drivers.audio.playEarcon?.('back');
    clearLongPressTimer();
    activePointers.current.clear();
    primaryPointerId.current = null;
    leaveExploreEntry();
    onBack();
  };

  const handleVoiceAsk = async (): Promise<void> => {
    clearLongPressTimer();
    setIsBusy(true);

    const lang = LANG_BCP47[getLang()] ?? 'en-IN';

    // Stop TTS and play listening earcon / beep
    drivers.speech.stopSpeaking?.();
    if (drivers.audio.playEarcon) {
      drivers.audio.playEarcon('listening');
    } else {
      drivers.audio.beep(LISTENING_BEEP_HZ, LISTENING_BEEP_MS);
    }
    setStatusMessage(t('ask.listening'));

    let transcript = '';
    try {
      transcript = await drivers.speech.listen(lang);
    } catch (err: unknown) {
      drivers.audio.playEarcon?.('error');
      const msg = askErrorMessage(err);
      setStatusMessage(msg);
      drivers.speech.speak(msg, lang);
      lastSpokenRef.current = msg;
      setIsBusy(false);
      focusAfterRender(askButtonRef);
      return;
    }

    // Check if recognized phrase is an Explore voice command
    const cmd = parseExploreCommand(transcript);
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
      });

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
        drivers.audio.playEarcon?.(result.earcon);
      }

      setStatusMessage(result.speech);
      drivers.speech.speak(result.speech, lang);
      lastSpokenRef.current = result.speech;
      setIsBusy(false);
      focusAfterRender(askButtonRef);
      return;
    }

    // If not a local command, submit to Ask backend
    setStatusMessage(t('ask.thinking'));
    drivers.speech.speak(t('ask.thinking'), lang);

    const outcome = await askManager.current.submitTextAsk(transcript, {
      audio: drivers.audio,
      speech: drivers.speech,
      scene,
      lang,
      say: (text: string) => {
        setStatusMessage(text);
        drivers.speech.speak(text, lang);
        lastSpokenRef.current = text;
      },
      onStatusChange: (status: string) => {
        setStatusMessage(status);
      },
      onFallbackNeeded: () => {
        setShowTextFallback(true);
      },
    });

    if (outcome.kind === 'busy' || outcome.kind === 'cancelled') return;
    setIsBusy(false);
    focusAfterRender(askButtonRef);
  };

  const handleTextSubmit = async (): Promise<void> => {
    if (!questionText.trim()) {
      const msg = t('ask.errorEmpty');
      setStatusMessage(msg);
      drivers.speech.speak(msg, LANG_BCP47[getLang()]);
      lastSpokenRef.current = msg;
      return;
    }
    setIsBusy(true);
    const q = questionText;
    const lang = LANG_BCP47[getLang()] ?? 'en-IN';
    const outcome = await askManager.current.submitTextAsk(q, {
      audio: drivers.audio,
      speech: drivers.speech,
      scene,
      lang,
      say: (text: string) => {
        setStatusMessage(text);
        drivers.speech.speak(text, lang);
        lastSpokenRef.current = text;
      },
      onStatusChange: (status: string) => {
        setStatusMessage(status);
      },
    });
    if (outcome.kind === 'busy' || outcome.kind === 'cancelled') return;
    setIsBusy(false);
    if (outcome.kind === 'success') {
      setQuestionText('');
      focusAfterRender(askButtonRef);
    } else {
      // Keep the typed question so it can be retried; return focus to the input.
      focusAfterRender(textInputRef);
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
    ctx.fillStyle = '#0b0b10';
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

  const updateDimensions = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

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
    const unbindBack = subscribeBack(() => {
      if (leaving.current) return;
      leaving.current = true;
      drivers.audio.playEarcon?.('back');
      clearLongPressTimer();
      activePointers.current.clear();
      primaryPointerId.current = null;
      onBackRef.current();
    });

    canvasRef.current?.focus();
    updateDimensions();

    const handleResize = (): void => updateDimensions();
    window.addEventListener('resize', handleResize);

    const canvas = canvasRef.current;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      observer = new ResizeObserver(() => {
        updateDimensions();
      });
      observer.observe(canvas);
    }

    return () => {
      clearLongPressTimer();
      askManager.current.abort();
      unbindBack();
      window.removeEventListener('resize', handleResize);
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
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>): void => {
    if (leaving.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
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

    // Check two-finger long-press timer setup
    if (activePointers.current.size === 2) {
      clearLongPressTimer();
      // Re-baseline both fingers so earlier exploring movement does not veto the long-press.
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
    } else {
      clearLongPressTimer();
    }

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
    if (centreResult.speakCentre) {
      const msg = t('explore.centre');
      drivers.speech.speak(msg, lang);
      lastSpokenRef.current = msg;
    }

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
    engineState.current = moveResult.nextEngineState;
    centreTickState.current = moveResult.centreCheck.nextState;
    axisState.current = moveResult.nextAxisState;

    if (moveResult.centreCheck.tick) {
      drivers.haptics.vibrate(CENTRE_TICK_MS);
    }
    for (const axisSpoken of moveResult.axisCrossings) {
      drivers.speech.speak(axisSpoken, lang);
      lastSpokenRef.current = axisSpoken;
    }
    runEffects(moveResult.effects, drivers, lang);
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

    // Per-move pipeline
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

    if (moveResult.centreCheck.tick) {
      drivers.haptics.vibrate(CENTRE_TICK_MS);
    }
    for (const axisSpoken of moveResult.axisCrossings) {
      drivers.speech.speak(axisSpoken, lang);
      lastSpokenRef.current = axisSpoken;
    }
    runEffects(moveResult.effects, drivers, lang);
    scheduleDraw(view, coords);
  };

  const handlePointerLift = (e: PointerEvent<HTMLCanvasElement>): void => {
    clearLongPressTimer();
    activePointers.current.delete(e.pointerId);
    if (e.pointerId === primaryPointerId.current) {
      primaryPointerId.current = null;
      const { state, effects } = step(engineState.current, { kind: 'lift', t: performance.now() });
      engineState.current = state;
      runEffects(effects, drivers);
      scheduleDraw(viewportRef.current, null);
    }
    if (activePointers.current.size === 0) {
      primaryPointerId.current = null;
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
    <main className="gt-explore">
      <header className="gt-explore__header">
        <div className="gt-toolbar">
          <LanguageSelector drivers={drivers} />
          <RateSelector drivers={drivers} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <h1 className="gt-explore__title">{sceneName(scene)}</h1>
          <span className="gt-explore__badge" aria-hidden="true">Diagram</span>
        </div>
      </header>

      <div className="gt-explore__status-card">
        <StatusText className="gt-explore__status" spoken={drivers.speech.canSpeak}>
          {statusMessage}
        </StatusText>
      </div>

      <div className="gt-explore__canvas-container">
        <canvas
          ref={canvasRef}
          className="gt-explore__canvas"
          tabIndex={0}
          role="img"
          aria-label={canvasAriaLabel(scene)}
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
              onClick={onCorrect}
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
