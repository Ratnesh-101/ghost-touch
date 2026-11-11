import { test, expect, type Page, type Locator, type CDPSession } from '@playwright/test';

/**
 * End-to-end regression tests for Explore canvas layout stability.
 *
 * Verifies that the diagram canvas does not continuously grow taller during prolonged
 * touch holds and drags across Samsung Galaxy S24 (384x832 DPR 3) and S24+ (412x915 DPR 3.5).
 * Validates the CSS fix (position: absolute; inset: 0) introduced in commit 5616cd5.
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
  readonly scrollHeight: number;
  readonly scrollY: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
}

interface LayoutSample {
  readonly elapsedMs: number;
  readonly canvasBox: ElementBox;
  readonly scrollHeight: number;
  readonly scrollY: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  readonly askBox: ElementBox | null;
  readonly correctBox: ElementBox | null;
  readonly backBox: ElementBox | null;
  readonly statusBox: ElementBox | null;
}

interface BaselineLayout {
  readonly canvasBox: ElementBox;
  readonly scrollHeight: number;
  readonly scrollY: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  readonly askBox: ElementBox;
  readonly correctBox: ElementBox;
  readonly backBox: ElementBox;
  readonly statusBox: ElementBox;
}

interface ExploreControls {
  readonly canvas: Locator;
  readonly askBtn: Locator;
  readonly correctBtn: Locator;
  readonly backBtn: Locator;
  readonly statusLine: Locator;
}

/**
 * Navigates from Start screen to Explore screen with the bundled offline "Right triangle" sample.
 * Uses getByRole with accessible names per requirement 1.
 */
async function navigateToExploreWithTriangle(page: Page): Promise<ExploreControls> {
  await page.goto('/');

  // 1. Start screen: single full-screen button with accessible name
  const startButton = page.getByRole('button', {
    name: /Ghost Touch.*begin/i,
  });
  await expect(startButton).toBeVisible();
  await startButton.click();

  // 2. Capture screen: sample diagram button for Right triangle
  const triangleButton = page.getByRole('button', {
    name: /triangle/i,
  });
  await expect(triangleButton).toBeVisible();
  await triangleButton.click();

  // 3. Explore screen: Locate canvas by class gt-explore__canvas
  const canvas = page.locator('canvas.gt-explore__canvas');
  await expect(canvas).toBeVisible();

  // Controls around canvas: Ask, Correct, Back, and status line
  const askBtn = page.getByRole('button', { name: 'Ask', exact: true });
  const correctBtn = page.getByRole('button', { name: 'Correct', exact: true });
  const backBtn = page.getByRole('button', { name: 'Back', exact: true });
  const statusLine = page.locator('.gt-explore__status');

  await expect(askBtn).toBeVisible();
  await expect(correctBtn).toBeVisible();
  await expect(backBtn).toBeVisible();
  await expect(statusLine).toBeVisible();

  // Allow initial rendering and layout to settle
  await page.waitForTimeout(200);

  return { canvas, askBtn, correctBtn, backBtn, statusLine };
}

/**
 * Captures initial baseline layout metrics before touch interaction starts.
 */
async function captureBaseline(
  page: Page,
  controls: ExploreControls,
): Promise<BaselineLayout> {
  const [canvasBox, askBox, correctBox, backBox, statusBox, metrics] =
    await Promise.all([
      controls.canvas.boundingBox(),
      controls.askBtn.boundingBox(),
      controls.correctBtn.boundingBox(),
      controls.backBtn.boundingBox(),
      controls.statusLine.boundingBox(),
      page.evaluate((): WindowMetrics => ({
        scrollHeight:
          document.scrollingElement?.scrollHeight ??
          document.documentElement.scrollHeight,
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
      })),
    ]);

  expect(canvasBox, 'Baseline canvas boundingBox must not be null').not.toBeNull();
  expect(askBox, 'Baseline Ask button boundingBox must not be null').not.toBeNull();
  expect(correctBox, 'Baseline Correct button boundingBox must not be null').not.toBeNull();
  expect(backBox, 'Baseline Back button boundingBox must not be null').not.toBeNull();
  expect(statusBox, 'Baseline status line boundingBox must not be null').not.toBeNull();

  const nonNullCanvas = canvasBox as ElementBox;
  const nonNullAsk = askBox as ElementBox;
  const nonNullCorrect = correctBox as ElementBox;
  const nonNullBack = backBox as ElementBox;
  const nonNullStatus = statusBox as ElementBox;

  // Baseline sanity: controls must be within viewport initially
  expect(nonNullAsk.y).toBeGreaterThanOrEqual(0);
  expect(nonNullAsk.y + nonNullAsk.height).toBeLessThanOrEqual(metrics.innerHeight);
  expect(nonNullCorrect.y).toBeGreaterThanOrEqual(0);
  expect(nonNullCorrect.y + nonNullCorrect.height).toBeLessThanOrEqual(metrics.innerHeight);
  expect(nonNullBack.y).toBeGreaterThanOrEqual(0);
  expect(nonNullBack.y + nonNullBack.height).toBeLessThanOrEqual(metrics.innerHeight);

  return {
    canvasBox: nonNullCanvas,
    scrollHeight: metrics.scrollHeight,
    scrollY: metrics.scrollY,
    viewportHeight: metrics.innerHeight,
    viewportWidth: metrics.innerWidth,
    askBox: nonNullAsk,
    correctBox: nonNullCorrect,
    backBox: nonNullBack,
    statusBox: nonNullStatus,
  };
}

/**
 * Captures a single sample of layout dimensions at a specific elapsed timestamp.
 */
async function captureSample(
  page: Page,
  controls: ExploreControls,
  elapsedMs: number,
): Promise<LayoutSample> {
  const [canvasBox, askBox, correctBox, backBox, statusBox, metrics] =
    await Promise.all([
      controls.canvas.boundingBox(),
      controls.askBtn.boundingBox(),
      controls.correctBtn.boundingBox(),
      controls.backBtn.boundingBox(),
      controls.statusLine.boundingBox(),
      page.evaluate((): WindowMetrics => ({
        scrollHeight:
          document.scrollingElement?.scrollHeight ??
          document.documentElement.scrollHeight,
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
      })),
    ]);

  if (!canvasBox) {
    throw new Error(`Canvas element missing from DOM at t=${elapsedMs}ms`);
  }

  return {
    elapsedMs,
    canvasBox,
    scrollHeight: metrics.scrollHeight,
    scrollY: metrics.scrollY,
    viewportHeight: metrics.innerHeight,
    viewportWidth: metrics.innerWidth,
    askBox,
    correctBox,
    backBox,
    statusBox,
  };
}

/**
 * Formats a chronological table of sampled canvas heights and layout metrics
 * so any regression displays the exact growth curve over time in failure logs.
 */
function formatGrowthCurve(
  samples: readonly LayoutSample[],
  baseline: BaselineLayout,
): string {
  const lines: string[] = [
    '=== Sampled Height Growth Curve Over Time ===',
    `Baseline canvas: width=${baseline.canvasBox.width.toFixed(1)}px, ` +
      `height=${baseline.canvasBox.height.toFixed(1)}px | ` +
      `scrollHeight=${baseline.scrollHeight.toFixed(1)}px | ` +
      `viewportHeight=${baseline.viewportHeight}px`,
    'Timeline (elapsed -> canvasH [diff] | scrollH | scrollY | askBottom | backBottom):',
  ];

  for (const s of samples) {
    const diff = s.canvasBox.height - baseline.canvasBox.height;
    const sign = diff >= 0 ? '+' : '';
    const askBottom = s.askBox ? (s.askBox.y + s.askBox.height).toFixed(1) : 'null';
    const backBottom = s.backBox ? (s.backBox.y + s.backBox.height).toFixed(1) : 'null';
    lines.push(
      `  t=${s.elapsedMs.toString().padStart(5, ' ')}ms: ` +
        `canvasH=${s.canvasBox.height.toFixed(1)}px (${sign}${diff.toFixed(1)}px) | ` +
        `scrollH=${s.scrollHeight.toFixed(1)}px | ` +
        `scrollY=${s.scrollY.toFixed(1)}px | ` +
        `askBottom=${askBottom}px | ` +
        `backBottom=${backBottom}px`,
    );
  }
  lines.push('=============================================');
  return lines.join('\n');
}

/**
 * Asserts layout stability for a sample against baseline dimensions.
 * Tolerance is 0.5px per requirement 4.
 */
function assertSampleStability(
  sample: LayoutSample,
  baseline: BaselineLayout,
  allSamples: readonly LayoutSample[],
  options?: { readonly allowHeightReduction?: boolean },
): void {
  const curve = formatGrowthCurve(allSamples, baseline);
  const t = sample.elapsedMs;

  // 1. Canvas boundingBox width identical to baseline (tolerance 0.5px)
  const widthDiff = Math.abs(sample.canvasBox.width - baseline.canvasBox.width);
  expect(
    widthDiff,
    `Canvas width drifted by ${widthDiff.toFixed(2)}px ` +
      `(baseline=${baseline.canvasBox.width.toFixed(1)}px, ` +
      `current=${sample.canvasBox.width.toFixed(1)}px) at t=${t}ms.\n${curve}`,
  ).toBeLessThanOrEqual(0.5);

  // 2. Canvas boundingBox height identical to baseline (tolerance 0.5px)
  const heightDiff = Math.abs(sample.canvasBox.height - baseline.canvasBox.height);
  if (options?.allowHeightReduction) {
    // When viewport is temporarily reduced by 56px, canvas must not grow beyond baseline
    expect(
      sample.canvasBox.height,
      `Canvas height grew during viewport reduction at t=${t}ms.\n${curve}`,
    ).toBeLessThanOrEqual(baseline.canvasBox.height + 0.5);
  } else {
    expect(
      heightDiff,
      `Canvas height grew or drifted by ${heightDiff.toFixed(2)}px ` +
        `(baseline=${baseline.canvasBox.height.toFixed(1)}px, ` +
        `current=${sample.canvasBox.height.toFixed(1)}px) ` +
        `at t=${t}ms.\n${curve}`,
    ).toBeLessThanOrEqual(0.5);
  }

  // 3. window.scrollY is unchanged
  const scrollYDiff = Math.abs(sample.scrollY - baseline.scrollY);
  expect(
    scrollYDiff,
    `window.scrollY changed by ${scrollYDiff.toFixed(2)}px ` +
      `(baseline=${baseline.scrollY}, current=${sample.scrollY}) at t=${t}ms.\n${curve}`,
  ).toBeLessThanOrEqual(0.5);

  // 4. scrollHeight does not grow
  expect(
    sample.scrollHeight,
    `document.scrollingElement.scrollHeight grew from ` +
      `${baseline.scrollHeight.toFixed(1)}px to ` +
      `${sample.scrollHeight.toFixed(1)}px at t=${t}ms.\n${curve}`,
  ).toBeLessThanOrEqual(baseline.scrollHeight + 0.5);

  // 5. Ask, Correct and Back stay fully inside the viewport (0..innerHeight)
  expect(
    sample.askBox,
    `Ask button missing from DOM at t=${t}ms.\n${curve}`,
  ).not.toBeNull();
  if (sample.askBox) {
    expect(
      sample.askBox.y,
      `Ask button top edge is off-screen (< 0) at t=${t}ms.\n${curve}`,
    ).toBeGreaterThanOrEqual(-0.5);
    expect(
      sample.askBox.y + sample.askBox.height,
      `Ask button bottom edge pushed past viewport bottom at t=${t}ms.\n${curve}`,
    ).toBeLessThanOrEqual(sample.viewportHeight + 0.5);
  }

  expect(
    sample.correctBox,
    `Correct button missing from DOM at t=${t}ms.\n${curve}`,
  ).not.toBeNull();
  if (sample.correctBox) {
    expect(
      sample.correctBox.y,
      `Correct button top edge is off-screen (< 0) at t=${t}ms.\n${curve}`,
    ).toBeGreaterThanOrEqual(-0.5);
    expect(
      sample.correctBox.y + sample.correctBox.height,
      `Correct button bottom edge pushed past viewport bottom at t=${t}ms.\n${curve}`,
    ).toBeLessThanOrEqual(sample.viewportHeight + 0.5);
  }

  expect(
    sample.backBox,
    `Back button missing from DOM at t=${t}ms.\n${curve}`,
  ).not.toBeNull();
  if (sample.backBox) {
    expect(
      sample.backBox.y,
      `Back button top edge is off-screen (< 0) at t=${t}ms.\n${curve}`,
    ).toBeGreaterThanOrEqual(-0.5);
    expect(
      sample.backBox.y + sample.backBox.height,
      `Back button bottom edge pushed past viewport bottom at t=${t}ms.\n${curve}`,
    ).toBeLessThanOrEqual(sample.viewportHeight + 0.5);
  }

  // 6. Status line box height did not change
  expect(
    sample.statusBox,
    `Status line missing from DOM at t=${t}ms.\n${curve}`,
  ).not.toBeNull();
  if (sample.statusBox) {
    const statusDiff = Math.abs(sample.statusBox.height - baseline.statusBox.height);
    expect(
      statusDiff,
      `Status line height changed by ${statusDiff.toFixed(2)}px ` +
        `(baseline=${baseline.statusBox.height.toFixed(1)}px, ` +
        `current=${sample.statusBox.height.toFixed(1)}px) ` +
        `at t=${t}ms.\n${curve}`,
    ).toBeLessThanOrEqual(0.5);
  }
}

/**
 * Dispatches raw CDP touch event to page context.
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
 * Interpolates along normalized polygonal waypoints across the canvas.
 */
function interpolatePath(
  waypoints: readonly Point[],
  progress: number,
  canvasBox: ElementBox,
): Point {
  const clamped = Math.max(0, Math.min(1, progress));
  const segmentCount = waypoints.length - 1;
  const scaled = clamped * segmentCount;
  const index = Math.min(Math.floor(scaled), segmentCount - 1);
  const t = scaled - index;

  const p0 = waypoints[index] ?? waypoints[0] ?? { x: 0.5, y: 0.5 };
  const p1 = waypoints[index + 1] ?? p0;

  const normX = p0.x + (p1.x - p0.x) * t;
  const normY = p0.y + (p1.y - p0.y) * t;

  return {
    x: canvasBox.x + normX * canvasBox.width,
    y: canvasBox.y + normY * canvasBox.height,
  };
}

/**
 * Executes a continuous hold-and-drag gesture using raw CDP touch events,
 * capturing and asserting layout samples every 250ms and after touchEnd.
 */
async function runHoldAndDrag(params: {
  readonly page: Page;
  readonly cdp: CDPSession;
  readonly controls: ExploreControls;
  readonly baseline: BaselineLayout;
  readonly waypoints: readonly Point[];
  readonly durationMs: number;
  readonly sampleIntervalMs?: number;
  readonly onStep?: (elapsedMs: number) => Promise<void>;
  readonly allowHeightReductionDuring?: (elapsedMs: number) => boolean;
}): Promise<LayoutSample[]> {
  const {
    page,
    cdp,
    controls,
    baseline,
    waypoints,
    durationMs,
    sampleIntervalMs = 250,
    onStep,
    allowHeightReductionDuring,
  } = params;

  const samples: LayoutSample[] = [];
  const stepMs = 50; // 50ms per step gives smooth raw touch dragging

  // 1. Initial touchStart at waypoints[0]
  const initialPoint = interpolatePath(waypoints, 0, baseline.canvasBox);
  await sendCdpTouch(cdp, 'touchStart', initialPoint);

  // Initial sample at t = 0
  const initialSample = await captureSample(page, controls, 0);
  samples.push(initialSample);
  assertSampleStability(initialSample, baseline, samples);

  let lastSampleElapsed = 0;
  let elapsed = 0;

  // 2. Dragging loop across waypoints
  while (elapsed < durationMs) {
    await page.waitForTimeout(stepMs);
    elapsed += stepMs;

    if (onStep) {
      await onStep(elapsed);
    }

    const currentPoint = interpolatePath(
      waypoints,
      elapsed / durationMs,
      baseline.canvasBox,
    );
    await sendCdpTouch(cdp, 'touchMove', currentPoint);

    if (elapsed - lastSampleElapsed >= sampleIntervalMs || elapsed >= durationMs) {
      lastSampleElapsed = elapsed;
      const sample = await captureSample(page, controls, elapsed);
      samples.push(sample);

      const allowReduction = allowHeightReductionDuring
        ? allowHeightReductionDuring(elapsed)
        : false;
      assertSampleStability(sample, baseline, samples, {
        allowHeightReduction: allowReduction,
      });
    }
  }

  // 3. touchEnd
  await sendCdpTouch(cdp, 'touchEnd');
  await page.waitForTimeout(100);

  // Post-touchEnd sample
  const postEndSample = await captureSample(page, controls, elapsed + 100);
  samples.push(postEndSample);
  assertSampleStability(postEndSample, baseline, samples);

  return samples;
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

test.describe('Explore canvas layout stability during touch hold-and-drag', () => {
  test.describe('Standard 5s hold-and-drag (finger starts away from centre)', () => {
    test(
      'canvas dimensions, scroll, controls and status line remain stable',
      async ({ page }) => {
        const controls = await navigateToExploreWithTriangle(page);
        const baseline = await captureBaseline(page, controls);
        const cdp = await page.context().newCDPSession(page);

        try {
          // Reproduce initial touch away from centre matching the P0 bug report offset
          // (dx=-74.4px, dy=-47.2px from canvas centre)
          const cx = baseline.canvasBox.x + baseline.canvasBox.width / 2;
          const cy = baseline.canvasBox.y + baseline.canvasBox.height / 2;
          const startNormX = (cx - 74.4 - baseline.canvasBox.x) / baseline.canvasBox.width;
          const startNormY = (cy - 47.2 - baseline.canvasBox.y) / baseline.canvasBox.height;

          // Path moves from off-centre start point across triangle vertices A, B, C and back
          const waypoints: Point[] = [
            { x: startNormX, y: startNormY },
            { x: 0.25, y: 0.25 }, // Vertex A
            { x: 0.70, y: 0.85 }, // Vertex B
            { x: 0.25, y: 0.85 }, // Vertex C
            { x: 0.25, y: 0.25 }, // Vertex A again
            { x: 0.50, y: 0.50 }, // Canvas centre
          ];

          const samples = await runHoldAndDrag({
            page,
            cdp,
            controls,
            baseline,
            waypoints,
            durationMs: 5000,
            sampleIntervalMs: 250,
          });

          // Ensure at least 20 samples were verified across the 5s hold and post-touchEnd
          expect(samples.length).toBeGreaterThanOrEqual(20);
        } finally {
          await cdp.detach();
        }
      },
    );
  });

  test.describe('TalkBack pass-through gesture (starts at canvas centre)', () => {
    test(
      'canvas dimensions remain stable during double-tap-and-hold drag',
      async ({ page }) => {
        const controls = await navigateToExploreWithTriangle(page);
        const baseline = await captureBaseline(page, controls);
        const cdp = await page.context().newCDPSession(page);

        try {
          const centreNorm: Point = { x: 0.5, y: 0.5 };
          const centrePoint = interpolatePath([centreNorm, centreNorm], 0, baseline.canvasBox);

          // TalkBack pass-through gesture (Method A1):
          // 1. First tap at element centre
          await sendCdpTouch(cdp, 'touchStart', centrePoint);
          await page.waitForTimeout(50);
          await sendCdpTouch(cdp, 'touchEnd');
          await page.waitForTimeout(100);

          // 2. Second tap and hold at element centre
          await sendCdpTouch(cdp, 'touchStart', centrePoint);

          // Pass-through announcement check: status line presents diagram guidance
          const statusText = await controls.statusLine.textContent();
          expect(statusText).not.toBeNull();
          expect(statusText).toMatch(/triangle/i);

          // Path drags from centre across triangle segments
          const waypoints: Point[] = [
            centreNorm,
            { x: 0.25, y: 0.25 }, // Vertex A
            { x: 0.70, y: 0.85 }, // Vertex B
            { x: 0.25, y: 0.85 }, // Vertex C
            { x: 0.50, y: 0.50 }, // Back to centre
          ];

          const samples = await runHoldAndDrag({
            page,
            cdp,
            controls,
            baseline,
            waypoints,
            durationMs: 5000,
            sampleIntervalMs: 250,
          });

          expect(samples.length).toBeGreaterThanOrEqual(20);
        } finally {
          await cdp.detach();
        }
      },
    );
  });

  test.describe('Installed PWA standalone: viewport height resize during hold', () => {
    test(
      'canvas does not grow continuously and restores to baseline after URL bar toggle',
      async ({ page }) => {
        const controls = await navigateToExploreWithTriangle(page);
        const baseline = await captureBaseline(page, controls);
        const cdp = await page.context().newCDPSession(page);

        try {
          const origWidth = baseline.viewportWidth;
          const origHeight = baseline.viewportHeight;
          const shrunkHeight = origHeight - 56;

          let resizedDown = false;
          let restoredUp = false;

          const waypoints: Point[] = [
            { x: 0.5, y: 0.5 },
            { x: 0.25, y: 0.25 },
            { x: 0.70, y: 0.85 },
            { x: 0.25, y: 0.85 },
            { x: 0.5, y: 0.5 },
          ];

          const samples = await runHoldAndDrag({
            page,
            cdp,
            controls,
            baseline,
            waypoints,
            durationMs: 5000,
            sampleIntervalMs: 250,
            onStep: async (elapsedMs: number) => {
              // At 1500ms, simulate navigation/URL bar appearing (viewport height shrinks by 56px)
              if (elapsedMs >= 1500 && elapsedMs < 3000 && !resizedDown) {
                resizedDown = true;
                await page.setViewportSize({ width: origWidth, height: shrunkHeight });
              }
              // At 3000ms, simulate navigation/URL bar hiding (viewport height restores to full)
              if (elapsedMs >= 3000 && !restoredUp) {
                restoredUp = true;
                await page.setViewportSize({ width: origWidth, height: origHeight });
              }
            },
            allowHeightReductionDuring: (elapsedMs: number) => {
              // During 1500ms..2999ms, viewport is shrunk by 56px
              return elapsedMs >= 1500 && elapsedMs < 3000;
            },
          });

          expect(resizedDown).toBe(true);
          expect(restoredUp).toBe(true);

          // Verify that after restoring viewport size (t >= 3250ms), canvas box equals baseline
          const restoredSamples = samples.filter((s) => s.elapsedMs >= 3250);
          expect(restoredSamples.length).toBeGreaterThanOrEqual(6);
          for (const s of restoredSamples) {
            assertSampleStability(s, baseline, samples);
          }
        } finally {
          await cdp.detach();
        }
      },
    );
  });

  test.describe('Installed PWA standalone: device rotation', () => {
    test(
      'canvas returns to baseline size after rotating landscape and back',
      async ({ page }) => {
        const controls = await navigateToExploreWithTriangle(page);
        const baseline = await captureBaseline(page, controls);

        const origWidth = baseline.viewportWidth;
        const origHeight = baseline.viewportHeight;

        // 1. Rotate once (swap width and height to landscape)
        await page.setViewportSize({ width: origHeight, height: origWidth });
        await page.waitForTimeout(300);

        const landscapeCanvasBox = await controls.canvas.boundingBox();
        expect(landscapeCanvasBox).not.toBeNull();
        const landscapeWidth = (landscapeCanvasBox as ElementBox).width;
      expect(landscapeWidth).toBeGreaterThanOrEqual(origHeight * 0.5);

        // 2. Rotate back (restore portrait orientation)
        await page.setViewportSize({ width: origWidth, height: origHeight });
        await page.waitForTimeout(300);

        // 3. Assert canvas returns to its exact baseline size (tolerance 0.5px)
        const restoredSample = await captureSample(page, controls, 0);
        assertSampleStability(restoredSample, baseline, [restoredSample]);

        // 4. Verify touch hold-and-drag remains stable following rotation cycle
        const cdp = await page.context().newCDPSession(page);
        try {
          const waypoints: Point[] = [
            { x: 0.5, y: 0.5 },
            { x: 0.25, y: 0.25 },
            { x: 0.70, y: 0.85 },
            { x: 0.5, y: 0.5 },
          ];
          const postRotationSamples = await runHoldAndDrag({
            page,
            cdp,
            controls,
            baseline,
            waypoints,
            durationMs: 2000,
            sampleIntervalMs: 250,
          });
          expect(postRotationSamples.length).toBeGreaterThanOrEqual(8);
        } finally {
          await cdp.detach();
        }
      },
    );
  });

  test.describe('Installed PWA standalone: prolonged 10s hold', () => {
    test(
      'canvas remains fixed for full 10s hold exceeding the 7s bug window',
      async ({ page }) => {
        const controls = await navigateToExploreWithTriangle(page);
        const baseline = await captureBaseline(page, controls);
        const cdp = await page.context().newCDPSession(page);

        try {
          // Path continuously cycles across the triangle vertices for 10 seconds
          const waypoints: Point[] = [
            { x: 0.5, y: 0.5 },
            { x: 0.25, y: 0.25 }, // A
            { x: 0.70, y: 0.85 }, // B
            { x: 0.25, y: 0.85 }, // C
            { x: 0.25, y: 0.25 }, // A
            { x: 0.50, y: 0.50 }, // Centre
            { x: 0.70, y: 0.85 }, // B
            { x: 0.25, y: 0.85 }, // C
            { x: 0.25, y: 0.25 }, // A
            { x: 0.50, y: 0.50 }, // Centre
          ];

          // 10s hold covers 40+ samples at 250ms intervals, well beyond the ~7s bug growth window
          const samples = await runHoldAndDrag({
            page,
            cdp,
            controls,
            baseline,
            waypoints,
            durationMs: 10000,
            sampleIntervalMs: 250,
          });

          // 10s / 250ms = 40 samples + initial sample + post-touchEnd sample = ~42 samples
          expect(samples.length).toBeGreaterThanOrEqual(40);
        } finally {
          await cdp.detach();
        }
      },
    );
  });
});
