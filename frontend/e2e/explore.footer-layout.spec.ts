import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end tests for the Explore footer button layout (Requirement 12.1, 25.4, 25.5, 51).
 *
 * Verifies that across English, Hindi, and Gujarati on 320x640, 360x640, and 384x832 viewports:
 * 1. All footer button touch targets are >= 48x48 CSS px.
 * 2. All footer button bounding boxes lie fully inside the viewport.
 * 3. Footer buttons are non-overlapping.
 * 4. Canvas height is >= 40% of viewport height at 360x640 (>= 256 px).
 * 5. Zero horizontal page scroll across all compact widths (no scrollWidth > clientWidth).
 * 6. Landscape at 832x384 remains fully visible without page scroll (lane hi8 layout preserved).
 *
 * Navigation helper matches the pattern from explore.help-highlight.spec.ts.
 */

async function openTriangleWithLang(page: Page, lang?: 'en' | 'hi' | 'gu'): Promise<void> {
  await page.addInitScript((language) => {
    window.localStorage.setItem('gt_teacher_enabled', 'true');
    if (language) {
      window.localStorage.setItem('gt_language', language);
    }
  }, lang);
  await page.goto('/');

  const startBtn = page.getByRole('button', {
    name: /Ghost Touch.*begin|ગોસ્ટ ટચ|શરૂ|शुरू/i,
  });
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  const triangleBtn = page.getByRole('button', {
    name: /triangle|ત્રિકોણ|त्रिभुज/i,
  });
  await expect(triangleBtn).toBeVisible();
  await triangleBtn.click();

  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-highlight', 'none');
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return Boolean(box && box.width > 0 && box.height > 0);
  }).toBe(true);
}

interface ButtonBox {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const LANGUAGES = ['en', 'hi', 'gu'] as const;
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 384, height: 832 },
] as const;

test.describe('Explore footer layout grid (LANE hi15)', () => {
  for (const lang of LANGUAGES) {
    for (const vp of VIEWPORTS) {
      test(`footer buttons layout: ${lang} at ${vp.width}x${vp.height}`, async ({ page }) => {
        await page.setViewportSize(vp);
        await openTriangleWithLang(page, lang);

        // 1. Verify zero horizontal scroll
        const noScroll = await page.evaluate(() => {
          const el = document.scrollingElement ?? document.documentElement;
          return el.scrollWidth <= el.clientWidth + 1 && window.scrollX === 0;
        });
        expect(noScroll, `[${lang} ${vp.width}x${vp.height}] Page must exhibit zero horizontal scroll`).toBe(true);

        // 2. Locate footer buttons inside .gt-explore__actions
        const buttons = page.locator('.gt-explore__actions button');
        const count = await buttons.count();
        expect(count, `[${lang} ${vp.width}x${vp.height}] Expected at least 6 buttons with Teacher tools on`).toBeGreaterThanOrEqual(6);

        const boxes: ButtonBox[] = [];
        for (let i = 0; i < count; i++) {
          const btn = buttons.nth(i);
          await expect(btn).toBeVisible();

          const box = await btn.boundingBox();
          expect(box, `[${lang} ${vp.width}x${vp.height}] Button ${i} bounding box must not be null`).not.toBeNull();
          if (!box) continue;

          const text = (await btn.textContent())?.trim() ?? `button-${i}`;
          boxes.push({ text, x: box.x, y: box.y, width: box.width, height: box.height });

          // Touch target >= 48x48 px (0.5px subpixel tolerance)
          expect(
            box.width,
            `[${lang} ${vp.width}x${vp.height}] Button "${text}" width (${box.width.toFixed(1)}px) must be >= 48px`,
          ).toBeGreaterThanOrEqual(47.5);
          expect(
            box.height,
            `[${lang} ${vp.width}x${vp.height}] Button "${text}" height (${box.height.toFixed(1)}px) must be >= 48px`,
          ).toBeGreaterThanOrEqual(47.5);

          // Bounding box lies fully inside viewport
          expect(
            box.x,
            `[${lang} ${vp.width}x${vp.height}] Button "${text}" left (${box.x.toFixed(1)}px) outside viewport`,
          ).toBeGreaterThanOrEqual(-0.5);
          expect(
            box.y,
            `[${lang} ${vp.width}x${vp.height}] Button "${text}" top (${box.y.toFixed(1)}px) outside viewport`,
          ).toBeGreaterThanOrEqual(-0.5);
          expect(
            box.x + box.width,
            `[${lang} ${vp.width}x${vp.height}] Button "${text}" right (${(box.x + box.width).toFixed(1)}px) exceeds viewport width (${vp.width}px)`,
          ).toBeLessThanOrEqual(vp.width + 0.5);
          expect(
            box.y + box.height,
            `[${lang} ${vp.width}x${vp.height}] Button "${text}" bottom (${(box.y + box.height).toFixed(1)}px) exceeds viewport height (${vp.height}px)`,
          ).toBeLessThanOrEqual(vp.height + 0.5);
        }

        // 3. Buttons are non-overlapping
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!;
            const b = boxes[j]!;
            const tolerance = 0.5;
            const overlapX = a.x < b.x + b.width - tolerance && a.x + a.width > b.x + tolerance;
            const overlapY = a.y < b.y + b.height - tolerance && a.y + a.height > b.y + tolerance;
            const overlaps = overlapX && overlapY;
            expect(
              overlaps,
              `[${lang} ${vp.width}x${vp.height}] Buttons "${a.text}" and "${b.text}" must not overlap ` +
                `(A: [x=${a.x.toFixed(1)}, y=${a.y.toFixed(1)}, w=${a.width.toFixed(1)}, h=${a.height.toFixed(1)}], ` +
                `B: [x=${b.x.toFixed(1)}, y=${b.y.toFixed(1)}, w=${b.width.toFixed(1)}, h=${b.height.toFixed(1)}])`,
            ).toBe(false);
          }
        }

        // 4. Canvas >= 40% of viewport height at 360x640 (256px)
        if (vp.width === 360 && vp.height === 640) {
          const canvasBox = await page.locator('canvas.gt-explore__canvas').boundingBox();
          expect(canvasBox).not.toBeNull();
          if (canvasBox) {
            const minCanvasHeight = vp.height * 0.40;
            expect(
              canvasBox.height,
              `[${lang} ${vp.width}x${vp.height}] Canvas height (${canvasBox.height.toFixed(1)}px) must be >= 40% of viewport (${minCanvasHeight}px)`,
            ).toBeGreaterThanOrEqual(minCanvasHeight - 0.5);
          }
        }
      });
    }
  }

  test('landscape 832x384: every footer button fully visible without page scroll (lane hi8)', async ({ page }) => {
    const vp = { width: 832, height: 384 };
    await page.setViewportSize(vp);
    await openTriangleWithLang(page, 'en');

    const buttons = page.locator('.gt-explore__actions button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(6);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.width).toBeGreaterThanOrEqual(47.5);
      expect(box.height).toBeGreaterThanOrEqual(47.5);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
    }

    const noScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
    });
    expect(noScroll, 'Landscape 832x384 must exhibit zero page scroll').toBe(true);
  });

  test('7 action buttons (including Guide me): containment, non-overlapping, and canvas height >= 230px', async ({ page }) => {
    const vp = { width: 360, height: 640 };
    await page.setViewportSize(vp);
    await openTriangleWithLang(page, 'en');

    await page.evaluate(() => {
      const actions = document.querySelector('.gt-explore__actions');
      if (actions && !actions.querySelector('.gt-explore__guide-me')) {
        const guideBtn = document.createElement('button');
        guideBtn.type = 'button';
        guideBtn.setAttribute('data-testid', 'explore-guide-me');
        guideBtn.className = 'gt-control gt-btn gt-btn--primary gt-explore__guide-me';
        guideBtn.setAttribute('aria-label', 'Guide me');
        guideBtn.textContent = 'Guide me';
        guideBtn.style.minWidth = '48px';
        guideBtn.style.minHeight = '48px';
        actions.insertBefore(guideBtn, actions.firstChild);
      }
    });

    const buttons = page.locator('.gt-explore__actions button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(7);

    const boxes: ButtonBox[] = [];
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      const text = (await btn.textContent())?.trim() ?? `btn-${i}`;
      boxes.push({ text, x: box.x, y: box.y, width: box.width, height: box.height });
      expect(box.width).toBeGreaterThanOrEqual(47.5);
      expect(box.height).toBeGreaterThanOrEqual(47.5);
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const tolerance = 0.5;
        const overlapX = a.x < b.x + b.width - tolerance && a.x + a.width > b.x + tolerance;
        const overlapY = a.y < b.y + b.height - tolerance && a.y + a.height > b.y + tolerance;
        expect(overlapX && overlapY, `Buttons "${a.text}" and "${b.text}" must not overlap`).toBe(false);
      }
    }

    const canvasBox = await page.locator('canvas.gt-explore__canvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    if (canvasBox) {
      expect(canvasBox.height).toBeGreaterThanOrEqual(230);
    }

    const noScroll = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth <= el.clientWidth + 1 && window.scrollX === 0;
    });
    expect(noScroll).toBe(true);
  });
});
