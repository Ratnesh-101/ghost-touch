/**
 * Pure helpers for the Saved Diagrams screen (Task 26, Requirement 17.3 and 17.4).
 *
 * No React and no browser APIs: the screen passes in the store, a function that says whether it
 * is still open, and a callback that applies the result.
 */
import {
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
  const prior = existing.find((e) => e.id === newEntry.id);
  const entryToSave: SavedDiagram = prior
    ? {
        ...newEntry,
        pinned: prior.pinned,
        createdAt: prior.createdAt,
      }
    : newEntry;

  const isUpdate = prior !== undefined;
  // Calculate surplus to ensure the store never exceeds cap (Req 22.7, 22.9, 22.11)
  const targetSurplus = Math.max(0, existing.length + (isUpdate ? 0 : 1) - cap);

  let evictedIds: string[] = [];
  if (targetSurplus > 0) {
    // Pick unpinned victims ordered by oldest createdAt
    const candidates = existing
      .filter((e) => e.id !== entryToSave.id && !e.pinned)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (candidates.length < targetSurplus) {
      return { ok: false, error: 'all_pinned' };
    }
    evictedIds = candidates.slice(0, targetSurplus).map((c) => c.id);
  }

  const primaryEvictedId = evictedIds[0];

  if (typeof store.putWithEviction === 'function' && evictedIds.length <= 1) {
    const res = await store.putWithEviction(entryToSave, primaryEvictedId);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return { ok: true, evictedId: primaryEvictedId };
  }

  // Non-atomic store path:
  // Evict-after-successful-put: put first, delete victims only if put succeeds
  const putResult = await store.put(entryToSave);
  if (!putResult.ok) {
    return { ok: false, error: putResult.error };
  }

  for (const victimId of evictedIds) {
    const deleteResult = await store.delete(victimId);
    if (!deleteResult.ok) {
      // Roll back the put to preserve capacity cap
      if (isUpdate && prior) {
        await store.put(prior);
      } else {
        await store.delete(entryToSave.id);
      }
      return { ok: false, error: deleteResult.error };
    }
  }

  return { ok: true, evictedId: primaryEvictedId };
}
