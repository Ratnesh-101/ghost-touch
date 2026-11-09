import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { DiagramScene, Point, Segment, Bar } from '../src/types/scene.gen';
import {
  verifyScene,
  parseFacts,
  VERIFY_WORDING,
} from '../src/verify/verify';

describe('verifyScene & parseFacts — Unit and Wording Tests', () => {
  it('exports VERIFY_WORDING matching spec constraints', () => {
    expect(VERIFY_WORDING.disagree('AB')).toBe(
      "Facts and drawing disagree on AB. I can't tell which is right.",
    );
    expect(VERIFY_WORDING.disagreeTemplate).toBe(
      "Facts and drawing disagree on {name}. I can't tell which is right.",
    );
    // Never say "verified"
    expect(VERIFY_WORDING.disagree('AB')).not.toMatch(/verified/i);
    expect(VERIFY_WORDING.disagree('AB')).not.toMatch(/trust the text/i);
  });

  it('parses various fact formats correctly', () => {
    const facts = [
      'AB = 5 cm',
      'The length of side BC is 12 mm',
      'The length of hypotenuse CA is 13.',
      'length of side PQ is 8 cm',
      'Side QR is 5 cm',
      'XY: 10',
      'angle C = 90 degrees',
      'angle B = 45°',
      'angle ADC = 90°',
      'Red: 35',
      'Blue has a value of 50',
      'figure not to scale',
      'Some irrelevant commentary that should be ignored',
    ];

    const parsed = parseFacts(facts);
    expect(parsed.hasNotToScale).toBe(true);
    expect(parsed.lengths.map((l) => `${l.target}=${l.value}`)).toEqual([
      'AB=5',
      'BC=12',
      'CA=13',
      'PQ=8',
      'QR=5',
      'XY=10',
    ]);
    expect(parsed.angles.map((a) => `${a.vertex}=${a.value}`)).toEqual([
      'C=90',
      'B=45',
      'ADC=90',
    ]);
    expect(parsed.bars.map((b) => `${b.label}=${b.value}`)).toEqual([
      'Red=35',
      'Blue=50',
    ]);
  });
});

describe('P47 — Scene built from its own facts is never flagged', () => {
  it('never flags a geometric scene built directly from its own measurements', () => {
    // Generate 3 non-collinear points in [0.1, 0.9]^2
    const sceneArb = fc
      .record({
        ax: fc.double({ min: 0.1, max: 0.4, noNaN: true }),
        ay: fc.double({ min: 0.1, max: 0.4, noNaN: true }),
        bx: fc.double({ min: 0.6, max: 0.9, noNaN: true }),
        by: fc.double({ min: 0.1, max: 0.4, noNaN: true }),
        cx: fc.double({ min: 0.2, max: 0.8, noNaN: true }),
        cy: fc.double({ min: 0.6, max: 0.9, noNaN: true }),
        scaleMul: fc.double({ min: 1.0, max: 50.0, noNaN: true }),
      })
      .map(({ ax, ay, bx, by, cx, cy, scaleMul }) => {
        const points: Point[] = [
          { id: 'A', x: ax, y: ay, label: 'A' },
          { id: 'B', x: bx, y: by, label: 'B' },
          { id: 'C', x: cx, y: cy, label: 'C' },
        ];
        const segments: Segment[] = [
          { id: 'AB', a: 'A', b: 'B', label: 'AB' },
          { id: 'BC', a: 'B', b: 'C', label: 'BC' },
          { id: 'CA', a: 'C', b: 'A', label: 'CA' },
        ];
        const dAB = Math.hypot(bx - ax, by - ay);
        const dBC = Math.hypot(cx - bx, cy - by);
        const dCA = Math.hypot(ax - cx, ay - cy);

        // Derive facts with high precision
        const facts = [
          `AB = ${(dAB * scaleMul).toFixed(4)} cm`,
          `BC = ${(dBC * scaleMul).toFixed(4)} cm`,
          `CA = ${(dCA * scaleMul).toFixed(4)} cm`,
        ];

        const scene: DiagramScene = {
          version: 1,
          kind: 'geometry',
          points,
          segments,
          facts,
        };
        return scene;
      });

    fc.assert(
      fc.property(sceneArb, (scene) => {
        const result = verifyScene(scene, { mode: 'raw' });
        return result.status === 'consistent' && result.findings.length === 0;
      }),
      { numRuns: 200 },
    );
  });

  it('never flags a bar chart built directly from its own bar heights', () => {
    const barArb = fc
      .record({
        h1: fc.double({ min: 0.05, max: 0.8, noNaN: true }),
        h2: fc.double({ min: 0.05, max: 0.8, noNaN: true }),
        h3: fc.double({ min: 0.05, max: 0.8, noNaN: true }),
        scaleMul: fc.double({ min: 2.0, max: 100.0, noNaN: true }),
      })
      .map(({ h1, h2, h3, scaleMul }) => {
        const yBase = 0.9;
        const bars: Bar[] = [
          { id: 'b1', label: 'Apples', x0: 0.1, x1: 0.25, y_base: yBase, y_top: yBase - h1, value: h1 * scaleMul },
          { id: 'b2', label: 'Oranges', x0: 0.35, x1: 0.5, y_base: yBase, y_top: yBase - h2, value: h2 * scaleMul },
          { id: 'b3', label: 'Bananas', x0: 0.6, x1: 0.75, y_base: yBase, y_top: yBase - h3, value: h3 * scaleMul },
        ];
        const facts = [
          `Apples: ${(h1 * scaleMul).toFixed(3)}`,
          `Oranges: ${(h2 * scaleMul).toFixed(3)}`,
          `Bananas: ${(h3 * scaleMul).toFixed(3)}`,
        ];
        const scene: DiagramScene = {
          version: 1,
          kind: 'bar_chart',
          bars,
          facts,
        };
        return scene;
      });

    fc.assert(
      fc.property(barArb, (scene) => {
        const result = verifyScene(scene, { mode: 'raw' });
        return result.status === 'consistent' && result.findings.length === 0;
      }),
      { numRuns: 200 },
    );
  });
});

describe('P48 — Results invariant under uniform scale and translation', () => {
  it('status and findings are invariant when scene coordinates are scaled and translated', () => {
    // Base scene: triangle with one honest or one forged fact
    const triangleTemplate = (forgedAC: number): DiagramScene => ({
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.25, y: 0.25, label: 'A' },
        { id: 'B', x: 0.7, y: 0.85, label: 'B' },
        { id: 'C', x: 0.25, y: 0.85, label: 'C' },
      ],
      segments: [
        { id: 'CA', a: 'C', b: 'A', label: 'CA' },
        { id: 'AB', a: 'A', b: 'B', label: 'AB' },
        { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      ],
      facts: [
        'angle C = 90 degrees',
        `AC = ${forgedAC} cm`,
        'BC = 3 cm',
        'AB = 5 cm',
      ],
    });

    const transformArb = fc.record({
      scale: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
      dx: fc.double({ min: -5.0, max: 5.0, noNaN: true }),
      dy: fc.double({ min: -5.0, max: 5.0, noNaN: true }),
      acVal: fc.constantFrom(4, 7), // 4 is honest, 7 is forged
    });

    fc.assert(
      fc.property(transformArb, ({ scale, dx, dy, acVal }) => {
        const originalScene = triangleTemplate(acVal);
        const origResult = verifyScene(originalScene);

        const transformedPoints = (originalScene.points ?? []).map((p) => ({
          ...p,
          x: p.x * scale + dx,
          y: p.y * scale + dy,
        }));

        const transformedScene: DiagramScene = {
          ...originalScene,
          points: transformedPoints,
        };

        const transResult = verifyScene(transformedScene);

        expect(transResult.status).toBe(origResult.status);
        expect(transResult.findings.length).toBe(origResult.findings.length);
        if (origResult.findings.length > 0) {
          expect(transResult.findings[0]?.segmentId).toBe(origResult.findings[0]?.segmentId);
          expect(transResult.findings[0]?.message).toBe(origResult.findings[0]?.message);
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

describe('P49 — Unparsed facts give silence', () => {
  it('arbitrary prose facts produce silent status and empty findings', () => {
    const unparsedArb = fc.array(
      fc.constantFrom(
        'The drawing is shown above.',
        'This diagram was created for educational purposes.',
        'Colors represent different categories.',
        'Note the symmetry of the figure.',
        'The x-axis represents time.',
        'Line segment intersects at origin.',
      ),
      { minLength: 1, maxLength: 6 },
    );

    fc.assert(
      fc.property(unparsedArb, (facts) => {
        const scene: DiagramScene = {
          version: 1,
          kind: 'geometry',
          points: [
            { id: 'A', x: 0.1, y: 0.1 },
            { id: 'B', x: 0.5, y: 0.5 },
          ],
          segments: [{ id: 's0', a: 'A', b: 'B' }],
          facts,
        };
        const res = verifyScene(scene);
        return res.status === 'silent' && res.findings.length === 0;
      }),
      { numRuns: 200 },
    );
  });

  it('any fact indicating "not to scale" produces silent status even with parsed measurements', () => {
    const notToScalePhrases = [
      'not to scale',
      'Not To Scale',
      'figure not to scale',
      'Diagram is not drawn to scale.',
      'WARNING: not drawn to scale',
    ];

    for (const phrase of notToScalePhrases) {
      const scene: DiagramScene = {
        version: 1,
        kind: 'geometry',
        points: [
          { id: 'A', x: 0.0, y: 0.0 },
          { id: 'B', x: 1.0, y: 0.0 },
          { id: 'C', x: 0.0, y: 1.0 },
        ],
        segments: [
          { id: 'AB', a: 'A', b: 'B' },
          { id: 'BC', a: 'B', b: 'C' },
          { id: 'CA', a: 'C', b: 'A' },
        ],
        facts: ['AB = 10', 'BC = 2', 'CA = 99', phrase], // wildly conflicting facts
      };
      const res = verifyScene(scene);
      expect(res.status).toBe('silent');
      expect(res.findings).toEqual([]);
    }
  });

  it('fewer than 2 parsed lengths results in silence', () => {
    const sceneOnlyOneLength: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.0, y: 0.0 },
        { id: 'B', x: 1.0, y: 0.0 },
      ],
      segments: [{ id: 'AB', a: 'A', b: 'B' }],
      facts: ['AB = 100 cm'],
    };
    const res = verifyScene(sceneOnlyOneLength);
    expect(res.status).toBe('silent');
    expect(res.findings).toEqual([]);
  });
});

describe('P50 — Order-independent', () => {
  it('verification status and findings are invariant under permutations of facts and segments', () => {
    const baseScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.25, y: 0.25, label: 'A' },
        { id: 'B', x: 0.7, y: 0.85, label: 'B' },
        { id: 'C', x: 0.25, y: 0.85, label: 'C' },
      ],
      segments: [
        { id: 'CA', a: 'C', b: 'A', label: 'CA' },
        { id: 'AB', a: 'A', b: 'B', label: 'AB' },
        { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      ],
      facts: [
        'angle C = 90 degrees',
        'AC = 7 cm', // forged
        'BC = 3 cm',
        'AB = 5 cm',
      ],
    };

    const initialResult = verifyScene(baseScene);
    expect(initialResult.status).toBe('disagree');

    fc.assert(
      fc.property(
        fc.shuffledSubarray(baseScene.facts!, { minLength: 4, maxLength: 4 }),
        fc.shuffledSubarray(baseScene.segments!, { minLength: 3, maxLength: 3 }),
        (shuffledFacts, shuffledSegments) => {
          const permutedScene: DiagramScene = {
            ...baseScene,
            facts: shuffledFacts,
            segments: shuffledSegments,
          };
          const res = verifyScene(permutedScene);
          expect(res.status).toBe(initialResult.status);
          expect(res.findings.length).toBe(initialResult.findings.length);
          expect(res.findings[0]?.segmentId).toBe(initialResult.findings[0]?.segmentId);
          expect(res.findings[0]?.message).toBe(initialResult.findings[0]?.message);
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Regression Suite — Real Scenes & Forgery Check', () => {
  const sampleModules = import.meta.glob<DiagramScene>('../public/samples/*.json', {
    eager: true,
    import: 'default',
  });
  const synthModules = import.meta.glob<DiagramScene>(
    '../../research/samples/synthetic/ground_truth/*.json',
    { eager: true, import: 'default' },
  );
  const resultModules = import.meta.glob<DiagramScene>(
    '../../research/results/**/predictions/**/*.json',
    { eager: true, import: 'default' },
  );

  const allSceneEntries: { path: string; scene: DiagramScene }[] = [
    ...Object.entries(sampleModules).map(([path, scene]) => ({ path, scene })),
    ...Object.entries(synthModules).map(([path, scene]) => ({ path, scene })),
    ...Object.entries(resultModules).map(([path, scene]) => ({ path, scene })),
  ];

  it('runs over all valid DiagramScenes with ZERO false disagreements', () => {
    let validScenes = 0;
    let scenesWithFacts = 0;
    let scenesWithParsedFacts = 0;
    let disagreeCount = 0;
    const disagreedScenes: { path: string; findings: unknown }[] = [];

    for (const { path, scene } of allSceneEntries) {
      if (!scene || !scene.version || !scene.kind) continue;
      validScenes++;
      if (Array.isArray(scene.facts) && scene.facts.length > 0) {
        scenesWithFacts++;
        const parsed = parseFacts(scene.facts, scene);
        if (
          parsed.lengths.length > 0 ||
          parsed.angles.length > 0 ||
          parsed.bars.length > 0 ||
          parsed.hasNotToScale
        ) {
          scenesWithParsedFacts++;
        }
      }

      const res = verifyScene(scene, { mode: 'ai' });
      if (res.status === 'disagree') {
        disagreeCount++;
        disagreedScenes.push({ path, findings: res.findings });
      }
    }

    const parseRateFraction = scenesWithParsedFacts / validScenes;
    expect(scenesWithParsedFacts).toBe(21);
    expect(parseRateFraction).toBeCloseTo(21 / 60, 2);
    // Kiro review (T29): the title promised zero false disagreements but nothing asserted it.
    expect(disagreedScenes).toEqual([]);
    expect(disagreeCount).toBe(0);
  });

  it('flags a forged "AC = 7 cm" on triangle.json', () => {
    const triangle = sampleModules['../public/samples/triangle.json'] as DiagramScene;
    expect(triangle).toBeDefined();

    // Honest triangle.json is consistent
    const honestResult = verifyScene(triangle);
    expect(honestResult.status).toBe('consistent');
    expect(honestResult.findings).toEqual([]);

    // Forged triangle
    const forgedScene: DiagramScene = {
      ...triangle,
      facts: triangle.facts?.map((f) => (f.startsWith('AC =') ? 'AC = 7 cm' : f)),
    };

    const forgedResult = verifyScene(forgedScene);
    expect(forgedResult.status).toBe('disagree');
    expect(forgedResult.findings.length).toBe(1);
    expect(forgedResult.findings[0]).toEqual({
      segmentId: 'CA',
      message: "Facts and drawing disagree on AC. I can't tell which is right.",
    });
  });
});
