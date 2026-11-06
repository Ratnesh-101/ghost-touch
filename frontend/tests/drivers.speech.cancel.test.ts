import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  ListenError,
  LISTEN_TIMEOUT_MS,
  WebSpeechDriver,
  type RecognitionLike,
  type SpeechHost,
} from '../src/drivers/speech';

class FakeRecognition implements RecognitionLike {
  lang = '';
  interimResults = false;
  maxAlternatives = 1;
  continuous = false;
  onresult: RecognitionLike['onresult'] = null;
  onerror: RecognitionLike['onerror'] = null;
  onend: RecognitionLike['onend'] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

interface FakeDomHost {
  host: SpeechHost;
  windowListeners: Map<string, (ev: unknown) => void>;
  documentListeners: Map<string, (ev: unknown) => void>;
  triggerPageHide: () => void;
  triggerVisibilityHidden: () => void;
  triggerVisibilityVisible: () => void;
}

function createSpeechHostWithDom(recognition: FakeRecognition): FakeDomHost {
  const windowListeners = new Map<string, (ev: unknown) => void>();
  const documentListeners = new Map<string, (ev: unknown) => void>();
  let hidden = false;
  let visibilityState = 'visible';

  const win = {
    addEventListener: (type: string, listener: (ev: unknown) => void) => {
      windowListeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      windowListeners.delete(type);
    },
  };

  const doc = {
    addEventListener: (type: string, listener: (ev: unknown) => void) => {
      documentListeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      documentListeners.delete(type);
    },
    get hidden() {
      return hidden;
    },
    get visibilityState() {
      return visibilityState;
    },
  };

  const host: SpeechHost = {
    createRecognition: () => recognition,
    window: win,
    document: doc,
  };

  return {
    host,
    windowListeners,
    documentListeners,
    triggerPageHide: () => {
      windowListeners.get('pagehide')?.({});
    },
    triggerVisibilityHidden: () => {
      hidden = true;
      visibilityState = 'hidden';
      documentListeners.get('visibilitychange')?.({});
    },
    triggerVisibilityVisible: () => {
      hidden = false;
      visibilityState = 'visible';
      documentListeners.get('visibilitychange')?.({});
    },
  };
}

describe('WebSpeechDriver cancelListen and visibility teardown (Finding 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancelListen() is clean and idempotent when called while idle', () => {
    const rec = new FakeRecognition();
    const { host } = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(host);

    expect(() => driver.cancelListen()).not.toThrow();
    expect(() => driver.cancelListen()).not.toThrow();
    expect(rec.start).not.toHaveBeenCalled();
    expect(rec.abort).not.toHaveBeenCalled();
  });

  it('cancelListen() aborts active recognition and rejects pending listen() with "cancelled"', async () => {
    const rec = new FakeRecognition();
    const { host } = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(host);

    const promise = driver.listen('en-IN');
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(rec.abort).not.toHaveBeenCalled();

    driver.cancelListen();

    // Must abort the browser recognition session
    expect(rec.abort).toHaveBeenCalledTimes(1);

    // Promise must settle with ListenError('cancelled')
    await expect(promise).rejects.toMatchObject({
      name: 'ListenError',
      message: 'cancelled',
      reason: 'cancelled',
    });
    await expect(promise).rejects.toBeInstanceOf(ListenError);
  });

  it('cancelListen() falls back to stop() when abort() is undefined on recogniser', async () => {
    const rec = new FakeRecognition();
    // Some older or alternative Web Speech polyfills only implement stop()
    delete (rec as unknown as { abort?: unknown }).abort;

    const { host } = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(host);

    const promise = driver.listen('en-IN');
    driver.cancelListen();

    expect(rec.stop).toHaveBeenCalledTimes(1);
    await expect(promise).rejects.toMatchObject({ reason: 'cancelled' });
  });

  it('automatically aborts recognition when visibilitychange transitions to hidden (Finding 2)', async () => {
    const rec = new FakeRecognition();
    const fixture = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(fixture.host);

    const promise = driver.listen('en-IN');
    expect(fixture.documentListeners.has('visibilitychange')).toBe(true);

    // User switches app or screen turns off -> hidden
    fixture.triggerVisibilityHidden();

    expect(rec.abort).toHaveBeenCalledTimes(1);
    await expect(promise).rejects.toMatchObject({
      name: 'ListenError',
      message: 'cancelled',
      reason: 'cancelled',
    });

    // Listeners are removed on abort
    expect(fixture.documentListeners.has('visibilitychange')).toBe(false);
    expect(fixture.windowListeners.has('pagehide')).toBe(false);
  });

  it('does not abort recognition when visibilitychange fires with visible state', async () => {
    const rec = new FakeRecognition();
    const fixture = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(fixture.host);

    const promise = driver.listen('en-IN');
    fixture.triggerVisibilityVisible();

    expect(rec.abort).not.toHaveBeenCalled();
    expect(rec.stop).not.toHaveBeenCalled();

    // Normal speech result still settles successfully
    rec.onresult?.({ results: [[{ transcript: 'what shape is this' }]] });
    await expect(promise).resolves.toBe('what shape is this');
  });

  it('automatically aborts recognition on pagehide event (Finding 2)', async () => {
    const rec = new FakeRecognition();
    const fixture = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(fixture.host);

    const promise = driver.listen('en-IN');
    expect(fixture.windowListeners.has('pagehide')).toBe(true);

    // Browser navigation or screen exit
    fixture.triggerPageHide();

    expect(rec.abort).toHaveBeenCalledTimes(1);
    await expect(promise).rejects.toMatchObject({
      name: 'ListenError',
      message: 'cancelled',
      reason: 'cancelled',
    });
  });

  it('isolates state so late events after cancel do not trigger duplicate settlement or errors', async () => {
    const rec = new FakeRecognition();
    const fixture = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(fixture.host);

    const promise = driver.listen('en-IN');
    driver.cancelListen();
    await expect(promise).rejects.toMatchObject({ reason: 'cancelled' });

    // Late browser events from hardware callback
    rec.onresult?.({ results: [[{ transcript: 'stale phrase' }]] });
    rec.onerror?.({ error: 'network' });
    rec.onend?.();
    vi.advanceTimersByTime(LISTEN_TIMEOUT_MS * 2);

    // Recognition handlers must have been unhooked
    expect(rec.onresult).toBeNull();
    expect(rec.onerror).toBeNull();
    expect(rec.onend).toBeNull();
  });

  it('cleans up lifecycle listeners when recognition completes normally', async () => {
    const rec = new FakeRecognition();
    const fixture = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(fixture.host);

    const promise = driver.listen('en-IN');
    expect(fixture.windowListeners.has('pagehide')).toBe(true);
    expect(fixture.documentListeners.has('visibilitychange')).toBe(true);

    rec.onresult?.({ results: [[{ transcript: 'triangle' }]] });
    await expect(promise).resolves.toBe('triangle');

    // Both event listeners must be removed after successful resolution
    expect(fixture.windowListeners.has('pagehide')).toBe(false);
    expect(fixture.documentListeners.has('visibilitychange')).toBe(false);
  });

  it('cleans up lifecycle listeners when recognition times out', async () => {
    const rec = new FakeRecognition();
    const fixture = createSpeechHostWithDom(rec);
    const driver = new WebSpeechDriver(fixture.host);

    const promise = driver.listen('en-IN');
    const assertion = expect(promise).rejects.toMatchObject({ message: 'timeout' });

    vi.advanceTimersByTime(LISTEN_TIMEOUT_MS);
    await assertion;

    expect(fixture.windowListeners.has('pagehide')).toBe(false);
    expect(fixture.documentListeners.has('visibilitychange')).toBe(false);
  });
});
