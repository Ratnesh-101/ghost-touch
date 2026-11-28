import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { toPage } from './support/phoneSpies';

/**
 * End-to-end regression tests for:
 * 1. Raw Mode scene loading via /api/v1/scene page.route mock (Item 5):
 *    - Help button speaks the Raw Mode warning sentence (Requirement 50.8)
 *    - Highlight is active and identifies raw segments and polylines
 * 2. Bar chart and Sine highlight IDs (Item 5):
 *    - Bar chart: bar:q2 (interior and top edge), axis:x-axis, axis:y-axis
 *    - Sine graph: polyline:sine_curve at peak, axis:x-axis, axis:y-axis
 * 3. Help with Guide enabled speaks guide and stop guidance (Item 5 / Requirement 50)
 * 4. Guide active suppresses highlight ("no highlight while guiding", Requirement 49)
 */

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 0 }],
  });
}

async function waitForExploreCanvas(page: Page): Promise<void> {
  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-highlight', 'none');
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return Boolean(box && box.width > 0 && box.height > 0);
  }).toBe(true);
}

async function openSample(page: Page, sampleButtonName: RegExp): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
  await page.getByRole('button', { name: sampleButtonName }).click();
  await waitForExploreCanvas(page);
}

test.describe('Raw Mode, Guide, and Multi-Chart highlight e2e specifications', () => {
  test('Raw scene via page.route of /api/v1/scene: Help includes Raw sentence, highlight on raw segment', async ({
    page,
  }) => {
    const rawScene = {
      version: 1,
      kind: 'unknown',
      title: 'Raw outlines',
      points: [
        { id: 'p1', x: 0.2, y: 0.3 },
        { id: 'p2', x: 0.8, y: 0.3 },
      ],
      segments: [{ id: 's1', a: 'p1', b: 'p2' }],
      polylines: [{ id: 'r1', points: [[0.2, 0.6], [0.5, 0.4], [0.8, 0.6]] }],
      bars: [],
      axes: null,
      facts: [],
      aspect: 1.0,
    };

    // Route /api/v1/scene to return a Raw scene response.
    // Note: bypassCSP: true is configured in playwright.config.ts to prevent CSP header blocking.
    await page.route('**/api/v1/scene', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scene: rawScene,
          mode: 'raw',
          reason: 'unreadable',
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();

    // Trigger file chooser upload via "Choose image"
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Choose image/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'diagram.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ),
    });

    await waitForExploreCanvas(page);
    const canvas = page.locator('canvas.gt-explore__canvas');
    const cdp = await page.context().newCDPSession(page);

    // Help button speaks Help sentences including the Raw Mode sentence (Requirement 50.8)
    const help = page.getByRole('button', { name: 'Help', exact: true });
    await expect(help).toBeVisible();
    await help.tap();
    const statusLine = page.locator('.gt-explore__status');
    await expect(statusLine).toContainText('This diagram is only rough outlines. Labels may be missing.');

    // Highlight on raw segment s1 (midpoint of p1(0.2, 0.3) and p2(0.8, 0.3) is (0.5, 0.3))
    const s1Mid = await toPage(page, 0.5, 0.3);
    await touch(cdp, 'touchStart', s1Mid.x, s1Mid.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'segment:s1');

    // Highlight on raw polyline r1 (peak at (0.5, 0.4))
    const r1Peak = await toPage(page, 0.5, 0.4);
    await touch(cdp, 'touchMove', r1Peak.x, r1Peak.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'polyline:r1');

    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('bar chart highlight ids: bar:q2 (interior and top edge), axis:x-axis and axis:y-axis', async ({ page }) => {
    await openSample(page, /bar chart/i);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');

    // q2 coordinates: x0: 0.32, x1: 0.47, y_top: 0.44, y_base: 0.85
    // 1. Interior of bar q2 (x=0.40, y=0.60)
    const q2Interior = await toPage(page, 0.4, 0.6);
    await touch(cdp, 'touchStart', q2Interior.x, q2Interior.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'bar:q2');

    // 2. Top edge of bar q2 (x=0.40, y=0.44)
    const q2TopEdge = await toPage(page, 0.4, 0.44);
    await touch(cdp, 'touchMove', q2TopEdge.x, q2TopEdge.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'bar:q2');

    // 3. Y-axis: y_axis_x: 0.1, touch at (0.1, 0.2)
    const yAxisPt = await toPage(page, 0.1, 0.2);
    await touch(cdp, 'touchMove', yAxisPt.x, yAxisPt.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'axis:y-axis');

    // 4. X-axis: x_axis_y: 0.85, touch left of y-axis at (0.05, 0.85)
    const xAxisPt = await toPage(page, 0.05, 0.85);
    await touch(cdp, 'touchMove', xAxisPt.x, xAxisPt.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'axis:x-axis');

    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('sine curve highlight ids: polyline:sine_curve at peak, axis:x-axis and axis:y-axis', async ({ page }) => {
    await openSample(page, /sine/i);
    const cdp = await page.context().newCDPSession(page);
    const canvas = page.locator('canvas.gt-explore__canvas');

    // Peak of sine curve: x=0.302, y=0.20
    const sinePeak = await toPage(page, 0.302, 0.2);
    await touch(cdp, 'touchStart', sinePeak.x, sinePeak.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'polyline:sine_curve');

    // Y-axis on sine: x=0.08, touch at (0.08, 0.10)
    const yAxisPt = await toPage(page, 0.08, 0.1);
    await touch(cdp, 'touchMove', yAxisPt.x, yAxisPt.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'axis:y-axis');

    // X-axis on sine: x_axis_y: 0.5, touch at (0.04, 0.50)
    const xAxisPt = await toPage(page, 0.04, 0.5);
    await touch(cdp, 'touchMove', xAxisPt.x, xAxisPt.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'axis:x-axis');

    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });

  test('Help with Guide on speaks guide and stop instructions into status line', async ({ page }) => {
    // Enable Guide feature setting in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('gt_guide_enabled', 'true');
    });

    await openSample(page, /triangle/i);
    const help = page.getByRole('button', { name: 'Help', exact: true });
    await expect(help).toBeVisible();
    await help.tap();

    const statusLine = page.locator('.gt-explore__status');
    // Guide on includes help.guide and help.stop
    await expect(statusLine).toContainText('Say take me to');
    await expect(statusLine).toContainText('Say stop to end guiding');
  });

  test('no highlight while guiding: canvas data-highlight remains none during active guide', async ({ page }) => {
    // Enable Guide in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('gt_guide_enabled', 'true');
      // Make the Ask text fallback deterministic: Chromium ships webkitSpeechRecognition,
      // so without this the form appears only if a speech-service error arrives in time.
      Reflect.deleteProperty(window, 'SpeechRecognition');
      Reflect.deleteProperty(window, 'webkitSpeechRecognition');
    });

    // Mock /api/v1/ask to return guide target for corner B
    await page.route('**/api/v1/ask', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'Corner B is at the bottom right.',
          source: 'ai',
          target: { elementId: 'B' },
        }),
      });
    });

    await openSample(page, /triangle/i);
    const canvas = page.locator('canvas.gt-explore__canvas');
    const cdp = await page.context().newCDPSession(page);

    // Initial check: touch on B gives vertex:B
    const b = await toPage(page, 0.7, 0.85);
    await touch(cdp, 'touchStart', b.x, b.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    // Trigger Ask: click Ask button; headless speech listen fails and reveals text fallback form
    const askBtn = page.getByRole('button', { name: 'Ask', exact: true });
    await askBtn.click();

    // Fill question in text input and send
    const askInput = page.locator('input.gt-explore__ask-input');
    await expect(askInput).toBeVisible();
    await askInput.fill('Where is corner B?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();

    // Guide me offer button appears
    const guideMeBtn = page.getByRole('button', { name: 'Guide me', exact: true });
    await expect(guideMeBtn).toBeVisible();
    await guideMeBtn.click();

    // Guiding is now active (status says guiding towards B)
    const statusLine = page.locator('.gt-explore__status');
    await expect(statusLine).toContainText('B');

    // Requirement 49: No highlight while guiding.
    // Start away from the guided target (corner B): touching the target is the arrival and
    // ends guiding, after which the highlight is correctly back (that is not what is tested here).
    const a = await toPage(page, 0.25, 0.25); // corner A, a vertex that would highlight as vertex:A
    await touch(cdp, 'touchStart', a.x, a.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    const midCA = await toPage(page, 0.25, 0.55); // on side CA, would highlight as segment:CA
    await touch(cdp, 'touchMove', midCA.x, midCA.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');

    // Stop guide by clicking Back (Req 50 / Guide cancel)
    const backBtn = page.getByRole('button', { name: 'Back', exact: true });
    await backBtn.click();

    // After guiding is stopped, highlight is restored: touch on corner B produces vertex:B
    await touch(cdp, 'touchStart', b.x, b.y);
    await expect(canvas).toHaveAttribute('data-highlight', 'vertex:B');
    await touch(cdp, 'touchEnd');
    await expect(canvas).toHaveAttribute('data-highlight', 'none');
  });
});
