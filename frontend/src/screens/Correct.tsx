/**
 * Correct screen — sighted teacher mode for correcting AI misreads.
 *
 * Requirements: 9.1–9.3, 12.1.
 * - Shows original photo (if present) with scene overlaid
 * - Drag points with pointer events
 * - Edit labels via labelled text input
 * - Delete selected points or segments
 * - Undo / Redo history
 * - Save validates against backend POST /api/v1/validate; refuses invalid scenes
 * - Accessible controls (≥48×48 px targets, spoken state changes, keyboard operable)
 */
import { useEffect, useRef, useState, type FormEvent, type JSX, type KeyboardEvent, type PointerEvent } from 'react';
import {
  requestValidate,
  ValidateRequestError,
  type ValidateRequestOptions,
  type ValidateResponse,
} from '../api/validate';
import { AccessibleButton } from '../components/AccessibleButton';
import { StatusText } from '../components/StatusText';
import {
  applyEdit,
  canRedo,
  canUndo,
  createHistory,
  movePoint,
  redo,
  renameLabel,
  undo,
  validateSceneInvariants,
  type HistoryState,
  type InvariantResult,
} from '../core/correct';
import { makeViewport, toScreen, type Viewport } from '../core/geometry';
import type { DiagramScene, Point } from '../core/scene';
import type { Drivers } from '../drivers';
import {
  formatValidationErrors,
  getSelectedLabel,
  getSelectionAnnouncement,
  hitTestCorrect,
  deleteSelectedElement,
  type CorrectSelection,
} from '../flow/correct';
import {
  isPdfSource,
  pointerToHitTestCoords,
  pointerToScene,
} from '../flow/correctCanvas';
import { getLang, LANG_BCP47, t } from '../i18n';
import '../styles/correct.css';

export interface CorrectProps {
  scene: DiagramScene;
  photoUrl: string | null;
  drivers: Drivers;
  onSave: (scene: DiagramScene, notice?: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface CorrectLeaveActions {
  speak: (text: string) => void;
  confirm: (message: string) => boolean;
  sayAndStatus: (msg: string) => void;
  focusHeading: () => void;
  onLeave: () => void;
}

/**
 * Handle leaving Teacher Correct mode when there are unsaved edits (R5-04).
 * Reuses the same pattern as Teach.tsx with confirmation.
 */
export function executeCorrectLeave(
  isDirty: boolean,
  actions: CorrectLeaveActions,
): { stayed: boolean } {
  if (isDirty) {
    actions.speak(t('correct.confirmLeave'));
    const confirmed = actions.confirm(t('correct.confirmLeave'));
    if (!confirmed) {
      actions.sayAndStatus(t('correct.stayingInEditor'));
      actions.focusHeading();
      return { stayed: true };
    }
  }
  actions.onLeave();
  return { stayed: false };
}

export type SaveCorrectResult =
  | { kind: 'saved'; scene: DiagramScene; messageKey: 'correct.saved' }
  | { kind: 'saved-offline'; scene: DiagramScene; messageKey: 'correct.savedOffline' }
  | { kind: 'invalid'; errors: string[] };

export interface ExecuteCorrectSaveOptions {
  isOnline?: boolean;
  requestValidate?: (
    scene: DiagramScene,
    options?: ValidateRequestOptions,
  ) => Promise<ValidateResponse>;
  validateInvariants?: (scene: DiagramScene) => InvariantResult;
  signal?: AbortSignal;
}

/**
 * Pure decision and execution helper for saving corrections (B4-02).
 * Validates with backend /validate when online; falls back to local
 * invariant validation without blocking when offline or backend unreachable.
 */
export async function executeCorrectSave(
  scene: DiagramScene,
  options: ExecuteCorrectSaveOptions = {},
): Promise<SaveCorrectResult> {
  const isOnline =
    options.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true);
  const doValidateInvariants = options.validateInvariants ?? validateSceneInvariants;
  const doRequestValidate = options.requestValidate ?? requestValidate;
  const signal = options.signal;

  if (signal?.aborted) {
    throw new ValidateRequestError('aborted');
  }

  const fallback = (): SaveCorrectResult => {
    const local = doValidateInvariants(scene);
    if (local.ok) {
      return { kind: 'saved-offline', scene, messageKey: 'correct.savedOffline' };
    }
    return { kind: 'invalid', errors: local.errors };
  };

  if (!isOnline) {
    return fallback();
  }

  try {
    const res = await (signal ? doRequestValidate(scene, { signal }) : doRequestValidate(scene));
    if (signal?.aborted) {
      throw new ValidateRequestError('aborted');
    }
    if (res.ok && res.scene) {
      return { kind: 'saved', scene: res.scene, messageKey: 'correct.saved' };
    }
    return { kind: 'invalid', errors: res.errors };
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof ValidateRequestError && err.failure === 'aborted')) {
      throw err;
    }
    return fallback();
  }
}

export function Correct({
  scene,
  photoUrl,
  drivers,
  onSave,
  onCancel,
  onDirtyChange,
}: CorrectProps): JSX.Element {
  const [history, setHistory] = useState<HistoryState>(() => createHistory(scene));
  const [selection, setSelection] = useState<CorrectSelection>(null);
  const [labelText, setLabelText] = useState('');
  const [statusMessage, setStatusMessage] = useState(() => t('correct.intro'));
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isSavingRef = useRef(false);
  const isMountedRef = useRef(true);
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const isDirty = canUndo(history);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      saveAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoImgRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragPointIdRef = useRef<string | null>(null);
  const dragSceneRef = useRef<DiagramScene>(scene);
  const viewportRef = useRef<Viewport>(makeViewport(600, 400));

  const speak = (text: string): void => {
    drivers.speech.speak(text, LANG_BCP47[getLang()]);
  };

  const sayAndStatus = (text: string, isErr = false): void => {
    setHasError(isErr);
    setStatusMessage(text);
    speak(text);
  };

  // Announce intro on mount and move focus to screen heading (Finding 8)
  useEffect(() => {
    headingRef.current?.focus();
    speak(t('correct.intro'));
  }, []);

  // Update canvas bitmap dimensions to match real CSS box and device pixel ratio (BUG-02)
  const updateDimensions = (): Viewport => {
    const canvas = canvasRef.current;
    if (!canvas) return viewportRef.current;
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
    renderCanvas(view);
    return view;
  };

  // Sizing effect with ResizeObserver and window resize listener
  useEffect(() => {
    updateDimensions();

    const handleResize = (): void => {
      updateDimensions();
    };
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
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, []);

  // Preload photo if url given, guarding against PDF blobs / URLs (Finding 17)
  useEffect(() => {
    if (!photoUrl) {
      photoImgRef.current = null;
      renderCanvas();
      return;
    }

    let cancelled = false;

    const checkAndLoad = async (): Promise<void> => {
      // Synchronous guard for PDF extension / data URI
      if (isPdfSource(photoUrl)) {
        photoImgRef.current = null;
        renderCanvas();
        return;
      }

      // Asynchronous guard for blob: URLs
      if (photoUrl.startsWith('blob:') && typeof fetch !== 'undefined') {
        try {
          const res = await fetch(photoUrl);
          const blob = await res.blob();
          if (blob.type === 'application/pdf' || (blob.type && !blob.type.startsWith('image/'))) {
            if (!cancelled) {
              photoImgRef.current = null;
              renderCanvas();
            }
            return;
          }
        } catch {
          // Fall back to Image decoding check
        }
      }

      if (cancelled) return;

      const img = new Image();
      img.src = photoUrl;
      img.onload = () => {
        if (!cancelled) {
          photoImgRef.current = img;
          renderCanvas();
        }
      };
      img.onerror = () => {
        if (!cancelled) {
          photoImgRef.current = null;
          renderCanvas();
        }
      };
    };

    void checkAndLoad();

    return () => {
      cancelled = true;
      photoImgRef.current = null;
    };
  }, [photoUrl]);

  // Synchronize label text when selection changes
  useEffect(() => {
    if (selection) {
      setLabelText(getSelectedLabel(history.present, selection));
    } else {
      setLabelText('');
    }
  }, [selection, history.present]);

  // Render canvas whenever present scene or selection changes
  useEffect(() => {
    dragSceneRef.current = history.present;
    renderCanvas();
  }, [history.present, selection]);

  const renderCanvas = (view: Viewport = viewportRef.current): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { canvasWidth: width, canvasHeight: height } = view;
    ctx.clearRect(0, 0, width, height);

    // Canvas background
    ctx.fillStyle = '#0b0e0c';
    ctx.fillRect(0, 0, width, height);

    // Draw photo background if available, letterboxed into the diagram unit square
    const img = photoImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, view.offsetX, view.offsetY, view.scale, view.scale);
      // Dark semi-transparent scrim for overlay readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(view.offsetX, view.offsetY, view.scale, view.scale);
    }

    const curScene = dragSceneRef.current;
    const points = curScene.points ?? [];
    const pointMap = new Map<string, Point>();
    for (const p of points) pointMap.set(p.id, p);

    // Draw segments
    for (const seg of curScene.segments ?? []) {
      const pA = pointMap.get(seg.a);
      const pB = pointMap.get(seg.b);
      if (!pA || !pB) continue;

      const sA = toScreen(pA, view);
      const sB = toScreen(pB, view);

      const isSel = selection?.kind === 'segment' && selection.id === seg.id;
      ctx.beginPath();
      ctx.moveTo(sA.x, sA.y);
      ctx.lineTo(sB.x, sB.y);
      ctx.strokeStyle = isSel ? '#58a6ff' : '#3fb950';
      ctx.lineWidth = isSel ? 6 : 4;
      ctx.stroke();

      // Segment label
      if (seg.label) {
        const midX = (sA.x + sB.x) / 2;
        const midY = (sA.y + sB.y) / 2;
        drawLabelPill(ctx, seg.label, midX, midY - 10, isSel);
      }
    }

    // Draw bars for bar charts
    for (const bar of curScene.bars ?? []) {
      const bx = view.offsetX + bar.x0 * view.scale;
      const bw = (bar.x1 - bar.x0) * view.scale;
      const by = view.offsetY + bar.y_top * view.scale;
      const bh = (bar.y_base - bar.y_top) * view.scale;

      const isSel = selection?.kind === 'bar' && selection.id === bar.id;
      ctx.fillStyle = isSel ? 'rgba(88, 166, 255, 0.4)' : 'rgba(57, 255, 136, 0.3)';
      ctx.strokeStyle = isSel ? '#58a6ff' : '#39ff88';
      ctx.lineWidth = isSel ? 4 : 2;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      const barLabel = bar.label?.trim()
        ? `${bar.label.trim()} (${bar.value})`
        : `${bar.id} (${bar.value})`;
      drawLabelPill(ctx, barLabel, bx + bw / 2, by - 12, isSel);
    }

    // Draw polylines
    for (const poly of curScene.polylines ?? []) {
      if (poly.points.length < 2) continue;
      const isSel = selection?.kind === 'polyline' && selection.id === poly.id;
      const p0 = poly.points[0];
      if (!p0) continue;
      const start = toScreen({ x: p0[0], y: p0[1] }, view);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < poly.points.length; i++) {
        const ptCoord = poly.points[i];
        if (!ptCoord) continue;
        const pt = toScreen({ x: ptCoord[0], y: ptCoord[1] }, view);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = isSel ? '#58a6ff' : '#2ea043';
      ctx.lineWidth = isSel ? 6 : 3;
      ctx.stroke();

      if (poly.label && poly.points.length > 0) {
        const midIdx = Math.floor(poly.points.length / 2);
        const midPt = poly.points[midIdx];
        if (midPt) {
          const sm = toScreen({ x: midPt[0], y: midPt[1] }, view);
          drawLabelPill(ctx, poly.label, sm.x, sm.y - 12, isSel);
        }
      }
    }

    // Draw points
    for (const pt of points) {
      const isSel = selection?.kind === 'point' && selection.id === pt.id;
      const sp = toScreen(pt, view);

      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isSel ? 12 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = isSel ? '#58a6ff' : '#3fb950';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Point label
      const displayLabel = pt.label ?? pt.id;
      drawLabelPill(ctx, displayLabel, sp.x, sp.y - 18, isSel);
    }
  };

  const drawLabelPill = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    isSelected: boolean,
  ): void => {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(text).width;
    const paddingX = 6;
    const boxW = textWidth + paddingX * 2;
    const boxH = 18;

    ctx.fillStyle = isSelected ? 'rgba(31, 111, 235, 0.9)' : 'rgba(13, 17, 23, 0.85)';
    ctx.strokeStyle = isSelected ? '#ffffff' : '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const view = viewportRef.current;

    // Convert pointer to letterbox-relative coordinates for hit testing (BUG-02)
    const { px, py } = pointerToHitTestCoords(e.clientX, e.clientY, rect, view);
    const hit = hitTestCorrect(history.present, px, py, view.scale, view.scale);
    setSelection(hit);

    if (hit) {
      const announcement = getSelectionAnnouncement(history.present, hit);
      sayAndStatus(announcement);
      if (hit.kind === 'point') {
        isDraggingRef.current = true;
        dragPointIdRef.current = hit.id;
        dragSceneRef.current = history.present;
        canvas.setPointerCapture(e.pointerId);
      }
    } else {
      sayAndStatus(t('correct.noSelection'));
      isDraggingRef.current = false;
      dragPointIdRef.current = null;
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>): void => {
    if (!isDraggingRef.current || !dragPointIdRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const view = viewportRef.current;
    const bitmapSize = { width: canvas.width, height: canvas.height };

    // Convert pointer to normalized scene point using the same Viewport (BUG-02)
    const norm = pointerToScene(e.clientX, e.clientY, rect, bitmapSize, dpr, view);
    const updated = movePoint(dragSceneRef.current, dragPointIdRef.current, norm.x, norm.y);
    dragSceneRef.current = updated;
    renderCanvas(view);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>): void => {
    if (isDraggingRef.current && dragPointIdRef.current) {
      isDraggingRef.current = false;
      const pointId = dragPointIdRef.current;
      dragPointIdRef.current = null;
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }

      if (dragSceneRef.current !== history.present) {
        setHistory((h) => applyEdit(h, dragSceneRef.current));
        sayAndStatus(`${t('correct.pointMoved')}: ${pointId}`);
      }
    }
  };

  const handleLabelSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!selection) return;

    const trimmed = labelText.trim();
    if (!trimmed) {
      sayAndStatus(t('correct.labelEmpty'), true);
      return;
    }

    try {
      const updated = renameLabel(history.present, selection.id, trimmed);
      setHistory((h) => applyEdit(h, updated));
      sayAndStatus(t('correct.labelUpdated'));
    } catch {
      sayAndStatus(t('correct.labelEmpty'), true);
    }
  };

  const handleSelectElement = (sel: CorrectSelection): void => {
    setSelection(sel);
    if (sel) {
      const announcement = getSelectionAnnouncement(history.present, sel);
      sayAndStatus(announcement);
    } else {
      sayAndStatus(t('correct.noSelection'));
    }
  };

  const handleDelete = (): void => {
    if (!selection) return;

    const result = deleteSelectedElement(history.present, selection);
    if (result.isNoOp) {
      sayAndStatus(result.announcement);
      return;
    }

    setHistory((h) => applyEdit(h, result.scene));
    setSelection(null);
    sayAndStatus(result.announcement);
  };

  const handleUndo = (): void => {
    if (!canUndo(history)) return;
    setHistory((h) => undo(h));
    sayAndStatus(t('correct.undo'));
  };

  const handleRedo = (): void => {
    if (!canRedo(history)) return;
    setHistory((h) => redo(h));
    sayAndStatus(t('correct.redo'));
  };

  const handleSave = async (): Promise<void> => {
    if (isSavingRef.current || !isMountedRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    sayAndStatus(t('correct.validating'));

    const abortController = new AbortController();
    saveAbortControllerRef.current = abortController;

    try {
      const result = await executeCorrectSave(history.present, {
        signal: abortController.signal,
      });
      if (!isMountedRef.current || abortController.signal.aborted) {
        return;
      }
      if (result.kind === 'saved' || result.kind === 'saved-offline') {
        setStatusMessage(t(result.messageKey));
        drivers.audio.playEarcon?.('success');
        onSave(result.scene, t(result.messageKey));
      } else {
        isSavingRef.current = false;
        setIsSaving(false);
        const errorText = formatValidationErrors(result.errors);
        sayAndStatus(errorText, true);
        drivers.audio.playEarcon?.('error');
      }
    } catch {
      if (!isMountedRef.current) return;
      isSavingRef.current = false;
      setIsSaving(false);
    } finally {
      if (saveAbortControllerRef.current === abortController) {
        saveAbortControllerRef.current = null;
      }
    }
  };

  const handleCancel = (): void => {
    executeCorrectLeave(isDirty, {
      speak,
      confirm: (msg) =>
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(msg)
          : true,
      sayAndStatus,
      focusHeading: () => headingRef.current?.focus(),
      onLeave: () => {
        isMountedRef.current = false;
        saveAbortControllerRef.current?.abort();
        onDirtyChange?.(false);
        onCancel();
      },
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLCanvasElement>): void => {
    if (e.key === 'Escape') {
      setSelection(null);
      sayAndStatus(t('correct.noSelection'));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selection) handleDelete();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (e.shiftKey) handleRedo();
      else handleUndo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      handleRedo();
    } else if (selection?.kind === 'point') {
      const pt = (history.present.points ?? []).find((p) => p.id === selection.id);
      if (!pt) return;
      const STEP = 0.02;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp') dy = -STEP;
      else if (e.key === 'ArrowDown') dy = STEP;
      else if (e.key === 'ArrowLeft') dx = -STEP;
      else if (e.key === 'ArrowRight') dx = STEP;
      else return;

      e.preventDefault();
      const updated = movePoint(history.present, pt.id, pt.x + dx, pt.y + dy);
      setHistory((h) => applyEdit(h, updated));
      sayAndStatus(`${t('correct.pointMoved')}: ${pt.id}`);
    }
  };

  return (
    <main className="gt-correct">
      <header className="gt-correct__header">
        <h1 className="gt-correct__title" tabIndex={-1} ref={headingRef}>
          {t('correct.title')}
        </h1>
        <AccessibleButton
          className="gt-correct__btn"
          onClick={handleCancel}
          disabled={isSaving}
        >
          {t('correct.cancel')}
        </AccessibleButton>
      </header>

      {/* Spoken and visual status card */}
      <div className="gt-correct__status-card">
        <StatusText
          className={`gt-correct__status ${hasError ? 'gt-correct__status--error' : ''}`}
          spoken={drivers.speech.canSpeak}
        >
          {statusMessage}
        </StatusText>
      </div>

      {/* Overlay Canvas */}
      <div className="gt-correct__canvas-container">
        <canvas
          ref={canvasRef}
          className="gt-correct__canvas"
          tabIndex={0}
          role="img"
          aria-label={t('correct.photoOverlay')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Accessible element selection list for keyboard and screen-reader users */}
      {((history.present.points?.length ?? 0) > 0 ||
        (history.present.segments?.length ?? 0) > 0 ||
        (history.present.polylines?.length ?? 0) > 0 ||
        (history.present.bars?.length ?? 0) > 0) && (
        <section className="gt-correct__elements" aria-label={t('correct.photoOverlay')}>
          <div className="gt-correct__element-list" role="list">
            {(history.present.points ?? []).map((pt) => {
              const label = pt.label ? `${pt.label} (${pt.id})` : pt.id;
              const isSel = selection?.kind === 'point' && selection.id === pt.id;
              const cls = `gt-correct__btn gt-correct__element-btn ${
                isSel ? 'gt-correct__element-btn--selected' : ''
              }`;
              return (
                <AccessibleButton
                  key={`point-${pt.id}`}
                  className={cls}
                  aria-pressed={isSel}
                  onClick={() => handleSelectElement({ kind: 'point', id: pt.id })}
                >
                  {`${t('correct.selectedPoint')}: ${label}`}
                </AccessibleButton>
              );
            })}
            {(history.present.segments ?? []).map((seg) => {
              const label = seg.label ? `${seg.label} (${seg.id})` : seg.id;
              const isSel = selection?.kind === 'segment' && selection.id === seg.id;
              const cls = `gt-correct__btn gt-correct__element-btn ${
                isSel ? 'gt-correct__element-btn--selected' : ''
              }`;
              return (
                <AccessibleButton
                  key={`segment-${seg.id}`}
                  className={cls}
                  aria-pressed={isSel}
                  onClick={() => handleSelectElement({ kind: 'segment', id: seg.id })}
                >
                  {`${t('correct.selectedSegment')}: ${label}`}
                </AccessibleButton>
              );
            })}
            {(history.present.polylines ?? []).map((poly) => {
              const label = poly.label ? `${poly.label} (${poly.id})` : poly.id;
              const isSel = selection?.kind === 'polyline' && selection.id === poly.id;
              const cls = `gt-correct__btn gt-correct__element-btn ${
                isSel ? 'gt-correct__element-btn--selected' : ''
              }`;
              return (
                <AccessibleButton
                  key={`polyline-${poly.id}`}
                  className={cls}
                  aria-pressed={isSel}
                  onClick={() => handleSelectElement({ kind: 'polyline', id: poly.id })}
                >
                  {`${t('correct.selectedPolyline')}: ${label}`}
                </AccessibleButton>
              );
            })}
            {(history.present.bars ?? []).map((bar) => {
              const label = bar.label ? `${bar.label} (${bar.id})` : bar.id;
              const isSel = selection?.kind === 'bar' && selection.id === bar.id;
              const cls = `gt-correct__btn gt-correct__element-btn ${
                isSel ? 'gt-correct__element-btn--selected' : ''
              }`;
              return (
                <AccessibleButton
                  key={`bar-${bar.id}`}
                  className={cls}
                  aria-pressed={isSel}
                  onClick={() => handleSelectElement({ kind: 'bar', id: bar.id })}
                >
                  {`${t('correct.selectedBar')}: ${label}`}
                </AccessibleButton>
              );
            })}
          </div>
        </section>
      )}

      {/* Label Edit Panel when an element is selected */}
      {selection && (
        <section className="gt-correct__edit-panel" aria-label={t('correct.label')}>
          <form className="gt-correct__label-form" onSubmit={handleLabelSubmit}>
            <label htmlFor="gt-correct-label-input" className="gt-visually-hidden">
              {t('correct.label')}
            </label>
            <input
              id="gt-correct-label-input"
              type="text"
              className="gt-correct__label-input"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder={t('correct.label')}
              disabled={isSaving}
              maxLength={100}
            />
            <AccessibleButton
              type="submit"
              className="gt-correct__btn"
              disabled={isSaving || !labelText.trim()}
            >
              {t('correct.applyLabel')}
            </AccessibleButton>
          </form>
        </section>
      )}

      {/* Toolbar actions */}
      <footer className="gt-correct__toolbar">
        <div className="gt-correct__toolbar-group">
          <AccessibleButton
            className="gt-correct__btn"
            onClick={handleUndo}
            disabled={isSaving || !canUndo(history)}
          >
            {t('correct.undo')}
          </AccessibleButton>
          <AccessibleButton
            className="gt-correct__btn"
            onClick={handleRedo}
            disabled={isSaving || !canRedo(history)}
          >
            {t('correct.redo')}
          </AccessibleButton>
          <AccessibleButton
            className="gt-correct__btn gt-correct__btn--danger"
            onClick={handleDelete}
            disabled={isSaving || !selection}
          >
            {t('correct.delete')}
          </AccessibleButton>
        </div>

        <AccessibleButton
          className="gt-correct__btn gt-correct__btn--primary"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          {isSaving ? t('correct.validating') : t('correct.save')}
        </AccessibleButton>
      </footer>
    </main>
  );
}
