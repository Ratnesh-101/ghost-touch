import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ListenError,
  LISTEN_TIMEOUT_MS,
  WebSpeechDriver,
  type RecognitionLike,
  type SpeechHost,
  type UtteranceLike,
} from '../src/drivers/speech';

class FakeRecognition implements RecognitionLike {
  lang = '';
  interimResults = true;
  maxAlternatives = 0;
  continuous = true;
  onresult: RecognitionLike['onresult'] = null;
  onerror: RecognitionLike['onerror'] = null;
  onend: RecognitionLike['onend'] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

function speechHost(recognition?: FakeRecognition): {
  host: SpeechHost;
  calls: string[];
  utterances: Array<UtteranceLike & { text: string }>;
} {
  const calls: string[] = [];
  const utterances: Array<UtteranceLike & { text: string }> = [];
  const host: SpeechHost = {
    synth: {
      cancel: () => calls.push('cancel'),
      speak: () => calls.push('speak'),
    },
    createUtterance: (text) => {
      const utterance = { text, rate: 1, lang: '' };
      utterances.push(utterance);
      return utterance;
    },
    ...(recognition ? { createRecognition: () => recognition } : {}),
  };
  return { host, calls, utterances };
}

describe('WebSpeechDriver.speak', () => {
  it('cancels the previous utterance before speaking the new one', () => {
    const { host, calls } = speechHost();
    const driver = new WebSpeechDriver(host);
    driver.speak('Point A');
    driver.speak('Point B');
    expect(calls).toEqual(['cancel', 'speak', 'cancel', 'speak']);
  });

  it('sets rate 1.1 and the default language en-IN', () => {
    const { host, utterances } = speechHost();
    new WebSpeechDriver(host).speak('Hello');
    expect(utterances[0]).toMatchObject({ text: 'Hello', rate: 1.1, lang: 'en-IN' });
  });

  it('uses a caller-supplied language', () => {
    const { host, utterances } = speechHost();
    new WebSpeechDriver(host).speak('नमस्ते', 'hi-IN');
    expect(utterances[0]?.lang).toBe('hi-IN');
  });

  it('is a no-op without speech synthesis', () => {
    const driver = new WebSpeechDriver({});
    expect(driver.canSpeak).toBe(false);
    expect(() => driver.speak('hello')).not.toThrow();
  });
});

describe('WebSpeechDriver.listen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with "unsupported" when there is no recogniser', async () => {
    const driver = new WebSpeechDriver({});
    expect(driver.canListen).toBe(false);
    await expect(driver.listen()).rejects.toMatchObject({ message: 'unsupported' });
  });

  it('resolves with the transcript, configures a single final result, and stops', async () => {
    const rec = new FakeRecognition();
    const { host } = speechHost(rec);
    const promise = new WebSpeechDriver(host).listen('hi-IN');
    expect(rec.lang).toBe('hi-IN');
    expect(rec.interimResults).toBe(false);
    expect(rec.continuous).toBe(false);
    expect(rec.start).toHaveBeenCalledTimes(1);
    rec.onresult?.({ results: [[{ transcript: '  How long is AB?  ' }]] });
    await expect(promise).resolves.toBe('How long is AB?');
    expect(rec.stop).toHaveBeenCalledTimes(1);
  });

  it('rejects "timeout" after 6 s and stops the recogniser', async () => {
    const rec = new FakeRecognition();
    const { host } = speechHost(rec);
    const promise = new WebSpeechDriver(host).listen();
    const assertion = expect(promise).rejects.toMatchObject({ message: 'timeout' });
    vi.advanceTimersByTime(LISTEN_TIMEOUT_MS - 1);
    expect(rec.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await assertion;
    expect(rec.stop).toHaveBeenCalledTimes(1);
    expect(LISTEN_TIMEOUT_MS).toBe(6000);
  });

  it('maps recogniser errors to typed failures', async () => {
    const cases: Array<[string, string]> = [
      ['no-speech', 'no-speech'],
      ['not-allowed', 'denied'],
      ['service-not-allowed', 'denied'],
      ['network', 'failed'],
    ];
    for (const [error, expected] of cases) {
      const rec = new FakeRecognition();
      const promise = new WebSpeechDriver(speechHost(rec).host).listen();
      rec.onerror?.({ error });
      await expect(promise).rejects.toMatchObject({ message: expected });
    }
  });

  it('rejects "no-speech" when recognition ends without a result', async () => {
    const rec = new FakeRecognition();
    const promise = new WebSpeechDriver(speechHost(rec).host).listen();
    rec.onend?.();
    await expect(promise).rejects.toBeInstanceOf(ListenError);
  });

  it('rejects "failed" when start() throws, and still stops', async () => {
    const rec = new FakeRecognition();
    rec.start.mockImplementation(() => {
      throw new Error('already started');
    });
    const promise = new WebSpeechDriver(speechHost(rec).host).listen();
    await expect(promise).rejects.toMatchObject({ message: 'failed' });
    expect(rec.stop).toHaveBeenCalled();
  });

  it('settles once: a late timer or event after a result changes nothing', async () => {
    const rec = new FakeRecognition();
    const promise = new WebSpeechDriver(speechHost(rec).host).listen();
    rec.onresult?.({ results: [[{ transcript: 'hello' }]] });
    await expect(promise).resolves.toBe('hello');
    vi.advanceTimersByTime(LISTEN_TIMEOUT_MS * 2);
    expect(rec.stop).toHaveBeenCalledTimes(1);
    expect(rec.onresult).toBeNull();
  });

  it('a second listen() ends the first session instead of running two at once', async () => {
    const first = new FakeRecognition();
    const second = new FakeRecognition();
    const queue = [first, second];
    const host: SpeechHost = { createRecognition: () => queue.shift() as FakeRecognition };
    const driver = new WebSpeechDriver(host);
    const a = driver.listen();
    const b = driver.listen();
    await expect(a).rejects.toMatchObject({ message: 'failed' });
    expect(first.stop).toHaveBeenCalledTimes(1);
    second.onresult?.({ results: [[{ transcript: 'hello' }]] });
    await expect(b).resolves.toBe('hello');
  });

  it('does not throw if stop() throws during cleanup', async () => {
    const rec = new FakeRecognition();
    rec.stop.mockImplementation(() => {
      throw new Error('not started');
    });
    const promise = new WebSpeechDriver(speechHost(rec).host).listen();
    rec.onresult?.({ results: [[{ transcript: 'ok' }]] });
    await expect(promise).resolves.toBe('ok');
  });

  it('cancelListen() is safe when idle (idempotent)', () => {
    const driver = new WebSpeechDriver({});
    expect(() => driver.cancelListen()).not.toThrow();
    expect(() => driver.cancelListen()).not.toThrow();
  });

  it('cancelListen() aborts active recognition and rejects with ListenError("cancelled") (Finding 2)', async () => {
    const rec = new FakeRecognition();
    const driver = new WebSpeechDriver(speechHost(rec).host);
    const promise = driver.listen();

    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(rec.abort).not.toHaveBeenCalled();

    driver.cancelListen();

    expect(rec.abort).toHaveBeenCalledTimes(1);
    await expect(promise).rejects.toMatchObject({ message: 'cancelled', reason: 'cancelled' });
    await expect(promise).rejects.toBeInstanceOf(ListenError);
  });

  it('cancelListen() is idempotent across repeated calls during and after session', async () => {
    const rec = new FakeRecognition();
    const driver = new WebSpeechDriver(speechHost(rec).host);
    const promise = driver.listen();

    driver.cancelListen();
    driver.cancelListen(); // repeated call
    expect(rec.abort).toHaveBeenCalledTimes(1);

    await expect(promise).rejects.toMatchObject({ message: 'cancelled' });

    // Call after promise settled
    expect(() => driver.cancelListen()).not.toThrow();
    expect(rec.abort).toHaveBeenCalledTimes(1);
  });
});

class FakeDocument {
  hidden = false;
  visibilityState = 'visible';
  listeners: Record<string, Array<(ev: unknown) => void>> = {};

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type]!.push(listener);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type]!.filter((l) => l !== listener);
  }

  dispatchEvent(type: string, ev: unknown = {}): void {
    const list = this.listeners[type] ?? [];
    for (const l of list) l(ev);
  }
}

class FakeWindow {
  listeners: Record<string, Array<(ev: unknown) => void>> = {};

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type]!.push(listener);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type]!.filter((l) => l !== listener);
  }

  dispatchEvent(type: string, ev: unknown = {}): void {
    const list = this.listeners[type] ?? [];
    for (const l of list) l(ev);
  }
}

describe('WebSpeechDriver tab lifecycle (visibilitychange & pagehide)', () => {
  it('cancels speech when document becomes hidden, and a later speak() works', () => {
    const doc = new FakeDocument();
    const { host, calls, utterances } = speechHost();
    host.document = doc;
    const driver = new WebSpeechDriver(host);

    driver.speak('Exploring diagram');
    expect(calls).toEqual(['cancel', 'speak']);
    expect(utterances.at(-1)?.text).toBe('Exploring diagram');

    // Simulate tab hidden / app backgrounded
    doc.hidden = true;
    doc.visibilityState = 'hidden';
    doc.dispatchEvent('visibilitychange');

    expect(calls).toEqual(['cancel', 'speak', 'cancel']);

    // Page restored to visible
    doc.hidden = false;
    doc.visibilityState = 'visible';
    doc.dispatchEvent('visibilitychange');
    // cancel() should not be called again on un-hiding
    expect(calls).toEqual(['cancel', 'speak', 'cancel']);

    // Later speak works normally
    driver.speak('Welcome back');
    expect(calls).toEqual(['cancel', 'speak', 'cancel', 'cancel', 'speak']);
    expect(utterances.at(-1)?.text).toBe('Welcome back');
  });

  it('cancels speech when pagehide fires on window', () => {
    const win = new FakeWindow();
    const { host, calls } = speechHost();
    host.window = win;
    const driver = new WebSpeechDriver(host);

    driver.speak('Test utterance');
    expect(calls).toEqual(['cancel', 'speak']);

    win.dispatchEvent('pagehide');
    expect(calls).toEqual(['cancel', 'speak', 'cancel']);
  });

  it('dispose() tears down lifecycle listeners and cancels speech', () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const { host, calls } = speechHost();
    host.document = doc;
    host.window = win;
    const driver = new WebSpeechDriver(host);

    expect(doc.listeners['visibilitychange']?.length).toBe(1);
    expect(win.listeners['pagehide']?.length).toBe(1);

    driver.dispose();
    expect(calls).toEqual(['cancel']);
    expect(doc.listeners['visibilitychange']?.length).toBe(0);
    expect(win.listeners['pagehide']?.length).toBe(0);

    // Subsequent visibilitychange or pagehide does nothing
    doc.hidden = true;
    doc.dispatchEvent('visibilitychange');
    win.dispatchEvent('pagehide');
    expect(calls).toEqual(['cancel']);
  });

  it('listen() works alongside speech lifecycle listeners and cancels on hide', async () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const rec = new FakeRecognition();
    const { host } = speechHost(rec);
    host.document = doc;
    host.window = win;
    const driver = new WebSpeechDriver(host);

    const promise = driver.listen();
    expect(rec.start).toHaveBeenCalledTimes(1);

    // Trigger tab hide while listening
    doc.hidden = true;
    doc.dispatchEvent('visibilitychange');

    await expect(promise).rejects.toMatchObject({ message: 'cancelled' });
    expect(rec.abort).toHaveBeenCalled();
  });
});
