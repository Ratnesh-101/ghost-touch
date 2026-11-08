/**
 * Saved Diagrams: no speech after leaving, one message when the last diagram is deleted
 * (Task 26, Requirement 17.3 and 17.4, CORE-03 and CORE-07). Written by Kiro.
 */
import { describe, expect, it, vi } from 'vitest';
import type { DiagramStore, StoreResult } from '../src/drivers/diagramStore';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import { deletedAnnouncement, loadSavedList, type SavedLoadView } from '../src/flow/saved';
import { t } from '../src/i18n';

function entry(id: string, title: string, createdAt: number): SavedDiagram {
  return { id, createdAt, title, thumbnailDataUrl: '', scene: { kind: 'geometry' }, pinned: false };
}

/** A store whose list() resolves only when the test says so. */
function slowStore(): { store: Pick<DiagramStore, 'list'>; resolve: (r: StoreResult<SavedDiagram[]>) => void } {
  let resolve!: (r: StoreResult<SavedDiagram[]>) => void;
  const promise = new Promise<StoreResult<SavedDiagram[]>>((r) => {
    resolve = r;
  });
  return { store: { list: () => promise }, resolve };
}

describe('loadSavedList (CORE-03)', () => {
  it('does nothing when the screen was left before the list arrived', async () => {
    const { store, resolve } = slowStore();
    let active = true;
    const apply = vi.fn();
    const done = loadSavedList(store, () => active, apply);

    active = false; // the user pressed Back
    resolve({ ok: true, value: [entry('a', 'Triangle', 2)] });
    await done;

    expect(apply).not.toHaveBeenCalled();
  });

  it('does nothing on a storage error either when the screen was left', async () => {
    const { store, resolve } = slowStore();
    let active = true;
    const apply = vi.fn();
    const done = loadSavedList(store, () => active, apply);
    active = false;
    resolve({ ok: false, error: 'storage_unavailable' });
    await done;
    expect(apply).not.toHaveBeenCalled();
  });

  it('announces the titles newest first when the screen is still open', async () => {
    const { store, resolve } = slowStore();
    const seen: SavedLoadView[] = [];
    const done = loadSavedList(store, () => true, (v) => seen.push(v));
    resolve({ ok: true, value: [entry('a', 'Old', 1), entry('b', 'New', 9)] });
    await done;

    expect(seen).toHaveLength(1);
    expect(seen[0]?.phase).toBe('list');
    expect(seen[0]?.entries.map((e) => e.title)).toEqual(['New', 'Old']);
    expect(seen[0]?.announcement).toBe('New. Old');
  });

  it('announces the empty list and the load error with the translated text', async () => {
    const empty = slowStore();
    const seenEmpty: SavedLoadView[] = [];
    const doneEmpty = loadSavedList(empty.store, () => true, (v) => seenEmpty.push(v));
    empty.resolve({ ok: true, value: [] });
    await doneEmpty;
    expect(seenEmpty[0]).toMatchObject({ phase: 'empty', announcement: t('saved.empty') });

    const failed = slowStore();
    const seenFailed: SavedLoadView[] = [];
    const doneFailed = loadSavedList(failed.store, () => true, (v) => seenFailed.push(v));
    failed.resolve({ ok: false, error: 'storage_unavailable' });
    await doneFailed;
    expect(seenFailed[0]).toMatchObject({ phase: 'error', announcement: t('saved.errorLoad') });
  });
});

describe('deletedAnnouncement (CORE-07)', () => {
  it('is one message that carries both facts when the last diagram goes', () => {
    const msg = deletedAnnouncement('Triangle', 0);
    expect(msg).toContain(t('saved.deleted').replace('{title}', 'Triangle').replace(/\.$/, ''));
    expect(msg).toContain(t('saved.empty').replace(/\.$/, ''));
    expect(msg.indexOf('Triangle')).toBeLessThan(msg.indexOf(t('saved.empty').replace(/\.$/, '')));
  });

  it('is just the deletion message when diagrams remain', () => {
    expect(deletedAnnouncement('Triangle', 3)).toBe(t('saved.deleted').replace('{title}', 'Triangle'));
  });
});
