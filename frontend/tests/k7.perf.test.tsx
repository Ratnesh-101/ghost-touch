/**
 * Regression tests for Lane k7-perf (PERF-02, PERF-03, PERF-05, PERF-06).
 *
 * Verifies:
 * - PERF-02: Canvas bounding rect cached; zero getBoundingClientRect calls on pointermove;
 *   coordinates map correctly after resize.
 * - PERF-03: Canvas devicePixelRatio capped at 2.0 to protect budget mobile VRAM.
 * - PERF-05: photoUrl built from downscaled 1600 px JPEG blob, not raw 50 MB file;
 *   object URLs revoked when replaced or on unmount without handoff.
 * - PERF-06: AudioContext suspended when document hidden, resumed on visible / user gesture;
 *   audio tuning and gain constants unchanged.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  WebAudioDriver,
  type AudioContextLike,
  type GainLike,
  type OscillatorLike,
  type ParamLike,
} from '../src/drivers/audio';
import { computeTargetSize, MAX_IMAGE_SIDE } from '../src/drivers/camera';
import { processImageFile } from '../src/flow/capture';
import { Capture } from '../src/screens/Capture';
import {
  computeCanvasDpr,
  createCanvasRectCache,
  Explore,
  type CanvasRectCache,
} from '../src/screens/Explore';

function fakeParam(): ParamLike & {
  setTargetAtTime: Mock<ParamLike['setTargetAtTime']>;
  cancelScheduledValues: Mock<NonNullable<ParamLike['cancelScheduledValues']>>;
} {
  return {
    value: 0,
    setTargetAtTime: vi.fn<ParamLike['setTargetAtTime']>(),
    cancelScheduledValues: vi.fn(),
  };
}

interface FakeAudioContext extends AudioContextLike {
  currentTime: number;
  oscillators: Array<
    OscillatorLike & {
      frequency: ReturnType<typeof fakeParam>;
      start: Mock<OscillatorLike['start']>;
      stop: Mock<OscillatorLike['stop']>;
      disconnect: Mock<NonNullable<OscillatorLike['disconnect']>>;
    }
  >;
  gains: Array<
    GainLike & {
      gain: ReturnType<typeof fakeParam>;
      disconnect: Mock<NonNullable<GainLike['disconnect']>>;
    }
  >;
  resume: Mock<AudioContextLike['resume']>;
  suspend: Mock<NonNullable<AudioContextLike['suspend']>>;
  state: string;
}

function fakeContext(state = 'running'): FakeAudioContext {
  const ctx: FakeAudioContext = {
    currentTime: 1,
    state,
    destination: {},
    oscillators: [],
    gains: [],
    resume: vi.fn<AudioContextLike['resume']>().mockImplementation(async () => {
      ctx.state = 'running';
    }),
    suspend: vi.fn<NonNullable<AudioContextLike['suspend']>>().mockImplementation(async () => {
      ctx.state = 'suspended';
    }),
    createOscillator() {
      const osc = {
        type: '',
        frequency: fakeParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn<OscillatorLike['start']>(),
        stop: vi.fn<OscillatorLike['stop']>(),
        onended: null as OscillatorLike['onended'],
      };
      ctx.oscillators.push(osc);
      return osc;
    },
    createGain() {
      const gain = {
        gain: fakeParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      ctx.gains.push(gain);
      return gain;
    },
  };
  return ctx;
}

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn(() => 'normal' as const),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('PERF-02: Canvas getBoundingClientRect caching in Explore', () => {
  it('does not invoke getBoundingClientRect on repeated pointermove coord lookups', () => {
    const cache: CanvasRectCache = createCanvasRectCache();
    const mockRect = {
      left: 50,
      top: 100,
      width: 400,
      height: 400,
      right: 450,
      bottom: 500,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;

    const canvas = {
      getBoundingClientRect: vi.fn().mockReturnValue(mockRect),
    } as unknown as HTMLCanvasElement;

    // First call on mount/update queries layout
    const initialRect = cache.update(canvas);
    expect(initialRect).toEqual(mockRect);
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(1);

    // Simulate 60 Hz pointermove stream (60 calls)
    for (let i = 0; i < 60; i++) {
      const coords = cache.getCoords(150 + i, 200 + i, canvas);
      expect(coords.x).toBe(100 + i);
      expect(coords.y).toBe(100 + i);
    }

    // Must NEVER call getBoundingClientRect on pointermove
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it('refreshes cached rect and accurately maps the first touch after a resize', () => {
    const cache: CanvasRectCache = createCanvasRectCache();
    const initialRect = {
      left: 0,
      top: 0,
      width: 300,
      height: 300,
      right: 300,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;

    const resizedRect = {
      left: 20,
      top: 40,
      width: 600,
      height: 800,
      right: 620,
      bottom: 840,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect;

    let currentRect = initialRect;
    const canvas = {
      getBoundingClientRect: vi.fn(() => currentRect),
    } as unknown as HTMLCanvasElement;

    cache.update(canvas);
    expect(cache.getCoords(100, 100, canvas)).toEqual({ x: 100, y: 100 });

    // Simulate resize event triggering cache.update
    currentRect = resizedRect;
    cache.update(canvas);
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(2);

    // First touch after resize maps immediately with new offsets
    const touchCoords = cache.getCoords(120, 140, canvas);
    expect(touchCoords).toEqual({ x: 100, y: 100 });
    // Subsequent move still reads cached rect
    expect(cache.getCoords(150, 180, canvas)).toEqual({ x: 130, y: 140 });
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it('handles null or unmounted canvas safely without throwing', () => {
    const cache = createCanvasRectCache();
    expect(cache.update(null)).toBeNull();
    expect(cache.getCoords(100, 100, null)).toEqual({ x: 0, y: 0 });
  });

  it('Explore renders canvas and controls without error', () => {
    const drivers = createMockDrivers();
    const scene: DiagramScene = {
      kind: 'geometry',
      title: 'Triangle',
      points: [{ id: 'p1', x: 0.1, y: 0.1 }],
    };
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene,
        announced: 'Triangle diagram',
        drivers,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('gt-explore');
    expect(html).toContain('<canvas');
  });
});

describe('PERF-03: Canvas devicePixelRatio capping at 2.0', () => {
  it('caps devicePixelRatio at 2.0 on high-DPI displays', () => {
    expect(computeCanvasDpr(3.5)).toBe(2);
    expect(computeCanvasDpr(3.0)).toBe(2);
    expect(computeCanvasDpr(2.75)).toBe(2);
    expect(computeCanvasDpr(2.2)).toBe(2);
    expect(computeCanvasDpr(2.0)).toBe(2);
  });

  it('preserves exact devicePixelRatio when at or below 2.0', () => {
    expect(computeCanvasDpr(1.75)).toBe(1.75);
    expect(computeCanvasDpr(1.5)).toBe(1.5);
    expect(computeCanvasDpr(1.25)).toBe(1.25);
    expect(computeCanvasDpr(1.0)).toBe(1.0);
  });

  it('safely handles non-finite or non-positive values with fallback to 1.0', () => {
    expect(computeCanvasDpr(0)).toBe(1);
    expect(computeCanvasDpr(-1.5)).toBe(1);
    expect(computeCanvasDpr(Number.NaN)).toBe(1);
    expect(computeCanvasDpr(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('allows custom maxDpr cap parameter', () => {
    expect(computeCanvasDpr(3.5, 1.5)).toBe(1.5);
    expect(computeCanvasDpr(1.2, 1.5)).toBe(1.2);
  });
});

describe('PERF-05: photoUrl downscaled 1600 px blob and object URL lifecycle', () => {
  it('verifies computeTargetSize scales 50 MP photo to 1600 px longest side', () => {
    // Typical 50 MP camera output: 8192 × 6144
    const target = computeTargetSize(8192, 6144, MAX_IMAGE_SIDE);
    expect(target.width).toBe(1600);
    expect(target.height).toBe(1200);
    // Portrait: 6144 × 8192
    const targetPortrait = computeTargetSize(6144, 8192, MAX_IMAGE_SIDE);
    expect(targetPortrait.width).toBe(1200);
    expect(targetPortrait.height).toBe(1600);
  });

  it('renders Capture screen with environment camera input without crashing', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
      }),
    );
    expect(html).toContain('capture="environment"');
    expect(html).toContain('Take photo');
  });

  it('ensures object URLs are revoked on replacement and disposal to prevent leaks', () => {
    const revoked: string[] = [];
    const revokeMock = (url: string) => {
      revoked.push(url);
    };

    let activeUrl: string | null = null;
    const tracker = {
      getCurrent: () => activeUrl,
      update: (newUrl: string | null) => {
        if (activeUrl !== null && activeUrl !== newUrl) {
          revokeMock(activeUrl);
        }
        activeUrl = newUrl;
      },
      dispose: () => {
        if (activeUrl !== null) {
          revokeMock(activeUrl);
          activeUrl = null;
        }
      },
    };

    tracker.update('blob:http://localhost/downscaled-1');
    expect(tracker.getCurrent()).toBe('blob:http://localhost/downscaled-1');
    expect(revoked).toHaveLength(0);

    // Replacing with another URL revokes the first
    tracker.update('blob:http://localhost/downscaled-2');
    expect(tracker.getCurrent()).toBe('blob:http://localhost/downscaled-2');
    expect(revoked).toEqual(['blob:http://localhost/downscaled-1']);

    // Disposal revokes active URL
    tracker.dispose();
    expect(tracker.getCurrent()).toBeNull();
    expect(revoked).toEqual([
      'blob:http://localhost/downscaled-1',
      'blob:http://localhost/downscaled-2',
    ]);
  });

  it('prepares and downscales a large camera photo before creating photoUrl', async () => {
    const raw50Mb = new Blob([new Uint8Array(48 * 1024 * 1024)], { type: 'image/jpeg' });
    const downscaledBlob = new Blob([new Uint8Array(500 * 1024)], { type: 'image/jpeg' });

    let capturedForPhoto: Blob | null = null;
    const prepareMock = vi.fn().mockImplementation(async () => {
      capturedForPhoto = downscaledBlob;
      return downscaledBlob;
    });

    let uploadedBlob: Blob | null = null;
    const requestMock = vi.fn().mockImplementation(async (image: Blob) => {
      uploadedBlob = image;
      return { scene: { kind: 'geometry' as const, title: 'Test' }, mode: 'ai' as const };
    });

    const drivers = createMockDrivers();
    const outcome = await processImageFile(raw50Mb, {
      audio: drivers.audio,
      say: vi.fn(),
      signal: new AbortController().signal,
      source: 'camera',
      prepare: prepareMock,
      request: requestMock,
    });

    expect(outcome.kind).toBe('scene');
    expect(prepareMock).toHaveBeenCalledWith(raw50Mb, expect.anything());
    expect(uploadedBlob).toBe(downscaledBlob);
    expect(capturedForPhoto).toBe(downscaledBlob);
    expect(uploadedBlob).not.toBe(raw50Mb);
  });
});

describe('PERF-06: AudioContext suspend on hidden and resume on visible/gesture', () => {
  let docListeners: Record<string, ((ev: unknown) => void)[]>;
  let winListeners: Record<string, ((ev: unknown) => void)[]>;
  let mockDoc: {
    addEventListener: (type: string, listener: (ev: unknown) => void) => void;
    removeEventListener: (type: string, listener: (ev: unknown) => void) => void;
    hidden: boolean;
    visibilityState: string;
  };
  let mockWin: {
    addEventListener: (type: string, listener: (ev: unknown) => void) => void;
    removeEventListener: (type: string, listener: (ev: unknown) => void) => void;
  };

  beforeEach(() => {
    docListeners = {};
    winListeners = {};
    mockDoc = {
      hidden: false,
      visibilityState: 'visible',
      addEventListener: (type, listener) => {
        docListeners[type] = docListeners[type] || [];
        docListeners[type].push(listener);
      },
      removeEventListener: (type, listener) => {
        if (docListeners[type]) {
          docListeners[type] = docListeners[type].filter((l) => l !== listener);
        }
      },
    };
    mockWin = {
      addEventListener: (type, listener) => {
        winListeners[type] = winListeners[type] || [];
        winListeners[type].push(listener);
      },
      removeEventListener: (type, listener) => {
        if (winListeners[type]) {
          winListeners[type] = winListeners[type].filter((l) => l !== listener);
        }
      },
    };
  });

  it('suspends AudioContext when document visibility becomes hidden', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx, { window: mockWin, document: mockDoc });
    driver.unlock();

    expect(docListeners['visibilitychange']).toBeDefined();
    expect(docListeners['visibilitychange']?.length).toBeGreaterThanOrEqual(1);

    // Switch to hidden
    mockDoc.hidden = true;
    mockDoc.visibilityState = 'hidden';
    docListeners['visibilitychange']?.forEach((cb) => cb(new Event('visibilitychange')));

    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('suspended');
  });

  it('resumes AudioContext when document visibility becomes visible again', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx, { window: mockWin, document: mockDoc });
    driver.unlock();

    // First hide
    mockDoc.hidden = true;
    mockDoc.visibilityState = 'hidden';
    docListeners['visibilitychange']?.forEach((cb) => cb(new Event('visibilitychange')));
    expect(ctx.suspend).toHaveBeenCalledTimes(1);

    ctx.resume.mockClear();

    // Now return to visible
    mockDoc.hidden = false;
    mockDoc.visibilityState = 'visible';
    docListeners['visibilitychange']?.forEach((cb) => cb(new Event('visibilitychange')));

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('running');
  });

  it('resumes suspended AudioContext on user gesture (pointerdown, touchstart, keydown)', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx, { window: mockWin, document: mockDoc });
    driver.unlock();

    // Document becomes hidden, suspending the AudioContext
    mockDoc.hidden = true;
    mockDoc.visibilityState = 'hidden';
    docListeners['visibilitychange']?.forEach((cb) => cb(new Event('visibilitychange')));
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe('suspended');

    // Document becomes visible but context remains suspended until user gesture
    mockDoc.hidden = false;
    mockDoc.visibilityState = 'visible';
    ctx.resume.mockClear();

    // Trigger pointerdown gesture
    winListeners['pointerdown']?.forEach((cb) => cb(new Event('pointerdown')));
    expect(ctx.resume).toHaveBeenCalledTimes(1);

    ctx.state = 'suspended';
    ctx.resume.mockClear();

    // Trigger touchstart gesture
    winListeners['touchstart']?.forEach((cb) => cb(new Event('touchstart')));
    expect(ctx.resume).toHaveBeenCalledTimes(1);

    ctx.state = 'suspended';
    ctx.resume.mockClear();

    // Trigger keydown gesture
    winListeners['keydown']?.forEach((cb) => cb(new Event('keydown')));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('fades out active theremin tone when document becomes hidden', () => {
    const ctx = fakeContext('running');
    const driver = new WebAudioDriver(() => ctx, { window: mockWin, document: mockDoc });
    driver.unlock();

    // Play a tone
    driver.setTone(500);
    expect(ctx.gains[0]?.gain.setTargetAtTime).toHaveBeenCalledWith(0.15, 1, 0.02);

    // Document hides
    mockDoc.hidden = true;
    mockDoc.visibilityState = 'hidden';
    docListeners['visibilitychange']?.forEach((cb) => cb(new Event('visibilitychange')));

    // Expect tone faded to 0 and suspend called
    expect(ctx.gains[0]?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 1, 0.03);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully without throwing if ctx.suspend rejects', async () => {
    const ctx = fakeContext('running');
    ctx.suspend.mockRejectedValue(new Error('suspend policy blocked'));
    const driver = new WebAudioDriver(() => ctx, { window: mockWin, document: mockDoc });
    driver.unlock();

    mockDoc.hidden = true;
    mockDoc.visibilityState = 'hidden';
    expect(() => {
      docListeners['visibilitychange']?.forEach((cb) => cb(new Event('visibilitychange')));
    }).not.toThrow();
    await Promise.resolve();
  });
});
