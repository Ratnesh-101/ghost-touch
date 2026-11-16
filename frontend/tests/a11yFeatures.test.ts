import { afterEach, describe, expect, it } from 'vitest';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { buildA11yFeatures, MAX_A11Y_FEATURES } from '../src/flow/a11yFeatures';
import { getLang, setLang, tables } from '../src/i18n';

const triangleScene = triangleJson as unknown as DiagramScene;

describe('buildA11yFeatures — richer TalkBack labels', () => {
  const initialLang = getLang();

  afterEach(() => {
    setLang(initialLang);
  });

  describe('triangle.json in all three languages', () => {
    it('generates richer TalkBack labels in English', () => {
      setLang('en');
      const features = buildA11yFeatures(triangleScene);

      // Points: "Corner {name}, {coarse position}, joined to {names}"
      const pointA = features.find((f) => f.key === 'point-A');
      const pointB = features.find((f) => f.key === 'point-B');
      const pointC = features.find((f) => f.key === 'point-C');

      expect(pointA).toBeDefined();
      expect(pointB).toBeDefined();
      expect(pointC).toBeDefined();

      expect(pointA?.label).toBe('Corner A, top left, joined to C, B');
      expect(pointB?.label).toBe('Corner B, bottom right, joined to A, C');
      expect(pointC?.label).toBe('Corner C, bottom left, joined to A, B');

      // Segments: "Side {name}, from {coarse position of a} to {coarse position of b}"
      const segCA = features.find((f) => f.key === 'segment-CA');
      const segAB = features.find((f) => f.key === 'segment-AB');
      const segBC = features.find((f) => f.key === 'segment-BC');

      expect(segCA).toBeDefined();
      expect(segAB).toBeDefined();
      expect(segBC).toBeDefined();

      expect(segCA?.label).toBe('Side CA, from bottom left to top left');
      expect(segAB?.label).toBe('Side AB, from top left to bottom right');
      expect(segBC?.label).toBe('Side BC, from bottom right to bottom left');
    });

    it('generates richer TalkBack labels in Hindi', () => {
      setLang('hi');
      const features = buildA11yFeatures(triangleScene);

      const pointA = features.find((f) => f.key === 'point-A');
      const pointB = features.find((f) => f.key === 'point-B');
      const pointC = features.find((f) => f.key === 'point-C');

      expect(pointA?.label).toBe('कोना A, ऊपर बाएँ, C, B से जुड़ा');
      expect(pointB?.label).toBe('कोना B, नीचे दाएँ, A, C से जुड़ा');
      expect(pointC?.label).toBe('कोना C, नीचे बाएँ, A, B से जुड़ा');

      const segCA = features.find((f) => f.key === 'segment-CA');
      const segAB = features.find((f) => f.key === 'segment-AB');
      const segBC = features.find((f) => f.key === 'segment-BC');

      expect(segCA?.label).toBe('भुजा CA, नीचे बाएँ से ऊपर बाएँ तक');
      expect(segAB?.label).toBe('भुजा AB, ऊपर बाएँ से नीचे दाएँ तक');
      expect(segBC?.label).toBe('भुजा BC, नीचे दाएँ से नीचे बाएँ तक');
    });

    it('generates richer TalkBack labels in Gujarati', () => {
      setLang('gu');
      const features = buildA11yFeatures(triangleScene);

      const pointA = features.find((f) => f.key === 'point-A');
      const pointB = features.find((f) => f.key === 'point-B');
      const pointC = features.find((f) => f.key === 'point-C');

      expect(pointA?.label).toBe('ખૂણો A, ઉપર ડાબે, C, B સાથે જોડાયેલ');
      expect(pointB?.label).toBe('ખૂણો B, નીચે જમણે, A, C સાથે જોડાયેલ');
      expect(pointC?.label).toBe('ખૂણો C, નીચે ડાબે, A, B સાથે જોડાયેલ');

      const segCA = features.find((f) => f.key === 'segment-CA');
      const segAB = features.find((f) => f.key === 'segment-AB');
      const segBC = features.find((f) => f.key === 'segment-BC');

      expect(segCA?.label).toBe('બાજુ CA, નીચે ડાબે થી ઉપર ડાબે સુધી');
      expect(segAB?.label).toBe('બાજુ AB, ઉપર ડાબે થી નીચે જમણે સુધી');
      expect(segBC?.label).toBe('બાજુ BC, નીચે જમણે થી નીચે ડાબે સુધી');
    });
  });

  describe('standalone point (unjoined vertex)', () => {
    const standaloneScene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'p1', x: 0.5, y: 0.5, label: 'Origin' }],
    };

    it('formats unjoined corner in English, Hindi, and Gujarati', () => {
      setLang('en');
      let features = buildA11yFeatures(standaloneScene);
      expect(features[0]?.label).toBe('Corner Origin, centre');

      setLang('hi');
      features = buildA11yFeatures(standaloneScene);
      expect(features[0]?.label).toBe('कोना Origin, केंद्र');

      setLang('gu');
      features = buildA11yFeatures(standaloneScene);
      expect(features[0]?.label).toBe('ખૂણો Origin, કેન્દ્ર');
    });

    it('falls back to point id when label is empty or missing', () => {
      const unlabelledScene: DiagramScene = {
        kind: 'geometry',
        points: [{ id: 'pt_unnamed', x: 0.1, y: 0.1 }],
      };

      setLang('en');
      const features = buildA11yFeatures(unlabelledScene);
      expect(features[0]?.label).toBe('Corner pt_unnamed, top left');
    });
  });

  describe('preserves other feature kinds unchanged', () => {
    const complexScene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0.1, y: 0.1, label: 'A' },
        { id: 'p2', x: 0.9, y: 0.9, label: 'B' },
      ],
      segments: [{ id: 's1', a: 'p1', b: 'p2', label: 'Hypotenuse' }],
      bars: [{ id: 'b1', label: 'Bar1', value: 42, x0: 0.2, x1: 0.4, y_top: 0.2, y_base: 0.8 }],
      polylines: [{ id: 'c1', label: 'CurveA', points: [[0.1, 0.2], [0.5, 0.6], [0.9, 0.2]] as [number, number][] }],
      axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
    };

    it('keeps bar, curve, and axes labels formatted according to existing keys', () => {
      setLang('en');
      const features = buildA11yFeatures(complexScene);

      const bar = features.find((f) => f.kind === 'bar');
      expect(bar?.label).toBe('Bar1, value 42');

      const curve = features.find((f) => f.kind === 'polyline');
      expect(curve?.label).toBe('Curve CurveA');

      const axisX = features.find((f) => f.key === 'axis-x');
      const axisY = features.find((f) => f.key === 'axis-y');
      expect(axisX?.label).toBe('x-axis');
      expect(axisY?.label).toBe('y-axis');
    });

    it('keeps MAX_A11Y_FEATURES and share-out logic intact', () => {
      expect(buildA11yFeatures(complexScene, 0)).toEqual([]);
      expect(buildA11yFeatures(complexScene, -1)).toEqual([]);

      const capped = buildA11yFeatures(complexScene, 3);
      expect(capped.length).toBeLessThanOrEqual(3);
      expect(capped.length).toBeGreaterThan(0);
      expect(MAX_A11Y_FEATURES).toBe(60);
    });
  });

  describe('i18n keys completeness and parity', () => {
    const targetKeys = ['a11y.corner', 'a11y.cornerStandalone', 'a11y.side'] as const;

    it('ensures all a11y label keys exist and are non-blank across en, hi, gu', () => {
      for (const lang of ['en', 'hi', 'gu'] as const) {
        const table = tables[lang];
        for (const key of targetKeys) {
          expect(table).toHaveProperty(key);
          const val = table[key];
          expect(typeof val).toBe('string');
          expect(val?.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('ensures required placeholders are present in translation strings', () => {
      expect(tables.en['a11y.corner']).toContain('{name}');
      expect(tables.en['a11y.corner']).toContain('{pos}');
      expect(tables.en['a11y.corner']).toContain('{names}');

      expect(tables.hi['a11y.corner']).toContain('{name}');
      expect(tables.hi['a11y.corner']).toContain('{pos}');
      expect(tables.hi['a11y.corner']).toContain('{names}');

      expect(tables.gu['a11y.corner']).toContain('{name}');
      expect(tables.gu['a11y.corner']).toContain('{pos}');
      expect(tables.gu['a11y.corner']).toContain('{names}');

      expect(tables.en['a11y.cornerStandalone']).toContain('{name}');
      expect(tables.en['a11y.cornerStandalone']).toContain('{pos}');

      expect(tables.hi['a11y.cornerStandalone']).toContain('{name}');
      expect(tables.hi['a11y.cornerStandalone']).toContain('{pos}');

      expect(tables.gu['a11y.cornerStandalone']).toContain('{name}');
      expect(tables.gu['a11y.cornerStandalone']).toContain('{pos}');

      expect(tables.en['a11y.side']).toContain('{name}');
      expect(tables.en['a11y.side']).toContain('{from}');
      expect(tables.en['a11y.side']).toContain('{to}');

      expect(tables.hi['a11y.side']).toContain('{name}');
      expect(tables.hi['a11y.side']).toContain('{from}');
      expect(tables.hi['a11y.side']).toContain('{to}');

      expect(tables.gu['a11y.side']).toContain('{name}');
      expect(tables.gu['a11y.side']).toContain('{from}');
      expect(tables.gu['a11y.side']).toContain('{to}');
    });
  });
});
