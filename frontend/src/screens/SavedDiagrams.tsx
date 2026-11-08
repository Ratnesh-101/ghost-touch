/**
 * SavedDiagrams screen — list, open, pin, and delete locally-saved diagrams.
 *
 * Reachable from Capture via the "Saved diagrams" button. Opening a saved
 * diagram goes straight to Explore without a network call (Requirement 11.2,
 * 11.4). Every string goes through t(). Every control is ≥ 48×48 px via
 * `.gt-control` (Requirement 12.1).
 *
 * Pure decisions (ordering, eviction) live in `core/savedDiagrams.ts`.
 * Storage access lives in the injected `DiagramStore` driver.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { DiagramScene } from '../core/scene';
import { orderForDisplay, type SavedDiagram } from '../core/savedDiagrams';
import { deletedAnnouncement, loadSavedList } from '../flow/saved';
import type { DiagramStore } from '../drivers/diagramStore';
import type { SpeechDriver } from '../drivers/speech';
import { AccessibleButton } from '../components/AccessibleButton';
import { Mascot } from '../components/Mascot';
import { StatusText } from '../components/StatusText';
import { getLang, LANG_BCP47, t } from '../i18n';
import '../styles/saved.css';

export interface SavedDiagramsProps {
  diagramStore: DiagramStore;
  speech: SpeechDriver;
  onOpen: (scene: DiagramScene, title: string) => void;
  onBack: () => void;
}

export function SavedDiagrams({
  diagramStore,
  speech,
  onOpen,
  onBack,
}: SavedDiagramsProps): JSX.Element {
  const [entries, setEntries] = useState<SavedDiagram[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus screen heading on mount for TalkBack / keyboard focus placement (Finding 8)
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const say = (text: string): void => {
    speech.speak(text, LANG_BCP47[getLang()]);
    setStatus(text);
  };

  // Load entries on mount and announce list or empty status. If the user leaves before the
  // read finishes, the late result must neither speak nor set state (CORE-03).
  useEffect(() => {
    let active = true;
    void loadSavedList(diagramStore, () => active, (view) => {
      setLoading(false);
      setEntries(view.entries);
      say(view.announcement);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpen = (entry: SavedDiagram): void => {
    const msg = t('saved.opened').replace('{title}', entry.title);
    say(msg);
    onOpen(entry.scene, entry.title);
  };

  const handleDeleteRequest = (entry: SavedDiagram): void => {
    setConfirmingId(entry.id);
    const msg = t('saved.deleteConfirm').replace('{title}', entry.title);
    say(msg);
  };

  const handleCancelDelete = (): void => {
    setConfirmingId(null);
    say(t('saved.cancelled'));
  };

  const handleConfirmDelete = async (entry: SavedDiagram): Promise<void> => {
    setConfirmingId(null);
    const result = await diagramStore.delete(entry.id);
    if (!result.ok) {
      say(t('saved.errorDelete'));
      return;
    }
    // One message, spoken once: a state updater must stay pure, and a second `say` would
    // cut the first one off (CORE-07).
    const next = orderForDisplay(entries.filter((e) => e.id !== entry.id));
    say(deletedAnnouncement(entry.title, next.length));
    setEntries(next);
    // The confirmed Delete button is about to leave the page; keep screen-reader focus here.
    headingRef.current?.focus();
  };

  const handleTogglePin = async (entry: SavedDiagram): Promise<void> => {
    const updated: SavedDiagram = { ...entry, pinned: !entry.pinned };
    const result = await diagramStore.put(updated);
    if (!result.ok) {
      say(t('saved.errorSave'));
      return;
    }
    const msg = updated.pinned
      ? t('saved.pinned.announced').replace('{title}', entry.title)
      : t('saved.unpinned.announced').replace('{title}', entry.title);
    say(msg);
    setEntries((prev) =>
      orderForDisplay(prev.map((e) => (e.id === entry.id ? updated : e))),
    );
  };

  return (
    <main className="gt-saved">
      <header className="gt-saved__header">
        <h1 className="gt-saved__heading" tabIndex={-1} ref={headingRef}>{t('saved.heading')}</h1>
        <AccessibleButton
          className="gt-saved__back gt-control"
          aria-label={t('saved.back')}
          onClick={onBack}
        >
          {t('saved.back')}
        </AccessibleButton>
      </header>

      <div className="gt-saved__status-row">
        <StatusText className="gt-saved__status" spoken={speech.canSpeak}>
          {status}
        </StatusText>
      </div>

      {loading ? null : entries.length === 0 ? (
        <div className="gt-saved__empty-state">
          <Mascot className="gt-saved__mascot" size={96} />
          <p className="gt-saved__empty">{t('saved.empty')}</p>
        </div>
      ) : (
        <ul className="gt-saved__list" role="list">
          {entries.map((entry) => (
            <li key={entry.id} className="gt-saved__item">
              {/* Thumbnail */}
              {entry.thumbnailDataUrl ? (
                <img
                  src={entry.thumbnailDataUrl}
                  alt=""
                  aria-hidden="true"
                  className="gt-saved__thumb"
                />
              ) : null}

              {/* Title + pin badge */}
              <div className="gt-saved__title-row">
                <span className="gt-saved__title">{entry.title}</span>
                {entry.pinned && (
                  <span
                    className="gt-saved__pin-badge"
                    aria-label={t('saved.pinned')}
                    role="img"
                  >
                    📌
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="gt-saved__controls">
                <AccessibleButton
                  className="gt-saved__btn gt-saved__btn--open gt-control"
                  aria-label={`${t('saved.open')} ${entry.title}`}
                  onClick={() => handleOpen(entry)}
                >
                  {t('saved.open')}
                </AccessibleButton>

                <AccessibleButton
                  className="gt-saved__btn gt-saved__btn--pin gt-control"
                  aria-label={`${entry.pinned ? t('saved.unpin') : t('saved.pin')} ${entry.title}`}
                  onClick={() => void handleTogglePin(entry)}
                >
                  {entry.pinned ? t('saved.unpin') : t('saved.pin')}
                </AccessibleButton>

                {confirmingId === entry.id ? (
                  <>
                    <AccessibleButton
                      className="gt-saved__btn gt-saved__btn--confirm gt-control"
                      aria-label={`${t('saved.confirmDelete')} ${entry.title}`}
                      onClick={() => void handleConfirmDelete(entry)}
                    >
                      {t('saved.confirmDelete')}
                    </AccessibleButton>
                    <AccessibleButton
                      className="gt-saved__btn gt-saved__btn--cancel gt-control"
                      aria-label={`${t('saved.cancel')} ${entry.title}`}
                      onClick={handleCancelDelete}
                    >
                      {t('saved.cancel')}
                    </AccessibleButton>
                  </>
                ) : (
                  <AccessibleButton
                    className="gt-saved__btn gt-saved__btn--delete gt-control"
                    aria-label={`${t('saved.delete')} ${entry.title}`}
                    onClick={() => handleDeleteRequest(entry)}
                  >
                    {t('saved.delete')}
                  </AccessibleButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
