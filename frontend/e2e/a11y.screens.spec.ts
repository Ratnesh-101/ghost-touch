import { test, expect, type Page } from '@playwright/test';
import {
  controlProblems,
  horizontalOverflow,
  setLargeFont,
  openSampleFromStart,
} from './support/hostProbe';

/**
 * Per-screen accessibility checks on an emulated phone (lane B-e2e, Requirement 53.10 and the
 * accessibility-first principle): every control has an accessible name, every target is at least
 * 48 x 48 CSS px, nothing overflows sideways at an html font size of 200%, and the triangle
 * sample opens with the network switched off. Emulated Chromium, NOT TalkBack.
 */

type Screen = 'start' | 'capture' | 'explore';

const SCREENS: ReadonlyArray<Screen> = ['start', 'capture', 'explore'];

async function showScreen(page: Page, screen: Screen): Promise<void> {
  await page.goto('/');
  if (screen === 'start') {
    await expect(page.getByRole('button', { name: /Ghost Touch.*begin/i })).toBeVisible();
    return;
  }
  if (screen === 'capture') {
    await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
    await expect(page.getByRole('button', { name: /Sample: triangle/i })).toBeVisible();
    return;
  }
  await openSampleFromStart(page, /Sample: triangle/i);
}

test.describe('Per-screen accessibility', () => {
  for (const screen of SCREENS) {
    test(`${screen}: every control has an accessible name and a 48 px target`, async ({ page }) => {
      await showScreen(page, screen);
      expect(await controlProblems(page)).toEqual([]);
    });

    test(`${screen}: no overflow, names and targets hold at html font-size 200%`, async ({ page }) => {
      await showScreen(page, screen);
      await setLargeFont(page);
      await expect.poll(() => horizontalOverflow(page)).toBe(0);
      expect(await controlProblems(page)).toEqual([]);
    });
  }

  test('the triangle sample opens while offline', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Ghost Touch.*begin/i })).toBeVisible();
    await context.setOffline(true);
    await openSampleFromStart(page, /Sample: triangle/i);
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
    await context.setOffline(false);
  });
});
