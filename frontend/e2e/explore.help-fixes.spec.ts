import { test, expect, type Page, type CDPSession } from '@playwright/test';

/**
 * End-to-end tests for Lane hi8 Help and landscape fixes:
 * (a) CDP touchStart on corner B then second touchStart on Help button centre then touchEnd:
 *     status contains "Drag one finger to feel the diagram" and canvas data-highlight remains vertex:B until lift.
 * (b) After Help at 320x640 and 384x832: status card scrollHeight <= clientHeight + 1 OR scrollable (overflow-y auto)
 *     and last sentence reachable; modifier class asserted and scrollTop can reach the end.
 * (c) At 832x384 landscape: every footer button bounding box inside viewport, >= 48x48, canvas >= 40% height.
 */

async function openTriangle(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
  await page.getByRole('button', { name: /triangle/i }).click();
  await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
  await page.waitForTimeout(300);
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

test.describe('Lane hi8: Help second-finger touch, status card expansion, landscape layout', () => {
  test('test (a): Help activates on second touch while holding canvas without disturbing primary highlight', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    // Corner B is at unit coordinates (0.7, 0.85)
    const b = await toPage(page, 0.7, 0.85);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(b.x), y: Math.round(b.y), id: 0 }],
    });
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Find Help button center
    const help = page.getByRole('button', { name: 'Help', exact: true });
    await expect(help).toBeVisible();
    const helpBox = await help.boundingBox();
    if (!helpBox) throw new Error('missing Help button bounding box');
    const hx = Math.round(helpBox.x + helpBox.width / 2);
    const hy = Math.round(helpBox.y + helpBox.height / 2);

    // Second touch on Help button center while primary finger holds corner B
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: Math.round(b.x), y: Math.round(b.y), id: 0 },
        { x: hx, y: hy, id: 1 },
      ],
    });

    // Release second finger on Help button
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ x: Math.round(b.x), y: Math.round(b.y), id: 0 }],
    });

    // Status contains gesture hint
    const status = page.locator('.gt-explore__status');
    await expect(status).toContainText('Drag one finger to feel the diagram');

    // Canvas highlight is still vertex:B until primary finger lifts
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Release primary finger
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  for (const vp of [
    { width: 320, height: 640 },
    { width: 384, height: 832 },
  ]) {
    test(`test (b): after Help at ${vp.width}x${vp.height} status card has modifier class and is scrollable to the end`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openTriangle(page);

      const help = page.getByRole('button', { name: 'Help', exact: true });
      await help.click();

      const status = page.locator('.gt-explore__status');
      await expect(status).toContainText('Drag one finger to feel the diagram');

      const card = page.locator('.gt-explore__status-card');
      // Assert modifier class on status card or status text
      await expect(card).toHaveClass(/gt-explore__status--help|gt-explore__status-card--help/);

      // Verify scrollability & that scrollTop can reach the end
      const scrollInfo = await card.evaluate((el) => {
        const isScrollable = el.scrollHeight > el.clientHeight + 1;
        const style = window.getComputedStyle(el);
        if (isScrollable) {
          el.scrollTop = el.scrollHeight;
        }
        return {
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          scrollTop: el.scrollTop,
          maxScroll: el.scrollHeight - el.clientHeight,
          overflowY: style.overflowY,
          isScrollable,
        };
      });

      if (scrollInfo.isScrollable) {
        expect(['auto', 'scroll']).toContain(scrollInfo.overflowY);
        expect(scrollInfo.scrollTop).toBeGreaterThanOrEqual(scrollInfo.maxScroll - 1);
      } else {
        expect(scrollInfo.scrollHeight).toBeLessThanOrEqual(scrollInfo.clientHeight + 1);
      }

      // Last sentence is reachable
      await expect(status).toContainText('Tap Ask to ask a question with your voice');
    });
  }

  test('test (c): at 832x384 landscape every footer button is fully visible (>= 48x48, inside viewport) and canvas >= 40% height', async ({ page }) => {
    await page.setViewportSize({ width: 832, height: 384 });
    await openTriangle(page);

    // Canvas is still at least 40% of the viewport height (384 * 0.4 = 153.6px)
    const canvas = page.locator('canvas.gt-explore__canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThanOrEqual(384 * 0.4);

    // No horizontal page scroll
    const noHorizontalScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth;
    });
    expect(noHorizontalScroll).toBe(true);

    // Every footer button's bounding box is inside the viewport and >= 48x48
    const footerButtons = page.locator('.gt-explore__footer button');
    const count = await footerButtons.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < count; i++) {
      const btn = footerButtons.nth(i);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;

      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(832);
      expect(box.y + box.height).toBeLessThanOrEqual(384);
    }
  });
});
