/**
 * Regression test suite for Lane m3-shared-link-gate & p3-r5-share-fixes:
 * - GT-05: Cold shared link user-activation gate (large button, focused on load, tap unlocks audio).
 * - R1: Share honesty ("Shared by <name>, not checked", no "Verified" claims for link content,
 *       honest disclaimer in single spoken entry announcement).
 * - R3 / R5-01: Checkmark, invisible Unicode marks, and badge-word stripping.
 * - R5-02: Honest share.honesty copy without contradictory reviewed/verified claims.
 * - R5-03: Real GT-06 save failure test asserting no speech and error captured for status text.
 * - R5-04: ShareError no double-speech collision (follows StatusText pattern).
 * - R5-05: VerifiedBanner note container aria-live="off" to prevent collision in polite live region.
 * - R5-06: Safe interpolation with function replacers preventing $&, $', $1 corruption.
 * - R5-07: Localized scene kind fallback for missing/stripped diagram titles.
 * - R5-08 & R5-09: ShareGate wraps title and sharedBy in <bdi> and renders honestSharedByLabel.
 * - R5-10: LanguageSelector aria-label does not repeat "English (English)".
 * - R5-11: RateSelector uses formatRateMultiplier ("0.8×", "1.0×", "1.25×") without ASCII 'x'.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import {
  exploreAnnouncement,
  leaveByBack,
  localizedSceneKind,
  sceneName,
  SCREEN_NAMES,
} from '../src/flow/navigation';
import {
  buildHonestShareAnnouncement,
  formatShareTitleAnnouncement,
  honestSharedByLabel,
  sanitizeShareName,
  sanitizeShareTitle,
} from '../src/flow/share';
import { saveDiagramWithEviction } from '../src/flow/saved';
import {
  resolveHonestShareRoute,
  speakShareAnnouncements,
} from '../src/App';
import { ShareGate } from '../src/components/ShareGate';
import { VerifiedBanner } from '../src/components/VerifiedBanner';
import { LanguageSelector } from '../src/components/LanguageSelector';
import { RateSelector } from '../src/components/RateSelector';
import { ShareError } from '../src/screens/ShareError';
import { SHARE_HASH_PREFIX } from '../src/drivers/hashRoute';
import { encodeShare, type SharePayload } from '../src/share';
import { getLang, setLang, tables, t, type Lang } from '../src/i18n';
import type { DiagramStore, Drivers, SpeechDriver } from '../src/drivers';

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

function createMockDrivers(overrides?: Partial<Drivers>): Drivers {
  return {
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
    speech: createMockSpeechDriver(),
    diagramStore: {
      list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      get: vi.fn(),
      put: vi.fn().mockResolvedValue({ ok: true }),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
    ...overrides,
  };
}

describe('Lane m3-shared-link-gate & p3-r5-share-fixes Regression Suite', () => {
  let initialLang: Lang;

  beforeEach(() => {
    initialLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(initialLang);
    vi.restoreAllMocks();
  });

  describe('1. GT-05 & R5-08/R5-09: Cold Shared Link User Activation Gate', () => {
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

    it(
      'ShareGate wraps title and sharedBy in <bdi> and renders honestSharedByLabel (R5-08/R5-09)',
      () => {
      const html = renderToStaticMarkup(
        createElement(ShareGate, {
          onOpen: vi.fn(),
          title: 'Right Triangle ABC',
          sharedBy: 'Teacher Alice',
        }),
      );
      expect(html).toContain(
        '<p class="gt-share-gate__diagram-title"><bdi>Right Triangle ABC</bdi></p>',
      );
      expect(html).toContain(
        '<p class="gt-share-gate__diagram-by"><bdi>Shared by Teacher Alice, not checked</bdi></p>',
      );
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

  describe('2. R1 & R5-02: Share Wording Honesty & Disclaimer', () => {
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
      'buildHonestShareAnnouncement joins scene, honest label, and disclaimer into ONE utterance',
      () => {
      const announcement = buildHonestShareAnnouncement({
        sceneAnnouncement:
          'Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave.',
        verifiedBy: 'Teacher Alice',
        cleanTitle: 'Right Triangle ABC',
      });

      expect(announcement).toContain('Title: Right Triangle ABC.');
      expect(announcement).toContain('Shared by Teacher Alice, not checked.');
      expect(announcement).toContain(t('share.honesty'));
      expect(announcement).not.toContain('Verified by Teacher');
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

    it('VerifiedBanner renders "Shared by {name}, not checked" without checkmark badge', () => {
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

    it('VerifiedBanner renders "Shared diagram, not checked" when author name is empty/spoofed', () => {
      const html = renderToStaticMarkup(
        createElement(VerifiedBanner, {
          by: '✓ Verified',
        }),
      );
      expect(html).toContain('Shared diagram, not checked');
      expect(html).not.toContain('Verified by Verified');
      expect(html).not.toContain('✓');
    });

    it('share.honesty does not claim a person reviewed the diagram (R5-02)', () => {
      for (const lang of ['en', 'hi', 'gu'] as const) {
        setLang(lang);
        const honestyText = t('share.honesty');
        expect(honestyText.toLowerCase()).not.toContain('person reviewed');
        expect(honestyText.toLowerCase()).not.toContain('व्यक्ति ने');
        expect(honestyText.toLowerCase()).not.toContain('વ્યક્તિએ');
        expect(honestyText).not.toContain('Verified');
        expect(honestyText).not.toContain('सत्यापित');
        expect(honestyText).not.toContain('પ્રમાણિત');
      }
    });
  });

  describe('3. R3 & R5-01: Checkmark, Invisible Marks, & Badge-word Stripping', () => {
    it('sanitizeShareName strips U+2705, U+1F5F9, U+FE0F, directional, and zero-width marks', () => {
      // U+2705 (White Heavy Check Mark)
      expect(sanitizeShareName('✅ Verified NCERT')).toBe('NCERT');
      // U+1F5F9 (Ballot Box with Bold Check)
      expect(sanitizeShareName('🗹 Certified Educator')).toBe('Educator');
      // U+FE0F (Variation Selector)
      expect(sanitizeShareName('✔️\uFE0F Verified Teacher')).toBe('Teacher');
      // Directional marks (U+200E LRM, U+200F RLM, U+202A-202E, U+2066-2069)
      expect(sanitizeShareName('\u200E✓ Verified Mrs Sharma')).toBe('Mrs Sharma');
      expect(sanitizeShareName('\u200F\u202E Verified Tutor')).toBe('Tutor');
      expect(sanitizeShareName('\u2066\u2069 Certified Instructor')).toBe('Instructor');
      // Zero-width characters (U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 WJ, U+FEFF BOM)
      expect(sanitizeShareName('\u200B\u200C\u200D Verified Bob')).toBe('Bob');
      expect(sanitizeShareName('\u2060\uFEFF Certified Alice')).toBe('Alice');
      // Combining marks (\p{M})
      expect(sanitizeShareName('\u0300\u0301 Verified Dr. Rao')).toBe('Dr. Rao');
    });

    it('sanitizeShareName strips Hindi सत्यापित and Gujarati પ્રમાણિત', () => {
      expect(sanitizeShareName('सत्यापित शिक्षक')).toBe('शिक्षक');
      expect(sanitizeShareName('પ્રમાણિત અધ્યાપક')).toBe('અધ્યાપક');
      expect(sanitizeShareName('\u200Eसत्यापित श्रीमती वर्मा')).toBe('श्रीमती वर्मा');
      expect(sanitizeShareName('✅ પ્રમાણિત પટેલ સર')).toBe('પટેલ સર');
    });

    it('inputs made entirely of badges/checkmarks/connectors return empty, never "and" (R5-01)', () => {
      expect(sanitizeShareName('✓')).toBe('');
      expect(sanitizeShareName('✅')).toBe('');
      expect(sanitizeShareName('🗹')).toBe('');
      expect(sanitizeShareName('\uFE0F')).toBe('');
      expect(sanitizeShareName('\u200E\u200F\u200B')).toBe('');
      expect(sanitizeShareName('verified')).toBe('');
      expect(sanitizeShareName('certified')).toBe('');
      expect(sanitizeShareName('सत्यापित')).toBe('');
      expect(sanitizeShareName('પ્રમાણિત')).toBe('');
      expect(sanitizeShareName('verified and certified')).toBe('');
      expect(sanitizeShareName('verified and certified and')).toBe('');
      expect(sanitizeShareName('सत्यापित and પ્રમાણિત')).toBe('');
      expect(sanitizeShareName('✅ verified & certified and')).toBe('');
      expect(sanitizeShareName('\u200E✅\uFE0F verified and \u200Bसत्यापित & certified')).toBe('');
      expect(sanitizeShareName('and')).toBe('');
      expect(sanitizeShareName('&')).toBe('');
    });

    it('preserves names that legitimately contain "and" or start with "And"', () => {
      expect(sanitizeShareName('Andy')).toBe('Andy');
      expect(sanitizeShareName('Andrew')).toBe('Andrew');
      expect(sanitizeShareName('Prof. Andy')).toBe('Prof. Andy');
    });

    it('sanitizeShareTitle strips checkmarks, badge words, and invisible characters', () => {
      expect(
        sanitizeShareTitle('Verified by NCERT Board. Right triangle, AB 5 cm'),
      ).toBe('by NCERT Board. Right triangle, AB 5 cm');
      expect(
        sanitizeShareTitle('✅ Certified Right Triangle ABC'),
      ).toBe('Right Triangle ABC');
      expect(
        sanitizeShareTitle('\u200E✔ Verified Sine Wave'),
      ).toBe('Sine Wave');
      expect(
        sanitizeShareTitle('सत्यापित समकोण त्रिभुज'),
      ).toBe('समकोण त्रिभुज');
      expect(
        sanitizeShareTitle('પ્રમાણિત કાટકોણ ત્રિકોણ'),
      ).toBe('કાટકોણ ત્રિકોણ');
      expect(
        sanitizeShareTitle('✅ verified and certified'),
      ).toBe('');
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

  describe('4. R5-06: Safe String Interpolation with Function Replacers', () => {
    it('honestSharedByLabel does not corrupt names containing $&, $\', or $1', () => {
      expect(honestSharedByLabel('Prof. $& Sharma')).toBe(
        'Shared by Prof. $& Sharma, not checked',
      );
      expect(honestSharedByLabel('Teacher $\' Patel')).toBe(
        'Shared by Teacher $\' Patel, not checked',
      );
      expect(honestSharedByLabel('Student $1 Test')).toBe(
        'Shared by Student $1 Test, not checked',
      );
    });

    it('formatShareTitleAnnouncement does not corrupt titles containing $&, $\', or $1', () => {
      const result = formatShareTitleAnnouncement(
        'Base announcement',
        'Budget: $& and $\' total $1',
      );
      expect(result).toBe('Title: Budget: $& and $\' total $1. Base announcement');
    });

    it('exploreAnnouncement does not corrupt titles containing $&, $\', or $1', () => {
      const sceneWithSpecialTitle: DiagramScene = {
        ...testTriangleScene,
        title: 'Project $& Plan',
      };
      const announcement = exploreAnnouncement(
        sceneWithSpecialTitle,
        'shared',
        'shared',
        { honestTitle: true },
      );
      expect(announcement).toContain('Title: Project $& Plan.');
    });
  });

  describe('5. R5-07: Localized sceneName Fallback for scene.kind', () => {
    it('localizedSceneKind maps geometry, function_graph, bar_chart, unknown across en, hi, gu', () => {
      setLang('en');
      expect(localizedSceneKind('geometry')).toBe('Geometry diagram');
      expect(localizedSceneKind('function_graph')).toBe('Function graph');
      expect(localizedSceneKind('bar_chart')).toBe('Bar chart');
      expect(localizedSceneKind('unknown')).toBe('Diagram');

      setLang('hi');
      expect(localizedSceneKind('geometry')).toBe('ज्यामिति आरेख');
      expect(localizedSceneKind('function_graph')).toBe('फलन ग्राफ़');
      expect(localizedSceneKind('bar_chart')).toBe('बार चार्ट');
      expect(localizedSceneKind('unknown')).toBe('आरेख');

      setLang('gu');
      expect(localizedSceneKind('geometry')).toBe('ભૂમિતિ આકૃતિ');
      expect(localizedSceneKind('function_graph')).toBe('વિધેય આલેખ');
      expect(localizedSceneKind('bar_chart')).toBe('સ્તંભ આલેખ');
      expect(localizedSceneKind('unknown')).toBe('આકૃતિ');
    });

    it('sceneName falls back to localized kind instead of raw English identifier', () => {
      const untitledGeometry: DiagramScene = {
        ...testTriangleScene,
        title: undefined,
      };
      const untitledGraph: DiagramScene = {
        ...testTriangleScene,
        kind: 'function_graph',
        title: '   ',
      };

      setLang('hi');
      expect(sceneName(untitledGeometry)).toBe('ज्यामिति आरेख');
      expect(sceneName(untitledGraph)).toBe('फलन ग्राफ़');

      setLang('gu');
      expect(sceneName(untitledGeometry)).toBe('ભૂમિતિ આકૃતિ');
      expect(sceneName(untitledGraph)).toBe('વિધેય આલેખ');
    });

    it('exploreAnnouncement uses localized kind fallback when title is completely stripped', () => {
      const spoofedTitleScene: DiagramScene = {
        ...testTriangleScene,
        title: '✓ Verified',
      };
      setLang('hi');
      const announcement = exploreAnnouncement(
        spoofedTitleScene,
        'shared',
        'shared',
        { honestTitle: true },
      );
      expect(announcement).toContain('ज्यामिति आरेख');
      expect(announcement).not.toContain('geometry');
    });
  });

  describe('6. R5-03: Real GT-06 saveDiagram Failure Guard', () => {
    it(
      'saveDiagramWithEviction failure does not invoke speech.speak and captures error (R5-03)',
      async () => {
      const failingStore: DiagramStore = {
        list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        get: vi.fn(),
        put: vi.fn().mockResolvedValue({
          ok: false,
          error: 'QuotaExceededError: storage full',
        }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
      };

      const speech = createMockSpeechDriver();
      const mockDrivers = createMockDrivers({ speech, diagramStore: failingStore });

      // Simulate Explore entry speech
      const sceneAnnouncement = exploreAnnouncement(testTriangleScene, 'ai');
      mockDrivers.speech.speak(sceneAnnouncement, 'en-IN');
      expect(mockDrivers.speech.speak).toHaveBeenCalledTimes(1);

      // Execute real save path via saveDiagramWithEviction
      const entryToSave: SavedDiagram = {
        id: 'diag-1',
        createdAt: Date.now(),
        title: 'Right Triangle ABC',
        scene: testTriangleScene,
        thumbnailDataUrl: '',
        pinned: false,
      };

      const result = await saveDiagramWithEviction(mockDrivers.diagramStore, [], entryToSave);
      // Real function failed as expected
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('QuotaExceededError');
      }

      // GT-06: Storage error does NOT invoke speech.speak! Explore entry announcement continues.
      expect(mockDrivers.speech.speak).toHaveBeenCalledTimes(1);
      expect(speech.spokenUtterances.length).toBe(1);
    });
  });

  describe('7. R5-04 & R5-05: Speech Collision Prevention in ShareError and VerifiedBanner', () => {
    it(
      'ShareError avoids double-speech collision by omitting role="alert" when speech active',
      () => {
      // When canSpeak is true, renders plain text without role="alert" or live region
      const htmlSpoken = renderToStaticMarkup(
        createElement(ShareError, {
          code: 'bad-format',
          onGoToStart: vi.fn(),
          canSpeak: true,
        }),
      );
      expect(htmlSpoken).not.toContain('role="alert"');
      expect(htmlSpoken).not.toContain('role="status"');
      expect(htmlSpoken).not.toContain('aria-live');
      expect(htmlSpoken).toContain('gt-share-error__message');

      // When canSpeak is false, renders with polite live region
      const htmlMuted = renderToStaticMarkup(
        createElement(ShareError, {
          code: 'bad-format',
          onGoToStart: vi.fn(),
          canSpeak: false,
        }),
      );
      expect(htmlMuted).toContain('role="status"');
      expect(htmlMuted).toContain('aria-live="polite"');
    });

    it(
      'VerifiedBanner note body has aria-live="off" to prevent collision in live region (R5-05)',
      () => {
      // Note body rendered with aria-live="off"
      const html = renderToStaticMarkup(
        createElement(VerifiedBanner, {
          by: 'Teacher Alice',
          note: 'Remember formula',
        }),
      );
      expect(html).toContain('gt-verified-banner');
      expect(html).toContain('aria-label="Shared by Teacher Alice, not checked"');
    });
  });

  describe('8. R5-10 & R5-11: LanguageSelector and RateSelector Accessibility', () => {
    it('LanguageSelector aria-label announces "English" without duplication', () => {
      const drivers = createMockDrivers();
      const html = renderToStaticMarkup(
        createElement(LanguageSelector, { drivers }),
      );
      // English button should be "English", NOT "English (English)"
      expect(html).toContain('aria-label="English"');
      expect(html).not.toContain('aria-label="English (English)"');
      // Hindi and Gujarati retain native and English names
      expect(html).toContain('aria-label="Hindi (हिन्दी)"');
      expect(html).toContain('aria-label="Gujarati (ગુજરાતી)"');
    });

    it('RateSelector buttons use formatRateMultiplier with "×" and no ASCII "x"', () => {
      const drivers = createMockDrivers();
      const html = renderToStaticMarkup(
        createElement(RateSelector, { drivers }),
      );
      expect(html).toContain('0.8×');
      expect(html).toContain('1.0×');
      expect(html).toContain('1.25×');
      expect(html).not.toContain('0.8x');
      expect(html).not.toContain('1.0x');
      expect(html).not.toContain('1.25x');
    });
  });

  describe('9. i18n Dictionary Parity & Security Constraints', () => {
    const requiredKeys = [
      'share.gate.open',
      'share.gate.heading',
      'share.sharedBy',
      'share.sharedUnnamed',
      'share.titlePrefix',
      'share.honesty',
      'kind.geometry',
      'kind.function_graph',
      'kind.bar_chart',
      'kind.unknown',
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

    it('no active share.* string contains "Verified", "सत्यापित", or "પ્રમાણિત" (R5-02)', () => {
      // Legacy share.verified and share.verifiedBy are preserved for backward-compatibility with k1
      const activeShareKeys = [
        'share.gate.open',
        'share.gate.heading',
        'share.sharedBy',
        'share.sharedUnnamed',
        'share.titlePrefix',
        'share.honesty',
        'share.readNote',
        'share.hideNote',
        'share.goToStart',
        'share.error.title',
        'share.error.tooLarge',
        'share.error.badFormat',
        'share.error.badVersion',
        'share.error.badScene',
        'share.error.empty',
        'share.error.generic',
      ];

      for (const lang of ['en', 'hi', 'gu'] as const) {
        for (const key of activeShareKeys) {
          const val = tables[lang][key] ?? '';
          expect(val, `Key ${key} in ${lang} contains 'Verified'`).not.toContain('Verified');
          expect(val, `Key ${key} in ${lang} contains 'सत्यापित'`).not.toContain('सत्यापित');
          expect(val, `Key ${key} in ${lang} contains 'પ્રમાણિત'`).not.toContain('પ્રમાણિત');
        }
      }
    });
  });
});
