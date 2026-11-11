/**
 * Regression tests: sample specimen previews (triangle, sine graph, bar chart)
 * must not shift downwards when they load.
 *
 * Causes covered:
 * 1. <svg> without width/height falls back to 300x150 before CSS applies.
 * 2. `.gt-specimen { width/height: 100% }` loads after global.css and used to beat
 *    the 56px `.gt-capture__sample-preview` sizing (equal specificity).
 * 3. Sample geometry sits low in the unit square (baselines at y = 0.85) while the
 *    loading placeholder is centred, so swapping them made the art jump down.
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SPECIMEN_INTRINSIC_SIZE,
  SpecimenPreview,
} from '../src/components/SpecimenPreview';
import {
  generateSpecimenPaths,
  getCenteringOffset,
} from '../src/components/specimenPaths';
import type { DiagramScene } from '../src/types/scene.gen';

type Id = 'triangle' | 'sine' | 'barchart';
const IDS: Id[] = ['triangle', 'sine', 'barchart'];

function read(rel: string): string {
  return fs.readFileSync(new URL(rel, import.meta.url), 'utf-8') as string;
}
function loadScene(id: Id): DiagramScene {
  return JSON.parse(read(`../public/samples/${id}.json`)) as DiagramScene;
}

/** Vertical centre of the drawn geometry (lines + dots) in viewBox units. */
function verticalCentre(scene: DiagramScene, shift: boolean): number {
  const off = shift ? getCenteringOffset(scene) : { offsetX: 0, offsetY: 0 };
  const paths = generateSpecimenPaths(scene, off);
  const d = [paths.segments, paths.polylines, paths.bars].join(' ');
  const ys: number[] = paths.vertexDots.map((p) => p.cy);
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  // path coordinates alternate x, y after M/L commands (no other numbers in these paths)
  for (let i = 1; i < nums.length; i += 2) ys.push(nums[i] as number);
  return (Math.min(...ys) + Math.max(...ys)) / 2;
}

describe('SpecimenPreview layout stability', () => {
  it('declares intrinsic width/height and preserveAspectRatio on the svg', () => {
    for (const id of IDS) {
      const html = renderToStaticMarkup(createElement(SpecimenPreview, { id }));
      expect(html).toContain(`width="${SPECIMEN_INTRINSIC_SIZE}"`);
      expect(html).toContain(`height="${SPECIMEN_INTRINSIC_SIZE}"`);
      expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
    }
  });

  it('keeps the same svg box before and after the scene loads', () => {
    for (const id of IDS) {
      const loading = renderToStaticMarkup(createElement(SpecimenPreview, { id }));
      const loaded = renderToStaticMarkup(
        createElement(SpecimenPreview, { id, scene: loadScene(id) }),
      );
      const attrs = (h: string): string =>
        (/<svg[^>]*>/.exec(h)?.[0] ?? '').replace(/class="[^"]*"/, '');
      expect(attrs(loaded)).toBe(attrs(loading));
      expect(loading).toContain('gt-specimen__placeholder');
      expect(loaded).not.toContain('gt-specimen__placeholder');
    }
  });

  it('stays decorative: aria-hidden, no <title>, no text', () => {
    for (const id of IDS) {
      const html = renderToStaticMarkup(
        createElement(SpecimenPreview, { id, scene: loadScene(id) }),
      );
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain('<title');
      expect(html).not.toContain('<text');
    }
  });
});

describe('specimen content is centred like the placeholder (no downward jump)', () => {
  it('centres each sample vertically on the box centre (50) within 0.1 units', () => {
    for (const id of IDS) {
      const scene = loadScene(id);
      expect(Math.abs(verticalCentre(scene, true) - 50)).toBeLessThanOrEqual(0.1);
    }
  });

  it('previously sat lower than centre for triangle and bar chart', () => {
    expect(verticalCentre(loadScene('triangle'), false)).toBeGreaterThan(52);
    expect(verticalCentre(loadScene('barchart'), false)).toBeGreaterThan(52);
  });

  it('keeps all geometry inside the padded 10..90 box', () => {
    for (const id of IDS) {
      const scene = loadScene(id);
      const paths = generateSpecimenPaths(scene, getCenteringOffset(scene));
      const nums = [paths.segments, paths.polylines, paths.bars, paths.axes]
        .join(' ')
        .match(/-?\d+(?:\.\d+)?/g)
        ?.map(Number) ?? [];
      for (const n of nums) {
        expect(n).toBeGreaterThanOrEqual(10 - 1e-6);
        expect(n).toBeLessThanOrEqual(90 + 1e-6);
      }
    }
  });

  it('returns zero offset for null or empty scenes', () => {
    expect(getCenteringOffset(null)).toEqual({ offsetX: 0, offsetY: 0 });
    expect(getCenteringOffset(undefined)).toEqual({ offsetX: 0, offsetY: 0 });
  });
});

describe('specimen CSS sizing', () => {
  const globalCss = read('../src/styles/global.css');
  const specimenCss = read('../src/styles/specimen.css');

  it('capture preview rule out-specifies .gt-specimen and fixes 56px square', () => {
    const m = /\.gt-capture__sample-btn\s+\.gt-capture__sample-preview\s*\{([^}]*)\}/.exec(globalCss);
    expect(m).not.toBeNull();
    const body = m?.[1] ?? '';
    expect(body).toMatch(/width:\s*56px/);
    expect(body).toMatch(/height:\s*56px/);
    expect(body).toMatch(/aspect-ratio:\s*1\s*\/\s*1/);
  });

  it('specimen base style keeps a square aspect ratio', () => {
    expect(specimenCss).toMatch(/\.gt-specimen\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
  });

  it('sample buttons keep >= 48px touch target', () => {
    expect(globalCss).toMatch(/\.gt-capture__sample-btn\s*\{[^}]*min-height:\s*108px/);
  });
});
