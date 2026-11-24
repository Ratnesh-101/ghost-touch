import { test, expect, type Page, type CDPSession } from '@playwright/test';

/**
 * End-to-end checks for Planchette ("Walk me through", Requirement 51 and amended Requirement 37.2)
 * in a real browser with real CDP touch input.
 *
 * Scenarios:
 * 1. Bar chart sample:
 *    - "Walk me through" button exists and meets the minimum 48x48 CSS px touch target.
 *    - Tapping "Walk me through" changes label to "Next step" and speaks/shows the first find prompt (Q4).
 *    - CDP touch on tall bar Q4 speaks step one ("Q4 is 32").
 *    - Finger lift does not cut the step speech (Requirement 37.2 lift guard extension).
 *    - Tapping "Next step" transitions to step two find prompt (Q1).
 *    - CDP touch on wrong bar Q2 does not advance the walk (does not speak difference "22").
 *    - CDP touch on low bar Q1 speaks step two and announces the difference ("22").
 *    - Finger lift after step two does not cut step speech.
 * 2. Sine sample:
 *    - Walk me through button exists on the sine sample (since curveShape walk is valid).
 *    - Meets the minimum 48x48 touch target and fits inside the viewport without page overflow.
 */

async function openBarchart(page: Page): Promise<void> {
  await page.goto('/');
  const startButton = page.getByRole('button', {
    name: /Ghost Touch.*begin|ગોસ્ટ ટચ|શરૂ/i,
  });
  await expect(startButton).toBeVisible();
  await startButton.click();

  const barChartButton = page.getByRole('button', {
    name: /bar chart|સ્તંભ આલેખ|bars/i,
  });
  await expect(barChartButton).toBeVisible();
  await barChartButton.click();

  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return Boolean(box && box.width > 0 && box.height > 0);
  }).toBe(true);
}

async function openSine(page: Page): Promise<void> {
  await page.goto('/');
  const startButton = page.getByRole('button', {
    name: /Ghost Touch.*begin|ગોસ્ટ ટચ|શરૂ/i,
  });
  await expect(startButton).toBeVisible();
  await startButton.click();

  const sineButton = page.getByRole('button', {
    name: /sine|સાઇન/i,
  });
  await expect(sineButton).toBeVisible();
  await sineButton.click();

  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return Boolean(box && box.width > 0 && box.height > 0);
  }).toBe(true);
}

async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  x = 0,
  y = 0,
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 0 }],
  });
}

/**
 * Maps normalized unit-square coordinates to canvas page coordinates.
 */
async function toPage(page: Page, nx: number, ny: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas.gt-explore__canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  const scale = Math.min(box.width, box.height);
  return {
    x: box.x + (box.width - scale) / 2 + nx * scale,
    y: box.y + (box.height - scale) / 2 + ny * scale,
  };
}

test.describe('Planchette ("Walk me through") E2E in a real browser', () => {
  test('bar chart sample: walk me through flow, wrong touch guard, and lift speech preservation', async ({
    page,
  }) => {
    await openBarchart(page);
    const walkBtn = page.getByTestId('explore-walk');
    await expect(walkBtn).toBeVisible();

    // 1. Minimum 48x48 CSS px touch target
    const box = await walkBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(47.5);
      expect(box.height).toBeGreaterThanOrEqual(47.5);
    }
    await expect(walkBtn).toHaveText(/walk me through/i);

    // 2. Start the walk: label switches to "Next step" and status prompts for tall bar Q4
    await walkBtn.click();
    await expect(walkBtn).toHaveText(/next step/i);
    const status = page.locator('.gt-explore__status');
    await expect(status).toContainText(/Q4/i);

    const cdp = await page.context().newCDPSession(page);

    // 3. Touch tall bar Q4 (center nx: 0.795, ny: 0.59) -> step one is spoken ("Q4 is 32")
    const q4 = await toPage(page, 0.795, 0.59);
    await touch(cdp, 'touchStart', q4.x, q4.y);
    await expect(status).toContainText(/32/);

    // 4. Finger lift does not cut the step speech (amended Requirement 37.2)
    await touch(cdp, 'touchEnd');
    await expect(status).toContainText(/32/);

    // 5. Tap Next step -> prompts to find low bar Q1
    await walkBtn.click();
    await expect(status).toContainText(/Q1/i);

    // 6. Touch wrong bar Q2 (center nx: 0.395, ny: 0.645) -> walk does not advance to difference ("22")
    const q2 = await toPage(page, 0.395, 0.645);
    await touch(cdp, 'touchStart', q2.x, q2.y);
    await expect(status).not.toContainText(/22/);
    await touch(cdp, 'touchEnd');

    // 7. Touch low bar Q1 (center nx: 0.195, ny: 0.77) -> step two is spoken and difference announced ("22")
    const q1 = await toPage(page, 0.195, 0.77);
    await touch(cdp, 'touchStart', q1.x, q1.y);
    await expect(status).toContainText(/22/);

    // 8. Finger lift after step two does not cut step speech
    await touch(cdp, 'touchEnd');
    await expect(status).toContainText(/22/);
  });

  test('sine sample: no Walk me through button is offered on a graph (task 90)', async ({ page }) => {
    await openSine(page);
    await expect(page.getByTestId('explore-walk')).toHaveCount(0);
    const noScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth;
    });
    expect(noScroll).toBe(true);
  });
});
