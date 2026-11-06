/**
 * TeachCanvas — live interactive diagram canvas for Teacher Editor mode.
 *
 * Requirements:
 * - Live preview of points, segments, polylines, bars, and axes
 * - Pointer drag for points with pointer capture
 * - Hit testing for point and segment selection
 * - Accessible keyboard interaction: Arrow keys nudge selected point, Delete/Backspace removes
 * - Responsive letterboxing with device pixel ratio scaling
 */

import {
  useEffect,
  useRef,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { makeViewport, toScreen, type Viewport } from '../../core/geometry';
import type { DiagramScene, Point } from '../../core/scene';
import {
  hitTestCorrect,
  type CorrectSelection,
} from '../../flow/correct';
import {
  pointerToHitTestCoords,
  pointerToScene,
} from '../../flow/correctCanvas';
import { t } from '../../i18n';

export interface TeachCanvasProps {
  scene: DiagramScene;
  selection: CorrectSelection;
  onSelect: (selection: CorrectSelection) => void;
  onMovePoint: (pointId: string, x: number, y: number) => void;
  onNudgePoint: (pointId: string, dx: number, dy: number) => void;
  onDeleteSelected: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function TeachCanvas({
  scene,
  selection,
  onSelect,
  onMovePoint,
  onNudgePoint,
  onDeleteSelected,
  onUndo,
  onRedo,
}: TeachCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const dragPointIdRef = useRef<string | null>(null);
  const dragCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<Viewport>(makeViewport(600, 400));

  const updateDimensions = (): Viewport => {
    const canvas = canvasRef.current;
    if (!canvas) return viewportRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

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

  useEffect(() => {
    renderCanvas();
  }, [scene, selection]);

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

    ctx.fillStyle = isSelected ? 'rgba(57, 255, 136, 0.95)' : 'rgba(13, 17, 23, 0.85)';
    ctx.strokeStyle = isSelected ? '#ffffff' : '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#0b0b10' : '#ffffff';
    ctx.fillText(text, x, y);
  };

  const renderCanvas = (view: Viewport = viewportRef.current): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { canvasWidth: width, canvasHeight: height } = view;
    ctx.clearRect(0, 0, width, height);

    // Canvas background conforming to high-contrast creature palette (#0b0b10)
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, width, height);

    // Subtle diagram bounding box
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(view.offsetX, view.offsetY, view.scale, view.scale);

    // Draw function_graph axes if present
    if (scene.axes?.x_axis_y != null) {
      const sy = view.offsetY + scene.axes.x_axis_y * view.scale;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(view.offsetX, sy);
      ctx.lineTo(view.offsetX + view.scale, sy);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      drawLabelPill(ctx, 'X-axis', view.offsetX + 30, sy - 12, false);
    }

    if (scene.axes?.y_axis_x != null) {
      const sx = view.offsetX + scene.axes.y_axis_x * view.scale;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(sx, view.offsetY);
      ctx.lineTo(sx, view.offsetY + view.scale);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      drawLabelPill(ctx, 'Y-axis', sx + 25, view.offsetY + 14, false);
    }

    // Draw bars for bar charts
    for (const bar of scene.bars ?? []) {
      const bx = view.offsetX + bar.x0 * view.scale;
      const bw = (bar.x1 - bar.x0) * view.scale;
      const by = view.offsetY + bar.y_top * view.scale;
      const bh = (bar.y_base - bar.y_top) * view.scale;

      ctx.fillStyle = 'rgba(57, 255, 136, 0.3)';
      ctx.strokeStyle = '#39ff88';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      drawLabelPill(ctx, `${bar.label} (${bar.value})`, bx + bw / 2, by - 12, false);
    }

    // Draw polylines
    for (const poly of scene.polylines ?? []) {
      if (poly.points.length < 2) continue;
      const start = toScreen({ x: poly.points[0]![0], y: poly.points[0]![1] }, view);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < poly.points.length; i++) {
        const pt = toScreen({ x: poly.points[i]![0], y: poly.points[i]![1] }, view);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#2ea043';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const points = scene.points ?? [];
    const pointMap = new Map<string, Point>();
    for (const p of points) pointMap.set(p.id, p);

    // Draw segments
    for (const seg of scene.segments ?? []) {
      const pA = pointMap.get(seg.a);
      const pB = pointMap.get(seg.b);
      if (!pA || !pB) continue;

      const sA = toScreen(pA, view);
      const sB = toScreen(pB, view);

      const isSel = selection?.kind === 'segment' && selection.id === seg.id;
      ctx.beginPath();
      ctx.moveTo(sA.x, sA.y);
      ctx.lineTo(sB.x, sB.y);
      ctx.strokeStyle = isSel ? '#58a6ff' : '#39ff88';
      ctx.lineWidth = isSel ? 6 : 4;
      ctx.stroke();

      if (seg.label) {
        const midX = (sA.x + sB.x) / 2;
        const midY = (sA.y + sB.y) / 2;
        drawLabelPill(ctx, seg.label, midX, midY - 12, isSel);
      }
    }

    // Draw points
    for (const pt of points) {
      const isSel = selection?.kind === 'point' && selection.id === pt.id;
      const sp = toScreen(pt, view);

      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isSel ? 12 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = isSel ? '#58a6ff' : '#39ff88';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const displayLabel = pt.label ?? pt.id;
      drawLabelPill(ctx, displayLabel, sp.x, sp.y - 18, isSel);
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const view = viewportRef.current;

    const { px, py } = pointerToHitTestCoords(e.clientX, e.clientY, rect, view);
    const hit = hitTestCorrect(scene, px, py, view.scale, view.scale);
    onSelect(hit);

    if (hit && hit.kind === 'point') {
      isDraggingRef.current = true;
      dragPointIdRef.current = hit.id;
      dragCoordsRef.current = null;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Safe pointer capture
      }
    } else {
      isDraggingRef.current = false;
      dragPointIdRef.current = null;
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!isDraggingRef.current || !dragPointIdRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const view = viewportRef.current;
    const bitmapSize = { width: canvas.width, height: canvas.height };

    const norm = pointerToScene(e.clientX, e.clientY, rect, bitmapSize, dpr, view);
    dragCoordsRef.current = norm;

    // Temporary live redraw during drag
    const pointId = dragPointIdRef.current;
    const updatedPoints = (scene.points ?? []).map((p) =>
      p.id === pointId ? { ...p, x: norm.x, y: norm.y } : p,
    );
    const tempScene = { ...scene, points: updatedPoints };
    renderCanvasWithScene(tempScene, view);
  };

  const renderCanvasWithScene = (overrideScene: DiagramScene, view: Viewport): void => {
    const origScene = scene;
    void origScene;
    // Render with override
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { canvasWidth: width, canvasHeight: height } = view;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(view.offsetX, view.offsetY, view.scale, view.scale);

    const points = overrideScene.points ?? [];
    const pointMap = new Map<string, Point>();
    for (const p of points) pointMap.set(p.id, p);

    for (const seg of overrideScene.segments ?? []) {
      const pA = pointMap.get(seg.a);
      const pB = pointMap.get(seg.b);
      if (!pA || !pB) continue;
      const sA = toScreen(pA, view);
      const sB = toScreen(pB, view);
      ctx.beginPath();
      ctx.moveTo(sA.x, sA.y);
      ctx.lineTo(sB.x, sB.y);
      ctx.strokeStyle = '#39ff88';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    for (const pt of points) {
      const isSel = selection?.kind === 'point' && selection.id === pt.id;
      const sp = toScreen(pt, view);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isSel ? 12 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = isSel ? '#58a6ff' : '#39ff88';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawLabelPill(ctx, pt.label ?? pt.id, sp.x, sp.y - 18, isSel);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (isDraggingRef.current && dragPointIdRef.current) {
      const pointId = dragPointIdRef.current;
      const finalCoords = dragCoordsRef.current;

      isDraggingRef.current = false;
      dragPointIdRef.current = null;
      dragCoordsRef.current = null;

      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Safe pointer release
      }

      if (finalCoords) {
        onMovePoint(pointId, finalCoords.x, finalCoords.y);
      }
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLCanvasElement>): void => {
    if (e.key === 'Escape') {
      onSelect(null);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selection) {
        e.preventDefault();
        onDeleteSelected();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) onRedo?.();
      else onUndo?.();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      onRedo?.();
    } else if (selection?.kind === 'point') {
      const STEP = 0.02;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp') dy = -STEP;
      else if (e.key === 'ArrowDown') dy = STEP;
      else if (e.key === 'ArrowLeft') dx = -STEP;
      else if (e.key === 'ArrowRight') dx = STEP;
      else return;

      e.preventDefault();
      onNudgePoint(selection.id, dx, dy);
    }
  };

  return (
    <div className="gt-teach-canvas-container">
      <canvas
        ref={canvasRef}
        className="gt-teach-canvas"
        tabIndex={0}
        role="img"
        aria-label={t('teach.canvasLabel')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
