import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { makeViewport } from '../src/core/geometry';
import {
  AXIS_QUIET_AFTER_CORNER_OR_BAR_MS,
  BAR_REST_FULL_SPEECH_MS,
  BAR_SHORT_FOLLOW_INTERVAL_MS,
  SAME_AXIS_REPEAT_INTERVAL_MS,
  checkBarRest,
  extractBarLabel,
  extractCornerLabel,
  getStoredSpeechDetailSetting,
  initialAxisState,
  initialCentreTickState,
  initialSpeechPacingState,
  initialState,
  noteBarMove,
  paceSpeech,
  processPointerMove,
  resetBarRest,
  setStoredSpeechDetailSetting,
  updateBarMove,
  _resetSpeechDetailSettingForTesting,
} from '../src/flow/explore';
import { getLang, setLang, t } from '../src/i18n';
import barchartJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';

const barScene = barchartJson as unknown as DiagramScene;
const sineScene = sineJson as unknown as DiagramScene;

describe('Lane A7 — Pure Speech Pacing Function (paceSpeech)', () => {
  beforeEach(() => {
    _resetSpeechDetailSettingForTesting();
  });

  afterEach(() => {
    _resetSpeechDetailSettingForTesting();
  });

  it('exports timing constants accurately', () => {
    expect(AXIS_QUIET_AFTER_CORNER_OR_BAR_MS).toBe(600);
    expect(SAME_AXIS_REPEAT_INTERVAL_MS).toBe(2000);
    expect(BAR_SHORT_FOLLOW_INTERVAL_MS).toBe(700);
    expect(BAR_REST_FULL_SPEECH_MS).toBe(500);
  });

  it('drops axis text within 600 ms after corner text', () => {
    let state = initialSpeechPacingState('full');

    // Corner at t = 1000 ms
    const cornerRes = paceSpeech(state, {
      t: 1000,
      text: 'Point A',
      source: 'corner',
    });
    expect(cornerRes.speakNow).toBe('Point A');
    state = cornerRes.state;

    // Axis crossing at t = 1200 ms (200 ms after corner < 600 ms) -> dropped
    const axisRes1 = paceSpeech(state, {
      t: 1200,
      text: 'x-axis',
      source: 'axis',
    });
    expect(axisRes1.speakNow).toBeNull();
    state = axisRes1.state;

    // Axis crossing at t = 1599 ms (599 ms after corner < 600 ms) -> dropped
    const axisRes2 = paceSpeech(state, {
      t: 1599,
      text: 'x-axis',
      source: 'axis',
    });
    expect(axisRes2.speakNow).toBeNull();
    state = axisRes2.state;

    // Axis crossing at t = 1600 ms (600 ms after corner >= 600 ms) -> spoken
    const axisRes3 = paceSpeech(state, {
      t: 1600,
      text: 'x-axis',
      source: 'axis',
    });
    expect(axisRes3.speakNow).toBe('x-axis');
  });

  it('drops axis text within 600 ms after bar text', () => {
    let state = initialSpeechPacingState('full');

    // Bar at t = 500 ms
    const barRes = paceSpeech(state, {
      t: 500,
      text: 'Q1, 10',
      source: 'bar',
    });
    expect(barRes.speakNow).toBe('Q1, 10');
    state = barRes.state;

    // Axis crossing at t = 800 ms (300 ms after bar < 600 ms) -> dropped
    const axisRes1 = paceSpeech(state, {
      t: 800,
      text: 'y-axis',
      source: 'axis',
    });
    expect(axisRes1.speakNow).toBeNull();
    state = axisRes1.state;

    // Axis crossing at t = 1100 ms (600 ms after bar >= 600 ms) -> spoken
    const axisRes2 = paceSpeech(state, {
      t: 1100,
      text: 'y-axis',
      source: 'axis',
    });
    expect(axisRes2.speakNow).toBe('y-axis');
  });

  it('does not repeat the same axis word within 2000 ms', () => {
    let state = initialSpeechPacingState('full');

    // First x-axis crossing at t = 1000 ms
    const r1 = paceSpeech(state, {
      t: 1000,
      text: 'x-axis',
      source: 'axis',
    });
    expect(r1.speakNow).toBe('x-axis');
    state = r1.state;

    // Repeated x-axis at t = 1500 ms (500 ms < 2000 ms) -> dropped
    const r2 = paceSpeech(state, {
      t: 1500,
      text: 'x-axis',
      source: 'axis',
    });
    expect(r2.speakNow).toBeNull();
    state = r2.state;

    // Repeated x-axis at t = 2999 ms (1999 ms < 2000 ms) -> dropped
    const r3 = paceSpeech(state, {
      t: 2999,
      text: 'x-axis',
      source: 'axis',
    });
    expect(r3.speakNow).toBeNull();
    state = r3.state;

    // A different axis word (y-axis) at t = 2500 ms is allowed
    const rY = paceSpeech(state, {
      t: 2500,
      text: 'y-axis',
      source: 'axis',
    });
    expect(rY.speakNow).toBe('y-axis');
    state = rY.state;

    // x-axis at t = 3000 ms (2000 ms >= 2000 ms) -> spoken
    const r4 = paceSpeech(state, {
      t: 3000,
      text: 'x-axis',
      source: 'axis',
    });
    expect(r4.speakNow).toBe('x-axis');
  });

  it('corners in short mode speak the label only', () => {
    expect(extractCornerLabel('Point A. Down-right to B.')).toBe('Point A');
    expect(extractCornerLabel('Corner C')).toBe('Corner C');

    const shortState = initialSpeechPacingState('short');

    // Corner with compass directions attached
    const r1 = paceSpeech(shortState, {
      t: 100,
      text: 'Point A. Down-right to B.',
      source: 'corner',
    });
    expect(r1.speakNow).toBe('Point A');

    // Corner with plain label
    const r2 = paceSpeech(shortState, {
      t: 200,
      text: 'Corner C',
      source: 'corner',
    });
    expect(r2.speakNow).toBe('Corner C');

    // Corner in full mode speaks full text
    const fullState = initialSpeechPacingState('full');
    const rFull = paceSpeech(fullState, {
      t: 100,
      text: 'Point A. Down-right to B.',
      source: 'corner',
    });
    expect(rFull.speakNow).toBe('Point A. Down-right to B.');
  });

  it('resets pending bar rest', () => {
    let state = initialSpeechPacingState('short');
    state = paceSpeech(state, { t: 0, text: 'Q1, 10', source: 'bar', barId: 'q1' }).state;
    state = paceSpeech(state, { t: 100, text: 'Q2, 25', source: 'bar', barId: 'q2' }).state;
    expect(state.pendingBarRest).not.toBeNull();
    state = resetBarRest(state);
    expect(state.pendingBarRest).toBeNull();
  });

  it('noteBarMove is an alias for updateBarMove', () => {
    expect(noteBarMove).toBe(updateBarMove);
  });

  it('measures bar full-value speech from stillness, not entry (M1)', () => {
    let state = initialSpeechPacingState('short');

    // First bar at t = 100 ms -> full text
    const r1 = paceSpeech(state, {
      t: 100,
      text: 'Q1, 10',
      source: 'bar',
      barId: 'q1',
    });
    expect(r1.speakNow).toBe('Q1, 10');
    state = r1.state;

    // Second bar entered at t = 400 ms (within 700 ms of Q1) -> reduced to label 'Q2'
    const r2 = paceSpeech(state, {
      t: 400,
      text: 'Q2, 25',
      source: 'bar',
      barId: 'q2',
    });
    expect(r2.speakNow).toBe('Q2');
    state = r2.state;

    // Move on the bar for 700 ms (from t = 400 ms to t = 1100 ms)
    for (let timeMs = 420; timeMs <= 1100; timeMs += 20) {
      state = updateBarMove(state, timeMs, 'q2');
    }

    // Pause for 60 ms (at t = 1160 ms): elapsed stillness = 60 ms < 500 ms -> no full value
    const pause60 = checkBarRest(state, 1160, 'q2');
    expect(pause60.speakNow).toBeNull();
    state = pause60.state;

    // Pause for 500 ms from last move (at t = 1600 ms): elapsed stillness = 500 ms >= 500 ms -> full value!
    const pause500 = checkBarRest(state, 1600, 'q2');
    expect(pause500.speakNow).toBe('Q2, 25');
    state = pause500.state;

    // Subsequent keep-alive tick at t = 1660 ms -> not repeated
    const subsequentTick = checkBarRest(state, 1660, 'q2');
    expect(subsequentTick.speakNow).toBeNull();
  });

  it('in short mode reduces a bar that follows another bar within 700 ms to label, and speaks full on 500 ms rest', () => {
    let state = initialSpeechPacingState('short');

    // First bar at t = 100 ms -> does not follow another bar within 700 ms -> full text
    const r1 = paceSpeech(state, {
      t: 100,
      text: 'Q1, 10',
      source: 'bar',
      barId: 'q1',
    });
    expect(r1.speakNow).toBe('Q1, 10');
    state = r1.state;

    // Second bar at t = 400 ms (300 ms after Q1 < 700 ms) -> reduced to label
    const r2 = paceSpeech(state, {
      t: 400,
      text: 'Q2, 25',
      source: 'bar',
      barId: 'q2',
    });
    expect(r2.speakNow).toBe('Q2');
    state = r2.state;

    // Keep-alive check at t = 700 ms (rested 300 ms < 500 ms) -> not spoken yet
    const restCheck1 = checkBarRest(state, 700, 'q2');
    expect(restCheck1.speakNow).toBeNull();
    state = restCheck1.state;

    // Keep-alive check at t = 900 ms (rested 500 ms >= 500 ms) -> full "label, value" spoken!
    const restCheck2 = checkBarRest(state, 900, 'q2');
    expect(restCheck2.speakNow).toBe('Q2, 25');
    state = restCheck2.state;

    // Subsequent keep-alive check at t = 960 ms -> not repeated
    const restCheck3 = checkBarRest(state, 960, 'q2');
    expect(restCheck3.speakNow).toBeNull();
  });

  it('in short mode a bar that follows another bar after >= 700 ms speaks full text', () => {
    let state = initialSpeechPacingState('short');

    const r1 = paceSpeech(state, {
      t: 100,
      text: 'Q1, 10',
      source: 'bar',
    });
    expect(r1.speakNow).toBe('Q1, 10');
    state = r1.state;

    // Next bar at t = 900 ms (800 ms after Q1 >= 700 ms)
    const r2 = paceSpeech(state, {
      t: 900,
      text: 'Q2, 25',
      source: 'bar',
    });
    expect(r2.speakNow).toBe('Q2, 25');
  });

  it('in full mode bars are never reduced and always speak full text', () => {
    let state = initialSpeechPacingState('full');

    const r1 = paceSpeech(state, {
      t: 100,
      text: 'Q1, 10',
      source: 'bar',
    });
    expect(r1.speakNow).toBe('Q1, 10');
    state = r1.state;

    // Bar 2 at t = 200 ms (100 ms later)
    const r2 = paceSpeech(state, {
      t: 200,
      text: 'Q2, 25',
      source: 'bar',
    });
    expect(r2.speakNow).toBe('Q2, 25');
  });

  it('preserves other sources untouched in full and short mode', () => {
    const s1 = paceSpeech(initialSpeechPacingState('full'), {
      t: 100,
      text: 'Centre.',
      source: 'other',
    });
    expect(s1.speakNow).toBe('Centre.');

    const s2 = paceSpeech(initialSpeechPacingState('short'), {
      t: 100,
      text: 'Centre.',
      source: 'other',
    });
    expect(s2.speakNow).toBe('Centre.');
  });
});

describe('Lane A7 — Requirement 4: Mandated Integration Tests', () => {
  beforeEach(() => {
    _resetSpeechDetailSettingForTesting();
  });

  afterEach(() => {
    _resetSpeechDetailSettingForTesting();
  });

  /**
   * Test 4.1: The bar sweep at 120 px/s on frontend/public/samples/barchart.json
   * in short mode never cuts a label.
   */
  it('the bar sweep at 120 px/s on frontend/public/samples/barchart.json in short mode never cuts a label', () => {
    const view = makeViewport(400, 400);
    // At yNorm = 0.75 (y = 300 px), all bars in barchart.json are touched.
    // Normalized x spans:
    // Q1: [0.12, 0.27] -> px: [48, 108]
    // Q2: [0.32, 0.47] -> px: [128, 188]
    // Q3: [0.52, 0.67] -> px: [208, 268]
    // Q4: [0.72, 0.87] -> px: [288, 348]

    let engineState = initialState();
    let centreTickState = initialCentreTickState();
    let axisState = initialAxisState();
    let pacingState = initialSpeechPacingState('short');

    // Sweep from screen x = 40 px (t=0) to x = 360 px at 120 px/s (0.12 px/ms).
    // Total sweep duration: (360 - 40) / 0.12 = 2666.7 ms.
    const startX = 40;
    const speedPxPerMs = 120 / 1000; // 0.12 px/ms
    const stepMs = 10;
    const totalMs = 2800;

    interface UtteranceRecord {
      text: string;
      label: string;
      startTime: number;
      cancelledTime: number | null;
    }

    const utterances: UtteranceRecord[] = [];

    for (let timeMs = 0; timeMs <= totalMs; timeMs += stepMs) {
      const currentX = Math.min(360, startX + timeMs * speedPxPerMs);
      const moveResult = processPointerMove(
        barScene,
        { x: currentX, y: 300 },
        view,
        timeMs,
        engineState,
        centreTickState,
        axisState,
      );
      engineState = moveResult.nextEngineState;
      centreTickState = moveResult.centreCheck.nextState;
      axisState = moveResult.nextAxisState;

      // Check speak effects from engine
      for (const effect of moveResult.effects) {
        if (effect.kind === 'speak' && moveResult.target.kind === 'bar') {
          const paced = paceSpeech(pacingState, {
            t: timeMs,
            text: effect.text,
            source: 'bar',
            detail: 'short',
            barId: moveResult.target.id,
          });
          pacingState = paced.state;

          if (paced.speakNow !== null) {
            // Cancel previous utterance
            if (utterances.length > 0) {
              const last = utterances[utterances.length - 1]!;
              if (last.cancelledTime === null) {
                last.cancelledTime = timeMs;
              }
            }
            utterances.push({
              text: paced.speakNow,
              label: extractBarLabel(paced.speakNow),
              startTime: timeMs,
              cancelledTime: null,
            });
          }
        }
      }

      if (moveResult.target.kind === 'bar') {
        pacingState = updateBarMove(pacingState, timeMs, moveResult.target.id);
      }
    }

    // After sweeping, rest on the last bar (Q4 at x=340) for 600 ms
    const restStartT = totalMs;
    for (let timeMs = restStartT; timeMs <= restStartT + 600; timeMs += 60) {
      const restResult = checkBarRest(pacingState, timeMs, 'q4');
      pacingState = restResult.state;
      if (restResult.speakNow !== null) {
        utterances.push({
          text: restResult.speakNow,
          label: extractBarLabel(restResult.speakNow),
          startTime: timeMs,
          cancelledTime: null,
        });
      }
    }

    // Verify all 4 bar labels were announced
    const labelsAnnounced = utterances.map((u) => u.label);
    expect(labelsAnnounced).toContain('Q1');
    expect(labelsAnnounced).toContain('Q2');
    expect(labelsAnnounced).toContain('Q3');
    expect(labelsAnnounced).toContain('Q4');

    // Verify that every bar label in the sweep had at least 500 ms of playback time
    // before any subsequent utterance cancelled it, ensuring NO label was ever cut!
    for (let i = 0; i < utterances.length - 1; i++) {
      const utt = utterances[i]!;
      const nextUtt = utterances[i + 1]!;
      const playDuration = nextUtt.startTime - utt.startTime;

      // Standard short labels ('Q1', 'Q2', etc.) require ~250-350 ms.
      // At 120 px/s with ~80 px spacing, each bar has ~667 ms playback time.
      expect(playDuration).toBeGreaterThanOrEqual(500);
    }

    // Verify full "Q4, 32" was spoken after resting on Q4 for 500 ms
    const lastUtt = utterances[utterances.length - 1]!;
    expect(lastUtt.text).toBe('Q4, 32');
  });

  /**
   * Test 4.2: Tracing the x-axis with 8 px wobble on the sine sample
   * says "x-axis" at most twice in 3.3 s.
   */
  it('tracing the x-axis with 8 px wobble on the sine sample says "x-axis" at most twice in 3.3 s', () => {
    const view = makeViewport(400, 400);
    // x_axis_y in sine.json is 0.5 -> screen y = 200 px
    let engineState = initialState();
    let centreTickState = initialCentreTickState();
    let axisState = initialAxisState();
    let pacingState = initialSpeechPacingState('full');

    const totalDurationMs = 3300;
    const stepMs = 20;
    let xAxisSpokenCount = 0;
    const spokenTimes: number[] = [];

    for (let timeMs = 0; timeMs <= totalDurationMs; timeMs += stepMs) {
      // Move horizontally across screen x [50 px, 350 px]
      const screenX = 50 + (300 * timeMs) / totalDurationMs;
      // Wobble vertically around y = 200 px with 8 px amplitude
      // Period = ~300 ms -> crosses y = 200 px more than 20 times!
      const screenY = 200 + 8 * Math.sin((timeMs * 2 * Math.PI) / 300);

      const moveResult = processPointerMove(
        sineScene,
        { x: screenX, y: screenY },
        view,
        timeMs,
        engineState,
        centreTickState,
        axisState,
      );
      engineState = moveResult.nextEngineState;
      centreTickState = moveResult.centreCheck.nextState;
      axisState = moveResult.nextAxisState;

      for (const axisText of moveResult.axisCrossings) {
        const paced = paceSpeech(pacingState, {
          t: timeMs,
          text: axisText,
          source: 'axis',
          detail: 'full',
        });
        pacingState = paced.state;

        if (paced.speakNow !== null && paced.speakNow.includes(t('explore.xAxis'))) {
          xAxisSpokenCount++;
          spokenTimes.push(timeMs);
        }
      }
    }

    // MANDATED ASSERTION: "says 'x-axis' at most twice in 3.3 s"
    expect(xAxisSpokenCount).toBeLessThanOrEqual(2);
    expect(xAxisSpokenCount).toBeGreaterThanOrEqual(1);

    // If spoken twice, verify they are spaced by at least 2000 ms
    if (spokenTimes.length === 2) {
      expect(spokenTimes[1]! - spokenTimes[0]!).toBeGreaterThanOrEqual(2000);
    }
  });

  /**
   * Test 4.3: A corner label is never followed by an axis word within 600 ms.
   */
  it('a corner label is never followed by an axis word within 600 ms', () => {
    let pacingState = initialSpeechPacingState('full');

    // 1. Enter corner at t = 1000 ms
    const cornerRes = paceSpeech(pacingState, {
      t: 1000,
      text: 'Point A',
      source: 'corner',
      detail: 'full',
    });
    expect(cornerRes.speakNow).toBe('Point A');
    pacingState = cornerRes.state;

    // Test axis crossing attempts at various intervals < 600 ms
    const testIntervalsMs = [10, 50, 100, 200, 350, 500, 599];
    for (const dt of testIntervalsMs) {
      const timeMs = 1000 + dt;
      const axisRes = paceSpeech(pacingState, {
        t: timeMs,
        text: 'x-axis',
        source: 'axis',
        detail: 'full',
      });
      pacingState = axisRes.state;

      // MUST NOT speak within 600 ms!
      expect(axisRes.speakNow).toBeNull();
    }

    // At t = 1600 ms (600 ms after corner), axis word is finally permitted
    const permittedRes = paceSpeech(pacingState, {
      t: 1600,
      text: 'x-axis',
      source: 'axis',
      detail: 'full',
    });
    expect(permittedRes.speakNow).toBe('x-axis');
  });
});

describe('Lane A7 — Settings & Storage Persistence', () => {
  beforeEach(() => {
    _resetSpeechDetailSettingForTesting();
  });

  afterEach(() => {
    _resetSpeechDetailSettingForTesting();
  });

  it('defaults speech detail to full', () => {
    expect(getStoredSpeechDetailSetting()).toBe('full');
  });

  it('stores and retrieves short speech detail setting', () => {
    setStoredSpeechDetailSetting('short');
    expect(getStoredSpeechDetailSetting()).toBe('short');

    setStoredSpeechDetailSetting('full');
    expect(getStoredSpeechDetailSetting()).toBe('full');
  });

  it('resets speech detail setting for testing', () => {
    setStoredSpeechDetailSetting('short');
    expect(getStoredSpeechDetailSetting()).toBe('short');
    _resetSpeechDetailSettingForTesting();
    expect(getStoredSpeechDetailSetting()).toBe('full');
  });

  it('provides i18n translation keys in en, hi, and gu', () => {
    let prevLang = getLang();
    try {
      // English
      setLang('en');
      expect(t('lab.settings.speechDetail')).toBe('Speech detail');
      expect(t('lab.settings.speechDetailFull')).toBe('Full');
      expect(t('lab.settings.speechDetailShort')).toBe('Short');
      expect(t('lab.settings.speechDetailSetFull')).toBe('Speech detail set to full.');
      expect(t('lab.settings.speechDetailSetShort')).toBe('Speech detail set to short.');

      // Hindi
      setLang('hi');
      expect(t('lab.settings.speechDetail')).toBe('वाणी विवरण');
      expect(t('lab.settings.speechDetailFull')).toBe('पूर्ण');
      expect(t('lab.settings.speechDetailShort')).toBe('संक्षिप्त');
      expect(t('lab.settings.speechDetailSetFull')).toBe('वाणी विवरण पूर्ण पर सेट किया गया।');
      expect(t('lab.settings.speechDetailSetShort')).toBe('वाणी विवरण संक्षिप्त पर सेट किया गया।');

      // Gujarati
      setLang('gu');
      expect(t('lab.settings.speechDetail')).toBe('વાણી વિગત');
      expect(t('lab.settings.speechDetailFull')).toBe('સંપૂર્ણ');
      expect(t('lab.settings.speechDetailShort')).toBe('ટૂંકું');
      expect(t('lab.settings.speechDetailSetFull')).toBe('વાણી વિગત સંપૂર્ણ પર સેટ થઈ.');
      expect(t('lab.settings.speechDetailSetShort')).toBe('વાણી વિગત ટૂંકા પર સેટ થઈ.');
    } finally {
      setLang(prevLang);
    }
  });
});
