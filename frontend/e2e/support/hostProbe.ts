import { expect, type Page } from '@playwright/test';

/**
 * Probes for e2e/host.guide.spec.ts and e2e/a11y.screens.spec.ts (lane B-e2e). They only read the
 * DOM: accessible names, target sizes and horizontal overflow. Emulated Chromium, NOT TalkBack, so
 * "has an accessible name" means a name a screen reader could read, not that it reads well.
 */

export const MIN_TARGET_PX = 48;
/** Sub-pixel layout can give 47.99; anything under this is a real shortfall. */
const TARGET_TOLERANCE_PX = 0.5;

export interface ControlProblem {
  readonly control: string;
  readonly problem: string;
}

/** Controls with no accessible name, or a visible box smaller than 48 x 48 CSS px. */
export async function controlProblems(page: Page): Promise<ControlProblem[]> {
  return page.evaluate(
    ({ min, tol }) => {
      const selector =
        'button, a[href], input:not([type="hidden"]):not([type="file"]), select, textarea, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
      const out: Array<{ control: string; problem: string }> = [];
      const textOf = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      const nameOf = (el: Element): string => {
        const aria = el.getAttribute('aria-label')?.trim();
        if (aria) return aria;
        const by = el.getAttribute('aria-labelledby');
        if (by) {
          const joined = by
            .split(/\s+/)
            .map((id) => document.getElementById(id))
            .map((n) => (n ? textOf(n) : ''))
            .join(' ')
            .trim();
          if (joined) return joined;
        }
        const id = el.getAttribute('id');
        if (id) {
          const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (label && textOf(label)) return textOf(label);
        }
        const wrap = el.closest('label');
        if (wrap && textOf(wrap)) return textOf(wrap);
        const text = textOf(el);
        if (text) return text;
        const title = el.getAttribute('title')?.trim();
        return title ?? '';
      };
      for (const el of Array.from(document.querySelectorAll(selector))) {
        if (el.closest('[aria-hidden="true"]')) continue;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        // Skip visually hidden helpers (1 px clips) and elements outside layout.
        if (rect.width <= 1 || rect.height <= 1) continue;
        const tag = el.tagName.toLowerCase();
        const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
        const label = `${tag}${cls ? `.${cls}` : ''}`;
        const name = nameOf(el);
        if (!name) out.push({ control: label, problem: 'no accessible name' });
        if (rect.width < min - tol || rect.height < min - tol) {
          out.push({
            control: `${label} "${name}"`,
            problem: `target ${rect.width.toFixed(1)} x ${rect.height.toFixed(1)} px`,
          });
        }
      }
      return out;
    },
    { min: MIN_TARGET_PX, tol: TARGET_TOLERANCE_PX },
  );
}

/** Pixels the page is wider than the viewport (0 when nothing overflows sideways). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth);
  });
}

/** Sets the root font size to 200% of the default, as the largest Android font setting would. */
export async function setLargeFont(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
}

/** From Start: tap to begin, then open a sample and wait for the Explore canvas. */
export async function openSampleFromStart(page: Page, sampleName: RegExp): Promise<void> {
  await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
  await page.getByRole('button', { name: sampleName }).click();
  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => {
      const box = await canvas.boundingBox();
      return Boolean(box && box.width > 0 && box.height > 0);
    })
    .toBe(true);
}
