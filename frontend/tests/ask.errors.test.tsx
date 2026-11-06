import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AskRequestError } from '../src/api/ask';
import type { DiagramScene } from '../src/core/scene';
import {
  ListenError,
  MemoryDiagramStore,
  type AudioDriver,
  type Drivers,
  type SpeechDriver,
} from '../src/drivers';
import { AskManager, type AskDeps } from '../src/flow/ask';
import { t } from '../src/i18n';
import { Explore } from '../src/screens/Explore';

const testScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Diagram',
  points: [
    { id: 'A', x: 0.1, y: 0.1, label: 'A' },
    { id: 'B', x: 0.9, y: 0.9, label: 'B' },
  ],
  segments: [{ id: 's1', a: 'A', b: 'B' }],
};

const createMockDrivers = (): Drivers => ({
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
});

describe('Finding 11: Ask error handling in AskManager and Explore', () => {
  it('handles request timeout without unhandled rejection and restores idle state', async () => {
    const audio: AudioDriver = { beep: vi.fn(), setTone: vi.fn(), unlock: vi.fn(), playEarcon: vi.fn(), state: 'running' };
    const spoken: string[] = [];
    const speech: SpeechDriver = {
      speak: vi.fn((text) => spoken.push(text)),
      listen: vi.fn(async () => 'What is this?'),
      canSpeak: true,
      canListen: true,
    };

    const manager = new AskManager();
    const deps: AskDeps = {
      audio,
      speech,
      scene: testScene,
      say: (msg) => spoken.push(msg),
      request: async () => {
        throw new AskRequestError('timeout');
      },
    };

    const outcome = await manager.submitTextAsk('What is this?', deps);
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.message).toBe(t('ask.errorTimeout'));
    }
    expect(audio.playEarcon).toHaveBeenCalledWith('error');
    expect(spoken).toContain(t('ask.errorTimeout'));
    expect(manager.isBusy()).toBe(false);
  });

  it('handles network / offline error without unhandled rejection and restores idle state', async () => {
    const audio: AudioDriver = { beep: vi.fn(), setTone: vi.fn(), unlock: vi.fn(), playEarcon: vi.fn(), state: 'running' };
    const spoken: string[] = [];
    const speech: SpeechDriver = {
      speak: vi.fn((text) => spoken.push(text)),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    };

    const manager = new AskManager();
    const deps: AskDeps = {
      audio,
      speech,
      scene: testScene,
      say: (msg) => spoken.push(msg),
      request: async () => {
        throw new AskRequestError('network');
      },
    };

    const outcome = await manager.submitTextAsk('Where is point A?', deps);
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.message).toBe(t('ask.errorOffline'));
    }
    expect(audio.playEarcon).toHaveBeenCalledWith('error');
    expect(spoken).toContain(t('ask.errorOffline'));
    expect(manager.isBusy()).toBe(false);
  });

  it('handles unexpected generic exceptions in request without unhandled rejection', async () => {
    const audio: AudioDriver = { beep: vi.fn(), setTone: vi.fn(), unlock: vi.fn(), playEarcon: vi.fn(), state: 'running' };
    const spoken: string[] = [];
    const speech: SpeechDriver = {
      speak: vi.fn((text) => spoken.push(text)),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    };

    const manager = new AskManager();
    const deps: AskDeps = {
      audio,
      speech,
      scene: testScene,
      say: (msg) => spoken.push(msg),
      request: async () => {
        throw new TypeError('Failed to fetch');
      },
    };

    const outcome = await manager.submitTextAsk('Question?', deps);
    expect(outcome.kind).toBe('failed');
    expect(spoken.length).toBeGreaterThan(0);
    expect(manager.isBusy()).toBe(false);
  });

  it('handles say callback throwing without unhandled rejection', async () => {
    const audio: AudioDriver = { beep: vi.fn(), setTone: vi.fn(), unlock: vi.fn(), playEarcon: vi.fn(), state: 'running' };
    const speech: SpeechDriver = {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    };

    const manager = new AskManager();
    let sayCallCount = 0;
    const deps: AskDeps = {
      audio,
      speech,
      scene: testScene,
      say: () => {
        sayCallCount++;
        throw new Error('Speech synthesis DOM exception');
      },
      request: async () => ({ answer: 'Answer', source: 'ai' }),
    };

    const outcome = await manager.submitTextAsk('Question?', deps);
    // When say throws, it catches the error and finishes cleanly
    expect(outcome.kind).toBe('success');
    expect(sayCallCount).toBeGreaterThanOrEqual(1);
    expect(manager.isBusy()).toBe(false);
  });

  it('voice ask handles listen failure and requests text fallback', async () => {
    const audio: AudioDriver = { beep: vi.fn(), setTone: vi.fn(), unlock: vi.fn(), playEarcon: vi.fn(), state: 'running' };
    const spoken: string[] = [];
    let fallbackRequested = false;

    const speech: SpeechDriver = {
      speak: vi.fn((t) => spoken.push(t)),
      listen: vi.fn(async () => {
        throw new ListenError('no-speech');
      }),
      canSpeak: true,
      canListen: true,
    };

    const manager = new AskManager();
    const deps: AskDeps = {
      audio,
      speech,
      scene: testScene,
      say: (msg) => spoken.push(msg),
      onFallbackNeeded: () => {
        fallbackRequested = true;
      },
      request: vi.fn(),
    };

    const outcome = await manager.startVoiceAsk(deps);
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.message).toBe(t('ask.errorNoSpeech'));
    }
    expect(audio.playEarcon).toHaveBeenCalledWith('error');
    expect(fallbackRequested).toBe(true);
    expect(spoken).toContain(t('ask.errorNoSpeech'));
    expect(manager.isBusy()).toBe(false);
  });

  it('aborted voice ask returns cancelled without speaking error', async () => {
    const audio: AudioDriver = { beep: vi.fn(), setTone: vi.fn(), unlock: vi.fn(), playEarcon: vi.fn(), state: 'running' };
    const spoken: string[] = [];
    let cancelListenCalled = false;

    const speech: SpeechDriver = {
      speak: vi.fn((t) => spoken.push(t)),
      listen: vi.fn(
        () =>
          new Promise<string>((_, reject) => {
            setTimeout(() => reject(new ListenError('failed')), 100);
          }),
      ),
      cancelListen: () => {
        cancelListenCalled = true;
      },
      canSpeak: true,
      canListen: true,
    };

    const manager = new AskManager();
    const deps: AskDeps = {
      audio,
      speech,
      scene: testScene,
      say: (msg) => spoken.push(msg),
      request: vi.fn(),
    };

    const promise = manager.startVoiceAsk(deps);
    manager.abort();

    const outcome = await promise;
    expect(outcome.kind).toBe('cancelled');
    expect(cancelListenCalled).toBe(true);
    expect(manager.isBusy()).toBe(false);
  });

  it('Explore screen renders Ask button and enables text fallback when canListen is false', () => {
    const drivers = createMockDrivers();
    drivers.speech = { ...drivers.speech, canListen: false };

    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: testScene,
        announced: 'Test announcement',
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-explore__ask-form');
    expect(html).toContain('gt-explore__ask-input');
    expect(html).toContain(t('ask.send'));
    expect(html).toContain(t('ask.button'));
  });
});
