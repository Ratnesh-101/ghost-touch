/**
 * Pure logic for saved diagrams (Task 13, Requirement 11).
 *
 * Per architecture rule 1 (tech.md): NO window, IndexedDB, navigator, or
 * any browser API in this module. Every function takes all dependencies as
 * arguments (clock, rng) so property tests can control them exactly.
 */

import type { DiagramScene } from './scene';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A locally saved diagram entry stored in IndexedDB. */
export interface SavedDiagram {
  /** Collision-resistant id generated from clock + rng via `makeId`. */
  id: string;
  /** `Date.now()` milliseconds at save time. Used for eviction ordering. */
  createdAt: number;
  /** Spoken and displayed title: scene.title or synthesised from kind + points. */
  title: string;
  /** JPEG data-URL thumbnail captured from the Explore canvas. */
  thumbnailDataUrl: string;
  /** Full scene — offline exploration needs no network call. */
  scene: DiagramScene;
  /** Pinned entries are immune to automatic eviction. */
  pinned: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of saved diagrams. Oldest unpinned entry is evicted when exceeded. */
export const SAVED_DIAGRAMS_CAP = 20;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Generate a display+spoken title for a scene.
 *
 * Priority:
 * 1. `scene.title` when non-blank.
 * 2. The scene's `kind` plus the first labelled point names (up to 3),
 *    joined by commas: "geometry: A, B, C".
 *
 * The `lang` parameter is reserved for Requirement 10 (multilingual); for
 * now it is unused because only English is supported. Including it in the
 * signature keeps the call-sites future-proof.
 *
 * Pure: only reads the scene argument.
 */
export function savedTitle(scene: DiagramScene, _lang: string = 'en'): string {
  const title = scene.title;
  if (typeof title === 'string' && title.trim() !== '') {
    return title.trim();
  }

  // Synthesise: kind + first labelled point names
  const labelledPoints = (scene.points ?? [])
    .map((p) => (typeof p.label === 'string' && p.label.trim() !== '' ? p.label.trim() : null))
    .filter((l): l is string => l !== null)
    .slice(0, 3);

  if (labelledPoints.length > 0) {
    return `${scene.kind}: ${labelledPoints.join(', ')}`;
  }

  return scene.kind;
}

/**
 * Generate a short collision-resistant id from an injected clock and RNG.
 *
 * Format: `<base36 timestamp>-<6 random base36 chars>`.
 * Injected `nowMs` and `rng` make this fully deterministic in tests.
 *
 * @param nowMs  Current time in milliseconds (e.g. `Date.now()`).
 * @param rng    Returns a float in [0, 1); e.g. `Math.random`.
 */
export function makeId(nowMs: number, rng: () => number): string {
  const safeTs = Number.isFinite(nowMs) ? Math.max(0, Math.floor(nowMs)) : 0;
  const ts = safeTs.toString(36);
  const r = typeof rng === 'function' ? rng() : 0;
  const safeR = Number.isFinite(r) ? Math.max(0, Math.min(0.999999999999, r)) : 0;
  const rand = Math.floor(safeR * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
  return `${ts}-${rand}`;
}

/**
 * Choose the entry to evict when the cap is exceeded.
 *
 * Returns the oldest unpinned entry by `createdAt`, or `undefined` if all
 * entries are pinned (caller must refuse the new save and say so).
 *
 * Pure: does not mutate the array.
 */
export function chooseEviction(entries: readonly SavedDiagram[]): SavedDiagram | undefined {
  const unpinned = entries.filter((e) => !e.pinned);
  if (unpinned.length === 0) return undefined;
  return unpinned.reduce((oldest, e) => (e.createdAt < oldest.createdAt ? e : oldest));
}

/**
 * True when adding one more entry to a store of `count` entries would exceed
 * the cap. Caller should call `chooseEviction` first and evict, then save.
 */
export function capExceeded(count: number, cap: number = SAVED_DIAGRAMS_CAP): boolean {
  return count >= cap;
}

/**
 * Return entries sorted newest-first for display in the Saved Diagrams list.
 *
 * Pure: returns a new array, does not mutate the input.
 */
export function orderForDisplay(entries: readonly SavedDiagram[]): SavedDiagram[] {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Apply eviction + add logic to an array of saved entries, returning the new
 * array and a status.
 *
 * This is the pure decision step; the caller executes the actual storage
 * mutations. Returns:
 * - `{ ok: true; next: SavedDiagram[]; evictedId?: string }` — new entry was
 *   added (after optional eviction or in-place update).
 * - `{ ok: false; reason: 'all_pinned' }` — cap hit and all existing entries
 *   are pinned; the new entry was not added.
 *
 * Does not mutate the input array.
 */
export function applyAdd(
  entries: readonly SavedDiagram[],
  newEntry: SavedDiagram,
  cap: number = SAVED_DIAGRAMS_CAP,
): { ok: true; next: SavedDiagram[]; evictedId?: string } | { ok: false; reason: 'all_pinned' } {
  // If an entry with the same id already exists, replace it in place without evicting
  const existingIndex = entries.findIndex((e) => e.id === newEntry.id);
  if (existingIndex !== -1) {
    const next = [...entries];
    next[existingIndex] = newEntry;
    return { ok: true, next };
  }

  if (!capExceeded(entries.length, cap)) {
    return { ok: true, next: [...entries, newEntry] };
  }

  const victim = chooseEviction(entries);
  if (victim === undefined) {
    return { ok: false, reason: 'all_pinned' };
  }

  const next = entries.filter((e) => e.id !== victim.id).concat(newEntry);
  return { ok: true, next, evictedId: victim.id };
}

/**
 * Serialise a `SavedDiagram` to a JSON string.
 */
export function serialise(entry: SavedDiagram): string {
  return JSON.stringify(entry);
}

/**
 * Deserialise a JSON string or plain object back to `SavedDiagram`.
 *
 * Returns `undefined` if the value is not a valid saved-diagram shape.
 * Handles both JSON string inputs (from `serialise`) and plain objects
 * (e.g. read directly from IndexedDB).
 */
export function deserialise(raw: unknown): SavedDiagram | undefined {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  const r = parsed as Record<string, unknown>;
  if (
    typeof r.id !== 'string' ||
    r.id.trim() === '' ||
    typeof r.createdAt !== 'number' ||
    !Number.isFinite(r.createdAt) ||
    typeof r.title !== 'string' ||
    typeof r.thumbnailDataUrl !== 'string' ||
    typeof r.pinned !== 'boolean' ||
    r.scene === null ||
    typeof r.scene !== 'object' ||
    Array.isArray(r.scene)
  ) {
    return undefined;
  }

  const scene = r.scene as Record<string, unknown>;
  const validKinds = ['geometry', 'function_graph', 'bar_chart', 'unknown'];
  if (typeof scene.kind !== 'string' || !validKinds.includes(scene.kind)) {
    return undefined;
  }

  return {
    id: r.id,
    createdAt: r.createdAt,
    title: r.title,
    thumbnailDataUrl: r.thumbnailDataUrl,
    scene: r.scene as DiagramScene,
    pinned: r.pinned,
  };
}
