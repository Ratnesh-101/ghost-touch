// @vitest-environment jsdom
/**
 * Comprehensive verification test suite for Lane q2-frontend-round5:
 *
 * 1. (HIGH, kiro-glue #1) screens/Explore.tsx: Mid-session language switch updates
 *    status text and repeat-speech to current language; repeating speech uses current
 *    language tag (render with en, switch to hi, assert status & spoken are Hindi).
 * 2. (HIGH, kiro-glue #2) flow/ask.ts caveatForQuestion: uses caller's language
 *    (deps.lang) rather than global UI language so hi/gu queries receive hi/gu caveat.
 * 3. (MED, kiro-glue #4) flow/ask.ts caveatForQuestion: matches 3-letter vertex codes
 *    ("ADC"), single-letter vertex queries ("D", "angle at D"), and ignores unrelated vertex.
 * 4. (R5-12 and App.tsx, ShareError) ShareError single-speech enforcement:
 *    speakShareAnnouncements only speaks when canSpeak is true; ShareError mounts alert
 *    only when speech cannot speak; exactly one announcement fires.
 * 5. (R5-12) resolveShareRoute defaults honest to true when options omitted or empty,
 *    never claiming verified wording if flag is missing.
 */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import type { VerifyFinding } from '../src/core/verify';
import {
  MemoryDiagramStore,
  type Drivers,
  type SpeechRateSetting,
} from '../src/drivers';
import { exploreAnnouncement } from '../src/flow/navigation';
import { caveatForQuestion, AskManager } from '../src/flow/ask';
import { Explore } from '../src/screens/Explore';
import { ShareError, shareErrorMessage } from '../src/screens/ShareError';
import { encodeShare, type SharePayload } from '../src/share';
import { getLang, setLang, type Lang } from '../src/i18n';

// Mock Capture and PDF driver modules so App-level imports do not load pdfjs worker URL in jsdom
vi.mock('../src/screens/Capture', () => ({
  Capture: () => null,
}));

vi.mock('../src/drivers/pdf', () => ({
  PdfError: class PdfError extends Error {
    readonly reason: string;
    constructor(reason: string, message?: string) {
      super(message ?? `PDF error: ${reason}`);
      this.name = 'PdfError';
      this.reason = reason;
    }
  },
  defaultPdfLoader: vi.fn(async () => ({})),
  renderFirstPage: vi.fn(async () => new Blob()),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '',
}));

let resolveShareRoute!: typeof import('../src/App').resolveShareRoute;
let speakShareAnnouncements!: typeof import('../src/App').speakShareAnnouncements;

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
  facts: [
    'angle C = 45 degrees',
    'AC = 4 cm',
    'BC = 3 cm',
    'AB = 5 cm',
  ],
};

function createMockDrivers(overrides?: {
  canSpeak?: boolean;
}): Drivers & {
  spokenUtterances: Array<{ text: string; lang?: string }>;
} {
  const spokenUtterances: Array<{ text: string; lang?: string }> = [];
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn((text: string, lang?: string) => {
        spokenUtterances.push({ text, lang });
      }),
      listen: vi.fn().mockResolvedValue('repeat'),
      canSpeak: overrides?.canSpeak ?? true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
    spokenUtterances,
  };
}

describe('Lane q2-frontend-round5 Verification Suite', () => {
  let prevLang: Lang;

  beforeAll(async () => {
    const app = await import('../src/App');
    resolveShareRoute = app.resolveShareRoute;
    speakShareAnnouncements = app.speakShareAnnouncements;
  });

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  describe('1. Explore.tsx Mid-Session Language Switch', () => {
    it('rebuilds status text and speaks repeat in current language (en -> hi)', async () => {
      const drivers = createMockDrivers();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      const initialEnAnnouncement = exploreAnnouncement(testTriangleScene, 'ai');
      expect(initialEnAnnouncement).toContain('Right Triangle ABC');
      expect(initialEnAnnouncement).toContain('Double-tap and hold');

      await act(async () => {
        root.render(
          createElement(Explore, {
            scene: testTriangleScene,
            announced: initialEnAnnouncement,
            drivers,
            onBack: vi.fn(),
          }),
        );
      });

      // 1. Initial status card text is in English
      const statusEl = container.querySelector('.gt-explore__status');
      expect(statusEl).not.toBeNull();
      expect(statusEl?.textContent).toContain('Right Triangle ABC');
      expect(statusEl?.textContent).toContain('Double-tap and hold');

      // 2. Switch language to Hindi mid-session
      await act(async () => {
        setLang('hi');
      });

      // Status text must be dynamically rebuilt in Hindi
      expect(statusEl?.textContent).toContain('Right Triangle ABC');
      expect(statusEl?.textContent).toContain('डबल-टैप करके दबाए रखें');
      expect(statusEl?.textContent).toContain('तथ्य और चित्र');
      expect(statusEl?.textContent).not.toContain('Double-tap and hold');
      expect(statusEl?.textContent).not.toContain('Facts and drawing disagree');

      // 3. Trigger voice repeat command ("repeat" / "दोहराएं") via Ask button
      drivers.speech.listen = vi.fn().mockResolvedValue('repeat');
      const askButton = container.querySelector<HTMLButtonElement>('.gt-explore__ask');
      expect(askButton).not.toBeNull();

      await act(async () => {
        askButton?.click();
      });

      // Spoken text must be the Hindi announcement, using Hindi BCP-47 language tag
      const lastSpoken = drivers.spokenUtterances[drivers.spokenUtterances.length - 1];
      expect(lastSpoken).toBeDefined();
      expect(lastSpoken?.lang).toBe('hi-IN');
      expect(lastSpoken?.text).toContain('डबल-टैप करके दबाए रखें');
      expect(lastSpoken?.text).toContain('तथ्य और चित्र');
      expect(lastSpoken?.text).not.toContain('Double-tap and hold');
      expect(lastSpoken?.text).not.toContain('Facts and drawing disagree');

      // Cleanup
      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('2. caveatForQuestion: Caller Language Disconnection Fix', () => {
    const angleFinding: VerifyFinding = {
      angleVertex: 'C',
      message: "Facts and drawing disagree on angle C. I can't tell which is right.",
    };

    it('uses caller lang for Hindi and Gujarati caveat when UI is English', () => {
      setLang('en');
      expect(getLang()).toBe('en');

      // Caller passes Hindi tag
      const hiCaveat = caveatForQuestion([angleFinding], 'what is angle C', 'hi-IN');
      expect(hiCaveat).not.toBeNull();
      expect(hiCaveat).toContain('तथ्य और चित्र कोण C पर असहमत हैं।');
      expect(hiCaveat).not.toContain('Facts and drawing disagree');
      expect(hiCaveat).not.toContain('angle C');

      // Caller passes Gujarati tag
      const guCaveat = caveatForQuestion([angleFinding], 'what is angle C', 'gu-IN');
      expect(guCaveat).not.toBeNull();
      expect(guCaveat).toContain('તથ્યો અને આકૃતિ ખૂણા C પર અસંમત છે.');
      expect(guCaveat).not.toContain('Facts and drawing disagree');
      expect(guCaveat).not.toContain('angle C');
    });

    it('falls back to global UI language when caller passes no lang', () => {
      setLang('en');
      const enCaveat = caveatForQuestion([angleFinding], 'what is angle C');
      expect(enCaveat).toBe("Facts and drawing disagree on angle C. I can't tell which is right.");

      setLang('hi');
      const hiFallback = caveatForQuestion([angleFinding], 'what is angle C');
      expect(hiFallback).toContain('तथ्य और चित्र कोण C पर असहमत हैं।');
    });

    it('AskManager.submitTextAsk attaches caveat matching deps.lang', async () => {
      setLang('en');
      const manager = new AskManager();
      const spokenLines: string[] = [];
      const drivers = createMockDrivers();

      const mockRequest = vi.fn(async () => ({
        answer: 'कोण C का मान 45 अंश है।',
        source: 'facts' as const,
      }));

      await manager.submitTextAsk('What is angle C?', {
        audio: drivers.audio,
        speech: drivers.speech,
        scene: testTriangleScene,
        lang: 'hi-IN',
        say: (text: string) => spokenLines.push(text),
        request: mockRequest,
      });

      const finalAnswer = spokenLines[spokenLines.length - 1];
      expect(finalAnswer).toBeDefined();
      expect(finalAnswer).toContain('तथ्य और चित्र कोण C पर असहमत हैं।');
      expect(finalAnswer).toContain('कोण C का मान 45 अंश है।');
      expect(finalAnswer).not.toContain('Facts and drawing disagree');
    });
  });

  describe('3. caveatForQuestion: 3-Letter Vertex & Single-Letter Vertex Matching', () => {
    const findingADC: VerifyFinding = {
      angleVertex: 'ADC',
      message: "Facts and drawing disagree on angle ADC. I can't tell which is right.",
    };

    const expectedCaveat =
      "Facts and drawing disagree on angle ADC. I can't tell which is right.";

    it('matches questions naming 3-letter vertex "ADC"', () => {
      const caveat = caveatForQuestion([findingADC], 'What is angle ADC?', 'en-IN');
      expect(caveat).toBe(expectedCaveat);
    });

    it('matches questions naming single-letter vertex "D" or "angle at D"', () => {
      const caveatD = caveatForQuestion([findingADC], 'What is angle D?', 'en-IN');
      expect(caveatD).toBe(expectedCaveat);

      const caveatAtD = caveatForQuestion([findingADC], 'Tell me the angle at D', 'en-IN');
      expect(caveatAtD).toBe(expectedCaveat);
    });

    it('does not match questions naming an unrelated vertex or segment', () => {
      const caveatB = caveatForQuestion([findingADC], 'What is angle B?', 'en-IN');
      expect(caveatB).toBeNull();

      const caveatSeg = caveatForQuestion([findingADC], 'What is the length of AC?', 'en-IN');
      expect(caveatSeg).toBeNull();
    });
  });

  describe('4. ShareError Double Speech Prevention (App.tsx & ShareError.tsx)', () => {
    const errorResolution = {
      kind: 'error' as const,
      code: 'bad-format' as const,
      errorMessage: shareErrorMessage('bad-format'),
    };

    it('speakShareAnnouncements speaks once when canSpeak is true, 0 times when false', () => {
      // canSpeak = true
      const driversCanSpeak = createMockDrivers({ canSpeak: true });
      speakShareAnnouncements(driversCanSpeak.speech, errorResolution, 'en-IN');
      expect(driversCanSpeak.speech.speak).toHaveBeenCalledTimes(1);
      expect(driversCanSpeak.speech.speak).toHaveBeenCalledWith(
        errorResolution.errorMessage,
        'en-IN',
      );

      // canSpeak = false
      const driversMuted = createMockDrivers({ canSpeak: false });
      speakShareAnnouncements(driversMuted.speech, errorResolution, 'en-IN');
      expect(driversMuted.speech.speak).not.toHaveBeenCalled();
    });

    it('ShareError renders alert only when canSpeak is false, plain text when true', () => {
      // canSpeak = true: Web Speech speaks, so DOM live region / alert is omitted
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
      expect(htmlSpoken).toContain(shareErrorMessage('bad-format'));

      // canSpeak = false: Web Speech cannot speak, so alert live region fires
      const htmlMuted = renderToStaticMarkup(
        createElement(ShareError, {
          code: 'bad-format',
          onGoToStart: vi.fn(),
          canSpeak: false,
        }),
      );
      expect(htmlMuted).toContain('role="alert"');
      expect(htmlMuted).toContain(shareErrorMessage('bad-format'));
    });
  });

  describe('5. resolveShareRoute Honest Default Enforcement', () => {
    const payload: SharePayload = {
      v: 1,
      scene: testTriangleScene,
      verifiedBy: 'Mrs. Sharma',
      note: 'Class note',
      verifiedAt: '2026-11-10T00:00:00Z',
    };
    const hash = `#s=${encodeShare(payload)}`;

    it('defaults honest to true when options argument is omitted', () => {
      const res = resolveShareRoute(hash, true);
      expect(res.kind).toBe('explore');
      if (res.kind === 'explore') {
        expect(res.verifiedAnnouncement).toBe('Shared by Mrs. Sharma, not checked');
        expect(res.verifiedAnnouncement).not.toContain('Verified');
        expect(res.spokenAnnouncement).toContain('Shared by Mrs. Sharma, not checked');
        expect(res.spokenAnnouncement).not.toContain('Verified by');
      }
    });

    it('defaults honest to true when options object is empty {}', () => {
      const res = resolveShareRoute(hash, true, {});
      expect(res.kind).toBe('explore');
      if (res.kind === 'explore') {
        expect(res.verifiedAnnouncement).toBe('Shared by Mrs. Sharma, not checked');
        expect(res.verifiedAnnouncement).not.toContain('Verified');
      }
    });

    it('returns legacy announcement only when honest: false is explicitly set', () => {
      const res = resolveShareRoute(hash, true, { honest: false });
      expect(res.kind).toBe('explore');
      if (res.kind === 'explore') {
        expect(res.verifiedAnnouncement).toBe('Verified by Mrs. Sharma');
      }
    });
  });
});
