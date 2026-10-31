/**
 * Explore screen — feel STEM diagrams by touch using relative cursor and haptic engine.
 *
 * Works with TalkBack on (pass-through gesture: double-tap, hold and drag)
 * and TalkBack off (direct touch or same gesture).
 *
 * Pure decisions live in `flow/explore.ts` and `flow/ask.ts`; browser APIs live
 * in `drivers/` (history in `drivers/navigation.ts`, canvas context & DOM events here).
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AccessibleButton } from '../components/AccessibleButton';
import { StatusText } from '../components/StatusText';
import {
  makeViewport,
  toScreen,
  type ScreenPoint,
  type Viewport,
} from '../core/geometry';
import type { DiagramScene } from '../core/scene';
import { runEffects, type Drivers } from '../drivers';
import { onBack as subscribeBack, pushExploreEntry } from '../drivers/navigation';
import { AskManager } from '../flow/ask';
import {
  CENTRE_TICK_MS,
  checkCentreTick,
  checkTwoFingerLongPress,
  checkTwoFingerSwipeDown,
  initialAxisState,
  initialCentreTickState,
  initialState,
  processPointerMove,
  step,
  TWO_FINGER_LONG_PRESS_MS,
  TWO_FINGER_MAX_MOVE_PX,
  type AxisTrackerState,
  type CentreTickState,
  type EngineState,
  type PointerHistory,
} from '../flow/explore';
import { canvasAriaLabel, sceneName } from '../flow/navigation';
import { t } from '../i18n';

interface ExploreProps {
  scene: DiagramScene;
  /** The entry announcement spoken aloud and shown in status text. */
  announced: string;
  drivers: Drivers;
  onBack: () => void;
}

export function Explore({ scene, announced, drivers, onBack }: ExploreProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const askButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const engineState = useRef<EngineState>(initialState());
  const centreTickState = useRef<CentreTickState>(initialCentreTickState());
  const axisState = useRef<AxisTrackerState>(initialAxisState());
  const activePointers = useRef<Map<number, PointerHistory>>(new Map());
  const viewportRef = useRef<Viewport>(makeViewport(300, 300));
  const firstTouchOffset = useRef<{ dx: number; dy: number } | null>(null);

  const askManager = useRef<AskManager>(new AskManager());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [statusMessage, setStatusMessage] = useState(announced);
  const [isBusy, setIsBusy] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(!drivers.speech.canListen);
  const [questionText, setQuestionText] = useState('');
  const [debugText, setDebugText] = useState('Relative cursor: waiting for touch');

  const clearLongPressTimer = (): void => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleVoiceAsk = async (): Promise<void> => {
    clearLongPressTimer();
    setIsBusy(true);
    const outcome = await askManager.current.startVoiceAsk({
      audio: drivers.audio,
      speech: drivers.speech,
      scene,
      say: (text: string) => {
        setStatusMessage(text);
        drivers.speech.speak(text);
      },
      onStatusChange: (status: string) => {
        setStatusMessage(status);
      },
      onFallbackNeeded: () => {
        setShowTextFallback(true);
      },
    });
    setIsBusy(false);
    if (outcome.kind !== 'cancelled') {
      askButtonRef.current?.focus();
    }
  };

  const handleTextSubmit = async (): Promise<void> => {
    if (!questionText.trim()) {
      const msg = t('ask.errorEmpty');
      setStatusMessage(msg);
      drivers.speech.speak(msg);
      return;
    }
    setIsBusy(true);
    const q = questionText;
    setQuestionText('');
    const outcome = await askManager.current.submitTextAsk(q, {
      audio: drivers.audio,
      speech: drivers.speech,
      scene,
      say: (text: string) => {
        setStatusMessage(text);
        drivers.speech.speak(text);
      },
      onStatusChange: (status: string) => {
        setStatusMessage(status);
      },
    });
    setIsBusy(false);
    if (outcome.kind !== 'cancelled') {
      askButtonRef.current?.focus();
    }
  };

  const draw = (view: Viewport, cursor: ScreenPoint | null): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { canvasWidth: w, canvasHeight: h } = view;
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

    // Cursor indicator for sighted observers
    if (cursor !== null) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const updateDimensions = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const view = makeViewport(width, height);
    viewportRef.current = view;
    draw(view, null);
  };

  useEffect(() => {
    pushExploreEntry();
    const unbindBack = subscribeBack(() => {
      onBack();
    });

    canvasRef.current?.focus();
    updateDimensions();

    const handleResize = (): void => updateDimensions();
    window.addEventListener('resize', handleResize);

    return () => {
      clearLongPressTimer();
      askManager.current.abort();
      unbindBack();
      window.removeEventListener('resize', handleResize);
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
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCanvasCoords(e);
    const now = performance.now();
    const view = viewportRef.current;

    // Track active pointer for gesture detection
    activePointers.current.set(e.pointerId, {
      start: { x: coords.x, y: coords.y, t: now },
      current: { x: coords.x, y: coords.y, t: now },
    });

    // Check two-finger long-press timer setup
    if (activePointers.current.size === 2) {
      clearLongPressTimer();
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

    // Re-centre on each new hold (Requirement 13)
    engineState.current = initialState();

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
      drivers.speech.speak(t('explore.centre'));
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
      drivers.speech.speak(axisSpoken);
    }
    runEffects(moveResult.effects, drivers);
    draw(view, coords);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>): void => {
    const coords = getCanvasCoords(e);
    const now = performance.now();
    const view = viewportRef.current;

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
          clearLongPressTimer();
          onBack();
          return;
        }
        const d1 = Math.hypot(p1.current.x - p1.start.x, p1.current.y - p1.start.y);
        const d2 = Math.hypot(p2.current.x - p2.start.x, p2.current.y - p2.start.y);
        if (d1 > TWO_FINGER_MAX_MOVE_PX || d2 > TWO_FINGER_MAX_MOVE_PX) {
          clearLongPressTimer();
        }
      }
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
      drivers.speech.speak(axisSpoken);
    }
    runEffects(moveResult.effects, drivers);
    draw(view, coords);
  };

  const handlePointerLift = (e: PointerEvent<HTMLCanvasElement>): void => {
    clearLongPressTimer();
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size === 0) {
      const { state, effects } = step(engineState.current, { kind: 'lift', t: performance.now() });
      engineState.current = state;
      runEffects(effects, drivers);
      draw(viewportRef.current, null);
    }
  };

  const setDebugOffset = (dx: number, dy: number): void => {
    setDebugText(`First hold: dx=${dx.toFixed(1)}px, dy=${dy.toFixed(1)}px from centre`);
  };

  return (
    <main className="gt-explore">
      <header className="gt-explore__header">
        <h1 className="gt-explore__title">{sceneName(scene)}</h1>
      </header>

      <StatusText className="gt-explore__status" spoken={drivers.speech.canSpeak}>
        {statusMessage}
      </StatusText>

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
          <AccessibleButton
            ref={backButtonRef}
            className="gt-control gt-explore__back"
            onClick={onBack}
          >
            {t('common.back')}
          </AccessibleButton>
        </div>
      </footer>
    </main>
  );
}
