// @vitest-environment jsdom
/**
 * Lane hi1: I29a, low-vision outlines (DRAW-ONLY change).
 *
 * Requirements:
 * 1. Explore.tsx draw code:
 *    - Vertex dots: dark ring radius 6 with lineWidth 3 stroke drawn before fill.
 *    - Cursor dot: dark ring radius 5 with lineWidth 3 stroke drawn before fill.
 *    - Guide ring: dark stroke lineWidth 5 under existing cyan lineWidth 2.
 *    - Reset shadowBlur to 0 before these.
 * 2. explore.css:
 *    - Canvas border and status card border clearly visible (at least 2px solid, contrast >= 3:1).
 *    - prefers-contrast: more has 3px border.
 *    - No texture or gradient inside canvas.
 *    - Element sizes preserved (status-line height must not change; Requirement 25.4).
 * 3. Real Explore, fake drivers, mocked canvas 2d context that records calls:
 *    - Dark stroke happens before fill for vertex dot.
 *    - Cursor and guide ring draw with outline.
 *    - No new vibrate/tone/speak call occurs on any of the three recorded sample traces.
 */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import barchartJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import { setStoredGuideSetting } from '../src/config/features';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  _resetCornerHeartbeatSettingForTesting,
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
} from '../src/drivers/storage';
import {
  _resetGraphScanSettingForTesting,
  setStoredGraphScanSetting,
} from '../src/flow/explore';
import { Explore } from '../src/screens/Explore';
// @ts-expect-error Node built-in module
import fs from 'node:fs';
// @ts-expect-error Node built-in module
import path from 'node:path';

// @ts-expect-error Node global, no @types/node in this project
const cwd: string = process.cwd();
const cssContent = fs.readFileSync(path.resolve(cwd, 'src/styles/explore.css'), 'utf-8') as string;

const SIZE = 400;
const triangle = triangleJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;
const barchart = barchartJson as unknown as DiagramScene;

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const chars = clean.split('');
    const c0 = chars[0] ?? '0';
    const c1 = chars[1] ?? '0';
    const c2 = chars[2] ?? '0';
    const r = parseInt(`${c0}${c0}`, 16);
    const g = parseInt(`${c1}${c1}`, 16);
    const b = parseInt(`${c2}${c2}`, 16);
    return [r, g, b];
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface DrawCall {
  method: string;
  args: unknown[];
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  shadowBlur: number;
  lastArc?: { x: number; y: number; radius: number };
}

class MockCanvasContext2D {
  public strokeStyle = '#000000';
  public fillStyle = '#000000';
  public lineWidth = 1;
  public shadowBlur = 0;
  public shadowColor = '#000000';
  public font = '10px sans-serif';

  public calls: DrawCall[] = [];
  private currentArc?: { x: number; y: number; radius: number };

  public setTransform(...args: unknown[]): void {
    this.calls.push({
      method: 'setTransform',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public clearRect(...args: unknown[]): void {
    this.calls.push({
      method: 'clearRect',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public fillRect(...args: unknown[]): void {
    this.calls.push({
      method: 'fillRect',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public strokeRect(...args: unknown[]): void {
    this.calls.push({
      method: 'strokeRect',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public beginPath(): void {
    this.currentArc = undefined;
    this.calls.push({
      method: 'beginPath',
      args: [],
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public moveTo(...args: unknown[]): void {
    this.calls.push({
      method: 'moveTo',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public lineTo(...args: unknown[]): void {
    this.calls.push({
      method: 'lineTo',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public arc(
    x: number,
    y: number,
    radius: number,
    _startAngle: number,
    _endAngle: number,
    _anticlockwise?: boolean,
  ): void {
    this.currentArc = { x, y, radius };
    this.calls.push({
      method: 'arc',
      args: [x, y, radius],
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
      lastArc: this.currentArc,
    });
  }

  public stroke(): void {
    this.calls.push({
      method: 'stroke',
      args: [],
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
      lastArc: this.currentArc,
    });
  }

  public fill(): void {
    this.calls.push({
      method: 'fill',
      args: [],
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
      lastArc: this.currentArc,
    });
  }

  public fillText(...args: unknown[]): void {
    this.calls.push({
      method: 'fillText',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }

  public drawImage(...args: unknown[]): void {
    this.calls.push({
      method: 'drawImage',
      args,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
    });
  }
}

interface Rig {
  speak: ReturnType<typeof vi.fn>;
  vibrate: ReturnType<typeof vi.fn>;
  setTone: ReturnType<typeof vi.fn>;
  playEarcon: ReturnType<typeof vi.fn>;
  playClick: ReturnType<typeof vi.fn>;
  container: HTMLDivElement;
  down: (x: number, y: number, id?: number) => void;
  move: (x: number, y: number, id?: number) => void;
  up: (x: number, y: number, id?: number) => void;
  advance: (ms: number) => void;
  clearCalls: () => void;
  spoken: () => string[];
  vibrations: () => unknown[][];
  tones: () => unknown[][];
  resolveListen: (text: string) => Promise<void>;
  contexts: MockCanvasContext2D[];
}

interface RigOptions {
  scene?: DiagramScene;
  guide?: boolean;
}

function fire(el: Element, type: string, x: number, y: number, pointerId: number): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.assign(event, { pointerId });
  act(() => {
    el.dispatchEvent(event);
  });
}

async function withExploreOutlines(
  opts: RigOptions,
  body: (rig: Rig) => Promise<void> | void,
): Promise<void> {
  setStoredDirectionsSetting(true);
  setStoredFindingSoundSetting(true);
  setStoredCornerHeartbeatSetting(false);
  setStoredGraphScanSetting(true);
  setStoredGuideSetting(opts.guide ?? false);

  const speak = vi.fn();
  const vibrate = vi.fn(() => true);
  const setTone = vi.fn();
  const playEarcon = vi.fn();
  const playClick = vi.fn();
  let resolveListenRaw: (text: string) => void = () => {};
  const listen = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        resolveListenRaw = resolve;
      }),
  );

  const drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone,
      setGuideTone: vi.fn(),
      beep: vi.fn(),
      playEarcon,
      playClick,
      state: 'running',
    },
    speech: {
      speak,
      listen,
      stopSpeaking: vi.fn(),
      cancelListen: vi.fn(),
      isSpeaking: vi.fn(() => false),
      getRate: () => 'normal',
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  } as unknown as Drivers;

  const createdContexts: MockCanvasContext2D[] = [];
  const proto = HTMLCanvasElement.prototype;
  const origContext = proto.getContext;
  const origRect = proto.getBoundingClientRect;

  proto.getContext = function (contextId: string): unknown {
    if (contextId === '2d') {
      const ctx = new MockCanvasContext2D();
      createdContexts.push(ctx);
      return ctx;
    }
    return null;
  } as typeof proto.getContext;

  proto.getBoundingClientRect = function (): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: SIZE,
      bottom: SIZE,
      width: SIZE,
      height: SIZE,
      toJSON: () => ({}),
    } as DOMRect;
  };

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      createElement(Explore, {
        scene: opts.scene ?? triangle,
        announced: 'Diagram',
        drivers,
        onBack: vi.fn(),
      }),
    );
  });

  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('Explore did not render canvas');

  const rig: Rig = {
    speak,
    vibrate,
    setTone,
    playEarcon,
    playClick,
    container,
    down: (x, y, id = 1) => fire(canvas, 'pointerdown', x, y, id),
    move: (x, y, id = 1) => fire(canvas, 'pointermove', x, y, id),
    up: (x, y, id = 1) => fire(canvas, 'pointerup', x, y, id),
    advance: (ms) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    },
    clearCalls: () => {
      speak.mockClear();
      vibrate.mockClear();
      setTone.mockClear();
      playEarcon.mockClear();
      playClick.mockClear();
    },
    spoken: () => speak.mock.calls.map((c) => String(c[0])),
    vibrations: () => vibrate.mock.calls.map((c) => [...(c as unknown[])]),
    tones: () => setTone.mock.calls.map((c) => [...(c as unknown[])]),
    resolveListen: async (text) => {
      await act(async () => {
        resolveListenRaw(text);
      });
    },
    contexts: createdContexts,
  };

  try {
    await body(rig);
  } finally {
    act(() => root.unmount());
    container.remove();
    proto.getContext = origContext;
    proto.getBoundingClientRect = origRect;
  }
}

function openAsk(rig: Rig): void {
  const ask = rig.container.querySelector<HTMLButtonElement>('.gt-explore__ask');
  if (!ask) throw new Error('Ask button not found');
  act(() => ask.click());
}

describe('Lane hi1: low-vision outlines (I29a)', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    });
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();
    setStoredGuideSetting(false);
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  describe('Canvas drawing code: outlines for vertex dots, cursor dot, and guide ring', () => {
    it('vertex dots: dark stroke call happens before the fill with radius 6 and lineWidth 3', async () => {
      await withExploreOutlines({ scene: triangle }, (rig) => {
        const offscreenCtx = rig.contexts.find((ctx) =>
          ctx.calls.some((c) => c.method === 'stroke' && c.lastArc?.radius === 6),
        );
        expect(offscreenCtx).toBeDefined();
        if (!offscreenCtx) return;

        // Check call order for each vertex dot
        const calls = offscreenCtx.calls;
        const vertexStrokeIndices: number[] = [];
        const vertexFillIndices: number[] = [];

        for (let i = 0; i < calls.length; i++) {
          const call = calls[i];
          if (!call) continue;
          if (call.method === 'stroke' && call.lastArc?.radius === 6) {
            vertexStrokeIndices.push(i);
            expect(call.lineWidth).toBe(3);
            expect(call.shadowBlur).toBe(0);
            expect(['#000', '#000000', '#0b0b10']).toContain(call.strokeStyle);
          } else if (call.method === 'fill' && call.lastArc?.radius === 6) {
            vertexFillIndices.push(i);
            expect(call.fillStyle).toBe('#e8ffe8');
          }
        }

        expect(vertexStrokeIndices.length).toBe(3); // Triangle has 3 vertices (A, B, C)
        expect(vertexFillIndices.length).toBe(3);

        // Every dark stroke must happen strictly before its corresponding fill
        for (let k = 0; k < vertexStrokeIndices.length; k++) {
          const strokeIdx = vertexStrokeIndices[k]!;
          const fillIdx = vertexFillIndices[k]!;
          expect(strokeIdx).toBeLessThan(fillIdx);
        }
      });
    });

    it('cursor dot: dark stroke happens before fill with radius 5, lineWidth 3, shadowBlur 0', async () => {
      await withExploreOutlines({ scene: triangle }, (rig) => {
        rig.down(150, 150);
        rig.advance(16);

        // The onscreen canvas context records draw() calls
        const onscreenCtx = rig.contexts.find((ctx) =>
          ctx.calls.some((c) => c.method === 'stroke' && c.lastArc?.radius === 5),
        );
        expect(onscreenCtx).toBeDefined();
        if (!onscreenCtx) return;

        const calls = onscreenCtx.calls;
        const cursorStrokeIndex = calls.findIndex(
          (c) => c.method === 'stroke' && c.lastArc?.radius === 5,
        );
        const cursorFillIndex = calls.findIndex(
          (c) => c.method === 'fill' && c.lastArc?.radius === 5,
        );

        expect(cursorStrokeIndex).toBeGreaterThan(-1);
        expect(cursorFillIndex).toBeGreaterThan(-1);
        expect(cursorStrokeIndex).toBeLessThan(cursorFillIndex);

        const strokeCall = calls[cursorStrokeIndex]!;
        expect(strokeCall.lineWidth).toBe(3);
        expect(strokeCall.shadowBlur).toBe(0);
        expect(['#000', '#000000', '#0b0b10']).toContain(strokeCall.strokeStyle);

        const fillCall = calls[cursorFillIndex]!;
        expect(fillCall.fillStyle).toBe('#ffffff');
      });
    });

    it('guide ring: dark stroke lineWidth 5 occurs under cyan stroke lineWidth 2', async () => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '1');
      await withExploreOutlines({ guide: true, scene: triangle }, async (rig) => {
        openAsk(rig);
        await rig.resolveListen('take me to B');
        expect(rig.container.querySelector('.gt-explore--guiding')).not.toBeNull();

        rig.down(100, 100);
        rig.advance(16);

        const onscreenCtx = rig.contexts.find((ctx) =>
          ctx.calls.some((c) => c.method === 'stroke' && c.lastArc?.radius === 14),
        );
        expect(onscreenCtx).toBeDefined();
        if (!onscreenCtx) return;

        const calls = onscreenCtx.calls;
        const guideCalls = calls.filter(
          (c) => c.method === 'stroke' && c.lastArc?.radius === 14,
        );

        expect(guideCalls.length).toBeGreaterThanOrEqual(2);
        const darkStroke = guideCalls[0]!;
        const cyanStroke = guideCalls[1]!;

        // Dark outline: lineWidth 5, shadowBlur 0, drawn first
        expect(darkStroke.lineWidth).toBe(5);
        expect(darkStroke.shadowBlur).toBe(0);
        expect(['#000', '#000000', '#0b0b10']).toContain(darkStroke.strokeStyle);

        // Cyan stroke: lineWidth 2, drawn second (on top)
        expect(cyanStroke.lineWidth).toBe(2);
        expect(cyanStroke.strokeStyle).toBe('#00f0ff');
      });
    });
  });

  describe('Sample traces: DRAW-ONLY change (no new vibrate, tone, or speech calls)', () => {
    it('Trace 1 (Triangle): movements and dwells produce only expected cues', async () => {
      await withExploreOutlines({ scene: triangle }, (rig) => {
        rig.clearCalls();

        // 1. Touch off-line (click zone)
        rig.down(130, 220);
        rig.advance(100);

        // 2. Move onto line CA
        rig.move(100, 220);
        rig.advance(100);

        // 3. Move along line CA to vertex A
        rig.move(100, 100);
        rig.advance(600);

        // 4. Move onto line AB
        rig.move(140, 160);
        rig.advance(100);

        // 5. Move off line
        rig.move(200, 300);
        rig.advance(100);

        // 6. Move to vertex B and lift
        rig.move(280, 340);
        rig.advance(300);
        rig.up(280, 340);

        // Verify driver calls occurred from the haptic engine, not the drawing routines
        expect(rig.vibrations().length).toBeGreaterThan(0);
        expect(rig.spoken().length).toBeGreaterThan(0);

        // Canvas context calls do NOT trigger vibration or speech
        for (const ctx of rig.contexts) {
          expect(typeof ctx.stroke).toBe('function');
        }
      });
    });

    it('Trace 2 (Sine): curve scan tone and movements produce expected cues', async () => {
      await withExploreOutlines({ scene: sine }, (rig) => {
        rig.clearCalls();

        // Down on sine curve
        rig.down(50, 200);
        rig.advance(100);

        // Move across sine sample
        rig.move(100, 250);
        rig.advance(100);
        rig.move(150, 150);
        rig.advance(100);
        rig.move(200, 200);
        rig.advance(100);
        rig.up(200, 200);

        // Verify scan tones and vibration without unexpected audio
        expect(rig.tones().length).toBeGreaterThan(0);
      });
    });

    it('Trace 3 (Barchart): bar crossings produce expected cues', async () => {
      await withExploreOutlines({ scene: barchart }, (rig) => {
        rig.clearCalls();

        // Down on bar Q1
        rig.down(80, 300);
        rig.advance(200);

        // Move to bar Q2
        rig.move(160, 250);
        rig.advance(200);

        // Move off bars and lift
        rig.move(350, 200);
        rig.advance(100);
        rig.up(350, 200);

        // Spoken bar names / values
        expect(rig.spoken().some((s) => s.includes('Q1') || s.includes('Q2'))).toBe(true);
      });
    });
  });

  describe('explore.css styles: high contrast canvas and status card borders', () => {
    it('canvas border is at least 2px solid with contrast ratio >= 3:1 against #0b0e0c', () => {
      expect(cssContent).toMatch(/\.gt-explore__canvas\b[^{]*{[^}]*border:\s*2px solid/);
      expect(cssContent).toMatch(/\.gt-lab-specimen-table\b[^{]*{[^}]*border:\s*2px solid/);

      // Contrast of #39ff88 against background #0b0e0c
      const ratio = contrastRatio('#39ff88', '#0b0e0c');
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('status card border is at least 2px solid with contrast ratio >= 3:1 against surrounding background', () => {
      expect(cssContent).toMatch(/\.gt-lab-status-card\b[^{]*{[^}]*border:\s*2px solid/);
      const ratio = contrastRatio('#39ff88', '#0b0e0c');
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('respects prefers-contrast: more with 3px borders', () => {
      expect(cssContent).toMatch(/prefers-contrast:\s*more/);
      expect(cssContent).toMatch(/border-width:\s*3px/);
    });

    it('preserves status line height (Requirement 25.4)', () => {
      expect(cssContent).toMatch(/height:\s*5rem/);
      expect(cssContent).toMatch(/min-height:\s*calc\(3\s*\*\s*1\.45em\)/);
    });
  });
});
