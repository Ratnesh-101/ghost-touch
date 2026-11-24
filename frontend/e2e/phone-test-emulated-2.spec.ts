import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { t, tf } from '../src/i18n';
import { encodeShare, shareUrl } from '../src/share/codec';
import {
  clearSpies,
  expectSpoken,
  installPhoneSpies,
  say,
  spoken,
  toPage,
  touch,
} from './support/phoneSpies';

/**
 * docs/PHONE_TEST.md steps 7 to 14, the rows a browser can check (second half of
 * phone-test-emulated.spec.ts). Emulated Chrome, mocked backend answers, a fake speech recogniser:
 * it checks the app's behaviour and the calls it makes, never a microphone, a camera, a motor or TalkBack.
 */

const TRIANGLE = JSON.parse(readFileSync('public/samples/triangle.json', 'utf-8')) as unknown;

// A 1x1 PNG, enough for the capture pipeline to downscale and upload.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function mockScene(page: Page, mode: 'ai' | 'raw' = 'ai', delayMs = 0): Promise<void> {
  await page.route('**/api/v1/scene', async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mode === 'ai' ? { scene: TRIANGLE, mode: 'ai' } : { scene: TRIANGLE, mode: 'raw', reason: 'unreadable' }),
    });
  });
}

async function toCapture(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.gt-start-surface').click();
  await expect(page.getByRole('button', { name: /triangle/i }).first()).toBeVisible();
}

async function uploadImage(page: Page): Promise<void> {
  await page.locator('input[type="file"][aria-label="' + t('capture.chooseImage') + '"]').setInputFiles({
    name: 'diagram.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });
}

async function openTriangle(page: Page): Promise<void> {
  await toCapture(page);
  await page.getByRole('button', { name: /triangle/i }).first().click();
  await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
  await page.waitForTimeout(250);
}

test.describe('PT 7 Ask by voice and by text (backend answers are mocked: this checks the app plumbing)', () => {
  test('PT 7.1/7.2 voice question shows Thinking, then the answer or the exact fallback is spoken', async ({ page }) => {
    await installPhoneSpies(page);
    let answer = 'AB is 5 centimetres.';
    await page.route('**/api/v1/ask', async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer, source: 'ai' }) });
    });
    await openTriangle(page);
    await say(page, 'How long is AB?');
    await clearSpies(page);
    await page.getByRole('button', { name: /^Ask/i }).first().click();
    await expect(page.locator('.gt-explore__status')).toContainText(t('ask.thinking'));
    await expectSpoken(page, 'AB is 5 centimetres.');
    answer = "I don't know from this diagram.";
    await say(page, 'What colour is it?');
    await clearSpies(page);
    await page.getByRole('button', { name: /^Ask/i }).first().click();
    await expectSpoken(page, "I don't know from this diagram.");
  });

  test('PT 7.3 text fallback (no speech recogniser): type a question, Send, the question reaches the backend and the answer is spoken', async ({ page }) => {
    await installPhoneSpies(page, { recognition: 'none' });
    let asked = '';
    await page.route('**/api/v1/ask', async (route) => {
      asked = (route.request().postDataJSON() as { question?: string }).question ?? '';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'AC is 4 cm.', source: 'ai' }) });
    });
    await openTriangle(page);
    const input = page.locator('input.gt-explore__ask-input');
    await expect(input).toBeVisible();
    await input.fill('How long is AC?');
    await clearSpies(page);
    await input.press('Enter');
    await expectSpoken(page, 'AC is 4 cm.');
    expect(asked).toBe('How long is AC?');
  });
});

test.describe('PT 8 and 9 photo and PDF (the camera itself needs a phone; here a file goes through the same path)', () => {
  test('PT 8.2/8.3 Reading your diagram is shown, then Explore opens on the returned scene', async ({ page }) => {
    await installPhoneSpies(page);
    await mockScene(page, 'ai', 900);
    await toCapture(page);
    await clearSpies(page);
    await uploadImage(page);
    await expectSpoken(page, t('capture.reading'));
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible({ timeout: 15000 });
    await expectSpoken(page, 'Right Triangle ABC');
  });

  test('PT 8.4 Raw Mode: the raw announcement is spoken and the diagram still opens', async ({ page }) => {
    await installPhoneSpies(page);
    await mockScene(page, 'raw');
    await toCapture(page);
    await clearSpies(page);
    await uploadImage(page);
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible({ timeout: 15000 });
    await expectSpoken(page, t('raw.announce'));
  });

  test('PT 8.5 a failed backend never leaves the student with nothing', async ({ page }) => {
    await installPhoneSpies(page);
    await page.route('**/api/v1/scene', (route) => route.fulfill({ status: 502, body: 'bad gateway' }));
    await toCapture(page);
    await clearSpies(page);
    await uploadImage(page);
    await expect.poll(async () => (await spoken(page)).length, { timeout: 20000 }).toBeGreaterThan(1);
    await expect(page.locator('body')).not.toContainText(/undefined|\[object/);
  });
});

test.describe('PT 10 saved diagrams offline', () => {
  test('PT 10.1 to 10.5 a captured diagram is saved, opens with the network off and makes no API call', async ({ page, context }) => {
    await installPhoneSpies(page);
    await mockScene(page, 'ai');
    await toCapture(page);
    await uploadImage(page);
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp('^' + t('common.back')) }).first().click();
    await context.setOffline(true);
    const apiCalls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/')) apiCalls.push(r.url());
    });
    await page.getByRole('button', { name: new RegExp(t('capture.savedDiagrams')) }).first().click();
    await clearSpies(page);
    await page.getByRole('button', { name: new RegExp('^' + t('saved.pin')) }).first().click();
    await expectSpoken(page, tf('saved.pinned.announced', { title: '' }).replace(/\s*pinned\.?$/, '') || 'pinned');
    await page.getByRole('button', { name: new RegExp('^' + t('saved.open')) }).first().click();
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
    expect(apiCalls).toEqual([]);
    const cdp = await page.context().newCDPSession(page);
    const p = await toPage(page, 0.25, 0.55);
    await clearSpies(page);
    await touch(cdp, 'touchStart', p.x, p.y);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__pt.vibrations.filter((v) => v === 80).length)).toBeGreaterThanOrEqual(3);
    await touch(cdp, 'touchEnd');
    await context.setOffline(false);
  });
});

test.describe('PT 11 teacher Correct mode (Teacher tools on)', () => {
  test('PT 11.1 to 11.5 Correct opens, a point can be dragged, Undo and Redo are spoken, Save validates and confirms', async ({ page }) => {
    await installPhoneSpies(page);
    await page.addInitScript(() => window.localStorage.setItem('gt_teacher_enabled', 'true'));
    await page.route('**/api/v1/validate', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scene: TRIANGLE, ok: true, errors: [] }) }),
    );
    await openTriangle(page);
    await clearSpies(page);
    await page.getByRole('button', { name: 'Correct', exact: true }).click();
    await expectSpoken(page, t('correct.intro'));
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no correct canvas');
    const scale = Math.min(box.width, box.height);
    const at = (nx: number, ny: number): { x: number; y: number } => ({
      x: box.x + (box.width - scale) / 2 + nx * scale,
      y: box.y + (box.height - scale) / 2 + ny * scale,
    });
    const from = at(0.7, 0.85); // vertex B
    const to = at(0.75, 0.8);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    await expectSpoken(page, t('correct.pointMoved'));
    await clearSpies(page);
    await page.getByRole('button', { name: new RegExp('^' + t('correct.undo')) }).first().click();
    await expectSpoken(page, t('correct.undo'));
    await page.getByRole('button', { name: new RegExp('^' + t('correct.redo')) }).first().click();
    await expectSpoken(page, t('correct.redo'));
    await page.getByRole('button', { name: new RegExp('^' + t('correct.save')) }).first().click();
    await expectSpoken(page, t('correct.saved'));
  });
});

test.describe('PT 13 Guide my finger by voice (Guide switched on)', () => {
  test('PT 13.1/13.7 "take me to B" starts guiding, "stop" cancels it with the spoken line', async ({ page }) => {
    await installPhoneSpies(page);
    await page.addInitScript(() => window.localStorage.setItem('gt_guide_enabled', 'true'));
    await openTriangle(page);
    await say(page, 'take me to B');
    await clearSpies(page);
    await page.getByRole('button', { name: /^(Ask|Voice)/i }).first().click();
    await expectSpoken(page, tf('guide.start', { label: 'B' }));
    await say(page, 'stop');
    await clearSpies(page);
    await page.getByRole('button', { name: /^(Ask|Voice)/i }).first().click();
    await expectSpoken(page, t('guide.stopped'));
  });

  test('PT 13.8 Back while guiding stops the guide and stays in Explore', async ({ page }) => {
    await installPhoneSpies(page);
    await page.addInitScript(() => window.localStorage.setItem('gt_guide_enabled', 'true'));
    await openTriangle(page);
    await say(page, 'take me to B');
    await page.getByRole('button', { name: /^(Ask|Voice)/i }).first().click();
    await expectSpoken(page, tf('guide.start', { label: 'B' }));
    await clearSpies(page);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expectSpoken(page, t('guide.stopped'));
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
  });
});

test.describe('PT 14 teacher route, share link offline, bad link', () => {
  async function teacherPage(page: Page): Promise<void> {
    await page.addInitScript(() => window.localStorage.setItem('gt_teacher_enabled', 'true'));
  }

  test('PT 14.1 #/teach opens the teacher editor when Teacher tools are on', async ({ page }) => {
    await teacherPage(page);
    await page.goto('/#/teach');
    await expect(page.locator('body')).toContainText(t('teach.markVerified'));
  });

  test('PT 14.1b #/teach is ignored when Teacher tools are off', async ({ page }) => {
    await page.goto('/#/teach');
    await expect(page.locator('body')).not.toContainText(t('teach.markVerified'));
  });

  test('PT 14.5 to 14.7 a share link opens cold with the network off, and a truncated link is refused', async ({ browser }) => {
    const link = shareUrl('http://localhost:4173', encodeShare({ v: 1, scene: TRIANGLE as never, verifiedBy: 'Mrs. Patel', note: 'Verified for Class 9', verifiedAt: new Date().toISOString() }));
    expect(link).toContain('#s=');
    const guest = await browser.newContext({ viewport: { width: 384, height: 832 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const gp = await guest.newPage();
    await installPhoneSpies(gp);
    await gp.addInitScript(() => window.localStorage.setItem('gt_teacher_enabled', 'true'));
    await gp.goto('/');
    await gp.locator('.gt-start-surface').click();
    await guest.setOffline(true);
    // Offline: a fragment change is a same-document navigation, so no page load is needed (a real offline reload
    // needs the service worker, which this test setup blocks on purpose: that part is for the phone, row 14.6).
    await gp.evaluate((h) => { window.location.hash = h; }, new URL(link).hash);
    await expect(gp.locator('body')).toContainText(/Patel|not checked|Right Triangle/i, { timeout: 15000 });
    await gp.evaluate(() => { window.location.hash = ''; });
    await gp.evaluate((h) => { window.location.hash = h; }, new URL(link).hash.slice(0, -20));
    await expect(gp.locator('body')).not.toContainText(/Mrs\. Patel/i);
    await guest.close();
  });
});
