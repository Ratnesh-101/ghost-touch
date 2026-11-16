import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  checkPageEdge,
  initialHeartbeatState,
  initialPageEdgeState,
  initialState,
  initialCentreTickState,
  initialAxisState,
  mergeAnnouncements,
  PAGE_EDGE_REARM_PX,
  processPointerMove,
  seedPageEdgeState,
} from '../src/flow/explore';
import { getLang, setLang, type Lang } from '../src/i18n';
import { MemoryDiagramStore, runEffects, type Drivers } from '../src/drivers';

function createMockDrivers(): Drivers {
  return {
    haptics: {
      supported: true,
      lastResult: null,
      vibrate: vi.fn(),
      stop: vi.fn(),
    },
    audio: {
      unlock: vi.fn(),
      setTone: vi.fn(),
      beep: vi.fn(),
      playEarcon: vi.fn(),
      state: 'running' as const,
    },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('Page edge cue pure tracker (checkPageEdge & seedPageEdgeState)', () => {
  let prevLang: Lang;

  beforeEach(() => {
    prevLang = getLang();
    setLang('en');
  });

  afterEach(() => {
    setLang(prevLang);
  });

  it('initial state is armed with no last side', () => {
    const s0 = initialPageEdgeState();
    expect(s0.armed).toBe(true);
    expect(s0.lastSide).toBeNull();
  });

  it('fires edge cue once per exit on all four sides and not again until re-armed', () => {
    const viewScale = 400; // margin = 20 / 400 = 0.05
    let state = initialPageEdgeState();

    // -------------------------------------------------------------------------
    // 1. LEFT SIDE EXIT
    // -------------------------------------------------------------------------
    // Inside the page: no cue
    let res = checkPageEdge({ x: 0.5, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(true);
    state = res.nextState;

    // Cross left edge (x < 0): fires once
    res = checkPageEdge({ x: -0.02, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBe('Edge, left');
    expect(res.nextState.armed).toBe(false);
    expect(res.nextState.lastSide).toBe('left');
    state = res.nextState;

    // Continuing outside left: does NOT fire again
    res = checkPageEdge({ x: -0.08, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving back inside, but < 20 px normalized distance (margin = 0.05, pos = 0.02 < 0.05)
    res = checkPageEdge({ x: 0.02, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false); // still NOT re-armed
    state = res.nextState;

    // Drifting back outside left before fully re-arming: does NOT fire
    res = checkPageEdge({ x: -0.01, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving fully back inside (>= 20 px from all edges: x=0.1, y=0.5): RE-ARMS
    res = checkPageEdge({ x: 0.1, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(true);
    expect(res.nextState.lastSide).toBeNull();
    state = res.nextState;

    // -------------------------------------------------------------------------
    // 2. RIGHT SIDE EXIT
    // -------------------------------------------------------------------------
    // Cross right edge (x > 1): fires once
    res = checkPageEdge({ x: 1.04, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBe('Edge, right');
    expect(res.nextState.armed).toBe(false);
    expect(res.nextState.lastSide).toBe('right');
    state = res.nextState;

    // Continuing outside right: does NOT fire again
    res = checkPageEdge({ x: 1.15, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving back inside, but < 20 px from right edge (1 - margin = 0.95, pos = 0.98 > 0.95)
    res = checkPageEdge({ x: 0.98, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving fully back inside (>= 20 px: x=0.8, y=0.5): RE-ARMS
    res = checkPageEdge({ x: 0.8, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(true);
    state = res.nextState;

    // -------------------------------------------------------------------------
    // 3. TOP SIDE EXIT
    // -------------------------------------------------------------------------
    // Cross top edge (y < 0): fires once
    res = checkPageEdge({ x: 0.5, y: -0.03 }, state, viewScale);
    expect(res.spoken).toBe('Edge, top');
    expect(res.nextState.armed).toBe(false);
    expect(res.nextState.lastSide).toBe('top');
    state = res.nextState;

    // Continuing outside top: does NOT fire again
    res = checkPageEdge({ x: 0.5, y: -0.12 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving back inside, but < 20 px from top (margin = 0.05, pos = 0.03 < 0.05)
    res = checkPageEdge({ x: 0.5, y: 0.03 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving fully back inside (>= 20 px: x=0.5, y=0.2): RE-ARMS
    res = checkPageEdge({ x: 0.5, y: 0.2 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(true);
    state = res.nextState;

    // -------------------------------------------------------------------------
    // 4. BOTTOM SIDE EXIT
    // -------------------------------------------------------------------------
    // Cross bottom edge (y > 1): fires once
    res = checkPageEdge({ x: 0.5, y: 1.05 }, state, viewScale);
    expect(res.spoken).toBe('Edge, bottom');
    expect(res.nextState.armed).toBe(false);
    expect(res.nextState.lastSide).toBe('bottom');
    state = res.nextState;

    // Continuing outside bottom: does NOT fire again
    res = checkPageEdge({ x: 0.5, y: 1.2 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving back inside, but < 20 px from bottom (1 - margin = 0.95, pos = 0.97 > 0.95)
    res = checkPageEdge({ x: 0.5, y: 0.97 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(false);
    state = res.nextState;

    // Moving fully back inside (>= 20 px: x=0.5, y=0.5): RE-ARMS
    res = checkPageEdge({ x: 0.5, y: 0.5 }, state, viewScale);
    expect(res.spoken).toBeNull();
    expect(res.nextState.armed).toBe(true);
    state = res.nextState;

    // Repeat exit on bottom after re-arming: fires again!
    res = checkPageEdge({ x: 0.5, y: 1.02 }, state, viewScale);
    expect(res.spoken).toBe('Edge, bottom');
    expect(res.nextState.armed).toBe(false);
  });

  it('determines the dominant side when exiting diagonally at a corner', () => {
    const s0 = initialPageEdgeState();

    // Overshoot left is 0.1, overshoot top is 0.05 -> names 'left'
    const resLeft = checkPageEdge({ x: -0.1, y: -0.05 }, s0, 300);
    expect(resLeft.spoken).toBe('Edge, left');

    // Overshoot top is 0.15, overshoot right is 0.03 -> names 'top'
    const resTop = checkPageEdge({ x: 1.03, y: -0.15 }, s0, 300);
    expect(resTop.spoken).toBe('Edge, top');

    // Overshoot bottom is 0.2, overshoot right is 0.05 -> names 'bottom'
    const resBottom = checkPageEdge({ x: 1.05, y: 1.2 }, s0, 300);
    expect(resBottom.spoken).toBe('Edge, bottom');
  });

  it('seedPageEdgeState on pointerdown speaks once when landing outside and disarms', () => {
    // 1. Landing outside left on pointerdown -> speaks once
    const seedOutside = seedPageEdgeState({ x: -0.05, y: 0.5 }, 400);
    expect(seedOutside.spoken).toBe('Edge, left');
    expect(seedOutside.nextState.armed).toBe(false);

    // Subsequent move from that seeded state while outside -> silence
    const nextMove = checkPageEdge({ x: -0.08, y: 0.5 }, seedOutside.nextState, 400);
    expect(nextMove.spoken).toBeNull();
    expect(nextMove.nextState.armed).toBe(false);

    // 2. Landing inside on pointerdown -> silent and armed
    const seedInside = seedPageEdgeState({ x: 0.5, y: 0.5 }, 400);
    expect(seedInside.spoken).toBeNull();
    expect(seedInside.nextState.armed).toBe(true);

    // Subsequent move outside -> fires
    const exitMove = checkPageEdge({ x: 1.05, y: 0.5 }, seedInside.nextState, 400);
    expect(exitMove.spoken).toBe('Edge, right');
    expect(exitMove.nextState.armed).toBe(false);
  });

  it('handles non-finite coordinates gracefully without throwing', () => {
    const s0 = initialPageEdgeState();
    const resNan = checkPageEdge({ x: NaN, y: 0.5 }, s0, 300);
    expect(resNan.spoken).toBeNull();
    expect(resNan.nextState.armed).toBe(true);

    const resInf = checkPageEdge({ x: 0.5, y: Infinity }, s0, 300);
    expect(resInf.spoken).toBeNull();
    expect(resInf.nextState.armed).toBe(true);
  });

  it('localizes edge cues correctly across en, hi, and gu', () => {
    const s0 = initialPageEdgeState();

    // English
    setLang('en');
    expect(checkPageEdge({ x: -0.1, y: 0.5 }, s0).spoken).toBe('Edge, left');
    expect(checkPageEdge({ x: 1.1, y: 0.5 }, s0).spoken).toBe('Edge, right');
    expect(checkPageEdge({ x: 0.5, y: -0.1 }, s0).spoken).toBe('Edge, top');
    expect(checkPageEdge({ x: 0.5, y: 1.1 }, s0).spoken).toBe('Edge, bottom');

    // Hindi
    setLang('hi');
    expect(checkPageEdge({ x: -0.1, y: 0.5 }, s0).spoken).toBe('किनारा, बाएँ');
    expect(checkPageEdge({ x: 1.1, y: 0.5 }, s0).spoken).toBe('किनारा, दाएँ');
    expect(checkPageEdge({ x: 0.5, y: -0.1 }, s0).spoken).toBe('किनारा, ऊपर');
    expect(checkPageEdge({ x: 0.5, y: 1.1 }, s0).spoken).toBe('किनारा, नीचे');

    // Gujarati
    setLang('gu');
    expect(checkPageEdge({ x: -0.1, y: 0.5 }, s0).spoken).toBe('કિનારો, ડાબે');
    expect(checkPageEdge({ x: 1.1, y: 0.5 }, s0).spoken).toBe('કિનારો, જમણે');
    expect(checkPageEdge({ x: 0.5, y: -0.1 }, s0).spoken).toBe('કિનારો, ઉપર');
    expect(checkPageEdge({ x: 0.5, y: 1.1 }, s0).spoken).toBe('કિનારો, નીચે');
  });

  it('PAGE_EDGE_REARM_PX constant is exactly 20 px', () => {
    expect(PAGE_EDGE_REARM_PX).toBe(20);
  });
});

describe('Page edge cue in move pipeline (processPointerMove)', () => {
  const sampleScene: DiagramScene = {
    kind: 'geometry',
    points: [{ id: 'A', x: 0.5, y: 0.5, label: 'Centre Point' }],
  };
  const view = makeViewport(400, 400); // scale = 400, offset = (0, 0)

  it('runs checkPageEdge in move pipeline and populates pageEdge on result', () => {
    const s0 = initialPageEdgeState();

    // Finger inside the canvas (screen x=200, y=200 -> norm=(0.5, 0.5))
    const moveInside = processPointerMove(
      sampleScene,
      { x: 200, y: 200 },
      view,
      1000,
      initialState(),
      initialCentreTickState(),
      initialAxisState(),
      undefined,
      undefined,
      undefined,
      undefined,
      initialHeartbeatState(),
      null,
      s0,
    );
    expect(moveInside.pageEdge.spoken).toBeNull();
    expect(moveInside.pageEdge.nextState.armed).toBe(true);

    // Finger outside canvas on right (screen x=450, y=200 -> norm.x=1.125 > 1)
    const moveOutside = processPointerMove(
      sampleScene,
      { x: 450, y: 200 },
      view,
      1050,
      initialState(),
      initialCentreTickState(),
      initialAxisState(),
      undefined,
      undefined,
      undefined,
      undefined,
      initialHeartbeatState(),
      null,
      moveInside.pageEdge.nextState,
    );
    expect(moveOutside.pageEdge.spoken).toBe('Edge, right');
    expect(moveOutside.pageEdge.nextState.armed).toBe(false);

    // Verify move pipeline produces NO vibration for the edge exit
    const drivers = createMockDrivers();
    runEffects(moveOutside.effects, drivers);
    // effects only contain lift silence pattern 0 or nothing when outside
    expect(drivers.haptics.vibrate).not.toHaveBeenCalledWith(expect.arrayContaining([50, 90, 50]));
    expect(drivers.haptics.vibrate).not.toHaveBeenCalledWith(80);
  });

  it('joins edge announcement with other announcements into a single utterance', () => {
    // When axis crossings and page edge coincide
    const axisCrossings = ['x-axis'];
    const edgeSpoken = 'Edge, right';
    const effects = [{ kind: 'tone' as const, hz: null }];

    const merged = mergeAnnouncements([...axisCrossings, edgeSpoken], effects);
    const speakEffect = merged.find((e) => e.kind === 'speak');
    expect(speakEffect).toBeDefined();
    expect(speakEffect?.kind === 'speak' ? speakEffect.text : '').toBe('x-axis. Edge, right');

    const drivers = createMockDrivers();
    runEffects(merged, drivers);
    expect(drivers.speech.speak).toHaveBeenCalledWith('x-axis. Edge, right', undefined);
  });
});
