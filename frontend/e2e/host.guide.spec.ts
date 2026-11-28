import { test, expect, type Page } from '@playwright/test';
import { installPhoneSpies, expectSpoken, spoken, clearSpies } from './support/phoneSpies';
import { openSampleFromStart } from './support/hostProbe';

/**
 * End-to-end checks for Ghost Host (Requirement 53, lane B-e2e), on an emulated Chromium that
 * records what the app asks the browser to speak. It proves the calls and the focus, not how
 * speech sounds or how TalkBack reads it.
 *
 * - 53.1: the Start screen speaks a greeting that names Ghost Host and tells TalkBack users to
 *   double-tap.
 * - 53.2 / 53.3: tapping Start speaks one next-step line for Capture that names the choices and
 *   says samples work without internet.
 * - 53.5: an Ask failure speaks a plain action and moves focus to the typing box.
 * - 53.6: the second failure in a row carries no joke clause.
 */

const ASK_ROUTE = '**/api/v1/ask';

test.describe('Ghost Host, Requirement 53', () => {
  test('Start speaks a greeting that names Ghost Host and says double-tap', async ({ page }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await expectSpoken(page, 'Ghost Host');
    const lines = await spoken(page);
    const greeting = lines.find((l) => l.includes('Ghost Host'));
    expect(greeting).toBeDefined();
    expect(greeting).toMatch(/double-tap/i);
    expect(greeting).toMatch(/diagrams into touch and sound/i);
    // Spoken at most once per screen opening.
    expect(lines.filter((l) => l.includes('Ghost Host'))).toHaveLength(1);
  });

  test('tapping Start speaks one Capture next-step line naming the choices and offline samples', async ({
    page,
  }) => {
    await installPhoneSpies(page);
    await page.goto('/');
    await expectSpoken(page, 'Ghost Host');
    await clearSpies(page);

    await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();

    await expectSpoken(page, 'Samples work without internet');
    const lines = await spoken(page);
    const next = lines.filter((l) => /photo/i.test(l) && /sample/i.test(l));
    expect(next).toHaveLength(1);
    expect(next[0]).toMatch(/photo/i);
    expect(next[0]).toMatch(/choose an image/i);
    expect(next[0]).toMatch(/try a sample/i);
    // The greeting is replaced by the first tap, not repeated.
    expect(lines.some((l) => l.includes('Ghost Host'))).toBe(false);
  });

  test('an Ask error speaks a plain action and focuses the typing box', async ({ page }) => {
    // The fake recogniser has nothing queued, so the first listen reports "no speech".
    await installPhoneSpies(page);
    await page.goto('/');
    await openSampleFromStart(page, /triangle/i);
    await clearSpies(page);

    await page.getByRole('button', { name: 'Ask', exact: true }).click();

    await expectSpoken(page, 'box below the diagram');
    const lines = await spoken(page);
    const errorLine = lines.find((l) => l.includes('box below the diagram'));
    expect(errorLine).toBeDefined();
    expect(errorLine).toMatch(/\b(try|type|choose|pick|check|allow|press|wait)\b/i);
    expect(errorLine).not.toMatch(/timed out|server|request|network|permission denied|error|validation/i);

    const input = page.locator('#gt-ask-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('a second failure in a row speaks the plain part only, with no joke', async ({ page }) => {
    await installPhoneSpies(page);
    await page.route(ASK_ROUTE, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }),
    );
    await page.goto('/');
    await openSampleFromStart(page, /triangle/i);

    // Open the typing box through the first (no speech) failure.
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    const input = page.locator('#gt-ask-input');
    await expect(input).toBeFocused();

    const send = page.getByRole('button', { name: 'Send', exact: true });

    await clearSpies(page);
    await input.fill('How long is AB?');
    await send.click();
    await expectSpoken(page, 'type your question');
    await expect(input).toBeFocused();
    const afterFirst = (await spoken(page)).filter((l) => /type your question/i.test(l));
    expect(afterFirst.length).toBeGreaterThan(0);

    await clearSpies(page);
    await input.fill('How long is BC?');
    await send.click();
    await expectSpoken(page, 'type your question');
    await expect(input).toBeFocused();
    const afterSecond = (await spoken(page)).filter((l) => /type your question/i.test(l));
    expect(afterSecond.length).toBeGreaterThan(0);

    for (const line of afterSecond) {
      // Joke clauses are about the creature ("my brain is slow today"); a plain line has none.
      expect(line).not.toMatch(/\bmy\b/i);
      expect(line).not.toMatch(/slow today|brain|creature|stitch/i);
      // Still a plain action, with no "sorry" repeated.
      expect(line).toMatch(/\b(try|type|check|wait)\b/i);
      expect((line.match(/sorry/gi) ?? []).length).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('Ghost Host next-step lines, Requirement 53.24 (task 93.3a)', () => {
  /** The screen's line is inside exactly one utterance, and nothing is spoken after it. */
  async function expectOneNextStep(page: Page, next: string): Promise<string> {
    await expectSpoken(page, next);
    const lines = await spoken(page);
    const withNext = lines.filter((l) => l.includes(next));
    expect(withNext).toHaveLength(1);
    expect(lines[lines.length - 1]).toBe(withNext[0]);
    return withNext[0] as string;
  }

  async function toCapture(page: Page, teacher = false): Promise<void> {
    await installPhoneSpies(page);
    if (teacher) {
      await page.addInitScript(() => window.localStorage.setItem('gt_teacher_enabled', 'true'));
    }
    await page.goto('/');
    await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
    await expectSpoken(page, 'Samples work without internet');
  }

  test('Settings speaks "Settings opened" and its next step as one utterance, with no live region', async ({
    page,
  }) => {
    await toCapture(page);
    await clearSpies(page);
    await page.locator('.gt-capture__button--settings').click();
    const line = await expectOneNextStep(page, 'Choose your language and speech speed');
    expect(line).toMatch(/^Settings opened/);
    expect(line).not.toMatch(/Lab settings/);
    // Speech plus a live region would be read twice by a screen reader.
    await expect(page.locator('[role="dialog"] [aria-live]:not([aria-live="off"])')).toHaveCount(0);
  });

  test('Teach speaks its intro and next step as one utterance', async ({ page }) => {
    await toCapture(page, true);
    await page.locator('.gt-capture__button--settings').click();
    const open = page.getByRole('button', { name: 'Open Teacher Editor' });
    if (!(await open.isVisible())) {
      await page.getByRole('button', { name: /More settings/i }).click();
    }
    await clearSpies(page);
    await open.click();
    const line = await expectOneNextStep(page, 'Choose Add point or Add edge');
    expect(line).toMatch(/^Teacher editor/);
  });

  test('Correct speaks its title and next step, not the older intro', async ({ page }) => {
    await toCapture(page, true);
    await page.getByRole('button', { name: /Sample: triangle/i }).click();
    await expect(page.locator('canvas.gt-explore__canvas')).toBeVisible();
    await clearSpies(page);
    await page.getByRole('button', { name: 'Correct', exact: true }).click();
    const line = await expectOneNextStep(page, 'Choose an element to adjust');
    expect(line).toMatch(/^Teacher Correction/);
    const lines = await spoken(page);
    expect(lines.some((l) => l.includes('Tap elements to select'))).toBe(false);
  });

  test('Saved diagrams speaks one utterance: heading, then the notice when the list is empty', async ({
    page,
  }) => {
    // A fresh browser profile has no saved diagrams, so this is the empty case. The list case
    // (heading, next step, titles) is covered in tests/b.nextlines.test.tsx.
    await toCapture(page);
    await clearSpies(page);
    await page.getByRole('button', { name: 'Saved diagrams', exact: true }).click();
    await expectSpoken(page, 'No saved diagrams yet');
    const lines = await spoken(page);
    const entry = lines.filter((l) => l.includes('No saved diagrams yet'));
    expect(entry).toHaveLength(1);
    expect(entry[0]).toMatch(/^Saved diagrams\b/);
    expect(lines.some((l) => l === 'Saved diagrams')).toBe(false);
    expect(lines[lines.length - 1]).toBe(entry[0]);
  });

  test('Ask: the typing box opens with one line that says where it is and what to do', async ({ page }) => {
    // No recognition in the browser: pressing Ask opens the box with the "unsupported" line.
    await installPhoneSpies(page, { recognition: 'none' });
    await page.goto('/');
    await openSampleFromStart(page, /triangle/i);
    await clearSpies(page);
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expectSpoken(page, 'box below the diagram');
    const lines = await spoken(page);
    const boxLines = lines.filter((l) => l.includes('box below the diagram'));
    expect(boxLines).toHaveLength(1);
    expect(boxLines[0]).toMatch(/press Send/i);
    expect(lines[lines.length - 1]).toBe(boxLines[0]);
    await expect(page.locator('#gt-ask-input')).toBeFocused();
  });
});
