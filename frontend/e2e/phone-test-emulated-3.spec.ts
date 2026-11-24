import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { t, tf } from '../src/i18n';
import { clearSpies, expectSpoken, installPhoneSpies, say, spoken, toPage, touch, vibrations } from './support/phoneSpies';

/**
 * docs/PHONE_TEST.md steps 16 to 18, the rows a browser can check (third part of the Playwright
 * pass over the phone test). Emulated Chrome, fake speech recogniser, mocked backend: it checks what the
 * app speaks and does, never a motor, a voice or TalkBack.
 */

const TRIANGLE = JSON.parse(readFileSync('public/samples/triangle.json', 'utf-8')) as unknown;

async function openSample(page: Page, sample: RegExp): Promise<void> {
  await page.goto('/');
  await page.locator('.gt-start-surface').click();
  await page.getByRole('button', { name: sample }).first().click();
  await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
  await page.waitForTimeout(300);
}

const ASK = /^(Ask|Voice)/i;

async function voice(page: Page, phrase: string): Promise<void> {
  await say(page, phrase);
  await page.getByRole('button', { name: ASK }).first().click();
}

test.describe('PT 16 Help button', () => {
  test('PT 16.4 a touch that does not end on Help speaks nothing', async ({ page }) => {
    await installPhoneSpies(page);
    await openSample(page, /triangle/i);
    const cdp = await page.context().newCDPSession(page);
    const box = await page.getByRole('button', { name: 'Help', exact: true }).boundingBox();
    if (!box) throw new Error('no help box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await clearSpies(page);
    await touch(cdp, 'touchStart', cx, cy);
    await touch(cdp, 'touchMove', cx, cy - 200);
    await touch(cdp, 'touchEnd');
    await page.waitForTimeout(500);
    expect((await spoken(page)).join(' ')).not.toContain(t('help.touch'));
  });

  test('PT 16.7 Help while Guide is guiding speaks and does not stop the guide', async ({ page }) => {
    await installPhoneSpies(page);
    await page.addInitScript(() => window.localStorage.setItem('gt_guide_enabled', 'true'));
    await openSample(page, /triangle/i);
    await voice(page, 'take me to B');
    await expectSpoken(page, tf('guide.start', { label: 'B' }));
    await clearSpies(page);
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await expectSpoken(page, t('help.touch'));
    expect((await spoken(page)).join(' ')).not.toContain(t('guide.stopped'));
  });
});

test.describe('PT 17 Planchette (Walk me through)', () => {
  test('PT 17.1 to 17.4, 17.7: triangle walk, steps only on reaching the part, next step, repeat, Your turn with wrong touches', async ({ page }) => {
    test.setTimeout(120000);
    await installPhoneSpies(page);
    await openSample(page, /triangle/i);
    const cdp = await page.context().newCDPSession(page);
    const at = async (nx: number, ny: number): Promise<{ x: number; y: number }> => toPage(page, nx, ny);

    await clearSpies(page);
    await page.getByRole('button', { name: t('walk.start') }).click();
    await expectSpoken(page, 'Find side CA');

    // A touch on the wrong place gives no step sentence.
    const wrong = await at(0.8, 0.2);
    await touch(cdp, 'touchStart', wrong.x, wrong.y);
    await page.waitForTimeout(500);
    await touch(cdp, 'touchEnd');
    expect((await spoken(page)).join(' ')).not.toContain('Side CA is');

    // Reaching side CA speaks its sentence.
    const ca = await at(0.25, 0.55);
    await touch(cdp, 'touchStart', ca.x, ca.y);
    await expectSpoken(page, 'Side CA is 4');
    await touch(cdp, 'touchEnd');

    // "next step" by voice, then repeat.
    await clearSpies(page);
    await voice(page, 'next step');
    await expectSpoken(page, 'Find side BC');
    await clearSpies(page);
    await voice(page, 'repeat');
    await expectSpoken(page, 'Find side BC');

    // Next before the part is reached repeats the prompt, it never moves on.
    await clearSpies(page);
    await voice(page, 'next step');
    await expectSpoken(page, 'Find side BC');

    const bc = await at(0.475, 0.85);
    await touch(cdp, 'touchStart', bc.x, bc.y);
    await expectSpoken(page, 'Side BC is 3');
    await touch(cdp, 'touchEnd');

    await clearSpies(page);
    await page.getByRole('button', { name: t('walk.next') }).click();
    await expectSpoken(page, 'Find corner C');
    const c = await at(0.25, 0.85);
    await touch(cdp, 'touchStart', c.x, c.y);
    await expectSpoken(page, 'right angle');
    await touch(cdp, 'touchEnd');

    await clearSpies(page);
    await page.getByRole('button', { name: t('walk.next') }).click();
    await expect.poll(async () => (await spoken(page)).join(' '), { timeout: 8000 }).toMatch(/across from the right angle|Side AB/i);
    const ab = await at(0.475, 0.55);
    await touch(cdp, 'touchStart', ab.x, ab.y);
    await expectSpoken(page, 'So side AB is 5');
    await touch(cdp, 'touchEnd');

    // Your turn: after the last step "next step" asks the student to find a part.
    await clearSpies(page);
    await page.getByRole('button', { name: t('walk.next') }).click();
    await expectSpoken(page, 'Your turn');
    // Two wrong rests of about a second each. A real finger always jitters a little, so send a 1 px move every
    // 100 ms (a perfectly still finger is covered by the separate finding test below).
    for (const [nx, ny] of [
      [0.475, 0.85],
      [0.25, 0.45],
    ]) {
      const w = await at(nx, ny);
      await touch(cdp, 'touchStart', w.x, w.y);
      for (let k = 0; k < 14; k++) {
        await page.waitForTimeout(100);
        await touch(cdp, 'touchMove', w.x + (k % 2), w.y);
      }
      await touch(cdp, 'touchEnd');
      await page.waitForTimeout(150);
    }
    await expectSpoken(page, 'It is AB');
    // Touching the right side finishes the turn.
    await clearSpies(page);
    await touch(cdp, 'touchStart', ab.x, ab.y);
    await expectSpoken(page, 'Yes, that is AB');
    await touch(cdp, 'touchEnd');
  });

  // Was finding F3: a finger resting perfectly still on a wrong part was never counted as a try. Fixed by task 89
  // (held touch from the keep-alive, lane hi19).
  test('PT 17.4b a perfectly still finger during Your turn gives the answer after two rests (was finding F3, fixed)', async ({ page }) => {
    test.setTimeout(120000);
    await installPhoneSpies(page);
    await openSample(page, /triangle/i);
    const cdp = await page.context().newCDPSession(page);
    await page.getByRole('button', { name: t('walk.start') }).click();
    const spots: Array<[number, number]> = [[0.25, 0.55], [0.475, 0.85], [0.25, 0.85], [0.475, 0.55]];
    for (const [nx, ny] of spots) {
      await page.getByRole('button', { name: t('walk.next') }).click();
      await page.waitForTimeout(150);
      const p = await toPage(page, nx, ny);
      await touch(cdp, 'touchStart', p.x, p.y);
      await page.waitForTimeout(500);
      await touch(cdp, 'touchEnd');
    }
    await page.getByRole('button', { name: t('walk.next') }).click();
    await expectSpoken(page, 'Your turn');
    await clearSpies(page);
    for (const [nx, ny] of [[0.25, 0.55], [0.475, 0.85]] as Array<[number, number]>) {
      const w = await toPage(page, nx, ny);
      await touch(cdp, 'touchStart', w.x, w.y);
      await page.waitForTimeout(1300);
      await touch(cdp, 'touchEnd');
      await page.waitForTimeout(150);
    }
    await expectSpoken(page, 'It is AB');
  });

  test('PT 17.6 stop ends the walk with one line', async ({ page }) => {
    await installPhoneSpies(page);
    await openSample(page, /triangle/i);
    await page.getByRole('button', { name: t('walk.start') }).click();
    await clearSpies(page);
    await voice(page, 'stop');
    await expectSpoken(page, t('walk.stopped'));
    await expect(page.getByRole('button', { name: t('walk.start') })).toBeVisible();
  });

  test('PT 17.10 a walk adds no vibration beyond the normal feel for the same touch', async ({ page, browser }) => {
    await installPhoneSpies(page);
    await openSample(page, /triangle/i);
    const cdp = await page.context().newCDPSession(page);
    const p = await toPage(page, 0.25, 0.55);
    const run = async (): Promise<Array<number | number[]>> => {
      await clearSpies(page);
      await touch(cdp, 'touchStart', p.x, p.y);
      await page.waitForTimeout(500);
      await touch(cdp, 'touchEnd');
      await page.waitForTimeout(200);
      return vibrations(page);
    };
    const without = await run();
    await page.getByRole('button', { name: t('walk.start') }).click();
    const withWalk = await run();
    const kinds = (v: Array<number | number[]>): string[] => [...new Set(v.map((x) => JSON.stringify(x)))].sort();
    expect(kinds(withWalk)).toEqual(kinds(without));
    void browser;
  });

  test('PT 17.11 no walk is offered on the sine sample (the owner request, task 90)', async ({ page }) => {
    await installPhoneSpies(page);
    await openSample(page, /sine/i);
    await expect(page.getByRole('button', { name: t('walk.start') })).toHaveCount(0);
  });

  test('PT 17.12 no Walk me through on a Raw photo', async ({ page }) => {
    await installPhoneSpies(page);
    await page.route('**/api/v1/scene', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scene: TRIANGLE, mode: 'raw', reason: 'unreadable' }) }),
    );
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await page.locator('input[type="file"][aria-label="' + t('capture.chooseImage') + '"]').setInputFiles({
      name: 'd.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
    });
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: t('walk.start') })).toHaveCount(0);
  });

  test('PT 17.13 a long sentence that contains the phrase is a question, not a walk', async ({ page }) => {
    await installPhoneSpies(page);
    await page.route('**/api/v1/ask', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'It is a right triangle.', source: 'ai' }) }),
    );
    await openSample(page, /triangle/i);
    await clearSpies(page);
    await voice(page, 'can you walk me through the proof of this triangle');
    await expectSpoken(page, 'It is a right triangle.');
    await expect(page.getByRole('button', { name: t('walk.start') })).toBeVisible();
  });
});

test.describe('PT 18 Ghost Hand (Make my own graph)', () => {
  async function openBuild(page: Page): Promise<void> {
    await page.goto('/');
    await page.locator('.gt-start-surface').click();
    await page.getByRole('button', { name: t('build.open') }).click();
    await expect(page.locator('[data-testid="build-root"]')).toBeVisible();
  }

  async function pinAt(page: Page, x: number, y: number): Promise<void> {
    await page.evaluate(
      ({ x, y }) => {
        const set = (el: HTMLInputElement, v: number): void => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(el, String(v));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const s = document.querySelectorAll<HTMLInputElement>('input[type="range"]');
        set(s[0] as HTMLInputElement, x);
        set(s[1] as HTMLInputElement, y);
      },
      { x, y },
    );
    await page.getByRole('button', { name: t('build.pin'), exact: true }).click();
  }

  test('PT 18.1/18.2 the screen has sliders with value text, Pin, Undo, Stitch, Feel and Hand in; Feel and Hand in start disabled', async ({ page }) => {
    await installPhoneSpies(page);
    await openBuild(page);
    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(2);
    await sliders.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(sliders.first()).toHaveAttribute('aria-valuetext', /x 1/);
    for (const name of ['build.pin', 'build.undo', 'build.stitch']) {
      const box = await page.getByRole('button', { name: t(name), exact: true }).boundingBox();
      expect(box && box.width >= 48 && box.height >= 48).toBe(true);
    }
    await expect(page.getByRole('button', { name: t('build.feel'), exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: t('build.handIn'), exact: true })).toBeDisabled();
  });

  test('PT 18.3/18.4/18.6/18.7 pin speaks x and y without brackets, an occupied spot is refused, undo removes one, stitch twice changes nothing', async ({ page }) => {
    await installPhoneSpies(page);
    await openBuild(page);
    const root = page.locator('[data-testid="build-root"]');
    await clearSpies(page);
    await pinAt(page, 2, 5);
    await expectSpoken(page, 'x 2 y 5');
    expect((await spoken(page)).join(' ')).not.toMatch(/[()]/);
    await pinAt(page, 2, 5);
    await expect(root).toHaveAttribute('data-pins', '1');
    await expect.poll(async () => (await spoken(page)).join(' '), { timeout: 5000 }).toMatch(/already/i);
    await pinAt(page, 0, 1);
    await pinAt(page, 1, 3);
    await expect(root).toHaveAttribute('data-pins', '3');
    await page.getByRole('button', { name: t('build.stitch'), exact: true }).click();
    await expect(root).toHaveAttribute('data-segments', '2');
    await page.getByRole('button', { name: t('build.stitch'), exact: true }).click();
    await expect(root).toHaveAttribute('data-segments', '2');
    await page.getByRole('button', { name: t('build.undo'), exact: true }).click();
    await expect(root).toHaveAttribute('data-pins', '3');
    await expect(root).toHaveAttribute('data-segments', '0');
    await page.getByRole('button', { name: t('build.undo'), exact: true }).click();
    await expect(root).toHaveAttribute('data-pins', '2');
  });

  test('PT 18.8/18.9/18.11 Feel shows the graph, a pin gives its corner pulse and label, Back keeps the pins', async ({ page }) => {
    await installPhoneSpies(page);
    await openBuild(page);
    const root = page.locator('[data-testid="build-root"]');
    for (const [x, y] of [[0, 1], [1, 3], [2, 5]] as Array<[number, number]>) await pinAt(page, x, y);
    await page.getByRole('button', { name: t('build.feel'), exact: true }).click();
    await expect(root).toHaveAttribute('data-mode', 'feel');
    const cdp = await page.context().newCDPSession(page);
    const p = await toPage(page, 1 / 6, 1 - 3 / 8);
    await clearSpies(page);
    await touch(cdp, 'touchStart', p.x, p.y);
    await expectSpoken(page, 'x 1 y 3');
    expect(await vibrations(page)).toContainEqual([50, 90, 50]);
    await touch(cdp, 'touchEnd');
    await page.locator('.gt-explore__back').click();
    await expect(root).toHaveAttribute('data-mode', 'form');
    await expect(root).toHaveAttribute('data-pins', '3');
  });

  test('PT 18.12/18.13/18.15 Hand in gives a link and a list marked not checked, the link opens on the same pins, and no walk is offered on the draft', async ({ page, browser }) => {
    await installPhoneSpies(page);
    await openBuild(page);
    for (const [x, y] of [[0, 1], [1, 3], [2, 5]] as Array<[number, number]>) await pinAt(page, x, y);
    await page.getByRole('button', { name: t('build.handIn'), exact: true }).click();
    const text = await page.locator('[data-testid="build-handin-text"]').innerText();
    expect(text).toMatch(/x 0 y 1/);
    expect(text).toMatch(/x 2 y 5/);
    expect(text.toLowerCase()).not.toMatch(/verified|approved|correct/);
    const href = await page.locator('[data-testid="build-handin-link"]').getAttribute('href');
    expect(href).toContain('#s=');

    const guest = await browser.newContext({ viewport: { width: 384, height: 832 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const gp = await guest.newPage();
    await installPhoneSpies(gp);
    await gp.goto('/');
    await gp.locator('.gt-start-surface').click();
    await gp.evaluate((h) => { window.location.hash = h; }, new URL(href as string).hash);
    // A shared link opens a gate first (nothing is trusted or shown before the student chooses to open it).
    await gp.getByRole('button', { name: /Open the shared diagram/i }).click();
    await expect(gp.locator('canvas.gt-explore__canvas')).toBeVisible({ timeout: 15000 });
    await expect(gp.getByRole('button', { name: t('walk.start') })).toHaveCount(0);
    await guest.close();
  });

  test('PT 18.14 Hand in and Feel are disabled again after the last pin is undone', async ({ page }) => {
    await installPhoneSpies(page);
    await openBuild(page);
    await pinAt(page, 1, 1);
    await expect(page.getByRole('button', { name: t('build.feel'), exact: true })).toBeEnabled();
    await page.getByRole('button', { name: t('build.undo'), exact: true }).click();
    await expect(page.getByRole('button', { name: t('build.feel'), exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: t('build.handIn'), exact: true })).toBeDisabled();
  });
});
