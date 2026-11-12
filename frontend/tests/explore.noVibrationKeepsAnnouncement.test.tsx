// @vitest-environment jsdom
/**
 * EX-03: explore.noVibration queued without cancelling initial scene announcement.
 *
 * When haptics.supported is false, Explore's mount effect must queue the missing-vibration
 * notice rather than cancelling the scene announcement just spoken by App.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  MemoryDiagramStore,
  WebSpeechDriver,
  type Drivers,
} from '../src/drivers';
import { Explore } from '../src/screens/Explore';
import { t } from '../src/i18n';

const SIZE = 400;

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Right Triangle ABC',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.75, y: 0.75, label: 'B' },
    { id: 'C', x: 0.25, y: 0.75, label: 'C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
  ],
};

describe('EX-03: noVibration notice queued without cancelling prior utterance', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreProto: () => void;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const proto = HTMLCanvasElement.prototype;
    const origRect = proto.getBoundingClientRect;
    const origContext = proto.getContext;

    proto.getBoundingClientRect = function rect(): DOMRect {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: SIZE,
        bottom: SIZE,
        width: SIZE,
        height: SIZE,
        toJSON: () => ({}),
      } as DOMRect;
    };
    proto.getContext = (() => null) as typeof proto.getContext;

    restoreProto = () => {
      proto.getBoundingClientRect = origRect;
      proto.getContext = origContext;
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    restoreProto();
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  it('queues no-vibration notice after initial scene announcement without cancel', async () => {
    const synthCalls: string[] = [];
    const spokenUtterances: string[] = [];

    const host = {
      synth: {
        cancel: () => synthCalls.push('cancel'),
        speak: () => synthCalls.push('speak'),
      },
      createUtterance: (text: string) => {
        spokenUtterances.push(text);
        return { text, rate: 1, lang: 'en-IN' };
      },
    };

    const speech = new WebSpeechDriver(host);

    const drivers: Drivers = {
      haptics: {
        supported: false, // Laptop / fallback device without Vibration API
        lastResult: null,
        vibrate: vi.fn(),
        stop: vi.fn(),
      },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running',
      },
      speech,
      diagramStore: new MemoryDiagramStore(),
    };

    // 1. App announces the scene description prior to mounting Explore
    speech.speak('Right triangle ABC, 3 corners, 3 sides.');
    expect(synthCalls).toEqual(['cancel', 'speak']);
    expect(spokenUtterances).toEqual(['Right triangle ABC, 3 corners, 3 sides.']);

    // 2. Mount Explore
    await act(async () => {
      root.render(
        createElement(Explore, {
          scene: sampleScene,
          announced: 'Right triangle ABC, 3 corners, 3 sides.',
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    // 3. Mount effect should speak explore.noVibration with queue: true.
    // synthCalls must be ['cancel', 'speak', 'speak'] -- no intermediate cancel!
    expect(synthCalls).toEqual(['cancel', 'speak', 'speak']);
    expect(spokenUtterances).toHaveLength(2);
    expect(spokenUtterances[0]).toBe('Right triangle ABC, 3 corners, 3 sides.');
    expect(spokenUtterances[1]).toBe(t('explore.noVibration'));
  });

  it('passes queue option when calling drivers.speech.speak on fallback', async () => {
    const speakMock = vi.fn();
    const drivers: Drivers = {
      haptics: { supported: false, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'running',
      },
      speech: {
        speak: speakMock,
        listen: vi.fn(),
        canSpeak: true,
        canListen: true,
        getRate: () => 'normal',
      },
      diagramStore: new MemoryDiagramStore(),
    };

    await act(async () => {
      root.render(
        createElement(Explore, {
          scene: sampleScene,
          announced: 'Ready',
          drivers,
          onBack: vi.fn(),
        }),
      );
    });

    expect(speakMock).toHaveBeenCalledWith(
      t('explore.noVibration'),
      expect.any(String),
      expect.objectContaining({ queue: true }),
    );
  });
});
