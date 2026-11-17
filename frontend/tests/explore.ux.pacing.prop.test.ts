/**
 * Task 67 oracles U4 and U7 (design.md "Seven Explore bugs"): two pure properties.
 *
 * P137 (Requirement 31.3, 31.6): in short mode a corner is spoken by its label exactly as given,
 * and a bar that follows another within 700 ms is spoken by its label exactly as given, with the
 * label passed as its own field beside the "label, value" text.
 * P138 (Requirement 41.1): `scanTone` is null for a vertex target.
 *
 * Both properties fail today (`it.fails`, reasons below). The lane that fixes the bug removes
 * `.fails`. The "control" tests pass today and show the generators reach the cue, so a red
 * property is not red for a missing fixture.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import sineJson from '../public/samples/sine.json';
import type { DiagramScene } from '../src/core/scene';
import {
  initialSpeechPacingState,
  paceSpeech,
  scanTone,
  type SpeechPacingInput,
} from '../src/flow/explore';
import { runs } from './support/runs';

const RUNS = runs(250);

/** Any label: free text, text with the cut characters, and fixed awkward examples. */
const anyLabel = fc.oneof(
  fc.string({ unit: 'grapheme', maxLength: 20 }),
  fc.string({ unit: 'binary', maxLength: 12 }),
  fc.constantFrom('A', 'Q1, Q2', 'Mr. A!', 'why? yes', 'x. y, z', ' A ', '', 'अ।ब', '॥', 'a,b'),
);
const plainLabel = fc.stringMatching(/^[A-Za-z0-9]{1,8}$/);
const anyValue = fc.string({ maxLength: 10 });

function barLabelSpoken(label: string, value: string): string | null {
  const first = paceSpeech(initialSpeechPacingState('short'), {
    t: 1000,
    text: 'First, 1',
    source: 'bar',
    detail: 'short',
    barId: 'b1',
  });
  // The label travels as its own field; `text` stays the full "label, value".
  const input = {
    t: 1300,
    text: `${label}, ${value}`,
    label,
    source: 'bar',
    detail: 'short',
    barId: 'b2',
  } as SpeechPacingInput;
  return paceSpeech(first.state, input).speakNow;
}

function cornerSpoken(label: string): string | null {
  return paceSpeech(initialSpeechPacingState('short'), {
    t: 1000,
    text: label,
    source: 'corner',
    detail: 'short',
  }).speakNow;
}

describe('P137 short mode speaks a label unchanged (U4, Requirement 31.6)', () => {
  it('control: a plain alphanumeric corner label and bar label come back unchanged', () => {
    fc.assert(
      fc.property(plainLabel, anyValue, (label, value) => {
        expect(cornerSpoken(label)).toBe(label);
        expect(barLabelSpoken(label, value)).toBe(label);
      }),
      { numRuns: RUNS },
    );
  });

  // Fails today: `extractCornerLabel` trims and cuts at . ! ? and the danda characters.
  it.fails('a corner label of any text is returned unchanged in short mode', () => {
    fc.assert(
      fc.property(anyLabel, (label) => {
        expect(cornerSpoken(label)).toBe(label);
      }),
      { numRuns: RUNS },
    );
  });

  // Fails today: `extractBarLabel` ignores `label`, cuts "label, value" at the first comma and trims.
  it.fails('a bar that follows another within 700 ms is spoken as its label, unchanged', () => {
    fc.assert(
      fc.property(anyLabel, anyValue, (label, value) => {
        expect(barLabelSpoken(label, value)).toBe(label);
      }),
      { numRuns: RUNS },
    );
  });
});

/** The sine sample plus one labelled point off the curve. */
const graphWithPoint: DiagramScene = {
  ...(sineJson as unknown as DiagramScene),
  points: [{ id: 'P', label: 'P', x: 0.5, y: 0.2 }],
};
const curve = graphWithPoint.polylines?.[0];
const xs = (curve?.points ?? []).map((p) => p[0]);
const xMin = Math.min(...xs);
const xMax = Math.max(...xs);

describe('P138 the scan tone is null on a vertex (U7, Requirement 41.1)', () => {
  it('the generator sees a curve', () => {
    expect(xs.length).toBeGreaterThan(10);
    expect(xMax).toBeGreaterThan(xMin);
  });

  it('control: off every target the scan tone exists inside the curve range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: xMin, max: xMax, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (x, y) => {
          expect(scanTone(graphWithPoint, { kind: 'none' }, x, y)).not.toBeNull();
        },
      ),
      { numRuns: RUNS },
    );
  });

  // Fails today: `scanTone` only excludes the polyline target, so a vertex gets a curve-height tone.
  it.fails('a vertex target gets no scan tone, for any x in the curve range and any y', () => {
    fc.assert(
      fc.property(
        fc.double({ min: xMin, max: xMax, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (x, y) => {
          expect(scanTone(graphWithPoint, { kind: 'vertex', id: 'P', label: 'P' }, x, y)).toBeNull();
        },
      ),
      { numRuns: RUNS },
    );
  });
});
