import { describe, expect, it, vi } from 'vitest';
import {
  SVARA_SLOT_COUNT,
  SVARA_SLOTS,
  SvaraPlayer,
  type SvaraAudioElementLike,
  type SvaraHost,
  type SvaraSlot,
} from '../src/flow/svara';

class FakeAudioElement implements SvaraAudioElementLike {
  currentTime = 0;
  onended: ((ev: Event) => unknown) | null = null;
  onerror: ((ev: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => unknown) | null = null;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();

  constructor(public src: string) {}
}

describe('Svara Creature-Line Slot', () => {
  it('defines exactly 8 slots in the manifest', () => {
    expect(SVARA_SLOT_COUNT).toBe(8);
    const expectedSlots: SvaraSlot[] = [
      'intro',
      'explore_start',
      'success',
      'error',
      'listening',
      'back',
      'help',
      'rate_change',
    ];
    for (const slot of expectedSlots) {
      expect(SVARA_SLOTS[slot]).toBeDefined();
      expect(SVARA_SLOTS[slot]?.file).toMatch(/^\/voice\/.*\.mp3$/);
    }
  });

  describe('SvaraPlayer playback & error handling', () => {
    it('silently skips missing files and never throws or blocks', async () => {
      // Default host with no audio API returns missing cleanly
      const defaultPlayer = new SvaraPlayer();
      expect(await defaultPlayer.play('intro')).toBe('missing');

      let createdSrc = '';
      const host: SvaraHost = {
        createAudio: (src) => {
          createdSrc = src;
          const el = new FakeAudioElement(src);
          // Simulate immediate 404 / decode error on next tick
          setTimeout(() => el.onerror?.('404 Not Found'), 0);
          return el;
        },
      };

      const player = new SvaraPlayer(host);
      const outcomePromise = player.play('intro');
      expect(createdSrc).toBe('/voice/intro.mp3');

      const outcome = await outcomePromise;
      expect(outcome).toBe('missing');
      expect(player.isPlaying).toBe(false);
    });

    it('plays successfully to completion when audio file is available', async () => {
      const host: SvaraHost = {
        createAudio: (src) => {
          const el = new FakeAudioElement(src);
          setTimeout(() => el.onended?.(new Event('ended')), 10);
          return el;
        },
      };

      const player = new SvaraPlayer(host);
      const outcomePromise = player.play('success');
      expect(player.isPlaying).toBe(true);
      expect(player.currentSlot).toBe('success');

      const outcome = await outcomePromise;
      expect(outcome).toBe('played');
      expect(player.isPlaying).toBe(false);
    });

    it('supports tap-to-skip, immediately stopping playback', async () => {
      let audioInstance: FakeAudioElement | null = null;
      const host: SvaraHost = {
        createAudio: (src) => {
          audioInstance = new FakeAudioElement(src);
          return audioInstance;
        },
      };

      const player = new SvaraPlayer(host);
      const outcomePromise = player.play('listening');
      expect(player.isPlaying).toBe(true);

      // User taps anywhere to skip creature voice
      player.skip();

      const outcome = await outcomePromise;
      expect(outcome).toBe('skipped');
      const getAudio = () => audioInstance;
      expect(getAudio()?.pause).toHaveBeenCalled();
      expect(player.isPlaying).toBe(false);
    });

    it('handles 1-second silent placeholder and allows tap-to-skip during placeholder', async () => {
      vi.useFakeTimers();
      try {
        const host: SvaraHost = {
          createAudio: () => {
            const el = new FakeAudioElement('/voice/intro.mp3');
            // Missing file triggers error
            setTimeout(() => el.onerror?.('Missing'), 0);
            return el;
          },
          setTimeout: (fn, ms) => setTimeout(fn, ms),
          clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
        };

        const player = new SvaraPlayer(host);
        const outcomePromise = player.play('intro', { usePlaceholder: true });

        // Advance to trigger error and start 1-sec placeholder
        vi.advanceTimersByTime(1);
        expect(player.isPlaying).toBe(true);

        // Tap to skip during the 1-second placeholder
        player.skip();

        const outcome = await outcomePromise;
        expect(outcome).toBe('skipped');
        expect(player.isPlaying).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('1-second silent placeholder completes if not skipped', async () => {
      vi.useFakeTimers();
      try {
        const host: SvaraHost = {
          createAudio: undefined, // no audio support -> enters placeholder
          setTimeout: (fn, ms) => setTimeout(fn, ms),
          clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
        };

        const player = new SvaraPlayer(host);
        const outcomePromise = player.play('intro', { usePlaceholder: true });

        vi.advanceTimersByTime(1000);
        const outcome = await outcomePromise;
        expect(outcome).toBe('placeholder_done');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
