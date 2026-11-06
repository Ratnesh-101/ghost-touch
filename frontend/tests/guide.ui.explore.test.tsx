import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Explore } from '../src/screens/Explore';
import { LabSettings } from '../src/components/LabSettings';
import {
  getStoredGuideSetting,
  isGuideActive,
  isGuideEnvOn,
  setStoredGuideSetting,
} from '../src/config/features';
import type { DiagramScene } from '../src/core/scene';
import { makeViewport } from '../src/core/geometry';
import type { Drivers, HapticDriver, SpeechDriver } from '../src/drivers';
import { GuideController } from '../src/flow/guide';
import { executeExploreCommand, parseExploreCommand } from '../src/flow/commands';
import { getLang, setLang, t, type Lang } from '../src/i18n';

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
    { id: 's1', a: 'p1', b: 'p2', label: 'hypotenuse' },
    { id: 's2', a: 'p2', b: 'p3', label: 'base' },
    { id: 's3', a: 'p3', b: 'p1', label: 'height' },
  ],
  facts: ['AB = 10 cm'],
};

function createMockDrivers() {
  const speakMock = vi.fn();
  const listenMock = vi.fn().mockResolvedValue('');
  const vibrateMock = vi.fn().mockReturnValue(true);
  const setToneMock = vi.fn();
  const setGuideToneMock = vi.fn();
  const playEarconMock = vi.fn();
  const beepMock = vi.fn();

  const drivers: Drivers = {
    haptics: {
      supported: true,
      lastResult: true,
      vibrate: vibrateMock,
      stop: vi.fn(),
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
      stopSpeaking: vi.fn(),
      cancelListen: vi.fn(),
      getRate: vi.fn().mockReturnValue('normal'),
      setRate: vi.fn(),
      canSpeak: true,
      canListen: true,
    } as unknown as SpeechDriver,
    diagramStore: {} as any,
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
  };
}

describe('Guide UI Explore & LabSettings (Server/Node Markup & Flow)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    vi.clearAllMocks();
    prevLang = getLang();
    setLang('en');
    setStoredGuideSetting(false);
  });

  afterEach(() => {
    setLang(prevLang);
    vi.unstubAllEnvs();
  });

  describe('Feature Flag OFF: VITE_FEATURE_GUIDE unset or "0"', () => {
    it('isGuideEnvOn() returns false and isGuideActive() returns false', () => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '');
      expect(isGuideEnvOn()).toBe(false);
      expect(isGuideActive()).toBe(false);

      vi.stubEnv('VITE_FEATURE_GUIDE', '0');
      expect(isGuideEnvOn()).toBe(false);
      expect(isGuideActive()).toBe(false);
    });

    it('LabSettings does NOT render guide toggle when env flag is off', () => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '0');
      const mocks = createMockDrivers();
      const html = renderToStaticMarkup(
        createElement(LabSettings, {
          open: true,
          onClose: vi.fn(),
          drivers: mocks.drivers,
        }),
      );

      expect(html).not.toContain(t('settings.guideHeading'));
      expect(html).not.toContain('role="switch"');
      expect(html).not.toContain(t('settings.guideToggle'));
    });

    it('Explore does NOT render "Guide me" button and never auto-starts guide', () => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '0');
      const mocks = createMockDrivers();
      const html = renderToStaticMarkup(
        createElement(Explore, {
          scene: testScene,
          announced: 'Triangle ABC',
          drivers: mocks.drivers,
          onBack: vi.fn(),
        }),
      );

      expect(html).not.toContain('data-testid="explore-guide-me"');
      expect(html).not.toContain(t('ask.guideMe'));
      expect(html).not.toContain('gt-explore--guiding');
    });

    it('voice commands fall through to unknown when flag is off', () => {
      const takeMe = parseExploreCommand('take me to A', false);
      expect(takeMe.type).toBe('unknown');

      const stopCmd = parseExploreCommand('stop', false);
      expect(stopCmd.type).toBe('unknown');
    });
  });

  describe('Feature Flag ON: VITE_FEATURE_GUIDE === "1"', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '1');
    });

    it('isGuideEnvOn() returns true, and isGuideActive() depends on stored setting', () => {
      expect(isGuideEnvOn()).toBe(true);

      setStoredGuideSetting(false);
      expect(getStoredGuideSetting()).toBe(false);
      expect(isGuideActive()).toBe(false);

      setStoredGuideSetting(true);
      expect(getStoredGuideSetting()).toBe(true);
      expect(isGuideActive()).toBe(true);
    });

    it('LabSettings renders guide toggle switch when VITE_FEATURE_GUIDE is "1"', () => {
      setStoredGuideSetting(false);
      const mocks = createMockDrivers();
      const htmlOff = renderToStaticMarkup(
        createElement(LabSettings, {
          open: true,
          onClose: vi.fn(),
          drivers: mocks.drivers,
        }),
      );

      expect(htmlOff).toContain(t('lab.settings.guide'));
      expect(htmlOff).toContain('role="switch"');
      expect(htmlOff).toContain('aria-checked="false"');
      expect(htmlOff).toContain(t('lab.settings.guideOff'));

      setStoredGuideSetting(true);
      const htmlOn = renderToStaticMarkup(
        createElement(LabSettings, {
          open: true,
          onClose: vi.fn(),
          drivers: mocks.drivers,
        }),
      );
      expect(htmlOn).toContain('aria-checked="true"');
      expect(htmlOn).toContain(t('lab.settings.guideOn'));
    });

    it('voice commands parse successfully when guide is active', () => {
      setStoredGuideSetting(true);
      const takeMe = parseExploreCommand('take me to A', true);
      expect(takeMe.type).toBe('guide_to');
      if (takeMe.type === 'guide_to') {
        expect(takeMe.targetLabel?.toLowerCase()).toBe('a');
      }

      const stopCmd = parseExploreCommand('stop', true);
      expect(stopCmd.type).toBe('stop');

      const nextCorner = parseExploreCommand('next corner', true);
      expect(nextCorner.type).toBe('next_corner');
    });
  });

  describe('Guide lifecycle & Cancel paths (Voice stop, Back button, 20s timeout)', () => {
    it('never auto-starts: Explore renders without active guiding state', () => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '1');
      setStoredGuideSetting(true);
      const mocks = createMockDrivers();

      const html = renderToStaticMarkup(
        createElement(Explore, {
          scene: testScene,
          announced: 'Triangle ABC',
          drivers: mocks.drivers,
          onBack: vi.fn(),
        }),
      );

      expect(html).not.toContain('gt-explore--guiding');
      expect(html).not.toContain('data-testid="explore-guide-me"');
    });

    it('Voice stop cancels guidance and restores idle', () => {
      const mocks = createMockDrivers();
      const stoppedSpy = vi.fn();
      const gc = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onStopped: stoppedSpy,
      });

      gc.start({
        x: 0.2,
        y: 0.2,
        label: 'A',
      });

      expect(gc.isGuiding()).toBe(true);

      // Execute voice stop
      const execResult = executeExploreCommand(
        { type: 'stop', raw: 'stop' },
        {
          scene: testScene,
          view: makeViewport(300, 300),
          cursorNorm: { x: 0.8, y: 0.8 },
          lastSpoken: '',
          currentCornerIndex: 0,
          currentRate: 'normal',
          isGuiding: true,
          isGuideActive: true,
        },
      );

      if (execResult.stopGuide) {
        gc.stop('voice');
      }

      expect(gc.isGuiding()).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledWith('voice');
      expect(execResult.speech).toBe(t('guide.stopped'));

      gc.destroy();
    });

    it('Back button interception stops guide first without leaving Explore', () => {
      const mocks = createMockDrivers();
      const stoppedSpy = vi.fn();
      const onBackSpy = vi.fn();

      const gc = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onStopped: stoppedSpy,
      });

      gc.start({
        x: 0.2,
        y: 0.2,
        label: 'A',
      });

      expect(gc.isGuiding()).toBe(true);

      // Emulate Back button handler in Explore
      const handleBack = () => {
        if (gc.isGuiding()) {
          gc.stop('back');
          return;
        }
        onBackSpy();
      };

      // First back press: stops guidance, does NOT exit screen
      handleBack();
      expect(gc.isGuiding()).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledWith('back');
      expect(onBackSpy).not.toHaveBeenCalled();

      // Second back press: screen exits
      handleBack();
      expect(onBackSpy).toHaveBeenCalledTimes(1);

      gc.destroy();
    });

    it('20s timeout stops guidance automatically', () => {
      vi.useFakeTimers();
      const mocks = createMockDrivers();
      const stoppedSpy = vi.fn();

      const gc = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onStopped: stoppedSpy,
      });

      gc.start({
        x: 0.2,
        y: 0.2,
        label: 'A',
      });

      expect(gc.isGuiding()).toBe(true);

      // Advance by 19 seconds - still guiding
      vi.advanceTimersByTime(19000);
      expect(gc.isGuiding()).toBe(true);
      expect(stoppedSpy).not.toHaveBeenCalled();

      // Advance past 20 seconds - timeout triggers
      vi.advanceTimersByTime(2000);
      expect(gc.isGuiding()).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledWith('timeout');

      gc.destroy();
      vi.useRealTimers();
    });

    it('Arrival triggers corner pattern [50, 90, 50], earcon success, and spoken arrival once', () => {
      const mocks = createMockDrivers();
      const arrivedSpy = vi.fn();

      const gc = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
        onArrived: arrivedSpy,
      });

      gc.start({
        x: 0.2,
        y: 0.2,
        label: 'A',
      });

      // Move cursor directly to target (distance < arrival threshold)
      gc.move({ x: 0.201, y: 0.201 });

      expect(gc.isGuiding()).toBe(false);
      expect(arrivedSpy).toHaveBeenCalledTimes(1);
      expect(mocks.vibrateMock).toHaveBeenCalledWith([50, 90, 50]);
      expect(mocks.playEarconMock).toHaveBeenCalledWith('success');
      expect(mocks.speakMock).toHaveBeenCalledWith(
        expect.stringContaining('A'),
        'en-IN',
      );

      // Moving again does not re-trigger arrival
      gc.move({ x: 0.201, y: 0.201 });
      expect(arrivedSpy).toHaveBeenCalledTimes(1);

      gc.destroy();
    });

    it('MANDATORY SPOKEN HINT FALLBACK: hints are spoken via speech driver regardless of stereo support', () => {
      const mocks = createMockDrivers();
      // Audio driver has NO setGuideTone (mono / unsupported)
      (mocks.drivers.audio as any).setGuideTone = undefined;

      const gc = new GuideController({
        drivers: mocks.drivers,
        lang: 'en-IN',
      });

      gc.start({
        x: 0.2,
        y: 0.2,
        label: 'A',
      });

      // Pointer move away from target -> step computes hint
      gc.move({ x: 0.75, y: 0.75 });

      // Speech driver was called with spoken hint
      expect(mocks.speakMock).toHaveBeenCalled();

      gc.destroy();
    });
  });

  describe('i18n completeness across en, hi, gu', () => {
    const langs: Lang[] = ['en', 'hi', 'gu'];

    it('has all guide keys defined and non-empty in all 3 languages', () => {
      const keys = [
        'guide.start',
        'guide.stopped',
        'guide.arrived',
        'guide.notFound',
        'guide.notGuiding',
        'guide.hint.left',
        'guide.hint.right',
        'guide.hint.up',
        'guide.hint.down',
        'guide.hint.up-left',
        'guide.hint.up-right',
        'guide.hint.down-left',
        'guide.hint.down-right',
        'guide.hint.here',
        'ask.guideOffer',
        'ask.guideMe',
        'lab.settings.guide',
        'lab.settings.guideOn',
        'lab.settings.guideOff',
        'lab.settings.guideHint',
      ] as const;

      for (const lang of langs) {
        setLang(lang);
        for (const key of keys) {
          const val = t(key as any);
          expect(val).toBeDefined();
          expect(val.length).toBeGreaterThan(0);
          expect(val).not.toBe(key); // Not missing
        }
      }
    });
  });
});
