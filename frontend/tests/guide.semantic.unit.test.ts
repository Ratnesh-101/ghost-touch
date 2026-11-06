import { describe, expect, it } from 'vitest';
import barchartFixture from '../public/samples/barchart.json';
import sineFixture from '../public/samples/sine.json';
import triangleFixture from '../public/samples/triangle.json';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  executeExploreCommand,
  parseExploreCommand,
  type ExploreCommandContext,
} from '../src/flow/commands';
import {
  matchSemanticPhrase,
  resolveSemantic,
  type SemanticName,
} from '../src/guide';

const triangleSample = triangleFixture as unknown as DiagramScene;
const sineSample = sineFixture as unknown as DiagramScene;
const barchartSample = barchartFixture as unknown as DiagramScene;

function createTestContext(scene: DiagramScene, isGuideActive: boolean = true): ExploreCommandContext {
  return {
    scene,
    view: makeViewport(400, 400),
    cursorNorm: { x: 0.5, y: 0.5 },
    lastSpoken: '',
    currentCornerIndex: 0,
    currentRate: 'normal',
    isGuiding: false,
    isGuideActive,
  };
}

describe('Semantic Voice Targets — Acceptance Tests on Bundled Samples', () => {
  describe('Sample 1: triangle.json', () => {
    it('resolves rightAngle at vertex C where angle is 90 degrees', () => {
      const res = resolveSemantic(triangleSample, 'rightAngle');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('C');
      expect(res?.x).toBeCloseTo(0.25, 3);
      expect(res?.y).toBeCloseTo(0.85, 3);
    });

    it('resolves longestSide as hypotenuse AB (length 0.75)', () => {
      const res = resolveSemantic(triangleSample, 'longestSide');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('AB');
      // Midpoint of A(0.25, 0.25) and B(0.7, 0.85) = (0.475, 0.55)
      expect(res?.x).toBeCloseTo(0.475, 3);
      expect(res?.y).toBeCloseTo(0.55, 3);
    });

    it('resolves right angle at B and hypotenuse AC on a triangle constructed with right angle at B', () => {
      const triangleAtB: DiagramScene = {
        version: 1,
        kind: 'geometry',
        points: [
          { id: 'A', x: 0.2, y: 0.2, label: 'A' },
          { id: 'B', x: 0.2, y: 0.8, label: 'B' },
          { id: 'C', x: 0.8, y: 0.8, label: 'C' },
        ],
        segments: [
          { id: 'AB', a: 'A', b: 'B', label: 'AB' }, // length 0.6, vertical
          { id: 'BC', a: 'B', b: 'C', label: 'BC' }, // length 0.6, horizontal
          { id: 'AC', a: 'A', b: 'C', label: 'AC' }, // length ~0.849, hypotenuse
        ],
      };

      const rightAngle = resolveSemantic(triangleAtB, 'rightAngle');
      expect(rightAngle).not.toBeNull();
      expect(rightAngle?.label).toBe('B');
      expect(rightAngle?.x).toBeCloseTo(0.2, 3);
      expect(rightAngle?.y).toBeCloseTo(0.8, 3);

      const longestSide = resolveSemantic(triangleAtB, 'longestSide');
      expect(longestSide).not.toBeNull();
      expect(longestSide?.label).toBe('AC');
      expect(longestSide?.x).toBeCloseTo(0.5, 3);
      expect(longestSide?.y).toBeCloseTo(0.5, 3);
    });

    it('returns null for names not applying to triangle (peak, trough, origin, tallestBar, shortestBar)', () => {
      expect(resolveSemantic(triangleSample, 'peak')).toBeNull();
      expect(resolveSemantic(triangleSample, 'trough')).toBeNull();
      expect(resolveSemantic(triangleSample, 'origin')).toBeNull();
      expect(resolveSemantic(triangleSample, 'tallestBar')).toBeNull();
      expect(resolveSemantic(triangleSample, 'shortestBar')).toBeNull();
    });
  });

  describe('Sample 2: sine.json', () => {
    it('resolves peak near a quarter of the period (x ~ 0.30, y = 0.20)', () => {
      const res = resolveSemantic(sineSample, 'peak');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('peak');
      expect(res?.y).toBe(0.2); // minimum y (top of screen)
      expect(res?.x).toBe(0.302);
      // Period spans x = 0.1 to 0.9 (total length 0.8). Quarter period is 0.1 + 0.2 = 0.3.
      expect(res?.x).toBeCloseTo(0.3, 1);
    });

    it('resolves trough near three quarters of the period (x ~ 0.70, y = 0.80)', () => {
      const res = resolveSemantic(sineSample, 'trough');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('lowest point');
      expect(res?.y).toBe(0.8); // maximum y (bottom of screen)
      expect(res?.x).toBe(0.698);
      // Three-quarters period is 0.1 + 0.6 = 0.7.
      expect(res?.x).toBeCloseTo(0.7, 1);
    });

    it('resolves origin at (y_axis_x, x_axis_y) = (0.08, 0.50)', () => {
      const res = resolveSemantic(sineSample, 'origin');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('origin');
      expect(res?.x).toBe(0.08);
      expect(res?.y).toBe(0.5);
    });

    it('returns null for origin if axes is null or either axis coordinate is missing', () => {
      const sineNoAxes: DiagramScene = {
        ...sineSample,
        axes: null,
      };
      expect(resolveSemantic(sineNoAxes, 'origin')).toBeNull();

      const sineMissingX: DiagramScene = {
        ...sineSample,
        axes: { x_axis_y: null, y_axis_x: 0.1 },
      };
      expect(resolveSemantic(sineMissingX, 'origin')).toBeNull();

      const sineMissingY: DiagramScene = {
        ...sineSample,
        axes: { x_axis_y: 0.5, y_axis_x: null },
      };
      expect(resolveSemantic(sineMissingY, 'origin')).toBeNull();
    });

    it('returns null for geometry/bar names on sine curve', () => {
      expect(resolveSemantic(sineSample, 'rightAngle')).toBeNull();
      expect(resolveSemantic(sineSample, 'longestSide')).toBeNull();
      expect(resolveSemantic(sineSample, 'tallestBar')).toBeNull();
      expect(resolveSemantic(sineSample, 'shortestBar')).toBeNull();
    });
  });

  describe('Sample 3: barchart.json', () => {
    it('resolves tallestBar to Q4 with maximum value 32.0', () => {
      const res = resolveSemantic(barchartSample, 'tallestBar');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('Q4');
      // Geometric centre of Q4 bar: x in [0.72, 0.87] => mid 0.795, y in [0.33, 0.85] => mid 0.59
      expect(res?.x).toBeCloseTo(0.795, 3);
      expect(res?.y).toBeCloseTo(0.59, 3);
    });

    it('resolves shortestBar to Q1 with minimum value 10.0', () => {
      const res = resolveSemantic(barchartSample, 'shortestBar');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('Q1');
      // Geometric centre of Q1 bar: x in [0.12, 0.27] => mid 0.195, y in [0.69, 0.85] => mid 0.77
      expect(res?.x).toBeCloseTo(0.195, 3);
      expect(res?.y).toBeCloseTo(0.77, 3);
    });

    it('resolves origin at (y_axis_x, x_axis_y) = (0.1, 0.85) on barchart', () => {
      const res = resolveSemantic(barchartSample, 'origin');
      expect(res).not.toBeNull();
      expect(res?.label).toBe('origin');
      expect(res?.x).toBe(0.1);
      expect(res?.y).toBe(0.85);
    });

    it('returns null for polyline and geometry names on barchart', () => {
      expect(resolveSemantic(barchartSample, 'peak')).toBeNull();
      expect(resolveSemantic(barchartSample, 'trough')).toBeNull();
      expect(resolveSemantic(barchartSample, 'rightAngle')).toBeNull();
      expect(resolveSemantic(barchartSample, 'longestSide')).toBeNull();
    });
  });
});

describe('Tie-Breaking Rules (First in Document Order)', () => {
  it('polyline peak: chooses first vertex in document order on tie', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'function_graph',
      polylines: [
        {
          id: 'poly1',
          points: [
            [0.2, 0.1], // First occurrence of min y=0.1
            [0.5, 0.5],
            [0.8, 0.1], // Second occurrence of min y=0.1
          ],
        },
      ],
    };

    const res = resolveSemantic(scene, 'peak');
    expect(res).not.toBeNull();
    expect(res?.x).toBe(0.2);
    expect(res?.y).toBe(0.1);
  });

  it('polyline trough: chooses first vertex in document order on tie', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'function_graph',
      polylines: [
        {
          id: 'poly1',
          points: [
            [0.1, 0.9], // First occurrence of max y=0.9
            [0.5, 0.3],
            [0.9, 0.9], // Second occurrence of max y=0.9
          ],
        },
      ],
    };

    const res = resolveSemantic(scene, 'trough');
    expect(res).not.toBeNull();
    expect(res?.x).toBe(0.1);
    expect(res?.y).toBe(0.9);
  });

  it('across multiple polylines: first polyline in document order wins tie', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'function_graph',
      polylines: [
        { id: 'p1', points: [[0.2, 0.1], [0.3, 0.4]] },
        { id: 'p2', points: [[0.7, 0.1], [0.8, 0.4]] },
      ],
    };

    const res = resolveSemantic(scene, 'peak');
    expect(res?.x).toBe(0.2);
    expect(res?.y).toBe(0.1);
  });

  it('tallest bar: first bar in document order wins on equal maximum value', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'bar_chart',
      bars: [
        { id: 'barA', label: 'Bar A', value: 50, x0: 0.1, x1: 0.3, y_base: 0.9, y_top: 0.4 },
        { id: 'barB', label: 'Bar B', value: 50, x0: 0.5, x1: 0.7, y_base: 0.9, y_top: 0.4 },
      ],
    };

    const res = resolveSemantic(scene, 'tallestBar');
    expect(res?.label).toBe('Bar A');
  });

  it('shortest bar: first bar in document order wins on equal minimum value', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'bar_chart',
      bars: [
        { id: 'barA', label: 'Bar A', value: 10, x0: 0.1, x1: 0.3, y_base: 0.9, y_top: 0.8 },
        { id: 'barB', label: 'Bar B', value: 10, x0: 0.5, x1: 0.7, y_base: 0.9, y_top: 0.8 },
      ],
    };

    const res = resolveSemantic(scene, 'shortestBar');
    expect(res?.label).toBe('Bar A');
  });

  it('longest side: first segment in document order wins on equal Euclidean length', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0.1, y: 0.1 },
        { id: 'p2', x: 0.5, y: 0.1 }, // length 0.4
        { id: 'p3', x: 0.1, y: 0.5 },
        { id: 'p4', x: 0.5, y: 0.5 }, // length 0.4
      ],
      segments: [
        { id: 's1', a: 'p1', b: 'p2', label: 'Side 1' },
        { id: 's2', a: 'p3', b: 'p4', label: 'Side 2' },
      ],
    };

    const res = resolveSemantic(scene, 'longestSide');
    expect(res?.label).toBe('Side 1');
  });

  it('right angle: first point in document order wins on multiple right angles (rectangle)', () => {
    const rectangle: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0.2, y: 0.2, label: 'Corner 1' },
        { id: 'p2', x: 0.8, y: 0.2, label: 'Corner 2' },
        { id: 'p3', x: 0.8, y: 0.8, label: 'Corner 3' },
        { id: 'p4', x: 0.2, y: 0.8, label: 'Corner 4' },
      ],
      segments: [
        { id: 's1', a: 'p1', b: 'p2' },
        { id: 's2', a: 'p2', b: 'p3' },
        { id: 's3', a: 'p3', b: 'p4' },
        { id: 's4', a: 'p4', b: 'p1' },
      ],
    };

    const res = resolveSemantic(rectangle, 'rightAngle');
    expect(res?.label).toBe('Corner 1');
  });
});

describe('Right Angle Strictness & Tolerance', () => {
  it('accepts angle within 90 +/- 3 degrees (87 to 93 deg)', () => {
    // 88 degrees:
    // v1 along positive x: (0.4, 0)
    // v2 at 88 degrees: (0.4 * cos(88 deg), -0.4 * sin(88 deg))
    const rad88 = (88 * Math.PI) / 180;
    const scene88: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'O', x: 0.4, y: 0.6, label: 'O' },
        { id: 'A', x: 0.8, y: 0.6, label: 'A' },
        { id: 'B', x: 0.4 + 0.4 * Math.cos(rad88), y: 0.6 - 0.4 * Math.sin(rad88), label: 'B' },
      ],
      segments: [
        { id: 's1', a: 'O', b: 'A' },
        { id: 's2', a: 'O', b: 'B' },
      ],
    };

    const res = resolveSemantic(scene88, 'rightAngle');
    expect(res).not.toBeNull();
    expect(res?.label).toBe('O');
  });

  it('rejects angle outside 90 +/- 3 degrees (e.g. 85 degrees or 95 degrees)', () => {
    const rad85 = (85 * Math.PI) / 180;
    const scene85: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'O', x: 0.4, y: 0.6, label: 'O' },
        { id: 'A', x: 0.8, y: 0.6, label: 'A' },
        { id: 'B', x: 0.4 + 0.4 * Math.cos(rad85), y: 0.6 - 0.4 * Math.sin(rad85), label: 'B' },
      ],
      segments: [
        { id: 's1', a: 'O', b: 'A' },
        { id: 's2', a: 'O', b: 'B' },
      ],
    };

    expect(resolveSemantic(scene85, 'rightAngle')).toBeNull();
  });

  it('rejects point with 1 or 3 incident segments (must have EXACTLY two)', () => {
    const scene3: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'O', x: 0.4, y: 0.4, label: 'O' },
        { id: 'A', x: 0.8, y: 0.4, label: 'A' },
        { id: 'B', x: 0.4, y: 0.8, label: 'B' },
        { id: 'C', x: 0.1, y: 0.1, label: 'C' },
      ],
      segments: [
        { id: 's1', a: 'O', b: 'A' },
        { id: 's2', a: 'O', b: 'B' },
        { id: 's3', a: 'O', b: 'C' }, // Third incident segment on O
      ],
    };

    // Even though OA and OB form a 90 degree angle, O has 3 incident segments, so it is not a right-angle vertex
    expect(resolveSemantic(scene3, 'rightAngle')).toBeNull();
  });
});

describe('Voice Commands Phrase Parsing (en/hi/gu)', () => {
  it('parses English semantic target phrases', () => {
    expect(matchSemanticPhrase('peak')).toBe('peak');
    expect(matchSemanticPhrase('the peak')).toBe('peak');
    expect(matchSemanticPhrase('find the peak')).toBe('peak');
    expect(matchSemanticPhrase('take me to the peak')).toBe('peak');
    expect(matchSemanticPhrase('highest point')).toBe('peak');
    expect(matchSemanticPhrase('maximum')).toBe('peak');
    expect(matchSemanticPhrase('top of the curve')).toBe('peak');

    expect(matchSemanticPhrase('lowest point')).toBe('trough');
    expect(matchSemanticPhrase('find lowest point')).toBe('trough');
    expect(matchSemanticPhrase('trough')).toBe('trough');
    expect(matchSemanticPhrase('minimum')).toBe('trough');
    expect(matchSemanticPhrase('bottom of the curve')).toBe('trough');

    expect(matchSemanticPhrase('origin')).toBe('origin');
    expect(matchSemanticPhrase('where the axes cross')).toBe('origin');
    expect(matchSemanticPhrase('axes crossing')).toBe('origin');

    expect(matchSemanticPhrase('tallest bar')).toBe('tallestBar');
    expect(matchSemanticPhrase('find the tallest bar')).toBe('tallestBar');
    expect(matchSemanticPhrase('highest bar')).toBe('tallestBar');
    expect(matchSemanticPhrase('biggest bar')).toBe('tallestBar');

    expect(matchSemanticPhrase('shortest bar')).toBe('shortestBar');
    expect(matchSemanticPhrase('smallest bar')).toBe('shortestBar');

    expect(matchSemanticPhrase('right angle')).toBe('rightAngle');
    expect(matchSemanticPhrase('where is the right angle')).toBe('rightAngle');
    expect(matchSemanticPhrase('find the right angle')).toBe('rightAngle');

    expect(matchSemanticPhrase('longest side')).toBe('longestSide');
    expect(matchSemanticPhrase('find longest side')).toBe('longestSide');
  });

  it('parses Hindi semantic target phrases', () => {
    expect(matchSemanticPhrase('शिखर')).toBe('peak');
    expect(matchSemanticPhrase('शिखर खोजें')).toBe('peak');
    expect(matchSemanticPhrase('मुझे शिखर पर ले चलो')).toBe('peak');
    expect(matchSemanticPhrase('सबसे ऊँचा बिंदु')).toBe('peak');
    expect(matchSemanticPhrase('सबसे ऊंचा बिंदु')).toBe('peak');
    expect(matchSemanticPhrase('अधिकतम')).toBe('peak');
    expect(matchSemanticPhrase('वक्र का शीर्ष')).toBe('peak');

    expect(matchSemanticPhrase('न्यूनतम बिंदु')).toBe('trough');
    expect(matchSemanticPhrase('सबसे निचला बिंदु')).toBe('trough');
    expect(matchSemanticPhrase('गर्त')).toBe('trough');

    expect(matchSemanticPhrase('मूल बिंदु')).toBe('origin');
    expect(matchSemanticPhrase('जहां अक्ष मिलते हैं')).toBe('origin');

    expect(matchSemanticPhrase('सबसे ऊँचा बार')).toBe('tallestBar');
    expect(matchSemanticPhrase('सबसे बड़ा बार')).toBe('tallestBar');

    expect(matchSemanticPhrase('सबसे छोटा बार')).toBe('shortestBar');

    expect(matchSemanticPhrase('समकोण')).toBe('rightAngle');
    expect(matchSemanticPhrase('समकोण खोजें')).toBe('rightAngle');

    expect(matchSemanticPhrase('सबसे लंबी भुजा')).toBe('longestSide');
  });

  it('parses Gujarati semantic target phrases', () => {
    expect(matchSemanticPhrase('શિખર')).toBe('peak');
    expect(matchSemanticPhrase('શિખર શોધો')).toBe('peak');
    expect(matchSemanticPhrase('મને શિખર પર લઈ જાઓ')).toBe('peak');
    expect(matchSemanticPhrase('સૌથી ઊંચો બિંદુ')).toBe('peak');
    expect(matchSemanticPhrase('મહત્તમ')).toBe('peak');
    expect(matchSemanticPhrase('વળાંકની ટોચ')).toBe('peak');

    expect(matchSemanticPhrase('સૌથી નીચો બિંદુ')).toBe('trough');
    expect(matchSemanticPhrase('ગર્ત')).toBe('trough');

    expect(matchSemanticPhrase('ઉદ્ભવ બિંદુ')).toBe('origin');
    expect(matchSemanticPhrase('મૂળ બિંદુ')).toBe('origin');
    expect(matchSemanticPhrase('જ્યાં ધરીઓ મળે છે')).toBe('origin');

    expect(matchSemanticPhrase('સૌથી ઊંચો બાર')).toBe('tallestBar');
    expect(matchSemanticPhrase('સૌથી મોટો બાર')).toBe('tallestBar');

    expect(matchSemanticPhrase('સૌથી ટૂંકો બાર')).toBe('shortestBar');
    expect(matchSemanticPhrase('સૌથી નાનો બાર')).toBe('shortestBar');

    expect(matchSemanticPhrase('કાટખૂણો')).toBe('rightAngle');
    expect(matchSemanticPhrase('કાટખૂણો શોધો')).toBe('rightAngle');

    expect(matchSemanticPhrase('સૌથી લાંબી બાજુ')).toBe('longestSide');
  });

  it('does NOT match standard element queries as semantic targets', () => {
    expect(matchSemanticPhrase('take me to B')).toBeNull();
    expect(matchSemanticPhrase('find A')).toBeNull();
    expect(matchSemanticPhrase('find C')).toBeNull();
    expect(matchSemanticPhrase('hypotenuse')).toBeNull();
    expect(matchSemanticPhrase('point 1')).toBeNull();
  });
});

describe('Flag Off (isGuideActive = false) Falls Through', () => {
  it('falls through to unknown command for all semantic phrases when guide is inactive', () => {
    const phrases = [
      'peak',
      'find the peak',
      'take me to the peak',
      'highest point',
      'lowest point',
      'trough',
      'origin',
      'tallest bar',
      'shortest bar',
      'right angle',
      'longest side',
      'शिखर',
      'मूल बिंदु',
      'समकोण',
      'શિખર',
      'કાટખૂણો',
    ];

    for (const phrase of phrases) {
      const parsed = parseExploreCommand(phrase, false);
      expect(parsed.type).toBe('unknown');

      const parsedWithOptions = parseExploreCommand(phrase, { isGuideActive: false });
      expect(parsedWithOptions.type).toBe('unknown');
    }
  });

  it('parses as guide_semantic when guide is active', () => {
    const parsedPeak = parseExploreCommand('find the peak', true);
    expect(parsedPeak.type).toBe('guide_semantic');
    expect(parsedPeak.semanticTarget).toBe('peak');

    const parsedRightAngle = parseExploreCommand('right angle', { isGuideActive: true });
    expect(parsedRightAngle.type).toBe('guide_semantic');
    expect(parsedRightAngle.semanticTarget).toBe('rightAngle');
  });
});

describe('Command Execution Feedback (Success vs Negative)', () => {
  it('starts guide when semantic target exists', () => {
    const ctx = createTestContext(sineSample, true);
    const cmd = parseExploreCommand('find the peak', true);
    expect(cmd.type).toBe('guide_semantic');

    const res = executeExploreCommand(cmd, ctx);
    expect(res.earcon).toBe('success');
    expect(res.guideTarget).toEqual({ x: 0.302, y: 0.2, label: 'peak' });
    expect(res.speech).toBe('Guiding to peak.');
  });

  it('speaks plain "no X in this diagram" line in ONE utterance when target does not exist', () => {
    const ctx = createTestContext(triangleSample, true);
    const cmd = parseExploreCommand('find the peak', true);
    expect(cmd.type).toBe('guide_semantic');

    const res = executeExploreCommand(cmd, ctx);
    expect(res.earcon).toBe('error');
    expect(res.guideTarget).toBeUndefined();
    expect(res.speech).toBe('There is no peak in this diagram.');
  });

  it('speaks appropriate negative line for each semantic target when missing', () => {
    const emptyScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [],
      segments: [],
      polylines: [],
      bars: [],
      axes: null,
    };
    const ctx = createTestContext(emptyScene, true);

    const checks: Array<{ name: SemanticName; phrase: string; expectedText: string }> = [
      { name: 'peak', phrase: 'peak', expectedText: 'There is no peak in this diagram.' },
      { name: 'trough', phrase: 'trough', expectedText: 'There is no lowest point in this diagram.' },
      { name: 'origin', phrase: 'origin', expectedText: 'There is no origin in this diagram.' },
      { name: 'tallestBar', phrase: 'tallest bar', expectedText: 'There is no tallest bar in this diagram.' },
      { name: 'shortestBar', phrase: 'shortest bar', expectedText: 'There is no shortest bar in this diagram.' },
      { name: 'rightAngle', phrase: 'right angle', expectedText: 'There is no right angle in this diagram.' },
      { name: 'longestSide', phrase: 'longest side', expectedText: 'There is no longest side in this diagram.' },
    ];

    for (const check of checks) {
      const cmd = parseExploreCommand(check.phrase, true);
      expect(cmd.type).toBe('guide_semantic');
      expect(cmd.semanticTarget).toBe(check.name);

      const res = executeExploreCommand(cmd, ctx);
      expect(res.earcon).toBe('error');
      expect(res.guideTarget).toBeUndefined();
      expect(res.speech).toBe(check.expectedText);
    }
  });
});
