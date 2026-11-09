/**
 * Tests for Lane k8-i18n (Internationalisation fixes):
 * - B3-02: speak(...) calls explicitly pass active language tag (start.ts, Capture.tsx).
 * - B3-03: guide semantic labels ('peak', 'lowest point', 'origin') come from i18n keys.
 * - B3-10: replace {index}/{total} fraction slash in Hindi and Gujarati corner announcements.
 * - Key and placeholder parity across en, hi, and gu.
 * - No hardcoded English speak strings in touched files.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { handleStartTap, speakIntro } from '../src/flow/start';
import { resolveSemantic } from '../src/guide/semantic';
import { setLang, tables, t, type Lang } from '../src/i18n';
import captureSource from '../src/screens/Capture.tsx?raw';
import startSource from '../src/flow/start.ts?raw';

function createMockDrivers(): {
  drivers: Drivers;
  spoken: Array<{ text: string; lang?: string }>;
} {
  const spoken: Array<{ text: string; lang?: string }> = [];

  const drivers: Drivers = {
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
    speech: {
      speak: vi.fn((text: string, lang?: string) => {
        spoken.push({ text, lang });
      }),
      listen: vi.fn().mockResolvedValue(''),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  };

  return { drivers, spoken };
}

const mockSineScene: DiagramScene = {
  version: 1,
  kind: 'function_graph',
  polylines: [
    {
      id: 'sine_curve',
      points: [
        [0.1, 0.5],
        [0.3, 0.2], // Peak at y = 0.2
        [0.5, 0.5],
        [0.7, 0.8], // Trough at y = 0.8
        [0.9, 0.5],
      ],
    },
  ],
  axes: {
    x_axis_y: 0.5,
    y_axis_x: 0.1,
  },
};

describe('Lane k8-i18n: Internationalisation Fixes', () => {
  afterEach(() => {
    setLang('en');
  });

  describe('B3-02: speakIntro and handleStartTap pass active language tag', () => {
    it('speakIntro passes active BCP-47 tag in Hindi (hi-IN)', () => {
      setLang('hi');
      const { drivers, spoken } = createMockDrivers();
      speakIntro(drivers);

      expect(spoken.length).toBe(1);
      expect(spoken[0]?.lang).toBe('hi-IN');
      expect(spoken[0]?.text).toBe('घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें।');
    });

    it('speakIntro passes active BCP-47 tag in Gujarati (gu-IN)', () => {
      setLang('gu');
      const { drivers, spoken } = createMockDrivers();
      speakIntro(drivers);

      expect(spoken.length).toBe(1);
      expect(spoken[0]?.lang).toBe('gu-IN');
      expect(spoken[0]?.text).toBe('ગોસ્ટ ટચ. શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો.');
    });

    it('speakIntro passes default BCP-47 tag in English (en-IN)', () => {
      setLang('en');
      const { drivers, spoken } = createMockDrivers();
      speakIntro(drivers);

      expect(spoken.length).toBe(1);
      expect(spoken[0]?.lang).toBe('en-IN');
      expect(spoken[0]?.text).toBe('Ghost Touch. Tap anywhere to begin.');
    });

    it('handleStartTap passes active BCP-47 tag in Hindi (hi-IN)', () => {
      setLang('hi');
      const { drivers, spoken } = createMockDrivers();
      handleStartTap(drivers);

      expect(spoken.length).toBe(1);
      expect(spoken[0]?.lang).toBe('hi-IN');
      expect(spoken[0]?.text).toContain('फोटो लें');
    });

    it('handleStartTap passes active BCP-47 tag in Gujarati (gu-IN)', () => {
      setLang('gu');
      const { drivers, spoken } = createMockDrivers();
      handleStartTap(drivers);

      expect(spoken.length).toBe(1);
      expect(spoken[0]?.lang).toBe('gu-IN');
      expect(spoken[0]?.text).toContain('ફોટો લો');
    });

    it('verifies start.ts and Capture.tsx do not call speak without lang parameter', () => {
      // In start.ts, all speak calls pass the language parameter (no 1-argument speak calls)
      expect(startSource).not.toMatch(/drivers\.speech\.speak\s*\([^,]+?\)\s*;/);
      expect(startSource).toContain('drivers.speech.speak(t(\'start.intro\'), lang)');

      // In Capture.tsx, say helper explicitly passes LANG_BCP47[getLang()]
      expect(captureSource).not.toMatch(/drivers\.speech\.speak\s*\([^,]+?\)\s*;/);
      expect(captureSource).toContain('drivers.speech.speak(text, LANG_BCP47[getLang()]);');
    });
  });

  describe('B3-03: Semantic guide target labels localized across en, hi, and gu', () => {
    it('resolves English labels for peak, trough, and origin by default', () => {
      setLang('en');
      const peak = resolveSemantic(mockSineScene, 'peak');
      expect(peak?.label).toBe('peak');

      const trough = resolveSemantic(mockSineScene, 'trough');
      expect(trough?.label).toBe('lowest point');

      const origin = resolveSemantic(mockSineScene, 'origin');
      expect(origin?.label).toBe('origin');
    });

    it('resolves Hindi labels for peak, trough, and origin when active language is hi', () => {
      setLang('hi');
      const peak = resolveSemantic(mockSineScene, 'peak');
      expect(peak?.label).toBe('शिखर');

      const trough = resolveSemantic(mockSineScene, 'trough');
      expect(trough?.label).toBe('न्यूनतम बिंदु');

      const origin = resolveSemantic(mockSineScene, 'origin');
      expect(origin?.label).toBe('मूल बिंदु');
    });

    it('resolves Gujarati labels for peak, trough, and origin when active language is gu', () => {
      setLang('gu');
      const peak = resolveSemantic(mockSineScene, 'peak');
      expect(peak?.label).toBe('શિખર');

      const trough = resolveSemantic(mockSineScene, 'trough');
      expect(trough?.label).toBe('સૌથી નીચું બિંદુ');

      const origin = resolveSemantic(mockSineScene, 'origin');
      expect(origin?.label).toBe('ઉદ્ભવ બિંદુ');
    });

    it('interpolates localized label into guide.start without mixing English words', () => {
      setLang('hi');
      const peak = resolveSemantic(mockSineScene, 'peak');
      expect(peak).not.toBeNull();
      const startAnnouncement = t('guide.start').replace('{label}', peak?.label ?? '');
      expect(startAnnouncement).toBe('शिखर का मार्गदर्शन कर रहे हैं।');
      expect(startAnnouncement).not.toContain('peak');

      setLang('gu');
      const guPeak = resolveSemantic(mockSineScene, 'peak');
      expect(guPeak).not.toBeNull();
      const guStartAnnouncement = t('guide.start').replace('{label}', guPeak?.label ?? '');
      expect(guStartAnnouncement).toContain('શિખર');
      expect(guStartAnnouncement).not.toContain('peak');
    });
  });

  describe('B3-10: Conversational phrasing in corner announcements replacing fraction slash', () => {
    it('Hindi corner announcement uses natural "3 में से 1" phrasing without slash', () => {
      setLang('hi');
      const raw = t('commands.cornerAnnounce');
      expect(raw).not.toContain('/');
      expect(raw).toContain('{total} में से {index}');
      expect(raw).toContain('{label}');
      expect(raw).toContain('{pos}');

      const formatted = raw
        .replace('{index}', '1')
        .replace('{total}', '3')
        .replace('{label}', 'A')
        .replace('{pos}', 'केंद्र');

      expect(formatted).not.toContain('1/3');
      expect(formatted).toContain('3 में से 1');
      expect(formatted).toBe('कोना 3 में से 1: बिंदु A, स्थिति केंद्र।');
    });

    it('Gujarati corner announcement uses natural "3 માંથી 1" phrasing without slash', () => {
      setLang('gu');
      const raw = t('commands.cornerAnnounce');
      expect(raw).not.toContain('/');
      expect(raw).toContain('{total} માંથી {index}');
      expect(raw).toContain('{label}');
      expect(raw).toContain('{pos}');

      const formatted = raw
        .replace('{index}', '1')
        .replace('{total}', '3')
        .replace('{label}', 'A')
        .replace('{pos}', 'કેન્દ્ર');

      expect(formatted).not.toContain('1/3');
      expect(formatted).toContain('3 માંથી 1');
      expect(formatted).toBe('ખૂણો 3 માંથી 1: બિંદુ A, સ્થાન કેન્દ્ર.');
    });

    it('English corner announcement preserves standard ordinal format', () => {
      setLang('en');
      const raw = t('commands.cornerAnnounce');
      expect(raw).not.toContain('/');
      expect(raw).toBe('Corner {index} of {total}: Point {label} at {pos}.');
    });
  });

  describe('Dictionary Parity and Placeholder Integrity', () => {
    const langs: readonly Lang[] = ['en', 'hi', 'gu'] as const;

    it('has identical key count across en, hi, and gu tables', () => {
      const enKeys = Object.keys(tables.en).sort();
      const hiKeys = Object.keys(tables.hi).sort();
      const guKeys = Object.keys(tables.gu).sort();

      expect(hiKeys.length).toBe(enKeys.length);
      expect(guKeys.length).toBe(enKeys.length);

      const missingInHi = enKeys.filter((k) => !(k in tables.hi));
      const missingInGu = enKeys.filter((k) => !(k in tables.gu));
      expect(missingInHi).toEqual([]);
      expect(missingInGu).toEqual([]);
    });

    it('maintains exact placeholder token parity across all three languages', () => {
      const extractTokens = (str: string): string[] => {
        const matches = str.match(/\{[a-zA-Z0-9_]+\}/g);
        return matches ? matches.sort() : [];
      };

      for (const key of Object.keys(tables.en)) {
        const enTokens = extractTokens(tables.en[key] ?? '');
        const hiTokens = extractTokens(tables.hi[key] ?? '');
        const guTokens = extractTokens(tables.gu[key] ?? '');

        expect(hiTokens).toEqual(enTokens);
        expect(guTokens).toEqual(enTokens);
      }
    });

    it('defines new semantic label keys in all three language tables', () => {
      for (const lang of langs) {
        expect(tables[lang]['guide.semantic.label.peak']).toBeDefined();
        expect(tables[lang]['guide.semantic.label.trough']).toBeDefined();
        expect(tables[lang]['guide.semantic.label.origin']).toBeDefined();
      }
    });

    it('verifies Gujarati neuter gender agreement in guide.semantic.none.trough', () => {
      expect(tables.gu['guide.semantic.none.trough']).toBe('આ આકૃતિમાં કોઈ સૌથી નીચું બિંદુ નથી.');
      expect(tables.gu['guide.semantic.none.trough']).not.toContain('નીચો');
    });
  });
});
