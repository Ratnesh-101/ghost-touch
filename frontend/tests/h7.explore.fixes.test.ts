/**
 * Regression and unit tests for Lane h7-explore-fixes:
 * R3-01..R3-05 and GT-01..GT-04, GT-09.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  initialState,
  mergeAnnouncements,
  step,
  type Effect,
  type EngineState,
  type PointerHistory,
} from '../src/flow/explore';
import {
  confirmDeleteDiagram,
  loadSavedList,
  type SavedLoadView,
} from '../src/flow/saved';
import {
  promoteOldestPointer,
  selfHealPrimaryPointer,
} from '../src/screens/Explore';
import { AskManager } from '../src/flow/ask';
import { runEffects, type Drivers } from '../src/drivers';
import type { DiagramStore, StoreResult } from '../src/drivers/diagramStore';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import { t } from '../src/i18n';
import exploreSource from '../src/screens/Explore.tsx?raw';
import savedSource from '../src/screens/SavedDiagrams.tsx?raw';

function makeMockDrivers(): Drivers & {
  spokenUtterances: string[];
  tones: Array<number | null>;
  hapticsStopped: number;
} {
  const spokenUtterances: string[] = [];
  const tones: Array<number | null> = [];
  let hapticsStopped = 0;

  return {
    spokenUtterances,
    tones,
    hapticsStopped,
    haptics: {
      supported: true,
      lastResult: null,
      vibrate: vi.fn(),
      stop: vi.fn(() => {
        hapticsStopped++;
      }),
    },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn((freq: number | null) => {
        tones.push(freq);
      }),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn((text: string) => {
        spokenUtterances.push(text);
      }),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      stopSpeaking: vi.fn(),
    },
    diagramStore: {
      list: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('R3-01: Centre announcement cancelled on pointer-down', () => {
  it('pointer-down at canvas centre on a vertex gives exactly ONE speak containing both texts', () => {
    const drivers = makeMockDrivers();
    const centreMsg = t('explore.centre');
    const vertexEffects: Effect[] = [{ kind: 'speak', text: 'Point A' }];

    // R3-01: put the centre message into the merge
    const merged = mergeAnnouncements([centreMsg], vertexEffects);

    // Exactly one speak effect
    const speakEffects = merged.filter((e) => e.kind === 'speak');
    expect(speakEffects).toHaveLength(1);
    expect(speakEffects[0]!.text).toContain(centreMsg.replace(/\.$/, ''));
    expect(speakEffects[0]!.text).toContain('Point A');

    // Run effects through drivers
    runEffects(merged, drivers, 'en-IN');
    expect(drivers.speech.speak).toHaveBeenCalledTimes(1);
    expect(drivers.spokenUtterances).toEqual([`${centreMsg} Point A`]);
  });

  it('source guard: Explore.tsx merges centreAnnouncements into applyMoveResult instead of speaking directly', () => {
    // In old code: drivers.speech.speak(msg, lang) was called for centreResult.speakCentre
    expect(exploreSource).not.toMatch(/if\s*\(centreResult\.speakCentre\)\s*\{\s*const msg = t\('explore\.centre'\);\s*drivers\.speech\.speak/);
    expect(exploreSource).toContain('centreResult.speakCentre ? [t(\'explore.centre\')] : []');
    expect(exploreSource).toContain('applyMoveResult(moveResult, lang, centreAnnouncements)');
  });
});

describe('R3-02: update lastSpokenRef unconditionally from merged speak effect', () => {
  it('merged speech with no axis crossings provides the vertex text unconditionally', () => {
    const vertexOnlyEffects: Effect[] = [
      { kind: 'tone', hz: 440 },
      { kind: 'speak', text: 'Vertex B' },
    ];
    const noAxisCrossings: string[] = [];

    const merged = mergeAnnouncements(noAxisCrossings, vertexOnlyEffects);
    const joined = merged.find((e) => e.kind === 'speak');

    // In old code: lastSpokenRef only updated if moveResult.axisCrossings.length > 0
    // In fixed code: joined?.kind === 'speak' unconditionally provides the text
    expect(joined?.text).toBe('Vertex B');
  });

  it('merged speech with no axis crossings provides bar text unconditionally', () => {
    const barOnlyEffects: Effect[] = [
      { kind: 'tone', hz: 520 },
      { kind: 'speak', text: 'Chemistry, 85' },
    ];
    const merged = mergeAnnouncements([], barOnlyEffects);
    const joined = merged.find((e) => e.kind === 'speak');
    expect(joined?.text).toBe('Chemistry, 85');
  });

  it('source guard: Explore.tsx does not gate lastSpokenRef behind axisCrossings.length > 0', () => {
    expect(exploreSource).not.toMatch(/if\s*\(moveResult\.axisCrossings\.length > 0\)\s*\{\s*const joined/);
  });
});

describe('R3-03: extract ONE applyMoveResult helper', () => {
  it('source guard: Explore.tsx extracts and calls applyMoveResult in pointerdown, move, and promotion', () => {
    expect(exploreSource).toContain('const applyMoveResult = (');
    const calls = exploreSource.match(/applyMoveResult\(/g);
    expect(calls?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('R3-04: SavedDiagrams handleConfirmDelete unmount guard and functional update', () => {
  it('unmount during a pending delete: onDeleted / speak not called', async () => {
    let resolveDelete!: (r: StoreResult<void>) => void;
    const deletePromise = new Promise<StoreResult<void>>((res) => {
      resolveDelete = res;
    });
    const store: Pick<DiagramStore, 'delete'> = {
      delete: () => deletePromise,
    };

    let isActive = true;
    const onDeleted = vi.fn();
    const onError = vi.fn();

    const pending = confirmDeleteDiagram(store, 'diag-1', () => isActive, onDeleted, onError);

    // Component unmounts while delete is in flight
    isActive = false;

    resolveDelete({ ok: true, value: undefined });
    await pending;

    expect(onDeleted).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('confirmed delete when still mounted invokes onDeleted and reports deletion', async () => {
    const store: Pick<DiagramStore, 'delete'> = {
      delete: async () => ({ ok: true, value: undefined }),
    };

    const onDeleted = vi.fn();
    await confirmDeleteDiagram(store, 'diag-1', () => true, onDeleted);

    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('source guard: SavedDiagrams.tsx checks activeRef after await in delete', () => {
    expect(savedSource).toContain('confirmDeleteDiagram(');
    expect(savedSource).toContain('() => activeRef.current');
  });
});

describe('R3-05: loadSavedList joins titles with joinAnnouncements', () => {
  it('joins titles without doubling sentence punctuation', async () => {
    const titles = ['Triangle.', 'Circle।', 'Square'];
    const entries: SavedDiagram[] = titles.map((title, i) => ({
      id: `id-${i}`,
      title,
      createdAt: i,
      thumbnailDataUrl: '',
      scene: { kind: 'geometry' },
      pinned: false,
    }));

    const store: Pick<DiagramStore, 'list'> = {
      list: async () => ({ ok: true, value: entries }),
    };

    let resultView: SavedLoadView | null = null;
    await loadSavedList(store, () => true, (view) => {
      resultView = view;
    });

    expect(resultView).not.toBeNull();
    const loaded = resultView as unknown as SavedLoadView;
    expect(loaded.announcement).toBe('Square. Circle। Triangle.');
    expect(loaded.announcement).not.toMatch(/[.!?।॥]\./);
  });

  it('source guard: loadSavedList uses joinAnnouncements', () => {
    expect(savedSource).not.toMatch(/entries\.map\(\(e\)\s*=>\s*e\.title\)\.join\('\. '\)/);
  });
});

describe('GT-01: handleVoiceAsk re-entry guard', () => {
  it('AskManager isBusy reflects busy state', () => {
    const manager = new AskManager();
    expect(manager.isBusy()).toBe(false);
  });

  it('source guard: handleVoiceAsk checks busyRef and askManager.isBusy() and clears in finally', () => {
    expect(exploreSource).toMatch(/if\s*\(busyRef\.current\s*\|\|\s*askManager\.current\.isBusy\(\)\)\s*return;/);
    expect(exploreSource).toContain('busyRef.current = true;');
    expect(exploreSource).toContain('busyRef.current = false;');
  });
});

describe('GT-02: Silence tone and haptics and skip effects during Ask', () => {
  it('source guard: handleVoiceAsk stops tone and haptics and sets askActive', () => {
    expect(exploreSource).toContain('askActive.current = true;');
    expect(exploreSource).toContain('drivers.audio.setTone(null);');
    expect(exploreSource).toContain('drivers.haptics.stop();');
    expect(exploreSource).toContain('askActive.current = false;');
  });

  it('source guard: handlePointerMove skips runEffects when askActive is true', () => {
    expect(exploreSource).toMatch(/if\s*\(askActive\.current\)\s*\{[^}]*scheduleDraw\(view,\s*coords\);\s*return;\s*\}/s);
  });
});

describe('GT-03: Tone stuck on second-finger promotion fix', () => {
  it('step with kind lift emits tone null and vibrate stop', () => {
    // Engine state on a line
    const onLineState: EngineState = {
      ...initialState(),
      onLine: true,
      lastBuzz: 100,
    };

    const { state, effects } = step(onLineState, { kind: 'lift', t: 100 });
    expect(state.onLine).toBe(false);

    // Emits tone: null to stop sound
    const toneEffect = effects.find((e) => e.kind === 'tone');
    expect(toneEffect).toEqual({ kind: 'tone', hz: null });

    // Emits vibrate: 0 to stop haptics
    const vibrateEffect = effects.find((e) => e.kind === 'vibrate');
    expect(vibrateEffect).toEqual({ kind: 'vibrate', pattern: 0 });
  });

  it('source guard: Explore.tsx runs step lift and effects before promotion reset', () => {
    expect(exploreSource).toMatch(/const liftResult = step\(engineState\.current,\s*\{\s*kind:\s*'lift'/);
    expect(exploreSource).toMatch(/runEffects\(liftResult\.effects,\s*drivers\);/);
  });
});

describe('GT-04: Pointer tracking clear on blur/visibility and self-heal', () => {
  it('selfHealPrimaryPointer clears primaryId when id is not in activePointers', () => {
    const activePointers = new Map<number, unknown>([[2, {}]]);
    // Primary id 1 was lost
    const healed = selfHealPrimaryPointer(1, activePointers);
    expect(healed).toBeNull();

    // Primary id 2 is active
    const valid = selfHealPrimaryPointer(2, activePointers);
    expect(valid).toBe(2);

    // Primary id null stays null
    expect(selfHealPrimaryPointer(null, activePointers)).toBeNull();
  });

  it('source guard: Explore.tsx clears activePointers and resets primaryPointerId on blur and visibilitychange', () => {
    expect(exploreSource).toContain("document.addEventListener('visibilitychange', handleVisibilityChange);");
    expect(exploreSource).toContain("window.addEventListener('blur', handleWindowBlur);");
    expect(exploreSource).toContain('primaryPointerId.current = selfHealPrimaryPointer(');
  });
});

describe('GT-09: Re-arm two-finger long-press timer when finger count drops to 2', () => {
  it('promoteOldestPointer removes lifted pointer and leaves 2 active pointers', () => {
    const map = new Map<number, PointerHistory>([
      [1, { start: { x: 10, y: 10, t: 100 }, current: { x: 10, y: 10, t: 100 } }],
      [2, { start: { x: 20, y: 20, t: 100 }, current: { x: 20, y: 20, t: 100 } }],
      [3, { start: { x: 30, y: 30, t: 100 }, current: { x: 30, y: 30, t: 100 } }],
    ]);

    // Palm (pointer 3) lifts
    promoteOldestPointer(map, 3, 1);
    expect(map.size).toBe(2);
    expect(map.has(1)).toBe(true);
    expect(map.has(2)).toBe(true);
  });

  it('source guard: Explore.tsx re-arms timer when activePointers drops back to 2 in handlePointerLift', () => {
    expect(exploreSource).toMatch(/if\s*\(activePointers\.current\.size === 2\)\s*\{\s*armTwoFingerLongPressTimer\(now\);/);
  });
});
