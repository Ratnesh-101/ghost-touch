/**
 * DiagramScene helpers and re-exported generated types.
 *
 * Per tech.md rule 3 ("one schema, two languages"), the TypeScript scene
 * types are generated from the backend JSON Schema into
 * `types/scene.gen.ts`. This module is the single import surface for the
 * pure core: it re-exports the generated types.
 *
 * Pure core (tech.md rule 1): no DOM, React, or browser API access.
 */

import type {
  Axes,
  Bar,
  DiagramScene,
  Kind,
  Point,
  Polyline,
  Segment,
} from '../types/scene.gen';

// Re-export the generated schema types so the rest of the core imports
// every scene type from this one module.
export type { Axes, Bar, DiagramScene, Point, Polyline, Segment };

/** Kind discriminator for a DiagramScene. */
export type SceneKind = Kind;
