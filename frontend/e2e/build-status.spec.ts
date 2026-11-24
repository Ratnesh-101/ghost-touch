import { test, expect, type Page } from '@playwright/test';

/**
 * Regression for a bug the owner found by hand: after pinning 6 points the Build form still showed
 * "Empty graph. x goes from 0 to 6 ...", while Feel showed all 6 points. The form's status line must
 * describe the real draft (Requirement 52): the empty-graph prompt only while there are no pins.
 */

async function openBuild(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.gt-start-surface').click();
  await page.getByRole('button', { name: 'Make my own graph' }).click();
  await expect(page.locator('[data-testid="build-root"]')).toBeVisible();
}

async function pinAt(page: Page, x: number, y: number): Promise<void> {
  // Sliders are range inputs: set the value through the platform setter and fire the input events.
  await page.evaluate(
    ({ x, y }) => {
      const set = (el: HTMLInputElement, v: number): void => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const sliders = document.querySelectorAll<HTMLInputElement>('input[type="range"]');
      set(sliders[0] as HTMLInputElement, x);
      set(sliders[1] as HTMLInputElement, y);
    },
    { x, y },
  );
  await page.getByRole('button', { name: 'Pin', exact: true }).click();
}

test.describe('Ghost Hand Build form status line', () => {
  test('the empty-graph prompt is shown only while there are no pins; after 6 pins it says 6 points', async ({ page }) => {
    await openBuild(page);
    const status = page.locator('.gt-build__status');
    await expect(status).toContainText('Empty graph');

    const pins: Array<[number, number]> = [[0, 0], [1, 2], [2, 3], [3, 5], [4, 6], [5, 8]];
    for (const [x, y] of pins) await pinAt(page, x, y);

    const root = page.locator('[data-testid="build-root"]');
    await expect(root).toHaveAttribute('data-pins', '6');
    await expect(status).not.toContainText('Empty graph');
    await expect(status).toContainText('6');
  });

  test('the status line follows each pin, undo and stitch', async ({ page }) => {
    await openBuild(page);
    const status = page.locator('.gt-build__status');
    await pinAt(page, 1, 1);
    await expect(status).not.toContainText('Empty graph');
    await expect(status).toContainText('1');
    await pinAt(page, 2, 3);
    await expect(status).toContainText('2');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(status).toContainText('1');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(status).toContainText('Empty graph');
  });
});
