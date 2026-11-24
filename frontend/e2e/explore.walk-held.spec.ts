import { test, expect, type Page } from '@playwright/test';
import { t } from '../src/i18n';
import { clearSpies, expectSpoken, installPhoneSpies, say, toPage, touch } from './support/phoneSpies';

async function openSample(page: Page, sample: RegExp): Promise<void> {
  await page.goto('/');
  await page.locator('.gt-start-surface').click();
  await page.getByRole('button', { name: sample }).first().click();
  await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
  await page.waitForTimeout(300);
}

test.describe('Explore walk held touch (task 89)', () => {
  test('a perfectly still finger during Your turn gives the answer after two rests', async ({ page }) => {
    test.setTimeout(120000);
    await installPhoneSpies(page);
    await openSample(page, /triangle/i);
    const cdp = await page.context().newCDPSession(page);
    await page.getByRole('button', { name: t('walk.start') }).click();

    // Complete the walk steps to reach "Your turn"
    const spots: Array<[number, number]> = [
      [0.25, 0.55],
      [0.475, 0.85],
      [0.25, 0.85],
      [0.475, 0.55],
    ];
    for (const [nx, ny] of spots) {
      await page.getByRole('button', { name: t('walk.next') }).click();
      await page.waitForTimeout(150);
      const p = await toPage(page, nx, ny);
      await touch(cdp, 'touchStart', p.x, p.y);
      await page.waitForTimeout(500);
      await touch(cdp, 'touchEnd');
    }

    // Advance to "Your turn"
    await page.getByRole('button', { name: t('walk.next') }).click();
    await expectSpoken(page, 'Your turn');
    await clearSpies(page);

    // Rest perfectly still for 1.3 s on two wrong sides (no touchMove)
    for (const [nx, ny] of [
      [0.25, 0.55],
      [0.475, 0.85],
    ] as Array<[number, number]>) {
      const w = await toPage(page, nx, ny);
      await touch(cdp, 'touchStart', w.x, w.y);
      await page.waitForTimeout(1300);
      await touch(cdp, 'touchEnd');
      await page.waitForTimeout(150);
    }

    // Verify spoken answer contains "It is AB"
    await expectSpoken(page, 'It is AB');
  });
});
