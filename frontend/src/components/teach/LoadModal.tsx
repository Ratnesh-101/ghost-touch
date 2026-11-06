/**
 * LoadModal — modal dialog to load diagrams into the Teacher Editor.
 *
 * Supports 3 sources:
 * 1. Current Explore/Capture diagram (if provided)
 * 2. Saved diagrams from diagramStore
 * 3. Pasted share link or hash (decoded via decodeShare / loadSceneFromShareInput)
 */

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { AccessibleButton } from '../AccessibleButton';
import type { DiagramScene } from '../../core/scene';
import type { SavedDiagram } from '../../core/savedDiagrams';
import type { Drivers } from '../../drivers';
import { loadSceneFromShareInput } from '../../flow/teach';
import { t } from '../../i18n';

export interface LoadModalProps {
  open: boolean;
  currentScene?: DiagramScene | null;
  drivers: Drivers;
  onClose: () => void;
  onLoadScene: (scene: DiagramScene, sourceTitle: string) => void;
}

export function LoadModal({
  open,
  currentScene,
  drivers,
  onClose,
  onLoadScene,
}: LoadModalProps): JSX.Element | null {
  const [shareInput, setShareInput] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagram[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setShareInput('');
      setShareError(null);
      return;
    }

    closeBtnRef.current?.focus();

    let cancelled = false;
    const fetchSaved = async (): Promise<void> => {
      setIsLoadingSaved(true);
      try {
        const res = await drivers.diagramStore.list();
        if (!cancelled && res.ok) {
          setSavedDiagrams(res.value);
        }
      } catch {
        // storage fetch error
      } finally {
        if (!cancelled) setIsLoadingSaved(false);
      }
    };

    void fetchSaved();

    return () => {
      cancelled = true;
    };
  }, [open, drivers]);

  if (!open) return null;

  const handleShareSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!shareInput.trim()) return;

    const res = loadSceneFromShareInput(shareInput);
    if (res.ok && res.scene) {
      const title = res.scene.title ?? t('teach.loadShareLink');
      onLoadScene(res.scene, title);
      onClose();
    } else {
      setShareError(res.error ?? t('teach.loadError'));
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="gt-teach-modal-overlay" onKeyDown={handleKeyDown}>
      <div
        className="gt-teach-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gt-teach-load-title"
        className="gt-teach-modal"
        tabIndex={-1}
      >
        <header className="gt-teach-modal__header">
          <h2 id="gt-teach-load-title" className="gt-teach-modal__title">
            {t('teach.load')}
          </h2>
          <AccessibleButton
            ref={closeBtnRef}
            type="button"
            className="gt-control gt-btn gt-btn--secondary"
            onClick={onClose}
          >
            {t('teach.closeModal')}
          </AccessibleButton>
        </header>

        <div className="gt-teach-modal__body">
          {/* Source 1: Current Diagram */}
          {currentScene && (
            <section className="gt-teach-modal__section" aria-labelledby="gt-load-current-title">
              <h3 id="gt-load-current-title" className="gt-teach-modal__section-title">
                {t('teach.loadCurrent')}
              </h3>
              <AccessibleButton
                type="button"
                className="gt-control gt-btn gt-btn--secondary gt-teach-modal__item-btn"
                onClick={() => {
                  onLoadScene(currentScene, currentScene.title ?? t('teach.loadCurrent'));
                  onClose();
                }}
              >
                {currentScene.title ?? t('teach.loadCurrent')} ({currentScene.kind})
              </AccessibleButton>
            </section>
          )}

          {/* Source 2: Pasted Share Link */}
          <section className="gt-teach-modal__section" aria-labelledby="gt-load-share-title">
            <h3 id="gt-load-share-title" className="gt-teach-modal__section-title">
              {t('teach.loadShareLink')}
            </h3>
            <form onSubmit={handleShareSubmit} className="gt-teach-modal__share-form">
              <label htmlFor="gt-teach-share-input" className="gt-visually-hidden">
                {t('teach.loadShareLink')}
              </label>
              <input
                id="gt-teach-share-input"
                type="text"
                className="gt-control gt-teach__input"
                value={shareInput}
                onChange={(e) => {
                  setShareInput(e.target.value);
                  setShareError(null);
                }}
                placeholder={t('teach.loadInputPlaceholder')}
              />
              <AccessibleButton
                type="submit"
                className="gt-control gt-btn gt-btn--primary"
                disabled={!shareInput.trim()}
              >
                {t('teach.loadBtn')}
              </AccessibleButton>
            </form>
            {shareError && (
              <p className="gt-teach-modal__error" role="alert">
                {shareError}
              </p>
            )}
          </section>

          {/* Source 3: Saved Diagrams */}
          <section className="gt-teach-modal__section" aria-labelledby="gt-load-saved-title">
            <h3 id="gt-load-saved-title" className="gt-teach-modal__section-title">
              {t('teach.loadSaved')}
            </h3>
            {isLoadingSaved ? (
              <p className="gt-teach-modal__status">{t('capture.reading')}</p>
            ) : savedDiagrams.length === 0 ? (
              <p className="gt-teach-modal__empty">{t('teach.noSavedDiagrams')}</p>
            ) : (
              <ul className="gt-teach-modal__saved-list">
                {savedDiagrams.map((d) => (
                  <li key={d.id} className="gt-teach-modal__saved-item">
                    <AccessibleButton
                      type="button"
                      className="gt-control gt-btn gt-btn--secondary gt-teach-modal__saved-btn"
                      onClick={() => {
                        onLoadScene(d.scene, d.title);
                        onClose();
                      }}
                    >
                      <span className="gt-teach-modal__saved-title">{d.title}</span>
                      <span className="gt-teach-modal__saved-kind">({d.scene.kind})</span>
                    </AccessibleButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
