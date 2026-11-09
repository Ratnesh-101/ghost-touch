import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  requestScene,
  SCENE_TIMEOUT_MS,
  SceneRequestError,
} from '../src/api/scene';
import { ValidateRequestError, type ValidateResponse } from '../src/api/validate';
import type { DiagramScene } from '../src/core/scene';
import {
  SAVED_DIAGRAMS_CAP,
  type SavedDiagram,
} from '../src/core/savedDiagrams';
import { IDBDiagramStore, MemoryDiagramStore, type Drivers } from '../src/drivers';
import { captureErrorMessage } from '../src/flow/capture';
import { deletedAnnouncement, saveDiagramWithEviction } from '../src/flow/saved';
import { getLang, setLang, t, type Lang } from '../src/i18n';
import { Correct, executeCorrectSave } from '../src/screens/Correct';
import { pwaOptions } from '../vite.config';

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'locked',
    },
    speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
    diagramStore: new MemoryDiagramStore(),
  };
}

const validScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Right Triangle',
  points: [
    { id: 'p1', x: 0.2, y: 0.2, label: 'A' },
    { id: 'p2', x: 0.8, y: 0.2, label: 'B' },
    { id: 'p3', x: 0.2, y: 0.8, label: 'C' },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2', label: 'AB' },
    { id: 's2', a: 'p2', b: 'p3', label: 'BC' },
    { id: 's3', a: 'p3', b: 'p1', label: 'CA' },
  ],
};

const invalidScene: DiagramScene = {
  kind: 'geometry',
  title: 'Broken Triangle',
  points: [
    { id: 'p1', x: 0.2, y: 0.2, label: 'A' },
    { id: 'p1', x: 0.8, y: 0.2, label: 'B' }, // duplicate id
  ],
  segments: [{ id: 's1', a: 'p1', b: 'p_missing', label: 'AB' }],
};

describe('B4-01: Saved diagrams delete announcement', () => {
  it('speaks deletion and empty state as one joined utterance on last delete (CORE-07)', () => {
    const single = deletedAnnouncement('Right triangle', 2);
    expect(single).toBe(t('saved.deleted').replace('{title}', 'Right triangle'));

    const last = deletedAnnouncement('Right triangle', 0);
    expect(last).toContain(t('saved.deleted').replace('{title}', 'Right triangle'));
    expect(last).toContain(t('saved.empty'));
    // Joined into one utterance without duplicate periods
    expect(last).toBe(
      `${t('saved.deleted').replace('{title}', 'Right triangle')} ${t('saved.empty')}`,
    );
  });
});

describe('B4-02: Correct mode offline saving resilience', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('provides non-empty localized strings for correct.savedOffline in en, hi, gu', () => {
    setLang('en');
    expect(t('correct.savedOffline')).toBe('Saved without server check.');

    setLang('hi');
    expect(t('correct.savedOffline')).toBe('सर्वर जांच के बिना सहेजा गया।');

    setLang('gu');
    expect(t('correct.savedOffline')).toBe('સર્વર તપાસ વિના સાચવવામાં આવ્યું.');
  });

  it('allows saving when offline (isOnline: false) and scene invariants pass', async () => {
    const mockValidate = vi.fn();
    const result = await executeCorrectSave(validScene, {
      isOnline: false,
      requestValidate: mockValidate,
    });

    expect(mockValidate).not.toHaveBeenCalled();
    expect(result.kind).toBe('saved-offline');
    if (result.kind === 'saved-offline') {
      expect(result.scene).toEqual(validScene);
      expect(result.messageKey).toBe('correct.savedOffline');
    }
  });

  it('refuses saving when offline (isOnline: false) and scene invariants fail', async () => {
    const result = await executeCorrectSave(invalidScene, {
      isOnline: false,
    });

    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Duplicate ID'))).toBe(true);
    }
  });

  it('falls back to local invariants when online but requestValidate throws', async () => {
    const mockValidate = vi
      .fn()
      .mockRejectedValue(new ValidateRequestError('network'));

    const result = await executeCorrectSave(validScene, {
      isOnline: true,
      requestValidate: mockValidate,
    });

    expect(mockValidate).toHaveBeenCalledWith(validScene);
    expect(result.kind).toBe('saved-offline');
    if (result.kind === 'saved-offline') {
      expect(result.scene).toEqual(validScene);
      expect(result.messageKey).toBe('correct.savedOffline');
    }
  });

  it('returns validation errors when requestValidate throws and scene is invalid', async () => {
    const mockValidate = vi
      .fn()
      .mockRejectedValue(new ValidateRequestError('timeout'));

    const result = await executeCorrectSave(invalidScene, {
      isOnline: true,
      requestValidate: mockValidate,
    });

    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('returns saved result when online requestValidate succeeds with ok: true', async () => {
    const serverValidatedScene: DiagramScene = { ...validScene, title: 'Server Approved' };
    const mockValidate = vi.fn().mockResolvedValue({
      ok: true,
      scene: serverValidatedScene,
      errors: [],
    } satisfies ValidateResponse);

    const result = await executeCorrectSave(validScene, {
      isOnline: true,
      requestValidate: mockValidate,
    });

    expect(result.kind).toBe('saved');
    if (result.kind === 'saved') {
      expect(result.scene).toEqual(serverValidatedScene);
      expect(result.messageKey).toBe('correct.saved');
    }
  });

  it('returns invalid result when online requestValidate rejects with ok: false', async () => {
    const mockValidate = vi.fn().mockResolvedValue({
      ok: false,
      scene: null,
      errors: ['Collinear points A, B, C'],
    } satisfies ValidateResponse);

    const result = await executeCorrectSave(validScene, {
      isOnline: true,
      requestValidate: mockValidate,
    });

    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.errors).toEqual(['Collinear points A, B, C']);
    }
  });

  it('renders Correct screen markup with accessible save button and localized title', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Correct, {
        scene: validScene,
        photoUrl: null,
        drivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(html).toContain('gt-correct');
    expect(html).toContain(t('correct.title'));
    expect(html).toContain('gt-correct__btn--primary');
    expect(html).toContain(t('correct.save'));
    expect(html).toContain(t('correct.cancel'));
  });
});

describe('B4-03: PDF dynamically loaded chunk and worker precaching in vite.config.ts', () => {
  it('does not ignore pdf assets in workbox.globIgnores', () => {
    const globIgnores = pwaOptions.workbox?.globIgnores ?? [];
    // The previous broad pattern '**/pdf*' erroneously ignored both pdf.worker.min-*.mjs
    // and dynamic pdf chunks. Verify that broad pattern is removed.
    expect(globIgnores).not.toContain('**/pdf*');

    // Verify that none of the ignore patterns match PDF chunk or worker files
    const pdfAssetFiles = [
      'pdf.worker.min-12345.mjs',
      'assets/pdf.worker.min-12345.mjs',
      'pdf-12345.js',
      'assets/pdf-12345.js',
    ];

    const matchesGlob = (glob: string, filepath: string): boolean => {
      const escaped = glob
        .replace(/\./g, '\\.')
        .replace(/\*\*\//g, '(?:.*/)?')
        .replace(/(?<!\.)\*/g, '[^/]*');
      return new RegExp(`^${escaped}$`).test(filepath);
    };

    for (const file of pdfAssetFiles) {
      const isIgnored = globIgnores.some((pattern) => matchesGlob(pattern, file));
      expect(isIgnored).toBe(false);
    }
  });

  it('includes mjs in workbox.globPatterns so pdf worker chunk is precached', () => {
    const patterns = pwaOptions.workbox?.globPatterns ?? [];
    const includesMjs = patterns.some((p) => p.includes('mjs'));
    expect(includesMjs).toBe(true);
  });

  it('configures maximumFileSizeToCacheInBytes to at least 3 MiB for PDF worker', () => {
    const maxBytes = pwaOptions.workbox?.maximumFileSizeToCacheInBytes;
    expect(maxBytes).toBeDefined();
    expect(maxBytes).toBeGreaterThanOrEqual(3 * 1024 * 1024);
  });
});

describe('B4-04: Atomic diagram save and eviction in IndexedDB and memory store', () => {
  function makeEntry(id: string, createdAt: number, pinned = false): SavedDiagram {
    return {
      id,
      createdAt,
      title: `Diagram ${id}`,
      thumbnailDataUrl: `data:img${id}`,
      scene: { kind: 'geometry' },
      pinned,
    };
  }

  it('preserves the oldest unpinned diagram if saving fails (e.g. quota exceeded)', async () => {
    const store = new MemoryDiagramStore();
    const existing: SavedDiagram[] = [];

    // Fill store to SAVED_DIAGRAMS_CAP (20)
    for (let i = 1; i <= SAVED_DIAGRAMS_CAP; i++) {
      const e = makeEntry(`d${i}`, 1000 + i, false);
      existing.push(e);
      await store.put(e);
    }

    const victimBefore = existing[0]!; // oldest is d1
    expect(victimBefore.id).toBe('d1');

    // Simulate quota exceeded / storage write failure
    store.failWith = 'QuotaExceededError';

    const newEntry = makeEntry('d_new', 9999, false);
    const result = await saveDiagramWithEviction(store, existing, newEntry, SAVED_DIAGRAMS_CAP);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('QuotaExceededError');
    }

    // Reset failure and verify victim was NOT evicted or deleted
    store.failWith = null;
    const victimAfter = await store.get('d1');
    expect(victimAfter.ok).toBe(true);
    if (victimAfter.ok) {
      expect(victimAfter.value).toBeDefined();
      expect(victimAfter.value?.id).toBe('d1');
    }

    // New entry was not saved
    const newSaved = await store.get('d_new');
    expect(newSaved.ok).toBe(true);
    if (newSaved.ok) {
      expect(newSaved.value).toBeUndefined();
    }
  });

  it('evicts the oldest unpinned entry when put succeeds at capacity', async () => {
    const store = new MemoryDiagramStore();
    const existing: SavedDiagram[] = [];

    for (let i = 1; i <= SAVED_DIAGRAMS_CAP; i++) {
      const e = makeEntry(`d${i}`, 1000 + i, i === 1 ? false : true);
      existing.push(e);
      await store.put(e);
    }

    const newEntry = makeEntry('d_new', 9999, false);
    const result = await saveDiagramWithEviction(store, existing, newEntry, SAVED_DIAGRAMS_CAP);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evictedId).toBe('d1');
    }

    // d1 was evicted
    const victim = await store.get('d1');
    expect(victim.ok).toBe(true);
    if (victim.ok) {
      expect(victim.value).toBeUndefined();
    }

    // d_new was saved
    const saved = await store.get('d_new');
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value?.id).toBe('d_new');
    }
  });

  it('refuses eviction when all entries at capacity are pinned', async () => {
    const store = new MemoryDiagramStore();
    const existing: SavedDiagram[] = [];

    for (let i = 1; i <= SAVED_DIAGRAMS_CAP; i++) {
      const e = makeEntry(`d${i}`, 1000 + i, true); // all pinned
      existing.push(e);
      await store.put(e);
    }

    const newEntry = makeEntry('d_new', 9999, false);
    const result = await saveDiagramWithEviction(store, existing, newEntry, SAVED_DIAGRAMS_CAP);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('all_pinned');
    }

    // All original entries remain intact
    const all = await store.list();
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value.length).toBe(SAVED_DIAGRAMS_CAP);
    }
  });

  it('IDBDiagramStore putWithEviction deletes victim before put (R5-02, R5-09)', async () => {
    const callOrder: string[] = [];
    const eventListeners: Record<string, ((ev?: unknown) => void)[]> = {};

    const fakeFactory = {
      open: () => {
        const fakeTx = {
          addEventListener: vi.fn((type: string, listener: (ev?: unknown) => void) => {
            if (!eventListeners[type]) eventListeners[type] = [];
            eventListeners[type].push(listener);
          }),
          objectStore: () => ({
            delete: (id: string) => {
              callOrder.push(`delete:${id}`);
              const req: Record<string, unknown> = {};
              setTimeout(() => {
                if (typeof req.onsuccess === 'function') {
                  (req.onsuccess as () => void)();
                }
              }, 0);
              return req;
            },
            put: (entry: SavedDiagram) => {
              callOrder.push(`put:${entry.id}`);
              const req: Record<string, unknown> = {};
              setTimeout(() => {
                if (typeof req.onsuccess === 'function') {
                  (req.onsuccess as () => void)();
                }
                setTimeout(() => {
                  eventListeners['complete']?.forEach((cb) => cb());
                }, 0);
              }, 0);
              return req;
            },
          }),
        };

        const fakeDb = {
          objectStoreNames: { contains: () => true },
          close: vi.fn(),
          transaction: () => fakeTx,
        };
        const req: Record<string, unknown> = {};
        setTimeout(() => {
          if (typeof req.onsuccess === 'function') {
            (req.onsuccess as (ev: unknown) => void)({ target: { result: fakeDb } });
          }
        }, 0);
        return req;
      },
    } as unknown as IDBFactory;

    const store = new IDBDiagramStore(fakeFactory);
    const res = await store.putWithEviction(makeEntry('new_d', 5000), 'old_d');

    expect(res.ok).toBe(true);
    // R5-02: Victim MUST be deleted before putting new entry inside the same transaction
    expect(callOrder).toEqual(['delete:old_d', 'put:new_d']);
    // R5-09: Must use addEventListener for completion and aborts
    expect(eventListeners['complete']).toBeDefined();
    expect(eventListeners['error']).toBeDefined();
    expect(eventListeners['abort']).toBeDefined();
  });

  it('IDBDiagramStore putWithEviction returns ok:false when put fails (quota error)', async () => {
    const callOrder: string[] = [];

    const fakeFactory = {
      open: () => {
        const fakeTx = {
          addEventListener: vi.fn(),
          objectStore: () => ({
            delete: (id: string) => {
              callOrder.push(`delete:${id}`);
              const req: Record<string, unknown> = {};
              setTimeout(() => {
                if (typeof req.onsuccess === 'function') {
                  (req.onsuccess as () => void)();
                }
              }, 0);
              return req;
            },
            put: () => {
              callOrder.push('put:failed');
              const req: Record<string, unknown> = {
                error: new Error('QuotaExceededError'),
              };
              setTimeout(() => {
                if (typeof req.onerror === 'function') {
                  (req.onerror as () => void)();
                }
              }, 0);
              return req;
            },
          }),
        };

        const fakeDb = {
          objectStoreNames: { contains: () => true },
          close: vi.fn(),
          transaction: () => fakeTx,
        };
        const req: Record<string, unknown> = {};
        setTimeout(() => {
          if (typeof req.onsuccess === 'function') {
            (req.onsuccess as (ev: unknown) => void)({ target: { result: fakeDb } });
          }
        }, 0);
        return req;
      },
    } as unknown as IDBFactory;

    const store = new IDBDiagramStore(fakeFactory);
    const res = await store.putWithEviction(makeEntry('new_d', 5000), 'old_d');

    expect(res.ok).toBe(false);
    expect(callOrder).toEqual(['delete:old_d', 'put:failed']);
  });
});

describe('B4-06 & B4-07: Render cold start timeout, retry and error mapping', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('lengthens SCENE_TIMEOUT_MS to at least 60 seconds to cover Render cold starts', () => {
    expect(SCENE_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('retries on HTTP 502 Bad Gateway and speaks localized waking-up notice', async () => {
    const onRetryMock = vi.fn();
    const mockSuccessResponse = {
      scene: { kind: 'geometry', title: 'Triangle' },
      mode: 'ai',
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const blob = new Blob(['fake image'], { type: 'image/jpeg' });
    const res = await requestScene(blob, {
      fetchImpl: fetchMock,
      timeoutMs: 5000,
      onRetry: onRetryMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetryMock).toHaveBeenCalledWith(t('capture.wakingUp'));
    expect(res.mode).toBe('ai');
    expect(res.scene.title).toBe('Triangle');
  });

  it('does not retry on HTTP 504 and throws SceneRequestError timeout', async () => {
    const onRetryMock = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 504 }));

    const blob = new Blob(['fake image'], { type: 'image/jpeg' });
    await expect(
      requestScene(blob, {
        fetchImpl: fetchMock,
        timeoutMs: 5000,
        onRetry: onRetryMock,
      }),
    ).rejects.toMatchObject({
      name: 'SceneRequestError',
      failure: 'timeout',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onRetryMock).not.toHaveBeenCalled();
  });

  it('throws SceneRequestError with failure "gateway" when 502 persists after retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(new Response('', { status: 502 }));

    const blob = new Blob(['fake image'], { type: 'image/jpeg' });
    await expect(
      requestScene(blob, {
        fetchImpl: fetchMock,
        timeoutMs: 5000,
      }),
    ).rejects.toMatchObject({
      name: 'SceneRequestError',
      failure: 'gateway',
    });
  });

  it('maps SceneRequestError "gateway" to capture.errorGateway in captureErrorMessage', () => {
    const error = new SceneRequestError('gateway');
    const msgEn = captureErrorMessage(error);
    expect(msgEn).toBe(t('capture.errorGateway'));
    expect(msgEn).toContain('waking up');

    setLang('hi');
    expect(captureErrorMessage(error)).toBe(t('capture.errorGateway'));

    setLang('gu');
    expect(captureErrorMessage(error)).toBe(t('capture.errorGateway'));
  });

  it('maps SceneRequestError "timeout" to capture.errorTimeout in captureErrorMessage', () => {
    const error = new SceneRequestError('timeout');
    const msgEn = captureErrorMessage(error);
    expect(msgEn).toBe(t('capture.errorTimeout'));
    expect(msgEn).toContain('too long');

    setLang('hi');
    expect(captureErrorMessage(error)).toBe(t('capture.errorTimeout'));

    setLang('gu');
    expect(captureErrorMessage(error)).toBe(t('capture.errorTimeout'));
  });

  it('preserves backwards compatibility for busy and generic errors in captureErrorMessage', () => {
    expect(captureErrorMessage(new SceneRequestError('busy'))).toBe(t('capture.errorBusy'));
    expect(captureErrorMessage(new SceneRequestError('http'))).toBe(t('capture.error'));
    expect(captureErrorMessage(new SceneRequestError('network'))).toBe(t('capture.error'));
    expect(captureErrorMessage(new Error('arbitrary error'))).toBe(t('capture.error'));
  });
});
