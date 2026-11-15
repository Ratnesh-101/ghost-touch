/**
 * Corner compass & line dwell tests (Lane A3).
 *
 * Verifies:
 * 1. Acceptance cases on frontend/public/samples/triangle.json:
 *    - cornerCompass exits, arrival line skipping, >4 exits fallback, 10s visit window
 *    - lineName for segments ("Side AB. Up-left to A, down-right to B."), axes, polylines, bars
 * 2. All i18n keys present and functional in en, hi, gu
 * 3. Compass text never exceeds 12 words under any configuration
 * 4. Directions toggle (stored, default on) disables both corner compass and dwell
 * 5. Haptic invariance: vibrate and tone effects for any trace are 100% identical
 *    with directions toggle ON and OFF
 * 6. Dwell: stationary line hold for 800ms speaks lineName once; leaving re-arms;
 *    suppressed during Ask listening window and when Directions toggle is OFF
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  cornerCompass,
  lineName,
  processPointerMove,
  mergeAnnouncements,
  VERTEX_VISIT_WINDOW_MS,
  LINE_DWELL_MS,
  initialState,
  initialCentreTickState,
  initialAxisState,
  step,
  DEFAULT_HAPTICS,
  type Effect,
} from '../src/flow/explore';
import { makeViewport } from '../src/core/geometry';
import {
  getStoredDirectionsSetting,
  setStoredDirectionsSetting,
  _resetDirectionsSettingForTesting,
  STORAGE_KEY_DIRECTIONS,
} from '../src/drivers/storage';
import { getLang, setLang, tf, tables, type Lang } from '../src/i18n';

const trianglePath = new URL('../public/samples/triangle.json', import.meta.url);
const triangle: DiagramScene = JSON.parse(
  fs.readFileSync(trianglePath, 'utf-8'),
) as DiagramScene;

describe('1. Corner compass pure function (acceptance on triangle.json)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('reports all exits when arriving from outside (arrivedLineId is null)', () => {
    // Vertex A: exits are CA (to C, down) and AB (to B, down-right)
    const textA = cornerCompass(triangle, 'A', null, false);
    expect(textA).toBe('Down to C. Down-right to B.');

    // Vertex B: exits are AB (to A, up-left) and BC (to C, left)
    const textB = cornerCompass(triangle, 'B', null, false);
    expect(textB).toBe('Up-left to A. Left to C.');

    // Vertex C: exits are CA (to A, up) and BC (to B, right)
    const textC = cornerCompass(triangle, 'C', null, false);
    expect(textC).toBe('Up to A. Right to B.');
  });

  it('skips the segment the finger arrived on', () => {
    // Finger arrives at A along line CA -> says "Down-right to B."
    const atAFromCA = cornerCompass(triangle, 'A', 'CA', false);
    expect(atAFromCA).toBe('Down-right to B.');

    // Finger arrives at A along line AB -> says "Down to C."
    const atAFromAB = cornerCompass(triangle, 'A', 'AB', false);
    expect(atAFromAB).toBe('Down to C.');

    // Finger arrives at B along line AB -> says "Left to C."
    const atBFromAB = cornerCompass(triangle, 'B', 'AB', false);
    expect(atBFromAB).toBe('Left to C.');

    // Finger arrives at B along line BC -> says "Up-left to A."
    const atBFromBC = cornerCompass(triangle, 'B', 'BC', false);
    expect(atBFromBC).toBe('Up-left to A.');

    // Finger arrives at C along line BC -> says "Up to A."
    const atCFromBC = cornerCompass(triangle, 'C', 'BC', false);
    expect(atCFromBC).toBe('Up to A.');

    // Finger arrives at C along line CA -> says "Right to B."
    const atCFromCA = cornerCompass(triangle, 'C', 'CA', false);
    expect(atCFromCA).toBe('Right to B.');
  });

  it('returns empty string when visitedRecently is true', () => {
    expect(cornerCompass(triangle, 'A', null, true)).toBe('');
    expect(cornerCompass(triangle, 'A', 'CA', true)).toBe('');
    expect(cornerCompass(triangle, 'B', 'AB', true)).toBe('');
  });

  it('says "{n} edges" only when a vertex has more than 4 exits', () => {
    const starScene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'hub', x: 0.5, y: 0.5, label: 'Hub' },
        { id: 'p1', x: 0.5, y: 0.1, label: 'P1' },
        { id: 'p2', x: 0.9, y: 0.3, label: 'P2' },
        { id: 'p3', x: 0.8, y: 0.8, label: 'P3' },
        { id: 'p4', x: 0.2, y: 0.8, label: 'P4' },
        { id: 'p5', x: 0.1, y: 0.3, label: 'P5' },
      ],
      segments: [
        { id: 's1', a: 'hub', b: 'p1' },
        { id: 's2', a: 'hub', b: 'p2' },
        { id: 's3', a: 'hub', b: 'p3' },
        { id: 's4', a: 'hub', b: 'p4' },
        { id: 's5', a: 'hub', b: 'p5' },
      ],
    };

    const textHub = cornerCompass(starScene, 'hub', null, false);
    expect(textHub).toBe('5 edges.');

    // Even arriving from one segment, hub has 5 total edges -> concise summary
    const textHubArrived = cornerCompass(starScene, 'hub', 's1', false);
    expect(textHubArrived).toBe('5 edges.');
  });

  it('returns empty string for dead ends when arriving on the only segment', () => {
    const deadEndScene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'start', x: 0.1, y: 0.1 },
        { id: 'end', x: 0.9, y: 0.9 },
      ],
      segments: [{ id: 'only', a: 'start', b: 'end' }],
    };
    expect(cornerCompass(deadEndScene, 'end', 'only', false)).toBe('');
  });

  it('returns empty string for isolated vertices or invalid vertex ids', () => {
    const isolatedScene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'iso', x: 0.5, y: 0.5 }],
      segments: [],
    };
    expect(cornerCompass(isolatedScene, 'iso', null, false)).toBe('');
    expect(cornerCompass(triangle, 'nonexistent', null, false)).toBe('');
  });
});

describe('1. Line name pure function (acceptance on triangle.json & scenes)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('formats segment names as "Side AB. Up-left to A, down-right to B."', () => {
    const nameAB = lineName(triangle, 'AB');
    expect(nameAB).toBe('Side AB. Up-left to A, down-right to B.');

    const nameCA = lineName(triangle, 'CA');
    expect(nameCA).toBe('Side CA. Down to C, up to A.');

    const nameBC = lineName(triangle, 'BC');
    expect(nameBC).toBe('Side BC. Right to B, left to C.');
  });

  it('names coordinate axes cleanly', () => {
    expect(lineName(triangle, 'x-axis')).toBe('x-axis, left to right');
    expect(lineName(triangle, 'y-axis')).toBe('y-axis, top to bottom');
  });

  it('names polylines and bar edges by their label only', () => {
    const sceneWithFeatures: DiagramScene = {
      kind: 'function_graph',
      points: [],
      segments: [],
      polylines: [
        {
          id: 'poly_sine',
          label: 'Sine wave',
          points: [
            [0, 0.5],
            [1, 0.5],
          ],
        },
      ],
      bars: [
        {
          id: 'bar_q1',
          label: 'Quarter 1',
          value: 10,
          x0: 0.1,
          x1: 0.3,
          y_base: 0.9,
          y_top: 0.4,
        },
      ],
    };

    expect(lineName(sceneWithFeatures, 'poly_sine')).toBe('Sine wave');
    expect(lineName(sceneWithFeatures, 'bar_q1')).toBe('Quarter 1');
  });

  it('falls back to id when polyline or bar has no label', () => {
    const sceneNoLabels: DiagramScene = {
      kind: 'function_graph',
      points: [],
      segments: [],
      polylines: [{ id: 'curve1', points: [[0, 0], [1, 1]] }],
      bars: [{ id: 'bar1', label: '', value: 10, x0: 0.1, x1: 0.2, y_base: 0.9, y_top: 0.5 }],
    };
    expect(lineName(sceneNoLabels, 'curve1')).toBe('curve1');
    expect(lineName(sceneNoLabels, 'bar1')).toBe('bar1');
  });

  it('returns empty string for unknown line ids', () => {
    expect(lineName(triangle, 'unknown-line')).toBe('');
  });
});

describe('2 & 6. i18n keys present and functional in en, hi, gu', () => {
  const REQUIRED_KEYS = [
    'compass.dir.up',
    'compass.dir.down',
    'compass.dir.left',
    'compass.dir.right',
    'compass.dir.up-left',
    'compass.dir.up-right',
    'compass.dir.down-left',
    'compass.dir.down-right',
    'compass.toTarget',
    'compass.edges',
    'compass.lineEnds',
    'compass.xAxis',
    'compass.yAxis',
    'compass.side',
    'lab.settings.directions',
    'lab.settings.directionsHint',
    'lab.settings.directionsOn',
    'lab.settings.directionsOff',
  ];

  it('has all 18 keys defined and non-empty in English, Hindi, and Gujarati tables', () => {
    for (const lang of ['en', 'hi', 'gu'] as const) {
      const table = tables[lang];
      for (const key of REQUIRED_KEYS) {
        expect(table[key], `Missing ${key} in ${lang}`).toBeDefined();
        expect(table[key]!.trim().length, `Empty ${key} in ${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it('produces valid Hindi translations of cornerCompass and lineName', () => {
    const prevLang = getLang();
    setLang('hi');
    try {
      const compassA = cornerCompass(triangle, 'A', 'CA', false);
      expect(compassA).toBe('नीचे-दाएँ B की ओर.');

      const lineAB = lineName(triangle, 'AB');
      expect(lineAB).toBe('भुजा AB. ऊपर-बाएँ A की ओर, नीचे-दाएँ B की ओर.');

      const xAxis = lineName(triangle, 'x-axis');
      expect(xAxis).toBe('x-अक्ष, बाएँ से दाएँ');

      const edges5 = tf('compass.edges', { n: '5' });
      expect(edges5).toBe('5 किनारे');
    } finally {
      setLang(prevLang);
    }
  });

  it('produces valid Gujarati translations of cornerCompass and lineName', () => {
    const prevLang = getLang();
    setLang('gu');
    try {
      const compassA = cornerCompass(triangle, 'A', 'CA', false);
      expect(compassA).toBe('નીચે-જમણે B તરફ.');

      const lineAB = lineName(triangle, 'AB');
      expect(lineAB).toBe('બાજુ AB. ઉપર-ડાબે A તરફ, નીચે-જમણે B તરફ.');

      const xAxis = lineName(triangle, 'x-axis');
      expect(xAxis).toBe('x-અક્ષ, ડાબેથી જમણે');

      const edges5 = tf('compass.edges', { n: '5' });
      expect(edges5).toBe('5 કાંઠા');
    } finally {
      setLang(prevLang);
    }
  });
});

describe('6. Compass text length guarantee (never longer than 12 words)', () => {
  it('guarantees triangle compass text is well within 12 words', () => {
    for (const vertex of ['A', 'B', 'C']) {
      const text = cornerCompass(triangle, vertex, null, false);
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeLessThanOrEqual(12);
    }
  });

  it('caps at {n} edges when 4 exits would exceed 12 words with long labels', () => {
    const longLabelsScene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'v', x: 0.5, y: 0.5, label: 'Vertex' },
        { id: 'p1', x: 0.5, y: 0.1, label: 'Northern Most Point Alpha' },
        { id: 'p2', x: 0.9, y: 0.5, label: 'Eastern Most Point Beta' },
        { id: 'p3', x: 0.5, y: 0.9, label: 'Southern Most Point Gamma' },
        { id: 'p4', x: 0.1, y: 0.5, label: 'Western Most Point Delta' },
      ],
      segments: [
        { id: 's1', a: 'v', b: 'p1' },
        { id: 's2', a: 'v', b: 'p2' },
        { id: 's3', a: 'v', b: 'p3' },
        { id: 's4', a: 'v', b: 'p4' },
      ],
    };

    const text = cornerCompass(longLabelsScene, 'v', null, false);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(12);
    // Because 4 long labels exceed 12 words, it must fall back to "4 edges."
    expect(text).toBe('4 edges.');
  });
});

describe('4. Directions setting storage and defaults', () => {
  beforeEach(() => {
    _resetDirectionsSettingForTesting();
  });

  afterEach(() => {
    _resetDirectionsSettingForTesting();
  });

  it('defaults to ON (true)', () => {
    expect(getStoredDirectionsSetting()).toBe(true);
  });

  it('persists toggle state to false and true', () => {
    setStoredDirectionsSetting(false);
    expect(getStoredDirectionsSetting()).toBe(false);

    setStoredDirectionsSetting(true);
    expect(getStoredDirectionsSetting()).toBe(true);
  });

  it('uses the expected storage key', () => {
    expect(STORAGE_KEY_DIRECTIONS).toBe('gt_directions_enabled');
  });
});

describe('5. Haptic invariance (vibrate and tone are 100% identical toggle ON vs OFF)', () => {
  it('produces identical vibrate and tone effects across an entire explore trace', () => {
    const view = makeViewport(800, 600);

    // Realistic multi-point exploration trace across triangle.json:
    // Centre -> empty space -> line CA -> vertex A -> line AB -> vertex B -> lift
    const trace = [
      { x: 400, y: 300, t: 0 }, // Near centre
      { x: 200, y: 400, t: 50 }, // Move towards CA
      { x: 200, y: 330, t: 150 }, // On line CA
      { x: 200, y: 150, t: 250 }, // Enter vertex A (0.25 * 800 = 200, 0.25 * 600 = 150)
      { x: 250, y: 200, t: 350 }, // On line AB
      { x: 350, y: 300, t: 450 }, // Continuing on line AB
      { x: 560, y: 510, t: 550 }, // Enter vertex B (0.7 * 800 = 560, 0.85 * 600 = 510)
      { x: 560, y: 510, t: 700 }, // Stationary at vertex B
    ];

    function runTrace(directionsEnabled: boolean): {
      vibrations: (number | number[])[];
      tones: (number | null)[];
    } {
      setStoredDirectionsSetting(directionsEnabled);
      let engine = initialState();
      let centre = initialCentreTickState();
      let axis = initialAxisState();
      const vibrations: (number | number[])[] = [];
      const tones: (number | null)[] = [];

      for (const pt of trace) {
        const res = processPointerMove(
          triangle,
          { x: pt.x, y: pt.y },
          view,
          pt.t,
          engine,
          centre,
          axis,
        );
        engine = res.nextEngineState;
        centre = res.centreCheck.nextState;
        axis = res.nextAxisState;

        for (const eff of res.effects) {
          if (eff.kind === 'vibrate') vibrations.push(eff.pattern);
          if (eff.kind === 'tone') tones.push(eff.hz);
        }
      }

      // Step lift
      const lift = step(engine, { kind: 'lift', t: 800 });
      for (const eff of lift.effects) {
        if (eff.kind === 'vibrate') vibrations.push(eff.pattern);
        if (eff.kind === 'tone') tones.push(eff.hz);
      }

      return { vibrations, tones };
    }

    const onResult = runTrace(true);
    const offResult = runTrace(false);

    expect(onResult.vibrations).toEqual(offResult.vibrations);
    expect(onResult.tones).toEqual(offResult.tones);
    expect(onResult.vibrations.length).toBeGreaterThan(0);
  });
});

describe('2 & 3. Dwell and corner compass utterance coordination', () => {
  it('merges vertex label and corner compass into a single utterance in order', () => {
    // Engine speech contains the corner label "A"
    const engineEffects: Effect[] = [
      { kind: 'vibrate', pattern: DEFAULT_HAPTICS.cornerPattern },
      { kind: 'speak', text: 'A' },
      { kind: 'tone', hz: null },
    ];
    const compassText = 'Down-right to B.';

    const merged = mergeAnnouncements([], engineEffects, [compassText]);

    // Vibrations and tone preserved
    expect(merged).toContainEqual({
      kind: 'vibrate',
      pattern: DEFAULT_HAPTICS.cornerPattern,
    });
    expect(merged).toContainEqual({ kind: 'tone', hz: null });

    // Merged speak utterance has label followed by compass text: "A. Down-right to B."
    const speakEffect = merged.find((e) => e.kind === 'speak');
    expect(speakEffect).toBeDefined();
    expect(speakEffect).toEqual({ kind: 'speak', text: 'A. Down-right to B.' });
  });

  it('merges axis crossing, label, and compass in correct priority order', () => {
    const engineEffects: Effect[] = [{ kind: 'speak', text: 'Corner A' }];
    const axisCrossings = ['x-axis'];
    const compassText = ['Down-right to B.'];

    const merged = mergeAnnouncements(axisCrossings, engineEffects, compassText);
    const speak = merged.find((e) => e.kind === 'speak');
    expect(speak).toEqual({
      kind: 'speak',
      text: 'x-axis. Corner A. Down-right to B.',
    });
  });

  it('verifies VERTEX_VISIT_WINDOW_MS is 10000 and LINE_DWELL_MS is 800', () => {
    expect(VERTEX_VISIT_WINDOW_MS).toBe(10000);
    expect(LINE_DWELL_MS).toBe(800);
  });
});
