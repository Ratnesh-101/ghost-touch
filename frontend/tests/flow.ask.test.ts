import { describe, expect, it, vi } from 'vitest';
import { AskRequestError, type AskResponse } from '../src/api/ask';
import type { DiagramScene } from '../src/core/scene';
import type { AudioDriver, SpeechDriver } from '../src/drivers';
import { ListenError } from '../src/drivers';
import {
  AskManager,
  LISTENING_BEEP_HZ,
  LISTENING_BEEP_MS,
  askErrorMessage,
  type AskDeps,
} from '../src/flow/ask';
import { t } from '../src/i18n';

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Triangle ABC',
  facts: ['AB = 3 cm', 'BC = 4 cm', 'AC = 5 cm'],
};

function createMockDrivers(): {
  audio: AudioDriver;
  speech: SpeechDriver;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    audio: {
      beep: vi.fn((hz, ms) => calls.push(`beep(${hz},${ms})`)),
      setTone: vi.fn(),
      unlock: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running',
    },
    speech: {
      speak: vi.fn((text, lang) => calls.push(`speak(${text},${lang ?? 'default'})`)),
      listen: vi.fn(async (lang) => {
        calls.push(`listen(${lang ?? 'default'})`);
        return 'What is the length of AC?';
      }),
      canSpeak: true,
      canListen: true,
    },
  };
}

describe('askErrorMessage', () => {
  it('maps ListenError reasons to translated failure lines offering text box', () => {
    expect(askErrorMessage(new ListenError('no-speech'))).toBe(t('ask.errorNoSpeech'));
    expect(askErrorMessage(new ListenError('denied'))).toBe(t('ask.errorDenied'));
    expect(askErrorMessage(new ListenError('timeout'))).toBe(t('ask.errorListenTimeout'));
    expect(askErrorMessage(new ListenError('unsupported'))).toBe(t('ask.errorUnsupported'));
    expect(askErrorMessage(new ListenError('failed'))).toBe(t('ask.errorFailed'));
  });

  it('maps AskRequestError failures to translated failure lines offering text box', () => {
    expect(askErrorMessage(new AskRequestError('timeout'))).toBe(t('ask.errorTimeout'));
    expect(askErrorMessage(new AskRequestError('network'))).toBe(t('ask.errorOffline'));
    expect(askErrorMessage(new AskRequestError('http'))).toBe(t('ask.errorServer'));
    expect(askErrorMessage(new AskRequestError('bad-response'))).toBe(t('ask.errorServer'));
  });

  it('maps generic errors to generic failure line', () => {
    expect(askErrorMessage(new Error('Unknown problem'))).toBe(t('ask.errorFailed'));
  });
});

describe('AskManager happy path', () => {
  it('executes in exact sequence: beep -> listen -> request -> speak answer', async () => {
    const { audio, speech, calls } = createMockDrivers();
    const manager = new AskManager();
    const spoken: string[] = [];
    const statusChanges: string[] = [];

    const mockRequest = vi.fn(
      async (
        _scene: DiagramScene,
        _q: string,
        _l: string,
        _signal: AbortSignal,
      ): Promise<AskResponse> => {
        calls.push('request()');
        return { answer: 'The length of AC is 5 cm.', source: 'facts' };
      },
    );

    const deps: AskDeps = {
      audio,
      speech,
      scene: sampleScene,
      lang: 'en-IN',
      say: (text: string) => {
        spoken.push(text);
        calls.push(`say(${text})`);
      },
      onStatusChange: (status: string) => statusChanges.push(status),
      request: mockRequest,
    };

    const outcome = await manager.startVoiceAsk(deps);

    expect(outcome).toEqual({
      kind: 'success',
      answer: 'The length of AC is 5 cm.',
      source: 'facts',
    });

    // Check exact sequence
    expect(calls).toEqual([
      `beep(${LISTENING_BEEP_HZ},${LISTENING_BEEP_MS})`,
      'listen(en-IN)',
      `say(${t('ask.thinking')})`,
      'request()',
      'say(The length of AC is 5 cm.)',
    ]);

    expect(statusChanges).toEqual([t('ask.listening'), t('ask.thinking')]);
    // One spoken "thinking" cue while the request runs, then the answer.
    expect(spoken).toEqual([t('ask.thinking'), 'The length of AC is 5 cm.']);
    expect(manager.isBusy()).toBe(false);
  });
});

describe('AskManager failures and text fallback offer', () => {
  it('speaks on no-speech failure and offers text box', async () => {
    const { audio, speech } = createMockDrivers();
    speech.listen = vi.fn(async () => {
      throw new ListenError('no-speech');
    });

    const manager = new AskManager();
    const spoken: string[] = [];
    let fallbackOffered = false;

    const outcome = await manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackOffered = true;
      },
    });

    expect(outcome.kind).toBe('failed');
    expect(spoken).toEqual([t('ask.errorNoSpeech')]);
    expect(fallbackOffered).toBe(true);
    expect(manager.isBusy()).toBe(false);
  });

  it('speaks on microphone denied failure and offers text box', async () => {
    const { audio, speech } = createMockDrivers();
    speech.listen = vi.fn(async () => {
      throw new ListenError('denied');
    });

    const manager = new AskManager();
    const spoken: string[] = [];
    let fallbackOffered = false;

    const outcome = await manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackOffered = true;
      },
    });

    expect(outcome.kind).toBe('failed');
    expect(spoken).toEqual([t('ask.errorDenied')]);
    expect(fallbackOffered).toBe(true);
    expect(manager.isBusy()).toBe(false);
  });

  it('speaks on listen timeout failure and offers text box', async () => {
    const { audio, speech } = createMockDrivers();
    speech.listen = vi.fn(async () => {
      throw new ListenError('timeout');
    });

    const manager = new AskManager();
    const spoken: string[] = [];
    let fallbackOffered = false;

    const outcome = await manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackOffered = true;
      },
    });

    expect(outcome.kind).toBe('failed');
    expect(spoken).toEqual([t('ask.errorListenTimeout')]);
    expect(fallbackOffered).toBe(true);
    expect(manager.isBusy()).toBe(false);
  });

  it('speaks on server error and offers text box', async () => {
    const { audio, speech } = createMockDrivers();
    const manager = new AskManager();
    const spoken: string[] = [];
    let fallbackOffered = false;

    const mockRequest = vi.fn(async () => {
      throw new AskRequestError('http');
    });

    const outcome = await manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackOffered = true;
      },
      request: mockRequest,
    });

    expect(outcome.kind).toBe('failed');
    expect(spoken).toEqual([t('ask.thinking'), t('ask.errorServer')]);
    expect(fallbackOffered).toBe(true);
    expect(manager.isBusy()).toBe(false);
  });

  it('speaks on offline / network error and offers text box', async () => {
    const { audio, speech } = createMockDrivers();
    const manager = new AskManager();
    const spoken: string[] = [];
    let fallbackOffered = false;

    const mockRequest = vi.fn(async () => {
      throw new AskRequestError('network');
    });

    const outcome = await manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackOffered = true;
      },
      request: mockRequest,
    });

    expect(outcome.kind).toBe('failed');
    expect(spoken).toEqual([t('ask.thinking'), t('ask.errorOffline')]);
    expect(fallbackOffered).toBe(true);
    expect(manager.isBusy()).toBe(false);
  });

  it('speaks unsupported error when speech recognition cannot listen', async () => {
    const { audio, speech } = createMockDrivers();
    const unsupportedSpeech: SpeechDriver = { ...speech, canListen: false };
    const manager = new AskManager();
    const spoken: string[] = [];
    let fallbackOffered = false;

    const outcome = await manager.startVoiceAsk({
      audio,
      speech: unsupportedSpeech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      onFallbackNeeded: () => {
        fallbackOffered = true;
      },
    });

    expect(outcome.kind).toBe('failed');
    expect(spoken).toEqual([t('ask.errorUnsupported')]);
    expect(fallbackOffered).toBe(true);
  });
});

describe('AskManager concurrency and cleanup', () => {
  it('ignores a second trigger while busy and speaks busy line', async () => {
    const { audio, speech } = createMockDrivers();
    let finishListen: (val: string) => void = () => {};
    speech.listen = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishListen = resolve;
        }),
    );

    const manager = new AskManager();
    const spoken: string[] = [];

    const firstPromise = manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      request: async () => ({ answer: 'Answer 1', source: 'ai' }),
    });

    expect(manager.isBusy()).toBe(true);

    // Second trigger attempt while first is in flight
    const secondOutcome = await manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
    });

    expect(secondOutcome).toEqual({ kind: 'busy' });
    expect(spoken).toContain(t('ask.busy'));

    // Resolve first
    finishListen('Question 1');
    const firstOutcome = await firstPromise;
    expect(firstOutcome.kind).toBe('success');
    expect(manager.isBusy()).toBe(false);
  });

  it('abort() cancels during speech.listen without sending request or speaking', async () => {
    const { audio, speech } = createMockDrivers();
    let finishListen: (val: string) => void = () => {};
    speech.listen = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishListen = resolve;
        }),
    );
    const mockRequest = vi.fn();
    const manager = new AskManager();
    const spoken: string[] = [];

    const promise = manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      request: mockRequest,
    });

    manager.abort();
    finishListen('Question');

    const outcome = await promise;
    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(mockRequest).not.toHaveBeenCalled();
    expect(spoken).toHaveLength(0);
    expect(manager.isBusy()).toBe(false);
  });

  it('abort() cancels in-flight backend request on unmount without speaking answer', async () => {
    const { audio, speech } = createMockDrivers();
    let aborted = false;

    const mockRequest = vi.fn(
      (_sc: DiagramScene, _q: string, _l: string, signal: AbortSignal) => {
        return new Promise<AskResponse>((_, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new AskRequestError('aborted'));
          });
        });
      },
    );

    const manager = new AskManager();
    const spoken: string[] = [];

    // Let speech.listen resolve first, then abort during request
    const promise = manager.startVoiceAsk({
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      request: mockRequest,
    });

    // Wait one microtask so speech.listen finishes and mockRequest is invoked
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Unmount occurs during backend request
    manager.abort();

    const outcome = await promise;
    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(aborted).toBe(true);
    // Only the "thinking" cue was spoken before the unmount; no answer or error follows it.
    expect(spoken).toEqual([t('ask.thinking')]);
    expect(manager.isBusy()).toBe(false);
  });
});

describe('AskManager text fallback (submitTextAsk)', () => {
  it('sends typed question, speaks answer, and updates status', async () => {
    const { audio, speech } = createMockDrivers();
    const manager = new AskManager();
    const spoken: string[] = [];
    const statusChanges: string[] = [];

    const mockRequest = vi.fn(async (_sc: DiagramScene, q: string) => {
      return { answer: `Answer for: ${q}`, source: 'facts' as const };
    });

    const outcome = await manager.submitTextAsk('What is AC?', {
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      onStatusChange: (status: string) => statusChanges.push(status),
      request: mockRequest,
    });

    expect(outcome).toEqual({
      kind: 'success',
      answer: 'Answer for: What is AC?',
      source: 'facts',
    });
    expect(spoken).toEqual([t('ask.thinking'), 'Answer for: What is AC?']);
    expect(statusChanges).toEqual([t('ask.thinking')]);
  });

  it('rejects empty or whitespace question without making request', async () => {
    const { audio, speech } = createMockDrivers();
    const manager = new AskManager();
    const spoken: string[] = [];
    const mockRequest = vi.fn();

    const outcome = await manager.submitTextAsk('   ', {
      audio,
      speech,
      scene: sampleScene,
      say: (text: string) => spoken.push(text),
      request: mockRequest,
    });

    expect(outcome).toEqual({ kind: 'empty' });
    expect(spoken).toEqual([t('ask.errorEmpty')]);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(manager.isBusy()).toBe(false);
  });
});
