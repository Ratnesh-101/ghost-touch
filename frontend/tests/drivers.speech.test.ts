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
});
