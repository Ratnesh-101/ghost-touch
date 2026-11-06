/**
 * Audio Element Driver Tests
 *
 * Architecture rule: browser APIs live only in frontend/src/drivers/.
 * Isolates `new Audio(src)` and timer globals so pure flow logic remains free of browser globals.
 *
 * Covers:
 * - isAudioSupported: normal path (window + Audio), unsupported paths (no window, no Audio)
 * - createAudioElement: normal path, AudioElementLike contract, error path, cleanup
 * - defaultAudioHost: normal path, unsupported paths, timer scheduling and clearTimeout cleanup
 * - Audio playback life cycle: play resolution, autoplay rejection, pause cleanup, onended and onerror events
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAudioElement,
  defaultAudioHost,
  isAudioSupported,
  type AudioElementLike,
} from '../src/drivers/audioElement';

class MockAudioElement implements AudioElementLike {
  src: string;
  currentTime = 0;
  playing = false;
  onended: ((ev: Event) => unknown) | null = null;
  onerror: ((ev: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => unknown) | null = null;
  playRejectReason: Error | null = null;

  constructor(src: string) {
    this.src = src;
  }

  play(): Promise<void> {
    if (this.playRejectReason) {
      return Promise.reject(this.playRejectReason);
    }
    this.playing = true;
    return Promise.resolve();
  }

  pause(): void {
    this.playing = false;
  }
}

describe('audioElement: isAudioSupported', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
    (globalThis as unknown as { Audio?: unknown }).Audio = origAudio;
  });

  it('returns true when window and Audio constructor are present (normal path)', () => {
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;

    expect(isAudioSupported()).toBe(true);
  });

  it('returns false when window is undefined (unsupported path: non-browser/SSR)', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;

    expect(isAudioSupported()).toBe(false);
  });

  it('returns false when Audio constructor is undefined (unsupported path: restricted environment)', () => {
    (globalThis as unknown as { window: unknown }).window = {};
    delete (globalThis as unknown as { Audio?: unknown }).Audio;

    expect(isAudioSupported()).toBe(false);
  });

  it('returns false when neither window nor Audio is defined', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { Audio?: unknown }).Audio;

    expect(isAudioSupported()).toBe(false);
  });
});

describe('audioElement: createAudioElement', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
    (globalThis as unknown as { Audio?: unknown }).Audio = origAudio;
  });

  it('instantiates new Audio with given src (normal path)', () => {
    const constructedArgs: string[] = [];
    class TrackingAudioElement extends MockAudioElement {
      constructor(src: string) {
        super(src);
        constructedArgs.push(src);
      }
    }

    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = TrackingAudioElement;

    const audio = createAudioElement('samples/cue.mp3');

    expect(constructedArgs).toEqual(['samples/cue.mp3']);
    expect(audio.src).toBe('samples/cue.mp3');
    expect(audio.currentTime).toBe(0);
  });

  it('provides play() resolving Promise and pause() cleanup (normal & cleanup path)', async () => {
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;

    const audio = createAudioElement('tone.wav');

    // Normal play path
    await expect(audio.play()).resolves.toBeUndefined();
    expect((audio as MockAudioElement).playing).toBe(true);

    // Cleanup path
    audio.pause();
    expect((audio as MockAudioElement).playing).toBe(false);
  });

  it('propagates play rejection when browser blocks autoplay (error path)', async () => {
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = class RejectingAudio extends MockAudioElement {
      constructor(src: string) {
        super(src);
        this.playRejectReason = new Error('NotAllowedError: user gesture required');
      }
    };

    const audio = createAudioElement('sound.ogg');

    await expect(audio.play()).rejects.toThrow('NotAllowedError: user gesture required');
  });

  it('supports onended completion listener', () => {
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;

    const audio = createAudioElement('tone.wav');
    const onEndedMock = vi.fn();
    audio.onended = onEndedMock;

    expect(audio.onended).toBe(onEndedMock);

    // Simulate playback finished
    const fakeEvent = new Event('ended');
    audio.onended?.(fakeEvent);
    expect(onEndedMock).toHaveBeenCalledTimes(1);
    expect(onEndedMock).toHaveBeenCalledWith(fakeEvent);
  });

  it('supports onerror event listener for network/decoding errors (error path)', () => {
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;

    const audio = createAudioElement('missing.mp3');
    const onErrorMock = vi.fn();
    audio.onerror = onErrorMock;

    expect(audio.onerror).toBe(onErrorMock);

    // Simulate decode error
    const fakeErrorEvent = new Event('error');
    audio.onerror?.(fakeErrorEvent);
    expect(onErrorMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledWith(fakeErrorEvent);
  });

  it('throws an error if Audio constructor throws (error path)', () => {
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = class ThrowingAudio {
      constructor() {
        throw new TypeError('Invalid audio source');
      }
    };

    expect(() => createAudioElement('invalid-src')).toThrow(TypeError);
    expect(() => createAudioElement('invalid-src')).toThrow('Invalid audio source');
  });
});

describe('audioElement: defaultAudioHost', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
    (globalThis as unknown as { Audio?: unknown }).Audio = origAudio;
  });

  it('returns empty object when window is undefined (unsupported path)', () => {
    delete (globalThis as unknown as { window?: unknown }).window;

    const host = defaultAudioHost();
    expect(host).toEqual({});
    expect(host.createAudio).toBeUndefined();
    expect(host.setTimeout).toBeUndefined();
    expect(host.clearTimeout).toBeUndefined();
  });

  it('returns host without createAudio when Audio is undefined (unsupported audio path)', () => {
    (globalThis as unknown as { window: unknown }).window = {};
    delete (globalThis as unknown as { Audio?: unknown }).Audio;

    const host = defaultAudioHost();
    expect(host.createAudio).toBeUndefined();
    expect(typeof host.setTimeout).toBe('function');
    expect(typeof host.clearTimeout).toBe('function');
  });

  it('returns complete host with createAudio, setTimeout, clearTimeout when window and Audio exist (normal path)', () => {
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;

    const host = defaultAudioHost();
    expect(typeof host.createAudio).toBe('function');
    expect(typeof host.setTimeout).toBe('function');
    expect(typeof host.clearTimeout).toBe('function');

    const audio = host.createAudio!('bell.mp3');
    expect(audio.src).toBe('bell.mp3');
  });

  it('executes scheduled timer callback via host.setTimeout (normal path)', async () => {
    (globalThis as unknown as { window: unknown }).window = {};
    const host = defaultAudioHost();

    const callback = vi.fn();
    await new Promise<void>((resolve) => {
      host.setTimeout!(() => {
        callback();
        resolve();
      }, 10);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels scheduled timer via host.clearTimeout so callback is never invoked (cleanup path)', async () => {
    (globalThis as unknown as { window: unknown }).window = {};
    const host = defaultAudioHost();

    const callback = vi.fn();
    const timerId = host.setTimeout!(callback, 30);
    expect(timerId).toBeDefined();

    // Cancel timer immediately
    host.clearTimeout!(timerId);

    // Wait past the timeout duration
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(callback).not.toHaveBeenCalled();
  });
});
