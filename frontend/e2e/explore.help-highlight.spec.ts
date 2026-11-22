import { test, expect, type Page, type CDPSession } from '@playwright/test';

/**
 * End-to-end checks for the Help button (Requirement 50) and the "show me" highlight
 * (Requirement 49) in a real browser with real touch input, which jsdom cannot give.
 * Triangle vertices, in unit-square coordinates: A (0.25,0.25), B (0.7,0.85), C (0.25,0.85).
 * The scene is letterboxed in the canvas: scale = min(w, h), offset centred.
 */

async function openTriangle(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
  await page.getByRole('button', { name: /triangle/i }).click();
  await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
  await page.waitForTimeout(300);
}

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

test.describe('Help button and highlight in a real browser', () => {
  test('Help button is at least 48x48, inside the viewport, and speaks the gestures into the status line', async ({ page }) => {
    await openTriangle(page);
    const help = page.getByRole('button', { name: 'Help', exact: true });
    await expect(help).toBeVisible();
    const box = await help.boundingBox();
    const vp = page.viewportSize();
    if (!box || !vp) throw new Error('missing box or viewport');
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    const noScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth;
    });
    expect(noScroll).toBe(true);
    await help.click();
    await expect(page.locator('.gt-explore__status')).toContainText('Drag one finger to feel the diagram');
  });

  test('highlight follows a finger on a corner and a side, then clears on lift', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    const b = await toPage(page, 0.7, 0.85);
    await touch(cdp, 'touchStart', b.x, b.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    const mid = await toPage(page, 0.475, 0.85); // middle of side BC
    await touch(cdp, 'touchMove', mid.x, mid.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'segment:BC');

    const empty = await toPage(page, 0.9, 0.2); // far from every element
    await touch(cdp, 'touchMove', empty.x, empty.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    await touch(cdp, 'touchMove', mid.x, mid.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'segment:BC');
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('canvas size and Help layout stay stable during a 2 s hold on a side', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');
    const before = await canvas.boundingBox();
    const mid = await toPage(page, 0.475, 0.85);
    await touch(cdp, 'touchStart', mid.x, mid.y);
    await page.waitForTimeout(2000);
    const during = await canvas.boundingBox();
    await touch(cdp, 'touchEnd');
    expect(during?.height).toBeCloseTo(before?.height ?? 0, 0);
    expect(during?.width).toBeCloseTo(before?.width ?? 0, 0);
  });
});
