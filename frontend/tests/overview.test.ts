import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { makeViewport } from '../src/core/geometry';
import { buildOverview } from '../src/flow/overview';
import { exploreAnnouncement } from '../src/flow/navigation';
import { executeExploreCommand, type ExploreCommandContext } from '../src/flow/commands';
import { getLang, setLang, tables } from '../src/i18n';
import triangleJson from '../public/samples/triangle.json';
import sineJson from '../public/samples/sine.json';
import barchartJson from '../public/samples/barchart.json';

const sampleModules = import.meta.glob<DiagramScene>('../public/samples/*.json', {
  eager: true,
  import: 'default',
});

const triangleScene = (sampleModules['../public/samples/triangle.json'] ?? triangleJson) as unknown as DiagramScene;
const sineScene = (sampleModules['../public/samples/sine.json'] ?? sineJson) as unknown as DiagramScene;
const barScene = (sampleModules['../public/samples/bars.json'] ?? sampleModules['../public/samples/barchart.json'] ?? barchartJson) as unknown as DiagramScene;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const NEW_I18N_KEYS = [
  'overview.geometry.corners_one',
  'overview.geometry.corners_other',
  'overview.geometry.sides_one',
  'overview.geometry.sides_other',
  'overview.geometry.summary',
  'overview.geometry.cornerItem',
  'overview.function.curves_one',
  'overview.function.curves_other',
  'overview.axes.both',
  'overview.axes.xOnly',
  'overview.axes.yOnly',
  'overview.axes.none',
  'overview.bars.summary_one',
  'overview.bars.summary_other',
  'overview.bars.none',
  'overview.bars.count_one',
  'overview.bars.count_other',
] as const;

describe('buildOverview — Sample Diagrams', () => {
  const initialLang = getLang();

  afterEach(() => {
    setLang(initialLang);
  });

  describe('triangle.json (geometry)', () => {
    const scene = triangleScene;

    it('generates geometry overview in English under 40 words', () => {
      setLang('en');
      const text = buildOverview(scene);
      expect(text).toContain('Right Triangle ABC');
      expect(text).toContain('3 corners, 3 sides');
      expect(text).toContain('A top left, B bottom right, C bottom left');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      // Coordinates should not be read as raw numbers (e.g. 0.25, 0.7, 0.85)
      expect(text).not.toMatch(/0\.\d+/);
    });

    it('generates geometry overview in Hindi', () => {
      setLang('hi');
      const text = buildOverview(scene);
      expect(text).toContain('3 कोने, 3 भुजाएं');
      expect(text).toContain('A ऊपर बाएँ');
      expect(text).toContain('B नीचे दाएँ');
      expect(text).toContain('C नीचे बाएँ');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });

    it('generates geometry overview in Gujarati', () => {
      setLang('gu');
      const text = buildOverview(scene);
      expect(text).toContain('3 ખૂણા, 3 બાજુઓ');
      expect(text).toContain('A ઉપર ડાબે');
      expect(text).toContain('B નીચે જમણે');
      expect(text).toContain('C નીચે ડાબે');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });
  });

  describe('sine.json (function_graph)', () => {
    const scene = sineScene;

    it('generates function_graph overview in English under 40 words', () => {
      setLang('en');
      const text = buildOverview(scene);
      expect(text).toContain('y = sin(x)');
      expect(text).toContain('1 curve');
      expect(text).toContain('x-axis at centre, y-axis at left');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });

    it('generates function_graph overview in Hindi', () => {
      setLang('hi');
      const text = buildOverview(scene);
      expect(text).toContain('1 वक्र');
      expect(text).toContain('x-अक्ष केंद्र, y-अक्ष बाएँ');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });

    it('generates function_graph overview in Gujarati', () => {
      setLang('gu');
      const text = buildOverview(scene);
      expect(text).toContain('1 વક્ર');
      expect(text).toContain('x-અક્ષ કેન્દ્ર, y-અક્ષ ડાબે');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });
  });

  describe('bars / barchart sample (bar_chart)', () => {
    const scene = barScene;

    it('generates bar_chart overview in English under 40 words', () => {
      setLang('en');
      const text = buildOverview(scene);
      expect(text).toContain('Sales by quarter');
      expect(text).toContain('4 bars, left to right: Q1, Q2, Q3, Q4');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });

    it('generates bar_chart overview in Hindi', () => {
      setLang('hi');
      const text = buildOverview(scene);
      expect(text).toContain('4 बार, बाएँ से दाएँ: Q1, Q2, Q3, Q4');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });

    it('generates bar_chart overview in Gujarati', () => {
      setLang('gu');
      const text = buildOverview(scene);
      expect(text).toContain('4 સ્તંભ, ડાબેથી જમણે: Q1, Q2, Q3, Q4');
      expect(wordCount(text)).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/0\.\d+/);
    });
  });

  describe('unknown / Raw Mode scenes', () => {
    it('returns empty string for unknown kind', () => {
      const rawScene: DiagramScene = { kind: 'unknown', title: 'Raw Diagram' };
      expect(buildOverview(rawScene)).toBe('');
    });
  });
});

describe('i18n keys completeness and parity', () => {
  it('every new key exists and is non-blank in en, hi, and gu', () => {
    for (const key of NEW_I18N_KEYS) {
      const enVal = tables.en[key];
      expect(enVal, `Missing English key: ${key}`).toBeDefined();
      expect(enVal?.trim().length, `Empty English key: ${key}`).toBeGreaterThan(0);

      const hiVal = tables.hi[key];
      expect(hiVal, `Missing Hindi key: ${key}`).toBeDefined();
      expect(hiVal?.trim().length, `Empty Hindi key: ${key}`).toBeGreaterThan(0);

      const guVal = tables.gu[key];
      expect(guVal, `Missing Gujarati key: ${key}`).toBeDefined();
      expect(guVal?.trim().length, `Empty Gujarati key: ${key}`).toBeGreaterThan(0);
    }
  });

  it('explore.gestureHint has "You start at the centre." removed in all languages', () => {
    expect(tables.en['explore.gestureHint']).toBe(
      'Double-tap and hold, then drag to feel the diagram.',
    );
    expect(tables.en['explore.gestureHint']).not.toContain('You start at the centre');

    expect(tables.hi['explore.gestureHint']).toBe(
      'डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें।',
    );
    expect(tables.hi['explore.gestureHint']).not.toContain('आप केंद्र से शुरू करते हैं');

    expect(tables.gu['explore.gestureHint']).toBe(
      'ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો.',
    );
    expect(tables.gu['explore.gestureHint']).not.toContain('તમે કેન્દ્રથી શરૂ કરો છો');
  });
});

describe('Word limit bound — scenes with up to 60 points', () => {
  it('keeps overview at most 40 words for a geometry scene with 60 points and 60 segments', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      title: 'Dense Geometric Network with Sixty Vertices',
      points: Array.from({ length: 60 }, (_, i) => ({
        id: `P${i + 1}`,
        label: `V${i + 1}`,
        x: (i % 8) / 8,
        y: Math.floor(i / 8) / 8,
      })),
      segments: Array.from({ length: 60 }, (_, i) => ({
        id: `S${i + 1}`,
        a: `P${i + 1}`,
        b: `P${((i + 1) % 60) + 1}`,
      })),
    };

    const overviewEn = buildOverview(scene);
    expect(wordCount(overviewEn)).toBeLessThanOrEqual(40);
    // Only up to 6 labelled corners should be reported
    expect(overviewEn).toContain('V1');
    expect(overviewEn).toContain('V6');
    expect(overviewEn).not.toContain('V7');

    setLang('hi');
    const overviewHi = buildOverview(scene);
    expect(wordCount(overviewHi)).toBeLessThanOrEqual(40);

    setLang('gu');
    const overviewGu = buildOverview(scene);
    expect(wordCount(overviewGu)).toBeLessThanOrEqual(40);
  });

  it('keeps overview at most 40 words for a bar chart with 60 bars', () => {
    setLang('en');
    const scene: DiagramScene = {
      kind: 'bar_chart',
      title: 'Survey of Sixty Data Points Over Multiple Decades',
      bars: Array.from({ length: 60 }, (_, i) => ({
        id: `b${i + 1}`,
        label: `B${i + 1}`,
        value: i * 5,
        x0: i / 65,
        x1: (i + 0.8) / 65,
        y_base: 0.85,
        y_top: 0.85 - (i / 100),
      })),
    };

    const overview = buildOverview(scene);
    expect(wordCount(overview)).toBeLessThanOrEqual(40);
    // Only first 8 sorted bars reported
    expect(overview).toContain('B1');
    expect(overview).toContain('B8');
    expect(overview).not.toContain('B9');
  });

  it('keeps overview at most 40 words for a function graph with many curves', () => {
    setLang('en');
    const scene: DiagramScene = {
      kind: 'function_graph',
      title: 'Multi-harmonic Waveform Superposition Diagram',
      polylines: Array.from({ length: 20 }, (_, i) => ({
        id: `wave_${i + 1}`,
        label: `W${i + 1}`,
        points: [[0, 0.5], [1, 0.5]],
      })),
      axes: { x_axis_y: 0.5, y_axis_x: 0.1 },
    };

    const overview = buildOverview(scene);
    expect(wordCount(overview)).toBeLessThanOrEqual(40);
    expect(overview).toContain('20 curves');
    expect(overview).toContain('x-axis at centre, y-axis at left');
  });
});

describe('Describe command integration', () => {
  it('makes the describe command speak buildOverview(scene) and then the facts', () => {
    setLang('en');
    const scene = triangleScene;
    const ctx: ExploreCommandContext = {
      scene,
      view: makeViewport(300, 300),
      cursorNorm: { x: 0.25, y: 0.25 },
      lastSpoken: '',
      currentCornerIndex: 0,
      currentRate: 'normal',
    };

    const result = executeExploreCommand({ type: 'describe', raw: 'describe' }, ctx);
    const overview = buildOverview(scene);

    expect(result.speech.startsWith(overview)).toBe(true);
    for (const fact of scene.facts ?? []) {
      expect(result.speech).toContain(fact);
    }
    expect(result.earcon).toBe('success');
  });
});

describe('Explore entry announcement integration', () => {
  it('speaks overview before gesture hint as ONE utterance without double reading', () => {
    setLang('en');
    const scene = triangleScene;
    const announcement = exploreAnnouncement(scene, 'ai');

    const overview = buildOverview(scene);
    expect(announcement.startsWith(overview)).toBe(true);
    expect(announcement).toContain('Double-tap and hold, then drag to feel the diagram.');
    expect(announcement).toContain('Press Back to leave.');
    // Must NOT contain double reading of title
    const occurrences = (announcement.match(/Right Triangle ABC/g) || []).length;
    expect(occurrences).toBe(1);
    // Must NOT contain removed sentence
    expect(announcement).not.toContain('You start at the centre.');
  });
});
