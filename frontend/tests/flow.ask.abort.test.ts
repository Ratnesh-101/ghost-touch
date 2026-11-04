import { describe, expect, it, vi } from 'vitest';
import type { AskResponse } from '../src/api/ask';
import { AskRequestError } from '../src/api/ask';
import type { DiagramScene } from '../src/core/scene';
import type { AudioDriver, SpeechDriver } from '../src/drivers';
import { ListenError } from '../src/drivers';
import { AskManager, askErrorMessage, type AskDeps } from '../src/flow/ask';
import { t } from '../src/i18n';

const scene: DiagramScene = { kind: 'geometry', title: 'T', facts: [] };
const audio: AudioDriver = { beep: vi.fn(), setTone: vi.fn(), unlock: vi.fn(), playEarcon: vi.fn(), state: 'running' };

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeDeps(speech: SpeechDriver, request: AskDeps['request']): AskDeps {
  return { audio, speech, scene, say: vi.fn(), request };
}

const ok: AskResponse = { answer: 'ok', source: 'ai' };

describe('AskManager listen handling', () => {
  it('stops speech before listening and cancels listen on abort', async () => {
    const order: string[] = [];
    const pending = deferred<string>();
    const speech: SpeechDriver = {
      speak: vi.fn(),
      listen: vi.fn(() => {
        order.push('listen');
        return pending.promise;
      }),
      stopSpeaking: vi.fn(() => order.push('stop')),
      cancelListen: vi.fn(() => {
        order.push('cancel');
        pending.reject(new ListenError('failed'));
      }),
      canSpeak: true,
      canListen: true,
    };
    const manager = new AskManager();
    const run = manager.startVoiceAsk(makeDeps(speech, vi.fn(async () => ok)));
    await Promise.resolve();
    manager.abort();
    expect(await run).toEqual({ kind: 'cancelled' });
    expect(order).toEqual(['stop', 'listen', 'cancel']);
  });

  it('maps a listen timeout to its own message', () => {
    expect(askErrorMessage(new ListenError('timeout'))).toBe(t('ask.errorListenTimeout'));
    expect(t('ask.errorListenTimeout')).not.toBe(t('ask.errorTimeout'));
    expect(askErrorMessage(new AskRequestError('timeout'))).toBe(t('ask.errorTimeout'));
  });
});

describe('AskManager abort race', () => {
  it('a stale settle does not clear a newer ask busy flag', async () => {
    const speech: SpeechDriver = {
      speak: vi.fn(),
      listen: vi.fn(async () => 'q'),
      canSpeak: true,
      canListen: true,
    };
    const first = deferred<AskResponse>();
    const second = deferred<AskResponse>();
    const manager = new AskManager();

    const run1 = manager.submitTextAsk('one', makeDeps(speech, () => first.promise));
    manager.abort();
    const run2 = manager.submitTextAsk('two', makeDeps(speech, () => second.promise));
    expect(manager.isBusy()).toBe(true);

    first.resolve(ok);
    expect(await run1).toEqual({ kind: 'cancelled' });
    expect(manager.isBusy()).toBe(true);
    expect((await manager.submitTextAsk('three', makeDeps(speech, vi.fn()))).kind).toBe('busy');

    second.resolve(ok);
    expect((await run2).kind).toBe('success');
    expect(manager.isBusy()).toBe(false);
  });

  it('reports failed (not cancelled) on request error so the UI can keep typed text', async () => {
    const speech: SpeechDriver = { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true };
    const manager = new AskManager();
    const outcome = await manager.submitTextAsk(
      'q',
      makeDeps(speech, async () => {
        throw new AskRequestError('network');
      }),
    );
    expect(outcome.kind).toBe('failed');
  });
});
