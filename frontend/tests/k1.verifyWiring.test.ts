import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { exploreAnnouncement } from '../src/flow/navigation';
import {
  AskManager,
  caveatForQuestion,
  type AskDeps,
} from '../src/flow/ask';
import type { VerifyFinding } from '../src/verify/verify';
import {
  resolveShareRoute,
  speakShareAnnouncements,
} from '../src/App';
import { encodeShare, type SharePayload } from '../src/share';
import { SHARE_HASH_PREFIX } from '../src/drivers/hashRoute';
import { getLang, setLang, tables, t, type Lang } from '../src/i18n';
import type { AudioDriver, SpeechDriver } from '../src/drivers';
import type { AskResponse } from '../src/api/ask';

/**
 * Honest right triangle matching frontend/public/samples/triangle.json:
 * Points: A(0.25, 0.25), B(0.7, 0.85), C(0.25, 0.85).
 * Geometry: right angle at C, CA = 0.60, BC = 0.45, AB = 0.75 (4:3:5).
 * Facts: "angle C = 90 degrees", "AC = 4 cm", "BC = 3 cm", "AB = 5 cm".
 */
const honestTriangleScene: DiagramScene = {
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

/**
 * Forged right triangle with AC = 7 cm replacing AC = 4 cm.
 */
const forgedTriangleScene: DiagramScene = {
  ...honestTriangleScene,
  facts: [
    'angle C = 90 degrees',
    'AC = 7 cm',
    'BC = 3 cm',
    'AB = 5 cm',
  ],
};

function createMockAudioDriver(): AudioDriver {
  return {
    unlock: vi.fn(),
    setTone: vi.fn(),
    setGuideTone: vi.fn(),
    beep: vi.fn(),
    playEarcon: vi.fn(),
    state: 'running',
  };
}

interface MockSpeechDriver extends SpeechDriver {
  spokenUtterances: string[];
}

function createMockSpeechDriver(listenText: string = 'What is the length of AC?'): MockSpeechDriver {
  const spokenUtterances: string[] = [];
  return {
    canSpeak: true,
    canListen: true,
    spokenUtterances,
    speak: vi.fn((text: string) => {
      spokenUtterances.push(text);
    }),
    listen: vi.fn().mockResolvedValue(listenText),
    stopSpeaking: vi.fn(),
    cancelListen: vi.fn(),
    getRate: vi.fn().mockReturnValue('normal'),
    setRate: vi.fn(),
    getLastSpoken: vi.fn(() => spokenUtterances[spokenUtterances.length - 1] ?? ''),
  };
}

describe('K1 Verify Wiring — SPEC GHOST (Lane k1-verify-wiring)', () => {
  let initialLang: Lang;

  beforeEach(() => {
    initialLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(initialLang);
  });

  describe('1. i18n Keys & SPEC GHOST Consistency Constraints', () => {
    it('defines verify.disagree in en, hi, and gu tables with {name} placeholder', () => {
      const enText = tables.en['verify.disagree'];
      const hiText = tables.hi['verify.disagree'];
      const guText = tables.gu['verify.disagree'];

      expect(enText).toBeDefined();
      expect(hiText).toBeDefined();
      expect(guText).toBeDefined();

      expect(enText).toContain('{name}');
      expect(hiText).toContain('{name}');
      expect(guText).toContain('{name}');

      expect(enText).toBe("Facts and drawing disagree on {name}. I can't tell which is right.");
    });

    it('NEVER contains "verified" or "trust the text" in any language key added', () => {
      const keysToCheck = ['verify.disagree'];

      for (const k of keysToCheck) {
        const enStr = tables.en[k] ?? '';
        const hiStr = tables.hi[k] ?? '';
        const guStr = tables.gu[k] ?? '';

        for (const str of [enStr, hiStr, guStr]) {
          expect(str.toLowerCase()).not.toContain('verified');
          expect(str.toLowerCase()).not.toContain('trust the text');
        }

        // Check Indic roots for verified and trust the text
        expect(hiStr).not.toMatch(/सत्यापित/);
        expect(hiStr).not.toMatch(/भरोसा/);
        expect(guStr).not.toMatch(/પ્રમાણિત/);
        expect(guStr).not.toMatch(/વિશ્વાસ/);
      }
    });
  });

  describe('2. Explore Entry Announcement (exploreAnnouncement)', () => {
    it('does NOT append caveat for honest sample triangle', () => {
      const announcement = exploreAnnouncement(honestTriangleScene, 'sample');
      expect(announcement).not.toContain("Facts and drawing disagree");
      expect(announcement).toBe(
        'Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave.',
      );
    });

    it('appends caveat for forged triangle fact ("AC = 7 cm")', () => {
      const announcement = exploreAnnouncement(forgedTriangleScene, 'sample');
      expect(announcement).toContain("Facts and drawing disagree on AC. I can't tell which is right.");
      expect(announcement).toBe(
        "Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave. Facts and drawing disagree on AC. I can't tell which is right.",
      );
    });

    it('appends caveat in AI mode and Raw mode', () => {
      const aiAnnounce = exploreAnnouncement(forgedTriangleScene, 'ai');
      expect(aiAnnounce).toContain("Facts and drawing disagree on AC. I can't tell which is right.");

      const rawAnnounce = exploreAnnouncement(forgedTriangleScene, 'raw');
      expect(rawAnnounce).toContain(t('raw.announce'));
      expect(rawAnnounce).toContain("Facts and drawing disagree on AC. I can't tell which is right.");
    });

    it('joins announcement and caveat into a single clean utterance via joinAnnouncements', () => {
      const announcement = exploreAnnouncement(forgedTriangleScene, 'sample');
      // No double full stop
      expect(announcement).not.toContain('..');
      expect(announcement.endsWith('.')).toBe(true);
      // Exactly ONE sentence appended
      const occurrences = (announcement.match(/Facts and drawing disagree/g) || []).length;
      expect(occurrences).toBe(1);
    });

    it('stays silent and adds NOTHING extra when facts state "not to scale"', () => {
      const notToScaleScene: DiagramScene = {
        ...forgedTriangleScene,
        facts: [...(forgedTriangleScene.facts ?? []), 'figure not to scale'],
      };
      const announcement = exploreAnnouncement(notToScaleScene, 'sample');
      expect(announcement).not.toContain("Facts and drawing disagree");
      expect(announcement).toBe(
        'Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave.',
      );
    });

    it('localises caveat in Hindi and Gujarati', () => {
      setLang('hi');
      const hiAnnounce = exploreAnnouncement(forgedTriangleScene, 'sample');
      expect(hiAnnounce).toContain('तथ्य और चित्र AC पर असहमत हैं। मैं नहीं बता सकता कि कौन सा सही है।');

      setLang('gu');
      const guAnnounce = exploreAnnouncement(forgedTriangleScene, 'sample');
      expect(guAnnounce).toContain('તથ્યો અને આકૃતિ AC પર અસંમત છે. હું કહી શકતો નથી કે કયું સાચું છે.');
    });
  });

  describe('3. Shared-Link Scenes (resolveShareRoute & speakShareAnnouncements)', () => {
    it('honest shared scene has NO caveat in route resolution or speech', () => {
      const payload: SharePayload = {
        v: 1,
        scene: honestTriangleScene,
        verifiedBy: 'Teacher Alice',
        note: '',
        verifiedAt: '2026-11-09T08:00:00Z',
      };
      const hash = `${SHARE_HASH_PREFIX}${encodeShare(payload)}`;
      const resolution = resolveShareRoute(hash, true);

      expect(resolution.kind).toBe('explore');
      if (resolution.kind === 'explore') {
        expect(resolution.sceneAnnouncement).not.toContain('Facts and drawing disagree');
        const expectedTitle = t('share.titlePrefix').replace(
          '{title}',
          honestTriangleScene.title!,
        );
        const expectedHonest = t('share.sharedBy').replace('{name}', 'Teacher Alice');
        const expectedScene = [
          `${expectedTitle}. Double-tap and hold, then drag to feel the diagram.`,
          `You start at the centre. Press Back to leave.`,
        ].join(' ');
        expect(resolution.sceneAnnouncement).toBe(expectedScene);
        const expectedSpoken = [
          `${expectedTitle}. Double-tap and hold, then drag to feel the diagram.`,
          `You start at the centre. Press Back to leave.`,
          `${expectedHonest}. ${t('share.honesty')}`,
        ].join(' ');
        expect(resolution.spokenAnnouncement).toBe(expectedSpoken);

        const speech = createMockSpeechDriver();
        speakShareAnnouncements(speech, resolution, 'en-IN');
        expect(speech.speak).toHaveBeenCalledTimes(1);
        expect(speech.spokenUtterances[0]).toBe(resolution.spokenAnnouncement);
      }
    });

    it(
      'forged shared scene ("AC = 7 cm") gets the caveat joined ' +
        'with verified line in ONE utterance',
      () => {
        const payload: SharePayload = {
          v: 1,
          scene: forgedTriangleScene,
          verifiedBy: 'Teacher Bob',
          note: 'Check the hypotenuse',
          verifiedAt: '2026-11-09T08:00:00Z',
        };
        const hash = `${SHARE_HASH_PREFIX}${encodeShare(payload)}`;
        const resolution = resolveShareRoute(hash, true);

        expect(resolution.kind).toBe('explore');
        if (resolution.kind === 'explore') {
          expect(resolution.sceneAnnouncement).toContain(
            "Facts and drawing disagree on AC. I can't tell which is right.",
          );
          const expectedTitle = t('share.titlePrefix').replace(
            '{title}',
            forgedTriangleScene.title!,
          );
          const expectedHonest = t('share.sharedBy').replace('{name}', 'Teacher Bob');
          const expectedScene = [
            `${expectedTitle}. Double-tap and hold, then drag to feel the diagram.`,
            `You start at the centre. Press Back to leave.`,
            `Facts and drawing disagree on AC. I can't tell which is right.`,
          ].join(' ');
          expect(resolution.sceneAnnouncement).toBe(expectedScene);
          const expectedSpoken = [
            `${expectedTitle}. Double-tap and hold, then drag to feel the diagram.`,
            `You start at the centre. Press Back to leave.`,
            `Facts and drawing disagree on AC. I can't tell which is right.`,
            `${expectedHonest}. ${t('share.honesty')}`,
          ].join(' ');
          expect(resolution.spokenAnnouncement).toBe(expectedSpoken);

          const speech = createMockSpeechDriver();
          speakShareAnnouncements(speech, resolution, 'en-IN');
          // Critical Requirement: EXACTLY ONE speak call (never a second speak)
          expect(speech.speak).toHaveBeenCalledTimes(1);
          expect(speech.spokenUtterances[0]).toBe(resolution.spokenAnnouncement);
        }
      },
    );
  });

  describe('4. Ask Flow Pure Helper (caveatForQuestion)', () => {
    const findings: VerifyFinding[] = [
      {
        segmentId: 'CA',
        message: "Facts and drawing disagree on AC. I can't tell which is right.",
      },
    ];

    it('matches question naming the disputed segment "AC"', () => {
      const caveat = caveatForQuestion(findings, 'What is the length of AC?');
      expect(caveat).toBe("Facts and drawing disagree on AC. I can't tell which is right.");
    });

    it('matches reversed id "CA"', () => {
      const caveat = caveatForQuestion(findings, 'How long is side CA?');
      expect(caveat).toBe("Facts and drawing disagree on AC. I can't tell which is right.");
    });

    it('matches case-insensitively', () => {
      const caveat1 = caveatForQuestion(findings, 'what is ac?');
      expect(caveat1).toBe("Facts and drawing disagree on AC. I can't tell which is right.");

      const caveat2 = caveatForQuestion(findings, 'tell me about Ca');
      expect(caveat2).toBe("Facts and drawing disagree on AC. I can't tell which is right.");
    });

    it('returns null for questions about other segments (BC, AB)', () => {
      expect(caveatForQuestion(findings, 'What is the length of BC?')).toBeNull();
      expect(caveatForQuestion(findings, 'How long is side AB?')).toBeNull();
      expect(caveatForQuestion(findings, 'What is the angle at C?')).toBeNull();
    });

    it('returns null for general questions with no segment named', () => {
      expect(caveatForQuestion(findings, 'What diagram is this?')).toBeNull();
      expect(caveatForQuestion(findings, 'Tell me about the triangle')).toBeNull();
    });

    it('does not falsely match substrings of longer words', () => {
      expect(caveatForQuestion(findings, 'What is the action plan?')).toBeNull();
      expect(caveatForQuestion(findings, 'Is this a cable?')).toBeNull();
      expect(caveatForQuestion(findings, 'Go back to the start')).toBeNull();
    });

    it('returns localized caveat in Hindi and Gujarati', () => {
      setLang('hi');
      const hiCaveat = caveatForQuestion(findings, 'AC की लंबाई क्या है?');
      expect(hiCaveat).toBe('तथ्य और चित्र AC पर असहमत हैं। मैं नहीं बता सकता कि कौन सा सही है।');

      setLang('gu');
      const guCaveat = caveatForQuestion(findings, 'AC ની લંબાઈ કેટલી છે?');
      expect(guCaveat).toBe('તથ્યો અને આકૃતિ AC પર અસંમત છે. હું કહી શકતો નથી કે કયું સાચું છે.');
    });

    it('handles angle and bar chart findings', () => {
      const angleFindings: VerifyFinding[] = [
        {
          message: "Facts and drawing disagree on angle C. I can't tell which is right.",
        },
      ];
      expect(caveatForQuestion(angleFindings, 'What is angle C?')).toBe(
        "Facts and drawing disagree on angle C. I can't tell which is right.",
      );
      expect(caveatForQuestion(angleFindings, 'What is angle B?')).toBeNull();

      const barFindings: VerifyFinding[] = [
        {
          message: "Facts and drawing disagree on Red. I can't tell which is right.",
        },
      ];
      expect(caveatForQuestion(barFindings, 'How tall is the Red bar?')).toBe(
        "Facts and drawing disagree on Red. I can't tell which is right.",
      );
      expect(caveatForQuestion(barFindings, 'How tall is the Blue bar?')).toBeNull();
    });
  });

  describe('5. AskManager Integration (submitTextAsk & startVoiceAsk)', () => {
    it('submitTextAsk: prepends caveat to spoken answer when question matches disputed segment', async () => {
      const askManager = new AskManager();
      const audio = createMockAudioDriver();
      const speech = createMockSpeechDriver();
      const spokenLines: string[] = [];

      const deps: AskDeps = {
        audio,
        speech,
        scene: forgedTriangleScene,
        say: (text: string) => {
          spokenLines.push(text);
        },
        request: vi.fn().mockResolvedValue({
          answer: 'The length of AC is 7 cm.',
          source: 'facts',
        } as AskResponse),
      };

      const outcome = await askManager.submitTextAsk('What is the length of AC?', deps);
      expect(outcome.kind).toBe('success');

      // The answer spoken via deps.say contains caveat prepended in ONE utterance
      const finalSpoken = spokenLines[spokenLines.length - 1];
      expect(finalSpoken).toBe(
        "Facts and drawing disagree on AC. I can't tell which is right. The length of AC is 7 cm.",
      );
    });

    it('submitTextAsk: leaves answer unchanged when question asks about undisputed segment', async () => {
      const askManager = new AskManager();
      const audio = createMockAudioDriver();
      const speech = createMockSpeechDriver();
      const spokenLines: string[] = [];

      const deps: AskDeps = {
        audio,
        speech,
        scene: forgedTriangleScene,
        say: (text: string) => {
          spokenLines.push(text);
        },
        request: vi.fn().mockResolvedValue({
          answer: 'The length of BC is 3 cm.',
          source: 'facts',
        } as AskResponse),
      };

      const outcome = await askManager.submitTextAsk('What is the length of BC?', deps);
      expect(outcome.kind).toBe('success');

      const finalSpoken = spokenLines[spokenLines.length - 1];
      expect(finalSpoken).toBe('The length of BC is 3 cm.');
      expect(finalSpoken).not.toContain("Facts and drawing disagree");
    });

    it('submitTextAsk: honest scene has NO caveat for any question', async () => {
      const askManager = new AskManager();
      const audio = createMockAudioDriver();
      const speech = createMockSpeechDriver();
      const spokenLines: string[] = [];

      const deps: AskDeps = {
        audio,
        speech,
        scene: honestTriangleScene,
        say: (text: string) => {
          spokenLines.push(text);
        },
        request: vi.fn().mockResolvedValue({
          answer: 'The length of AC is 4 cm.',
          source: 'facts',
        } as AskResponse),
      };

      const outcome = await askManager.submitTextAsk('What is the length of AC?', deps);
      expect(outcome.kind).toBe('success');

      const finalSpoken = spokenLines[spokenLines.length - 1];
      expect(finalSpoken).toBe('The length of AC is 4 cm.');
      expect(finalSpoken).not.toContain("Facts and drawing disagree");
    });

    it('startVoiceAsk: prepends caveat when speech recognition transcribes disputed side', async () => {
      const askManager = new AskManager();
      const audio = createMockAudioDriver();
      const speech = createMockSpeechDriver('What is AC?');
      const spokenLines: string[] = [];

      const deps: AskDeps = {
        audio,
        speech,
        scene: forgedTriangleScene,
        say: (text: string) => {
          spokenLines.push(text);
        },
        request: vi.fn().mockResolvedValue({
          answer: 'Side AC has a length of 7 cm.',
          source: 'facts',
        } as AskResponse),
      };

      const outcome = await askManager.startVoiceAsk(deps);
      expect(outcome.kind).toBe('success');

      const finalSpoken = spokenLines[spokenLines.length - 1];
      expect(finalSpoken).toBe(
        "Facts and drawing disagree on AC. I can't tell which is right. Side AC has a length of 7 cm.",
      );
    });

    it('startVoiceAsk: unchanged when speech recognition transcribes undisputed side', async () => {
      const askManager = new AskManager();
      const audio = createMockAudioDriver();
      const speech = createMockSpeechDriver('What is BC?');
      const spokenLines: string[] = [];

      const deps: AskDeps = {
        audio,
        speech,
        scene: forgedTriangleScene,
        say: (text: string) => {
          spokenLines.push(text);
        },
        request: vi.fn().mockResolvedValue({
          answer: 'Side BC has a length of 3 cm.',
          source: 'facts',
        } as AskResponse),
      };

      const outcome = await askManager.startVoiceAsk(deps);
      expect(outcome.kind).toBe('success');

      const finalSpoken = spokenLines[spokenLines.length - 1];
      expect(finalSpoken).toBe('Side BC has a length of 3 cm.');
      expect(finalSpoken).not.toContain("Facts and drawing disagree");
    });
  });

  describe('6. Visible Status Line via announced Prop Path', () => {
    it('provides caveat in announced string ready for Explore status card', () => {
      const announced = exploreAnnouncement(forgedTriangleScene, 'sample');
      expect(announced).toContain("Facts and drawing disagree on AC. I can't tell which is right.");
      // The announced string is the exact value passed into <Explore announced={announced} />
      // which sets initial statusMessage state and renders inside .gt-explore__status
    });
  });
});
