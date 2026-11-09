/**
 * P51 — an unlabelled corner is spoken in the active language (Task 31, NEEDS-KIRO-02).
 *
 * Written by Kiro. The engine used to speak the English string 'Point ' + id for a vertex with no
 * label, even in Hindi and Gujarati. The pure engine now emits a key
 * ({ kind: 'speakKey', textKey: 'vertex.unlabelled', params: { id } }) and the shell turns it into
 * words through i18n: `runEffects` speaks it, and `mergeAnnouncements` joins it with axis
 * crossings into one utterance (CORE-02 stays fixed).
 */
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HAPTICS, initialState, step, type Effect } from '../src/core/hapticEngine';
import type { Target } from '../src/core/hitTest';
import { MemoryDiagramStore, runEffects, type Drivers } from '../src/drivers';
import { mergeAnnouncements } from '../src/flow/explore';
import { setLang, t, type Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['en', 'hi', 'gu'];

afterEach(() => setLang('en'));

function enterVertex(id: string, label: string | undefined): Effect[] {
  const target: Target = { kind: 'vertex', id, label };
  return step(initialState(), { kind: 'move', t: 100, target, yNorm: 0.5 }, DEFAULT_HAPTICS).effects;
}

function drivers(): { d: Drivers; spoken: string[] } {
  const spoken: string[] = [];
  const d: Drivers = {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: { speak: (text: string) => spoken.push(text), listen: vi.fn(), canSpeak: true, canListen: true },
    diagramStore: new MemoryDiagramStore(),
  };
  return { d, spoken };
}

const idArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,5}$/);
const blankArb = fc.constantFrom<string | undefined>(undefined, '', ' ', '   ', '\t');
const labelArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim() !== '');

describe('P51 — the engine emits a key for an unlabelled corner, text for a labelled one', () => {
  it('unlabelled (missing or blank label) gives exactly one key effect carrying the id (200+ runs)', () => {
    fc.assert(
      fc.property(idArb, blankArb, (id, label) => {
        const effects = enterVertex(id, label);
        const keyed = effects.filter((e) => e.kind === 'speakKey');
        expect(keyed).toEqual([{ kind: 'speakKey', textKey: 'vertex.unlabelled', params: { id } }]);
        expect(effects.some((e) => e.kind === 'speak')).toBe(false);
      }),
      { numRuns: 250 },
    );
  });

  it('labelled gives exactly one speak effect with the label, and no key effect (200+ runs)', () => {
    fc.assert(
      fc.property(idArb, labelArb, (id, label) => {
        const effects = enterVertex(id, label);
        expect(effects.filter((e) => e.kind === 'speak')).toEqual([{ kind: 'speak', text: label }]);
        expect(effects.some((e) => e.kind === 'speakKey')).toBe(false);
      }),
      { numRuns: 250 },
    );
  });

  it('never puts English "Point " text into an engine effect (200+ runs)', () => {
    fc.assert(
      fc.property(idArb, fc.oneof(blankArb, labelArb.map((l) => l as string | undefined)), (id, label) => {
        for (const e of enterVertex(id, label)) {
          if (e.kind === 'speak' && !(label !== undefined && label.trim() !== '')) {
            throw new Error(`unlabelled corner produced literal text "${e.text}"`);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('the corner pulse, tone and quiet window are unchanged by the label (tuned values)', () => {
    fc.assert(
      fc.property(idArb, fc.oneof(blankArb, labelArb.map((l) => l as string | undefined)), (id, label) => {
        const effects = enterVertex(id, label);
        expect(effects[0]).toEqual({ kind: 'vibrate', pattern: [50, 90, 50] });
        expect(effects[effects.length - 1]).toEqual({ kind: 'tone', hz: null });
        const target: Target = { kind: 'vertex', id, label };
        const { state } = step(initialState(), { kind: 'move', t: 100, target, yNorm: 0.5 }, DEFAULT_HAPTICS);
        expect(state.quietUntil).toBe(100 + 450);
      }),
      { numRuns: 200 },
    );
  });
});

describe('P51 — the shell speaks the key in the active language', () => {
  it('runEffects speaks the translated sentence with the id filled in, in en, hi and gu (200+ runs)', () => {
    fc.assert(
      fc.property(idArb, fc.constantFrom(...LANGS), (id, lang) => {
        setLang(lang);
        const { d, spoken } = drivers();
        runEffects(enterVertex(id, undefined), d);
        expect(spoken).toEqual([t('vertex.unlabelled').replace('{id}', id)]);
        expect(spoken[0]).toContain(id);
        expect(spoken[0]).not.toContain('{id}');
        expect(spoken[0]).not.toBe('vertex.unlabelled');
      }),
      { numRuns: 250 },
    );
  });

  it('Hindi and Gujarati do not say the English word "Point"', () => {
    for (const lang of ['hi', 'gu'] as const) {
      setLang(lang);
      const { d, spoken } = drivers();
      runEffects(enterVertex('B', undefined), d);
      expect(spoken).toHaveLength(1);
      expect(spoken[0]).not.toMatch(/\bPoint\b/);
      expect(spoken[0]).toContain('B');
    }
  });

  it('mergeAnnouncements turns the key into words and joins it after the axis crossings (200+ runs)', () => {
    fc.assert(
      fc.property(
        idArb,
        fc.constantFrom(...LANGS),
        fc.array(fc.constantFrom('y-axis', 'x-axis'), { maxLength: 2 }),
        (id, lang, axes) => {
          setLang(lang);
          const merged = mergeAnnouncements(axes, enterVertex(id, undefined));
          expect(merged.some((e) => e.kind === 'speakKey')).toBe(false);
          const spoken = merged.filter((e): e is Extract<Effect, { kind: 'speak' }> => e.kind === 'speak');
          expect(spoken).toHaveLength(1);
          const vertexWords = t('vertex.unlabelled').replace('{id}', id);
          expect(spoken[0]!.text.endsWith(vertexWords)).toBe(true);
          for (const a of axes) expect(spoken[0]!.text).toContain(a);
          // Non-speech effects keep their order: corner pulse first, tone last.
          const quiet = merged.filter((e) => e.kind !== 'speak');
          expect(quiet).toEqual([
            { kind: 'vibrate', pattern: [50, 90, 50] },
            { kind: 'tone', hz: null },
          ]);
        },
      ),
      { numRuns: 250 },
    );
  });
});
