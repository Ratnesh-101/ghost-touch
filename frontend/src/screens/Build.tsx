/**
 * Ghost Hand Build screen (Requirement 52, task 86).
 *
 * A blind or low-vision STEM student plots their own graph on a fixed 7x9 grid
 * (x 0..6, y 0..8) and feels the result with the Explore haptic engine.
 *
 * Screen contract:
 * - Props: { drivers, onBack }
 * - Root element has data-testid="build-root", data-pins, data-segments, data-mode ("form" | "feel")
 * - Two sliders: x (0..6), y (0..8) with accessible names and aria-valuetext ("x 3", "y 5")
 * - Buttons in order: Pin, Undo, Stitch in order, Feel, Hand in
 * - Feel and Hand in are disabled (aria-disabled) when canFeel/canHandIn is false (0 pins)
 * - Pressing disabled Feel or Hand in speaks build.needPin
 * - No vibrate, setTone, or playEarcon in the form
 * - Feel mounts the unchanged Explore screen with scene, announced (work summary), drivers, onBack
 * - Leaving Feel returns to the form with pins preserved and speaks build.backToForm
 * - Speaks build.feelSmall when Feel canvas scale is under 352 (pinSpacingOk is false)
 * - Hand in speaks build.handin.soon until lane hi14
 */

import { useCallback, useId, useState, type ChangeEvent, type JSX } from 'react';
import type { DiagramScene } from '../core/scene';
import type { Drivers } from '../drivers';
import { canFeel, canHandIn, describeWork, pinSpacingOk, pinsOf } from '../core/pegboard';
import { joinAnnouncements } from '../flow/explore';
import {
  clampX,
  clampY,
  initialBuildHistory,
  initialSliders,
  pressPin,
  pressStitch,
  pressUndo,
  stringifyParams,
  type BuildSliders,
} from '../flow/build';
import { t, tf } from '../i18n';
import { Explore } from './Explore';
import '../styles/build.css';

export interface BuildProps {
  drivers: Drivers;
  onBack: () => void;
}

function buildAnnounced(scene: DiagramScene): string {
  const summary = describeWork(scene);
  const parts = summary.lines.map((l) => tf(l.key, stringifyParams(l.params)));
  return joinAnnouncements(parts);
}

function getCanvasScale(): number {
  if (typeof window !== 'undefined') {
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    if (w > 0 && h > 0) return Math.min(w, h);
    if (w > 0) return w;
  }
  return 400;
}

export function Build({ drivers, onBack }: BuildProps): JSX.Element {
  const [history, setHistory] = useState(initialBuildHistory);
  const [sliders, setSliders] = useState<BuildSliders>(initialSliders);
  const [mode, setMode] = useState<'form' | 'feel'>('form');

  const xId = useId();
  const yId = useId();

  const scene = history.present;
  const pins = pinsOf(scene);
  const pinCount = pins.length;
  const segmentCount = scene.segments?.length ?? 0;
  const hasPins = canFeel(scene);

  const handleXChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = clampX(Number(e.target.value));
    setSliders((prev) => ({ ...prev, x: val }));
  }, []);

  const handleYChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = clampY(Number(e.target.value));
    setSliders((prev) => ({ ...prev, y: val }));
  }, []);

  const handlePin = useCallback(() => {
    const res = pressPin(history, sliders.x, sliders.y);
    setHistory(res.history);
    drivers.speech.speak(tf(res.speech.key, stringifyParams(res.speech.params)));
  }, [history, sliders.x, sliders.y, drivers.speech]);

  const handleUndo = useCallback(() => {
    const res = pressUndo(history);
    setHistory(res.history);
    drivers.speech.speak(tf(res.speech.key, stringifyParams(res.speech.params)));
  }, [history, drivers.speech]);

  const handleStitch = useCallback(() => {
    const res = pressStitch(history);
    setHistory(res.history);
    drivers.speech.speak(tf(res.speech.key, stringifyParams(res.speech.params)));
  }, [history, drivers.speech]);

  const handleFeel = useCallback(() => {
    if (!canFeel(history.present)) {
      drivers.speech.speak(t('build.needPin'));
      return;
    }
    const scale = getCanvasScale();
    if (!pinSpacingOk(scale)) {
      drivers.speech.speak(t('build.feelSmall'));
    }
    setMode('feel');
  }, [history.present, drivers.speech]);

  const handleHandIn = useCallback(() => {
    if (!canHandIn(history.present)) {
      drivers.speech.speak(t('build.needPin'));
      return;
    }
    drivers.speech.speak(t('build.handin.soon'));
  }, [history.present, drivers.speech]);

  const handleFeelBack = useCallback(() => {
    setMode('form');
    drivers.speech.speak(t('build.backToForm'));
  }, [drivers.speech]);

  return (
    <div
      className="gt-build"
      data-testid="build-root"
      data-pins={String(pinCount)}
      data-segments={String(segmentCount)}
      data-mode={mode}
    >
      {mode === 'feel' ? (
        <div className="gt-build__feel-container">
          <Explore
            scene={scene}
            announced={buildAnnounced(scene)}
            drivers={drivers}
            onBack={handleFeelBack}
          />
        </div>
      ) : (
        <div className="gt-build__form">
          <header className="gt-build__header">
            <h1 className="gt-build__title">{t('build.title')}</h1>
            <button
              type="button"
              className="gt-control gt-build__button"
              onClick={onBack}
              aria-label={t('common.back')}
            >
              {t('common.back')}
            </button>
          </header>

          <div className="gt-build__status" aria-live="polite">
            {t('build.prompt')}
          </div>

          <div className="gt-build__sliders">
            <div className="gt-build__slider-group">
              <label htmlFor={xId} className="gt-build__slider-label">
                <span>{t('build.xName')}</span>
                <span className="gt-build__slider-value">x {sliders.x}</span>
              </label>
              <input
                id={xId}
                type="range"
                min="0"
                max="6"
                step="1"
                value={sliders.x}
                aria-label={t('build.xName')}
                aria-valuetext={`x ${sliders.x}`}
                className="gt-control gt-build__slider"
                onChange={handleXChange}
              />
            </div>

            <div className="gt-build__slider-group">
              <label htmlFor={yId} className="gt-build__slider-label">
                <span>{t('build.yName')}</span>
                <span className="gt-build__slider-value">y {sliders.y}</span>
              </label>
              <input
                id={yId}
                type="range"
                min="0"
                max="8"
                step="1"
                value={sliders.y}
                aria-label={t('build.yName')}
                aria-valuetext={`y ${sliders.y}`}
                className="gt-control gt-build__slider"
                onChange={handleYChange}
              />
            </div>
          </div>

          <div className="gt-build__buttons">
            <div className="gt-build__btn-row">
              <button
                type="button"
                className="gt-control gt-build__button gt-build__button--primary"
                onClick={handlePin}
                aria-label={t('build.pin')}
              >
                {t('build.pin')}
              </button>

              <button
                type="button"
                className="gt-control gt-build__button"
                onClick={handleUndo}
                aria-label={t('build.undo')}
              >
                {t('build.undo')}
              </button>

              <button
                type="button"
                className="gt-control gt-build__button"
                onClick={handleStitch}
                aria-label={t('build.stitch')}
              >
                {t('build.stitch')}
              </button>
            </div>

            <div className="gt-build__btn-row">
              <button
                type="button"
                className="gt-control gt-build__button"
                onClick={handleFeel}
                aria-label={t('build.feel')}
                aria-disabled={!hasPins}
              >
                {t('build.feel')}
              </button>

              <button
                type="button"
                className="gt-control gt-build__button"
                onClick={handleHandIn}
                aria-label={t('build.handIn')}
                aria-disabled={!hasPins}
              >
                {t('build.handIn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
