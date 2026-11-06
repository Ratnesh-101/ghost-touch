/**
 * Guide my finger — pure core module.
 *
 * Implements the Guide contract per docs/briefs/guide-share-contract.md.
 * Pure TypeScript: no DOM, React, or browser drivers imported.
 */

export type { GuideConfig } from './config';
export { DEFAULT_GUIDE } from './config';

export type {
  NormPoint,
  GuideTarget,
  ResolvedTarget,
  HintKey,
} from './geometry';

export {
  resolveTarget,
  vectorTo,
  pulseIntervalMs,
  pitchFor,
  panFor,
  directionHint,
  hasArrived,
  SECTOR_HYSTERESIS_DEG,
} from './geometry';

export type {
  GuideState,
  GuideInput,
  GuideEffect,
} from './machine';

export {
  initialGuideState,
  guideStep,
} from './machine';

export type { SemanticName } from './semantic';

export {
  SEMANTIC_NAMES,
  normalizeSemanticInput,
  matchSemanticPhrase,
  resolveSemantic,
} from './semantic';

