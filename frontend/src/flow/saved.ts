/**
 * Pure helpers for the Saved Diagrams screen (Task 26, Requirement 17.3 and 17.4).
 *
 * No React and no browser APIs: the screen passes in the store, a function that says whether it
 * is still open, and a callback that applies the result.
 */
import {
  applyAdd,
  orderForDisplay,
  SAVED_DIAGRAMS_CAP,
  type SavedDiagram,
} from '../core/savedDiagrams';
import type { DiagramStore } from '../drivers/diagramStore';
import { t } from '../i18n';
import { joinAnnouncements } from './explore';

export interface SavedLoadView {
  phase: 'error' | 'empty' | 'list';
  entries: SavedDiagram[];
  /** What to speak and show: the titles, the empty notice, or the load error. */
  announcement: string;
}

/**
 * Read the saved list and hand the result to `apply`, unless the screen was left while the read
 * was running. A late result must not speak over whatever screen the user is on now (CORE-03).
 */
export async function loadSavedList(
  store: Pick<DiagramStore, 'list'>,
  isActive: () => boolean,
  apply: (view: SavedLoadView) => void,
): Promise<void> {
  const result = await store.list();
  if (!isActive()) return;
  if (!result.ok) {
    apply({ phase: 'error', entries: [], announcement: t('saved.errorLoad') });
    return;
  }
  const entries = orderForDisplay(result.value);
  if (entries.length === 0) {
    apply({ phase: 'empty', entries, announcement: t('saved.empty') });
    return;
  }
  // R3-05: joinAnnouncements used instead of raw entries.map((e) => e.title).join('. ')
  apply({ phase: 'list', entries, announcement: joinAnnouncements(entries.map((e) => e.title)) });
}

/**
 * One message for a deletion. When it removes the last diagram the empty-list notice is part of
 * the same utterance, because a second `speak` would cut the first off (CORE-07).
 */
export function deletedAnnouncement(title: string, remaining: number): string {
  const deleted = t('saved.deleted').replace('{title}', title);
  return remaining > 0 ? deleted : joinAnnouncements([deleted, t('saved.empty')]);
}

/**
 * Delete a diagram and invoke callbacks if still active (R3-04).
 * If the screen unmounts before delete finishes (isActive() returns false),
 * callbacks are not invoked so no late speech occurs.
 */
export async function confirmDeleteDiagram(
  store: Pick<DiagramStore, 'delete'>,
  id: string,
  isActive: () => boolean,
  onDeleted: () => void,
  onError?: (error: string) => void,
): Promise<void> {
  const result = await store.delete(id);
  if (!isActive()) return;
  if (!result.ok) {
    onError?.(result.error);
    return;
  }
  onDeleted();
}

export type SaveWithEvictionResult =
  | { ok: true; evictedId?: string }
  | { ok: false; error: 'all_pinned' | string };

/**
 * Save a diagram and evict the oldest unpinned entry atomically if at cap (B4-04).
 * If saving fails (e.g. storage error, quota exceeded), nothing is evicted.
 */
export async function saveDiagramWithEviction(
  store: DiagramStore,
  existing: readonly SavedDiagram[],
  newEntry: SavedDiagram,
  cap: number = SAVED_DIAGRAMS_CAP,
): Promise<SaveWithEvictionResult> {
  const decision = applyAdd(existing, newEntry, cap);
  if (!decision.ok) {
    return { ok: false, error: 'all_pinned' };
  }

  if (typeof store.putWithEviction === 'function') {
    const res = await store.putWithEviction(newEntry, decision.evictedId);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return { ok: true, evictedId: decision.evictedId };
  }

  // Evict-after-successful-put: put first, delete victim only if put succeeds
  const putResult = await store.put(newEntry);
  if (!putResult.ok) {
    return { ok: false, error: putResult.error };
  }

  if (decision.evictedId !== undefined) {
    const deleteResult = await store.delete(decision.evictedId);
    if (!deleteResult.ok) {
      // Roll back the new entry to preserve capacity cap
      await store.delete(newEntry.id);
      return { ok: false, error: deleteResult.error };
    }
  }

  return { ok: true, evictedId: decision.evictedId };
}
