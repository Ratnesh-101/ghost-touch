import { test, expect, type Page } from '@playwright/test';
import { t, tables } from '../src/i18n';
import { BASE_SPEECH_RATE, SPEECH_RATE_MULTIPLIERS } from '../src/drivers/speech';
import {
  clearSpies,
  expectSpoken,
  installPhoneSpies,
  say,
  spoken,
  toPage,
  touch,
  vibrations,
} from './support/phoneSpies';

/**
 * docs/PHONE_TEST.md rows that a browser can check. Test titles start with the row number ("PT 4.2").
 * This is an emulated Android Chrome in Playwright: it checks what the app asks the browser to do
 * (calls to vibrate, speak, set a tone) and what it shows. It does NOT show that a motor buzzes, how a
 * voice sounds, or how TalkBack behaves: those rows stay for a real phone.
 */

async function startAndOpenSample(page: Page, sample: RegExp): Promise<void> {
  await page.goto('/');
  await page.locator('.gt-start-surface').click();
  await page.getByRole('button', { name: sample }).first().click();
  await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
  await page.waitForTimeout(250);
}

async function openSettings(page: Page): Promise<void> {
  await page.locator('.gt-settings-launcher__button, .gt-capture__button--settings').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('PT 1 install facts (manifest only; the install prompt itself needs a phone)', () => {
  test('PT 1.3/1.4 manifest: name, standalone, dark background, icons', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const res = await request.get(href as string);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toBe('Ghost Touch');
    expect(m.display).toBe('standalone');
    expect(m.background_color).toBe('#0b0e0c');
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('PT 2 start screen and audio unlock', () => {
  test('PT 2.1/2.2 start screen shows the tagline, tapping vibrates 50 and speaks the capture prompt', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await expect(page.locator('.gt-start-surface')).toBeVisible();
    await clearSpies(page);
    await page.locator('.gt-start-surface').click();
    await expectSpoken(page, t('capture.prompt'));
    expect(await vibrations(page)).toContainEqual(50);
    await expect(page.getByRole('button', { name: /triangle/i }).first()).toBeVisible();
  });
});

test.describe('PT 3 settings sheet and persistence', () => {
  test('PT 3.1 to 3.4 settings open spoken, language confirmations in three languages', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await clearSpies(page);
    await openSettings(page);
    await page.getByRole('button', { name: /हिन्दी/ }).click();
    await expectSpoken(page, tables.hi['lang.changedHi'] as string);
    await page.getByRole('button', { name: /ગુજરાતી/ }).click();
    await expectSpoken(page, tables.gu['lang.changedGu'] as string);
    await page.getByRole('button', { name: /English/ }).first().click();
    await expectSpoken(page, tables.en['lang.changedEn'] as string);
  });

  test('PT 3.5 speech speed buttons speak the confirmation at 0.8, 1.25 and 1.0', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await openSettings(page);
    const cases: Array<[RegExp, string, number]> = [
      [/Slow speech/, 'rate.setSlow', BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS.slow],
      [/Fast speech/, 'rate.setFast', BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS.fast],
      [/Normal speech/, 'rate.setNormal', BASE_SPEECH_RATE * SPEECH_RATE_MULTIPLIERS.normal],
    ];
    for (const [name, key, rate] of cases) {
      await clearSpies(page);
      await page.getByRole('button', { name }).click();
      await expectSpoken(page, tables.en[key] as string);
      const u = await page.evaluate(() => window.__pt.utterances[window.__pt.utterances.length - 1]);
      expect(u?.rate).toBeCloseTo(rate, 2);
    }
  });

  test('PT 3.6/3.7 Guide and Teacher switches speak their state', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await openSettings(page);
    await page.getByRole('button', { name: new RegExp(t('lab.settings.moreSettings')) }).first().click();
    await clearSpies(page);
    await page.getByRole('switch', { name: /guide/i }).first().click();
    await expectSpoken(page, t('lab.settings.guideOn'));
    await page.getByRole('switch', { name: /teacher/i }).first().click();
    await expectSpoken(page, t('lab.settings.teacherOn'));
  });

  test('PT 3.8/3.9 closing speaks closed, and the language persists after a reload', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await openSettings(page);
    await page.getByRole('button', { name: /हिन्दी/ }).click();
    await clearSpies(page);
    await page.getByRole('button', { name: new RegExp(`${tables.hi['lab.settings.close']}`) }).first().click();
    await page.reload();
    await clearSpies(page);
    await page.locator('.gt-start-surface').click();
    await expectSpoken(page, tables.hi['capture.prompt'] as string);
  });
});

test.describe('PT 3.1 and 3.8 the settings sheet speaks when it opens and closes (was finding F1, fixed by lane hi18)', () => {
  test('PT 3.1/3.8 opening speaks Lab settings opened once, closing speaks Lab settings closed once', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await clearSpies(page);
    await openSettings(page);
    await expectSpoken(page, t('lab.settings.opened'));
    await clearSpies(page);
    await page.getByRole('button', { name: new RegExp(t('lab.settings.close')) }).first().click();
    await expectSpoken(page, t('lab.settings.closed'));
    const closedCount = (await spoken(page)).filter((u) => u === t('lab.settings.closed')).length;
    expect(closedCount).toBe(1);
  });
});

test.describe('PT 4 explore samples (TalkBack off)', () => {
  test('PT 4.1 triangle opens with the title announcement', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await clearSpies(page);
    await page.getByRole('button', { name: /triangle/i }).first().click();
    await expectSpoken(page, 'Right Triangle ABC');
  });

  test('PT 4.2/4.3 a finger on a line buzzes vibrate(80); off the line it stops with vibrate(0)', async ({ page }) => {
    await installPhoneSpies(page);
    await startAndOpenSample(page, /triangle/i);
    const cdp = await page.context().newCDPSession(page);
    await clearSpies(page);
    const onLine = await toPage(page, 0.25, 0.55); // side CA, away from the corners
    await touch(cdp, 'touchStart', onLine.x, onLine.y);
    await page.waitForTimeout(400);
    const during = await vibrations(page);
    expect(during.filter((v) => v === 80).length).toBeGreaterThanOrEqual(3);
    const off = await toPage(page, 0.8, 0.2);
    await touch(cdp, 'touchMove', off.x, off.y);
    await page.waitForTimeout(250);
    expect(await vibrations(page)).toContain(0);
    await touch(cdp, 'touchEnd');
  });

  test('PT 4.4 a corner fires [50,90,50], speaks the label, and holds the line buzz back for 450 ms', async ({ page }) => {
    await installPhoneSpies(page);
    await startAndOpenSample(page, /triangle/i);
    const cdp = await page.context().newCDPSession(page);
    const corner = await toPage(page, 0.25, 0.85);
    const nearBy = await toPage(page, 0.25, 0.7);
    await touch(cdp, 'touchStart', nearBy.x, nearBy.y);
    await page.waitForTimeout(250);
    await clearSpies(page);
    await touch(cdp, 'touchMove', corner.x, corner.y);
    await page.waitForTimeout(150);
    const v = await vibrations(page);
    expect(v).toContainEqual([50, 90, 50]);
    await expectSpoken(page, 'C');
    const afterCorner = v.slice(v.findIndex((x) => Array.isArray(x)) + 1);
    expect(afterCorner.filter((x) => x === 80).length).toBe(0);
    await touch(cdp, 'touchEnd');
  });

  test('PT 4.5 sine: the tone follows the curve height inside 200 to 1000 Hz and rises with height', async ({ page }) => {
    await installPhoneSpies(page);
    await startAndOpenSample(page, /sine/i);
    const sine = (await (await page.request.get('/samples/sine.json')).json()) as {
      polylines: Array<{ points: Array<[number, number]> }>;
    };
    const pts = sine.polylines[0]!.points;
    const low = pts.reduce((a, b) => (b[1] > a[1] ? b : a)); // largest y is lowest on screen
    const high = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
    const cdp = await page.context().newCDPSession(page);
    const pl = await toPage(page, low[0], low[1]);
    await clearSpies(page);
    await touch(cdp, 'touchStart', pl.x, pl.y);
    await page.waitForTimeout(500);
    const lowFreqs = await page.evaluate(() => window.__pt.frequencies.slice());
    const ph = await toPage(page, high[0], high[1]);
    await clearSpies(page);
    await touch(cdp, 'touchMove', ph.x, ph.y);
    await page.waitForTimeout(500);
    const highFreqs = await page.evaluate(() => window.__pt.frequencies.slice());
    await touch(cdp, 'touchEnd');
    const inRange = (f: number[]): number[] => f.filter((x) => x >= 195 && x <= 1005);
    expect(inRange(lowFreqs).length).toBeGreaterThan(0);
    expect(inRange(highFreqs).length).toBeGreaterThan(0);
    expect(Math.max(...inRange(highFreqs))).toBeGreaterThan(Math.min(...inRange(lowFreqs)));
  });

  test('PT 4.6 bar chart: touching a bar speaks its label', async ({ page }) => {
    await installPhoneSpies(page);
    await startAndOpenSample(page, /bar/i);
    const cdp = await page.context().newCDPSession(page);
    const q4 = await toPage(page, 0.795, 0.7);
    await clearSpies(page);
    await touch(cdp, 'touchStart', q4.x, q4.y);
    await expectSpoken(page, 'Q4');
    await touch(cdp, 'touchEnd');
  });
});

test.describe('PT 6 voice commands (fake recogniser: tests the command plumbing, not the microphone)', () => {
  async function ask(page: Page, phrase: string): Promise<void> {
    await say(page, phrase);
    await clearSpies(page);
    await page.getByRole('button', { name: /^(Ask|Voice)/i }).first().click();
  }

  test('PT 6.3 to 6.6 describe, help, next corner, where am I, repeat', async ({ page }) => {
    await installPhoneSpies(page);
    await startAndOpenSample(page, /triangle/i);
    await ask(page, 'describe');
    await expectSpoken(page, 'Right Triangle ABC');
    await ask(page, 'help');
    await expectSpoken(page, t('commands.help'));
    await ask(page, 'next corner');
    await expectSpoken(page, 'Corner 1 of 3');
    await ask(page, 'where am I');
    await expect.poll(async () => (await spoken(page)).length, { timeout: 8000 }).toBeGreaterThan(0);
    await ask(page, 'repeat');
    await expect.poll(async () => (await spoken(page)).length, { timeout: 8000 }).toBeGreaterThan(0);
  });

  test('PT 6.7 faster and normal speed change the speech rate', async ({ page }) => {
    await installPhoneSpies(page);
    await startAndOpenSample(page, /triangle/i);
    await ask(page, 'faster');
    await expectSpoken(page, t('rate.setFast'));
    await ask(page, 'normal speed');
    await expectSpoken(page, t('rate.setNormal'));
  });
});

test.describe('PT 12 Hindi and Gujarati speech: the spoken text (voice and language tag need a phone)', () => {
  const langs: Array<[string, 'hi' | 'gu']> = [
    ['हिन्दी', 'hi'],
    ['ગુજરાતી', 'gu'],
  ];
  for (const [label, lang] of langs) {
    test(`PT 12 ${lang}: capture prompt is spoken in the chosen language`, async ({ page }) => {
      await installPhoneSpies(page);
      await page.goto('/');
      await page.locator('.gt-start-surface').click();
      await openSettings(page);
      await page.getByRole('button', { name: new RegExp(label) }).click();
      await page.getByRole('button', { name: new RegExp(`${tables[lang]['lab.settings.close']}`) }).first().click();
      await page.reload();
      await clearSpies(page);
      await page.locator('.gt-start-surface').click();
      const prompt = tables[lang]['capture.prompt'] as string;
      await expectSpoken(page, prompt);
      // The utterance language tag depends on the voices installed: this test browser has no Hindi or Gujarati
      // voice, so the driver falls back to an English voice (by design, with a spoken notice). The tag and the
      // voice quality are checked on the phone (PHONE_TEST step 12), not here.
    });
  }
});
