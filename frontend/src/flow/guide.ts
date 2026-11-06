/**
 * Guide flow — glue that feeds pointer moves and ticks to `guideStep`
 * and maps effects to drivers.
 *
 * Implements the Guide contract per docs/briefs/guide-share-contract.md
 * and lane brief docs/briefs/agy-g2-guide-ui.md:
 * - Pure glue between UI/gestures and the pure state machine
 * - Starts guidance, feeds relative/absolute normalized touch coordinates
 * - Runs 20 s timeout ticker
 * - Maps GuideEffect to haptic, audio (with StereoPanner), and speech drivers
 * - Handles cancel paths: voice "stop", Back button, 20 s timeout
 */

import type { Drivers } from '../drivers';
import { runGuideEffects } from '../drivers';
import {
  type GuideConfig,
  type GuideState,
  type NormPoint,
  type ResolvedTarget,
  DEFAULT_GUIDE,
  guideStep,
  initialGuideState,
} from '../guide';

export const GUIDE_TICK_INTERVAL_MS = 250;

export interface GuideControllerDeps {
  drivers: Drivers;
  lang?: string;
  config?: GuideConfig;
  onArrived?: (target: ResolvedTarget) => void;
  onStopped?: (reason: string) => void;
  onStateChange?: (state: GuideState) => void;
}

export class GuideController {
  private state: GuideState = initialGuideState();
  private tickerTimer: ReturnType<typeof setInterval> | null = null;
  private deps: GuideControllerDeps;

  constructor(deps: GuideControllerDeps) {
    this.deps = deps;
  }

  setDeps(deps: Partial<GuideControllerDeps>): void {
    this.deps = { ...this.deps, ...deps };
  }

  getState(): GuideState {
    return this.state;
  }

  isGuiding(): boolean {
    return this.state.phase === 'guiding';
  }

  getTarget(): ResolvedTarget | null {
    return this.state.target;
  }

  start(target: ResolvedTarget, now = performance.now()): void {
    if (this.state.phase === 'guiding') {
      this.clearTicker();
      this.deps.drivers.audio.setGuideTone?.(null);
    }
    // Suppress theremin during guidance per contract
    this.deps.drivers.audio.setTone(null);
    const { state: nextState, effects } = guideStep(
      this.state,
      { type: 'start', target, now },
      this.deps.config ?? DEFAULT_GUIDE,
    );
    this.state = nextState;
    runGuideEffects(effects, this.deps.drivers, this.deps.lang);
    this.deps.onStateChange?.(this.state);
    this.startTicker();
  }

  move(finger: NormPoint, now = performance.now()): void {
    if (this.state.phase !== 'guiding') return;
    const { state: nextState, effects } = guideStep(
      this.state,
      { type: 'move', finger, now },
      this.deps.config ?? DEFAULT_GUIDE,
    );
    this.state = nextState;
    runGuideEffects(effects, this.deps.drivers, this.deps.lang);
    this.deps.onStateChange?.(this.state);

    if (this.state.phase === 'arrived') {
      this.clearTicker();
      if (nextState.target) {
        this.deps.onArrived?.(nextState.target);
      }
    }
  }

  lift(now = performance.now()): void {
    if (this.state.phase !== 'guiding') return;
    const { state: nextState, effects } = guideStep(
      this.state,
      { type: 'lift', now },
      this.deps.config ?? DEFAULT_GUIDE,
    );
    this.state = nextState;
    runGuideEffects(effects, this.deps.drivers, this.deps.lang);
    this.deps.onStateChange?.(this.state);
  }

  stop(
    reason: 'voice' | 'back' | 'timeout' | 'user' = 'user',
    now = performance.now(),
  ): void {
    if (this.state.phase !== 'guiding') return;
    this.clearTicker();
    const { state: nextState, effects } = guideStep(
      this.state,
      { type: 'cancel', reason, now },
      this.deps.config ?? DEFAULT_GUIDE,
    );
    this.state = nextState;
    runGuideEffects(effects, this.deps.drivers, this.deps.lang);
    this.deps.onStateChange?.(this.state);
    this.deps.onStopped?.(reason);
  }

  tick(now = performance.now()): void {
    if (this.state.phase !== 'guiding') return;
    const { state: nextState, effects } = guideStep(
      this.state,
      { type: 'tick', now },
      this.deps.config ?? DEFAULT_GUIDE,
    );
    this.state = nextState;
    runGuideEffects(effects, this.deps.drivers, this.deps.lang);
    this.deps.onStateChange?.(this.state);

    if (this.state.phase === 'stopped') {
      this.clearTicker();
      this.deps.onStopped?.('timeout');
    }
  }

  destroy(): void {
    this.clearTicker();
    if (this.state.phase === 'guiding') {
      this.stop('user');
    }
    this.deps.drivers.audio.setGuideTone?.(null);
  }

  private startTicker(): void {
    this.clearTicker();
    if (typeof setInterval !== 'undefined') {
      this.tickerTimer = setInterval(() => {
        this.tick(performance.now());
      }, GUIDE_TICK_INTERVAL_MS);
    }
  }

  private clearTicker(): void {
    if (this.tickerTimer !== null) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
  }
}
