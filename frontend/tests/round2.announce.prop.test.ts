/**
 * P44 — Announcements join in order without loss (Task 26, Requirement 17.2, CORE-02).
 *
 * Written by Kiro. When one pointer move crosses an axis and also lands on a vertex, the speech
 * driver cancels the previous utterance on every `speak`, so speaking them one after another
 * silences all but the last. The fix speaks one joined utterance.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeViewport, toScreen } from '../src/core/geometry';
import type { Effect } from '../src/core/hapticEngine';
import type { DiagramScene } from '../src/core/scene';
import {
  DEFAULT_RADII,
  initialAxisState,
  initialCentreTickState,
  initialState,
  joinAnnouncements,
  mergeAnnouncements,
  processPointerMove,
  seedAxisState,
} from '../src/flow/explore';

const partArb = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.constantFrom('y-axis', 'x-axis', 'Vertex A', 'Point O.', ' spaced ', '', '   ', 'बिंदु A।', 'શિરોબિંદુ'),
);

describe('P44 — joinAnnouncements', () => {
  it('keeps every non-blank part, in order, and nothing else (200+ runs)', () => {
    fc.assert(
      fc.property(fc.array(partArb, { maxLength: 8 }), (parts) => {
        const joined = joinAnnouncements(parts);
        const kept = parts.map((p) => p.trim()).filter((p) => p !== '');
        if (kept.length === 0) {
          expect(joined).toBe('');
          return;
        }
        let from = 0;
        for (const part of kept) {
          const at = joined.indexOf(part, from);
          expect(at, `"${part}" missing or out of order in "${joined}"`).toBeGreaterThanOrEqual(from);
          from = at + part.length;
        }
        expect(joined).toBe(joined.trim());
      }),
      { numRuns: 300 },
    );
  });

  it('never doubles sentence punctuation at a join (200+ runs)', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('y-axis', 'x-axis.', 'Point O।', 'Vertex A!', 'Base?'), { minLength: 2, maxLength: 6 }), (parts) => {
        const joined = joinAnnouncements(parts);
        expect(joined).not.toMatch(/[.!?।]\./);
        expect(joined).not.toMatch(/\.\./);
      }),
      { numRuns: 200 },
    );
  });

  it('a single part is returned trimmed, unchanged otherwise', () => {
    expect(joinAnnouncements(['  Vertex A  '])).toBe('Vertex A');
    expect(joinAnnouncements([])).toBe('');
    expect(joinAnnouncements(['', '  '])).toBe('');
    expect(joinAnnouncements(['y-axis', 'x-axis'])).toBe('y-axis. x-axis');
  });
});

const effectArb: fc.Arbitrary<Effect> = fc.oneof(
  fc.integer({ min: 0, max: 100 }).map((pattern): Effect => ({ kind: 'vibrate', pattern })),
  fc.constant<Effect>({ kind: 'vibrate', pattern: [50, 90, 50] }),
  fc.oneof(fc.constant(null), fc.integer({ min: 200, max: 1000 })).map((hz): Effect => ({ kind: 'tone', hz })),
  fc.constantFrom('Vertex A', 'Point O', 'Bar 3', 'Hypotenuse').map((text): Effect => ({ kind: 'speak', text })),
);

describe('P44 — mergeAnnouncements', () => {
  it('speaks once, axes first, loses no text, and keeps the other effects in order (200+ runs)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('y-axis', 'x-axis'), { maxLength: 2 }),
        fc.array(effectArb, { maxLength: 6 }),
        (axes, effects) => {
          const merged = mergeAnnouncements(axes, effects);
          const spokenBefore = effects.filter((e): e is Extract<Effect, { kind: 'speak' }> => e.kind === 'speak');
          const spokenAfter = merged.filter((e): e is Extract<Effect, { kind: 'speak' }> => e.kind === 'speak');

          // Exactly one utterance when there is anything to say, none otherwise.
          expect(spokenAfter.length).toBe(axes.length + spokenBefore.length > 0 ? 1 : 0);

          // Everything that was non-speech is still there, in the same order.
          const quiet = (list: Effect[]): Effect[] => list.filter((e) => e.kind !== 'speak');
          expect(quiet(merged)).toEqual(quiet(effects));

          if (spokenAfter.length === 1) {
            const text = spokenAfter[0]!.text;
            expect(text).toBe(joinAnnouncements([...axes, ...spokenBefore.map((e) => e.text)]));
            // Axis crossings come before the vertex or bar.
            let from = 0;
            for (const part of [...axes, ...spokenBefore.map((e) => e.text)]) {
              const at = text.indexOf(part, from);
              expect(at).toBeGreaterThanOrEqual(from);
              from = at + part.length;
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('does not touch the effects when there is nothing to say', () => {
    const effects: Effect[] = [{ kind: 'vibrate', pattern: 80 }, { kind: 'tone', hz: null }];
    expect(mergeAnnouncements([], effects)).toEqual(effects);
  });
});

describe('CORE-02 end to end — crossing both axes onto a vertex at the origin', () => {
  const scene: DiagramScene = {
    kind: 'function_graph',
    points: [{ id: 'O', x: 0.5, y: 0.5, label: 'Origin' }],
    axes: { x_axis_y: 0.5, y_axis_x: 0.5 },
  };
  const view = makeViewport(400, 400);

  it('produces one utterance carrying both axes and the vertex', () => {
    // Start well inside the top-left quadrant, then move onto the origin vertex.
    const start = toScreen({ x: 0.2, y: 0.2 }, view);
    const origin = toScreen({ x: 0.5, y: 0.5 }, view);
    const axis = seedAxisState({ x: 0.2, y: 0.2 }, scene.axes);
    // Jump past both axes in one move: bottom-right quadrant, onto the vertex's neighbourhood.
    const target = { x: origin.x + 10, y: origin.y + 10 };
    const result = processPointerMove(scene, target, view, 1000, initialState(), initialCentreTickState(), axis, DEFAULT_RADII);

    expect(start).toBeDefined();
    expect(result.axisCrossings.length).toBe(2);
    const spokenByEngine = result.effects.filter((e) => e.kind === 'speak');
    expect(spokenByEngine.length).toBe(1); // the vertex label

    const merged = mergeAnnouncements(result.axisCrossings, result.effects);
    const spoken = merged.filter((e) => e.kind === 'speak');
    expect(spoken).toHaveLength(1);
    const text = (spoken[0] as Extract<Effect, { kind: 'speak' }>).text;
    for (const crossing of result.axisCrossings) expect(text).toContain(crossing);
    expect(text).toContain('Origin');
    expect(initialAxisState()).toBeDefined();
  });
});
