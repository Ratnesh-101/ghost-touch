import { test, expect, type Page, type CDPSession } from '@playwright/test';

/**
 * End-to-end tests for Ghost Hand Build workflow (Requirement 52, task 86).
 *
 * Runs in Galaxy S24+ emulation with real touch, mobile viewports, and CDP events:
 * - Start -> Capture -> Make my own graph
 * - Sliders change by keyboard and expose aria-valuetext
 * - Pin three points (x 1 y 1, x 2 y 3, x 3 y 5)
 * - Stitch in order
 * - Feel opens Explore canvas with data-pins and data-mode
 * - CDP touch on a pin speaks its label into the status line
 * - Back returns to the form with pins kept
 * - Back from the form with pins asks for confirmation
 * - Responsive layout at 320 px width (no horizontal scroll) and >=48x48 px buttons
 */

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 0 }],
  });
}

async function toPage(page: Page, nx: number, ny: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas.gt-explore__canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  const scale = Math.min(box.width, box.height);
  return {
    x: box.x + (box.width - scale) / 2 + nx * scale,
    y: box.y + (box.height - scale) / 2 + ny * scale,
  };
}

test.describe('Ghost Hand Build Screen End-to-End', () => {
  test('full build workflow: slider keyboard navigation, pinning 3 points, stitch, feel touch, and back confirmation', async ({
    page,
  }) => {
    // 1. Start -> Capture -> Make my own graph
    await page.goto('/');
    const startBtn = page.locator('.gt-start-surface');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    const makeGraphBtn = page.getByRole('button', { name: 'Make my own graph' });
    await expect(makeGraphBtn).toBeVisible();
    await makeGraphBtn.click();

    const root = page.locator('[data-testid="build-root"]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-mode', 'form');
    await expect(root).toHaveAttribute('data-pins', '0');

    // 2. Sliders change by keyboard and expose aria-valuetext
    const xSlider = page.locator('input[type="range"]').first();
    const ySlider = page.locator('input[type="range"]').nth(1);

    await xSlider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(xSlider).toHaveAttribute('aria-valuetext', 'x 1');

    await ySlider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(ySlider).toHaveAttribute('aria-valuetext', 'y 1');

    // 3. Pin three points (x 1 y 1, x 2 y 3, x 3 y 5)
    // Point 1: (1, 1)
    const pinBtn = page.getByRole('button', { name: 'Pin', exact: true });
    await pinBtn.click();
    await expect(root).toHaveAttribute('data-pins', '1');

    // Point 2: (2, 3)
    await xSlider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(xSlider).toHaveAttribute('aria-valuetext', 'x 2');

    await ySlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(ySlider).toHaveAttribute('aria-valuetext', 'y 3');

    await pinBtn.click();
    await expect(root).toHaveAttribute('data-pins', '2');

    // Point 3: (3, 5)
    await xSlider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(xSlider).toHaveAttribute('aria-valuetext', 'x 3');

    await ySlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(ySlider).toHaveAttribute('aria-valuetext', 'y 5');

    await pinBtn.click();
    await expect(root).toHaveAttribute('data-pins', '3');

    // 4. Stitch in order
    const stitchBtn = page.getByRole('button', { name: 'Stitch in order', exact: true });
    await stitchBtn.click();
    await expect(root).toHaveAttribute('data-segments', '2');

    // 5. Feel opens the Explore canvas (data-pins and data-mode)
    const feelBtn = page.getByRole('button', { name: 'Feel', exact: true });
    await feelBtn.click();
    await expect(root).toHaveAttribute('data-mode', 'feel');
    await expect(root).toHaveAttribute('data-pins', '3');

    const canvas = page.locator('canvas.gt-explore__canvas');
    await expect(canvas).toBeVisible();

    // 6. Touch on a pin speaks its label in the status line
    // Pin 3 is at (3, 5) -> norm coords nx = 3/6 = 0.5, ny = 1 - 5/8 = 0.375
    const cdp = await page.context().newCDPSession(page);
    const pt = await toPage(page, 0.5, 0.375);
    await touch(cdp, 'touchStart', pt.x, pt.y);
    await page.waitForTimeout(200);
    await touch(cdp, 'touchEnd', pt.x, pt.y);

    const status = page.locator('.gt-explore__status');
    await expect(status).toContainText('x 3 y 5');

    // 7. Back returns to the form with the pins kept (data-pins 3)
    const exploreBack = page.locator('.gt-explore__back');
    await exploreBack.click();
    await expect(root).toHaveAttribute('data-mode', 'form');
    await expect(root).toHaveAttribute('data-pins', '3');

    // 8. Back from the form with pins asks for confirmation
    let dialogHandled = false;
    page.once('dialog', async (dialog) => {
      dialogHandled = true;
      expect(dialog.message()).toContain('Leave without handing in');
      await dialog.dismiss();
    });

    const formBack = page.locator('.gt-build__header .gt-build__button');
    await formBack.click();
    expect(dialogHandled).toBe(true);

    // After dismiss: stayed in form
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-mode', 'form');

    // Now accept confirmation to exit to Capture
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await formBack.click();
    await expect(page.locator('.gt-capture')).toBeVisible();
  });

  test('no horizontal scroll at 320 px width and every Build button at least 48x48 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');

    const startBtn = page.locator('.gt-start-surface');
    await startBtn.click();

    const makeGraphBtn = page.getByRole('button', { name: 'Make my own graph' });
    await makeGraphBtn.click();

    const root = page.locator('[data-testid="build-root"]');
    await expect(root).toBeVisible();

    // Verify no horizontal scroll at 320 px
    const noScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth;
    });
    expect(noScroll).toBe(true);

    // Verify every button is at least 48x48 px
    const buttons = page.locator('[data-testid="build-root"] button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
    }
  });
});
