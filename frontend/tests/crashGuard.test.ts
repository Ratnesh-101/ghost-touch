// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetCrashGuardStateForTests,
  announceCrash,
  installGlobalHandlers,
  reloadApp,
  stopEverything,
} from '../src/drivers/crashGuard';

describe('crashGuard driver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetCrashGuardStateForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('stopEverything', () => {
    it('calls navigator.vibrate(0) and window.speechSynthesis.cancel() inside try/catch', () => {
      const vibrateMock = vi.fn().mockReturnValue(true);
      const cancelMock = vi.fn();

      vi.stubGlobal('navigator', { vibrate: vibrateMock });
      vi.stubGlobal('speechSynthesis', { cancel: cancelMock });

      expect(() => stopEverything()).not.toThrow();
      expect(vibrateMock).toHaveBeenCalledWith(0);
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it('works safely when speechSynthesis and navigator.vibrate are undefined', () => {
      vi.stubGlobal('navigator', {});
      vi.stubGlobal('speechSynthesis', undefined);

      expect(() => stopEverything()).not.toThrow();
    });

    it('does not throw when navigator.vibrate throws', () => {
      const throwingVibrate = vi.fn().mockImplementation(() => {
        throw new Error('Vibration permission denied');
      });
      vi.stubGlobal('navigator', { vibrate: throwingVibrate });
      vi.stubGlobal('speechSynthesis', { cancel: vi.fn() });

      expect(() => stopEverything()).not.toThrow();
      expect(throwingVibrate).toHaveBeenCalledWith(0);
    });

    it('does not throw when window.speechSynthesis.cancel throws', () => {
      const throwingCancel = vi.fn().mockImplementation(() => {
        throw new Error('Speech synthesis error');
      });
      vi.stubGlobal('navigator', { vibrate: vi.fn() });
      vi.stubGlobal('speechSynthesis', { cancel: throwingCancel });

      expect(() => stopEverything()).not.toThrow();
      expect(throwingCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('announceCrash', () => {
    it('speaks once using SpeechSynthesisUtterance', () => {
      const speakMock = vi.fn();
      let capturedText = '';
      let capturedLang = '';

      class MockUtterance {
        text: string;
        private _lang = '';
        get lang(): string {
          return this._lang;
        }
        set lang(val: string) {
          this._lang = val;
          capturedLang = val;
        }
        constructor(text: string) {
          this.text = text;
          capturedText = text;
        }
      }

      vi.stubGlobal('speechSynthesis', { speak: speakMock });
      vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
      window.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;

      announceCrash('Something went wrong.', 'en-IN');

      expect(speakMock).toHaveBeenCalledTimes(1);
      expect(capturedText).toBe('Something went wrong.');
      expect(capturedLang).toBe('en-IN');
    });

    it('ignores repeat calls within 5 seconds (5000 ms)', () => {
      const speakMock = vi.fn();
      class MockUtterance {
        text: string;
        lang = '';
        constructor(text: string) {
          this.text = text;
        }
      }

      vi.stubGlobal('speechSynthesis', { speak: speakMock });
      vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
      window.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;

      announceCrash('Crash 1');
      expect(speakMock).toHaveBeenCalledTimes(1);

      // Advance by 2 seconds (< 5 s)
      vi.advanceTimersByTime(2000);
      announceCrash('Crash 2');
      // Must be ignored / silent
      expect(speakMock).toHaveBeenCalledTimes(1);

      // Advance by another 2 seconds (total 4 s, still < 5 s)
      vi.advanceTimersByTime(2000);
      announceCrash('Crash 3');
      expect(speakMock).toHaveBeenCalledTimes(1);

      // Advance past 5 seconds (total 5001 ms)
      vi.advanceTimersByTime(1001);
      announceCrash('Crash 4');
      expect(speakMock).toHaveBeenCalledTimes(2);
    });

    it('works when speechSynthesis is undefined', () => {
      vi.stubGlobal('speechSynthesis', undefined);
      expect(() => announceCrash('Crash message')).not.toThrow();
    });

    it('does not throw when window.speechSynthesis.speak throws', () => {
      const throwingSpeak = vi.fn().mockImplementation(() => {
        throw new Error('Speech synthesis synthesis error');
      });
      class MockUtterance {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      }
      vi.stubGlobal('speechSynthesis', { speak: throwingSpeak });
      vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
      window.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;

      expect(() => announceCrash('Crash')).not.toThrow();
      expect(throwingSpeak).toHaveBeenCalledTimes(1);
    });
  });

  describe('installGlobalHandlers', () => {
    it('adds window "error" and "unhandledrejection" listeners that call stopEverything() only for "error" events', () => {
      const vibrateMock = vi.fn();
      const cancelMock = vi.fn();
      vi.stubGlobal('navigator', { vibrate: vibrateMock });
      vi.stubGlobal('speechSynthesis', { cancel: cancelMock });

      const cleanup = installGlobalHandlers();

      // Trigger 'error' event
      window.dispatchEvent(new Event('error'));
      expect(vibrateMock).toHaveBeenCalledWith(0);
      expect(cancelMock).toHaveBeenCalledTimes(1);

      // Reset mock counts
      vibrateMock.mockClear();
      cancelMock.mockClear();

      // Trigger 'unhandledrejection' event: must do nothing audible
      window.dispatchEvent(new Event('unhandledrejection'));
      expect(vibrateMock).not.toHaveBeenCalled();
      expect(cancelMock).not.toHaveBeenCalled();

      cleanup();
    });

    it('cleans up event listeners when cleanup function is invoked', () => {
      const vibrateMock = vi.fn();
      vi.stubGlobal('navigator', { vibrate: vibrateMock });
      vi.stubGlobal('speechSynthesis', { cancel: vi.fn() });

      const cleanup = installGlobalHandlers();
      cleanup();

      window.dispatchEvent(new Event('error'));
      expect(vibrateMock).not.toHaveBeenCalled();
    });
  });

  describe('reloadApp', () => {
    it('calls window.location.reload() safely inside try/catch', () => {
      const reloadMock = vi.fn();
      const originalLocation = window.location;

      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, reload: reloadMock },
        writable: true,
        configurable: true,
      });

      expect(() => reloadApp()).not.toThrow();
      expect(reloadMock).toHaveBeenCalledTimes(1);

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    it('does not throw when window.location.reload throws', () => {
      const throwingReload = vi.fn().mockImplementation(() => {
        throw new Error('Navigation restricted');
      });
      const originalLocation = window.location;

      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, reload: throwingReload },
        writable: true,
        configurable: true,
      });

      expect(() => reloadApp()).not.toThrow();
      expect(throwingReload).toHaveBeenCalledTimes(1);

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });
});
