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
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { requestValidate } from '../api/validate';
import { AccessibleButton } from '../components/AccessibleButton';
import { StatusText } from '../components/StatusText';
import {
  applyEdit,
  canRedo,
  canUndo,
  createHistory,
  deletePoint,
  deleteSegment,
  movePoint,
  redo,
  renameLabel,
  undo,
  type HistoryState,
} from '../core/correct';
import type { DiagramScene, Point } from '../core/scene';
import type { Drivers } from '../drivers';
import {
  formatValidationErrors,
  getSelectedLabel,
  getSelectionAnnouncement,
  hitTestCorrect,
  pointerToNorm,
  type CorrectSelection,
} from '../flow/correct';
import { getLang, LANG_BCP47, t } from '../i18n';
import '../styles/correct.css';

export interface CorrectProps {
  scene: DiagramScene;
  photoUrl: string | null;
  drivers: Drivers;
  onSave: (scene: DiagramScene) => void;
  onCancel: () => void;
}

export function Correct({
  scene,
  photoUrl,
  drivers,
  onSave,
  onCancel,
}: CorrectProps): JSX.Element {
  const [history, setHistory] = useState<HistoryState>(() => createHistory(scene));
  const [selection, setSelection] = useState<CorrectSelection>(null);
  const [labelText, setLabelText] = useState('');
  const [statusMessage, setStatusMessage] = useState(() => t('correct.intro'));
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoImgRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragPointIdRef = useRef<string | null>(null);
  const dragSceneRef = useRef<DiagramScene>(scene);

  const speak = (text: string): void => {
    drivers.speech.speak(text, LANG_BCP47[getLang()]);
  };

  const sayAndStatus = (text: string, isErr = false): void => {
    setHasError(isErr);
    setStatusMessage(text);
    speak(text);
  };

  // Announce intro on mount
  useEffect(() => {
    speak(t('correct.intro'));
  }, []);

  // Preload photo if url given
  useEffect(() => {
    if (!photoUrl) {
      photoImgRef.current = null;
      renderCanvas();
      return;
    }
    const img = new Image();
    img.src = photoUrl;
    img.onload = () => {
      photoImgRef.current = img;
      renderCanvas();
    };
    img.onerror = () => {
      photoImgRef.current = null;
      renderCanvas();
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

  const renderCanvas = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw photo background if available
    const img = photoImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, width, height);
      // Dark semi-transparent scrim for overlay readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, width, height);
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

      const isSel = selection?.kind === 'segment' && selection.id === seg.id;
      ctx.beginPath();
      ctx.moveTo(pA.x * width, pA.y * height);
      ctx.lineTo(pB.x * width, pB.y * height);
      ctx.strokeStyle = isSel ? '#58a6ff' : '#3fb950';
      ctx.lineWidth = isSel ? 6 : 4;
      ctx.stroke();

      // Segment label
      if (seg.label) {
        const midX = ((pA.x + pB.x) / 2) * width;
        const midY = ((pA.y + pB.y) / 2) * height;
        drawLabelPill(ctx, seg.label, midX, midY - 10, isSel);
      }
    }

    // Draw polylines
    for (const poly of curScene.polylines ?? []) {
      if (poly.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(poly.points[0]![0] * width, poly.points[0]![1] * height);
      for (let i = 1; i < poly.points.length; i++) {
        const pt = poly.points[i]!;
        ctx.lineTo(pt[0] * width, pt[1] * height);
      }
      ctx.strokeStyle = '#2ea043';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Draw points
    for (const pt of points) {
      const isSel = selection?.kind === 'point' && selection.id === pt.id;
      const sx = pt.x * width;
      const sy = pt.y * height;

      ctx.beginPath();
      ctx.arc(sx, sy, isSel ? 12 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = isSel ? '#58a6ff' : '#3fb950';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Point label
      const displayLabel = pt.label ?? pt.id;
      drawLabelPill(ctx, displayLabel, sx, sy - 18, isSel);
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
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const hit = hitTestCorrect(history.present, px, py, rect.width, rect.height);
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
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const norm = pointerToNorm(px, py, rect.width, rect.height);
    const updated = movePoint(dragSceneRef.current, dragPointIdRef.current, norm.x, norm.y);
    dragSceneRef.current = updated;
    renderCanvas();
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

  const handleDelete = (): void => {
    if (!selection) return;

    if (selection.kind === 'point') {
      const id = selection.id;
      const updated = deletePoint(history.present, id);
      setHistory((h) => applyEdit(h, updated));
      setSelection(null);
      sayAndStatus(`${t('correct.pointDeleted')}: ${id}`);
    } else if (selection.kind === 'segment') {
      const id = selection.id;
      const updated = deleteSegment(history.present, id);
      setHistory((h) => applyEdit(h, updated));
      setSelection(null);
      sayAndStatus(`${t('correct.segmentDeleted')}: ${id}`);
    }
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
    setIsSaving(true);
    sayAndStatus(t('correct.validating'));

    try {
      const res = await requestValidate(history.present);
      setIsSaving(false);
      if (res.ok && res.scene) {
        sayAndStatus(t('correct.saved'));
        drivers.audio.playEarcon?.('success');
        onSave(res.scene);
      } else {
        const errorText = formatValidationErrors(res.errors);
        sayAndStatus(errorText, true);
        drivers.audio.playEarcon?.('error');
      }
    } catch {
      setIsSaving(false);
      const errorText = formatValidationErrors(['Network or server validation error']);
      sayAndStatus(errorText, true);
      drivers.audio.playEarcon?.('error');
    }
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
        <h1 className="gt-correct__title">{t('correct.title')}</h1>
        <AccessibleButton
          className="gt-correct__btn"
          onClick={onCancel}
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
          width={600}
          height={400}
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
