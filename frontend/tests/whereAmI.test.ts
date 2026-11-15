import { afterEach, describe, expect, it } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import { whereAmI } from '../src/flow/commands';
import {
  checkWhereAmIDwell,
  initialWhereAmIDwellState,
  resetWhereAmIDwellOnLift,
  updateWhereAmIDwellOnMove,
} from '../src/flow/explore';
import { getLang, setLang, tables } from '../src/i18n';
import triangleJson from '../public/samples/triangle.json';
import sineJson from '../public/samples/sine.json';
import barchartJson from '../public/samples/barchart.json';

const triangleScene = triangleJson as unknown as DiagramScene;
const sineScene = sineJson as unknown as DiagramScene;
const barScene = barchartJson as unknown as DiagramScene;

const view300 = makeViewport(300, 300);

describe('Lane A5 — whereAmI pure function', () => {
  const initialLang = getLang();

  afterEach(() => {
    setLang(initialLang);
  });

  it('answers for a finger 30 px left of side CA in triangle sample', () => {
    setLang('en');
    // In triangle.json, Point C is (0.25, 0.85) and Point A is (0.25, 0.25).
    // Segment CA is vertical at x = 0.25.
    // In view 300x300, x = 0.25 is at screen x = 75px.
    // 30 px left is screen x = 45px -> norm x = 45 / 300 = 0.15.
    // At y = 0.5 (screen y = 150px), CA is adjacent.
    const res = whereAmI(triangleScene, view300, { x: 0.15, y: 0.5 });
    expect(res).toContain('side CA');
    expect(res).toContain('close');
    expect(res).toContain('to your right');
    expect(res).toContain('left');
  });

  it('answers for a finger on side AB in triangle sample', () => {
    setLang('en');
    // Segment AB connects A(0.25, 0.25) to B(0.7, 0.85).
    // Midpoint is ((0.25 + 0.7) / 2, (0.25 + 0.85) / 2) = (0.475, 0.55).
    const res = whereAmI(triangleScene, view300, { x: 0.475, y: 0.55 });
    expect(res).toContain('side AB');
    expect(res).toContain('touching');
  });

  it('answers for a finger on corner B in triangle sample', () => {
    setLang('en');
    // Point B is at (0.7, 0.85).
    const res = whereAmI(triangleScene, view300, { x: 0.7, y: 0.85 });
    expect(res).toContain('corner B');
    expect(res).toContain('touching');
    expect(res).toContain('bottom right');
  });

  it('answers for a finger in a far corner of the canvas', () => {
    setLang('en');
    // Top-right corner of canvas (0.95, 0.05) is far from the triangle.
    const res = whereAmI(triangleScene, view300, { x: 0.95, y: 0.05 });
    expect(res).toContain('top right');
    expect(res).toContain('far');
  });

  it('answers for a finger on the sine sample', () => {
    setLang('en');
    // In sine.json, first polyline point is at [0.1, 0.5].
    const res = whereAmI(sineScene, view300, { x: 0.1, y: 0.5 });
    expect(res).toContain('the curve');
    expect(res).toContain('touching');
  });

  it('answers for a finger on the bar sample', () => {
    setLang('en');
    // In barchart.json, bar Q2 has x0=0.32, x1=0.47, y_top=0.44.
    // Midpoint of top edge is ((0.32 + 0.47) / 2, 0.44) = (0.395, 0.44).
    const res = whereAmI(barScene, view300, { x: 0.395, y: 0.44 });
    expect(res).toContain('bar Q2');
    expect(res).toContain('touching');
  });

  it('returns position only for an empty scene', () => {
    setLang('en');
    const emptyScene: DiagramScene = { version: 1, kind: 'unknown' };
    const res = whereAmI(emptyScene, view300, { x: 0.5, y: 0.5 });
    expect(res).toBe('centre');

    const resCorner = whereAmI(emptyScene, view300, { x: 0.1, y: 0.1 });
    expect(resCorner).toBe('top left');
  });

  it('supports Hindi for all whereAmI content', () => {
    setLang('hi');
    const resLeft = whereAmI(triangleScene, view300, { x: 0.15, y: 0.5 });
    expect(resLeft).toContain('भुजा CA');
    expect(resLeft).toContain('पास');
    expect(resLeft).toContain('आपके दाएँ');

    const resB = whereAmI(triangleScene, view300, { x: 0.7, y: 0.85 });
    expect(resB).toContain('कोना B');
    expect(resB).toContain('स्पर्श');

    const resSine = whereAmI(sineScene, view300, { x: 0.1, y: 0.5 });
    expect(resSine).toContain('वक्र');
    expect(resSine).toContain('स्पर्श');

    const resBar = whereAmI(barScene, view300, { x: 0.395, y: 0.44 });
    expect(resBar).toContain('स्तंभ Q2');
    expect(resBar).toContain('स्पर्श');
  });

  it('supports Gujarati for all whereAmI content', () => {
    setLang('gu');
    const resLeft = whereAmI(triangleScene, view300, { x: 0.15, y: 0.5 });
    expect(resLeft).toContain('બાજુ CA');
    expect(resLeft).toContain('નજીક');
    expect(resLeft).toContain('તમારી જમણે');

    const resB = whereAmI(triangleScene, view300, { x: 0.7, y: 0.85 });
    expect(resB).toContain('ખૂણો B');
    expect(resB).toContain('સ્પર્શ');

    const resSine = whereAmI(sineScene, view300, { x: 0.1, y: 0.5 });
    expect(resSine).toContain('વક્ર');
    expect(resSine).toContain('સ્પર્શ');

    const resBar = whereAmI(barScene, view300, { x: 0.395, y: 0.44 });
    expect(resBar).toContain('સ્તંભ Q2');
    expect(resBar).toContain('સ્પર્શ');
  });
});

describe('Lane A5 — i18n keys completeness', () => {
  const REQUIRED_KEYS = [
    'explore.whereAmI',
    'commands.whereAmI',
    'whereAmI.side',
    'whereAmI.corner',
    'whereAmI.curve',
    'whereAmI.xAxis',
    'whereAmI.yAxis',
    'whereAmI.bar',
    'whereAmI.touching',
    'whereAmI.close',
    'whereAmI.far',
    'whereAmI.dir.left',
    'whereAmI.dir.right',
    'whereAmI.dir.up',
    'whereAmI.dir.down',
    'whereAmI.dir.up-left',
    'whereAmI.dir.up-right',
    'whereAmI.dir.down-left',
    'whereAmI.dir.down-right',
    'whereAmI.detailWithDir',
    'whereAmI.detail',
  ] as const;

  it('has all required whereAmI keys present in en, hi and gu', () => {
    for (const key of REQUIRED_KEYS) {
      expect(tables.en[key], `Missing en key: ${key}`).toBeDefined();
      expect(tables.en[key]!.length, `Empty en key: ${key}`).toBeGreaterThan(0);

      expect(tables.hi[key], `Missing hi key: ${key}`).toBeDefined();
      expect(tables.hi[key]!.length, `Empty hi key: ${key}`).toBeGreaterThan(0);

      expect(tables.gu[key], `Missing gu key: ${key}`).toBeDefined();
      expect(tables.gu[key]!.length, `Empty gu key: ${key}`).toBeGreaterThan(0);
    }
  });
});

describe('Lane A5 — Dwell detection state machine', () => {
  const coords = { x: 100, y: 100 };

  it('dwell fires once per rest on a none target after 1200 ms', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    // After 500 ms
    const check1 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 1500,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check1.shouldSpeak).toBe(false);
    state = check1.nextState;

    // After 1199 ms
    const check2 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 2199,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check2.shouldSpeak).toBe(false);
    state = check2.nextState;

    // At 1200 ms: fires!
    const check3 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 2200,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check3.shouldSpeak).toBe(true);
    state = check3.nextState;

    // Subsequent tick while still resting: does not fire again (fires once per rest)
    const check4 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 2260,
      lastSpeechStartTime: 2200,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check4.shouldSpeak).toBe(false);

    const check5 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 4000,
      lastSpeechStartTime: 2200,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check5.shouldSpeak).toBe(false);
  });

  it('does not re-arm after finger moves < 20 px', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    // Fires at 2200 ms
    const check = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 2200,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check.shouldSpeak).toBe(true);
    state = check.nextState;

    // Finger moves 10 px (< 20 px)
    const move10 = { x: 110, y: 100 };
    state = updateWhereAmIDwellOnMove(state, move10, 3000);
    expect(state.armed).toBe(false);

    // Rests at move10 for 1500 ms -> should NOT speak
    const checkMove = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords: move10,
      now: 4500,
      lastSpeechStartTime: 2200,
      isAskActive: false,
      isGuiding: false,
    });
    expect(checkMove.shouldSpeak).toBe(false);
  });

  it('re-arms after finger moves >= 20 px and speaks on subsequent rest', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    // Fires at 2200 ms
    const check1 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 2200,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check1.shouldSpeak).toBe(true);
    state = check1.nextState;

    // Move 25 px (>= 20 px)
    const move25 = { x: 125, y: 100 };
    state = updateWhereAmIDwellOnMove(state, move25, 3000);
    expect(state.armed).toBe(true);
    expect(state.spoken).toBe(false);

    // Rest at move25 for 1200 ms
    const check2 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords: move25,
      now: 4200,
      lastSpeechStartTime: 2200,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check2.shouldSpeak).toBe(true);
  });

  it('re-arms after finger lifts', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    const check1 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 2200,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check1.shouldSpeak).toBe(true);
    state = check1.nextState;
    expect(state.armed).toBe(false);

    // Finger lifts
    state = resetWhereAmIDwellOnLift();
    expect(state.armed).toBe(true);
    expect(state.spoken).toBe(false);
  });

  it('does not fire during Ask', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    const check = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 3000,
      lastSpeechStartTime: 0,
      isAskActive: true,
      isGuiding: false,
    });
    expect(check.shouldSpeak).toBe(false);
  });

  it('does not fire during Guide', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    const check = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 3000,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: true,
    });
    expect(check.shouldSpeak).toBe(false);
  });

  it('does not fire while speech started less than 1500 ms ago', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    // Rested 1500 ms, but speech started at 2000 ms (now = 2500, diff = 500 ms < 1500 ms)
    const check1 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 2500,
      lastSpeechStartTime: 2000,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check1.shouldSpeak).toBe(false);

    // At now = 3600 (diff = 1600 ms >= 1500 ms): can fire!
    const check2 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords,
      now: 3600,
      lastSpeechStartTime: 2000,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check2.shouldSpeak).toBe(true);
  });

  it('does not fire on vertex or line target', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    const checkVertex = checkWhereAmIDwell(state, {
      targetKind: 'vertex',
      coords,
      now: 3000,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(checkVertex.shouldSpeak).toBe(false);

    const checkLine = checkWhereAmIDwell(state, {
      targetKind: 'line',
      coords,
      now: 3000,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(checkLine.shouldSpeak).toBe(false);
  });

  it('resets rest start time when finger moves >= 6 px', () => {
    let state = initialWhereAmIDwellState();
    state = updateWhereAmIDwellOnMove(state, coords, 1000);

    // Finger moves 8 px at t = 2000
    const move8 = { x: 108, y: 100 };
    state = updateWhereAmIDwellOnMove(state, move8, 2000);

    // Check at t = 2500 (only 500 ms since move8) -> false
    const check1 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords: move8,
      now: 2500,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check1.shouldSpeak).toBe(false);

    // Check at t = 3200 (1200 ms since move8) -> true
    const check2 = checkWhereAmIDwell(state, {
      targetKind: 'none',
      coords: move8,
      now: 3200,
      lastSpeechStartTime: 0,
      isAskActive: false,
      isGuiding: false,
    });
    expect(check2.shouldSpeak).toBe(true);
  });
});
