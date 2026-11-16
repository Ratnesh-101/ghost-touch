import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import type { DiagramScene } from '../src/core/scene';
import type { Target } from '../src/core/hitTest';
import { makeViewport } from '../src/core/geometry';
import {
  DEFAULT_HAPTICS,
  DEFAULT_RADII,
  initialAxisState,
  initialCentreTickState,
  initialProximityState,
  initialState,
  processPointerMove,
  scanTone,
  getStoredGraphScanSetting,
  setStoredGraphScanSetting,
  _resetGraphScanSettingForTesting,
} from '../src/flow/explore';
import { LabSettings } from '../src/components/LabSettings';
import { getLang, setLang, t, tables } from '../src/i18n';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import barchartJson from '../public/samples/barchart.json';

const sineScene = sineJson as unknown as DiagramScene;
const triangleScene = triangleJson as unknown as DiagramScene;
const barScene = barchartJson as unknown as DiagramScene;

describe('Lane A6 — Graph scan pure function (scanTone)', () => {
  it('returns null for non-function_graph scenes (triangle and bar chart)', () => {
    const noneTarget: Target = { kind: 'none' };

    // Triangle is kind 'geometry'
    expect(scanTone(triangleScene, noneTarget, 0.25, 0.25)).toBeNull();
    expect(scanTone(triangleScene, noneTarget, 0.5, 0.5)).toBeNull();

    // Bar chart is kind 'bar_chart'
    expect(scanTone(barScene, noneTarget, 0.25, 0.25)).toBeNull();
    expect(scanTone(barScene, noneTarget, 0.5, 0.5)).toBeNull();
  });

  it('returns null when target is the polyline (engine plays it at full level)', () => {
    const polyTarget: Target = {
      kind: 'line',
      id: 'sine_curve',
      elementKind: 'polyline',
    };
    expect(scanTone(sineScene, polyTarget, 0.25, 0.25)).toBeNull();
    expect(scanTone(sineScene, polyTarget, 0.5, 0.5)).toBeNull();
  });

  it('returns null outside the curve x range [0.1, 0.9] in sine.json', () => {
    const noneTarget: Target = { kind: 'none' };
    expect(scanTone(sineScene, noneTarget, 0.05, 0.25)).toBeNull();
    expect(scanTone(sineScene, noneTarget, 0.08, 0.25)).toBeNull();
    expect(scanTone(sineScene, noneTarget, 0.92, 0.25)).toBeNull();
    expect(scanTone(sineScene, noneTarget, 0.98, 0.25)).toBeNull();
  });

  it('returns scan tone with level 0.33 inside curve x range [0.1, 0.9] when off polyline', () => {
    const noneTarget: Target = { kind: 'none' };
    const res = scanTone(sineScene, noneTarget, 0.5, 0.25);
    expect(res).not.toBeNull();
    expect(res!.level).toBe(0.33);

    // In sine.json, at x = 0.5 the curve passes through y = 0.5.
    // pitchForY(0.5) = 1000 - 0.5 * 800 = 600 Hz
    expect(res!.hz).toBeCloseTo(600, 1);
  });

  it('returns scan tone with level 0.33 when target is axis or vertex (not polyline)', () => {
    const axisTarget: Target = {
      kind: 'line',
      id: 'x-axis',
      elementKind: 'axis',
    };
    const res = scanTone(sineScene, axisTarget, 0.5, 0.25);
    expect(res).not.toBeNull();
    expect(res!.level).toBe(0.33);
    expect(res!.hz).toBeCloseTo(600, 1);
  });

  it('yields a tone rising then falling then rising across a horizontal sweep at y = 0.25 in sine.json', () => {
    const noneTarget: Target = { kind: 'none' };

    // Sample along the curve from x = 0.1 to 0.9 at step 0.02
    const samples: Array<{ x: number; hz: number; level: number }> = [];
    for (let x = 0.1; x <= 0.9001; x += 0.02) {
      const sampleX = Math.round(x * 100) / 100;
      const tone = scanTone(sineScene, noneTarget, sampleX, 0.25);
      expect(tone).not.toBeNull();
      expect(tone!.level).toBe(0.33);
      samples.push({ x: sampleX, hz: tone!.hz, level: tone!.level });
    }

    // Polyline in sine.json has:
    // x = 0.10: y = 0.50 -> ~600 Hz
    // Peak near x ≈ 0.26: y ≈ 0.21 (highest on screen) -> highest pitch (~832 Hz)
    // Trough near x ≈ 0.74: y ≈ 0.79 (lowest on screen) -> lowest pitch (~368 Hz)
    // x = 0.90: y = 0.50 -> ~600 Hz

    const first = samples[0]!;
    const peak = samples.find((s) => Math.abs(s.x - 0.26) < 0.015)!;
    const trough = samples.find((s) => Math.abs(s.x - 0.74) < 0.015)!;
    const last = samples[samples.length - 1]!;

    expect(peak.hz).toBeGreaterThan(first.hz); // Rising: 600 Hz -> ~832 Hz
    expect(trough.hz).toBeLessThan(peak.hz);   // Falling: ~832 Hz -> ~368 Hz
    expect(last.hz).toBeGreaterThan(trough.hz); // Rising: ~368 Hz -> ~600 Hz
  });
});

describe('Lane A6 — Settings storage for graph scan', () => {
  beforeEach(() => {
    _resetGraphScanSettingForTesting();
  });

  afterEach(() => {
    _resetGraphScanSettingForTesting();
  });

  it('defaults to true (stored, default on)', () => {
    expect(getStoredGraphScanSetting()).toBe(true);
  });

  it('persists enabled and disabled states', () => {
    setStoredGraphScanSetting(false);
    expect(getStoredGraphScanSetting()).toBe(false);

    setStoredGraphScanSetting(true);
    expect(getStoredGraphScanSetting()).toBe(true);
  });

  it('resets correctly for testing', () => {
    setStoredGraphScanSetting(false);
    _resetGraphScanSettingForTesting();
    expect(getStoredGraphScanSetting()).toBe(true);
  });
});

describe('Lane A6 — Internationalization strings (en, hi, gu)', () => {
  const initialLang = getLang();

  afterEach(() => {
    setLang(initialLang);
  });

  const REQUIRED_KEYS = [
    'lab.settings.graphScan',
    'lab.settings.graphScanHint',
    'lab.settings.graphScanOn',
    'lab.settings.graphScanOff',
  ];

  it('all required keys are defined and non-empty in en, hi, and gu', () => {
    for (const lang of ['en', 'hi', 'gu'] as const) {
      setLang(lang);
      const table = tables[lang];
      for (const key of REQUIRED_KEYS) {
        expect(table[key], `Missing ${key} in ${lang}`).toBeDefined();
        expect(table[key]!.trim().length, `Empty ${key} in ${lang}`).toBeGreaterThan(0);
        expect(t(key)).toBe(table[key]);
      }
    }
  });

  it('English translations match expected terminology', () => {
    setLang('en');
    expect(t('lab.settings.graphScan')).toBe('Graph scan');
    expect(t('lab.settings.graphScanOn')).toBe('Graph scan enabled.');
    expect(t('lab.settings.graphScanOff')).toBe('Graph scan disabled.');
  });
});

describe('Lane A6 — Full move sweep and haptics invariance', () => {
  const view = makeViewport(300, 300);

  beforeEach(() => {
    _resetGraphScanSettingForTesting();
  });

  afterEach(() => {
    _resetGraphScanSettingForTesting();
  });

  /**
   * Helper simulating a move sweep and returning tone and vibration outputs.
   */
  function simulateSweep(
    scene: DiagramScene,
    yNorm: number,
    xValues: number[],
    graphScanEnabled: boolean,
  ) {
    setStoredGraphScanSetting(graphScanEnabled);
    let engineState = initialState();
    let centreTick = initialCentreTickState();
    let axisState = initialAxisState();
    let proxState = initialProximityState();

    const results: Array<{
      x: number;
      targetKind: Target['kind'];
      isPolyline: boolean;
      toneHz: number | null;
      toneLevel: number;
      vibrations: Array<number | number[]>;
    }> = [];

    let playingScanTone = false;

    let t = 1000;
    for (const x of xValues) {
      t += 50;
      const screenPt = { x: x * 300, y: yNorm * 300 };
      const moveRes = processPointerMove(
        scene,
        screenPt,
        view,
        t,
        engineState,
        centreTick,
        axisState,
        DEFAULT_RADII,
        DEFAULT_HAPTICS,
        proxState,
      );
      engineState = moveRes.nextEngineState;
      centreTick = moveRes.centreCheck.nextState;
      axisState = moveRes.nextAxisState;
      proxState = moveRes.proximityState;

      const vibrations: Array<number | number[]> = [];
      let activeToneHz: number | null = null;
      let activeToneLevel = 1;

      // Simulate runEffects for the move
      for (const effect of moveRes.effects) {
        if (effect.kind === 'vibrate') {
          vibrations.push(effect.pattern);
        } else if (effect.kind === 'tone') {
          activeToneHz = effect.hz;
          activeToneLevel = 1;
        }
      }

      // Graph scan tone logic matching Explore.tsx
      if (getStoredGraphScanSetting()) {
        const scan = scanTone(scene, moveRes.target, moveRes.xNorm, moveRes.yNorm);
        if (scan !== null) {
          activeToneHz = scan.hz;
          activeToneLevel = scan.level;
          playingScanTone = true;
        } else if (playingScanTone) {
          playingScanTone = false;
          const isPolyline =
            moveRes.target.kind === 'line' && moveRes.target.elementKind === 'polyline';
          const isBar = moveRes.target.kind === 'bar';
          if (!isPolyline && !isBar) {
            activeToneHz = null;
          }
        }
      } else if (playingScanTone) {
        playingScanTone = false;
        const isPolyline =
          moveRes.target.kind === 'line' && moveRes.target.elementKind === 'polyline';
        const isBar = moveRes.target.kind === 'bar';
        if (!isPolyline && !isBar) {
          activeToneHz = null;
        }
      }

      const isPolyline =
        moveRes.target.kind === 'line' && moveRes.target.elementKind === 'polyline';

      results.push({
        x,
        targetKind: moveRes.target.kind,
        isPolyline,
        toneHz: activeToneHz,
        toneLevel: activeToneLevel,
        vibrations,
      });
    }

    return results;
  }

  it('horizontal sweep across sine.json at y = 0.25 produces tone inside x range, silent outside, level 1 on curve and 0.33 off it', () => {
    // Sweep from x = 0.05 to x = 0.95 at step 0.02
    const xRange: number[] = [];
    for (let x = 0.05; x <= 0.9501; x += 0.02) {
      xRange.push(Math.round(x * 100) / 100);
    }

    const sweep = simulateSweep(sineScene, 0.25, xRange, true);

    // 1. Silent outside the curve x range [0.1, 0.9]
    const outsideBefore = sweep.filter((s) => s.x < 0.1);
    for (const s of outsideBefore) {
      expect(s.toneHz, `Expected silent at x=${s.x}`).toBeNull();
    }

    const outsideAfter = sweep.filter((s) => s.x > 0.9);
    for (const s of outsideAfter) {
      expect(s.toneHz, `Expected silent at x=${s.x}`).toBeNull();
    }

    // 2. Inside the curve x range [0.1, 0.9], every sample produces a tone
    const inside = sweep.filter((s) => s.x >= 0.1 && s.x <= 0.9);
    expect(inside.length).toBeGreaterThan(0);
    for (const s of inside) {
      expect(s.toneHz, `Expected tone at x=${s.x}`).not.toBeNull();
      if (s.isPolyline) {
        // On the curve polyline: level is 1
        expect(s.toneLevel, `Expected level 1 on curve at x=${s.x}`).toBe(1);
      } else {
        // Off the curve: level is 0.33
        expect(s.toneLevel, `Expected level 0.33 off curve at x=${s.x}`).toBe(0.33);
      }
    }
    expect(inside.some((s) => s.isPolyline)).toBe(true);
    expect(inside.some((s) => !s.isPolyline)).toBe(true);

    // 3. Pitch rises, then falls, then rises as curve does
    const firstInside = inside[0]!;
    const peakInside = inside.find((s) => Math.abs(s.x - 0.27) < 0.02)!;
    const troughInside = inside.find((s) => Math.abs(s.x - 0.73) < 0.02)!;
    const lastInside = inside[inside.length - 1]!;

    expect(peakInside.toneHz!).toBeGreaterThan(firstInside.toneHz!);
    expect(troughInside.toneHz!).toBeLessThan(peakInside.toneHz!);
    expect(lastInside.toneHz!).toBeGreaterThan(troughInside.toneHz!);
  });

  it('triangle and bar samples produce no scan tone during sweep', () => {
    const xRange = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const triangleSweep = simulateSweep(triangleScene, 0.25, xRange, true);
    for (const s of triangleSweep) {
      // In triangle scene, only geometry lines/corners hit, no scan tone
      expect(s.toneLevel).toBe(1); // Scan tone at 0.33 is never set
      if (s.targetKind === 'none') {
        expect(s.toneHz).toBeNull();
      }
    }

    const barSweep = simulateSweep(barScene, 0.25, xRange, true);
    for (const s of barSweep) {
      expect(s.toneLevel).toBe(1); // Scan tone at 0.33 is never set
      if (s.targetKind === 'none') {
        expect(s.toneHz).toBeNull();
      }
    }
  });

  it('vibrate calls of a fixed trace are identical with toggle on and off (Do 5)', () => {
    const xRange: number[] = [];
    for (let x = 0.05; x <= 0.9501; x += 0.02) {
      xRange.push(Math.round(x * 100) / 100);
    }

    const sweepOn = simulateSweep(sineScene, 0.25, xRange, true);
    const sweepOff = simulateSweep(sineScene, 0.25, xRange, false);

    expect(sweepOn.length).toBe(sweepOff.length);
    for (let i = 0; i < sweepOn.length; i++) {
      expect(sweepOn[i]!.vibrations).toEqual(sweepOff[i]!.vibrations);
    }
  });
});

describe('Lane A6 — LabSettings Graph scan toggle markup and interaction', () => {
  beforeEach(() => {
    _resetGraphScanSettingForTesting();
  });

  afterEach(() => {
    _resetGraphScanSettingForTesting();
  });

  it('renders Graph scan switch with accessible name and default on in LabSettings', () => {
    const html = renderToStaticMarkup(
      createElement(LabSettings, {
        open: true,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain('lab-settings-section-graph-scan');
    expect(html).toContain('Graph scan');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Graph scan enabled.');
    expect(html).toContain('Hear curve pitch anywhere on the graph.');
  });
});

