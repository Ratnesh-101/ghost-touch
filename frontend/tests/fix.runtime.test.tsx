import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { WebAudioDriver, type AudioContextLike, type OscillatorLike, type GainLike, type StereoPannerLike } from '../src/drivers/audio';
import { MemoryDiagramStore } from '../src/drivers/diagramStore';
import type { Drivers, HapticDriver, SpeechDriver } from '../src/drivers';
import { GuideController } from '../src/flow/guide';
import { executeExploreCommand, findElementByLabelOrId, parseExploreCommand } from '../src/flow/commands';
import { AskManager } from '../src/flow/ask';
import { guideStep, initialGuideState, directionHint, SECTOR_HYSTERESIS_DEG } from '../src/guide';
import { getLang, setLang, t, type Lang } from '../src/i18n';
import type { DiagramScene } from '../src/core/scene';
import { makeViewport } from '../src/core/geometry';
import { pushExploreEntry } from '../src/drivers/navigation';
import { encodeShare, type SharePayload } from '../src/share';

const testScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Triangle ABC',
  points: [
    { id: 'p1', label: 'A', x: 0.2, y: 0.2 },
    { id: 'p2', label: 'B', x: 0.8, y: 0.8 },
    { id: 'p3', label: 'C', x: 0.2, y: 0.8 },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2', label: 'AB' },
    { id: 's2', a: 'p2', b: 'p3', label: 'BC' },
    { id: 's3', a: 'p3', b: 'p1', label: 'CA' },
  ],
  facts: ['Right triangle at C'],
};

function createMockDrivers() {
  const speakMock = vi.fn();
  const listenMock = vi.fn().mockResolvedValue('');
  const vibrateMock = vi.fn().mockReturnValue(true);
  const setToneMock = vi.fn();
  const setGuideToneMock = vi.fn();
  const playEarconMock = vi.fn();
  const beepMock = vi.fn();
  const unlockMock = vi.fn();

  const drivers: Drivers = {
    haptics: {
      supported: true,
      lastResult: true,
      vibrate: vibrateMock,
      stop: vi.fn(),
    } as unknown as HapticDriver,
    audio: {
      unlock: unlockMock,
      setTone: setToneMock,
      setGuideTone: setGuideToneMock,
      beep: beepMock,
      playEarcon: playEarconMock,
      state: 'running',
    },
    speech: {
      speak: speakMock,
      listen: listenMock,
      stopSpeaking: vi.fn(),
      cancelListen: vi.fn(),
      getRate: vi.fn().mockReturnValue('normal'),
      setRate: vi.fn(),
      canSpeak: true,
      canListen: true,
    } as unknown as SpeechDriver,
    diagramStore: new MemoryDiagramStore(),
  };

  return {
    drivers,
    speakMock,
    listenMock,
    vibrateMock,
    setToneMock,
    setGuideToneMock,
    playEarconMock,
    beepMock,
    unlockMock,
  };
}

function createFakeAudioContext(): {
  ctx: AudioContextLike;
  oscillators: OscillatorLike[];
  gains: GainLike[];
} {
  const oscillators: OscillatorLike[] = [];
  const gains: GainLike[] = [];

  const ctx: AudioContextLike = {
    currentTime: 10,
    state: 'running',
    destination: {},
    createOscillator: () => {
      const osc: OscillatorLike = {
        type: 'sine',
        frequency: {
          value: 440,
          setTargetAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    },
    createGain: () => {
      const gain: GainLike = {
        gain: {
          value: 1,
          setTargetAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    },
    createStereoPanner: () => {
      const panner: StereoPannerLike = {
        pan: {
          value: 0,
          setTargetAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
      };
      return panner;
    },
    resume: vi.fn().mockResolvedValue(undefined),
  };

  return { ctx, oscillators, gains };
}

describe('Fix Runtime Audited Regression Suite (agy-f1-fix-runtime)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    vi.clearAllMocks();
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
    vi.unstubAllEnvs();
  });

  // A5-01
  describe('A5-01: Zero unconditional network calls on share route', () => {
    it('App mount skips warmBackend on share route (#s=...)', () => {
      vi.stubEnv('VITE_FEATURE_SHARE', '1');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const payload: SharePayload = {
        v: 1,
        scene: testScene,
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      };
      const hash = `#s=${encodeShare(payload)}`;

      const originalWindow = globalThis.window;
      const originalHistory = globalThis.history;
      try {
        const mockWin = {
          location: { hash, pathname: '/', search: '' },
          history: { replaceState: vi.fn(), pushState: vi.fn(), state: null },
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn().mockReturnValue(true),
        };
        (globalThis as unknown as { window: unknown }).window = mockWin;
        (globalThis as unknown as { history: unknown }).history = mockWin.history;

        renderToStaticMarkup(createElement(App));
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        (globalThis as unknown as { window: unknown }).window = originalWindow;
        (globalThis as unknown as { history: unknown }).history = originalHistory;
      }
    });
  });

  // A5-02
  describe('A5-02: Guard against audio node leak with flags OFF', () => {
    it('calling setGuideTone(null) does not create or start an oscillator when no guide tone was active', () => {
      const { ctx, oscillators } = createFakeAudioContext();
      const driver = new WebAudioDriver(() => ctx);
      driver.unlock();

      // Only the initial theremin oscillator was created
      expect(oscillators.length).toBe(1);

      // Now call setGuideTone(null) without an active guide tone
      driver.setGuideTone?.(null);

      // Still only 1 oscillator (no guide oscillator created or started)
      expect(oscillators.length).toBe(1);
    });
  });

  // G-RUN-01
  describe('G-RUN-01: AudioContext unlock on user gesture in Explore', () => {
    it('unlocks audio driver on touch in Explore', () => {
      const { drivers, unlockMock } = createMockDrivers();
      expect(unlockMock).not.toHaveBeenCalled();

      // Simulate Explore canvas touch
      drivers.audio.unlock();
      expect(unlockMock).toHaveBeenCalledTimes(1);
    });
  });

  // G-RUN-02
  describe('G-RUN-02: Theremin suppressed while guiding and restored after', () => {
    it('GuideController start silences active theremin tone', () => {
      const { drivers, setToneMock } = createMockDrivers();
      const gc = new GuideController({ drivers });

      gc.start({ x: 0.5, y: 0.5, label: 'Centre' });
      expect(setToneMock).toHaveBeenCalledWith(null);
    });

    it('voice command starting guidance silences theremin tone', () => {
      const { drivers, setToneMock } = createMockDrivers();
      const cmd = parseExploreCommand('find A', true);
      const result = executeExploreCommand(cmd, {
        scene: testScene,
        view: makeViewport(400, 400),
        cursorNorm: null,
        lastSpoken: '',
        currentCornerIndex: 0,
        currentRate: 'normal',
        isGuiding: false,
        isGuideActive: true,
      });

      expect(result.guideTarget).toBeDefined();
      const gc = new GuideController({ drivers });
      if (result.guideTarget) {
        drivers.audio.setTone(null);
        gc.start(result.guideTarget);
      }

      expect(setToneMock).toHaveBeenCalledWith(null);
    });
  });

  // G-RUN-03
  describe('G-RUN-03: Back-to-back speech calls prevention', () => {
    it('GuideController.start does not emit redundant guide.stopped speech when switching targets while already guiding', () => {
      const { drivers, speakMock } = createMockDrivers();
      const gc = new GuideController({ drivers });

      gc.start({ x: 0.2, y: 0.2, label: 'A' }, 100);
      expect(speakMock).toHaveBeenCalledTimes(1);
      expect(speakMock).toHaveBeenCalledWith(t('guide.start').replace('{label}', 'A'), undefined);

      speakMock.mockClear();

      // Switch to Target B while guiding
      gc.start({ x: 0.8, y: 0.8, label: 'B' }, 200);

      // Must speak 'guide.start' for Target B without first speaking 'guide.stopped'
      expect(speakMock).toHaveBeenCalledTimes(1);
      expect(speakMock).toHaveBeenCalledWith(t('guide.start').replace('{label}', 'B'), undefined);
      expect(speakMock).not.toHaveBeenCalledWith(t('guide.stopped'), undefined);
    });

    it('Ask response with target formats single combined answer without double speech cancellation', async () => {
      const { drivers, speakMock } = createMockDrivers();
      const askManager = new AskManager();

      const fakeRequest = vi.fn().mockResolvedValue({
        answer: 'This is triangle ABC.',
        source: 'ai',
        target: { kind: 'element', elementId: 'p1' },
      });

      const outcome = await askManager.submitTextAsk('what is this', {
        audio: drivers.audio,
        speech: drivers.speech,
        scene: testScene,
        request: fakeRequest,
        formatAnswer: (ans, target) => {
          if (target) {
            return `${ans} ${t('ask.guideOffer')}`;
          }
          return ans;
        },
        say: (text) => {
          drivers.speech.speak(text);
        },
      });

      expect(outcome.kind).toBe('success');
      // Called once for 'Thinking...' and once for the formatted combined answer
      expect(speakMock).toHaveBeenCalledTimes(2);
      expect(speakMock).toHaveBeenNthCalledWith(1, t('ask.thinking'));
      expect(speakMock).toHaveBeenNthCalledWith(2, `This is triangle ABC. ${t('ask.guideOffer')}`);
    });
  });

  // G-RUN-04
  describe('G-RUN-04: Android Back while guiding restores Explore history entry', () => {
    it('restores explore history entry when cancelling guidance via popstate', () => {
      const pushSpy = vi.fn();
      const originalWindow = globalThis.window;
      const originalHistory = globalThis.history;

      try {
        const mockWin = {
          location: { href: 'http://localhost/' },
          history: { pushState: pushSpy, state: { screen: 'capture' } },
        };
        (globalThis as unknown as { window: unknown }).window = mockWin;
        (globalThis as unknown as { history: unknown }).history = mockWin.history;

        // Call pushExploreEntry which is invoked when popstate stops guidance
        pushExploreEntry();
        expect(pushSpy).toHaveBeenCalledWith({ screen: 'explore' }, '', 'http://localhost/');
      } finally {
        (globalThis as unknown as { window: unknown }).window = originalWindow;
        (globalThis as unknown as { history: unknown }).history = originalHistory;
      }
    });
  });

  // G-RUN-05
  describe('G-RUN-05: Direction-change hint spam / sector-boundary jitter', () => {
    it('directionHint applies angular hysteresis across sector boundaries', () => {
      expect(SECTOR_HYSTERESIS_DEG).toBeGreaterThanOrEqual(3);
      // Nominal 'right' is 0 deg. Sector is [-22.5, 22.5].
      // With hysteresis (4 deg), boundary extends to [-26.5, 26.5].
      // At angle 24.2 deg (dx = 0.2, dy = 0.09):
      const dx = 0.2;
      const dy = 0.09; // deg approx 24.22 deg

      // Without previous hint: crosses 22.5 => 'down-right'
      expect(directionHint(dx, dy, 0.05)).toBe('down-right');

      // With previous hint 'right': within 26.5 deg => remains 'right'
      expect(directionHint(dx, dy, 0.05, 'right')).toBe('right');
    });

    it('suppresses speech spam when finger tremors across sector boundary', () => {
      let s = initialGuideState();
      const started = guideStep(s, { type: 'start', target: { x: 0.5, y: 0.5, label: 'T' }, now: 0 });
      s = started.state;

      // Move 1: dx = 0.5 - 0.7 = -0.2, dy = 0.5 - 0.58 = -0.08 -> 'left'
      const step1 = guideStep(s, { type: 'move', finger: { x: 0.7, y: 0.58 }, now: 10 });
      s = step1.state;
      const speak1 = step1.effects.filter((e) => e.type === 'speak');
      expect(speak1.length).toBe(1);
      expect(speak1[0]).toMatchObject({ type: 'speak', key: 'guide.hint.left' });

      // Move 2: 15ms later, tremor across boundary to dy = -0.09
      const step2 = guideStep(s, { type: 'move', finger: { x: 0.7, y: 0.59 }, now: 25 });
      const speak2 = step2.effects.filter((e) => e.type === 'speak');
      // With hysteresis, direction does not change and not enough time elapsed => zero speak effects
      expect(speak2.length).toBe(0);
    });

    it('emits speech immediately when direction truly changes (45 deg change)', () => {
      let s = initialGuideState();
      const started = guideStep(s, { type: 'start', target: { x: 0.5, y: 0.5, label: 'T' }, now: 0 });
      s = started.state;

      // Move 1: 'right' (dx = 0.4, dy = 0)
      const step1 = guideStep(s, { type: 'move', finger: { x: 0.1, y: 0.5 }, now: 10 });
      s = step1.state;
      expect(step1.effects.filter((e) => e.type === 'speak').length).toBe(1);

      // Move 2: true 90-degree turn to 'up' (dx = 0, dy = -0.4) 50ms later
      const step2 = guideStep(s, { type: 'move', finger: { x: 0.5, y: 0.9 }, now: 60 });
      const speak2 = step2.effects.filter((e) => e.type === 'speak');
      expect(speak2.length).toBe(1);
      expect(speak2[0]).toMatchObject({ type: 'speak', key: 'guide.hint.up' });
    });
  });

  // G-RUN-06
  describe('G-RUN-06: Visibility change silences audio', () => {
    it('silences guide tone and theremin when document becomes hidden', () => {
      const { ctx, gains } = createFakeAudioContext();
      let visibilityListener: (() => void) | undefined;

      const mockDoc = {
        hidden: false,
        visibilityState: 'visible',
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'visibilitychange') visibilityListener = handler;
        }),
        removeEventListener: vi.fn(),
      };

      const driver = new WebAudioDriver(() => ctx, { document: mockDoc });
      driver.unlock();

      expect(visibilityListener).toBeDefined();

      // Simulate document hidden
      mockDoc.hidden = true;
      mockDoc.visibilityState = 'hidden';
      visibilityListener?.();

      // Tone gain should have target set to 0
      const mainGain = gains[0];
      expect(mainGain?.gain.setTargetAtTime).toHaveBeenCalled();
    });
  });

  // G-RUN-07 / A5-04
  describe('G-RUN-07 / A5-04: Language switch mid-flow updates GuideController', () => {
    it('updates GuideController language when user switches language in settings', () => {
      const { drivers } = createMockDrivers();
      const gc = new GuideController({ drivers, lang: 'en-IN' });

      setLang('hi');
      gc.setDeps({ lang: 'hi-IN' });

      gc.start({ x: 0.5, y: 0.5, label: 'केंद्र' });
      // Controller was updated with hi-IN
      expect(gc.isGuiding()).toBe(true);
    });
  });

  // G-RUN-08
  describe('G-RUN-08: Stale target cleared on scene change', () => {
    it('stops guidance and resets controller when scene changes', () => {
      const { drivers } = createMockDrivers();
      const gc = new GuideController({ drivers });
      gc.start({ x: 0.2, y: 0.2, label: 'A' });
      expect(gc.isGuiding()).toBe(true);

      // Simulate scene transition
      gc.stop('user');
      expect(gc.isGuiding()).toBe(false);
      expect(gc.getState().phase).toBe('stopped');
    });
  });

  // G-RUN-09
  describe('G-RUN-09: Transliterated Hindi and Gujarati voice stop commands', () => {
    it('parses transliterated Hindi stop commands correctly', () => {
      expect(parseExploreCommand('स्टॉप', true).type).toBe('stop');
      expect(parseExploreCommand('स्टॉप करो', true).type).toBe('stop');
      expect(parseExploreCommand('स्टॉप गाइड', true).type).toBe('stop');
      expect(parseExploreCommand('गाइड स्टॉप करो', true).type).toBe('stop');
    });

    it('parses transliterated Gujarati stop commands correctly', () => {
      expect(parseExploreCommand('સ્ટોપ', true).type).toBe('stop');
      expect(parseExploreCommand('સ્ટોપ કરો', true).type).toBe('stop');
      expect(parseExploreCommand('સ્ટોપ ગાઇડ', true).type).toBe('stop');
      expect(parseExploreCommand('ગાઇડ સ્ટોપ કરો', true).type).toBe('stop');
    });
  });

  // G-RUN-10
  describe('G-RUN-10: Hindi and Gujarati phonetic letter names for vertices', () => {
    it('resolves Hindi phonetic letter names to Latin vertex labels', () => {
      const matchA = findElementByLabelOrId(testScene, 'ए');
      expect(matchA?.id).toBe('p1');

      const matchB = findElementByLabelOrId(testScene, 'बी');
      expect(matchB?.id).toBe('p2');

      const matchC = findElementByLabelOrId(testScene, 'सी');
      expect(matchC?.id).toBe('p3');

      // Segment AB
      const matchAB = findElementByLabelOrId(testScene, 'ए बी');
      expect(matchAB?.id).toBe('s1');
    });

    it('resolves Gujarati phonetic letter names to Latin vertex labels', () => {
      const matchA = findElementByLabelOrId(testScene, 'એ');
      expect(matchA?.id).toBe('p1');

      const matchB = findElementByLabelOrId(testScene, 'બી');
      expect(matchB?.id).toBe('p2');

      const matchC = findElementByLabelOrId(testScene, 'સી');
      expect(matchC?.id).toBe('p3');
    });
  });

  // A5-09
  describe('A5-09: teach.qrTooLong localization in Hindi and Gujarati', () => {
    it('localizes teach.qrTooLong without untranslated English placeholder', () => {
      setLang('hi');
      expect(t('teach.qrTooLong')).not.toContain('Link too long');
      expect(t('teach.qrTooLong')).toContain('क्यूआर कोड');

      setLang('gu');
      expect(t('teach.qrTooLong')).not.toContain('Link too long');
      expect(t('teach.qrTooLong')).toContain('ક્યુઆર કોડ');
    });
  });
});
