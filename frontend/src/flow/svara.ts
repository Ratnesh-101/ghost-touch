/**
 * Svara creature-line slot — plays optional, skippable creature audio cues
 * from /voice/.
 *
 * Up to 8 slots supported.
 * Missing files are silently skipped and never block speech.
 * 1-second silent placeholder handling for testing/dev environments.
 * Every line supports tap-to-skip.
 */

import {
  defaultAudioHost,
  type AudioElementLike,
  type AudioHostDriver,
} from '../drivers/audioElement';

export type SvaraSlot =
  | 'intro'
  | 'explore_start'
  | 'success'
  | 'error'
  | 'listening'
  | 'back'
  | 'help'
  | 'rate_change';

export interface SvaraSlotConfig {
  readonly id: SvaraSlot;
  readonly file: string;
  readonly description: string;
}

export const SVARA_SLOTS: Record<SvaraSlot, SvaraSlotConfig> = {
  intro: {
    id: 'intro',
    file: '/voice/intro.mp3',
    description: 'Creature intro welcome cue',
  },
  explore_start: {
    id: 'explore_start',
    file: '/voice/explore_start.mp3',
    description: 'Explore screen entry creature sound',
  },
  success: {
    id: 'success',
    file: '/voice/success.mp3',
    description: 'Success confirmation creature chime',
  },
  error: {
    id: 'error',
    file: '/voice/error.mp3',
    description: 'Error alert creature cue',
  },
  listening: {
    id: 'listening',
    file: '/voice/listening.mp3',
    description: 'Listening prompt creature cue',
  },
  back: {
    id: 'back',
    file: '/voice/back.mp3',
    description: 'Back navigation creature cue',
  },
  help: {
    id: 'help',
    file: '/voice/help.mp3',
    description: 'Help menu creature cue',
  },
  rate_change: {
    id: 'rate_change',
    file: '/voice/rate_change.mp3',
    description: 'Speech rate change creature cue',
  },
};

export const SVARA_SLOT_COUNT = Object.keys(SVARA_SLOTS).length; // Exactly 8 slots

export type SvaraAudioElementLike = AudioElementLike;
export type SvaraHost = AudioHostDriver;
export const defaultSvaraHost = defaultAudioHost;

export type PlayOutcome = 'played' | 'skipped' | 'missing' | 'placeholder_done';

export class SvaraPlayer {
  private activeAudio: SvaraAudioElementLike | null = null;
  private placeholderTimer: unknown = null;
  private cancelCurrent: ((outcome: PlayOutcome) => void) | null = null;
  private isPlayingSlot: SvaraSlot | null = null;

  constructor(private readonly host: SvaraHost = defaultAudioHost()) {}

  get isPlaying(): boolean {
    return this.isPlayingSlot !== null;
  }

  get currentSlot(): SvaraSlot | null {
    return this.isPlayingSlot;
  }

  /**
   * Tap-to-skip: immediately stops any currently playing creature voice
   * or clears any silent placeholder timer.
   */
  skip(): void {
    if (this.cancelCurrent) {
      const cancel = this.cancelCurrent;
      this.cancelCurrent = null;
      cancel('skipped');
    }
  }

  /**
   * Play an optional creature line slot.
   * If the file is missing or fails to load, it is silently skipped and
   * never throws.
   * If usePlaceholder is true and no audio can be played, runs a 1-second
   * silent placeholder that can be skipped by tap.
   */
  play(slot: SvaraSlot, options?: { usePlaceholder?: boolean }): Promise<PlayOutcome> {
    // If something was already playing, cancel it first
    this.skip();

    const config = SVARA_SLOTS[slot];
    if (!config) {
      return Promise.resolve('missing');
    }

    return new Promise<PlayOutcome>((resolve) => {
      this.isPlayingSlot = slot;

      const cleanup = (): void => {
        this.isPlayingSlot = null;
        this.cancelCurrent = null;
        if (this.placeholderTimer !== null && this.host.clearTimeout) {
          this.host.clearTimeout(this.placeholderTimer);
          this.placeholderTimer = null;
        }
        if (this.activeAudio) {
          try {
            this.activeAudio.pause();
            this.activeAudio.onended = null;
            this.activeAudio.onerror = null;
          } catch {
            // ignore cleanup errors
          }
          this.activeAudio = null;
        }
      };

      const finish = (outcome: PlayOutcome): void => {
        cleanup();
        resolve(outcome);
      };

      this.cancelCurrent = (outcome) => finish(outcome);

      const { createAudio } = this.host;
      if (!createAudio) {
        // No audio element support
        if (options?.usePlaceholder && this.host.setTimeout) {
          this.placeholderTimer = this.host.setTimeout(() => {
            finish('placeholder_done');
          }, 1000);
          return;
        }
        finish('missing');
        return;
      }

      let audio: SvaraAudioElementLike;
      try {
        audio = createAudio(config.file);
      } catch {
        // Audio creation failed, silently skip
        finish('missing');
        return;
      }

      this.activeAudio = audio;

      audio.onended = () => {
        finish('played');
      };

      audio.onerror = () => {
        // Missing file or network failure: silently skip without blocking
        if (options?.usePlaceholder && this.host.setTimeout) {
          // If placeholder fallback explicitly requested on missing file
          this.placeholderTimer = this.host.setTimeout(() => {
            finish('placeholder_done');
          }, 1000);
          return;
        }
        finish('missing');
      };

      try {
        const playPromise = audio.play();
        if (playPromise !== undefined && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Autoplay blocked or decode error: silently skip
            if (options?.usePlaceholder && this.host.setTimeout) {
              this.placeholderTimer = this.host.setTimeout(() => {
                finish('placeholder_done');
              }, 1000);
              return;
            }
            finish('missing');
          });
        }
      } catch {
        finish('missing');
      }
    });
  }
}
