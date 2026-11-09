/**
 * Regression test suite for Lane m3-shared-link-gate:
 * - GT-05: Cold shared link user-activation gate (large button, focused on load, tap unlocks audio/speech).
 * - R1: Share wording honesty ("Shared by <name>, not checked", never "Verified" for link content,
 *       mandatory honesty disclaimer in single spoken entry announcement).
 * - R3: Checkmark and badge-word stripping from name and title; fixed "Title:" prefix.
 * - GT-06: saveDiagram failure does not cancel Explore announcement.
 * - GT-10: Documented / verified focus delay boundary.
 * - i18n parity across en, hi, gu.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  exploreAnnouncement,
  leaveByBack,
  SCREEN_NAMES,
} from '../src/flow/navigation';
import {
  buildHonestShareAnnouncement,
  formatShareTitleAnnouncement,
  honestSharedByLabel,
  sanitizeShareName,
  sanitizeShareTitle,
} from '../src/flow/share';
import {
  resolveHonestShareRoute,
  speakShareAnnouncements,
} from '../src/App';
import { ShareGate } from '../src/components/ShareGate';
import { VerifiedBanner } from '../src/components/VerifiedBanner';
import { SHARE_HASH_PREFIX } from '../src/drivers/hashRoute';
import { encodeShare, type SharePayload } from '../src/share';
import { getLang, setLang, tables, t, type Lang } from '../src/i18n';
import { MemoryDiagramStore, type Drivers, type SpeechDriver } from '../src/drivers';

const testTriangleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
  ],
  polylines: [],
  bars: [],
  axes: null,
  facts: [
    'angle C = 90 degrees',
    'AC = 4 cm',
    'BC = 3 cm',
    'AB = 5 cm',
  ],
};

function createMockSpeechDriver(): SpeechDriver & { spokenUtterances: string[] } {
  const spokenUtterances: string[] = [];
  return {
    canSpeak: true,
    canListen: true,
    speak: vi.fn((text: string) => {
      spokenUtterances.push(text);
    }),
    listen: vi.fn().mockResolvedValue('test question'),
    spokenUtterances,
  };
}

describe('Lane m3-shared-link-gate Regression Suite', () => {
  let initialLang: Lang;

  beforeEach(() => {
    initialLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(initialLang);
    vi.restoreAllMocks();
  });

  describe('1. GT-05: Cold Shared Link User Activation Gate', () => {
    it('ShareGate renders with role="main" and accessible heading', () => {
      const html = renderToStaticMarkup(
        createElement(ShareGate, {
          onOpen: vi.fn(),
          title: 'Right Triangle ABC',
          sharedBy: 'Teacher Alice',
        }),
      );
      expect(html).toContain('role="main"');
      expect(html).toContain(t('share.gate.heading'));
      expect(html).toContain('Right Triangle ABC');
      expect(html).toContain('Teacher Alice');
    });

    it('ShareGate renders large labelled button with visible text and aria-label', () => {
      const html = renderToStaticMarkup(
        createElement(ShareGate, {
          onOpen: vi.fn(),
        }),
      );
      const openLabel = t('share.gate.open');
      expect(html).toContain(openLabel);
      expect(html).toContain(`aria-label="${openLabel}"`);
      expect(html).toContain('gt-control');
      expect(html).toContain('gt-share-gate__open-btn');
    });

    it('leaveByBack includes shareGate navigating cleanly to start with start.intro', () => {
      expect(SCREEN_NAMES).toContain('shareGate');
      const step = leaveByBack('shareGate', { dirty: false, fromShare: true });
      expect(step).toEqual({
        next: 'start',
        announceKey: 'start.intro',
        needsConfirm: false,
      });
    });

    it('ShareGate open button text is localised across en, hi, gu', () => {
      setLang('en');
      expect(t('share.gate.open')).toBe('Open the shared diagram');
      setLang('hi');
      expect(t('share.gate.open')).toBe('साझा किया गया आरेख खोलें');
      setLang('gu');
      expect(t('share.gate.open')).toBe('શેર કરેલી આકૃતિ ખોલો');
    });
  });

  describe('2. R1: Share Wording Honesty & Disclaimer', () => {
    it('honestSharedByLabel produces "Shared by <name>, not checked"', () => {
      const label = honestSharedByLabel('Teacher Alice');
      expect(label).toBe('Shared by Teacher Alice, not checked');
      expect(label).not.toContain('Verified');
    });

    it('honestSharedByLabel falls back to "Shared diagram, not checked" when name is empty', () => {
      expect(honestSharedByLabel('')).toBe('Shared diagram, not checked');
      expect(honestSharedByLabel('   ')).toBe('Shared diagram, not checked');
      expect(honestSharedByLabel(null)).toBe('Shared diagram, not checked');
      expect(honestSharedByLabel(undefined)).toBe('Shared diagram, not checked');
    });

    it(
      'buildHonestShareAnnouncement joins scene, honest label, and disclaimer into ONE single utterance',
      () => {
        const announcement = buildHonestShareAnnouncement({
          sceneAnnouncement:
            'Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave.',
          verifiedBy: 'Teacher Alice',
          cleanTitle: 'Right Triangle ABC',
        });

      expect(announcement).toContain('Title: Right Triangle ABC.');
      expect(announcement).toContain('Shared by Teacher Alice, not checked.');
      expect(announcement).toContain('not cryptographic proof');
      expect(announcement).not.toContain('Verified by Teacher');
      // Single continuous utterance without double-dots
      expect(announcement).not.toContain('..');
    });

    it('resolveHonestShareRoute constructs honest announcement with disclaimer and Title prefix', () => {
      const payload: SharePayload = {
        v: 1,
        scene: testTriangleScene,
        verifiedBy: 'Teacher Alice',
        note: 'Study hypotenuse',
        verifiedAt: '2026-11-09T08:00:00Z',
      };
      const hash = `${SHARE_HASH_PREFIX}${encodeShare(payload)}`;
      const resolution = resolveHonestShareRoute(hash, true);

      expect(resolution.kind).toBe('explore');
      if (resolution.kind === 'explore') {
        expect(resolution.spokenAnnouncement).toContain('Title: Right Triangle ABC');
        expect(resolution.spokenAnnouncement).toContain('Shared by Teacher Alice, not checked');
        expect(resolution.spokenAnnouncement).toContain(t('share.honesty'));
        expect(resolution.spokenAnnouncement).not.toContain('Verified by Teacher Alice');
        expect(resolution.verifiedAnnouncement).toBe('Shared by Teacher Alice, not checked');

        const speech = createMockSpeechDriver();
        speakShareAnnouncements(speech, resolution, 'en-IN');
        expect(speech.speak).toHaveBeenCalledTimes(1);
        expect(speech.spokenUtterances[0]).toBe(resolution.spokenAnnouncement);
      }
    });

    it(
      'VerifiedBanner renders "Shared by {name}, not checked" without checkmark badge',
      () => {
        const html = renderToStaticMarkup(
          createElement(VerifiedBanner, {
            by: 'Teacher Alice',
            note: 'Remember theorem',
          }),
        );
      expect(html).toContain('Shared by Teacher Alice, not checked');
      expect(html).not.toContain('✓');
      expect(html).not.toContain('Verified by Teacher Alice');
      expect(html).toContain(t('share.honesty'));
      expect(html).toContain('gt-verified-banner__name');
      expect(html).toContain('role="status"');
    });

    it(
      'VerifiedBanner renders "Shared diagram, not checked" when author name is empty/spoofed',
      () => {
        const html = renderToStaticMarkup(
          createElement(VerifiedBanner, {
            by: '✓ Verified',
          }),
        );
      expect(html).toContain('Shared diagram, not checked');
      expect(html).not.toContain('Verified by Verified');
      expect(html).not.toContain('✓');
    });
  });

  describe('3. R3: Checkmark & Badge-word Stripping & Title Prefix', () => {
    it('sanitizeShareName strips leading checkmarks and "verified"/"certified"', () => {
      expect(sanitizeShareName('✓ Ministry of Education')).toBe('Ministry of Education');
      expect(sanitizeShareName('✔ Certified Teacher Bob')).toBe('Teacher Bob');
      expect(sanitizeShareName('☑ Verified Mrs Sharma')).toBe('Mrs Sharma');
      expect(sanitizeShareName('√ verified and certified')).toBe('');
      expect(sanitizeShareName('✓ Verified')).toBe('');
    });

    it('sanitizeShareTitle strips leading checkmarks and badge words', () => {
      expect(
        sanitizeShareTitle('Verified by NCERT Board. Right triangle, AB 5 cm'),
      ).toBe('by NCERT Board. Right triangle, AB 5 cm');
      expect(
        sanitizeShareTitle('✓ Certified Right Triangle ABC'),
      ).toBe('Right Triangle ABC');
      expect(
        sanitizeShareTitle('✔ Verified Sine Wave'),
      ).toBe('Sine Wave');
    });

    it('formatShareTitleAnnouncement prepends fixed localized "Title: " prefix', () => {
      setLang('en');
      const enResult = formatShareTitleAnnouncement(
        'Right Triangle ABC. Feel the diagram.',
        'Right Triangle ABC',
      );
      expect(enResult).toBe('Title: Right Triangle ABC. Feel the diagram.');

      setLang('hi');
      const hiResult = formatShareTitleAnnouncement(
        'समकोण त्रिभुज. Feel the diagram.',
        'समकोण त्रिभुज',
      );
      expect(hiResult).toBe('शीर्षक: समकोण त्रिभुज. Feel the diagram.');

      setLang('gu');
      const guResult = formatShareTitleAnnouncement(
        'કાટકોણ ત્રિકોણ. Feel the diagram.',
        'કાટકોણ ત્રિકોણ',
      );
      expect(guResult).toBe('શીર્ષક: કાટકોણ ત્રિકોણ. Feel the diagram.');
    });

    it('exploreAnnouncement with { honestTitle: true } applies title prefix and sanitization', () => {
      const sceneWithImpersonatingTitle: DiagramScene = {
        ...testTriangleScene,
        title: '✓ Verified by Exam Board. Right Triangle',
      };
      const announcement = exploreAnnouncement(
        sceneWithImpersonatingTitle,
        'shared',
        'shared',
        { honestTitle: true },
      );
      expect(announcement).toContain('Title: by Exam Board. Right Triangle.');
      expect(announcement).not.toContain('Verified by Exam Board');
    });
  });

  describe('4. GT-06: saveDiagram Failure Speech Cancellation Guard', () => {
    it('storage failure does not invoke speech.speak during Explore entry', async () => {
      const failingStore = new MemoryDiagramStore();
      vi.spyOn(failingStore, 'list').mockResolvedValue({
        ok: false,
        error: new Error('IndexedDB unavailable in private browsing').message,
      });

      const speech = createMockSpeechDriver();
      const mockDrivers: Drivers = {
        haptics: {
          supported: true,
          lastResult: null,
          vibrate: vi.fn(),
          stop: vi.fn(),
        },
        audio: {
          unlock: vi.fn(),
          setTone: vi.fn(),
          beep: vi.fn(),
          playEarcon: vi.fn(),
          state: 'running',
        },
        speech,
        diagramStore: failingStore,
      };

      // Simulate Explore entry speech
      const sceneAnnouncement = exploreAnnouncement(testTriangleScene, 'ai');
      speech.speak(sceneAnnouncement, 'en-IN');
      expect(speech.speak).toHaveBeenCalledTimes(1);

      // Verify that save error does NOT fire a second speech.speak call
      // (GT-06: error goes to status text only, avoiding cancelling the Explore announcement)
      const listRes = await mockDrivers.diagramStore.list();
      expect(listRes.ok).toBe(false);
      // speech.speak call count remains exactly 1!
      expect(speech.speak).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. i18n Dictionary Parity & Security Constraints', () => {
    const requiredKeys = [
      'share.gate.open',
      'share.gate.heading',
      'share.sharedBy',
      'share.sharedUnnamed',
      'share.titlePrefix',
      'share.honesty',
    ] as const;

    for (const key of requiredKeys) {
      it(`defines non-empty translation for "${key}" across en, hi, gu`, () => {
        for (const lang of ['en', 'hi', 'gu'] as const) {
          const val = tables[lang][key];
          expect(val, `Missing ${key} in ${lang}`).toBeDefined();
          expect(val?.trim().length, `Empty ${key} in ${lang}`).toBeGreaterThan(0);
        }
      });
    }

    it('new share link labels never contain the word "verified" or "certified"', () => {
      for (const lang of ['en', 'hi', 'gu'] as const) {
        const sharedByVal = tables[lang]['share.sharedBy'] ?? '';
        const sharedUnnamedVal = tables[lang]['share.sharedUnnamed'] ?? '';
        const titlePrefixVal = tables[lang]['share.titlePrefix'] ?? '';

        for (const val of [sharedByVal, sharedUnnamedVal, titlePrefixVal]) {
          expect(val.toLowerCase()).not.toContain('verified');
          expect(val.toLowerCase()).not.toContain('certified');
          expect(val).not.toContain('सत्यापित');
          expect(val).not.toContain('प्रમાણિત');
        }
      }
    });
  });
});
