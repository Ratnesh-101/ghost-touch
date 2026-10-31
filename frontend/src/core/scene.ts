/**
 * DiagramScene helpers and corrected generated types.
 *
 * Per tech.md rule 3 ("one schema, two languages"), the TypeScript scene
 * types are generated from the backend JSON Schema into
 * `types/scene.gen.ts`. This module is the single import surface for the
 * pure core: it re-exports the generated types with one correction.
 *
 * `Polyline.points` is typed here as `[number, number][]`. The generator
 * emits `[unknown, unknown][]` because of a json-schema-to-typescript
 * limitation with `prefixItems`, but every polyline point is a normalized
 * (x, y) pair with both values in [0, 1].
 *
 * Pure core (tech.md rule 1): no DOM, React, or browser API access.
 */

import type { Axes, Bar, Point, Segment } from '../types/scene.gen';

// Re-export the generated schema types that need no correction, so the
// rest of the core imports every scene type from this one module.
export type { Axes, Bar, Point, Segment };

/** Kind discriminator for a DiagramScene. */
export type SceneKind = 'geometry' | 'function_graph' | 'bar_chart' | 'unknown';

/**
 * An ordered sequence of normalized (x, y) points; used for curves.
 *
 * Corrected from the generated `[unknown, unknown][]` — every entry is a
 * normalized `[x, y]` pair with both values in [0, 1] (origin top-left).
 */
export interface Polyline {
  id: string;
  label?: string | null;
  points: [number, number][];
  [k: string]: unknown;
}

/**
 * The normalized, validated description of a diagram (source of truth).
 *
 * All `x`, `y` values are in [0, 1] with origin top-left. Aspect ratio is
 * kept by the letterboxed `Viewport` (see `geometry.ts`), never stretched.
 */
export interface DiagramScene {
  version?: 1;
  kind: SceneKind;
  title?: string | null;
  points?: Point[];
  segments?: Segment[];
  polylines?: Polyline[];
  bars?: Bar[];
  axes?: Axes | null;
  facts?: string[];
  [k: string]: unknown;
}
