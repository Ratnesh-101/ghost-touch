/**
 * Lane ux4 — say only what is true.
 * Verification tests for gesture hint wording and canvas accessible description.
 *
 * Verifies:
 * 1. 'explore.gestureHint' is "Drag one finger to feel the diagram." (en, hi, gu).
 * 2. 'explore.gestureHintTalkBack' carries double-tap-and-hold wording (en, hi, gu)
 *    and is used only for the canvas accessible description, never in app speech.
 * 3. 'lab.start.subhint' is "Touch, sound and speech" (en, hi, gu).
 * 4. buildEntryAnnouncement / exploreAnnouncement output has no "double-tap" in any language.
 * 5. Canvas description still carries the TalkBack wording across all supported languages.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  buildEntryAnnouncement,
  canvasAriaDescription,
  canvasAriaLabel,
  exploreAnnouncement,
  leaveByBack,
  type BackContext,
} from '../src/flow/navigation';
import { getLang, setLang, t, tables, type Lang } from '../src/i18n';

describe('Lane ux4: gesture hint and start subhint wording (say only what is true)', () => {
  let initialLang: Lang;

  beforeEach(() => {
    initialLang = getLang();
  });

  afterEach(() => {
    setLang(initialLang);
  });

  const geometryScene: DiagramScene = {
    kind: 'geometry',
    title: 'Right triangle',
    points: [
      { id: 'A', label: 'A', x: 0.1, y: 0.1 },
      { id: 'B', label: 'B', x: 0.1, y: 0.9 },
      { id: 'C', label: 'C', x: 0.9, y: 0.9 },
    ],
  };

  const functionScene: DiagramScene = {
    kind: 'function_graph',
    title: 'Sine wave',
  };

  const rawScene: DiagramScene = {
    kind: 'unknown',
    title: 'Unparsed diagram',
  };

  describe('DO 1 & DO 2: String table exact copy and parity across languages', () => {
    const expectedGestureHints: Record<Lang, string> = {
      en: 'Drag one finger to feel the diagram.',
      hi: 'चित्र महसूस करने के लिए एक उंगली खींचें।',
      gu: 'આકૃતિ અનુભવવા માટે એક આંગળી ખેંચો.',
    };

    const expectedTalkBackHints: Record<Lang, string> = {
      en: 'Double-tap and hold, then drag to feel the diagram.',
      hi: 'डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें।',
      gu: 'ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો.',
    };

    const expectedSubhints: Record<Lang, string> = {
      en: 'Touch, sound and speech',
      hi: 'स्पर्श, ध्वनि और वाणी',
      gu: 'સ્પર્શ, ધ્વનિ અને વાણી',
    };

    const langs: Lang[] = ['en', 'hi', 'gu'];

    for (const lang of langs) {
      describe(`Language: ${lang}`, () => {
        beforeEach(() => {
          setLang(lang);
        });

        it(`resolves 'explore.gestureHint' without double-tap wording in ${lang}`, () => {
          const hint = t('explore.gestureHint');
          expect(hint).toBe(expectedGestureHints[lang]);

          // Explicit negative checks: gestureHint must never speak double-tap
          expect(hint.toLowerCase()).not.toContain('double-tap');
          expect(hint).not.toContain('डबल-टैप');
          expect(hint).not.toContain('ડબલ-ટેપ');
        });

        it(`resolves 'explore.gestureHintTalkBack' with exact double-tap wording in ${lang}`, () => {
          const tbHint = t('explore.gestureHintTalkBack');
          expect(tbHint).toBe(expectedTalkBackHints[lang]);

          if (lang === 'en') {
            expect(tbHint.toLowerCase()).toContain('double-tap');
          } else if (lang === 'hi') {
            expect(tbHint).toContain('डबल-टैप');
          } else if (lang === 'gu') {
            expect(tbHint).toContain('ડબલ-ટેપ');
          }
        });

        it(`resolves 'lab.start.subhint' as "Touch, sound and speech" in ${lang}`, () => {
          const subhint = t('lab.start.subhint');
          expect(subhint).toBe(expectedSubhints[lang]);

          // Negative check: must not mention TalkBack
          expect(subhint.toLowerCase()).not.toContain('talkback');
          expect(subhint).not.toContain('टॉकबैक');
          expect(subhint).not.toContain('ટોકબેક');
        });
      });
    }

    it('maintains strict key parity across en, hi, and gu string tables', () => {
      const enKeys = Object.keys(tables.en).sort();
      const hiKeys = Object.keys(tables.hi).sort();
      const guKeys = Object.keys(tables.gu).sort();

      expect(hiKeys).toEqual(enKeys);
      expect(guKeys).toEqual(enKeys);
      expect(enKeys).toContain('explore.gestureHint');
      expect(enKeys).toContain('explore.gestureHintTalkBack');
      expect(enKeys).toContain('lab.start.subhint');
    });
  });

  describe('DO 3: buildEntryAnnouncement and exploreAnnouncement output (app speech)', () => {
    const langs: Lang[] = ['en', 'hi', 'gu'];

    for (const lang of langs) {
      describe(`In ${lang}`, () => {
        beforeEach(() => {
          setLang(lang);
        });

        it('buildEntryAnnouncement contains no "double-tap" in AI mode', () => {
          const text = buildEntryAnnouncement(geometryScene, 'ai');
          expect(text.toLowerCase()).not.toContain('double-tap');
          expect(text).not.toContain('डबल-टैप');
          expect(text).not.toContain('ડબલ-ટેપ');
          expect(text).toContain(t('explore.gestureHint'));
        });

        it('exploreAnnouncement matches buildEntryAnnouncement identically', () => {
          const textBuild = buildEntryAnnouncement(geometryScene, 'ai');
          const textExplore = exploreAnnouncement(geometryScene, 'ai');
          expect(textBuild).toBe(textExplore);
        });

        it('buildEntryAnnouncement contains no "double-tap" in function graphs', () => {
          const text = buildEntryAnnouncement(functionScene, 'ai');
          expect(text.toLowerCase()).not.toContain('double-tap');
          expect(text).not.toContain('डबल-टैप');
          expect(text).not.toContain('ડબલ-ટેપ');
          expect(text).toContain(t('explore.gestureHint'));
        });

        it('buildEntryAnnouncement contains no "double-tap" in sample mode', () => {
          const text = buildEntryAnnouncement(geometryScene, 'sample');
          expect(text.toLowerCase()).not.toContain('double-tap');
          expect(text).not.toContain('डबल-टैप');
          expect(text).not.toContain('ડબલ-ટેપ');
        });

        it('buildEntryAnnouncement contains no "double-tap" in shared mode', () => {
          const text = buildEntryAnnouncement(geometryScene, 'shared', 'shared', { honestTitle: true });
          expect(text.toLowerCase()).not.toContain('double-tap');
          expect(text).not.toContain('डबल-टैप');
          expect(text).not.toContain('ડબલ-ટેપ');
        });

        it('buildEntryAnnouncement contains no "double-tap" in raw mode', () => {
          const text = buildEntryAnnouncement(rawScene, 'raw', undefined, undefined, 'unreadable');
          expect(text.toLowerCase()).not.toContain('double-tap');
          expect(text).not.toContain('डबल-टैप');
          expect(text).not.toContain('ડબલ-ટેપ');
          expect(text).toContain(t('explore.gestureHint'));
        });
      });
    }
  });

  describe('Canvas accessible description (TalkBack reader text)', () => {
    it('canvasAriaLabel carries TalkBack wording in English', () => {
      setLang('en');
      const label = canvasAriaLabel(geometryScene);
      expect(label).toContain('Double-tap and hold, then drag to feel the diagram.');
      expect(label).toContain('Right triangle');
    });

    it('canvasAriaLabel carries TalkBack wording in Hindi', () => {
      setLang('hi');
      const label = canvasAriaLabel(geometryScene);
      expect(label).toContain('डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें।');
    });

    it('canvasAriaLabel carries TalkBack wording in Gujarati', () => {
      setLang('gu');
      const label = canvasAriaLabel(geometryScene);
      expect(label).toContain('ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો.');
    });

    it('canvasAriaDescription standalone helper provides TalkBack description', () => {
      setLang('en');
      expect(canvasAriaDescription()).toBe('Double-tap and hold, then drag to feel the diagram.');
      expect(canvasAriaDescription(geometryScene)).toContain('Double-tap and hold');

      setLang('hi');
      expect(canvasAriaDescription()).toBe('डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें।');

      setLang('gu');
      expect(canvasAriaDescription()).toBe('ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો.');
    });
  });

  describe('Back navigation policy (leaveByBack)', () => {
    it('leaving teach back to explore announces gestureHint (single-finger drag, never double-tap)', () => {
      setLang('en');
      const ctx: BackContext = { dirty: false, fromShare: false, hasScene: true };
      const step = leaveByBack('teach', ctx);

      expect(step.next).toBe('explore');
      expect(step.announceKey).toBe('explore.gestureHint');
      expect(t(step.announceKey)).toBe('Drag one finger to feel the diagram.');
      expect(t(step.announceKey).toLowerCase()).not.toContain('double-tap');
    });

    it('leaving correct back to explore announces gestureHint (single-finger drag, never double-tap)', () => {
      setLang('en');
      const ctx: BackContext = { dirty: false, correctDirty: false, fromShare: false };
      const step = leaveByBack('correct', ctx);

      expect(step.next).toBe('explore');
      expect(step.announceKey).toBe('explore.gestureHint');
      expect(t(step.announceKey)).toBe('Drag one finger to feel the diagram.');
      expect(t(step.announceKey).toLowerCase()).not.toContain('double-tap');
    });
  });
});
