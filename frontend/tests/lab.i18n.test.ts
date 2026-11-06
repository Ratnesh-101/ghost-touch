import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  describeSettings,
  formatRateMultiplier,
  getLang,
  setLang,
  t,
  tables,
  type Lang,
} from '../src/i18n';

const EXPECTED_LAB_KEYS = [
  'lab.start.wake',
  'lab.start.tagline',
  'lab.organ.nerves.title',
  'lab.organ.nerves.line',
  'lab.organ.eyes.title',
  'lab.organ.eyes.line',
  'lab.organ.voice.title',
  'lab.organ.voice.line',
  'lab.settings.button',
  'lab.settings.title',
  'lab.settings.close',
  'lab.settings.language',
  'lab.settings.rate',
  'lab.settings.opened',
  'lab.settings.closed',
  'lab.loading.title',
  'lab.loading.hint',
  'lab.raw.notice',
  'lab.specimen.triangle',
  'lab.specimen.sine',
  'lab.specimen.bars',
  'lab.empty.saved',
  'lab.empty.generic',
] as const;

describe('Lab theme i18n & copy parity (Lane lab-i18n)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('maintains strict key parity across en, hi, and gu string tables', () => {
    const enKeys = Object.keys(tables.en).sort();
    const hiKeys = Object.keys(tables.hi).sort();
    const guKeys = Object.keys(tables.gu).sort();

    expect(hiKeys).toEqual(enKeys);
    expect(guKeys).toEqual(enKeys);
  });

  it('contains no empty or whitespace-only translation strings in any table', () => {
    for (const [lang, table] of Object.entries(tables)) {
      for (const [key, val] of Object.entries(table)) {
        expect(
          val.trim().length,
          `Key "${key}" in language "${lang}" must not be empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('defines all required lab keys in all three language tables', () => {
    for (const key of EXPECTED_LAB_KEYS) {
      expect(tables.en[key], `Missing English key ${key}`).toBeDefined();
      expect(tables.hi[key], `Missing Hindi key ${key}`).toBeDefined();
      expect(tables.gu[key], `Missing Gujarati key ${key}`).toBeDefined();
    }
  });

  it('matches exact English copy specified in lab-spec.md and agy-lab-i18n.md', () => {
    setLang('en');
    expect(t('app.tagline')).toBe("Feel diagrams you can't see.");
    expect(t('lab.start.wake')).toBe('Wake the creature');
    expect(t('lab.start.tagline')).toBe("Feel diagrams you can't see");

    expect(t('lab.organ.nerves.title')).toBe('Nerves');
    expect(t('lab.organ.nerves.line')).toBe('Feel lines and corners as vibration');

    expect(t('lab.organ.eyes.title')).toBe('Eyes');
    expect(t('lab.organ.eyes.line')).toBe('AI reads your diagram');

    expect(t('lab.organ.voice.title')).toBe('Voice');
    expect(t('lab.organ.voice.line')).toBe('Tones and speech tell you more');

    expect(t('lab.settings.title')).toBe('Lab settings');
    expect(t('lab.settings.close')).toBe('Close settings');
    expect(t('lab.settings.language')).toBe('Language');
    expect(t('lab.settings.rate')).toBe('Speech speed');
    expect(t('lab.settings.opened')).toBe('Lab settings opened');
    expect(t('lab.settings.closed')).toBe('Lab settings closed');

    expect(t('lab.loading.title')).toBe('The lab is powering up');
    expect(t('lab.loading.hint')).toBe('Reading your diagram…');

    expect(t('lab.raw.notice')).toBe("The creature's eyes are blurry — you can still feel the outlines.");

    expect(t('lab.specimen.triangle')).toBe('Right triangle');
    expect(t('lab.specimen.sine')).toBe('Sine wave');
    expect(t('lab.specimen.bars')).toBe('Bar chart');

    expect(t('lab.empty.saved')).toBe('No saved diagrams yet. Take a photo and save one.');
    expect(t('lab.empty.generic')).toBe('Nothing here yet.');
  });

  it('translates lab keys in Hindi with non-empty meaningful translations', () => {
    setLang('hi');
    expect(t('lab.start.wake')).toBe('जीव को जगाएं');
    expect(t('lab.raw.notice')).toContain('जीव की आंखें धुंधली हैं');
    expect(t('lab.settings.title')).toBe('लैब सेटिंग्स');
    expect(t('lab.settings.close')).toBe('सेटिंग्स बंद करें');
    expect(t('lab.organ.nerves.title')).toBe('तंत्रिकाएं');
    expect(t('lab.organ.eyes.title')).toBe('आंखें');
    expect(t('lab.organ.voice.title')).toBe('आवाज़');
  });

  it('translates lab keys in Gujarati with non-empty meaningful translations', () => {
    setLang('gu');
    expect(t('lab.start.wake')).toBe('પ્રાણીને જગાડો');
    expect(t('lab.raw.notice')).toContain('પ્રાણીની આંખો ઝાંખી છે');
    expect(t('lab.settings.title')).toBe('લેબ સેટિંગ્સ');
    expect(t('lab.settings.close')).toBe('સેટિંગ્સ બંધ કરો');
    expect(t('lab.organ.nerves.title')).toBe('ચેતાઓ');
    expect(t('lab.organ.eyes.title')).toBe('આંખો');
    expect(t('lab.organ.voice.title')).toBe('અવાજ');
  });
});

describe('formatRateMultiplier pure helper', () => {
  it('formats named rates slow, normal, and fast', () => {
    expect(formatRateMultiplier('slow')).toBe('0.8×');
    expect(formatRateMultiplier('normal')).toBe('1.0×');
    expect(formatRateMultiplier('fast')).toBe('1.25×');
  });

  it('formats numeric rate multipliers', () => {
    expect(formatRateMultiplier(0.8)).toBe('0.8×');
    expect(formatRateMultiplier(1.0)).toBe('1.0×');
    expect(formatRateMultiplier(1.25)).toBe('1.25×');
  });

  it('formats existing string representations with x', () => {
    expect(formatRateMultiplier('0.8x')).toBe('0.8×');
    expect(formatRateMultiplier('1.0x')).toBe('1.0×');
    expect(formatRateMultiplier('1.25x')).toBe('1.25×');
  });

  it('defaults undefined or empty rate to 1.0×', () => {
    expect(formatRateMultiplier(undefined)).toBe('1.0×');
  });
});

describe('describeSettings pure helper', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('composes English button label with language name and rate multiplier', () => {
    expect(describeSettings('en', 'normal')).toBe('Settings: English, 1.0×');
    expect(describeSettings('en', 'slow')).toBe('Settings: English, 0.8×');
    expect(describeSettings('en', 'fast')).toBe('Settings: English, 1.25×');
  });

  it('composes label for other languages when English is active', () => {
    expect(describeSettings('hi', 'normal')).toBe('Settings: Hindi, 1.0×');
    expect(describeSettings('gu', 'fast')).toBe('Settings: Gujarati, 1.25×');
  });

  it('composes label when Hindi is active language', () => {
    setLang('hi');
    expect(describeSettings('hi', 'normal')).toBe('सेटिंग्स: हिन्दी, 1.0×');
    expect(describeSettings('hi', 'slow')).toBe('सेटिंग्स: हिन्दी, 0.8×');
  });

  it('composes label when Gujarati is active language', () => {
    setLang('gu');
    expect(describeSettings('gu', 'normal')).toBe('સેટિંગ્સ: ગુજરાતી, 1.0×');
    expect(describeSettings('gu', 'fast')).toBe('સેટિંગ્સ: ગુજરાતી, 1.25×');
  });

  it('uses active language and normal rate when arguments omitted', () => {
    setLang('en');
    expect(describeSettings()).toBe('Settings: English, 1.0×');
  });
});
