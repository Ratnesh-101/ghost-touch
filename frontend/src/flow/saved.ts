/**
 * Pure helpers for the Saved Diagrams screen (Task 26, Requirement 17.3 and 17.4).
 *
 * No React and no browser APIs: the screen passes in the store, a function that says whether it
 * is still open, and a callback that applies the result.
 */
import { orderForDisplay, type SavedDiagram } from '../core/savedDiagrams';
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
  apply({ phase: 'list', entries, announcement: entries.map((e) => e.title).join('. ') });
}

/**
 * One message for a deletion. When it removes the last diagram the empty-list notice is part of
 * the same utterance, because a second `speak` would cut the first off (CORE-07).
 */
export function deletedAnnouncement(title: string, remaining: number): string {
  const deleted = t('saved.deleted').replace('{title}', title);
  return remaining > 0 ? deleted : joinAnnouncements([deleted, t('saved.empty')]);
}
