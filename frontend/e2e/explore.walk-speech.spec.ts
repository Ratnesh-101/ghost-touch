import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { toPage } from './support/phoneSpies';

/**
 * End-to-end verification for Planchette speech preservation and cancellation (Lane hi16):
 *
 * Spies on `window.speechSynthesis.cancel` and `speak` via `page.addInitScript` to verify:
 * 1. Bar chart sample (Planchette walk):
 *    - Start a walk, touch tall bar Q4 so step one is spoken.
 *    - Lift finger, wait 400 ms, and assert zero `cancel` calls after the `touchEnd` while the step utterance is playing.
 *    - Tap Next step, touch wrong bar Q2, wait 300 ms, and assert 'not 22' before the second bar (Q1) is touched.
 * 2. Triangle sample (Control):
 *    - Touch a corner (Point C) without a walk so the corner label is spoken.
 *    - Lift finger, wait 400 ms, and assert the corner label speech IS cancelled by a lift (`cancel` was called).
 */

declare global {
  interface Window {
    __speechSpy: {
      cancelCount: number;
      speakCount: number;
      utterances: string[];
    };
  }
}

async function installSpeechSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spy = {
      cancelCount: 0,
      speakCount: 0,
      utterances: [] as string[],
    };
    (window as unknown as { __speechSpy: typeof spy }).__speechSpy = spy;

    const synth = window.speechSynthesis;
    if (synth) {
      const origCancel = synth.cancel.bind(synth);
      const origSpeak = synth.speak.bind(synth);

      synth.cancel = () => {
        spy.cancelCount++;
        return origCancel();
      };

      synth.speak = (utterance: SpeechSynthesisUtterance) => {
        spy.speakCount++;
        spy.utterances.push(utterance.text ?? '');
        return origSpeak(utterance);
      };
    }
  });
}

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

async function openTriangle(page: Page): Promise<void> {
  await page.goto('/');
  const startButton = page.getByRole('button', {
    name: /Ghost Touch.*begin|ગોસ્ટ ટચ|શરૂ/i,
  });
  await expect(startButton).toBeVisible();
  await startButton.click();

  const triangleButton = page.getByRole('button', {
    name: /triangle|ત્રિકોણ/i,
  });
  await expect(triangleButton).toBeVisible();
  await triangleButton.click();

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

test.describe('Explore Walk Speech Preservation & Lift Cancellation (hi16)', () => {
  test('bar chart walk step speech is NOT cancelled on lift, and wrong touch 300 ms wait asserts not 22', async ({
    page,
  }) => {
    await installSpeechSpy(page);
    await openBarchart(page);

    const walkBtn = page.getByTestId('explore-walk');
    await expect(walkBtn).toBeVisible();
    await expect(walkBtn).toHaveText(/walk me through/i);

    // 1. Start the walk: label switches to "Next step" and status prompts for tall bar Q4
    await walkBtn.click();
    await expect(walkBtn).toHaveText(/next step/i);
    const status = page.locator('.gt-explore__status');
    await expect(status).toContainText(/Q4/i);

    const cdp = await page.context().newCDPSession(page);

    // 2. Touch tall bar Q4 (nx: 0.795, ny: 0.59) -> step one is spoken ("Q4 is 32")
    const q4 = await toPage(page, 0.795, 0.59);
    await touch(cdp, 'touchStart', q4.x, q4.y);
    await expect(status).toContainText(/32/);
    await expect
      .poll(() => page.evaluate(() => (window.__speechSpy?.utterances ?? []).some((u) => u.includes('32'))))
      .toBe(true);

    // Record cancel call count before lifting finger
    const cancelCountBeforeLift = await page.evaluate(
      () => window.__speechSpy?.cancelCount ?? 0,
    );

    // 3. Lift finger, wait 400 ms, and assert ZERO cancel calls after touchEnd
    await touch(cdp, 'touchEnd');
    await page.waitForTimeout(400);

    const cancelCountAfterLift = await page.evaluate(
      () => window.__speechSpy?.cancelCount ?? 0,
    );
    expect(cancelCountAfterLift - cancelCountBeforeLift).toBe(0);

    // Assert that the utterance was indeed spoken and captured
    const utterances = await page.evaluate(
      () => window.__speechSpy?.utterances ?? [],
    );
    expect(utterances.some((u) => u.includes('32'))).toBe(true);

    // 4. Tap Next step -> prompts to find low bar Q1
    await walkBtn.click();
    await expect(status).toContainText(/Q1/i);

    // 5. Touch wrong bar Q2 (nx: 0.395, ny: 0.645) -> wait 300 ms and assert not 22 before low bar is touched
    const q2 = await toPage(page, 0.395, 0.645);
    await touch(cdp, 'touchStart', q2.x, q2.y);
    await page.waitForTimeout(300);
    await expect(status).not.toContainText(/22/);
    await touch(cdp, 'touchEnd');

    // 6. Touch low bar Q1 (nx: 0.195, ny: 0.77) -> step two is spoken and announces difference ("22")
    const q1 = await toPage(page, 0.195, 0.77);
    await touch(cdp, 'touchStart', q1.x, q1.y);
    await expect(status).toContainText(/22/);
    // The driver cancels the previous utterance right before it speaks the next one. Wait until the
    // step-two utterance has really been handed to speechSynthesis, so that cancel is not counted as a lift cancel.
    await expect
      .poll(() => page.evaluate(() => (window.__speechSpy?.utterances ?? []).some((u) => u.includes('22'))))
      .toBe(true);

    // Lift finger after step two: speech is also preserved
    const cancelCountBeforeLift2 = await page.evaluate(
      () => window.__speechSpy?.cancelCount ?? 0,
    );
    await touch(cdp, 'touchEnd');
    await page.waitForTimeout(400);
    const cancelCountAfterLift2 = await page.evaluate(
      () => window.__speechSpy?.cancelCount ?? 0,
    );
    expect(cancelCountAfterLift2 - cancelCountBeforeLift2).toBe(0);
  });

  test('control: corner label spoken on triangle sample IS cancelled by finger lift', async ({
    page,
  }) => {
    await installSpeechSpy(page);
    await openTriangle(page);

    const cdp = await page.context().newCDPSession(page);

    // Touch corner C (nx: 0.25, ny: 0.85) without starting a walk
    const cornerC = await toPage(page, 0.25, 0.85);
    await touch(cdp, 'touchStart', cornerC.x, cornerC.y);

    const status = page.locator('.gt-explore__status');
    await expect(status).toContainText(/C/i);

    // Record cancel call count before lift
    const cancelCountBeforeLift = await page.evaluate(
      () => window.__speechSpy?.cancelCount ?? 0,
    );

    // Lift finger: non-walk exploration speech quiet timer (300 ms) must trigger drivers.speech.stopSpeaking()
    await touch(cdp, 'touchEnd');
    await page.waitForTimeout(400);

    // Assert cancel calls increased (speech IS cancelled by lift)
    const cancelCountAfterLift = await page.evaluate(
      () => window.__speechSpy?.cancelCount ?? 0,
    );
    expect(cancelCountAfterLift).toBeGreaterThan(cancelCountBeforeLift);
  });
});
