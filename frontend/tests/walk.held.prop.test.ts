/**
 * Properties P183 to P186 for Requirement 51.13 (task 89): a held touch is the screen re-reporting
 * a finger that has not moved. It counts like a moved touch (rest dwell, tries, step sentences) but
 * it is not student activity, so it never moves the idle end.
 *
 * Oracles are independent of the reducer: the "moved" run of the same trace is the model for the
 * "held" run, and the idle clock is checked from the times alone.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Target } from '../src/core/hitTest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  WALK_IDLE_MS,
  WALK_TRY_DWELL_MS,
  anchorReached,
  startWalk,
  templateWalk,
  walkStep,
  type Walk,
  type WalkAnchor,
  type WalkEffect,
  type WalkInput,
  type WalkState,
} from '../src/core/walk';
import triangleJson from '../public/samples/triangle.json';
import { barScene, deepFreeze } from './support/walkScenes';
import { runs } from './support/runs';

const triangle = triangleJson as unknown as DiagramScene;
const VIEW = makeViewport(400, 400);
const FINGER = { x: 200, y: 200 };

function anchorTarget(a: WalkAnchor): Target {
  if (a.kind === 'vertex') return { kind: 'vertex', id: a.id };
  if (a.kind === 'segment') return { kind: 'line', id: a.id, elementKind: 'segment' };
  if (a.kind === 'bar') return { kind: 'bar', id: a.id, label: 'x', value: 1, maxValue: 1 };
  throw new Error('spots are not used here');
}

function targetsFor(scene: DiagramScene): Target[] {
  return [
    ...(scene.points ?? []).map((p): Target => ({ kind: 'vertex', id: p.id })),
    ...(scene.segments ?? []).map((s): Target => ({ kind: 'line', id: s.id, elementKind: 'segment' })),
    ...(scene.bars ?? []).map((b): Target => ({ kind: 'bar', id: b.id, label: b.label, value: b.value, maxValue: 1 })),
  ];
}

const touch = (t: number, target: Target, held?: unknown): WalkInput =>
  ({ kind: 'touch', t, target, finger: FINGER, view: VIEW, ...(held === undefined ? {} : { held }) }) as WalkInput;

const NONE: Target = { kind: 'none' };

const barsArb: fc.Arbitrary<DiagramScene> = fc
  .uniqueArray(fc.integer({ min: 0, max: 400 }), { minLength: 3, maxLength: 5 })
  .map((qs) => barScene(qs.map((q, i) => ({ label: `Q${i + 1}`, value: q / 4 }))));

const sceneArb: fc.Arbitrary<DiagramScene> = fc.oneof(fc.constant(triangle), barsArb);

function walkOf(scene: DiagramScene): Walk {
  const w = templateWalk(scene);
  if (w === null) throw new Error('scene has no walk');
  return w;
}

/** A walk driven (with moved touches and "next step") to the Your-turn prompt. */
function atTurn(scene: DiagramScene): { w: Walk; state: WalkState; t: number } {
  const w = walkOf(scene);
  let { state } = startWalk(scene, w, 0);
  let t = 0;
  for (const step of w.steps) {
    t += 10;
    state = walkStep(state, touch(t, anchorTarget(step.anchor))).state;
    t += 10;
    state = walkStep(state, { kind: 'next', t }).state;
  }
  expect(state.phase).toBe('turn');
  return { w, state, t };
}

function wrongsOf(scene: DiagramScene, w: Walk): Target[] {
  return targetsFor(scene).filter((tg) => !anchorReached(w.turn!.anchor, tg, FINGER, VIEW));
}

type Turn = Extract<WalkState, { phase: 'turn' }>;
const asTurn = (s: WalkState): Turn => {
  if (s.phase !== 'turn') throw new Error(`expected turn, got ${s.phase}`);
  return s;
};
const lastActivityOf = (s: WalkState): number => (s as { lastActivity: number }).lastActivity;
/** The state without its idle clock: the one thing a held touch is allowed to leave different. */
function core(s: WalkState): Record<string, unknown> {
  const { lastActivity: _drop, walk: _walk, ...rest } = s as Record<string, unknown>;
  void _drop;
  void _walk;
  return rest;
}
const kinds = (effs: WalkEffect[]): string[] => effs.map((e) => e.kind);

// ---------------------------------------------------------------------------------------------
// P183
// ---------------------------------------------------------------------------------------------

describe('P183: a held finger counts tries like a moved one', () => {
  it('example: 500 ms still on one wrong side is one try, 500 ms on a second wrong element is the second, the answer once', () => {
    const w = walkOf(triangle);
    const wrongs = wrongsOf(triangle, w);
    expect(wrongs.length).toBeGreaterThanOrEqual(3);
    const { state: s0, t: t0 } = atTurn(triangle);
    let state = s0;
    let t = t0;
    const all: WalkEffect[] = [];
    const rest = (tg: Target, ms: number): void => {
      for (let el = 0; el <= ms; el += 60) {
        const r = walkStep(state, touch(t + el, tg, true));
        state = r.state;
        all.push(...r.effects);
      }
      t += ms;
    };
    t += 20;
    rest(wrongs[0]!, WALK_TRY_DWELL_MS - 60);
    expect(asTurn(state).misses).toBe(0); // not long enough yet
    rest(wrongs[0]!, 100);
    expect(asTurn(state).misses).toBe(1);
    expect(all).toEqual([]); // the first try is silent
    t += 20;
    rest(wrongs[1]!, WALK_TRY_DWELL_MS + 60);
    expect(asTurn(state).misses).toBe(2);
    expect(kinds(all)).toEqual(['speak', 'guideTo']);
    expect(all[0]).toMatchObject({ kind: 'speak', line: { key: 'walk.turn.answer' } });
    // later tries, on the same and on other elements, are silent
    rest(wrongs[1]!, 3000);
    t += 20;
    rest(wrongs[2]!, 2000);
    expect(kinds(all)).toEqual(['speak', 'guideTo']);
  });

  it('every trace gives the same effects and the same try bookkeeping held as moved', () => {
    const stepArb = fc.record({ pick: fc.nat(), dt: fc.integer({ min: 0, max: 700 }), anchor: fc.nat({ max: 12 }) });
    fc.assert(
      fc.property(sceneArb, fc.array(stepArb, { minLength: 1, maxLength: 40 }), (scene, steps) => {
        const { w, state: s0, t: t0 } = atTurn(scene);
        const pool = [...wrongsOf(scene, w), NONE, NONE];
        let moved = s0;
        let held = s0;
        let t = t0;
        for (const s of steps) {
          t += s.dt;
          // the right anchor is rare, so most traces stay in Your turn for a while
          const tg = s.anchor === 0 ? anchorTarget(w.turn!.anchor) : pool[s.pick % pool.length]!;
          const rm = walkStep(moved, touch(t, tg));
          const rh = walkStep(held, touch(t, tg, true));
          expect(rh.effects).toEqual(rm.effects);
          expect(core(rh.state)).toEqual(core(rm.state));
          expect(rh.state.phase).toBe(rm.state.phase);
          moved = rm.state;
          held = rh.state;
        }
      }),
      { numRuns: runs(300) },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// P184
// ---------------------------------------------------------------------------------------------

describe('P184: a held finger never resets the idle end', () => {
  it('a held touch leaves lastActivity as it was, in every phase', () => {
    fc.assert(
      fc.property(sceneArb, fc.integer({ min: 1, max: 60_000 }), (scene, gap) => {
        const w = walkOf(scene);
        const { state: find } = startWalk(scene, w, 1000);
        const said = walkStep(find, touch(1010, anchorTarget(w.steps[0]!.anchor))).state;
        const turn = atTurn(scene).state;
        const t = Math.max(lastActivityOf(turn), 1010) + gap;
        for (const s of [find, said, turn]) {
          const before = lastActivityOf(s);
          const tt = Math.max(before, 0) + Math.min(gap, WALK_IDLE_MS - 1);
          const r = walkStep(s, touch(tt, NONE, true));
          expect(lastActivityOf(r.state)).toBe(before);
          const wrong = walkStep(s, touch(tt, { kind: 'vertex', id: 'zz' }, true));
          expect(lastActivityOf(wrong.state)).toBe(before);
        }
        void t;
      }),
      { numRuns: runs(300) },
    );
  });

  it('held touches up to the end do not extend it; the walk ends at lastActivity + 120 000, with no effect', () => {
    fc.assert(
      fc.property(
        sceneArb,
        fc.array(fc.integer({ min: 10, max: 5000 }), { minLength: 1, maxLength: 60 }),
        fc.boolean(),
        (scene, gaps, onWrong) => {
          const { w, state: s0, t: t0 } = atTurn(scene);
          const pool = wrongsOf(scene, w);
          const tg = onWrong ? pool[0]! : NONE;
          const end = lastActivityOf(s0) + WALK_IDLE_MS;
          let state = s0;
          let t = t0;
          for (const g of gaps) {
            t = Math.min(t + g, end - 1);
            const r = walkStep(state, touch(t, tg, true));
            expect(r.state.phase).not.toBe('idle');
            expect(lastActivityOf(r.state)).toBe(lastActivityOf(s0));
            state = r.state;
          }
          const atEnd = walkStep(state, touch(end, tg, true));
          expect(atEnd.state.phase).toBe('idle');
          expect(atEnd.effects).toEqual([]);
          const after = walkStep(atEnd.state, touch(end + 5, tg, true));
          expect(after.effects).toEqual([]);
          expect(after.state.phase).toBe('idle');
        },
      ),
      { numRuns: runs(300) },
    );
  });

  it('a moved touch just before the end does extend it (the control)', () => {
    fc.assert(
      fc.property(sceneArb, fc.integer({ min: 1, max: 5000 }), (scene, back) => {
        const { w, state: s0 } = atTurn(scene);
        const wrong = wrongsOf(scene, w)[0]!;
        const end = lastActivityOf(s0) + WALK_IDLE_MS;
        const moved = walkStep(s0, touch(end - back, wrong)).state;
        expect(lastActivityOf(moved)).toBe(end - back);
        const held = walkStep(moved, touch(end, wrong, true));
        expect(held.state.phase).toBe('turn'); // the moved touch moved the end by `back`
        const late = walkStep(moved, touch(end - back + WALK_IDLE_MS, wrong, true));
        expect(late.state.phase).toBe('idle');
      }),
      { numRuns: runs(300) },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// P185
// ---------------------------------------------------------------------------------------------

describe('P185: a held finger on the right anchor behaves like a moved one', () => {
  it('a step sentence is spoken once, by the first input that reaches the anchor, then never by held touches', () => {
    fc.assert(
      fc.property(
        sceneArb,
        fc.boolean(),
        fc.array(fc.integer({ min: 0, max: 400 }), { minLength: 1, maxLength: 30 }),
        (scene, firstHeld, gaps) => {
          const w = walkOf(scene);
          const start = startWalk(scene, w, 0).state;
          const step = w.steps[0]!;
          const target = anchorTarget(step.anchor);
          const first = walkStep(start, touch(10, target, firstHeld ? true : undefined));
          const movedFirst = walkStep(start, touch(10, target));
          expect(first.effects).toEqual(movedFirst.effects);
          expect(first.effects.length).toBeGreaterThanOrEqual(1);
          expect(first.effects[0]).toMatchObject({ kind: 'speak', line: step.say });
          let state = first.state;
          let t = 10;
          for (const g of gaps) {
            t += g;
            const r = walkStep(state, touch(t, target, true));
            expect(r.effects).toEqual([]);
            expect(r.state.phase).toBe(first.state.phase);
            state = r.state;
          }
        },
      ),
      { numRuns: runs(300) },
    );
  });

  it('in Your turn a held touch on the anchor ends it once, after any number of wrong tries, then nothing follows', () => {
    fc.assert(
      fc.property(sceneArb, fc.integer({ min: 0, max: 5 }), fc.integer({ min: 1, max: 20 }), (scene, nWrong, extra) => {
        const { w, state: s0, t: t0 } = atTurn(scene);
        const pool = wrongsOf(scene, w);
        let state = s0;
        let t = t0;
        for (let i = 0; i < nWrong; i++) {
          const tg = pool[i % pool.length]!;
          t += 20;
          state = walkStep(state, touch(t, tg, true)).state;
          t += WALK_TRY_DWELL_MS;
          state = walkStep(state, touch(t, tg, true)).state;
        }
        t += 20;
        const done = walkStep(state, touch(t, anchorTarget(w.turn!.anchor), true));
        expect(done.effects.map((e) => (e.kind === 'speak' ? e.line.key : e.kind))).toEqual(['walk.turn.right', 'walk.done']);
        expect(done.state.phase).toBe('done');
        let s = done.state;
        for (let i = 0; i < extra; i++) {
          t += 60;
          const r = walkStep(s, touch(t, anchorTarget(w.turn!.anchor), true));
          expect(r.effects).toEqual([]);
          expect(r.state.phase).toBe('done');
          s = r.state;
        }
      }),
      { numRuns: runs(300) },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// P186
// ---------------------------------------------------------------------------------------------

describe('P186: time and flag are validated', () => {
  const badTimes = [Number.NaN, Infinity, -Infinity, '5' as unknown as number, null as unknown as number, undefined as unknown as number];

  it('a held or moved touch with a time that is not a finite number changes nothing', () => {
    fc.assert(
      fc.property(sceneArb, fc.constantFrom(...badTimes), fc.boolean(), (scene, bad, held) => {
        const { w, state } = atTurn(scene);
        const tg = wrongsOf(scene, w)[0]!;
        const r = walkStep(state, touch(bad, tg, held ? true : undefined));
        expect(r.state).toBe(state);
        expect(r.effects).toEqual([]);
      }),
      { numRuns: runs(300) },
    );
  });

  it('a held value that is not exactly true is a moved touch, and the flag means nothing on other inputs', () => {
    const junk = [false, 'true', 1, 0, null, {}, [], 'held'];
    fc.assert(
      fc.property(sceneArb, fc.constantFrom(...junk), fc.integer({ min: 1, max: 100_000 }), (scene, flag, gap) => {
        const { w, state } = atTurn(scene);
        const tg = wrongsOf(scene, w)[0]!;
        const t = lastActivityOf(state) + gap;
        const r = walkStep(state, touch(t, tg, flag));
        expect(lastActivityOf(r.state)).toBe(t);
        const moved = walkStep(state, touch(t, tg));
        expect(r.effects).toEqual(moved.effects);
        expect(r.state).toEqual(moved.state);
        // `held: true` on any other input still counts as activity
        for (const kind of ['next', 'repeat', 'guideMe'] as const) {
          const o = walkStep(state, { kind, t, held: true } as unknown as WalkInput);
          expect(lastActivityOf(o.state)).toBe(t);
        }
      }),
      { numRuns: runs(300) },
    );
  });

  it('held touches only ever ask for speech or guidance, and frozen inputs give the same answer as thawed ones', () => {
    const stepArb = fc.record({ pick: fc.nat(), dt: fc.integer({ min: 0, max: 700 }), held: fc.boolean() });
    fc.assert(
      fc.property(sceneArb, fc.array(stepArb, { minLength: 1, maxLength: 30 }), (scene, steps) => {
        const { w, state: s0, t: t0 } = atTurn(scene);
        const pool = [...wrongsOf(scene, w), NONE, anchorTarget(w.turn!.anchor)];
        let plain = s0;
        let frozen = deepFreeze(structuredClone(s0)) as WalkState;
        let t = t0;
        for (const s of steps) {
          t += s.dt;
          const tg = pool[s.pick % pool.length]!;
          const a = walkStep(plain, touch(t, tg, s.held ? true : undefined));
          const b = walkStep(frozen, deepFreeze(structuredClone(touch(t, tg, s.held ? true : undefined))));
          expect(b).toEqual(a);
          for (const e of a.effects) expect(['speak', 'guideTo']).toContain(e.kind);
          plain = a.state;
          frozen = deepFreeze(structuredClone(b.state)) as WalkState;
        }
      }),
      { numRuns: runs(300) },
    );
  });
});
