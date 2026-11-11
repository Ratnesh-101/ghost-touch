import { describe, it, expect, vi } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  initialAxisState,
  initialCentreTickState,
  initialState,
  processPointerMove,
} from '../src/flow/explore';
import { fallbackPulse, WebHapticDriver } from '../src/drivers/haptics';
import triangleJson from '../public/samples/triangle.json';

const scene = triangleJson as DiagramScene;
const view = makeViewport(400, 400);
const CORNER = [50, 90, 50];

function touch(x: number, y: number) {
  return processPointerMove(
    scene,
    { x, y },
    view,
    1000,
    initialState(),
    initialCentreTickState(),
    initialAxisState(),
  );
}

describe('sample triangle: every corner emits the corner pattern', () => {
  const corners = [
    { id: 'A', x: 100, y: 100 },
    { id: 'B', x: 280, y: 340 },
    { id: 'C', x: 100, y: 340 },
  ];
  for (const c of corners) {
    it(`corner ${c.id} -> vibrate [50,90,50] and speak`, () => {
      const r = touch(c.x, c.y);
      expect(r.target.kind).toBe('vertex');
      expect(r.effects).toContainEqual({ kind: 'vibrate', pattern: CORNER });
      expect(r.effects).toContainEqual({ kind: 'speak', text: c.id });
    });
  }
});

describe('sample triangle: every edge emits the 80 ms line buzz', () => {
  const edges = [
    { id: 'AB', x: 190, y: 220 },
    { id: 'BC', x: 190, y: 340 },
    { id: 'CA', x: 100, y: 220 },
  ];
  for (const e of edges) {
    it(`edge ${e.id} -> vibrate 80`, () => {
      const r = touch(e.x, e.y);
      expect(r.target.kind).toBe('line');
      expect(r.effects).toContainEqual({ kind: 'vibrate', pattern: 80 });
    });
  }
});

describe('WebHapticDriver array fallback', () => {
  it('computes a solid pulse from the active entries, min 100 ms', () => {
    expect(fallbackPulse(CORNER)).toBe(100);
    expect(fallbackPulse([80, 10, 80])).toBe(160);
    expect(fallbackPulse([10])).toBe(100);
    expect(fallbackPulse([])).toBe(100);
  });

  it('retries with a single pulse when the array pattern returns false', () => {
    const vibrate = vi.fn((p: number | number[]) => !Array.isArray(p));
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.vibrate(CORNER)).toBe(true);
    expect(vibrate).toHaveBeenNthCalledWith(1, CORNER);
    expect(vibrate).toHaveBeenNthCalledWith(2, 100);
    expect(driver.lastResult).toBe(true);
  });

  it('retries with a single pulse when the array pattern throws', () => {
    const vibrate = vi.fn((p: number | number[]) => {
      if (Array.isArray(p)) throw new Error('array rejected');
      return true;
    });
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.vibrate(CORNER)).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith(100);
  });

  it('does not retry when the array pattern succeeds', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    new WebHapticDriver({ vibrate }).vibrate(CORNER);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(CORNER);
  });

  it('does not retry numeric patterns and reports false when everything fails', () => {
    const vibrate = vi.fn().mockReturnValue(false);
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.vibrate(80)).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(driver.vibrate(CORNER)).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(3);
  });
});
