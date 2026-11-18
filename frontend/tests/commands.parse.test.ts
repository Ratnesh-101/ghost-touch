/**
 * Task 71 / UX15: Voice command parser precision tests.
 *
 * Requirements:
 * - Requirement 45 (45.1 especially): a voice command matches only when it is a bare command
 *   or a short known command phrase.
 * - Questions containing command words must NOT be swallowed; they parse as 'unknown' so Ask receives them.
 * - Every existing bare command in English, Hindi, and Gujarati must parse correctly.
 * - At least 15 additional real questions per language (en, hi, gu) verified from i18n must parse as 'unknown'.
 */

import { describe, expect, it } from 'vitest';
import { parseExploreCommand } from '../src/flow/commands';

type Lang = 'en' | 'hi' | 'gu';

interface BareTestCase {
  readonly lang: Lang;
  readonly text: string;
  readonly type: string;
  readonly rate?: 'fast' | 'slow' | 'normal';
}

/** All bare commands in English, Hindi, and Gujarati. */
const BARE_COMMANDS: ReadonlyArray<BareTestCase> = [
  // English
  { lang: 'en', text: 'help', type: 'help' },
  { lang: 'en', text: 'repeat', type: 'repeat' },
  { lang: 'en', text: 'next corner', type: 'next_corner' },
  { lang: 'en', text: 'describe', type: 'describe' },
  { lang: 'en', text: 'faster', type: 'set_rate', rate: 'fast' },
  { lang: 'en', text: 'slower', type: 'set_rate', rate: 'slow' },
  // Hindi
  { lang: 'hi', text: 'मदद', type: 'help' },
  { lang: 'hi', text: 'दोहराएं', type: 'repeat' },
  { lang: 'hi', text: 'अगला कोना', type: 'next_corner' },
  { lang: 'hi', text: 'वर्णन करें', type: 'describe' },
  { lang: 'hi', text: 'तेज़', type: 'set_rate', rate: 'fast' },
  { lang: 'hi', text: 'धीमा', type: 'set_rate', rate: 'slow' },
  // Gujarati
  { lang: 'gu', text: 'મદદ', type: 'help' },
  { lang: 'gu', text: 'ફરી બોલો', type: 'repeat' },
  { lang: 'gu', text: 'આગળનો ખૂણો', type: 'next_corner' },
  { lang: 'gu', text: 'વર્ણન કરો', type: 'describe' },
  { lang: 'gu', text: 'ઝડપી', type: 'set_rate', rate: 'fast' },
  { lang: 'gu', text: 'ધીમું', type: 'set_rate', rate: 'slow' },
];

/** Short, known multi-word command phrases that must also parse as valid commands. */
const SHORT_COMMAND_PHRASES: ReadonlyArray<BareTestCase> = [
  { lang: 'en', text: 'say again', type: 'repeat' },
  { lang: 'en', text: 'repeat that', type: 'repeat' },
  { lang: 'en', text: 'next vertex', type: 'next_corner' },
  { lang: 'en', text: 'describe diagram', type: 'describe' },
  { lang: 'en', text: 'list commands', type: 'help' },
  { lang: 'en', text: 'help me', type: 'help' },
  { lang: 'en', text: 'speed up', type: 'set_rate', rate: 'fast' },
  { lang: 'en', text: 'slow down', type: 'set_rate', rate: 'slow' },
  { lang: 'en', text: 'normal speed', type: 'set_rate', rate: 'normal' },
  { lang: 'hi', text: 'फिर से बोलो', type: 'repeat' },
  { lang: 'hi', text: 'अगला शीर्ष', type: 'next_corner' },
  { lang: 'hi', text: 'चित्र का वर्णन', type: 'describe' },
  { lang: 'hi', text: 'सामान्य गति', type: 'set_rate', rate: 'normal' },
  { lang: 'gu', text: 'ફરીથી બોલો', type: 'repeat' },
  { lang: 'gu', text: 'આ શું છે', type: 'describe' },
  { lang: 'gu', text: 'સામાન્ય ગતિ', type: 'set_rate', rate: 'normal' },
];

/** 20 additional real questions in English verifiable from i18n and STEM diagram context. */
const ADDITIONAL_EN_QUESTIONS: readonly string[] = [
  'where is the top of the curve',
  'how long is the back side',
  'read me the labels again please',
  'What is the slope of the curve?',
  'Can you tell me the coordinates of vertex A?',
  'How many corners does this polygon have?',
  'Is side AB parallel to side CD?',
  'Which bar has the highest value?',
  'Can someone help me find the right angle?',
  'Describe how the function behaves near zero',
  'Please repeat the value of the third bar',
  'What comes after the next corner clockwise?',
  'Why is this line moving faster here?',
  'Can you explain why the curve is slower?',
  'Where does the line cross the x-axis?',
  'Is point B touching the y-axis?',
  'What is the difference between bar Q1 and bar Q2?',
  'Could you describe the hypotenuse length?',
  'What is the peak height of this sine wave?',
  'Is there an origin marked on this graph?',
];

/** 20 additional real questions in Hindi verifiable from i18n and STEM diagram context. */
const ADDITIONAL_HI_QUESTIONS: readonly string[] = [
  'वक्र का उच्चतम बिंदु कहाँ है',
  'भुजा AB की लंबाई कितनी है',
  'कृपया मुझे सारे लेबल फिर से पढ़कर बताएं',
  'क्या आप मुझे समकोण खोजने में मदद कर सकते हैं',
  'इस त्रिभुज के कोण B का वर्णन करें',
  'क्या यह रेखा x-अक्ष को काटती है',
  'अगला कोना बिंदु B के बाद कौन सा आता है',
  'पहला स्तंभ दूसरे से कितना बड़ा है',
  'क्या दूसरा बार पहले से ज़्यादा तेज़ बढ़ रहा है',
  'वक्र का ढलान शिखर के बाद धीमा क्यों होता है',
  'क्या बिंदु C उद्गम पर स्थित है',
  'इस आकृति में कुल कितने कोने हैं',
  'तीसरे स्तंभ का मान क्या है',
  'क्या बिंदु A और B को जोड़ने वाली रेखा सीधी है',
  'कर्ण AC की माप क्या है',
  'क्या आप इस पूरे आरेख का सारांश दोहरा सकते हैं',
  'y-अक्ष पर कौन सा बिंदु स्थित है',
  'साइन तरंग का आयाम कितना है',
  'क्या शिखर और गर्त के बीच की दूरी ज्ञात है',
  'क्या आप मुझे इस वक्र की दिशा समझा सकते हैं',
];

/** 20 additional real questions in Gujarati verifiable from i18n and STEM diagram context. */
const ADDITIONAL_GU_QUESTIONS: readonly string[] = [
  'વક્રનું સૌથી ઊંચું શિખર ક્યાં છે',
  'બાજુ AB ની લંબાઈ કેટલી છે',
  'કૃપા કરીને મને બધા લેબલ ફરીથી કહો',
  'શું તમે મને કાટખૂણો શોધવામાં મદદ કરી શકો છો',
  'આ ત્રિકોણના ખૂણા B નું વિગતવાર વર્ણન કરો',
  'શું આ રેખા x-અક્ષને છેદે છે',
  'બિંદુ B પછી કયો આગળનો ખૂણો આવે છે',
  'પહેલો સ્તંભ બીજા સ્તંભ કરતાં કેટલો મોટો છે',
  'કયો બાર સૌથી ઝડપી વધે છે',
  'વક્રનો ઢાળ શિખર પછી ધીમો કેમ થાય છે',
  'શું બિંદુ C ઉદ્ભવ બિંદુ પર છે',
  'આ આકૃતિમાં કુલ કેટલા ખૂણાઓ છે',
  'ત્રીજા સ્તંભનું મૂલ્ય શું છે',
  'બિંદુ A અને B ને જોડતી રેખા કેવી છે',
  'કાટકોણ ત્રિકોણમાં કર્ણ કયો છે',
  'શું તમે છેલ્લું બોલેલું વાક્ય ફરી બોલી શકો',
  'y-અક્ષ પર કયું બિંદુ આવેલું છે',
  'સાઇન તરંગનું સૌથી નીચું બિંદુ ક્યાં છે',
  'શું આ આલેખમાં કોઈ સમપ્રમાણતા છે',
  'મને આ સ્તંભ આલેખની માહિતી સમજવામાં મદદ કરશો',
];

/** The 20 baseline questions from Requirement 45 / commands.table.test.ts */
const BASELINE_QUESTIONS: readonly string[] = [
  'Which bar grows faster?',
  'Can you help me find AB?',
  'Describe angle B',
  'Is the curve rising slower after the peak?',
  'Which side is the next corner after B?',
  'Repeat the length of AC please',
  'Does the temperature rise faster than the pressure?',
  'Why does the second bar grow slower than the first?',
  'Describe the angle at vertex C',
  'Please help me understand the sine curve',
  'Will this triangle help me find the hypotenuse?',
  'Does the line go slower near the top?',
  'What is the next corner after A going clockwise?',
  'Describe the bars from tallest to shortest',
  'क्या आप मुझे AB खोजने में मदद कर सकते हैं',
  'त्रिभुज ABC का वर्णन करो',
  'इस आकृति में अगला कोना कौन सा है',
  'શું તમે મને AB શોધવામાં મદદ કરી શકો',
  'ત્રિકોણ ABC નું વર્ણન કરો',
  'આ આલેખમાં આગળનો ખૂણો કયો છે',
];

describe('commands.parse (Task 71, Requirement 45)', () => {
  describe('bare commands in English, Hindi, and Gujarati', () => {
    it('parses every bare command to its expected type and rate', () => {
      for (const cmd of BARE_COMMANDS) {
        const parsed = parseExploreCommand(cmd.text);
        expect(parsed.type).toBe(cmd.type);
        if (cmd.rate !== undefined) {
          expect(parsed.rateSetting).toBe(cmd.rate);
        }
      }
    });

    it('parses short known command phrases', () => {
      for (const cmd of SHORT_COMMAND_PHRASES) {
        const parsed = parseExploreCommand(cmd.text);
        expect(parsed.type).toBe(cmd.type);
        if (cmd.rate !== undefined) {
          expect(parsed.rateSetting).toBe(cmd.rate);
        }
      }
    });
  });

  describe('prompt specific questions with command words parse as unknown', () => {
    it('does not swallow "where is the top of the curve"', () => {
      expect(parseExploreCommand('where is the top of the curve').type).toBe('unknown');
    });

    it('does not swallow "how long is the back side"', () => {
      expect(parseExploreCommand('how long is the back side').type).toBe('unknown');
    });

    it('does not swallow "read me the labels again please"', () => {
      expect(parseExploreCommand('read me the labels again please').type).toBe('unknown');
    });
  });

  describe('at least 15 additional real questions per language parse as unknown', () => {
    it('has at least 15 English questions and all parse as unknown', () => {
      expect(ADDITIONAL_EN_QUESTIONS.length).toBeGreaterThanOrEqual(15);
      const swallowed = ADDITIONAL_EN_QUESTIONS.filter(
        (q) => parseExploreCommand(q).type !== 'unknown',
      );
      expect(swallowed).toEqual([]);
    });

    it('has at least 15 Hindi questions and all parse as unknown', () => {
      expect(ADDITIONAL_HI_QUESTIONS.length).toBeGreaterThanOrEqual(15);
      const swallowed = ADDITIONAL_HI_QUESTIONS.filter(
        (q) => parseExploreCommand(q).type !== 'unknown',
      );
      expect(swallowed).toEqual([]);
    });

    it('has at least 15 Gujarati questions and all parse as unknown', () => {
      expect(ADDITIONAL_GU_QUESTIONS.length).toBeGreaterThanOrEqual(15);
      const swallowed = ADDITIONAL_GU_QUESTIONS.filter(
        (q) => parseExploreCommand(q).type !== 'unknown',
      );
      expect(swallowed).toEqual([]);
    });
  });

  describe('baseline 20 questions from Requirement 45 table', () => {
    it('all 20 baseline questions parse as unknown so they reach Ask', () => {
      const swallowed = BASELINE_QUESTIONS.filter(
        (q) => parseExploreCommand(q).type !== 'unknown',
      );
      expect(swallowed).toEqual([]);
    });
  });
});
