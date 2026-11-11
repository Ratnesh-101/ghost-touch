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
import { useEffect, useRef, useState, useSyncExternalStore, type JSX } from 'react';
import type { DiagramScene } from '../core/scene';
import { orderForDisplay, savedTitle, type SavedDiagram } from '../core/savedDiagrams';
import { confirmDeleteDiagram, deletedAnnouncement, loadSavedList } from '../flow/saved';
import { joinAnnouncements } from '../flow/explore';
import type { DiagramStore } from '../drivers/diagramStore';
import type { SpeechDriver } from '../drivers/speech';
import { AccessibleButton } from '../components/AccessibleButton';
import { Mascot } from '../components/Mascot';
import { StatusText } from '../components/StatusText';
import { getLang, LANG_BCP47, subscribeLang, t, type Lang } from '../i18n';
import '../styles/saved.css';

export interface SavedDiagramsProps {
  diagramStore: DiagramStore;
  speech: SpeechDriver;
  onOpen: (scene: DiagramScene, title: string, id?: string) => void;
  onBack: () => void;
  lang?: Lang;
}

export function SavedDiagrams({
  diagramStore,
  speech,
  onOpen,
  onBack,
  lang: propLang,
}: SavedDiagramsProps): JSX.Element {
  const currentLang = useSyncExternalStore(subscribeLang, getLang, getLang);
  const activeLang: Lang = propLang ?? currentLang;

  const [entries, setEntries] = useState<SavedDiagram[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const activeRef = useRef(true);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const activeLangRef = useRef(activeLang);
  activeLangRef.current = activeLang;

  // Focus screen heading on mount for TalkBack / keyboard focus placement (Finding 8)
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const say = (text: string): void => {
    speech.speak(text, LANG_BCP47[activeLang]);
    setStatus(text);
  };

  // Load entries on mount and announce list or empty status. If the user leaves before the
  // read finishes, the late result must neither speak nor set state (CORE-03).
  useEffect(() => {
    activeRef.current = true;
    let active = true;
    void loadSavedList(diagramStore, () => active && activeRef.current, (view) => {
      setLoading(false);
      setEntries(view.entries);
      if (view.phase === 'list') {
        const lang = activeLangRef.current;
        say(joinAnnouncements(view.entries.map((e) => savedTitle(e.scene, lang))));
      } else {
        say(view.announcement);
      }
    });
    return () => {
      activeRef.current = false;
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpen = (entry: SavedDiagram, title: string): void => {
    const msg = t('saved.opened').replace('{title}', title);
    say(msg);
    onOpen(entry.scene, title, entry.id);
  };

  const handleDeleteRequest = (entry: SavedDiagram, title: string): void => {
    setConfirmingId(entry.id);
    const msg = t('saved.deleteConfirm').replace('{title}', title);
    say(msg);
  };

  const handleCancelDelete = (): void => {
    setConfirmingId(null);
    say(t('saved.cancelled'));
  };

  const handleConfirmDelete = async (entry: SavedDiagram, title: string): Promise<void> => {
    setConfirmingId(null);
    await confirmDeleteDiagram(
      diagramStore,
      entry.id,
      () => activeRef.current,
      () => {
        // One message, spoken once: a state updater must stay pure, and a second `say` would
        // cut the first one off (CORE-07).
        const remaining = entriesRef.current.filter((e) => e.id !== entry.id);
        say(deletedAnnouncement(title, remaining.length));
        setEntries((prev) => orderForDisplay(prev.filter((e) => e.id !== entry.id)));
        // The confirmed Delete button is about to leave the page; keep screen-reader focus here.
        headingRef.current?.focus();
      },
      () => {
        say(t('saved.errorDelete'));
      },
    );
  };

  const handleTogglePin = async (entry: SavedDiagram, title: string): Promise<void> => {
    const updated: SavedDiagram = { ...entry, pinned: !entry.pinned };
    const result = await diagramStore.put(updated);
    if (!result.ok) {
      say(t('saved.errorSave'));
      return;
    }
    const msg = updated.pinned
      ? t('saved.pinned.announced').replace('{title}', title)
      : t('saved.unpinned.announced').replace('{title}', title);
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
          {entries.map((entry) => {
            const title = savedTitle(entry.scene, activeLang);
            const pinLabel = entry.pinned ? t('saved.unpin') : t('saved.pin');
            return (
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
                  <span className="gt-saved__title">{title}</span>
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
                    aria-label={`${t('saved.open')} ${title}`}
                    onClick={() => handleOpen(entry, title)}
                  >
                    {t('saved.open')}
                  </AccessibleButton>

                  <AccessibleButton
                    className="gt-saved__btn gt-saved__btn--pin gt-control"
                    aria-label={`${pinLabel} ${title}`}
                    onClick={() => void handleTogglePin(entry, title)}
                  >
                    {pinLabel}
                  </AccessibleButton>

                  {confirmingId === entry.id ? (
                    <>
                      <AccessibleButton
                        className="gt-saved__btn gt-saved__btn--confirm gt-control"
                        aria-label={`${t('saved.confirmDelete')} ${title}`}
                        onClick={() => void handleConfirmDelete(entry, title)}
                      >
                        {t('saved.confirmDelete')}
                      </AccessibleButton>
                      <AccessibleButton
                        className="gt-saved__btn gt-saved__btn--cancel gt-control"
                        aria-label={`${t('saved.cancel')} ${title}`}
                        onClick={handleCancelDelete}
                      >
                        {t('saved.cancel')}
                      </AccessibleButton>
                    </>
                  ) : (
                    <AccessibleButton
                      className="gt-saved__btn gt-saved__btn--delete gt-control"
                      aria-label={`${t('saved.delete')} ${title}`}
                      onClick={() => handleDeleteRequest(entry, title)}
                    >
                      {t('saved.delete')}
                    </AccessibleButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
