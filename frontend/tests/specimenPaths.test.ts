/**
 * Specimen Paths Unit Tests
 *
 * Requirements (docs/briefs/agy-lab-specimen.md):
 * - Pure functions: scene to SVG path data in a 100x100 box with padding.
 * - Fully unit-tested with the three real sample files from disk (triangle, sine, barchart).
 * - Down-sample long polylines to at most 40 points.
 * - Test edge cases: empty scene, missing point IDs, inverted coordinates, NaN guards.
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOX_SIZE,
  DEFAULT_MAX_POLYLINE_POINTS,
  DEFAULT_PADDING,
  downsamplePoints,
  formatCoord,
  generateSpecimenPaths,
  getAxesPath,
  getBarsPath,
  getPlaceholderJarPath,
  getPolylinesPath,
  getSegmentsPath,
  getVertexDots,
  getVertexDotsPath,
  transformCoord,
} from '../src/components/specimenPaths';
import type { DiagramScene } from '../src/types/scene.gen';

function loadSampleJson(filename: string): DiagramScene {
  const fileUrl = new URL(`../public/samples/${filename}`, import.meta.url);
  const content = fs.readFileSync(fileUrl, 'utf-8') as string;
  return JSON.parse(content) as DiagramScene;
}

const triangleScene = loadSampleJson('triangle.json');
const sineScene = loadSampleJson('sine.json');
const barchartScene = loadSampleJson('barchart.json');

describe('specimenPaths helper functions', () => {
  it('exports default constants correctly', () => {
    expect(DEFAULT_BOX_SIZE).toBe(100);
    expect(DEFAULT_PADDING).toBe(10);
    expect(DEFAULT_MAX_POLYLINE_POINTS).toBe(40);
  });

  it('formatCoord rounds to 2 decimal places and handles non-finite numbers', () => {
    expect(formatCoord(10)).toBe('10');
    expect(formatCoord(10.5)).toBe('10.5');
    expect(formatCoord(10.555)).toBe('10.56');
    expect(formatCoord(10.501)).toBe('10.5');
    expect(formatCoord(NaN)).toBe('0');
    expect(formatCoord(Infinity)).toBe('0');
  });

  it('transformCoord maps normalized [0, 1] to padded box [10, 90]', () => {
    expect(transformCoord(0)).toBe(10);
    expect(transformCoord(1)).toBe(90);
    expect(transformCoord(0.5)).toBe(50);
    expect(transformCoord(0.25)).toBe(30);
    expect(transformCoord(NaN)).toBe(DEFAULT_PADDING);
  });

  it('transformCoord respects custom boxSize and padding', () => {
    expect(transformCoord(0, 200, 20)).toBe(20);
    expect(transformCoord(1, 200, 20)).toBe(180);
    expect(transformCoord(0.5, 200, 20)).toBe(100);
  });
});

describe('downsamplePoints', () => {
  it('preserves arrays with <= maxPoints unchanged', () => {
    const pts: [number, number][] = [
      [0, 0],
      [0.5, 0.5],
      [1, 1],
    ];
    const result = downsamplePoints(pts, 40);
    expect(result).toHaveLength(3);
    expect(result).toEqual(pts);
  });

  it('down-samples arrays with > 40 points to exactly 40 points', () => {
    const pts: [number, number][] = Array.from({ length: 100 }, (_, i) => [i / 99, Math.sin(i)]);
    const result = downsamplePoints(pts, 40);
    expect(result).toHaveLength(40);
    // Preserves the first point
    expect(result[0]).toEqual(pts[0]);
    // Preserves the last point
    expect(result[39]).toEqual(pts[99]);
  });

  it('handles empty and single-point lists gracefully', () => {
    expect(downsamplePoints([])).toEqual([]);
    expect(downsamplePoints([[0.5, 0.5]])).toEqual([[0.5, 0.5]]);
    expect(downsamplePoints([[0.1, 0.1], [0.9, 0.9]], 1)).toEqual([[0.1, 0.1]]);
  });
});

describe('real sample file: triangle.json', () => {
  it('generates segment paths connecting points A, B, and C', () => {
    const paths = generateSpecimenPaths(triangleScene);
    expect(paths.hasContent).toBe(true);
    expect(paths.segments).toBeTruthy();

    // Contains CA, AB, BC segments
    expect(paths.segments).toContain('M 30 78 L 30 30'); // CA: (0.25, 0.85) to (0.25, 0.25)
    expect(paths.segments).toContain('M 30 30 L 66 78'); // AB: (0.25, 0.25) to (0.7, 0.85)
    expect(paths.segments).toContain('M 66 78 L 30 78'); // BC: (0.7, 0.85) to (0.25, 0.85)

    // No axes, bars or polylines
    expect(paths.axes).toBe('');
    expect(paths.bars).toBe('');
    expect(paths.polylines).toBe('');
  });

  it('generates 3 vertex dots for right triangle vertices', () => {
    const rawDots = getVertexDots(triangleScene.points);
    expect(rawDots).toHaveLength(3);
    const rawPath = getVertexDotsPath(rawDots);
    expect(rawPath).toContain('M 27.5 30 a 2.5 2.5');

    const paths = generateSpecimenPaths(triangleScene);
    expect(paths.vertexDots).toHaveLength(3);
    const [dotA, dotB, dotC] = paths.vertexDots;
    expect(dotA).toEqual({ id: 'A', cx: 30, cy: 30, r: 2.5 });
    expect(dotB).toEqual({ id: 'B', cx: 66, cy: 78, r: 2.5 });
    expect(dotC).toEqual({ id: 'C', cx: 30, cy: 78, r: 2.5 });

    // Circular arcs in vertexDotsPath
    expect(paths.vertexDotsPath).toContain('M 27.5 30 a 2.5 2.5');
  });
});

describe('real sample file: sine.json', () => {
  it('generates axes and down-sampled polyline curve', () => {
    const paths = generateSpecimenPaths(sineScene);
    expect(paths.hasContent).toBe(true);

    // Direct getAxesPath test
    const directAxes = getAxesPath(sineScene.axes);
    expect(directAxes).toBe(paths.axes);

    // Coordinate axes: x_axis_y = 0.5 -> y = 50; y_axis_x = 0.08 -> x = 16.4
    expect(paths.axes).toContain('M 10 50 L 90 50');
    expect(paths.axes).toContain('M 16.4 10 L 16.4 90');

    // Sine polyline original has 100 points; must be down-sampled to <= 40
    expect(paths.polylines).toBeTruthy();
    const lCommands = (paths.polylines.match(/ L /g) || []).length;
    // 39 L commands + 1 M command = 40 points
    expect(lCommands).toBe(39);

    // Starts at (0.1, 0.5) -> (18, 50) and ends at (0.9, 0.5) -> (82, 50)
    expect(paths.polylines.startsWith('M 18 50')).toBe(true);
    expect(paths.polylines.endsWith('L 82 50')).toBe(true);

    // No segments, bars, or vertex dots
    expect(paths.segments).toBe('');
    expect(paths.bars).toBe('');
    expect(paths.vertexDots).toHaveLength(0);
  });
});

describe('real sample file: barchart.json', () => {
  it('generates axes and 4 bar rectangles', () => {
    const paths = generateSpecimenPaths(barchartScene);
    expect(paths.hasContent).toBe(true);

    // Axes: x_axis_y = 0.85 -> y = 78; y_axis_x = 0.1 -> x = 18
    expect(paths.axes).toContain('M 10 78 L 90 78');
    expect(paths.axes).toContain('M 18 10 L 18 90');

    // 4 bars with Z closing commands
    const zCommands = (paths.bars.match(/ Z/g) || []).length;
    expect(zCommands).toBe(4);

    // Q1 bar: x0: 0.12, x1: 0.27 -> x: [19.6, 31.6]; y_top: 0.69, y_base: 0.85 -> y: [65.2, 78]
    expect(paths.bars).toContain('M 19.6 65.2 L 31.6 65.2 L 31.6 78 L 19.6 78 Z');

    // Q4 bar: x0: 0.72, x1: 0.87 -> x: [67.6, 79.6]; y_top: 0.33, y_base: 0.85 -> y: [36.4, 78]
    expect(paths.bars).toContain('M 67.6 36.4 L 79.6 36.4 L 79.6 78 L 67.6 78 Z');

    // No segments, polylines, or vertex dots
    expect(paths.segments).toBe('');
    expect(paths.polylines).toBe('');
    expect(paths.vertexDots).toHaveLength(0);
  });
});

describe('edge cases and robustness', () => {
  it('returns empty paths for null, undefined, or empty scenes', () => {
    const nullPaths = generateSpecimenPaths(null);
    expect(nullPaths.hasContent).toBe(false);
    expect(nullPaths.allLines).toBe('');
    expect(nullPaths.vertexDots).toEqual([]);

    const emptyPaths = generateSpecimenPaths({ kind: 'unknown' } as DiagramScene);
    expect(emptyPaths.hasContent).toBe(false);
    expect(emptyPaths.allLines).toBe('');
    expect(emptyPaths.vertexDots).toEqual([]);
  });

  it('safely ignores segments referencing non-existent point IDs', () => {
    const brokenScene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.2, y: 0.2 }],
      segments: [
        { id: 'AB', a: 'A', b: 'B' }, // B does not exist!
        { id: 'XY', a: 'X', b: 'Y' }, // Neither exists!
      ],
    };
    const path = getSegmentsPath(brokenScene.segments, brokenScene.points);
    expect(path).toBe('');
  });

  it('safely renders segments when one exists and one is missing', () => {
    const partialScene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.2, y: 0.2 },
        { id: 'B', x: 0.8, y: 0.8 },
      ],
      segments: [
        { id: 'AB', a: 'A', b: 'B' }, // valid
        { id: 'AC', a: 'A', b: 'C' }, // missing C
      ],
    };
    const path = getSegmentsPath(partialScene.segments, partialScene.points);
    expect(path).toBe('M 26 26 L 74 74');
  });

  it('handles inverted bar coordinates (x0 > x1, y_top > y_base) without errors', () => {
    const invertedBarScene: DiagramScene = {
      kind: 'bar_chart',
      bars: [
        {
          id: 'inv',
          x0: 0.8,
          x1: 0.2,
          y_top: 0.9,
          y_base: 0.1,
          label: 'Inverted',
          value: 10,
        },
      ],
    };
    const path = getBarsPath(invertedBarScene.bars);
    // x should be ordered [26, 74], y ordered [18, 82]
    expect(path).toBe('M 26 18 L 74 18 L 74 82 L 26 82 Z');
  });

  it('filters out bars with non-finite values', () => {
    const nanBarScene: DiagramScene = {
      kind: 'bar_chart',
      bars: [
        {
          id: 'nanBar',
          x0: NaN,
          x1: 0.5,
          y_top: 0.1,
          y_base: 0.8,
          label: 'NaN',
          value: 0,
        },
      ],
    };
    expect(getBarsPath(nanBarScene.bars)).toBe('');
  });

  it('handles polylines with 1 point safely', () => {
    const singlePointPoly: DiagramScene = {
      kind: 'function_graph',
      polylines: [{ id: 'p1', points: [[0.5, 0.5]] }],
    };
    expect(getPolylinesPath(singlePointPoly.polylines)).toBe('M 50 50');
  });

  it('handles polylines with NaN coordinates safely', () => {
    const nanPoly: DiagramScene = {
      kind: 'function_graph',
      polylines: [{ id: 'p1', points: [[NaN, 0.5], [0.5, NaN]] }],
    };
    expect(getPolylinesPath(nanPoly.polylines)).toBe('');
  });

  it('provides a valid static placeholder jar SVG path', () => {
    const jarPath = getPlaceholderJarPath();
    expect(jarPath).toBeTruthy();
    expect(jarPath).toContain('M 36 20');
    expect(jarPath).toContain('Q 28 80');
  });
});
