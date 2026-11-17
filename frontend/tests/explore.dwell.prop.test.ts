/**
 * Task 56.2 / task 74 (design.md "Where P109 to P113 stand"): properties for the pure parts of
 * Requirements 28 and 30.
 *
 * P109 `cornerCompass` is complete and leaves out only the arrival edge (28.1, 28.3 to 28.5).
 * P112 where-am-I dwell timing: `updateWhereAmIDwellOnMove` + `checkWhereAmIDwell` (30.1, 30.4).
 * P113 (the part that is a pure function): the Directions switch of `checkWhereAmIDwell` (30.2).
 *
 * P110 and P111 (line-name dwell) are NOT here: the dwell is inline in `screens/Explore.tsx`
 * and no pure `lineDwell` is exported, so there is nothing to call. See design.md and tasks.md.
 * The switch guards of `cornerCompass` and the line name are tested on the real screen in
 * `explore.wiring.guards.test.tsx`.
 */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vertexExits } from '../src/core/compass';
import type { ScreenPoint } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  checkWhereAmIDwell,
  cornerCompass,
  initialWhereAmIDwellState,
  resetWhereAmIDwellOnLift,
  updateWhereAmIDwellOnMove,
  WHERE_AM_I_DWELL_MS,
  WHERE_AM_I_REARM_MOVE_PX,
  WHERE_AM_I_REST_MAX_MOVE_PX,
  WHERE_AM_I_SPEECH_QUIET_MS,
  type WhereAmIDwellCheckInput,
  type WhereAmIDwellState,
} from '../src/flow/explore';
import { getLang, setLang, type Lang } from '../src/i18n';
import { runs } from './support/runs';

let prevLang: Lang = 'en';
beforeEach(() => {
  prevLang = getLang();
  setLang('en');
});
afterEach(() => setLang(prevLang));

// ---------------------------------------------------------------------------
// P109 corner text is complete and omits only the arrival edge
// ---------------------------------------------------------------------------

interface CornerCase {
  scene: DiagramScene;
  vertex: string;
  arrival: string | null;
}

const cornerCase: fc.Arbitrary<CornerCase> = fc
  .uniqueArray(fc.tuple(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 9 })), {
    selector: (p) => `${p[0]},${p[1]}`,
    minLength: 2,
    maxLength: 8,
  })
  .chain((grid) => {
    const n = grid.length;
    const pairs: Array<[number, number]> = [];
    for (let a = 0; a < n; a += 1) for (let b = a + 1; b < n; b += 1) pairs.push([a, b]);
    return fc.record({
      labelled: fc.array(fc.boolean(), { minLength: n, maxLength: n }),
      chosen: fc.subarray(pairs),
      flip: fc.array(fc.boolean(), { minLength: pairs.length, maxLength: pairs.length }),
      vertexIndex: fc.integer({ min: 0, max: n - 1 }),
      arrivalPick: fc.integer({ min: -2, max: 12 }),
    }).map(({ labelled, chosen, flip, vertexIndex, arrivalPick }) => {
      const points = grid.map(([gx, gy], i) => ({
        id: `p${i}`,
        x: gx / 10,
        y: gy / 10,
        ...(labelled[i] ? { label: 'ABCDEFGH'.charAt(i) } : {}),
      }));
      const segments = chosen.map(([a, b], i) => ({
        id: `s${i}`,
        a: `p${flip[i] ? b : a}`,
        b: `p${flip[i] ? a : b}`,
      }));
      const scene = { version: 1, kind: 'geometry', points, segments, polylines: [], bars: [] } as DiagramScene;
      const vertex = `p${vertexIndex}`;
      const exits = vertexExits(scene, vertex);
      let arrival: string | null = null;
      if (arrivalPick >= 0 && exits.length > 0) arrival = exits[arrivalPick % exits.length]?.segmentId ?? null;
      else if (arrivalPick === -1) arrival = 'no-such-segment';
      return { scene, vertex, arrival };
    });
  });

function tokens(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function nameOf(exit: { toLabel?: string; toId: string }): string {
  return exit.toLabel ?? exit.toId;
}

function clauses(text: string): string[] {
  return text.split('.').map((c) => c.trim()).filter(Boolean);
}

describe('P109 corner text is complete and omits only the arrival edge (Requirements 28.1, 28.3-28.5)', () => {
  it('a recent visit gives an empty string, whatever the scene and arrival', () => {
    fc.assert(
      fc.property(cornerCase, (c) => cornerCompass(c.scene, c.vertex, c.arrival, true) === ''),
      { numRuns: runs(250) },
    );
  });

  it('an unknown vertex and a vertex with no exit give an empty string', () => {
    fc.assert(
      fc.property(cornerCase, (c) => {
        expect(cornerCompass(c.scene, 'no-such-vertex', null, false)).toBe('');
        if (vertexExits(c.scene, c.vertex).length === 0) {
          expect(cornerCompass(c.scene, c.vertex, c.arrival, false)).toBe('');
        }
      }),
      { numRuns: runs(250) },
    );
  });

  it('with at most 4 exits: one clause per exit except the arrival edge, naming each end', () => {
    fc.assert(
      fc.property(cornerCase, (c) => {
        const exits = vertexExits(c.scene, c.vertex);
        if (exits.length === 0 || exits.length > 4) return;
        const wanted = exits.filter((e) => e.segmentId !== c.arrival);
        const text = cornerCompass(c.scene, c.vertex, c.arrival, false);
        if (wanted.length === 0) {
          expect(text).toBe('');
          return;
        }
        const words = tokens(text);
        for (const e of wanted) expect(words, `exit to ${nameOf(e)}`).toContain(nameOf(e));
        for (const e of exits) {
          if (e.segmentId === c.arrival) expect(words, `arrival edge to ${nameOf(e)}`).not.toContain(nameOf(e));
        }
        expect(clauses(text)).toHaveLength(wanted.length);
      }),
      { numRuns: runs(300) },
    );
  });

  it('with more than 4 exits it gives the number of edges and no direction clause', () => {
    fc.assert(
      fc.property(cornerCase, (c) => {
        const exits = vertexExits(c.scene, c.vertex);
        if (exits.length <= 4) return;
        const text = cornerCompass(c.scene, c.vertex, c.arrival, false);
        expect(tokens(text)).toContain(String(exits.length));
        for (const e of exits) expect(tokens(text)).not.toContain(nameOf(e));
      }),
      { numRuns: runs(300) },
    );
  });

  it('example: a hub with six spokes says "6 edges", also when one is the arrival edge', () => {
    const points = [{ id: 'h', x: 0.5, y: 0.5, label: 'H' }];
    const segments = [];
    for (let i = 0; i < 6; i += 1) {
      points.push({ id: `q${i}`, x: 0.1 + i * 0.15, y: 0.1, label: `Q${i}` });
      segments.push({ id: `s${i}`, a: 'h', b: `q${i}` });
    }
    const scene = { version: 1, kind: 'geometry', points, segments, polylines: [], bars: [] } as DiagramScene;
    expect(cornerCompass(scene, 'h', null, false)).toBe('6 edges.');
    expect(cornerCompass(scene, 'h', 's2', false)).toBe('6 edges.');
  });

  it('no clause is longer than 12 words, in en, hi and gu, and emptiness does not depend on language', () => {
    fc.assert(
      fc.property(cornerCase, fc.constantFrom<Lang>('en', 'hi', 'gu'), (c, lang) => {
        setLang('en');
        const english = cornerCompass(c.scene, c.vertex, c.arrival, false);
        setLang(lang);
        const text = cornerCompass(c.scene, c.vertex, c.arrival, false);
        setLang('en');
        expect(text === '').toBe(english === '');
        for (const clause of clauses(text)) {
          expect(clause.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(12);
        }
      }),
      { numRuns: runs(300) },
    );
  });
});

// ---------------------------------------------------------------------------
// P112 where-am-I dwell timing, P113 the Directions switch
// ---------------------------------------------------------------------------

type Kind = WhereAmIDwellCheckInput['targetKind'];

interface Step {
  /** 'move' runs `updateWhereAmIDwellOnMove` then the check; 'tick' only the check; 'lift' resets. */
  op: 'move' | 'tick' | 'lift';
  dt: number;
  dx: number;
  dy: number;
  kind: Kind;
  ask: boolean;
  guide: boolean;
  directions: boolean | undefined;
  /** The caller starts speech of its own at this step (another cue). */
  otherSpeech: boolean;
}

const step: fc.Arbitrary<Step> = fc.record({
  op: fc.constantFrom<Step['op']>('move', 'move', 'tick', 'tick', 'tick', 'lift'),
  dt: fc.oneof({ weight: 6, arbitrary: fc.integer({ min: 0, max: 120 }) }, { weight: 2, arbitrary: fc.integer({ min: 0, max: 900 }) }),
  dx: fc.oneof({ weight: 5, arbitrary: fc.integer({ min: -2, max: 2 }) }, { weight: 2, arbitrary: fc.integer({ min: -45, max: 45 }) }),
  dy: fc.oneof({ weight: 5, arbitrary: fc.integer({ min: -2, max: 2 }) }, { weight: 2, arbitrary: fc.integer({ min: -45, max: 45 }) }),
  kind: fc.constantFrom<Kind>('none', 'none', 'none', 'none', 'none', 'none', 'line', 'vertex', 'bar'),
  ask: fc.oneof({ weight: 12, arbitrary: fc.constant(false) }, { weight: 1, arbitrary: fc.constant(true) }),
  guide: fc.oneof({ weight: 12, arbitrary: fc.constant(false) }, { weight: 1, arbitrary: fc.constant(true) }),
  directions: fc.oneof(
    { weight: 12, arbitrary: fc.constantFrom<boolean | undefined>(true, undefined) },
    { weight: 1, arbitrary: fc.constant<boolean | undefined>(false) },
  ),
  otherSpeech: fc.oneof({ weight: 10, arbitrary: fc.constant(false) }, { weight: 1, arbitrary: fc.constant(true) }),
});

interface Sample {
  t: number;
  p: ScreenPoint;
  kind: Kind;
}

interface Spoke {
  index: number;
  p: ScreenPoint;
  at: number;
}

/** Drive the two pure functions the way `Explore.tsx` does and check every speak against an oracle. */
function drive(steps: readonly Step[], start: ScreenPoint): number {
  let state: WhereAmIDwellState = initialWhereAmIDwellState();
  let now = 1000;
  let p = { ...start };
  let lastSpeech = Number.NEGATIVE_INFINITY;
  let samples: Sample[] = [];
  let spokes: Spoke[] = [];
  /** Moves since the last lift, with the index of the sample they produced. */
  let moveSamples: number[] = [];
  let speaks = 0;

  for (const s of steps) {
    now += s.dt;
    if (s.op === 'lift') {
      state = resetWhereAmIDwellOnLift();
      samples = [];
      spokes = [];
      moveSamples = [];
      continue;
    }
    p = { x: p.x + s.dx, y: p.y + s.dy };
    if (s.op === 'tick') p = { x: p.x - s.dx, y: p.y - s.dy };
    if (s.otherSpeech) lastSpeech = now;
    if (s.op === 'move') state = updateWhereAmIDwellOnMove(state, p, now);
    samples.push({ t: now, p, kind: s.kind });
    const index = samples.length - 1;
    if (s.op === 'move') moveSamples.push(index);

    const result = checkWhereAmIDwell(state, {
      targetKind: s.kind,
      coords: p,
      now,
      lastSpeechStartTime: lastSpeech,
      isAskActive: s.ask,
      isGuiding: s.guide,
      isDirectionsEnabled: s.directions,
    });
    state = result.nextState;
    if (!result.shouldSpeak) continue;

    // Guards (30.1, 30.2, 30.4).
    expect(s.kind, 'speaks only on a none target').toBe('none');
    expect(s.ask, 'not while Ask listens').toBe(false);
    expect(s.guide, 'not while Guide guides').toBe(false);
    expect(s.directions, 'not with Directions off').not.toBe(false);
    expect(now - lastSpeech, 'not inside the speech quiet window').toBeGreaterThanOrEqual(WHERE_AM_I_SPEECH_QUIET_MS);

    // Rest oracle: the earliest sample `i`, not before the last non-none sample, such that every
    // later sample lies within the rest radius of sample `i`. It must be at least 1200 ms old.
    let floor = 0;
    for (let j = samples.length - 1; j >= 0; j -= 1) {
      if (samples[j]?.kind !== 'none') {
        floor = j;
        break;
      }
    }
    let restStart = samples.length - 1;
    for (let i = floor; i < samples.length; i += 1) {
      const a = samples[i];
      if (a === undefined) continue;
      let ok = true;
      for (let j = i + 1; j < samples.length; j += 1) {
        const b = samples[j];
        if (b !== undefined && Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y) >= WHERE_AM_I_REST_MAX_MOVE_PX) {
          ok = false;
          break;
        }
      }
      if (ok) {
        restStart = i;
        break;
      }
    }
    expect(now - (samples[restStart]?.t ?? now), 'rested at least 1200 ms').toBeGreaterThanOrEqual(WHERE_AM_I_DWELL_MS);

    // Once per rest: since the previous speak (same touch) a move must have gone 20 px away.
    const previous = spokes[spokes.length - 1];
    if (previous !== undefined) {
      const rearmed = moveSamples.some((m) => {
        const q = samples[m];
        return m > previous.index && q !== undefined && Math.hypot(q.p.x - previous.p.x, q.p.y - previous.p.y) >= WHERE_AM_I_REARM_MOVE_PX;
      });
      expect(rearmed, 'a repeat needs a move of 20 px since the last sentence').toBe(true);
    }
    spokes.push({ index, p, at: now });
    speaks += 1;
    lastSpeech = now; // the caller starts speech when this returns true
  }
  return speaks;
}

describe('P112 where-am-I dwell timing (Requirements 30.1, 30.4)', () => {
  it('any trace: speaks only after a 1200 ms rest on a none target, once per rest, inside no guard', () => {
    fc.assert(
      fc.property(
        fc.array(step, { minLength: 1, maxLength: 140 }),
        fc.record({ x: fc.integer({ min: 0, max: 400 }), y: fc.integer({ min: 0, max: 400 }) }),
        (steps, start) => {
          drive(steps, start);
        },
      ),
      { numRuns: runs(400) },
    );
  });

  // Coverage does not depend on the random draw (task 62): this scripted trace reaches every
  // branch the oracle checks (a speak, a repeat after a 30 px move, a speak after a lift).
  it('a scripted trace speaks exactly three times and passes the oracle', () => {
    const base = { dt: 60, dx: 0, dy: 0, kind: 'none', ask: false, guide: false, directions: true, otherSpeech: false } as const;
    const ticks = (n: number): Step[] => Array.from({ length: n }, () => ({ ...base, op: 'tick' }));
    const steps: Step[] = [
      ...ticks(30), // rests 1.8 s: speaks once
      { ...base, op: 'move', dx: 30 }, // 30 px away: re-arms
      ...ticks(30), // speaks again
      { ...base, op: 'lift' },
      { ...base, op: 'move' }, // the new touch (Explore calls the move update on touch-down)
      ...ticks(30), // speaks again
    ];
    expect(drive(steps, { x: 100, y: 100 })).toBe(3);
  });

  // Pinned (task 75): seed 963477463, shrunk. A line step with Directions off must restart the rest,
  // so the three none steps after it with Directions on (242 ms) do not speak.
  it('pinned: a line step with Directions off restarts the rest (seed 963477463)', () => {
    const base = { ask: false, guide: false, otherSpeech: false } as const;
    const mv = (dt: number, kind: Kind, directions: boolean): Step => ({ ...base, op: 'move', dt, dx: 0, dy: 0, kind, directions });
    const steps: Step[] = [
      mv(0, 'none', true),
      mv(409, 'none', true),
      mv(549, 'line', false),
      mv(120, 'none', true),
      mv(119, 'none', true),
      mv(3, 'none', true),
    ];
    expect(drive(steps, { x: 0, y: 0 })).toBe(0);
    // With the rest left alone long enough afterwards it does speak (the fix does not mute it).
    expect(drive([...steps, mv(1300, 'none', true)], { x: 0, y: 0 })).toBe(1);
  });

  /** A finger at rest: 60 ms ticks from a fresh state with every guard open. */
  function rest(state: WhereAmIDwellState, p: ScreenPoint, from: number, ms: number, over: Partial<WhereAmIDwellCheckInput> = {}) {
    let s = state;
    const spoke: number[] = [];
    for (let t = from; t <= from + ms; t += 60) {
      const r = checkWhereAmIDwell(s, {
        targetKind: 'none',
        coords: p,
        now: t,
        lastSpeechStartTime: Number.NEGATIVE_INFINITY,
        isAskActive: false,
        isGuiding: false,
        ...over,
      });
      s = r.nextState;
      if (r.shouldSpeak) spoke.push(t);
    }
    return { state: s, spoke };
  }

  it('a rest of 1.1 s is silent and a rest of 1.3 s speaks once, then stays quiet', () => {
    const p = { x: 200, y: 200 };
    expect(rest(initialWhereAmIDwellState(), p, 0, 1100).spoke).toEqual([]);
    const long = rest(initialWhereAmIDwellState(), p, 0, 6000);
    expect(long.spoke).toHaveLength(1);
    expect(long.spoke[0]).toBeGreaterThanOrEqual(WHERE_AM_I_DWELL_MS);
    expect(long.spoke[0]).toBeLessThan(WHERE_AM_I_DWELL_MS + 60);
  });

  it('re-arms after a move of 20 px, not after 19 px, and after a lift', () => {
    const p = { x: 200, y: 200 };
    const first = rest(initialWhereAmIDwellState(), p, 0, 2000);
    expect(first.spoke).toHaveLength(1);

    const near = { x: p.x + 19, y: p.y };
    const afterNear = updateWhereAmIDwellOnMove(first.state, near, 2100);
    expect(rest(afterNear, near, 2100, 4000).spoke).toEqual([]);

    const far = { x: p.x + WHERE_AM_I_REARM_MOVE_PX, y: p.y };
    const afterFar = updateWhereAmIDwellOnMove(first.state, far, 2100);
    expect(rest(afterFar, far, 2100, 2000).spoke).toHaveLength(1);

    expect(rest(resetWhereAmIDwellOnLift(), p, 5000, 2000).spoke).toHaveLength(1);
  });

  it('a speech start less than 1500 ms ago blocks the sentence, exactly at the window it allows it', () => {
    const p = { x: 50, y: 50 };
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (ago) => {
        const now = 10000;
        const warmed = rest(initialWhereAmIDwellState(), p, now - 3000, 3000).state;
        const r = checkWhereAmIDwell(warmed, {
          targetKind: 'none',
          coords: p,
          now,
          lastSpeechStartTime: now - ago,
          isAskActive: false,
          isGuiding: false,
        });
        // The warm-up above may itself have spoken (that is fine); only the guard is checked.
        if (ago < WHERE_AM_I_SPEECH_QUIET_MS) expect(r.shouldSpeak).toBe(false);
      }),
      { numRuns: runs(250) },
    );
  });
});

describe('P113 the Directions switch of the where-am-I dwell (Requirement 30.2)', () => {
  const inputs = fc.record({
    kind: fc.constantFrom<Kind>('none', 'line', 'vertex', 'bar'),
    x: fc.integer({ min: -50, max: 450 }),
    y: fc.integer({ min: -50, max: 450 }),
    ask: fc.boolean(),
    guide: fc.boolean(),
    lastSpeech: fc.oneof(fc.constant(Number.NEGATIVE_INFINITY), fc.integer({ min: 0, max: 20000 })),
    now: fc.integer({ min: 0, max: 20000 }),
  });

  it('with Directions off it never asks for speech; none keeps the state object, other targets only restart the rest', () => {
    fc.assert(
      fc.property(inputs, fc.boolean(), (i, armedRest) => {
        const state: WhereAmIDwellState = armedRest
          ? { ...initialWhereAmIDwellState(), restAnchor: { x: i.x, y: i.y }, restStartTime: 0 }
          : initialWhereAmIDwellState();
        const r = checkWhereAmIDwell(state, {
          targetKind: i.kind,
          coords: { x: i.x, y: i.y },
          now: i.now,
          lastSpeechStartTime: i.lastSpeech,
          isAskActive: i.ask,
          isGuiding: i.guide,
          isDirectionsEnabled: false,
        });
        expect(r.shouldSpeak).toBe(false);
        if (i.kind === 'none') expect(r.nextState).toBe(state);
        else expect(r.nextState).toEqual({ ...state, restAnchor: { x: i.x, y: i.y }, restStartTime: i.now });
      }),
      { numRuns: runs(250) },
    );
  });

  it('with Directions on or unset and every guard clear, the same rest does speak', () => {
    fc.assert(
      fc.property(fc.constantFrom<boolean | undefined>(true, undefined), fc.integer({ min: 0, max: 400 }), (directions, x) => {
        let s = initialWhereAmIDwellState();
        let spoke = false;
        for (let t = 0; t <= 1500; t += 60) {
          const r = checkWhereAmIDwell(s, {
            targetKind: 'none',
            coords: { x, y: 120 },
            now: t,
            lastSpeechStartTime: Number.NEGATIVE_INFINITY,
            isAskActive: false,
            isGuiding: false,
            isDirectionsEnabled: directions,
          });
          s = r.nextState;
          spoke = spoke || r.shouldSpeak;
        }
        expect(spoke).toBe(true);
      }),
      { numRuns: runs(200) },
    );
  });
});
