import { describe, it, expect, vi } from 'vitest';
import { GuideController } from '../src/flow/guide';
import type { DiagramStore, Drivers, HapticDriver, SpeechDriver } from '../src/drivers';
import type { ResolvedTarget } from '../src/guide';

function createMockDrivers() {
  const vibrateMock = vi.fn().mockReturnValue(true);
  const stopHapticsMock = vi.fn();
  const setToneMock = vi.fn();
  const setGuideToneMock = vi.fn();
  const playEarconMock = vi.fn();
  const beepMock = vi.fn();
  const speakMock = vi.fn();
  const listenMock = vi.fn();

  const drivers: Drivers = {
    haptics: {
      supported: true,
      lastResult: true,
      vibrate: vibrateMock,
      stop: stopHapticsMock,
    } as unknown as HapticDriver,
    audio: {
      unlock: vi.fn(),
      setTone: setToneMock,
      setGuideTone: setGuideToneMock,
      beep: beepMock,
      playEarcon: playEarconMock,
      state: 'running',
    },
    speech: {
      speak: speakMock,
      listen: listenMock,
      canSpeak: true,
      canListen: true,
    } as unknown as SpeechDriver,
    diagramStore: {} as unknown as DiagramStore,
  };

  return {
    drivers,
    vibrateMock,
    setGuideToneMock,
    playEarconMock,
    speakMock,
  };
}

const targetPointA: ResolvedTarget = {
  x: 0.2,
  y: 0.2,
  label: 'Point A',
};

describe('GuideController & Cancel Paths & Arrival', () => {
  it('starts guidance, sets phase to guiding, and speaks start announcement', () => {
    const mocks = createMockDrivers();
    const controller = new GuideController({ drivers: mocks.drivers, lang: 'en-IN' });

    controller.start(targetPointA, 1000);
    expect(controller.isGuiding()).toBe(true);
    expect(controller.getTarget()).toEqual(targetPointA);
    expect(mocks.speakMock).toHaveBeenCalledWith('Guiding to Point A.', 'en-IN');
    controller.destroy();
  });

  describe('Arrival once requirement', () => {
    it('emits arrival pattern, success earcon, spoken label, tone off, and only once', () => {
      const mocks = createMockDrivers();
      const onArrived = vi.fn();
      const controller = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onArrived,
      });

      controller.start(targetPointA, 1000);
      mocks.vibrateMock.mockClear();
      mocks.playEarconMock.mockClear();
      mocks.speakMock.mockClear();
      mocks.setGuideToneMock.mockClear();

      // Finger far away (0.8, 0.8) -> guides with tone and pulses
      controller.move({ x: 0.8, y: 0.8 }, 1200);
      expect(controller.isGuiding()).toBe(true);
      expect(mocks.setGuideToneMock).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
      expect(mocks.vibrateMock).toHaveBeenCalled();

      // Finger reaches target within arrival radius (0.2, 0.2)
      mocks.vibrateMock.mockClear();
      mocks.playEarconMock.mockClear();
      mocks.speakMock.mockClear();
      mocks.setGuideToneMock.mockClear();

      controller.move({ x: 0.2, y: 0.2 }, 1500);

      // Phase is no longer guiding
      expect(controller.isGuiding()).toBe(false);
      expect(onArrived).toHaveBeenCalledWith(targetPointA);

      // Corner pattern vibrated: [50, 90, 50]
      expect(mocks.vibrateMock).toHaveBeenCalledWith([50, 90, 50]);
      // Success earcon played
      expect(mocks.playEarconMock).toHaveBeenCalledWith('success');
      // Spoken arrival message
      expect(mocks.speakMock).toHaveBeenCalledWith('Arrived at Point A.', 'en-IN');
      // Tone turned off
      expect(mocks.setGuideToneMock).toHaveBeenCalledWith(null);

      // Subsequent moves while arrived do NOT re-emit effects (arrived once)
      mocks.vibrateMock.mockClear();
      mocks.playEarconMock.mockClear();
      mocks.speakMock.mockClear();
      controller.move({ x: 0.2, y: 0.2 }, 1600);
      expect(mocks.vibrateMock).not.toHaveBeenCalled();
      expect(mocks.playEarconMock).not.toHaveBeenCalled();
      expect(mocks.speakMock).not.toHaveBeenCalled();

      controller.destroy();
    });
  });

  describe('Cancel path 1: Voice "stop"', () => {
    it('stops guidance, silences tone, and speaks "Guide stopped."', () => {
      const mocks = createMockDrivers();
      const onStopped = vi.fn();
      const controller = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onStopped,
      });

      controller.start(targetPointA, 1000);
      expect(controller.isGuiding()).toBe(true);
      mocks.speakMock.mockClear();
      mocks.setGuideToneMock.mockClear();

      controller.stop('voice', 1200);
      expect(controller.isGuiding()).toBe(false);
      expect(mocks.setGuideToneMock).toHaveBeenCalledWith(null);
      expect(mocks.speakMock).toHaveBeenCalledWith('Guide stopped.', 'en-IN');
      expect(onStopped).toHaveBeenCalledWith('voice');

      controller.destroy();
    });
  });

  describe('Cancel path 2: Back button', () => {
    it('stops guidance with reason "back", turns tone off, and speaks "Guide stopped."', () => {
      const mocks = createMockDrivers();
      const onStopped = vi.fn();
      const controller = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onStopped,
      });

      controller.start(targetPointA, 1000);
      expect(controller.isGuiding()).toBe(true);
      mocks.speakMock.mockClear();
      mocks.setGuideToneMock.mockClear();

      controller.stop('back', 1500);
      expect(controller.isGuiding()).toBe(false);
      expect(mocks.setGuideToneMock).toHaveBeenCalledWith(null);
      expect(mocks.speakMock).toHaveBeenCalledWith('Guide stopped.', 'en-IN');
      expect(onStopped).toHaveBeenCalledWith('back');

      controller.destroy();
    });
  });

  describe('Cancel path 3: 20 s timeout', () => {
    it('after 20 seconds, tick triggers timeout stop, turns tone off, and speaks "Guide stopped."', () => {
      const mocks = createMockDrivers();
      const onStopped = vi.fn();
      const controller = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onStopped,
      });

      const startTime = 1000;
      controller.start(targetPointA, startTime);
      mocks.speakMock.mockClear();
      mocks.setGuideToneMock.mockClear();

      // Tick at 19 seconds: still guiding
      controller.tick(startTime + 19000);
      expect(controller.isGuiding()).toBe(true);
      expect(mocks.speakMock).not.toHaveBeenCalled();

      // Tick at 20 seconds: times out
      controller.tick(startTime + 20000);
      expect(controller.isGuiding()).toBe(false);
      expect(mocks.setGuideToneMock).toHaveBeenCalledWith(null);
      expect(mocks.speakMock).toHaveBeenCalledWith('Guide stopped.', 'en-IN');
      expect(onStopped).toHaveBeenCalledWith('timeout');

      controller.destroy();
    });
  });

  describe('Finger lift behaviour', () => {
    it('silences tone on finger lift but keeps phase as guiding', () => {
      const mocks = createMockDrivers();
      const controller = new GuideController({ drivers: mocks.drivers, lang: 'en-IN' });

      controller.start(targetPointA, 1000);
      controller.move({ x: 0.5, y: 0.5 }, 1100);
      expect(controller.isGuiding()).toBe(true);

      mocks.setGuideToneMock.mockClear();
      controller.lift(1200);

      // Tone silenced on lift
      expect(mocks.setGuideToneMock).toHaveBeenCalledWith(null);
      // Phase remains guiding so touching down resumes
      expect(controller.isGuiding()).toBe(true);

      // Touch down / move resumes tone
      controller.move({ x: 0.4, y: 0.4 }, 1300);
      expect(mocks.setGuideToneMock).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));

      controller.destroy();
    });
  });
});
