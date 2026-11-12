/**
 * Drivers entry point: the only module screens import browser capabilities from.
 *
 * `runEffects` is pure dispatch: it turns the haptic engine's plain-data
 * effects into driver calls. All decisions live in the engine (core/).
 */

import { DEFAULT_HAPTICS, type Effect } from '../core/hapticEngine';
import type { DiagramScene } from '../core/scene';
import type { GuideEffect } from '../guide';
import { t, tf } from '../i18n';
import { WebAudioDriver, type AudioContextFactory, type AudioDriver } from './audio';
import { IDBDiagramStore, type DiagramStore } from './diagramStore';
import {
  FallbackHapticDriver,
  WebHapticDriver,
  type HapticDriver,
  type VibrateHost,
} from './haptics';
import { WebSpeechDriver, type SpeechDriver } from './speech';

export type { AudioDriver, EarconKind } from './audio';
export { getEarconSteps, WebAudioDriver } from './audio';
export type { DiagramStore, StoreResult } from './diagramStore';
export { IDBDiagramStore, MemoryDiagramStore } from './diagramStore';
export type { HapticDriver } from './haptics';
export { FallbackHapticDriver, WebHapticDriver } from './haptics';
export {
  ListenError,
  type ListenFailure,
  type SpeakOptions,
  type SpeechDriver,
  type SpeechRateSetting,
  BASE_SPEECH_RATE,
  SPEECH_RATE_MULTIPLIERS,
  DEFAULT_SPEECH_LANG,
  findVoiceForLang,
  WebSpeechDriver,
} from './speech';
export { safeGet, safeSet, safeRemove } from './storage';
export {
  type AudioElementLike,
  type AudioElementFactory,
  type AudioHostDriver,
  createAudioElement,
  defaultAudioHost,
  isAudioSupported,
} from './audioElement';

export interface Drivers {
  haptics: HapticDriver;
  audio: AudioDriver;
  speech: SpeechDriver;
  diagramStore: DiagramStore;
}

export function createBrowserDrivers(
  audioFactory?: AudioContextFactory,
  vibrateHost?: VibrateHost,
): Drivers {
  const audio = new WebAudioDriver(audioFactory);
  const webHaptics = new WebHapticDriver(vibrateHost);
  const haptics = webHaptics.supported
    ? webHaptics
    : new FallbackHapticDriver(audio);

  return {
    haptics,
    audio,
    speech: new WebSpeechDriver(),
    diagramStore: new IDBDiagramStore(),
  };
}

/**
 * Generate a compact JPEG data-URL thumbnail of a DiagramScene using HTMLCanvasElement.
 * Pure rendering in the browser layer; returns empty string if canvas is unavailable or throws.
 */
export function renderSceneThumbnail(scene: DiagramScene, size = 120): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    if (!canvas || typeof canvas.getContext !== 'function') return '';
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Dark background matching creature theme (#0b0b10)
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, size, size);

    // Glowing green lines (#39ff88)
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = Math.max(1, Math.round(size / 60));

    // Axes
    if (scene.axes?.x_axis_y != null) {
      const y = scene.axes.x_axis_y * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    if (scene.axes?.y_axis_x != null) {
      const x = scene.axes.y_axis_x * size;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    // Segments
    const pointMap = new Map<string, { x: number; y: number }>();
    if (scene.points) {
      for (const p of scene.points) {
        pointMap.set(p.id, p);
      }
    }
    if (scene.segments) {
      for (const s of scene.segments) {
        const a = pointMap.get(s.a);
        const b = pointMap.get(s.b);
        if (a && b) {
          ctx.beginPath();
          ctx.moveTo(a.x * size, a.y * size);
          ctx.lineTo(b.x * size, b.y * size);
          ctx.stroke();
        }
      }
    }

    // Polylines
    if (scene.polylines) {
      for (const poly of scene.polylines) {
        if (poly.points && poly.points.length > 1) {
          const first = poly.points[0];
          if (first) {
            ctx.beginPath();
            ctx.moveTo(Number(first[0]) * size, Number(first[1]) * size);
            for (let i = 1; i < poly.points.length; i++) {
              const pt = poly.points[i];
              if (pt) {
                ctx.lineTo(Number(pt[0]) * size, Number(pt[1]) * size);
              }
            }
            ctx.stroke();
          }
        }
      }
    }

    // Bars
    if (scene.bars) {
      for (const b of scene.bars) {
        const x = Math.min(b.x0, b.x1) * size;
        const y = Math.min(b.y_top, b.y_base) * size;
        const w = Math.abs(b.x1 - b.x0) * size;
        const h = Math.abs(b.y_base - b.y_top) * size;
        ctx.strokeRect(x, y, w, h);
      }
    }

    if (typeof canvas.toDataURL === 'function') {
      return canvas.toDataURL('image/jpeg', 0.7);
    }
    return '';
  } catch {
    return '';
  }
}

function assertUnreachable(_effect: never): void {
  // Compile-time exhaustiveness check: adding an Effect kind without handling
  // it here fails `tsc`. At runtime an unknown effect is ignored.
}

export function runEffects(
  effects: readonly Effect[],
  drivers: Drivers,
  lang?: string,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'vibrate':
        drivers.haptics.vibrate(effect.pattern);
        break;
      case 'speak':
        drivers.speech.speak(effect.text, lang);
        break;
      case 'speakKey':
        // The engine has no language; the words come from the active i18n table.
        drivers.speech.speak(tf(effect.textKey, effect.params), lang);
        break;
      case 'tone':
        drivers.audio.setTone(effect.hz);
        break;
      default:
        assertUnreachable(effect);
    }
  }
}

export function runGuideEffects(
  effects: readonly GuideEffect[],
  drivers: Drivers,
  lang?: string,
): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'pulse':
        drivers.haptics.vibrate(effect.ms);
        break;
      case 'tone':
        drivers.audio.setGuideTone?.(effect.hz, effect.pan);
        break;
      case 'toneOff':
        drivers.audio.setGuideTone?.(null);
        break;
      case 'speak': {
        let text = t(effect.key);
        if (effect.label) {
          text = text.replace('{label}', effect.label);
        }
        drivers.speech.speak(text, lang);
        break;
      }
      case 'arrive':
        drivers.haptics.vibrate(DEFAULT_HAPTICS.cornerPattern);
        drivers.audio.playEarcon?.('success');
        break;
      case 'stopped':
        drivers.audio.setGuideTone?.(null);
        break;
    }
  }
}
