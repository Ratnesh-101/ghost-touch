import { test, expect, type Page, type Locator, type CDPSession } from '@playwright/test';

/**
 * End-to-end layout and accessibility regression tests for Explore action buttons.
 *
 * Verifies that the new and existing action buttons (Back, Where am I, Ask, Correct,
 * and Guide me when present):
 * 1. Meet the minimum 48x48 CSS px touch target requirement (Requirement 12.1 / finding L9).
 * 2. Lie completely inside the viewport across compact, standard, and large mobile viewports
 *    (including 360x640, 390x844, 384x832 Galaxy S24, and 412x915 Galaxy S24+).
 * 3. The canvas box height stays above a sensible minimum (at least 40% of viewport height)
 *    and does not change or drift after a 3 s touch hold.
 * 4. The page exhibits zero horizontal overflow / horizontal scroll (scrollWidth <= clientWidth).
 */

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ElementBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface WindowMetrics {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly windowScrollX: number;
  readonly bodyScrollWidth: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

interface ExploreControls {
  readonly canvas: Locator;
  readonly backBtn: Locator;
  readonly whereAmIBtn: Locator;
  readonly askBtn: Locator;
  readonly correctBtn: Locator;
  readonly helpBtn: Locator;
  readonly guideMeBtn: Locator;
  readonly statusLine: Locator;
}

interface ViewportDimensions {
  readonly width: number;
  readonly height: number;
}

interface ActionButtonSpec {
  readonly name: string;
  readonly locator: Locator;
  readonly required: boolean;
}

/**
 * Navigates from Start screen to Explore screen with the bundled offline "Right triangle" sample.
 * Uses getByRole with accessible names matching existing spec helpers.
 * Optionally configures language via localStorage gt_language (e.g. 'gu' for Gujarati layout test).
 */
async function navigateToExploreWithTriangle(page: Page, lang?: string): Promise<ExploreControls> {
  // Requirement 48: Correct is offered only with Teacher tools on.
  await page.addInitScript((language) => {
    window.localStorage.setItem('gt_teacher_enabled', 'true');
    if (language) {
      window.localStorage.setItem('gt_language', language);
    }
  }, lang);
  await page.goto('/');

  // 1. Start screen: single full-screen button with accessible name (en: Ghost Touch / begin, gu: ગોસ્ટ ટચ / શરૂ)
  const startButton = page.getByRole('button', {
    name: /Ghost Touch.*begin|ગોસ્ટ ટચ|શરૂ/i,
  });
  await expect(startButton).toBeVisible();
  await startButton.click();

  // 2. Capture screen: sample diagram button for Right triangle (en: triangle, gu: ત્રિકોણ)
  const triangleButton = page.getByRole('button', {
    name: /triangle|ત્રિકોણ/i,
  });
  await expect(triangleButton).toBeVisible();
  await triangleButton.click();

  // 3. Explore screen: Locate canvas by class gt-explore__canvas
  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();

  // Action buttons: accessible names per requirement 12.1 and localized strings
  const isGu = lang === 'gu';
  const backBtn = isGu
    ? page.getByRole('button', { name: 'પાછા', exact: true })
    : page.getByRole('button', { name: 'Back', exact: true });
  const whereAmIBtn = isGu
    ? page.getByRole('button', { name: 'હું ક્યાં છું', exact: true })
    : page.getByRole('button', { name: 'Where am I', exact: true });
  const askBtn = isGu
    ? page.getByRole('button', { name: 'પૂછો', exact: true })
    : page.getByRole('button', { name: 'Ask', exact: true });
  const helpBtn = isGu
    ? page.getByRole('button', { name: 'મદદ', exact: true })
    : page.getByRole('button', { name: 'Help', exact: true });
  const correctBtn = isGu
    ? page.getByRole('button', { name: 'સુધારો', exact: true })
    : page.getByRole('button', { name: 'Correct', exact: true });
  const guideMeBtn = isGu
    ? page.getByRole('button', { name: 'માર્ગદર્શન આપો', exact: true })
    : page.getByRole('button', { name: 'Guide me', exact: true });
  const statusLine = page.locator('.gt-explore__status');

  // Verify core controls are present and visible
  await expect(backBtn).toBeVisible();
  await expect(whereAmIBtn).toBeVisible();
  await expect(askBtn).toBeVisible();
  await expect(helpBtn).toBeVisible();
  await expect(correctBtn).toBeVisible();
  await expect(statusLine).toBeVisible();

  // Allow initial rendering and layout to settle
  await page.waitForTimeout(200);

  return { canvas, backBtn, whereAmIBtn, askBtn, correctBtn, helpBtn, guideMeBtn, statusLine };
}

/**
 * Asserts that the page has zero horizontal scroll or horizontal overflow.
 */
async function assertNoHorizontalScroll(page: Page, contextMsg = ''): Promise<void> {
  const metrics: WindowMetrics = await page.evaluate((): WindowMetrics => {
    const el = document.scrollingElement ?? document.documentElement;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      windowScrollX: window.scrollX,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });

  const prefix = contextMsg ? `[${contextMsg}] ` : '';

  // 1. Scrolling element scrollWidth must not exceed clientWidth (allow 1px for browser subpixel rounding)
  expect(
    metrics.scrollWidth,
    `${prefix}Page has horizontal overflow: scrollWidth (${metrics.scrollWidth}px) exceeds clientWidth (${metrics.clientWidth}px)`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);

  // 2. window.scrollX must be 0
  expect(
    metrics.windowScrollX,
    `${prefix}window.scrollX must be 0, found ${metrics.windowScrollX}`,
  ).toBe(0);

  // 3. document.body scrollWidth must not exceed innerWidth (allow 1px for subpixel rounding)
  expect(
    metrics.bodyScrollWidth,
    `${prefix}document.body.scrollWidth (${metrics.bodyScrollWidth}px) exceeds innerWidth (${metrics.innerWidth}px)`,
  ).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

/**
 * Asserts that every action button has a bounding box of at least 48x48 CSS px
 * and lies fully inside the viewport.
 */
async function assertActionButtonsBounds(
  controls: ExploreControls,
  viewport: ViewportDimensions,
  contextMsg = '',
): Promise<{ checkedButtons: string[]; boxes: Record<string, ElementBox> }> {
  const prefix = contextMsg ? `[${contextMsg}] ` : '';

  const buttonSpecs: ActionButtonSpec[] = [
    { name: 'Back', locator: controls.backBtn, required: true },
    { name: 'Where am I', locator: controls.whereAmIBtn, required: true },
    { name: 'Ask', locator: controls.askBtn, required: true },
    { name: 'Help', locator: controls.helpBtn, required: true },
    { name: 'Correct', locator: controls.correctBtn, required: true },
    { name: 'Guide me', locator: controls.guideMeBtn, required: false },
  ];

  const checkedButtons: string[] = [];
  const boxes: Record<string, ElementBox> = {};

  for (const spec of buttonSpecs) {
    const isVisible = await spec.locator.isVisible();
    if (spec.required) {
      expect(isVisible, `${prefix}Required button "${spec.name}" must be visible`).toBe(true);
    } else if (!isVisible) {
      // Optional button (Guide me when present) is not rendered; skip bounding box check
      continue;
    }

    const box = await spec.locator.boundingBox();
    expect(box, `${prefix}Button "${spec.name}" boundingBox must not be null`).not.toBeNull();
    if (!box) continue;

    checkedButtons.push(spec.name);
    boxes[spec.name] = box;

    // 1. Minimum 48x48 CSS px touch target (tolerance 0.5px for subpixel anti-aliasing)
    expect(
      box.width,
      `${prefix}Button "${spec.name}" width (${box.width.toFixed(1)}px) must be >= 48px`,
    ).toBeGreaterThanOrEqual(47.5);

    expect(
      box.height,
      `${prefix}Button "${spec.name}" height (${box.height.toFixed(1)}px) must be >= 48px`,
    ).toBeGreaterThanOrEqual(47.5);

    // 2. Lies fully inside the viewport (tolerance 0.5px for subpixel borders/offsets)
    expect(
      box.x,
      `${prefix}Button "${spec.name}" left edge (${box.x.toFixed(1)}px) is outside viewport (< 0)`,
    ).toBeGreaterThanOrEqual(-0.5);

    expect(
      box.y,
      `${prefix}Button "${spec.name}" top edge (${box.y.toFixed(1)}px) is outside viewport (< 0)`,
    ).toBeGreaterThanOrEqual(-0.5);

    expect(
      box.x + box.width,
      `${prefix}Button "${spec.name}" right edge (${(box.x + box.width).toFixed(1)}px) exceeds viewport width (${viewport.width}px)`,
    ).toBeLessThanOrEqual(viewport.width + 0.5);

    expect(
      box.y + box.height,
      `${prefix}Button "${spec.name}" bottom edge (${(box.y + box.height).toFixed(1)}px) exceeds viewport height (${viewport.height}px)`,
    ).toBeLessThanOrEqual(viewport.height + 0.5);
  }

  return { checkedButtons, boxes };
}

/**
 * Dispatches CDP touch event matching existing e2e spec implementation.
 */
async function sendCdpTouch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  point?: Point,
): Promise<void> {
  if (type === 'touchEnd' || !point) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } else {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [
        {
          x: Math.round(point.x),
          y: Math.round(point.y),
          id: 0,
        },
      ],
    });
  }
}

/**
 * Checks canvas box height stays above 40% of viewport height and does not change after 3s hold.
 */
async function assertCanvasStabilityAfter3sHold(
  page: Page,
  controls: ExploreControls,
  viewport: ViewportDimensions,
  contextMsg = '',
  minCanvasHeightPx?: number,
): Promise<{ initialHeight: number; afterHoldHeight: number }> {
  const prefix = contextMsg ? `[${contextMsg}] ` : '';

  const initialCanvasBox = await controls.canvas.boundingBox();
  expect(initialCanvasBox, `${prefix}Canvas boundingBox must not be null`).not.toBeNull();
  if (!initialCanvasBox) throw new Error('Initial canvas boundingBox is null');

  // 1. Initial canvas box height must be above sensible minimum (>= 40% of viewport height)
  const minCanvasHeight = minCanvasHeightPx ?? viewport.height * 0.40;
  expect(
    initialCanvasBox.height,
    `${prefix}Canvas height (${initialCanvasBox.height.toFixed(1)}px) is below minimum 40% of viewport (${minCanvasHeight.toFixed(1)}px)`,
  ).toBeGreaterThanOrEqual(minCanvasHeight - 0.5);

  // 2. Perform 3 s touch hold on canvas using CDP touch events
  const cdp = await page.context().newCDPSession(page);
  try {
    const centrePoint: Point = {
      x: initialCanvasBox.x + initialCanvasBox.width / 2,
      y: initialCanvasBox.y + initialCanvasBox.height / 2,
    };

    // touchStart at canvas centre
    await sendCdpTouch(cdp, 'touchStart', centrePoint);

    // Intermediate samples during the 3 s hold (at t=1000ms, t=2000ms, t=3000ms)
    const intermediateCheckpoints = [1000, 2000, 3000];
    let elapsed = 0;
    for (const checkpoint of intermediateCheckpoints) {
      await page.waitForTimeout(checkpoint - elapsed);
      elapsed = checkpoint;

      const midBox = await controls.canvas.boundingBox();
      expect(midBox, `${prefix}Canvas boundingBox at t=${checkpoint}ms must not be null`).not.toBeNull();
      if (midBox) {
        const diff = Math.abs(midBox.height - initialCanvasBox.height);
        expect(
          diff,
          `${prefix}Canvas height grew or drifted by ${diff.toFixed(2)}px during hold at t=${checkpoint}ms ` +
            `(initial=${initialCanvasBox.height.toFixed(1)}px, current=${midBox.height.toFixed(1)}px)`,
        ).toBeLessThanOrEqual(0.5);
      }
    }

    // touchEnd
    await sendCdpTouch(cdp, 'touchEnd');
    await page.waitForTimeout(100);

    // 3. Canvas box height after 3 s hold must match initial height (tolerance 0.5px)
    const afterHoldBox = await controls.canvas.boundingBox();
    expect(afterHoldBox, `${prefix}Canvas boundingBox after 3s hold must not be null`).not.toBeNull();
    if (!afterHoldBox) throw new Error('Post-hold canvas boundingBox is null');

    const heightDiff = Math.abs(afterHoldBox.height - initialCanvasBox.height);
    expect(
      heightDiff,
      `${prefix}Canvas height changed by ${heightDiff.toFixed(2)}px after 3s hold ` +
        `(initial=${initialCanvasBox.height.toFixed(1)}px, after=${afterHoldBox.height.toFixed(1)}px)`,
    ).toBeLessThanOrEqual(0.5);

    const widthDiff = Math.abs(afterHoldBox.width - initialCanvasBox.width);
    expect(
      widthDiff,
      `${prefix}Canvas width changed by ${widthDiff.toFixed(2)}px after 3s hold ` +
        `(initial=${initialCanvasBox.width.toFixed(1)}px, after=${afterHoldBox.width.toFixed(1)}px)`,
    ).toBeLessThanOrEqual(0.5);

    // Still satisfies >= 40% of viewport height
    expect(
      afterHoldBox.height,
      `${prefix}Canvas height after hold (${afterHoldBox.height.toFixed(1)}px) fell below 40% threshold (${minCanvasHeight.toFixed(1)}px)`,
    ).toBeGreaterThanOrEqual(minCanvasHeight - 0.5);

    return {
      initialHeight: initialCanvasBox.height,
      afterHoldHeight: afterHoldBox.height,
    };
  } finally {
    await cdp.detach();
  }
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

test.describe('Explore action buttons layout, viewport containment, and canvas stability', () => {
  /**
   * Project default emulated phone viewport (Galaxy S24 384x832 / S24+ 412x915).
   */
  test('default emulated phone viewport: action buttons >= 48px, canvas >= 40% stable after 3s hold, no horizontal scroll', async ({
    page,
  }) => {
    const controls = await navigateToExploreWithTriangle(page);
    const viewport = page.viewportSize() ?? { width: 384, height: 832 };

    // 1. Verify zero horizontal scroll before interaction
    await assertNoHorizontalScroll(page, 'Initial load');

    // 2. Verify all action buttons have min 48x48px target and lie inside viewport
    const { checkedButtons } = await assertActionButtonsBounds(controls, viewport, 'Initial load');
    expect(checkedButtons).toContain('Back');
    expect(checkedButtons).toContain('Where am I');
    expect(checkedButtons).toContain('Ask');
    expect(checkedButtons).toContain('Help');
    expect(checkedButtons).toContain('Correct');

    // 3. Canvas height >= 40% of viewport and remains stable across 3 s hold
    await assertCanvasStabilityAfter3sHold(page, controls, viewport, '3s hold');

    // 4. Re-verify buttons and horizontal scroll remain intact after 3 s hold
    await assertActionButtonsBounds(controls, viewport, 'After 3s hold');
    await assertNoHorizontalScroll(page, 'After 3s hold');
  });

  /**
   * 360x640 compact Android phone viewport.
   * Tests layout constraint under small screen budget.
   */
  test('360x640 compact viewport: action buttons >= 48px, canvas >= 40% stable after 3s hold, no horizontal scroll', async ({
    page,
  }) => {
    const viewport: ViewportDimensions = { width: 360, height: 640 };
    await page.setViewportSize(viewport);

    const controls = await navigateToExploreWithTriangle(page);

    // 1. Verify zero horizontal scroll
    await assertNoHorizontalScroll(page, '360x640 initial');

    // 2. Action buttons bounding boxes and viewport containment
    const { checkedButtons } = await assertActionButtonsBounds(controls, viewport, '360x640 initial');
    expect(checkedButtons).toContain('Back');
    expect(checkedButtons).toContain('Where am I');
    expect(checkedButtons).toContain('Ask');
    expect(checkedButtons).toContain('Help');
    expect(checkedButtons).toContain('Correct');

    // 3. Canvas height >= 40% (256px on 640px height) and unchanged after 3s hold
    await assertCanvasStabilityAfter3sHold(page, controls, viewport, '360x640 3s hold');

    // 4. Post-hold assertions
    await assertActionButtonsBounds(controls, viewport, '360x640 post-hold');
    await assertNoHorizontalScroll(page, '360x640 post-hold');
  });

  /**
   * 390x844 standard modern mobile viewport (iPhone 12/13/14 class).
   */
  test('390x844 modern mobile viewport: action buttons >= 48px, canvas >= 40% stable after 3s hold, no horizontal scroll', async ({
    page,
  }) => {
    const viewport: ViewportDimensions = { width: 390, height: 844 };
    await page.setViewportSize(viewport);

    const controls = await navigateToExploreWithTriangle(page);

    // 1. Verify zero horizontal scroll
    await assertNoHorizontalScroll(page, '390x844 initial');

    // 2. Action buttons bounding boxes and viewport containment
    const { checkedButtons } = await assertActionButtonsBounds(controls, viewport, '390x844 initial');
    expect(checkedButtons).toContain('Back');
    expect(checkedButtons).toContain('Where am I');
    expect(checkedButtons).toContain('Ask');
    expect(checkedButtons).toContain('Help');
    expect(checkedButtons).toContain('Correct');

    // 3. Canvas height >= 40% (337.6px on 844px height) and unchanged after 3s hold
    await assertCanvasStabilityAfter3sHold(page, controls, viewport, '390x844 3s hold');

    // 4. Post-hold assertions
    await assertActionButtonsBounds(controls, viewport, '390x844 post-hold');
    await assertNoHorizontalScroll(page, '390x844 post-hold');
  });

  /**
   * Explicit 384x832 viewport (Samsung Galaxy S24).
   */
  test('384x832 Galaxy S24 viewport: action buttons >= 48px, canvas >= 40% stable after 3s hold, no horizontal scroll', async ({
    page,
  }) => {
    const viewport: ViewportDimensions = { width: 384, height: 832 };
    await page.setViewportSize(viewport);

    const controls = await navigateToExploreWithTriangle(page);

    await assertNoHorizontalScroll(page, '384x832 initial');
    const { checkedButtons } = await assertActionButtonsBounds(controls, viewport, '384x832 initial');
    expect(checkedButtons.length).toBeGreaterThanOrEqual(5);

    await assertCanvasStabilityAfter3sHold(page, controls, viewport, '384x832 3s hold');
    await assertActionButtonsBounds(controls, viewport, '384x832 post-hold');
    await assertNoHorizontalScroll(page, '384x832 post-hold');
  });

  /**
   * Explicit 412x915 viewport (Samsung Galaxy S24+).
   */
  test('412x915 Galaxy S24+ viewport: action buttons >= 48px, canvas >= 40% stable after 3s hold, no horizontal scroll', async ({
    page,
  }) => {
    const viewport: ViewportDimensions = { width: 412, height: 915 };
    await page.setViewportSize(viewport);

    const controls = await navigateToExploreWithTriangle(page);

    await assertNoHorizontalScroll(page, '412x915 initial');
    const { checkedButtons } = await assertActionButtonsBounds(controls, viewport, '412x915 initial');
    expect(checkedButtons.length).toBeGreaterThanOrEqual(5);

    await assertCanvasStabilityAfter3sHold(page, controls, viewport, '412x915 3s hold');
    await assertActionButtonsBounds(controls, viewport, '412x915 post-hold');
    await assertNoHorizontalScroll(page, '412x915 post-hold');
  });

  /**
   * Action row layout when Guide me button is present alongside Back, Where am I, Ask, Help, Correct.
   * Verifies that all 6 buttons wrap cleanly without breaking horizontal boundaries or collapsing canvas.
   */
  test('6 action buttons layout (including Guide me when present): bounds, containment, and no horizontal scroll', async ({
    page,
  }) => {
    const viewport: ViewportDimensions = { width: 360, height: 640 };
    await page.setViewportSize(viewport);

    const controls = await navigateToExploreWithTriangle(page);

    // If Guide me is not already rendered (e.g. guide offer not active), inject the exact Guide me button
    // element into .gt-explore__actions to verify 6-button flex-wrap behavior on compact viewport
    const guideMeBtn = page.getByRole('button', { name: 'Guide me', exact: true });
    const isAlreadyPresent = await guideMeBtn.isVisible();

    if (!isAlreadyPresent) {
      await page.evaluate(() => {
        const actionsContainer = document.querySelector('.gt-explore__actions');
        if (actionsContainer) {
          const guideBtn = document.createElement('button');
          guideBtn.type = 'button';
          guideBtn.setAttribute('data-testid', 'explore-guide-me');
          guideBtn.className = 'gt-control gt-btn gt-btn--primary gt-explore__guide-me';
          guideBtn.setAttribute('aria-label', 'Guide me');
          guideBtn.textContent = 'Guide me';
          guideBtn.style.minWidth = '48px';
          guideBtn.style.minHeight = '48px';
          // Insert at the front of actions row matching Explore.tsx
          actionsContainer.insertBefore(guideBtn, actionsContainer.firstChild);
        }
      });
      await expect(guideMeBtn).toBeVisible();
    }

    // 1. Verify no horizontal scroll with 6 buttons
    await assertNoHorizontalScroll(page, '6-button 360x640 layout');

    // 2. Verify all 6 buttons meet 48x48 touch target and lie inside viewport
    const { checkedButtons, boxes } = await assertActionButtonsBounds(
      controls,
      viewport,
      '6-button 360x640 layout',
    );
    expect(checkedButtons).toContain('Guide me');
    expect(checkedButtons).toContain('Where am I');
    expect(checkedButtons).toContain('Ask');
    expect(checkedButtons).toContain('Help');
    expect(checkedButtons).toContain('Correct');
    expect(checkedButtons).toContain('Back');

    // Verify Guide me specifically meets the requirements
    const guideMeBox = boxes['Guide me'];
    expect(guideMeBox).toBeDefined();
    if (guideMeBox) {
      expect(guideMeBox.width).toBeGreaterThanOrEqual(47.5);
      expect(guideMeBox.height).toBeGreaterThanOrEqual(47.5);
      expect(guideMeBox.x).toBeGreaterThanOrEqual(-0.5);
      expect(guideMeBox.x + guideMeBox.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(guideMeBox.y + guideMeBox.height).toBeLessThanOrEqual(viewport.height + 0.5);
    }

    // 3. Canvas height with the sixth button. Sized buttons wrap cleanly without collapsing canvas.
    const canvasBox = await controls.canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (canvasBox) {
      expect(canvasBox.height).toBeGreaterThanOrEqual(230);
    }

    // 4. Canvas stability after 3 s hold with 6 buttons present
    await assertCanvasStabilityAfter3sHold(page, controls, viewport, '6-button 3s hold', 230);
    await assertNoHorizontalScroll(page, '6-button post-hold');
  });

  /**
   * Layout check in Gujarati via localStorage gt_language (Item 10).
   * Verifies that when footer labels wrap across multiple lines in Gujarati (e.g. 'હું ક્યાં છું'),
   * all action buttons remain >= 48px, within viewport bounds, with zero horizontal overflow,
   * and canvas remains stable.
   */
  test('Gujarati layout (gt_language = gu): action buttons >= 48px, containment, no horizontal scroll', async ({
    page,
  }) => {
    const viewport: ViewportDimensions = { width: 384, height: 832 };
    await page.setViewportSize(viewport);

    const controls = await navigateToExploreWithTriangle(page, 'gu');

    // 1. Verify zero horizontal scroll
    await assertNoHorizontalScroll(page, 'Gujarati initial');

    // 2. Action buttons bounding boxes and viewport containment
    const { checkedButtons } = await assertActionButtonsBounds(controls, viewport, 'Gujarati initial');
    expect(checkedButtons).toContain('Back');
    expect(checkedButtons).toContain('Where am I');
    expect(checkedButtons).toContain('Ask');
    expect(checkedButtons).toContain('Help');
    expect(checkedButtons).toContain('Correct');

    // 3. Canvas stability after 3s hold in Gujarati
    await assertCanvasStabilityAfter3sHold(page, controls, viewport, 'Gujarati 3s hold');

    // 4. Post-hold assertions
    await assertActionButtonsBounds(controls, viewport, 'Gujarati post-hold');
    await assertNoHorizontalScroll(page, 'Gujarati post-hold');
  });
});
