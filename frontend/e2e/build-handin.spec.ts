import { test, expect } from '@playwright/test';
import { decodeShare } from '../src/share/codec';

/**
 * End-to-end tests for Ghost Hand Hand-in workflow (Requirement 52, task 86, lane hi14).
 *
 * Runs in Galaxy S24+ emulation with mobile viewport and touch interaction:
 * - Start -> Capture -> Make my own graph
 * - Pin 2 points, click Hand in
 * - Link href decodes to draft scene with both points and text lists both pins in stitch order
 * - Text heading says "Not checked" and never contains "verified", "correct", or "approved"
 * - Responsive layout at 320 px width with no horizontal scroll
 * - Every button is >= 48x48 px (including Copy button)
 * - Canvas in Feel is not shifted by Build wrapper padding: canvas left edge equals Explore page padding
 */

test.describe('Ghost Hand Hand-in Screen End-to-End', () => {
  test('pin 2 points, Hand in shows decodable link and point list, copy button exists', async ({
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

    const xSlider = page.locator('input[type="range"]').first();
    const ySlider = page.locator('input[type="range"]').nth(1);
    const pinBtn = page.getByRole('button', { name: 'Pin', exact: true });

    // 2. Pin point 1: (1, 2)
    await xSlider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(xSlider).toHaveAttribute('aria-valuetext', 'x 1');

    await ySlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(ySlider).toHaveAttribute('aria-valuetext', 'y 2');

    await pinBtn.click();
    await expect(root).toHaveAttribute('data-pins', '1');

    // 3. Pin point 2: (3, 5)
    await xSlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(xSlider).toHaveAttribute('aria-valuetext', 'x 3');

    await ySlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(ySlider).toHaveAttribute('aria-valuetext', 'y 5');

    await pinBtn.click();
    await expect(root).toHaveAttribute('data-pins', '2');

    // 4. Hand in
    const handInBtn = page.getByRole('button', { name: 'Hand in', exact: true });
    await expect(handInBtn).toBeVisible();
    await handInBtn.click();

    // 5. Hand-in panel verification
    const panel = page.locator('[data-testid="build-handin-panel"]');
    await expect(panel).toBeVisible();

    const link = page.locator('a[data-testid="build-handin-link"]');
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).not.toBeNull();
    const hash = (href ?? '').split('#s=')[1] ?? '';
    expect(hash.length).toBeGreaterThan(0);

    const decoded = decodeShare(hash);
    expect(decoded.scene.points?.map((p) => p.label)).toEqual(['x 1 y 2', 'x 3 y 5']);

    const textEl = page.locator('[data-testid="build-handin-text"]');
    await expect(textEl).toBeVisible();
    const text = await textEl.textContent();
    expect(text).toContain('A: x 1 y 2');
    expect(text).toContain('B: x 3 y 5');
    expect(text?.toLowerCase()).toContain('not checked');
    expect(/verified|correct|approved/i.test(text ?? '')).toBe(false);

    // 6. Copy button
    const copyBtn = page.getByRole('button', { name: 'Copy link and list', exact: true });
    await expect(copyBtn).toBeVisible();
    const copyBox = await copyBtn.boundingBox();
    expect(copyBox).not.toBeNull();
    if (copyBox) {
      expect(copyBox.width).toBeGreaterThanOrEqual(48);
      expect(copyBox.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('no horizontal scroll at 320 px width and every Build button at least 48x48 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');

    const startBtn = page.locator('.gt-start-surface');
    await startBtn.click();

    const makeGraphBtn = page.getByRole('button', { name: 'Make my own graph' });
    await makeGraphBtn.click();

    const root = page.locator('[data-testid="build-root"]');
    await expect(root).toBeVisible();

    // Pin a point and open hand-in panel
    const pinBtn = page.getByRole('button', { name: 'Pin', exact: true });
    await pinBtn.click();

    const handInBtn = page.getByRole('button', { name: 'Hand in', exact: true });
    await handInBtn.click();

    // Verify no horizontal scroll at 320 px
    const noScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth;
    });
    expect(noScroll).toBe(true);

    // Verify every button in Build is >= 48x48 px
    const buttons = page.locator('[data-testid="build-root"] button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(6); // Back, Pin, Undo, Stitch, Feel, Hand in, Copy

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

  test('canvas in Feel mode is not shifted by Build wrapper padding', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    const startBtn = page.locator('.gt-start-surface');
    await startBtn.click();

    const makeGraphBtn = page.getByRole('button', { name: 'Make my own graph' });
    await makeGraphBtn.click();

    // Pin point
    const pinBtn = page.getByRole('button', { name: 'Pin', exact: true });
    await pinBtn.click();

    // Switch to Feel mode
    const feelBtn = page.getByRole('button', { name: 'Feel', exact: true });
    await feelBtn.click();

    const root = page.locator('[data-testid="build-root"]');
    await expect(root).toHaveAttribute('data-mode', 'feel');

    const canvas = page.locator('canvas.gt-explore__canvas');
    await expect(canvas).toBeVisible();

    // Compare Explore canvas box and Explore container padding
    const { canvasLeft, exploreLeft, explorePaddingLeft, rootPaddingLeft, containerBorderLeft } = await page.evaluate(() => {
      const canvasEl = document.querySelector('canvas.gt-explore__canvas');
      const exploreEl = document.querySelector('.gt-explore');
      const rootEl = document.querySelector('[data-testid="build-root"]');
      const containerEl = document.querySelector('.gt-explore__canvas-container');

      const canvasRect = canvasEl?.getBoundingClientRect();
      const exploreRect = exploreEl?.getBoundingClientRect();
      const exploreStyle = exploreEl ? window.getComputedStyle(exploreEl) : null;
      const rootStyle = rootEl ? window.getComputedStyle(rootEl) : null;

      return {
        canvasLeft: canvasRect?.left ?? 0,
        exploreLeft: exploreRect?.left ?? 0,
        explorePaddingLeft: parseFloat(exploreStyle?.paddingLeft ?? '0'),
        rootPaddingLeft: parseFloat(rootStyle?.paddingLeft ?? '0'),
        containerBorderLeft: containerEl ? parseFloat(window.getComputedStyle(containerEl).borderLeftWidth) || 0 : 0,
      };
    });

    // Root wrapper in feel mode must have 0 padding
    expect(rootPaddingLeft).toBe(0);

    // Canvas left edge equals Explore left edge + Explore page padding + the canvas container's own border (the 2 px outline border), subpixel tolerance <= 1px
    expect(Math.abs(canvasLeft - (exploreLeft + explorePaddingLeft + containerBorderLeft))).toBeLessThanOrEqual(1);

    // No vertical scroll on page during feel mode
    const noVerticalScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollHeight <= el.clientHeight;
    });
    expect(noVerticalScroll).toBe(true);
  });
});
