// @vitest-environment jsdom
/**
 * T65 (review M3, docs/reviews/kiro-review-bu3-bu5.md): the guards in `Explore.tsx` that keep
 * the click cue, the corner compass, the line name, the where-am-I dwell, the corner heartbeat
 * and the graph scan tone quiet when they must be.
 *
 * Every test mounts the real `Explore` screen with fake drivers and drives it with pointer
 * events. Nothing here copies a guard into the test body: delete a guard in `Explore.tsx` and a
 * test below must go red (mutants are listed in tasks.md, T65). Every group starts with a
 * control that shows the cue exists when its guard is open, so a silence test is never vacuous.
 *
 * Triangle sample on a 400 px canvas: A (100,100), B (280,340), C (100,340). Side CA is the
 * vertical x = 100. (130,220) is 30 px from CA and 48 px from AB, so it is inside the 48 px
 * click zone and off every line.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import { setStoredGuideSetting } from '../src/config/features';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  _resetCornerHeartbeatSettingForTesting,
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
} from '../src/drivers/storage';
import { _resetGraphScanSettingForTesting, setStoredGraphScanSetting } from '../src/flow/explore';
import { Explore } from '../src/screens/Explore';

const SIZE = 400;
const triangle = triangleJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;
const CORNER_PATTERN = [50, 90, 50];
const SCAN_LEVEL = 0.33;

/** A compass clause ("Down-right to B.") or a line name ("Side CA. ..."). */
const COMPASS_OR_LINE_NAME = /\bto [ABC]\b|\bSide [A-C]{2}\b/;

type Calls = unknown[][];

interface Rig {
  playClick: ReturnType<typeof vi.fn>;
  speak: ReturnType<typeof vi.fn>;
  vibrate: ReturnType<typeof vi.fn>;
  setTone: ReturnType<typeof vi.fn>;
  container: HTMLDivElement;
  down: (x: number, y: number, id?: number) => void;
  move: (x: number, y: number, id?: number) => void;
  up: (x: number, y: number, id?: number) => void;
  advance: (ms: number) => void;
  clearCalls: () => void;
  spoken: () => string[];
  vibrations: () => Calls;
  tones: () => Calls;
  resolveListen: (text: string) => Promise<void>;
}

interface Settings {
  directions?: boolean;
  findingSound?: boolean;
  heartbeat?: boolean;
  graphScan?: boolean;
  guide?: boolean;
  scene?: DiagramScene;
}

/** What one run of a trace produced, for on/off comparisons. */
interface Capture {
  vibrate: Calls;
  tone: Calls;
  spoken: string[];
  clicks: number;
  compass: number;
}

function capture(rig: Rig): Capture {
  return {
    vibrate: rig.vibrations(),
    tone: rig.tones(),
    spoken: rig.spoken(),
    clicks: rig.playClick.mock.calls.length,
    compass: rig.spoken().filter((s) => COMPASS_OR_LINE_NAME.test(s)).length,
  };
}

const EMPTY_CAPTURE: Capture = { vibrate: [], tone: [], spoken: [], clicks: 0, compass: 0 };

function fire(el: Element, type: string, x: number, y: number, pointerId: number): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.assign(event, { pointerId });
  act(() => {
    el.dispatchEvent(event);
  });
}

/** Mount the real Explore, run `body`, unmount. Settings are stored before the mount. */
async function withExplore(settings: Settings, body: (rig: Rig) => Promise<void> | void): Promise<void> {
  setStoredDirectionsSetting(settings.directions ?? true);
  setStoredFindingSoundSetting(settings.findingSound ?? true);
  setStoredCornerHeartbeatSetting(settings.heartbeat ?? false);
  setStoredGraphScanSetting(settings.graphScan ?? true);
  setStoredGuideSetting(settings.guide ?? false);

  const playClick = vi.fn();
  const speak = vi.fn();
  const vibrate = vi.fn(() => true);
  const setTone = vi.fn();
  let resolveListenRaw: (text: string) => void = () => {};
  const listen = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        resolveListenRaw = resolve;
      }),
  );

  const drivers = {
    haptics: { supported: true, lastResult: null, vibrate, stop: vi.fn() },
    audio: {
      unlock: vi.fn(),
      setTone,
      setGuideTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      playClick,
      state: 'running',
    },
    speech: {
      speak,
      listen,
      stopSpeaking: vi.fn(),
      cancelListen: vi.fn(),
      isSpeaking: vi.fn(() => false),
      getRate: () => 'normal',
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  } as unknown as Drivers;

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(Explore, {
        scene: settings.scene ?? triangle,
        announced: 'Diagram',
        drivers,
        onBack: vi.fn(),
      }),
    );
  });
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('Explore did not render a canvas');

  const rig: Rig = {
    playClick,
    speak,
    vibrate,
    setTone,
    container,
    down: (x, y, id = 1) => fire(canvas, 'pointerdown', x, y, id),
    move: (x, y, id = 1) => fire(canvas, 'pointermove', x, y, id),
    up: (x, y, id = 1) => fire(canvas, 'pointerup', x, y, id),
    advance: (ms) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    },
    clearCalls: () => {
      playClick.mockClear();
      speak.mockClear();
      vibrate.mockClear();
      setTone.mockClear();
    },
    spoken: () => speak.mock.calls.map((c) => String(c[0])),
    vibrations: () => vibrate.mock.calls.map((c) => [...(c as unknown[])]),
    tones: () => setTone.mock.calls.map((c) => [...(c as unknown[])]),
    resolveListen: async (text) => {
      await act(async () => {
        resolveListenRaw(text);
      });
    },
  };

  try {
    await body(rig);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
}

function openAsk(rig: Rig): void {
  const ask = rig.container.querySelector<HTMLButtonElement>('.gt-explore__ask');
  if (!ask) throw new Error('Ask button not found');
  act(() => ask.click());
}

/** Calls whose first argument is not a stop (`vibrate(0)` / `setTone(null)`): the real cues. */
function cues(calls: Calls): Calls {
  return calls.filter((c) => c[0] !== 0 && c[0] !== null);
}

/** The same scripted triangle trace for every on/off comparison. Times come from the fake clock. */
function playTrace(rig: Rig): void {
  rig.down(130, 220); // off every line, 30 px from CA: click zone
  rig.advance(100);
  rig.move(100, 220); // on CA
  rig.advance(100);
  rig.move(100, 150);
  rig.advance(100);
  rig.move(100, 100); // vertex A, arrived along CA
  rig.advance(600);
  rig.move(140, 160); // on AB
  rig.advance(100);
  rig.move(200, 300); // off line, 40 px from AB: click zone
  rig.advance(100);
  rig.move(280, 340); // vertex B
  rig.advance(300);
  rig.up(280, 340);
}

/** A spot off the sine curve but at the x of one of its points, so the curve height is known. */
function offCurveSpot(): { x: number; y: number } {
  const curve = sine.polylines?.[0];
  const p = curve?.points[40];
  if (!p) throw new Error('sine sample has no point 40');
  const y = p[1] < 0.5 ? p[1] + 0.3 : p[1] - 0.3;
  return { x: p[0] * SIZE, y: y * SIZE };
}

describe('T65 Explore wiring guards (review M3)', () => {
  const protoRestore: Array<() => void> = [];

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    // setImmediate stays real so async act() can flush.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();

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
    protoRestore.push(() => {
      proto.getBoundingClientRect = origRect;
      proto.getContext = origContext;
    });
  });

  afterEach(() => {
    while (protoRestore.length > 0) protoRestore.pop()?.();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();
    setStoredGuideSetting(false);
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  });

  describe('control: with everything open, the cues exist (so the silence tests are not vacuous)', () => {
    it('plays clicks and speaks the compass on the trace', async () => {
      await withExplore({}, (rig) => {
        playTrace(rig);
        expect(rig.playClick).toHaveBeenCalled();
        expect(rig.spoken().some((s) => /\bto B\b/.test(s))).toBe(true);
        expect(rig.vibrate).toHaveBeenCalledWith(CORNER_PATTERN);
        expect(rig.vibrate).toHaveBeenCalledWith(80);
      });
    });

    it('a finger resting on a side hears its name', async () => {
      await withExplore({}, (rig) => {
        rig.down(100, 200);
        rig.advance(3000);
        expect(rig.spoken().some((s) => /\bSide CA\b/.test(s))).toBe(true);
      });
    });

    it('a finger resting on empty space hears where it is', async () => {
      await withExplore({}, (rig) => {
        rig.down(330, 60);
        rig.advance(3000);
        expect(rig.speak).toHaveBeenCalled();
      });
    });

    it('a new touch that lands on corner A speaks the label and every exit (28.2)', async () => {
      await withExplore({}, (rig) => {
        rig.down(100, 100);
        const first = rig.spoken()[0] ?? '';
        expect(first).toMatch(/^A[. ]/);
        expect(first).toMatch(/\bto B\b/);
        expect(first).toMatch(/\bto C\b/);
      });
    });

    it('a curve scan tone plays off the curve on the sine sample', async () => {
      await withExplore({ scene: sine }, (rig) => {
        const spot = offCurveSpot();
        rig.down(spot.x, spot.y);
        expect(rig.tones().some((c) => c[1] === SCAN_LEVEL)).toBe(true);
      });
    });

    it('a finger resting on a corner gets the heartbeat when it is switched on', async () => {
      await withExplore({ heartbeat: true }, (rig) => {
        rig.down(280, 340); // corner B
        rig.advance(3000);
        const beats = rig.vibrations().filter((c) => JSON.stringify(c[0]) === JSON.stringify(CORNER_PATTERN));
        expect(beats.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('(a) Ask listening and Guide guiding keep the cues quiet', () => {
    it('Ask listening: a new touch gives no click, speech, vibration or tone', async () => {
      await withExplore({}, (rig) => {
        openAsk(rig);
        rig.clearCalls();
        rig.down(130, 220); // click zone
        rig.up(130, 220); // a lift may send vibrate(0); that is a stop, not a cue
        rig.down(100, 100); // corner A
        expect(rig.playClick).not.toHaveBeenCalled();
        expect(rig.speak).not.toHaveBeenCalled();
        expect(cues(rig.vibrations())).toEqual([]);
        expect(cues(rig.tones())).toEqual([]);
      });
    });

    it('Ask opened during a hold: later moves, ticks and corner A stay silent', async () => {
      await withExplore({}, (rig) => {
        rig.down(130, 220);
        rig.advance(100);
        expect(rig.playClick).toHaveBeenCalled(); // the cue was live before Ask
        openAsk(rig);
        rig.clearCalls();
        rig.move(131, 221);
        rig.advance(100);
        rig.move(100, 220);
        rig.advance(100);
        rig.move(100, 100);
        rig.advance(3000);
        expect(rig.playClick).not.toHaveBeenCalled();
        expect(rig.speak).not.toHaveBeenCalled();
        expect(cues(rig.vibrations())).toEqual([]);
      });
    });

    it('Ask listening: promoting a second finger gives no click', async () => {
      await withExplore({}, (rig) => {
        openAsk(rig);
        rig.down(130, 220, 1);
        rig.down(131, 221, 2);
        rig.advance(500); // past the 400 ms click interval, before the 600 ms two-finger long press
        rig.clearCalls();
        rig.up(130, 220, 1); // pointer 2 becomes primary, off line in the click zone
        expect(rig.playClick).not.toHaveBeenCalled();
      });
    });

    // KNOWN BUG, found while rebuilding this file (T65): the promotion branch of `handlePointerUp`
    // in Explore.tsx runs `checkVertexCompass` and `runEffects` without looking at `askActive`, so
    // promoting a finger onto corner A while Ask listens speaks "A. Down to C. Down-right to B."
    // and plays the corner pattern. Requirement 28.7 says the exits are not spoken while Ask
    // listens. Explore.tsx is not Kiro's to change in this task; the fix is for an agy lane.
    // `it.fails` keeps the suite honest: it goes red the moment the bug is fixed, and then this
    // must become a plain `it`.
    it.fails('Ask listening: promoting a finger onto corner A speaks no exits (28.7)', async () => {
      await withExplore({}, (rig) => {
        openAsk(rig);
        rig.down(130, 220, 1);
        rig.down(100, 100, 2);
        rig.advance(100);
        rig.clearCalls();
        rig.up(130, 220, 1);
        expect(rig.spoken().filter((s) => COMPASS_OR_LINE_NAME.test(s))).toEqual([]);
      });
    });

    it('Ask listening: promoting a finger that rested on a side does not name the side', async () => {
      await withExplore({}, (rig) => {
        rig.down(100, 200, 1); // on CA
        rig.down(101, 201, 2);
        rig.advance(300);
        openAsk(rig);
        rig.advance(2500); // rest and speech quiet window both satisfied
        rig.clearCalls();
        rig.up(100, 200, 1); // promotion runs the line-dwell check
        expect(rig.spoken().filter((s) => /\bSide CA\b/.test(s))).toEqual([]);
      });
    });

    it('Ask listening: no heartbeat beat on a resting corner', async () => {
      await withExplore({ heartbeat: true }, (rig) => {
        rig.down(280, 340);
        openAsk(rig);
        rig.clearCalls();
        rig.advance(3000);
        expect(cues(rig.vibrations())).toEqual([]);
      });
    });

    it('Ask listening: no scan tone off the curve of the sine sample', async () => {
      await withExplore({ scene: sine }, (rig) => {
        openAsk(rig);
        rig.clearCalls();
        const spot = offCurveSpot();
        rig.down(spot.x, spot.y);
        rig.move(spot.x + 1, spot.y);
        expect(rig.tones().filter((c) => c[1] === SCAN_LEVEL)).toEqual([]);
      });
    });

    it('Ask listening: promoting a finger off the curve gives no scan tone', async () => {
      await withExplore({ scene: sine }, (rig) => {
        const spot = offCurveSpot();
        openAsk(rig);
        rig.down(10, 10, 1);
        rig.down(spot.x, spot.y, 2);
        rig.advance(100);
        rig.clearCalls();
        rig.up(10, 10, 1); // pointer 2 becomes primary, off the curve
        expect(rig.tones().filter((c) => c[1] === SCAN_LEVEL)).toEqual([]);
      });
    });

    it('control: the same promotion gives the scan tone when Ask is not listening', async () => {
      await withExplore({ scene: sine }, (rig) => {
        const spot = offCurveSpot();
        rig.down(10, 10, 1);
        rig.down(spot.x, spot.y, 2);
        rig.advance(100);
        rig.clearCalls();
        rig.up(10, 10, 1);
        expect(rig.tones().some((c) => c[1] === SCAN_LEVEL)).toBe(true);
      });
    });

    it('Guide guiding: no click, no compass or line name, no line or corner buzz', async () => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '1');
      await withExplore({ guide: true }, async (rig) => {
        openAsk(rig);
        await rig.resolveListen('take me to B');
        expect(rig.container.querySelector('.gt-explore--guiding')).not.toBeNull();
        rig.clearCalls();

        rig.down(130, 220);
        rig.advance(100);
        rig.move(100, 220);
        rig.advance(100);
        rig.move(100, 100);
        rig.advance(3000);
        rig.move(100, 340);
        rig.advance(3000);
        rig.up(100, 340);
        rig.down(100, 100); // a new touch straight onto corner A while guiding
        rig.advance(100);
        expect(rig.playClick).not.toHaveBeenCalled();
        expect(rig.spoken().filter((s) => COMPASS_OR_LINE_NAME.test(s))).toEqual([]);
        expect(rig.vibrate).not.toHaveBeenCalledWith(80);
        expect(rig.vibrate).not.toHaveBeenCalledWith(CORNER_PATTERN);
      });
    });

    it('Guide guiding: no scan tone off the curve of the sine sample', async () => {
      vi.stubEnv('VITE_FEATURE_GUIDE', '1');
      await withExplore({ guide: true, scene: sine }, async (rig) => {
        openAsk(rig);
        await rig.resolveListen('find the peak');
        expect(rig.container.querySelector('.gt-explore--guiding')).not.toBeNull();
        rig.clearCalls();
        const spot = offCurveSpot();
        rig.down(spot.x, spot.y);
        rig.move(spot.x + 1, spot.y);
        expect(rig.tones().filter((c) => c[1] === SCAN_LEVEL)).toEqual([]);
      });
    });
  });

  describe('(b) Finding sound off', () => {
    it('plays no click on the whole trace, while the other cues still work', async () => {
      await withExplore({ findingSound: false }, (rig) => {
        playTrace(rig);
        expect(rig.playClick).not.toHaveBeenCalled();
        expect(rig.vibrate).toHaveBeenCalledWith(CORNER_PATTERN);
        expect(rig.spoken().some((s) => /\bto B\b/.test(s))).toBe(true);
      });
    });

    it('also plays no click for a finger resting near a line', async () => {
      await withExplore({ findingSound: false }, (rig) => {
        rig.down(130, 220);
        rig.advance(3000);
        expect(rig.playClick).not.toHaveBeenCalled();
      });
    });
  });

  describe('(c) Directions off', () => {
    it('speaks no compass and no line name on the trace, but still the corner label', async () => {
      await withExplore({ directions: false }, (rig) => {
        playTrace(rig);
        const spoken = rig.spoken();
        expect(spoken.filter((s) => COMPASS_OR_LINE_NAME.test(s))).toEqual([]);
        expect(spoken.some((s) => /^A[. ]?$|^A\b/.test(s))).toBe(true);
        expect(rig.playClick).toHaveBeenCalled(); // Directions does not gate the click
      });
    });

    it('a new touch on corner A speaks the label only', async () => {
      await withExplore({ directions: false }, (rig) => {
        rig.down(100, 100);
        const first = rig.spoken()[0] ?? '';
        expect(first).toMatch(/^A\b/);
        expect(first).not.toMatch(/\bto [BC]\b/);
      });
    });

    it('a finger resting on a side is not told its name', async () => {
      await withExplore({ directions: false }, (rig) => {
        rig.down(100, 200);
        rig.advance(3000);
        expect(rig.spoken().filter((s) => /\bSide CA\b/.test(s))).toEqual([]);
      });
    });

    it('a finger resting on empty space gets no where-am-I speech', async () => {
      await withExplore({ directions: false }, (rig) => {
        rig.down(330, 60);
        rig.advance(3000);
        rig.move(331, 61);
        rig.advance(3000);
        expect(rig.speak).not.toHaveBeenCalled();
      });
    });

    it('the Where am I button still answers', async () => {
      await withExplore({ directions: false }, (rig) => {
        const button = rig.container.querySelector<HTMLButtonElement>('[data-testid="explore-where-am-i"]');
        expect(button).not.toBeNull();
        rig.clearCalls();
        act(() => button?.click());
        expect(rig.speak).toHaveBeenCalled();
      });
    });
  });

  describe('(d) vibrate and tone calls do not depend on the settings', () => {
    it('are identical for the same scripted trace with Directions and Finding sound on and off', async () => {
      let on: Capture = EMPTY_CAPTURE;
      let off: Capture = EMPTY_CAPTURE;

      await withExplore({ directions: true, findingSound: true }, (rig) => {
        playTrace(rig);
        on = capture(rig);
      });
      await withExplore({ directions: false, findingSound: false }, (rig) => {
        playTrace(rig);
        off = capture(rig);
      });

      // The settings do change what they should change ...
      expect(on.clicks).toBeGreaterThan(0);
      expect(on.compass).toBeGreaterThan(0);
      expect(off.clicks).toBe(0);
      expect(off.compass).toBe(0);
      // ... and nothing about vibration or tone.
      expect(on.vibrate).toContainEqual([CORNER_PATTERN]);
      expect(on.vibrate).toContainEqual([80]);
      expect(off.vibrate).toEqual(on.vibrate);
      expect(off.tone).toEqual(on.tone);
    });
  });

  describe('(e) Corner heartbeat off: the engine output is untouched (34.7)', () => {
    it('one corner pattern for a 3 s rest, and the same speech and tone as with the heartbeat on', async () => {
      let on: Capture = EMPTY_CAPTURE;
      let off: Capture = EMPTY_CAPTURE;
      const rest = (rig: Rig): void => {
        rig.down(280, 340); // corner B
        rig.advance(3000);
        rig.up(280, 340);
      };

      await withExplore({ heartbeat: true }, (rig) => {
        rest(rig);
        on = capture(rig);
      });
      await withExplore({ heartbeat: false }, (rig) => {
        rest(rig);
        off = capture(rig);
      });

      const corners = (c: Capture): number =>
        c.vibrate.filter((v) => JSON.stringify(v[0]) === JSON.stringify(CORNER_PATTERN)).length;
      expect(corners(off)).toBe(1);
      expect(corners(on)).toBeGreaterThan(1);
      // A beat is a vibration only: no speech and no tone is added.
      expect(on.spoken).toEqual(off.spoken);
      expect(on.tone).toEqual(off.tone);
    });
  });

  describe('(f) Graph scan off: no scan tone (output is the engine own)', () => {
    it('plays no tone at the scan level off the curve, and no other tone call either', async () => {
      let on: Capture = EMPTY_CAPTURE;
      let off: Capture = EMPTY_CAPTURE;
      const spot = offCurveSpot();
      const trace = (rig: Rig): void => {
        rig.down(spot.x, spot.y);
        rig.advance(100);
        rig.move(spot.x + 2, spot.y);
        rig.advance(100);
        rig.up(spot.x + 2, spot.y);
      };

      await withExplore({ scene: sine, graphScan: true }, (rig) => {
        trace(rig);
        on = capture(rig);
      });
      await withExplore({ scene: sine, graphScan: false }, (rig) => {
        trace(rig);
        off = capture(rig);
      });

      expect(on.tone.some((c) => c[1] === SCAN_LEVEL)).toBe(true);
      expect(off.tone.filter((c) => c[1] === SCAN_LEVEL)).toEqual([]);
      expect(cues(off.tone)).toEqual([]);
      // Scan is audio only: vibration is identical.
      expect(off.vibrate).toEqual(on.vibrate);
    });
  });
});
