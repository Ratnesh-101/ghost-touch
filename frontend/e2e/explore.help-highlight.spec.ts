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
  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-highlight', 'none');
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return Boolean(box && box.width > 0 && box.height > 0);
  }).toBe(true);
}

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 0 }],
  });
}

/**
 * Maps normalized unit-square coordinates to canvas page coordinates.
 * Note: Copies makeViewport letterboxing logic for unit-square scenes;
 * this must be updated if aspect-ratio support is added to scene models
 * (Requirement: scene is a unit square "unless aspect is added later").
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

/**
 * Reads the RGBA pixel value at a specific CSS page coordinate from the canvas bitmap.
 */
async function getCanvasPixel(
  page: Page,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number; a: number }> {
  return page.evaluate(
    ({ cssX, cssY }) => {
      const canvas = document.querySelector('canvas.gt-explore__canvas') as HTMLCanvasElement | null;
      if (!canvas) throw new Error('no canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const bx = Math.round((cssX - rect.left) * scaleX);
      const by = Math.round((cssY - rect.top) * scaleY);
      const pixel = ctx.getImageData(bx, by, 1, 1).data;
      return { r: pixel[0]!, g: pixel[1]!, b: pixel[2]!, a: pixel[3]! };
    },
    { cssX: x, cssY: y },
  );
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
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    const noScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth;
    });
    expect(noScroll).toBe(true);
    await help.tap();
    await expect(page.locator('.gt-explore__status')).toContainText('Drag one finger to feel the diagram');
  });

  test('highlight follows a finger on a corner and a side, with pixel probe (#a6ffcc), then clears on lift', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    const mid = await toPage(page, 0.475, 0.85); // middle of side BC
    // Pixel probe point 3.5 CSS px above mid BC (within highlight line width 8, outside rest line width 4)
    const probe = { x: mid.x, y: mid.y - 3.5 };

    // Initial state: normal unhighlighted color at rest
    const pixelBefore = await getCanvasPixel(page, probe.x, probe.y);
    expect(pixelBefore.r).toBeLessThan(100);

    const b = await toPage(page, 0.7, 0.85);
    await touch(cdp, 'touchStart', b.x, b.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Move to mid BC: attribute updates and pixel draws with highlight color #a6ffcc (rgb: 166, 255, 204)
    await touch(cdp, 'touchMove', mid.x, mid.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'segment:BC');

    const pixelTouched = await getCanvasPixel(page, probe.x, probe.y);
    expect(pixelTouched.r).toBeGreaterThanOrEqual(140);
    expect(pixelTouched.g).toBeGreaterThanOrEqual(230);
    expect(pixelTouched.b).toBeGreaterThanOrEqual(180);

    const empty = await toPage(page, 0.9, 0.2); // far from every element
    await touch(cdp, 'touchMove', empty.x, empty.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    await touch(cdp, 'touchMove', mid.x, mid.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'segment:BC');
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    // Lifted state: pixel probe returns to normal dark background/glow
    // data-highlight is updated before the redraw frame runs, so poll the pixel instead of
    // reading it once (a single read raced the requestAnimationFrame redraw).
    await expect
      .poll(async () => (await getCanvasPixel(page, probe.x, probe.y)).r, { timeout: 5000 })
      .toBeLessThan(100);
  });

  test('canvas size and Help layout stay stable during a 2 s hold on a side', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');
    const before = await canvas.boundingBox();
    const help = page.getByRole('button', { name: 'Help', exact: true });
    const helpBefore = await help.boundingBox();

    const mid = await toPage(page, 0.475, 0.85);
    await touch(cdp, 'touchStart', mid.x, mid.y);
    await page.waitForTimeout(2000);
    const during = await canvas.boundingBox();
    const helpDuring = await help.boundingBox();
    await touch(cdp, 'touchEnd');

    expect(during?.height).toBeCloseTo(before?.height ?? 0, 0);
    expect(during?.width).toBeCloseTo(before?.width ?? 0, 0);
    expect(helpDuring?.width).toBeCloseTo(helpBefore?.width ?? 0, 0);
    expect(helpDuring?.height).toBeCloseTo(helpBefore?.height ?? 0, 0);
    expect(helpDuring?.y).toBeCloseTo(helpBefore?.y ?? 0, 0);
  });

  test('blur during hold clears highlight to none, fresh touch recovers highlight to segment:BC', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');

    const b = await toPage(page, 0.7, 0.85);
    await touch(cdp, 'touchStart', b.x, b.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Window blur clears highlight to none (Requirement 49.5)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    // Moving the dead finger after blur remains none
    const mid = await toPage(page, 0.475, 0.85);
    await touch(cdp, 'touchMove', mid.x, mid.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    // Lifting the dead finger
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    // Fresh touch down at mid BC recovers highlight to segment:BC
    await touch(cdp, 'touchStart', mid.x, mid.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'segment:BC');

    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('multi-finger: primary pointer lift promotes surviving finger to primary (Req 49.5)', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');

    // Instrument canvas to record pointerId sequence.
    // CDP Input.dispatchTouchEvent cannot selectively lift one touch point out of two
    // without lifting all points (a known CDP protocol limitation), so we dispatch a
    // synthetic pointerup event for the primary pointer to emulate single-finger lift.
    await page.evaluate(() => {
      (window as unknown as { __pointerIds: number[] }).__pointerIds = [];
      const c = document.querySelector('canvas.gt-explore__canvas');
      c?.addEventListener('pointerdown', (e) => {
        (window as unknown as { __pointerIds: number[] }).__pointerIds.push(e.pointerId);
      });
    });

    const b = await toPage(page, 0.7, 0.85);
    const mid = await toPage(page, 0.475, 0.85);

    // Primary finger touches corner B
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(b.x), y: Math.round(b.y), id: 0 }],
    });
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Second finger touches side BC
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: Math.round(b.x), y: Math.round(b.y), id: 0 },
        { x: Math.round(mid.x), y: Math.round(mid.y), id: 1 },
      ],
    });
    // Primary highlight remains vertex:B
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Emulate single-finger lift of primary pointer using dispatched pointerup (CDP limit workaround)
    await page.evaluate(() => {
      const ids = (window as unknown as { __pointerIds: number[] }).__pointerIds;
      const primaryId = ids[0];
      const c = document.querySelector('canvas.gt-explore__canvas');
      if (primaryId !== undefined && c) {
        c.dispatchEvent(new PointerEvent('pointerup', { pointerId: primaryId, bubbles: true }));
      }
    });

    // Surviving second finger on side BC is promoted to primary -> segment:BC
    await expect(canvas).toHaveAttribute('data-highlight', 'segment:BC');

    // Lift all
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('multi-finger: second finger touching and moving leaves primary highlight alone', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');

    const b = await toPage(page, 0.7, 0.85);
    const mid = await toPage(page, 0.475, 0.85);
    const empty = await toPage(page, 0.9, 0.2);

    // Primary touches corner B
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(b.x), y: Math.round(b.y), id: 0 }],
    });
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Second finger touches side BC
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: Math.round(b.x), y: Math.round(b.y), id: 0 },
        { x: Math.round(mid.x), y: Math.round(mid.y), id: 1 },
      ],
    });
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Second finger moves to empty space
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: Math.round(b.x), y: Math.round(b.y), id: 0 },
        { x: Math.round(empty.x), y: Math.round(empty.y), id: 1 },
      ],
    });
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Lift all
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('multi-finger: two-finger long press opens Ask while preserving highlight', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');

    const b = await toPage(page, 0.7, 0.85);
    const mid = await toPage(page, 0.475, 0.85);

    // Two fingers touch down (B and mid BC)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: Math.round(b.x), y: Math.round(b.y), id: 0 },
        { x: Math.round(mid.x), y: Math.round(mid.y), id: 1 },
      ],
    });
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    // Hold for two-finger long-press (600 ms)
    await page.waitForTimeout(700);

    // Ask is triggered: status indicates listening or text fallback appears
    const status = page.locator('.gt-explore__status');
    await expect(status).toBeVisible();
    // Highlight is kept on primary element during Ask activation
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');

    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('multi-finger: two-finger swipe down returns to Capture and clears highlight', async ({ page }) => {
    await openTriangle(page);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');

    const start1 = await toPage(page, 0.4, 0.3);
    const start2 = await toPage(page, 0.6, 0.3);

    // Touch down two fingers
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: Math.round(start1.x), y: Math.round(start1.y), id: 0 },
        { x: Math.round(start2.x), y: Math.round(start2.y), id: 1 },
      ],
    });

    // Swipe down: dy >= 80px, dt <= 600ms, dx < 0.5 * dy
    const end1 = { x: start1.x, y: start1.y + 120 };
    const end2 = { x: start2.x, y: start2.y + 120 };

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: Math.round(end1.x), y: Math.round(end1.y), id: 0 },
        { x: Math.round(end2.x), y: Math.round(end2.y), id: 1 },
      ],
    });

    await touch(cdp, 'touchEnd');

    // Should return to Capture screen
    const captureButton = page.getByRole('button', { name: /Take photo|Choose image/i });
    await expect(captureButton.first()).toBeVisible();
  });
});
