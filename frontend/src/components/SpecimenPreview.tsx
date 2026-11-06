/**
 * SpecimenPreview — real mini preview for the "specimen jar" sample cards.
 *
 * Requirements (docs/briefs/lab-spec.md & docs/briefs/agy-lab-specimen.md):
 * - Takes `{ id: SampleId; className?: string }`.
 * - Renders an inline `<svg viewBox="0 0 100 100">` with lines drawn in
 *   life green on deep lab charcoal, thin strokes, rounded caps, with vertex dots.
 * - Decorative only: `aria-hidden="true"`, `focusable="false"`, no `<title>`.
 * - Purely visual: never an error message, never spoken text, zero live regions.
 * - Shows a neutral static specimen jar glyph while loading or on failure.
 * - Served from precache via `loadSample(id)`.
 * - Styles imported from `../styles/specimen.css`.
 */

import { useEffect, useState, type JSX } from 'react';
import { loadSample, type SampleId } from '../api/scene';
import type { DiagramScene } from '../core/scene';
import {
  generateSpecimenPaths,
  getPlaceholderJarPath,
  type SpecimenPaths,
} from './specimenPaths';
import '../styles/specimen.css';

export interface SpecimenPreviewProps {
  /** The sample diagram identifier ('triangle' | 'sine' | 'barchart') */
  id: SampleId;
  /** Optional extra CSS class name for layout / card styling */
  className?: string;
  /** Optional preloaded scene (bypasses fetch / cache) */
  scene?: DiagramScene;
  /** Optional custom fetch implementation (useful for unit tests) */
  fetchImpl?: typeof fetch;
}

/** Module-level in-memory cache to eliminate duplicate loads across renders */
const sampleCache = new Map<SampleId, DiagramScene>();

/** Returns the cached DiagramScene if already loaded */
export function getCachedSample(id: SampleId): DiagramScene | undefined {
  return sampleCache.get(id);
}

/** Stores a DiagramScene into the module sample cache */
export function setCachedSample(id: SampleId, scene: DiagramScene): void {
  sampleCache.set(id, scene);
}

/** Clears the module sample cache (primarily for test isolation) */
export function clearSampleCache(): void {
  sampleCache.clear();
}

export function SpecimenPreview({
  id,
  className,
  scene: propScene,
  fetchImpl,
}: SpecimenPreviewProps): JSX.Element {
  const [scene, setScene] = useState<DiagramScene | null>(
    () => propScene ?? sampleCache.get(id) ?? null,
  );
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    if (propScene) {
      setScene(propScene);
      setFailed(false);
      return;
    }

    const cached = sampleCache.get(id);
    if (cached) {
      setScene(cached);
      setFailed(false);
      return;
    }

    let active = true;
    setFailed(false);

    loadSample(id, fetchImpl)
      .then((loaded) => {
        sampleCache.set(id, loaded);
        if (active) {
          setScene(loaded);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [id, propScene, fetchImpl]);

  const paths: SpecimenPaths | null =
    scene && !failed ? generateSpecimenPaths(scene) : null;
  const isReady = paths !== null && paths.hasContent;

  const rootClass = ['gt-specimen', `gt-specimen--${id}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={rootClass}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {/* Charcoal base plate */}
      <rect
        className="gt-specimen__bg"
        width="100"
        height="100"
        rx="8"
      />

      {isReady ? (
        <g className="gt-specimen__content">
          {paths.axes ? (
            <path
              className="gt-specimen__axis"
              d={paths.axes}
            />
          ) : null}
          {paths.segments ? (
            <path
              className="gt-specimen__line gt-specimen__line--segment"
              d={paths.segments}
            />
          ) : null}
          {paths.polylines ? (
            <path
              className="gt-specimen__line gt-specimen__line--polyline"
              d={paths.polylines}
            />
          ) : null}
          {paths.bars ? (
            <path
              className="gt-specimen__line gt-specimen__line--bar"
              d={paths.bars}
            />
          ) : null}
          {paths.vertexDots.map((dot) => (
            <circle
              key={dot.id}
              className="gt-specimen__dot"
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
            />
          ))}
        </g>
      ) : (
        /* Neutral static glyph: specimen jar outline, strictly never text or error */
        <path
          className="gt-specimen__placeholder"
          d={getPlaceholderJarPath()}
        />
      )}
    </svg>
  );
}
