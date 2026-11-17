import { describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  exploreAnnouncement,
  mapRawReason,
  rawReasonSentence,
  RAW_REASONS,
  type RawReason,
} from '../src/flow/navigation';
import { getLang, setLang, t, type Lang } from '../src/i18n';

describe('Raw Mode reason mapping (mapRawReason)', () => {
  it('maps standard server reason strings to closed union RawReason', () => {
    expect(mapRawReason('timeout')).toBe('timeout');
    expect(mapRawReason('budget')).toBe('budget');
    expect(mapRawReason('provider')).toBe('provider');
    expect(mapRawReason('unreadable')).toBe('unreadable');
  });

  it('maps server variant strings to appropriate closed union member', () => {
    expect(mapRawReason('budget_exhausted')).toBe('budget');
    expect(mapRawReason('no_provider')).toBe('provider');
    expect(mapRawReason('provider_error')).toBe('provider');
    expect(mapRawReason('queue_timeout')).toBe('timeout');
  });

  it('handles case-insensitivity and leading/trailing whitespace', () => {
    expect(mapRawReason(' TIMEOUT ')).toBe('timeout');
    expect(mapRawReason('Budget_Exhausted')).toBe('budget');
    expect(mapRawReason('No_Provider')).toBe('provider');
    expect(mapRawReason('  unreadable  ')).toBe('unreadable');
  });

  it('maps unknown server reason strings to unreadable', () => {
    expect(mapRawReason('invalid')).toBe('unreadable');
    expect(mapRawReason('error')).toBe('unreadable');
    expect(mapRawReason('unknown_reason')).toBe('unreadable');
    expect(mapRawReason('random-server-error-500')).toBe('unreadable');
    expect(mapRawReason('blurry')).toBe('unreadable');
  });

  it('maps missing reasons (undefined, null, empty) to unreadable', () => {
    expect(mapRawReason(undefined)).toBe('unreadable');
    expect(mapRawReason(null)).toBe('unreadable');
    expect(mapRawReason('')).toBe('unreadable');
    expect(mapRawReason('   ')).toBe('unreadable');
  });

  it('matches all entries in the RAW_REASONS closed union array', () => {
    expect(RAW_REASONS).toEqual(['timeout', 'budget', 'provider', 'unreadable']);
  });
});

describe('Raw Mode reason sentences across languages (rawReasonSentence & i18n)', () => {
  const testCases: Record<
    Lang,
    Record<RawReason, string>
  > = {
    en: {
      timeout: 'The reader was slow. Try once more.',
      budget: "Today's AI limit is used up. Saved diagrams still work. Try again tomorrow.",
      provider: 'The reader is not available right now. Try again in a minute.',
      unreadable: 'Try again with the page flat, closer, and in more light.',
    },
    hi: {
      timeout: 'रीडर धीमा था। एक बार फिर प्रयास करें।',
      budget: 'आज की एआई सीमा समाप्त हो गई है। सहेजे गए आरेख अभी भी काम करते हैं। कल पुनः प्रयास करें।',
      provider: 'रीडर अभी उपलब्ध नहीं है। एक मिनट में पुनः प्रयास करें।',
      unreadable: 'पृष्ठ को सीधा, पास और अधिक प्रकाश में रखकर पुनः प्रयास करें।',
    },
    gu: {
      timeout: 'રીડર ધીમું હતું. ફરી એકવાર પ્રયાસ કરો.',
      budget: 'આજની AI મર્યાદા સમાપ્ત થઈ ગઈ છે. સેવ કરેલી આકૃતિઓ હજી પણ કામ કરે છે. આવતીકાલે ફરી પ્રયાસ કરો.',
      provider: 'રીડર અત્યારે ઉપલબ્ધ નથી. એક મિનિટમાં ફરી પ્રયાસ કરો.',
      unreadable: 'પેજને સપાટ, નજીક અને વધુ પ્રકાશમાં રાખીને ફરી પ્રયાસ કરો.',
    },
  };

  const langs: Lang[] = ['en', 'hi', 'gu'];

  for (const lang of langs) {
    describe(`Language: ${lang}`, () => {
      for (const reason of RAW_REASONS) {
        it(`maps '${reason}' to its exact translated sentence in ${lang}`, () => {
          const prevLang = getLang();
          try {
            setLang(lang);
            const sentence = rawReasonSentence(reason);
            expect(sentence).toBe(testCases[lang][reason]);
            expect(t(`raw.reason.${reason}`)).toBe(testCases[lang][reason]);
          } finally {
            setLang(prevLang);
          }
        });
      }

      it(`maps unknown or missing reasons to 'unreadable' in ${lang}`, () => {
        const prevLang = getLang();
        try {
          setLang(lang);
          const unreadableSentence = testCases[lang].unreadable;
          expect(rawReasonSentence(undefined)).toBe(unreadableSentence);
          expect(rawReasonSentence(null)).toBe(unreadableSentence);
          expect(rawReasonSentence('')).toBe(unreadableSentence);
          expect(rawReasonSentence('unknown_server_reason')).toBe(unreadableSentence);
          expect(rawReasonSentence('error_500')).toBe(unreadableSentence);
        } finally {
          setLang(prevLang);
        }
      });
    });
  }
});

describe('Explore entry announcement integration with Raw Mode reasons', () => {
  const dummyScene: DiagramScene = {
    kind: 'geometry',
    title: 'Triangle',
  };

  it('appends timeout sentence directly after raw.announce in English', () => {
    const prevLang = getLang();
    try {
      setLang('en');
      const text = exploreAnnouncement(dummyScene, 'raw', undefined, undefined, 'timeout');
      const rawAnnounce = t('raw.announce');
      const timeoutSentence = t('raw.reason.timeout');

      expect(text.startsWith(rawAnnounce)).toBe(true);
      expect(text).toContain(`${rawAnnounce} ${timeoutSentence}`);
      expect(text).not.toContain('timeout'); // never speak raw server string
    } finally {
      setLang(prevLang);
    }
  });

  it('appends budget sentence directly after raw.announce in English', () => {
    const prevLang = getLang();
    try {
      setLang('en');
      const text = exploreAnnouncement(dummyScene, 'raw', undefined, undefined, 'budget_exhausted');
      const rawAnnounce = t('raw.announce');
      const budgetSentence = t('raw.reason.budget');

      expect(text.startsWith(rawAnnounce)).toBe(true);
      expect(text).toContain(`${rawAnnounce} ${budgetSentence}`);
      expect(text).not.toContain('budget_exhausted');
    } finally {
      setLang(prevLang);
    }
  });

  it('appends provider sentence directly after raw.announce in English', () => {
    const prevLang = getLang();
    try {
      setLang('en');
      const text = exploreAnnouncement(dummyScene, 'raw', undefined, undefined, 'no_provider');
      const rawAnnounce = t('raw.announce');
      const providerSentence = t('raw.reason.provider');

      expect(text.startsWith(rawAnnounce)).toBe(true);
      expect(text).toContain(`${rawAnnounce} ${providerSentence}`);
      expect(text).not.toContain('no_provider');
    } finally {
      setLang(prevLang);
    }
  });

  it('defaults to unreadable sentence when reason is missing or unknown in English', () => {
    const prevLang = getLang();
    try {
      setLang('en');
      const rawAnnounce = t('raw.announce');
      const unreadableSentence = t('raw.reason.unreadable');

      // Missing reason
      const textMissing = exploreAnnouncement(dummyScene, 'raw');
      expect(textMissing).toContain(`${rawAnnounce} ${unreadableSentence}`);

      // Unknown reason
      const textUnknown = exploreAnnouncement(dummyScene, 'raw', undefined, undefined, 'unexpected_error');
      expect(textUnknown).toContain(`${rawAnnounce} ${unreadableSentence}`);
      expect(textUnknown).not.toContain('unexpected_error');
    } finally {
      setLang(prevLang);
    }
  });

  it('appends raw reason sentence correctly in Hindi and Gujarati', () => {
    const prevLang = getLang();
    try {
      // Hindi
      setLang('hi');
      const hiText = exploreAnnouncement(dummyScene, 'raw', undefined, undefined, 'timeout');
      expect(hiText.startsWith(t('raw.announce'))).toBe(true);
      expect(hiText).toContain(t('raw.reason.timeout'));
      expect(hiText).toContain('रीडर धीमा था');
      expect(hiText).not.toContain('timeout');

      // Gujarati
      setLang('gu');
      const guText = exploreAnnouncement(dummyScene, 'raw', undefined, undefined, 'provider');
      expect(guText.startsWith(t('raw.announce'))).toBe(true);
      expect(guText).toContain(t('raw.reason.provider'));
      expect(guText).toContain('રીડર અત્યારે ઉપલબ્ધ નથી');
      expect(guText).not.toContain('provider');
    } finally {
      setLang(prevLang);
    }
  });

  it('supports rawReason passed via options bag', () => {
    const prevLang = getLang();
    try {
      setLang('en');
      const text = exploreAnnouncement(dummyScene, 'raw', undefined, { rawReason: 'budget' });
      expect(text).toContain(t('raw.reason.budget'));
    } finally {
      setLang(prevLang);
    }
  });

  it('does not append raw reason sentences for AI mode scenes', () => {
    const prevLang = getLang();
    try {
      setLang('en');
      const text = exploreAnnouncement(dummyScene, 'ai');
      expect(text).not.toContain(t('raw.announce'));
      expect(text).not.toContain(t('raw.reason.timeout'));
      expect(text).not.toContain(t('raw.reason.budget'));
      expect(text).not.toContain(t('raw.reason.provider'));
      expect(text).not.toContain(t('raw.reason.unreadable'));
    } finally {
      setLang(prevLang);
    }
  });
});
