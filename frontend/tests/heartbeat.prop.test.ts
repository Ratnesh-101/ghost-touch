/**
 * P120 to P127 - corner heartbeat (Requirement 34, task 59).
 *
 * Written by Kiro. Every property drives the REAL `step()` from `hapticEngine.ts` and feeds its
 * effects into `heartbeatStep`, the way the Explore shell will. Expected answers are built here
 * from the effect lists and the timestamps; nothing from `core/heartbeat.ts` is reused as an
 * oracle. All numbers are proposed and untested on a phone.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import triangleJson from '../public/samples/triangle.json';
import { makeViewport } from '../src/core/geometry';
import {
  DEFAULT_HAPTICS,
  initialState,
  step,
  type Effect,
  type EngineState,
} from '../src/core/hapticEngine';
import {
  DEFAULT_HEARTBEAT,
  heartbeatStep,
  initialHeartbeatState,
  type HeartbeatConfig,
  type HeartbeatState,
} from '../src/core/heartbeat';
import { DEFAULT_RADII, hitTest, type Target } from '../src/core/hitTest';
import type { DiagramScene } from '../src/core/scene';

const RUNS = 250;

// ---------------------------------------------------------------------------
// Harness: real engine + heartbeat, threaded through a trace
// ---------------------------------------------------------------------------

/** A trace step: the target after `dt` ms, or `null` for a lift. */
interface Hop {
  dt: number;
  target: Target | null;
}

interface Rec {
  t: number;
  target: Target | null; // null = lift
  engine: Effect[];
  out: Effect[];
  quietUntil: number; // the engine's, after this step
  hbAfter: HeartbeatState;
}

function drive(hops: Hop[], cfg: HeartbeatConfig | null | undefined, t0 = 0): Rec[] {
  let es: EngineState = initialState();
  let hs: HeartbeatState = initialHeartbeatState();
  let t = t0;
  const recs: Rec[] = [];
  for (const h of hops) {
    t += h.dt;
    const r =
      h.target === null
        ? step(es, { kind: 'lift', t }, DEFAULT_HAPTICS)
        : step(es, { kind: 'move', t, target: h.target, yNorm: 0.5 }, DEFAULT_HAPTICS);
    es = r.state;
    const hb =
      h.target === null
        ? heartbeatStep(hs, { kind: 'lift', t, engineEffects: r.effects }, cfg)
        : heartbeatStep(hs, { kind: 'move', t, target: h.target, engineEffects: r.effects }, cfg);
    hs = hb.state;
    recs.push({ t, target: h.target, engine: r.effects, out: hb.effects, quietUntil: es.quietUntil, hbAfter: hs });
  }
  return recs;
}

const isVib = (e: Effect): e is Extract<Effect, { kind: 'vibrate' }> => e.kind === 'vibrate';
const isArrayVib = (e: Effect): boolean => isVib(e) && Array.isArray(e.pattern);
const vib0: Effect = { kind: 'vibrate', pattern: 0 };
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const vertexIdOf = (t: Target | null): string | null => (t !== null && t.kind === 'vertex' ? t.id : null);

type Added = 'none' | 'beat' | 'stop' | 'bad';
/** What the heartbeat did to the engine's list. */
function classify(r: Rec): Added {
  const { out, engine } = r;
  if (out.length === engine.length) return JSON.stringify(out) === JSON.stringify(engine) ? 'none' : 'bad';
  if (out.length !== engine.length + 1) return 'bad';
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (JSON.stringify(out.slice(1)) === JSON.stringify(engine) && JSON.stringify(first) === JSON.stringify(vib0)) return 'stop';
  if (JSON.stringify(out.slice(0, -1)) === JSON.stringify(engine) && isArrayVib(last)) return 'beat';
  return 'bad';
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const vertexV: Target = { kind: 'vertex', id: 'V', label: 'V' };
const vertexW: Target = { kind: 'vertex', id: 'W', label: 'W' };
const targetArb: fc.Arbitrary<Target> = fc.oneof(
  { arbitrary: fc.constant(vertexV), weight: 6 },
  { arbitrary: fc.constant(vertexW), weight: 1 },
  { arbitrary: fc.constant<Target>({ kind: 'none' }), weight: 2 },
  { arbitrary: fc.constant<Target>({ kind: 'line', id: 'L', elementKind: 'segment' }), weight: 2 },
  { arbitrary: fc.constant<Target>({ kind: 'line', id: 'P', elementKind: 'polyline' }), weight: 1 },
  { arbitrary: fc.constant<Target>({ kind: 'bar', id: 'B', label: 'bar', value: 3, maxValue: 5 }), weight: 1 },
);
const hopArb = (maxDt: number): fc.Arbitrary<Hop> =>
  fc.oneof(
    { arbitrary: fc.record({ dt: fc.integer({ min: 0, max: maxDt }), target: targetArb }), weight: 12 },
    { arbitrary: fc.record({ dt: fc.integer({ min: 0, max: maxDt }), target: fc.constant(null) }), weight: 1 },
  );
const traceArb = (maxDt: number, maxLen = 120): fc.Arbitrary<Hop[]> =>
  fc.array(hopArb(maxDt), { minLength: 1, maxLength: maxLen });

/** Valid, random configs (and the default). */
const validCfgArb: fc.Arbitrary<HeartbeatConfig> = fc.oneof(
  fc.constant(DEFAULT_HEARTBEAT),
  fc
    .record({
      pattern: fc.array(fc.integer({ min: 10, max: 120 }), { minLength: 1, maxLength: 4 }),
      quietMs: fc.integer({ min: 0, max: 600 }),
      extra: fc.integer({ min: 0, max: 1500 }),
    })
    .map(({ pattern, quietMs, extra }) => ({ pattern, quietMs, periodMs: quietMs + sum(pattern) + extra })),
);

/** Resting trace: one entry on V, then `n` steps on V of at most `maxDt` ms. */
const restArb = (maxDt: number): fc.Arbitrary<Hop[]> =>
  fc.oneof(
    // Irregular steps.
    fc.array(fc.integer({ min: 1, max: maxDt }), { minLength: 1, maxLength: 220 }),
    // A steady rhythm like the keep-alive timer; steps often land exactly on a due time.
    fc
      .tuple(fc.constantFrom(5, 10, 15, 20, 30, 45, 60), fc.integer({ min: 1, max: 400 }))
      .map(([dt, n]) => Array.from({ length: n }, () => Math.min(dt, maxDt))),
  ).map((dts) => [
    { dt: 0, target: vertexV },
    ...dts.map((dt) => ({ dt, target: vertexV as Target | null })),
  ]);

// ---------------------------------------------------------------------------
// P120
// ---------------------------------------------------------------------------

const invalidCfgs: Array<HeartbeatConfig | null | undefined> = [
  null,
  undefined,
  {} as HeartbeatConfig,
  { pattern: [], periodMs: 900, quietMs: 450 },
  { pattern: [0], periodMs: 900, quietMs: 450 },
  { pattern: [50, -90, 50], periodMs: 900, quietMs: 450 },
  { pattern: [50, NaN, 50], periodMs: 900, quietMs: 450 },
  { pattern: [50, Infinity, 50], periodMs: 900, quietMs: 450 },
  { pattern: [50, 90, 50], periodMs: NaN, quietMs: 450 },
  { pattern: [50, 90, 50], periodMs: Infinity, quietMs: 450 },
  { pattern: [50, 90, 50], periodMs: 900, quietMs: NaN },
  { pattern: [50, 90, 50], periodMs: 900, quietMs: -1 },
  { pattern: [50, 90, 50], periodMs: 639, quietMs: 450 }, // 450 + 190 - 1
  { pattern: 'x' as unknown as number[], periodMs: 900, quietMs: 450 },
  { pattern: [50, 90, 50], periodMs: '900' as unknown as number, quietMs: 450 },
];

describe('P120 - off is identity', () => {
  it('null, undefined or invalid cfg returns the engine effects and an initial state', () => {
    fc.assert(
      fc.property(fc.constantFrom(...invalidCfgs), traceArb(300), (cfg, hops) => {
        for (const r of drive(hops, cfg)) {
          expect(r.out).toEqual(r.engine);
          expect(r.hbAfter).toEqual(initialHeartbeatState());
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('a config that is one millisecond short is off, and exactly one valid millisecond later is on', () => {
    const hops: Hop[] = [{ dt: 0, target: vertexV }, ...Array.from({ length: 30 }, () => ({ dt: 60, target: vertexV as Target | null }))];
    const beats = (cfg: HeartbeatConfig): number => drive(hops, cfg).filter((r) => classify(r) === 'beat').length;
    expect(beats({ pattern: [50, 90, 50], periodMs: 639, quietMs: 450 })).toBe(0);
    expect(beats({ pattern: [50, 90, 50], periodMs: 640, quietMs: 450 })).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// P121
// ---------------------------------------------------------------------------

describe('P121 - beats only on a resting vertex', () => {
  it('an added array vibrate needs a vertex target, the same id as the step before, and no engine vibrate', () => {
    fc.assert(
      fc.property(validCfgArb, traceArb(400), (cfg, hops) => {
        const recs = drive(hops, cfg);
        recs.forEach((r, i) => {
          if (classify(r) !== 'beat') return;
          const prev = i > 0 ? recs[i - 1]! : undefined;
          expect(vertexIdOf(r.target)).not.toBeNull();
          expect(prev).toBeDefined();
          expect(vertexIdOf(prev!.target)).toBe(vertexIdOf(r.target));
          expect(r.engine.some(isVib)).toBe(false);
        });
      }),
      { numRuns: RUNS },
    );
  });

  it('a step onto a different vertex never beats, even right after a beat', () => {
    const cfg = DEFAULT_HEARTBEAT;
    const hops: Hop[] = [
      { dt: 0, target: vertexV },
      { dt: 900, target: vertexV }, // beat
      { dt: 10, target: vertexW }, // other vertex: engine corner pattern, no beat
      { dt: 900, target: vertexW }, // beat for W, one period after W's entry
    ];
    const recs = drive(hops, cfg);
    expect(classify(recs[1]!)).toBe('beat');
    expect(classify(recs[2]!)).toBe('none');
    expect(recs[2]!.out.filter(isArrayVib)).toHaveLength(1); // the engine's corner pattern only
    expect(classify(recs[3]!)).toBe('beat');
  });
});

// ---------------------------------------------------------------------------
// P122
// ---------------------------------------------------------------------------

describe('P122 - rate and quiet window', () => {
  it('first beat is one period after the entry; no beat before the engine quietUntil; engine output is untouched', () => {
    fc.assert(
      fc.property(validCfgArb.filter((c) => c.quietMs >= DEFAULT_HAPTICS.quietMs), traceArb(300), (cfg, hops) => {
        const recs = drive(hops, cfg);
        const off = drive(hops, null);
        let mark: number | null = null; // entry (or silent re-entry) time of the current visit
        let beats = 0;
        recs.forEach((r, i) => {
          // The engine's own output never depends on the heartbeat.
          expect(r.engine).toEqual(off[i]!.engine);
          expect(off[i]!.out).toEqual(off[i]!.engine);
          const vid = vertexIdOf(r.target);
          const prevVid = i > 0 ? vertexIdOf(recs[i - 1]!.target) : null;
          if (vid === null) {
            mark = null;
            return;
          }
          if (r.engine.some(isVib) || vid !== prevVid) {
            mark = r.t;
            beats = 0;
          }
          if (classify(r) === 'beat') {
            beats += 1;
            expect(mark).not.toBeNull();
            // Beat k is due at mark + k periods; a late step never makes it earlier. Catch-up
            // after a long pause only moves later beats further out, so this bound holds.
            expect(r.t).toBeGreaterThanOrEqual(mark! + cfg.periodMs);
            // Never inside the engine's quiet window.
            expect(r.t).toBeGreaterThanOrEqual(r.quietUntil);
          }
        });
        expect(beats).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: RUNS },
    );
  });

  it('with steps at most 60 ms apart, two beats of one visit are at least period - 60 ms apart', () => {
    fc.assert(
      fc.property(validCfgArb, restArb(60), (cfg, hops) => {
        const beatTs = drive(hops, cfg).filter((r) => classify(r) === 'beat').map((r) => r.t);
        for (let i = 1; i < beatTs.length; i++) {
          expect(beatTs[i]! - beatTs[i - 1]!).toBeGreaterThanOrEqual(cfg.periodMs - 60);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('after a long pause the next beat is one period after the late step, not a burst', () => {
    const hops: Hop[] = [
      { dt: 0, target: vertexV },
      { dt: 5000, target: vertexV }, // very late: one beat
      { dt: 60, target: vertexV }, // not due again
      { dt: 60, target: vertexV },
    ];
    const recs = drive(hops, DEFAULT_HEARTBEAT);
    expect(recs.map(classify)).toEqual(['none', 'beat', 'none', 'none']);
  });
});

// ---------------------------------------------------------------------------
// P123
// ---------------------------------------------------------------------------

describe('P123 - liveness', () => {
  it('after jitter off and back onto the vertex (Requirement 4.9) the schedule restarts and beats resume', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom(10, 20, 30, 60),
        (away, back, dt) => {
          const hops: Hop[] = [
            { dt: 0, target: vertexV },
            { dt: away, target: { kind: 'none' } },
            { dt: back, target: vertexV }, // inside the 450 ms window: the engine says nothing
            ...Array.from({ length: Math.ceil(1200 / dt) }, () => ({ dt, target: vertexV as Target | null })),
          ];
          const recs = drive(hops, DEFAULT_HEARTBEAT);
          expect(recs[2]!.engine.some(isVib)).toBe(false);
          expect(classify(recs[2]!)).toBe('none');
          const reentryT = recs[2]!.t;
          const first = recs.slice(3).find((r) => classify(r) === 'beat');
          expect(first).toBeDefined();
          expect(first!.t - reentryT).toBeGreaterThanOrEqual(DEFAULT_HEARTBEAT.periodMs);
          expect(first!.t - reentryT).toBeLessThanOrEqual(DEFAULT_HEARTBEAT.periodMs + dt);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('a resting finger with steps at most 60 ms apart never waits longer than period + 60 ms for a beat', () => {
    fc.assert(
      fc.property(validCfgArb, restArb(60), (cfg, hops) => {
        const recs = drive(hops, cfg);
        let lastMark = recs[0]!.t;
        for (const r of recs.slice(1)) {
          if (classify(r) === 'beat') {
            expect(r.t - lastMark).toBeLessThanOrEqual(cfg.periodMs + 60);
            lastMark = r.t;
          }
        }
        expect(recs[recs.length - 1]!.t - lastMark).toBeLessThanOrEqual(cfg.periodMs + 60);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// P124
// ---------------------------------------------------------------------------

describe('P124 - stops at once', () => {
  it('leaving after a beat: the engine vibrate, or vibrate(0) first, while the beat can still play; nothing after', () => {
    fc.assert(
      fc.property(validCfgArb, traceArb(300, 160), (cfg, hops) => {
        const recs = drive(hops, cfg);
        const len = sum(cfg.pattern);
        let beatT: number | null = null;
        recs.forEach((r, i) => {
          const vid = vertexIdOf(r.target);
          if (r.target === null) {
            // A lift returns exactly the engine's effects and forgets everything.
            expect(r.out).toEqual(r.engine);
            expect(r.hbAfter).toEqual(initialHeartbeatState());
            beatT = null;
            return;
          }
          if (vid !== null) {
            const prevVid = i > 0 ? vertexIdOf(recs[i - 1]!.target) : null;
            if (r.engine.some(isVib) || vid !== prevVid) beatT = null; // a new entry
            if (classify(r) === 'beat') beatT = r.t;
            return;
          }
          // Not a vertex.
          if (beatT !== null && r.t < beatT + len && !r.engine.some(isVib)) {
            expect(r.out[0]).toEqual(vib0);
            expect(r.out.slice(1)).toEqual(r.engine);
          } else {
            expect(r.out).toEqual(r.engine); // engine vibrate replaces the beat, or nothing playing
          }
          beatT = null;
          expect(r.hbAfter).toEqual(initialHeartbeatState());
        });
      }),
      { numRuns: RUNS },
    );
  });

  it('example: stepping into empty space 50 ms after a beat starts with vibrate(0); 190 ms after it does not', () => {
    const base: Hop[] = [
      { dt: 0, target: vertexV },
      { dt: 900, target: vertexV }, // beat at 900
    ];
    const soon = drive([...base, { dt: 50, target: { kind: 'none' } }], DEFAULT_HEARTBEAT);
    expect(classify(soon[2]!)).toBe('stop');
    const late = drive([...base, { dt: 190, target: { kind: 'none' } }], DEFAULT_HEARTBEAT);
    expect(classify(late[2]!)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// P125
// ---------------------------------------------------------------------------

describe('P125 - never over the line buzz', () => {
  it('on a line step no array pattern is added and the engine line buzz is the last vibrate', () => {
    fc.assert(
      fc.property(validCfgArb, traceArb(300), (cfg, hops) => {
        for (const r of drive(hops, cfg)) {
          if (r.target === null || r.target.kind !== 'line') continue;
          expect(r.out.filter(isArrayVib)).toHaveLength(r.engine.filter(isArrayVib).length);
          const engineVibs = r.engine.filter(isVib);
          if (engineVibs.length > 0) {
            expect(r.out.filter(isVib).at(-1)).toEqual(engineVibs.at(-1));
            expect(r.out).toEqual(r.engine);
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('leaving along a line right after a beat gives exactly the engine buzz', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 189 }), (after) => {
        const recs = drive(
          [
            { dt: 0, target: vertexV },
            { dt: 900, target: vertexV }, // beat
            { dt: after, target: { kind: 'line', id: 'L', elementKind: 'segment' } },
          ],
          DEFAULT_HEARTBEAT,
        );
        expect(classify(recs[1]!)).toBe('beat');
        expect(recs[2]!.engine).toContainEqual({ kind: 'vibrate', pattern: DEFAULT_HAPTICS.lineMs });
        expect(recs[2]!.out).toEqual(recs[2]!.engine);
        expect(recs[2]!.out.filter(isArrayVib)).toHaveLength(0);
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// P126
// ---------------------------------------------------------------------------

describe('P126 - additive only', () => {
  it('every step is the engine list, plus at most one vibrate at the front (0) or end (the configured pattern, as a copy)', () => {
    fc.assert(
      fc.property(validCfgArb, traceArb(400), (cfg, hops) => {
        for (const r of drive(hops, cfg)) {
          const kind = classify(r);
          expect(kind).not.toBe('bad');
          if (kind === 'beat') {
            const added = r.out[r.out.length - 1]!;
            expect(added).toEqual({ kind: 'vibrate', pattern: cfg.pattern });
            expect((added as { pattern: unknown }).pattern).not.toBe(cfg.pattern);
          }
          const engineKinds = r.engine.map((e) => e.kind).sort();
          const outKinds = r.out.map((e) => e.kind).sort();
          // Nothing but a vibrate was added: speak, speakKey and tone counts are the engine's.
          for (const k of ['speak', 'speakKey', 'tone'] as const) {
            expect(outKinds.filter((x) => x === k)).toHaveLength(engineKinds.filter((x) => x === k).length);
          }
        }
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// P127
// ---------------------------------------------------------------------------

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

const junkTimeArb = fc.oneof(
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -1, -1e9, 1e15),
  fc.double({ noNaN: false }),
  fc.integer({ min: -2000, max: 20000 }),
);
const junkTargetArb: fc.Arbitrary<unknown> = fc.oneof(
  targetArb,
  fc.constantFrom<unknown>(
    null,
    undefined,
    'x',
    5,
    {},
    { kind: 'vertex' },
    { kind: 'vertex', id: 5 },
    { kind: 'vertex', id: null },
    { kind: 'weird', id: 'V' },
  ),
);
const junkEffectsArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.array(fc.constantFrom<Effect>({ kind: 'vibrate', pattern: 80 }, { kind: 'tone', hz: null }, { kind: 'speak', text: 'V' }), { maxLength: 4 }),
  fc.constantFrom<unknown>(undefined, null, 'x', 5, {}, [null], [undefined, { kind: 'vibrate' }, 5], [{}]),
);
const junkStateArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constant(initialHeartbeatState()),
  fc.record({ vertexId: fc.constantFrom('V', 'W', null), nextBeatAt: junkTimeArb, lastBeatAt: junkTimeArb }),
  fc.constantFrom<unknown>(null, undefined, {}, { vertexId: 5, nextBeatAt: 'x', lastBeatAt: null }, 'x'),
);
const junkCfgArb: fc.Arbitrary<unknown> = fc.oneof(
  validCfgArb,
  fc.constantFrom<unknown>(...invalidCfgs, 'x', 5, [], { pattern: null }),
);

describe('P127 - total', () => {
  it('never throws, never mutates deep-frozen inputs, adds no beat for a time that is not a finite number', () => {
    fc.assert(
      fc.property(
        junkStateArb,
        fc.constantFrom('move', 'move', 'move', 'lift', 'weird'),
        junkTimeArb,
        junkTargetArb,
        junkEffectsArb,
        junkCfgArb,
        (state, kind, t, target, effects, cfg) => {
          const frozenInput = deepFreeze({ kind, t, target, engineEffects: effects }) as unknown as Parameters<
            typeof heartbeatStep
          >[1];
          const frozenState = deepFreeze(state) as HeartbeatState;
          const frozenCfg = deepFreeze(cfg) as HeartbeatConfig;
          const r = heartbeatStep(frozenState, frozenInput, frozenCfg);
          expect(Array.isArray(r.effects)).toBe(true);
          const engineList = Array.isArray(effects) ? (effects as unknown[]) : [];
          if (kind === 'move' && !Number.isFinite(t)) {
            // No beat, no stop, no bookkeeping for a time that is not a number.
            expect(r.effects).toEqual(engineList);
          } else {
            expect(r.effects.length).toBeLessThanOrEqual(engineList.length + 1);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('backward and repeated timestamps through the real engine never throw and never add more than one effect', () => {
    fc.assert(
      fc.property(validCfgArb, fc.array(fc.tuple(fc.integer({ min: -500, max: 500 }), targetArb), { minLength: 1, maxLength: 80 }), (cfg, steps) => {
        const hops: Hop[] = steps.map(([dt, target]) => ({ dt, target }));
        for (const r of drive(hops, cfg, 10_000)) {
          expect(r.out.length).toBeLessThanOrEqual(r.engine.length + 1);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Example: the triangle sample
// ---------------------------------------------------------------------------

describe('example - triangle.json, resting on B', () => {
  const triangle = triangleJson as unknown as DiagramScene;
  const view = makeViewport(400, 400);
  const at = (x: number, y: number): Target => hitTest(triangle, { x, y }, view, DEFAULT_RADII);
  // B is at (0.7, 0.85) -> (280, 340) px; side BC runs along y = 340 from x = 100 to x = 280.
  const onB = at(280, 340);
  const onBC = at(200, 340);

  it('hit test sees B and side BC', () => {
    expect(onB).toMatchObject({ kind: 'vertex', id: 'B' });
    expect(onBC).toMatchObject({ kind: 'line', id: 'BC' });
  });

  it('corner pattern at 0, beats at 900, 1800 and 2700 for 3 s of 60 ms steps; the label once; BC at 2750 buzzes and has no beat', () => {
    const hops: Hop[] = [{ dt: 0, target: onB }];
    for (let t = 60; t <= 2700; t += 60) hops.push({ dt: 60, target: onB });
    hops.push({ dt: 50, target: onBC }); // t = 2750
    const recs = drive(hops, DEFAULT_HEARTBEAT);

    expect(recs[0]!.out.filter(isArrayVib)).toHaveLength(1);
    expect(recs[0]!.out).toContainEqual({ kind: 'vibrate', pattern: [50, 90, 50] });

    const beatTimes = recs.filter((r) => classify(r) === 'beat').map((r) => r.t);
    expect(beatTimes).toEqual([900, 1800, 2700]);

    const speaks = recs.flatMap((r) => r.out).filter((e) => e.kind === 'speak' || e.kind === 'speakKey');
    expect(speaks).toEqual([{ kind: 'speak', text: 'B' }]);
    expect(recs.flatMap((r) => r.out).filter((e) => e.kind === 'tone' && e.hz !== null)).toHaveLength(0);

    const last = recs[recs.length - 1]!;
    expect(last.t).toBe(2750);
    expect(last.out).toContainEqual({ kind: 'vibrate', pattern: 80 });
    expect(last.out.filter(isArrayVib)).toHaveLength(0);
    expect(last.out).toEqual(last.engine); // the line buzz replaces the beat that began at 2700
  });
});
