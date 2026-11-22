/**
 * Ghost Hand Build screen (Requirement 52, task 86).
 *
 * A blind or low-vision STEM student plots their own graph on a fixed 7x9 grid
 * (x 0..6, y 0..8) and feels the result with the Explore haptic engine.
 *
 * Screen contract:
 * - Props: { drivers, onBack }
 * - Root element has data-testid="build-root", data-pins, data-segments, data-mode ("form" | "feel")
 * - Two sliders: x (0..6), y (0..8) with accessible names and aria-valuetext ("x 3", "y 5") via build.xValue / build.yValue
 * - Buttons in order: Pin, Undo, Stitch in order, Feel, Hand in
 * - Feel and Hand in are disabled (aria-disabled) when canFeel/canHandIn is false (0 pins)
 * - Pressing disabled Feel or Hand in speaks build.needPin
 * - No vibrate, setTone, or playEarcon in the form
 * - Feel mounts the unchanged Explore screen with scene, announced (work summary), drivers, onBack
 * - Leaving Feel returns to the form with pins preserved and speaks build.backToForm
 * - Speaks build.feelSmall once when Feel canvas scale is under 352 (pinSpacingOk is false), measuring real canvas
 * - Hand in displays hand-in panel with share link, not-checked point list, and Copy button
 */

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type JSX } from 'react';
import type { DiagramScene } from '../core/scene';
import type { Drivers } from '../drivers';
import { canFeel, canHandIn, describeWork, handInList, pinSpacingOk, pinsOf } from '../core/pegboard';
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
import { getLang, LANG_BCP47, t, tf } from '../i18n';
import { copyToClipboard, getShareOrigin } from '../drivers/clipboard';
import { encodeShare, shareUrl, ShareError, type ShareErrorCode } from '../share';
import { shareErrorMessage } from './ShareError';
import { Explore } from './Explore';
import '../styles/build.css';

export interface BuildProps {
  drivers: Drivers;
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onFeelChange?: (feel: boolean) => void;
  onRegisterBackToForm?: (backToForm: () => void) => void;
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

export function Build({
  drivers,
  onBack,
  onDirtyChange,
  onFeelChange,
  onRegisterBackToForm,
}: BuildProps): JSX.Element {
  const [history, setHistory] = useState(initialBuildHistory);
  const [sliders, setSliders] = useState<BuildSliders>(initialSliders);
  const [mode, setMode] = useState<'form' | 'feel'>('form');
  const [showHandIn, setShowHandIn] = useState(false);

  const feelContainerRef = useRef<HTMLDivElement>(null);
  const hasSpokenFeelSmallRef = useRef(false);

  const xId = useId();
  const yId = useId();

  const scene = history.present;
  const pins = pinsOf(scene);
  const pinCount = pins.length;
  const segmentCount = scene.segments?.length ?? 0;
  const hasPins = canFeel(scene);

  useEffect(() => {
    onDirtyChange?.(pinCount > 0);
  }, [pinCount, onDirtyChange]);

  useEffect(() => {
    onFeelChange?.(mode === 'feel');
  }, [mode, onFeelChange]);

  useEffect(() => {
    onRegisterBackToForm?.(() => {
      setMode('form');
    });
  }, [onRegisterBackToForm]);

  // Measure Explore canvas after it mounts in Feel mode and speak build.feelSmall once if scale < 352
  useEffect(() => {
    if (mode !== 'feel') {
      hasSpokenFeelSmallRef.current = false;
      return;
    }

    const checkScale = () => {
      const container = feelContainerRef.current;
      const canvas = container?.querySelector<HTMLCanvasElement>('canvas.gt-explore__canvas');
      let scale = 0;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const w = canvas.clientWidth || rect.width || 0;
        const h = canvas.clientHeight || rect.height || 0;
        if (w > 0 && h > 0) {
          scale = Math.min(w, h);
        } else if (w > 0) {
          scale = w;
        } else if (h > 0) {
          scale = h;
        }
      }
      if (scale === 0) {
        scale = getCanvasScale();
      } else {
        const winScale = getCanvasScale();
        if (winScale > 0) {
          scale = Math.min(scale, winScale);
        }
      }

      if (scale > 0 && !pinSpacingOk(scale) && !hasSpokenFeelSmallRef.current) {
        hasSpokenFeelSmallRef.current = true;
        drivers.speech.speak(t('build.feelSmall'), LANG_BCP47[getLang()]);
      }
    };

    checkScale();
    const rafId = requestAnimationFrame(checkScale);
    return () => cancelAnimationFrame(rafId);
  }, [mode, drivers.speech]);

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
    drivers.speech.speak(tf(res.speech.key, stringifyParams(res.speech.params)), LANG_BCP47[getLang()]);
  }, [history, sliders.x, sliders.y, drivers.speech]);

  const handleUndo = useCallback(() => {
    const res = pressUndo(history);
    setHistory(res.history);
    drivers.speech.speak(tf(res.speech.key, stringifyParams(res.speech.params)), LANG_BCP47[getLang()]);
  }, [history, drivers.speech]);

  const handleStitch = useCallback(() => {
    const res = pressStitch(history);
    setHistory(res.history);
    drivers.speech.speak(tf(res.speech.key, stringifyParams(res.speech.params)), LANG_BCP47[getLang()]);
  }, [history, drivers.speech]);

  const handleFeel = useCallback(() => {
    if (!canFeel(history.present)) {
      drivers.speech.speak(t('build.needPin'), LANG_BCP47[getLang()]);
      return;
    }
    setMode('feel');
  }, [history.present, drivers.speech]);

  const handleHandIn = useCallback(() => {
    if (!canHandIn(history.present)) {
      drivers.speech.speak(t('build.needPin'), LANG_BCP47[getLang()]);
      return;
    }
    try {
      encodeShare({
        v: 1,
        scene: history.present,
        verifiedBy: '',
        note: '',
        verifiedAt: new Date().toISOString(),
      });
      setShowHandIn(true);
      drivers.speech.speak(t('build.handin.soon'), LANG_BCP47[getLang()]);
    } catch (err) {
      const code: ShareErrorCode = err instanceof ShareError ? err.code : 'bad-format';
      drivers.speech.speak(shareErrorMessage(code), LANG_BCP47[getLang()]);
    }
  }, [history.present, drivers.speech]);

  const handleFeelBack = useCallback(() => {
    setMode('form');
    drivers.speech.speak(t('build.backToForm'), LANG_BCP47[getLang()]);
  }, [drivers.speech]);

  let shareLink = '';
  if (canHandIn(scene)) {
    try {
      const encoded = encodeShare({
        v: 1,
        scene,
        verifiedBy: '',
        note: '',
        verifiedAt: new Date().toISOString(),
      });
      shareLink = shareUrl(getShareOrigin(), encoded);
    } catch {
      // handled if encodeShare throws
    }
  }

  const handleCopy = useCallback(async () => {
    const listLines = handInList(scene).map((p) => `${p.id}: ${p.label}`);
    const textToCopy = `${shareLink}\n\n${t('build.handin.notChecked')}\n${listLines.join('\n')}`;
    await copyToClipboard(textToCopy);
    drivers.speech.speak(t('build.handin.copied'), LANG_BCP47[getLang()]);
  }, [scene, shareLink, drivers.speech]);

  return (
    <div
      className="gt-build"
      data-testid="build-root"
      data-pins={String(pinCount)}
      data-segments={String(segmentCount)}
      data-mode={mode}
    >
      {mode === 'feel' ? (
        <div className="gt-build__feel-container" ref={feelContainerRef}>
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
                <span className="gt-build__slider-value">{tf('build.xValue', { n: String(sliders.x) })}</span>
              </label>
              <input
                id={xId}
                type="range"
                min="0"
                max="6"
                step="1"
                value={sliders.x}
                aria-label={t('build.xName')}
                aria-valuetext={tf('build.xValue', { n: String(sliders.x) })}
                className="gt-control gt-build__slider"
                onChange={handleXChange}
              />
            </div>

            <div className="gt-build__slider-group">
              <label htmlFor={yId} className="gt-build__slider-label">
                <span>{t('build.yName')}</span>
                <span className="gt-build__slider-value">{tf('build.yValue', { n: String(sliders.y) })}</span>
              </label>
              <input
                id={yId}
                type="range"
                min="0"
                max="8"
                step="1"
                value={sliders.y}
                aria-label={t('build.yName')}
                aria-valuetext={tf('build.yValue', { n: String(sliders.y) })}
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

          {showHandIn && canHandIn(scene) && (
            <div className="gt-build__handin-panel" data-testid="build-handin-panel">
              <a
                data-testid="build-handin-link"
                href={shareLink}
                className="gt-control gt-build__handin-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {shareLink}
              </a>
              <div
                className="gt-build__handin-text"
                data-testid="build-handin-text"
                tabIndex={0}
                role="region"
                aria-label={t('build.handin.notChecked')}
              >
                <div className="gt-build__handin-heading">{t('build.handin.notChecked')}</div>
                {handInList(scene).map((pin) => (
                  <div key={pin.id} className="gt-build__handin-row">
                    {`${pin.id}: ${pin.label}`}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="gt-control gt-build__button gt-build__copy-btn"
                onClick={handleCopy}
                aria-label={t('build.handin.copy')}
              >
                {t('build.handin.copy')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
