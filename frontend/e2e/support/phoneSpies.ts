import type { CDPSession, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Spies and helpers for e2e/phone-test-emulated.spec.ts: they record what the app asks the browser
 * to do (vibrate, speak, set an oscillator frequency) and fake the speech recogniser. This is an
 * emulated Chromium, NOT a phone: it proves the app makes the right calls, never that a motor
 * buzzes, a voice sounds right, or TalkBack works.
 */

export interface SpyState {
  vibrations: Array<number | number[]>;
  utterances: Array<{ text: string; lang: string; rate: number }>;
  cancels: number;
  frequencies: number[];
  say: string[];
}

declare global {
  interface Window {
    __pt: SpyState;
  }
}

export async function installPhoneSpies(page: Page, opts: { recognition?: 'fake' | 'none' } = {}): Promise<void> {
  const recognition = opts.recognition ?? 'fake';
  await page.addInitScript((recog) => {
    const pt: SpyState = { vibrations: [], utterances: [], cancels: 0, frequencies: [], say: [] };
    (window as unknown as { __pt: SpyState }).__pt = pt;

    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (p: number | number[]): boolean => {
        pt.vibrations.push(p);
        return true;
      },
    });

    const synth = window.speechSynthesis;
    if (synth) {
      const origSpeak = synth.speak.bind(synth);
      const origCancel = synth.cancel.bind(synth);
      synth.speak = (u: SpeechSynthesisUtterance): void => {
        pt.utterances.push({ text: u.text ?? '', lang: u.lang ?? '', rate: u.rate ?? 1 });
        origSpeak(u);
      };
      synth.cancel = (): void => {
        pt.cancels++;
        origCancel();
      };
    }

    const Ctx = window.AudioContext;
    if (Ctx) {
      const orig = Ctx.prototype.createOscillator;
      Ctx.prototype.createOscillator = function (this: AudioContext): OscillatorNode {
        const osc = orig.call(this);
        const f = osc.frequency;
        const setTarget = f.setTargetAtTime.bind(f);
        f.setTargetAtTime = (target: number, t: number, c: number): AudioParam => {
          pt.frequencies.push(target);
          return setTarget(target, t, c);
        };
        const setVal = f.setValueAtTime.bind(f);
        f.setValueAtTime = (v: number, t: number): AudioParam => {
          pt.frequencies.push(v);
          return setVal(v, t);
        };
        return osc;
      };
    }

    if (recog === 'fake') {
      class FakeRecognition {
        lang = 'en-US';
        interimResults = false;
        maxAlternatives = 1;
        continuous = false;
        onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        start(): void {
          setTimeout(() => {
            const next = pt.say.shift();
            if (next === undefined) this.onerror?.({ error: 'no-speech' });
            else this.onresult?.({ results: [[{ transcript: next }]] });
          }, 40);
        }
        stop(): void {}
        abort(): void {}
      }
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
      (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    } else {
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition = undefined;
      (window as unknown as Record<string, unknown>).SpeechRecognition = undefined;
    }
  }, recognition);
}

export async function say(page: Page, ...phrases: string[]): Promise<void> {
  await page.evaluate((p) => window.__pt.say.push(...p), phrases);
}

export async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__pt.utterances.map((u) => u.text));
}

export async function expectSpoken(page: Page, text: string): Promise<void> {
  await expect.poll(async () => (await spoken(page)).some((u) => u.includes(text)), { timeout: 8000 }).toBe(true);
}

export async function vibrations(page: Page): Promise<Array<number | number[]>> {
  return page.evaluate(() => window.__pt.vibrations.slice());
}

export async function clearSpies(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__pt.vibrations.length = 0;
    window.__pt.utterances.length = 0;
    window.__pt.frequencies.length = 0;
    window.__pt.cancels = 0;
  });
}

export async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 0 }],
  });
}

/**
 * Page coordinates of a unit-square point on the Explore canvas. Mirrors `makeInsetViewport` in
 * `src/core/geometry.ts` (task 94): side = min(w, h); inset = min(24, side / 4);
 * scale = side - 2 * inset; the square is centred. e2e files must not copy this: import it.
 */
export async function toPage(page: Page, nx: number, ny: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas.gt-explore__canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  const side = Math.min(box.width, box.height);
  const inset = Math.max(0, Math.min(24, side / 4));
  const scale = Math.max(0, side - 2 * inset);
  return {
    x: box.x + (box.width - scale) / 2 + nx * scale,
    y: box.y + (box.height - scale) / 2 + ny * scale,
  };
}
