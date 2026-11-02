import { describe, it, expect } from 'vitest';
import { hitTest, DEFAULT_RADII } from '../src/core/hitTest';
import { makeViewport, toScreen, type Viewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';

// Square viewport: scale 400, no letterbox margins, so toScreen(p) = p * 400.
// This keeps the hit-test math simple and easy to reason about.
const view: Viewport = makeViewport(400, 400);

// ---------------------------------------------------------------------------
// Vertex hits (Requirements 4.3, 4.6)
// ---------------------------------------------------------------------------

describe('hitTest — vertex', () => {
  it('returns the vertex when the finger is at a point screen position', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.5, y: 0.5, label: 'A' }],
    };
    const finger = toScreen({ x: 0.5, y: 0.5 }, view); // (200, 200)
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'vertex', id: 'A', label: 'A' });
  });

  it('returns a vertex with no label when the point has none', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.5, y: 0.5 }],
    };
    const finger = toScreen({ x: 0.5, y: 0.5 }, view);
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'vertex', id: 'A' });
  });

  it('treats a null point label as no label', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.5, y: 0.5, label: null }],
    };
    const finger = toScreen({ x: 0.5, y: 0.5 }, view);
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'vertex', id: 'A' });
  });

  it('returns the closest vertex when several are within radius (Requirement 4.6)', () => {
    // A at (100,100), B at (100,120). Finger (100,108): dist A=8, dist B=12.
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.25, y: 0.25, label: 'A' },
        { id: 'B', x: 0.25, y: 0.3, label: 'B' },
      ],
    };
    const finger = { x: 100, y: 108 };
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'vertex', id: 'A', label: 'A' });
  });

  it('prefers vertex over line when the finger is within both radii (Requirement 4.6)', () => {
    // A at (200,200) is an endpoint of vertical segment AB down to B(200,0).
    // Finger (200,210): 10 px from A (<= vertex 22) AND on the segment's line
    // (distToSegment = 10 <= line 14), so it is within BOTH radii.
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.5, y: 0.5, label: 'A' },
        { id: 'B', x: 0.5, y: 0.0 },
      ],
      segments: [{ id: 'AB', a: 'A', b: 'B' }],
    };
    const finger = { x: 200, y: 210 };
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'vertex', id: 'A', label: 'A' });
  });

  it('does not hit a vertex outside a custom smaller radius', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.5, y: 0.5, label: 'A' }],
    };
    // 10 px from A: within default vertex radius 22, outside radius 5.
    const finger = { x: 210, y: 200 };
    expect(hitTest(scene, finger, view)).toEqual({ kind: 'vertex', id: 'A', label: 'A' });
    expect(hitTest(scene, finger, view, { vertex: 5, line: 5 })).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Line hits — segments
// ---------------------------------------------------------------------------

describe('hitTest — line (segment)', () => {
  it('returns a line when the finger is near a segment but not a vertex', () => {
    // Segment AB from (80,80) to (320,80). Finger (200,90): 10 px below.
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.2, y: 0.2 },
        { id: 'B', x: 0.8, y: 0.2 },
      ],
      segments: [{ id: 'AB', a: 'A', b: 'B', label: 'AB' }],
    };
    const finger = { x: 200, y: 90 };
    expect(hitTest(scene, finger, view)).toEqual({
      kind: 'line',
      id: 'AB',
      elementKind: 'segment',
    });
  });

  it('skips a segment whose endpoints are dangling references', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      segments: [{ id: 'dangling', a: 'X', b: 'Y' }],
    };
    expect(hitTest(scene, { x: 200, y: 200 }, view)).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Line hits — polylines
// ---------------------------------------------------------------------------

describe('hitTest — line (polyline)', () => {
  it('returns a polyline line when the finger is on the curve', () => {
    // Three points: (80,80) -> (200,80) -> (320,320). Finger on segment 2's
    // midpoint (260,200) sits exactly on the polyline.
    const scene: DiagramScene = {
      kind: 'function_graph',
      polylines: [
        { id: 'curve', points: [[0.2, 0.2], [0.5, 0.2], [0.8, 0.8]], label: 'sin(x)' },
      ],
    };
    const finger = { x: 260, y: 200 };
    expect(hitTest(scene, finger, view)).toEqual({
      kind: 'line',
      id: 'curve',
      elementKind: 'polyline',
    });
  });

  it('returns none when the finger is far from every polyline segment', () => {
    const scene: DiagramScene = {
      kind: 'function_graph',
      polylines: [{ id: 'curve', points: [[0.2, 0.2], [0.5, 0.2], [0.8, 0.8]] }],
    };
    expect(hitTest(scene, { x: 20, y: 380 }, view)).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Line hits — axes
// ---------------------------------------------------------------------------

describe('hitTest — line (axis)', () => {
  it('returns the x-axis when the finger is near it', () => {
    // x-axis at y=0.5 -> screen y=200, full width. Finger 10 px below.
    const scene: DiagramScene = {
      kind: 'function_graph',
      axes: { x_axis_y: 0.5, y_axis_x: null },
    };
    const finger = { x: 200, y: 210 };
    expect(hitTest(scene, finger, view)).toEqual({
      kind: 'line',
      id: 'x-axis',
      elementKind: 'axis',
    });
  });

  it('returns the y-axis when the finger is near it', () => {
    // y-axis at x=0.5 -> screen x=200, full height. Finger 10 px left.
    const scene: DiagramScene = {
      kind: 'function_graph',
      axes: { x_axis_y: null, y_axis_x: 0.5 },
    };
    const finger = { x: 190, y: 200 };
    expect(hitTest(scene, finger, view)).toEqual({
      kind: 'line',
      id: 'y-axis',
      elementKind: 'axis',
    });
  });
});

// ---------------------------------------------------------------------------
// Bar hits (interior)
// ---------------------------------------------------------------------------

describe('hitTest — bar', () => {
  it('returns the bar when the finger is inside the bar rectangle', () => {
    // Q1: x0=0.12 x1=0.27 (48..108), y_top=0.69 y_base=0.85 (276..340).
    // Finger at the center (78,308) -> norm (0.195, 0.77), inside.
    const scene: DiagramScene = {
      kind: 'bar_chart',
      bars: [
        { id: 'q1', x0: 0.12, x1: 0.27, y_top: 0.69, y_base: 0.85, label: 'Q1', value: 10 },
      ],
    };
    const finger = { x: 78, y: 308 };
    expect(hitTest(scene, finger, view)).toEqual({
      kind: 'bar',
      id: 'q1',
      label: 'Q1',
      value: 10,
      maxValue: 10,
    });
  });

  it('returns none when the finger is outside the bar rectangle', () => {
    const scene: DiagramScene = {
      kind: 'bar_chart',
      bars: [
        { id: 'q1', x0: 0.12, x1: 0.27, y_top: 0.69, y_base: 0.85, label: 'Q1', value: 10 },
      ],
    };
    // Just left of the bar.
    expect(hitTest(scene, { x: 20, y: 308 }, view)).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Bar edges (Req 6.3)
// ---------------------------------------------------------------------------

describe('hitTest — bar edges', () => {
  const barScene: DiagramScene = {
    kind: 'bar_chart',
    bars: [
      { id: 'q1', x0: 0.12, x1: 0.27, y_top: 0.69, y_base: 0.85, label: 'Q1', value: 10 },
    ],
  };
  // In a 400x400 viewport: top=(48,276)-(108,276), bottom=(48,340)-(108,340),
  // left=(48,276)-(48,340), right=(108,276)-(108,340)

  it('returns a bar-edge line when the finger is near the top edge', () => {
    // 5 px above the top edge midpoint (78, 276) -> finger (78, 271)
    expect(hitTest(barScene, { x: 78, y: 271 }, view)).toEqual({
      kind: 'line',
      id: 'q1',
      elementKind: 'bar-edge',
    });
  });

  it('returns a bar-edge line when the finger is near the bottom edge', () => {
    // 5 px below the bottom edge midpoint (78, 340) -> finger (78, 345)
    expect(hitTest(barScene, { x: 78, y: 345 }, view)).toEqual({
      kind: 'line',
      id: 'q1',
      elementKind: 'bar-edge',
    });
  });

  it('returns a bar-edge line when the finger is near the left edge', () => {
    // 5 px left of the left edge midpoint (48, 308) -> finger (43, 308)
    expect(hitTest(barScene, { x: 43, y: 308 }, view)).toEqual({
      kind: 'line',
      id: 'q1',
      elementKind: 'bar-edge',
    });
  });

  it('returns a bar-edge line when the finger is near the right edge', () => {
    // 5 px right of the right edge midpoint (108, 308) -> finger (113, 308)
    expect(hitTest(barScene, { x: 113, y: 308 }, view)).toEqual({
      kind: 'line',
      id: 'q1',
      elementKind: 'bar-edge',
    });
  });

  it('returns none when the finger is far from all bar edges', () => {
    // 20 px above the top edge, outside the line radius (14 px)
    expect(hitTest(barScene, { x: 78, y: 256 }, view)).toEqual({ kind: 'none' });
  });
});
// ---------------------------------------------------------------------------
// Priority: line beats bar
// ---------------------------------------------------------------------------

describe('hitTest — priority', () => {
  it('returns a line (not the bar) when the finger is inside a bar and near a line', () => {
    // Bar covers (160..240, 160..240). A horizontal segment P1P2 runs across
    // the bar at screen y=200. Finger (200,205) is inside the bar AND 5 px
    // from the segment, so the line wins (line > bar interior).
    const scene: DiagramScene = {
      kind: 'bar_chart',
      points: [
        { id: 'P1', x: 0.4, y: 0.5 },
        { id: 'P2', x: 0.6, y: 0.5 },
      ],
      segments: [{ id: 'P1P2', a: 'P1', b: 'P2' }],
      bars: [{ id: 'b1', x0: 0.4, x1: 0.6, y_top: 0.4, y_base: 0.6, label: 'B', value: 5 }],
    };
    const finger = { x: 200, y: 205 };
    expect(hitTest(scene, finger, view)).toEqual({
      kind: 'line',
      id: 'P1P2',
      elementKind: 'segment',
    });
  });
});

// ---------------------------------------------------------------------------
// None
// ---------------------------------------------------------------------------

describe('hitTest — none', () => {
  it('returns none when the finger is far from everything', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.5, y: 0.5, label: 'A' }],
      segments: [{ id: 'AB', a: 'A', b: 'B' }],
    };
    expect(hitTest(scene, { x: 380, y: 380 }, view)).toEqual({ kind: 'none' });
  });

  it('returns none for an empty scene', () => {
    const scene: DiagramScene = { kind: 'unknown' };
    expect(hitTest(scene, { x: 200, y: 200 }, view)).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('hitTest — defaults', () => {
  it('uses DEFAULT_RADII (vertex 22, line 14) when no radii are passed', () => {
    const scene: DiagramScene = {
      kind: 'geometry',
      points: [{ id: 'A', x: 0.5, y: 0.5, label: 'A' }],
    };
    // 22 px from A: exactly at the default vertex radius boundary.
    const finger = { x: 222, y: 200 };
    expect(DEFAULT_RADII).toEqual({ vertex: 22, line: 14 });
    expect(hitTest(scene, finger, view).kind).toBe('vertex');
  });
});
