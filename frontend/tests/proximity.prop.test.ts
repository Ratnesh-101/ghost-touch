/**
 * P97-P103: the near-line click cue machine (Requirement 27, task 51). Written by Kiro before
 * `core/proximity.ts`, from the spec only.
 *
 * Oracles are built in this file: the expected interval, pitch, gain and pan are computed here
 * with their own straight-line formulas, never by calling the module's helpers (except in P98,
 * where the helpers are the thing under test and the oracle is the end-point values).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROXIMITY,
  PROXIMITY_GAIN_FAR,
  PROXIMITY_GAIN_NEAR,
  clickGain,
  clickHz,
  clickIntervalMs,
  initialProximityState,
  proximityStep,
  type ProximityConfig,
  type ProximityEffect,
  type ProximityInput,
  type ProximityState,
} from '../src/core/proximity';

const RUNS = { numRuns: 250 };

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const BAD_NUMBERS = [NaN, Infinity, -Infinity, -1, -1e-9, 1e300, -1e300, 1e308, 0, -0];
const arbBadNumber = fc.constantFrom(...BAD_NUMBERS);
/** Any number at all, including the awkward ones. */
const arbAnyNumber = fc.oneof(
  { weight: 3, arbitrary: fc.double({ min: -200, max: 200, noNaN: true }) },
  { weight: 1, arbitrary: arbBadNumber },
  { weight: 1, arbitrary: fc.double({ noNaN: true }) },
);

const arbConfig: fc.Arbitrary<ProximityConfig> = fc
  .record({
    lineRadiusPx: fc.double({ min: 1, max: 30, noNaN: true }),
    gap: fc.double({ min: 1, max: 100, noNaN: true }),
    nearMs: fc.double({ min: 20, max: 200, noNaN: true }),
    spreadMs: fc.double({ min: 0, max: 800, noNaN: true }),
    loHz: fc.double({ min: 100, max: 1000, noNaN: true }),
    spreadHz: fc.double({ min: 0, max: 2000, noNaN: true }),
  })
  .map((r) => ({
    radiusPx: r.lineRadiusPx + r.gap,
    lineRadiusPx: r.lineRadiusPx,
    nearMs: r.nearMs,
    farMs: r.nearMs + r.spreadMs,
    loHz: r.loHz,
    hiHz: r.loHz + r.spreadHz,
  }));

/** A time step: usually forward by a small amount, sometimes a bad or backwards timestamp. */
const arbTimeStep = fc.record({
  dt: fc.double({ min: 0, max: 300, noNaN: true }),
  special: fc.option(fc.constantFrom(NaN, Infinity, -Infinity, -5, 1e300, 0), { freq: 6 }),
});

interface RawMove {
  kind: 'move';
  distPx: number | null;
  dxPx: number;
  onLine: boolean;
  inQuietWindow: boolean;
}
type RawInput = RawMove | { kind: 'lift' };

const arbDist = fc.oneof(
  { weight: 4, arbitrary: fc.double({ min: 0, max: 80, noNaN: true }) },
  { weight: 1, arbitrary: fc.constant(null) },
  { weight: 1, arbitrary: arbBadNumber },
);
const arbMove: fc.Arbitrary<RawMove> = fc.record({
  kind: fc.constant<'move'>('move'),
  distPx: arbDist,
  dxPx: fc.oneof(
    { weight: 4, arbitrary: fc.double({ min: -80, max: 80, noNaN: true }) },
    { weight: 1, arbitrary: arbBadNumber },
  ),
  onLine: fc.boolean(),
  inQuietWindow: fc.boolean(),
});
const arbRawInput: fc.Arbitrary<RawInput> = fc.oneof(
  { weight: 5, arbitrary: arbMove },
  { weight: 1, arbitrary: fc.constant<RawInput>({ kind: 'lift' }) },
);

/** Inputs with a timeline attached. */
const arbTimeline = fc.array(fc.tuple(arbTimeStep, arbRawInput), { maxLength: 60 });

function attachTimes(items: Array<[{ dt: number; special: number | null }, RawInput]>): ProximityInput[] {
  let clock = 0;
  return items.map(([step, raw]) => {
    clock += step.dt;
    const t = step.special === null ? clock : step.special;
    return { ...raw, t } as ProximityInput;
  });
}

interface Run {
  state: ProximityState;
  /** Every emitted click, with the input that produced it. */
  clicks: Array<{ effect: ProximityEffect; input: ProximityInput }>;
  /** Every effect list returned, in order. */
  all: ProximityEffect[][];
}

function run(
  inputs: ProximityInput[],
  cfg: ProximityConfig = DEFAULT_PROXIMITY,
  start: ProximityState = initialProximityState(),
): Run {
  let state = start;
  const clicks: Run['clicks'] = [];
  const all: ProximityEffect[][] = [];
  for (const input of inputs) {
    const out = proximityStep(state, input, cfg);
    state = out.state;
    all.push(out.effects);
    for (const effect of out.effects) clicks.push({ effect, input });
  }
  return { state, clicks, all };
}

// ---------------------------------------------------------------------------
// Independent oracles (straight-line formulas from the spec)
// ---------------------------------------------------------------------------

function oracleCloseness(d: number, cfg: ProximityConfig): number {
  const raw = (d - cfg.lineRadiusPx) / (cfg.radiusPx - cfg.lineRadiusPx);
  return 1 - Math.min(1, Math.max(0, raw));
}
const oracleInterval = (d: number, cfg: ProximityConfig) =>
  cfg.farMs + (cfg.nearMs - cfg.farMs) * oracleCloseness(d, cfg);
const oracleHz = (d: number, cfg: ProximityConfig) =>
  cfg.loHz + (cfg.hiHz - cfg.loHz) * oracleCloseness(d, cfg);
const oracleGain = (d: number) =>
  PROXIMITY_GAIN_FAR + (PROXIMITY_GAIN_NEAR - PROXIMITY_GAIN_FAR) * oracleCloseness(d, DEFAULT_PROXIMITY);

/** The distance the machine must use for an input (null when it must stay silent). */
function effectiveDistance(i: ProximityInput, cfg: ProximityConfig): number | null {
  if (i.kind !== 'move' || !Number.isFinite(i.t) || !Number.isFinite(i.dxPx)) return null;
  if (i.onLine) return i.inQuietWindow ? 0 : null;
  if (i.distPx === null || !Number.isFinite(i.distPx) || i.distPx < 0 || i.distPx > cfg.radiusPx) return null;
  return i.distPx;
}

/** The single effect of a step that must have clicked. */
function only(effects: ProximityEffect[]): ProximityEffect {
  expect(effects).toHaveLength(1);
  const first = effects[0];
  if (first === undefined) throw new Error('no effect');
  return first;
}

const move = (t: number, distPx: number | null, dxPx: number, onLine = false, inQuietWindow = false): ProximityInput => ({
  kind: 'move',
  t,
  distPx,
  dxPx,
  onLine,
  inQuietWindow,
});

// ---------------------------------------------------------------------------

describe('P97: audio only, never a vibration (Requirement 27.7)', () => {
  it('every effect is a click with finite numbers, for any input sequence', () => {
    fc.assert(
      fc.property(arbTimeline, (items) => {
        const result = run(attachTimes(items));
        for (const { effect } of result.clicks) {
          expect(effect.kind).toBe('click');
          expect(Object.keys(effect).sort()).toEqual(['gain', 'hz', 'kind', 'pan']);
          expect(Number.isFinite(effect.hz)).toBe(true);
          expect(Number.isFinite(effect.pan)).toBe(true);
          expect(Number.isFinite(effect.gain)).toBe(true);
        }
      }),
      RUNS,
    );
  });
});

describe('P98: closer is faster, higher and louder (Requirement 27.1)', () => {
  it('helpers are monotonic in distance and hit the end points', () => {
    fc.assert(
      fc.property(arbConfig, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (cfg, a, b) => {
        const d1 = Math.min(a, b) * cfg.radiusPx;
        const d2 = Math.max(a, b) * cfg.radiusPx;
        expect(clickIntervalMs(d1, cfg)).toBeLessThanOrEqual(clickIntervalMs(d2, cfg));
        expect(clickHz(d1, cfg)).toBeGreaterThanOrEqual(clickHz(d2, cfg));
        expect(clickGain(d1, cfg)).toBeGreaterThanOrEqual(clickGain(d2, cfg));
        // Closest setting at or inside the line radius.
        const inside = Math.min(d1, cfg.lineRadiusPx);
        expect(clickIntervalMs(inside, cfg)).toBeCloseTo(cfg.nearMs, 9);
        expect(clickHz(inside, cfg)).toBeCloseTo(cfg.hiHz, 9);
        expect(clickGain(inside, cfg)).toBeCloseTo(PROXIMITY_GAIN_NEAR, 9);
        // Far setting at the radius.
        expect(clickIntervalMs(cfg.radiusPx, cfg)).toBeCloseTo(cfg.farMs, 9);
        expect(clickHz(cfg.radiusPx, cfg)).toBeCloseTo(cfg.loHz, 9);
        expect(clickGain(cfg.radiusPx, cfg)).toBeCloseTo(PROXIMITY_GAIN_FAR, 9);
      }),
      RUNS,
    );
  });

  it('the emitted click carries the oracle values for its distance', () => {
    fc.assert(
      fc.property(arbConfig, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -50, max: 50, noNaN: true }), (cfg, frac, dx) => {
        const d = frac * cfg.radiusPx;
        const out = proximityStep(initialProximityState(), move(1000, d, dx), cfg);
        expect(out.effects).toHaveLength(1);
        const click = only(out.effects);
        expect(click.hz).toBeCloseTo(oracleHz(d, cfg), 6);
        expect(click.gain).toBeCloseTo(
          PROXIMITY_GAIN_FAR +
            (PROXIMITY_GAIN_NEAR - PROXIMITY_GAIN_FAR) * oracleCloseness(d, cfg),
          9,
        );
        expect(clickIntervalMs(d, cfg)).toBeCloseTo(oracleInterval(d, cfg), 6);
      }),
      RUNS,
    );
  });

  // Task 88: a distance one ulp farther must never be closer, down to the last bit. The old blend
  // `a*(1-f) + b*f` was found one ulp non-monotone at adjacent doubles (counterexamples below,
  // from a hunt over adjacent distances).
  it('pinned counterexamples: adjacent distances stay ordered (gain, interval)', () => {
    const gainCfg: ProximityConfig = {
      radiusPx: 103.06741839992839,
      lineRadiusPx: 25.359573642329543,
      nearMs: 85.19661125974058,
      farMs: 209.53017070066528,
      loHz: 684.6826450011275,
      hiHz: 858.7052224720085,
    };
    expect(clickGain(25.789401670918686, gainCfg)).toBeGreaterThanOrEqual(clickGain(25.789401670918693, gainCfg));
    const intervalCfg: ProximityConfig = {
      radiusPx: 80.91421025585248,
      lineRadiusPx: 6.766368999707957,
      nearMs: 113.5539707653568,
      farMs: 119.91317414406991,
      loHz: 618.8208346023076,
      hiHz: 2403.4479052143874,
    };
    expect(clickIntervalMs(23.503914918032855, intervalCfg)).toBeLessThanOrEqual(
      clickIntervalMs(23.503914918032866, intervalCfg),
    );
  });

  it('adjacent doubles (1 to 3 ulps apart) keep the order for interval, pitch and gain', () => {
    const nextUp = (x: number): number => {
      const v = new DataView(new ArrayBuffer(8));
      v.setFloat64(0, x);
      v.setBigUint64(0, v.getBigUint64(0) + 1n);
      return v.getFloat64(0);
    };
    fc.assert(
      fc.property(
        arbConfig,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 1, max: 3 }),
        (cfg, frac, ulps) => {
          const d1 = cfg.lineRadiusPx + frac * (cfg.radiusPx - cfg.lineRadiusPx);
          let d2 = d1;
          for (let i = 0; i < ulps; i++) d2 = nextUp(d2);
          fc.pre(d2 <= cfg.radiusPx);
          expect(clickIntervalMs(d1, cfg)).toBeLessThanOrEqual(clickIntervalMs(d2, cfg));
          expect(clickHz(d1, cfg)).toBeGreaterThanOrEqual(clickHz(d2, cfg));
          expect(clickGain(d1, cfg)).toBeGreaterThanOrEqual(clickGain(d2, cfg));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('example: default config end points', () => {
    expect(clickIntervalMs(48, DEFAULT_PROXIMITY)).toBe(400);
    expect(clickIntervalMs(14, DEFAULT_PROXIMITY)).toBe(90);
    expect(clickIntervalMs(0, DEFAULT_PROXIMITY)).toBe(90);
    expect(clickHz(48, DEFAULT_PROXIMITY)).toBe(500);
    expect(clickHz(14, DEFAULT_PROXIMITY)).toBe(1200);
    expect(oracleGain(14)).toBe(PROXIMITY_GAIN_NEAR);
  });
});

describe('P99: values stay inside the configured bounds (Requirement 27.1, 27.2)', () => {
  it('hz, interval, gain and pan are always in range for valid configs', () => {
    fc.assert(
      fc.property(arbConfig, arbTimeline, (cfg, items) => {
        const inputs = attachTimes(items);
        let state = initialProximityState();
        let last = -Infinity;
        for (const input of inputs) {
          const out = proximityStep(state, input, cfg);
          for (const c of out.effects) {
            expect(c.hz).toBeGreaterThanOrEqual(cfg.loHz);
            expect(c.hz).toBeLessThanOrEqual(cfg.hiHz);
            expect(c.gain).toBeGreaterThanOrEqual(PROXIMITY_GAIN_FAR);
            expect(c.gain).toBeLessThanOrEqual(PROXIMITY_GAIN_NEAR);
            expect(c.pan).toBeGreaterThanOrEqual(-1);
            expect(c.pan).toBeLessThanOrEqual(1);
            const d = effectiveDistance(input, cfg);
            expect(d).not.toBeNull();
            const interval = clickIntervalMs(d as number, cfg);
            expect(interval).toBeGreaterThanOrEqual(cfg.nearMs);
            expect(interval).toBeLessThanOrEqual(cfg.farMs);
            // The gap since the previous click covers that interval.
            expect((input as { t: number }).t - last).toBeGreaterThanOrEqual(interval);
            last = (input as { t: number }).t;
          }
          state = out.state;
        }
      }),
      RUNS,
    );
  });
});

describe('P100: pan has the sign of dx (Requirement 27.2)', () => {
  it('sign, zero and size of the pan', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.double({ min: -200, max: 200, noNaN: true }), fc.constantFrom(0, -0, 1e-300, -1e-300, 48, -48, 47.9, 1e6, -1e6)),
        fc.double({ min: 0, max: 48, noNaN: true }),
        fc.boolean(),
        (dx, dist, quiet) => {
          // Off the line, or on a line inside the quiet window: both give a click.
          const input = quiet ? move(1000, dist, dx, true, true) : move(1000, dist, dx);
          const out = proximityStep(initialProximityState(), input);
          expect(out.effects).toHaveLength(1);
          const pan = only(out.effects).pan;
          if (dx === 0) expect(pan === 0).toBe(true);
          else if (Math.abs(dx) >= 1e-300) expect(Math.sign(pan)).toBe(Math.sign(dx));
          expect(Math.abs(pan)).toBeCloseTo(Math.min(1, Math.abs(dx) / DEFAULT_PROXIMITY.radiusPx), 12);
        },
      ),
      RUNS,
    );
  });
});

describe('P101: silence outside the cue zone (Requirement 27.3, 27.4, 27.5)', () => {
  const arbPrefix = fc.array(fc.tuple(arbTimeStep, arbRawInput), { maxLength: 15 });

  it('no effect beyond the radius, for null, for a lift, or on a line outside the quiet window', () => {
    fc.assert(
      fc.property(
        arbPrefix,
        fc.double({ min: 0, max: 100000, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (prefix, t, dx, extra) => {
          const prefixed = run(attachTimes(prefix));
          const state = prefixed.state;
          const far = DEFAULT_PROXIMITY.radiusPx + 1e-9 + extra;
          const silent: ProximityInput[] = [
            move(t, far, dx),
            move(t, null, dx),
            move(t, 3, dx, true, false),
            move(t, far, dx, true, false),
            { kind: 'lift', t },
          ];
          for (const input of silent) {
            const out = proximityStep(state, input);
            expect(out.effects).toEqual([]);
          }
        },
      ),
      RUNS,
    );
  });

  it('from a fresh state the first in-zone move clicks; on a line in the quiet window it is the closest setting', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 48, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.oneof(arbDist, arbAnyNumber),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (dist, dx, anyDist, t) => {
          const first = proximityStep(initialProximityState(), move(t, dist, dx));
          expect(first.effects).toHaveLength(1);
          const onLine = proximityStep(initialProximityState(), move(t, anyDist as number | null, dx, true, true));
          expect(onLine.effects).toHaveLength(1);
          const closest = only(onLine.effects);
          expect(closest.hz).toBe(DEFAULT_PROXIMITY.hiHz);
          expect(closest.gain).toBe(PROXIMITY_GAIN_NEAR);
        },
      ),
      RUNS,
    );
  });

  it('a lift emits nothing and the machine holds nothing that could sound later', () => {
    fc.assert(
      fc.property(arbTimeline, fc.double({ noNaN: true }), (items, t) => {
        const prefixed = run(attachTimes(items));
        const out = proximityStep(prefixed.state, { kind: 'lift', t });
        expect(out.effects).toEqual([]);
        expect(out.state).toBe(prefixed.state);
      }),
      RUNS,
    );
  });
});

describe('P102: click gap is never below nearMs (Requirement 27.6)', () => {
  it('consecutive clicks are at least nearMs, and at least the interval of the click that ended the gap', () => {
    fc.assert(
      fc.property(arbTimeline, (items) => {
        const result = run(attachTimes(items));
        let previous: number | null = null;
        for (const { input } of result.clicks) {
          const t = (input as { t: number }).t;
          if (previous !== null) {
            expect(t - previous).toBeGreaterThanOrEqual(DEFAULT_PROXIMITY.nearMs);
            const d = effectiveDistance(input, DEFAULT_PROXIMITY) as number;
            expect(t - previous).toBeGreaterThanOrEqual(oracleInterval(d, DEFAULT_PROXIMITY) - 1e-9);
          }
          previous = t;
        }
      }),
      RUNS,
    );
  });

  it('the previous click survives a lift', () => {
    const afterClick = proximityStep(initialProximityState(), move(1000, 5, 0)).state;
    const afterLift = proximityStep(afterClick, { kind: 'lift', t: 1001 }).state;
    expect(proximityStep(afterLift, move(1002, 5, 0)).effects).toEqual([]);
    expect(proximityStep(afterLift, move(1090, 5, 0)).effects).toHaveLength(1);
  });

  it('a timestamp before the previous click gives no click', () => {
    const afterClick = proximityStep(initialProximityState(), move(1000, 5, 0)).state;
    expect(proximityStep(afterClick, move(900, 5, 0)).effects).toEqual([]);
  });
});

describe('P103: bad input never throws and changes nothing (Requirement 27.5)', () => {
  it('non-finite t, dx (when due) or bad distPx give no effect and the same state object', () => {
    fc.assert(
      fc.property(arbTimeline, arbBadNumber, arbBadNumber, fc.double({ min: 0, max: 48, noNaN: true }), (items, bad, bad2, good) => {
        const state = run(attachTimes(items)).state;
        const cases: ProximityInput[] = [
          move(NaN, good, 1),
          move(Infinity, good, 1),
          move(-Infinity, good, 1),
          move(1e9, good, NaN),
          move(1e9, good, Infinity),
          move(1e9, good, -Infinity),
          move(1e9, NaN, 1),
          move(1e9, Infinity, 1),
          move(1e9, -1, 1),
          move(1e9, -0.0001, 1),
          move(1e9, 49, 1, false),
          // Bad values from the generator in every numeric slot.
          move(bad, good, 1),
          move(1e9, bad, bad2),
          move(1e9, good, bad2),
        ];
        for (const input of cases) {
          const out = proximityStep(state, input);
          const expected = effectiveDistance(input, DEFAULT_PROXIMITY);
          if (expected === null) {
            expect(out.effects).toEqual([]);
            expect(out.state).toBe(state);
          }
        }
      }),
      RUNS,
    );
  });

  it('objects with missing fields, wrong types or no kind never throw and change nothing', () => {
    const arbJunk = fc.oneof(
      fc.constant({}),
      fc.constant({ kind: 'move' }),
      fc.constant({ kind: 'move', t: 1 }),
      fc.constant({ kind: 'move', t: 1, onLine: true }),
      fc.constant({ kind: 'move', t: '5', distPx: '3', dxPx: '1', onLine: false, inQuietWindow: false }),
      fc.constant({ kind: 'move', t: 5, distPx: undefined, dxPx: 0 }),
      fc.constant({ kind: 'lift' }),
      fc.constant({ kind: 'explode', t: 3 }),
      fc.record({ kind: fc.constantFrom('move', 'lift', 'x'), t: fc.anything(), distPx: fc.anything(), dxPx: fc.anything() }),
    );
    fc.assert(
      fc.property(arbTimeline, arbJunk, (items, junk) => {
        const state = run(attachTimes(items)).state;
        const out = proximityStep(state, junk as unknown as ProximityInput);
        expect(Array.isArray(out.effects)).toBe(true);
        if (out.effects.length === 0) expect(out.state).toBe(state);
        for (const c of out.effects) {
          expect(Number.isFinite(c.hz) && Number.isFinite(c.pan) && Number.isFinite(c.gain)).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('never throws for any numbers in any slot, including huge values', () => {
    fc.assert(
      fc.property(arbAnyNumber, arbAnyNumber, arbAnyNumber, fc.boolean(), fc.boolean(), fc.boolean(), (t, d, dx, onLine, quiet, nullDist) => {
        expect(() =>
          proximityStep(initialProximityState(), move(t, nullDist ? null : d, dx, onLine, quiet)),
        ).not.toThrow();
      }),
      RUNS,
    );
  });
});
