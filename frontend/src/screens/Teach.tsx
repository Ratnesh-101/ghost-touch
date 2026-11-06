/**
 * Teach screen — sighted teacher mode for creating, editing, verifying, and sharing STEM diagrams.
 *
 * Requirements:
 * - Route: #/teach (gated by VITE_FEATURE_SHARE === '1' and teacher tools setting)
 * - Load scene from: current explore scene, saved diagram, or pasted share link (decodeShare)
 * - Edit: add/move/delete vertices, rename labels, undo/redo, live preview canvas
 * - If kind === 'function_graph': fields for axis ranges (x_axis_y, y_axis_x) validated to [0,1] or empty
 * - Every edit runs through validateShareScene; shows plain-language errors; "Mark verified" disabled until valid
 * - Verify form: teacher name (required, <=60), note (optional, <=280), verifiedAt = now ISO
 * - Honest copy: "Verified means a person reviewed this diagram. It is not cryptographic proof." (i18n en/hi/gu)
 * - Share panel: generated link, Copy link, Share (Web Share API only when available), QR via qrDataUrl when fits,
 *   else "Link too long for a QR code; use Copy link", size in chars
 * - Spoken confirmations for state changes ("Link copied", etc.)
 * - 48x48 px minimum touch targets, accessible names, works at 390 px and 1440 px
 */

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX,
} from 'react';
import { AccessibleButton } from '../components/AccessibleButton';
import { StatusText } from '../components/StatusText';
import { TeachCanvas } from '../components/teach/TeachCanvas';
import { VerifyForm } from '../components/teach/VerifyForm';
import { SharePanel } from '../components/teach/SharePanel';
import { LoadModal } from '../components/teach/LoadModal';
import type { DiagramScene } from '../core/scene';
import type { Drivers } from '../drivers';
import { getShareOrigin } from '../drivers/clipboard';
import {
  addVertex,
  applyEdit,
  canRedo,
  canUndo,
  createHistory,
  createSharePayload,
  deletePoint,
  deleteSegment,
  movePoint,
  nudgeVertex,
  redo,
  renameLabel,
  undo,
  updateSceneAxes,
  validateAxisCoord,
  type HistoryState,
} from '../flow/teach';
import {
  getSelectedLabel,
  getSelectionAnnouncement,
  type CorrectSelection,
} from '../flow/correct';
import {
  encodeShare,
  qrDataUrl,
  shareUrl,
} from '../share';
import { validateShareScene } from '../share/validate';
import { getLang, LANG_BCP47, t } from '../i18n';
import '../styles/teach.css';

export interface TeachProps {
  initialScene?: DiagramScene;
  currentExploreScene?: DiagramScene | null;
  drivers: Drivers;
  onBack: () => void;
}

const DEFAULT_SCENE: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Geometry Diagram',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.5, y: 0.2, label: 'C' },
  ],
  segments: [
    { id: 's_ab', a: 'A', b: 'B', label: 'AB' },
    { id: 's_bc', a: 'B', b: 'C', label: 'BC' },
    { id: 's_ca', a: 'C', b: 'A', label: 'CA' },
  ],
};

export function Teach({
  initialScene,
  currentExploreScene,
  drivers,
  onBack,
}: TeachProps): JSX.Element {
  const [history, setHistory] = useState<HistoryState>(() =>
    createHistory(initialScene ?? DEFAULT_SCENE),
  );
  const [selection, setSelection] = useState<CorrectSelection>(null);
  const [labelText, setLabelText] = useState('');
  const [statusMessage, setStatusMessage] = useState(() => t('teach.intro'));
  const [hasError, setHasError] = useState(false);

  // Function graph axes state
  const [axisX, setAxisX] = useState<string>(() =>
    history.present.axes?.y_axis_x != null ? String(history.present.axes.y_axis_x) : '',
  );
  const [axisY, setAxisY] = useState<string>(() =>
    history.present.axes?.x_axis_y != null ? String(history.present.axes.x_axis_y) : '',
  );
  const [axisError, setAxisError] = useState<string | null>(null);

  // Verification & Share state
  const [teacherName, setTeacherName] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const [shareData, setShareData] = useState<{ url: string; qrUrl: string | null } | null>(null);

  // Load modal state
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);

  const speak = (text: string): void => {
    drivers.speech.speak(text, LANG_BCP47[getLang()]);
  };

  const sayAndStatus = (text: string, isErr = false): void => {
    setHasError(isErr);
    setStatusMessage(text);
    speak(text);
  };

  // Announce intro on mount and move focus to heading
  useEffect(() => {
    headingRef.current?.focus();
    speak(t('teach.intro'));
  }, []);

  // Sync label input when selection changes
  useEffect(() => {
    if (selection) {
      setLabelText(getSelectedLabel(history.present, selection));
    } else {
      setLabelText('');
    }
  }, [selection, history.present]);

  // Sync axis inputs when scene changes
  useEffect(() => {
    if (history.present.kind === 'function_graph') {
      const curAxes = history.present.axes;
      setAxisX(curAxes?.y_axis_x != null ? String(curAxes.y_axis_x) : '');
      setAxisY(curAxes?.x_axis_y != null ? String(curAxes.x_axis_y) : '');
      setAxisError(null);
    }
  }, [history.present]);

  // Clear share panel when scene edits occur
  const applySceneEdit = (updated: DiagramScene): void => {
    setHistory((h) => applyEdit(h, updated));
    setShareData(null);
  };

  // Check validation on current scene
  const validationResult = validateShareScene(history.present);
  const isValidDiagram = validationResult.ok;

  // Handlers for canvas interactions
  const handleSelect = (sel: CorrectSelection): void => {
    setSelection(sel);
    if (sel) {
      const announcement = getSelectionAnnouncement(history.present, sel);
      sayAndStatus(announcement);
    } else {
      sayAndStatus(t('teach.noSelection'));
    }
  };

  const handleMovePoint = (pointId: string, x: number, y: number): void => {
    const updated = movePoint(history.present, pointId, x, y);
    if (updated !== history.present) {
      applySceneEdit(updated);
      sayAndStatus(t('teach.vertexMoved').replace('{id}', pointId));
    }
  };

  const handleNudgePoint = (pointId: string, dx: number, dy: number): void => {
    const updated = nudgeVertex(history.present, pointId, dx, dy);
    applySceneEdit(updated);
    sayAndStatus(t('teach.vertexMoved').replace('{id}', pointId));
  };

  const handleAddVertex = (): void => {
    const { scene: updated, newPointId } = addVertex(history.present);
    applySceneEdit(updated);
    setSelection({ kind: 'point', id: newPointId });
    sayAndStatus(t('teach.vertexAdded').replace('{id}', newPointId));
  };

  const handleDeleteSelected = (): void => {
    if (!selection) return;

    if (selection.kind === 'point') {
      const id = selection.id;
      const updated = deletePoint(history.present, id);
      applySceneEdit(updated);
      setSelection(null);
      sayAndStatus(`${t('teach.delete')}: ${id}`);
    } else if (selection.kind === 'segment') {
      const id = selection.id;
      const updated = deleteSegment(history.present, id);
      applySceneEdit(updated);
      setSelection(null);
      sayAndStatus(`${t('teach.delete')}: ${id}`);
    }
  };

  const handleUndo = (): void => {
    if (!canUndo(history)) return;
    setHistory((h) => undo(h));
    setSelection(null);
    setShareData(null);
    sayAndStatus(t('teach.undo'));
  };

  const handleRedo = (): void => {
    if (!canRedo(history)) return;
    setHistory((h) => redo(h));
    setSelection(null);
    setShareData(null);
    sayAndStatus(t('teach.redo'));
  };

  const handleLabelSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!selection) return;

    const trimmed = labelText.trim();
    if (!trimmed) {
      sayAndStatus(t('teach.labelEmpty'), true);
      return;
    }

    try {
      const updated = renameLabel(history.present, selection.id, trimmed);
      applySceneEdit(updated);
      sayAndStatus(t('teach.labelUpdated'));
    } catch {
      sayAndStatus(t('teach.labelEmpty'), true);
    }
  };

  const handleAxisChange = (
    newXAxisYStr: string,
    newYAxisXStr: string,
  ): void => {
    setAxisY(newXAxisYStr);
    setAxisX(newYAxisXStr);

    const valY = validateAxisCoord(newXAxisYStr);
    const valX = validateAxisCoord(newYAxisXStr);

    if (!valY.ok || !valX.ok) {
      const err = valY.error ?? valX.error ?? t('teach.axisInvalid');
      setAxisError(err);
      return;
    }

    setAxisError(null);
    const updated = updateSceneAxes(history.present, valY.num, valX.num);
    applySceneEdit(updated);
  };

  const handleVerify = async (): Promise<void> => {
    try {
      const payload = createSharePayload(
        history.present,
        teacherName,
        teacherNote,
        new Date().toISOString(),
      );
      const encoded = encodeShare(payload);
      const origin = getShareOrigin();
      const url = shareUrl(origin, encoded);
      const qrUrl = await qrDataUrl(url);

      setShareData({ url, qrUrl });
      sayAndStatus(t('teach.verifiedSuccess'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      sayAndStatus(message, true);
    }
  };

  const handleLoadScene = (newScene: DiagramScene, sourceTitle: string): void => {
    setHistory(createHistory(newScene));
    setSelection(null);
    setShareData(null);
    const msg = t('teach.loadedSuccess').replace('{title}', sourceTitle);
    sayAndStatus(msg);
  };

  return (
    <main className="gt-teach">
      {/* Header */}
      <header className="gt-teach__header">
        <h1 className="gt-teach__title" tabIndex={-1} ref={headingRef}>
          {t('teach.title')}
        </h1>
        <div className="gt-teach__header-actions">
          <AccessibleButton
            type="button"
            className="gt-control gt-btn gt-btn--secondary"
            onClick={() => setIsLoadModalOpen(true)}
          >
            {t('teach.load')}
          </AccessibleButton>
          <AccessibleButton
            type="button"
            className="gt-control gt-btn gt-btn--secondary"
            onClick={onBack}
          >
            {t('teach.back')}
          </AccessibleButton>
        </div>
      </header>

      {/* Spoken & visual status card */}
      <div className="gt-teach__status-card">
        <StatusText
          className={`gt-teach__status ${hasError ? 'gt-teach__status--error' : ''}`}
          spoken={drivers.speech.canSpeak}
        >
          {statusMessage}
        </StatusText>
      </div>

      {/* Validation status banner */}
      <div
        className={`gt-teach__validation-banner ${
          isValidDiagram
            ? 'gt-teach__validation-banner--valid'
            : 'gt-teach__validation-banner--invalid'
        }`}
        role="status"
      >
        {isValidDiagram
          ? t('teach.validDiagram')
          : t('teach.invalidDiagram').replace(
              '{errors}',
              validationResult.ok ? '' : validationResult.errors.join('; '),
            )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="gt-teach__layout">
        {/* Left Column: Canvas and Editing Controls */}
        <div className="gt-teach__left-col">
          <TeachCanvas
            scene={history.present}
            selection={selection}
            onSelect={handleSelect}
            onMovePoint={handleMovePoint}
            onNudgePoint={handleNudgePoint}
            onDeleteSelected={handleDeleteSelected}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />

          {/* Action Toolbar */}
          <div className="gt-teach__toolbar" role="toolbar" aria-label="Editing toolbar">
            <AccessibleButton
              type="button"
              className="gt-control gt-btn gt-btn--secondary"
              onClick={handleAddVertex}
            >
              {t('teach.addVertex')}
            </AccessibleButton>

            <AccessibleButton
              type="button"
              className="gt-control gt-btn gt-btn--danger"
              onClick={handleDeleteSelected}
              disabled={!selection}
            >
              {t('teach.delete')}
            </AccessibleButton>

            <AccessibleButton
              type="button"
              className="gt-control gt-btn gt-btn--secondary"
              onClick={handleUndo}
              disabled={!canUndo(history)}
            >
              {t('teach.undo')}
            </AccessibleButton>

            <AccessibleButton
              type="button"
              className="gt-control gt-btn gt-btn--secondary"
              onClick={handleRedo}
              disabled={!canRedo(history)}
            >
              {t('teach.redo')}
            </AccessibleButton>
          </div>

          {/* Label Edit Panel */}
          {selection && (
            <section className="gt-teach__edit-panel" aria-label={t('teach.label')}>
              <h2 className="gt-teach__panel-title">{t('teach.label')}</h2>
              <form className="gt-teach__label-form" onSubmit={handleLabelSubmit}>
                <label htmlFor="gt-teach-label-input" className="gt-visually-hidden">
                  {t('teach.label')}
                </label>
                <input
                  id="gt-teach-label-input"
                  type="text"
                  className="gt-control gt-teach__input"
                  value={labelText}
                  onChange={(e) => setLabelText(e.target.value)}
                  placeholder={t('teach.label')}
                  maxLength={60}
                />
                <AccessibleButton
                  type="submit"
                  className="gt-control gt-btn gt-btn--primary"
                  disabled={!labelText.trim()}
                >
                  {t('teach.applyLabel')}
                </AccessibleButton>
              </form>
            </section>
          )}

          {/* Function Graph Axis Ranges (function_graph only) */}
          {history.present.kind === 'function_graph' && (
            <section className="gt-teach__axis-panel" aria-labelledby="gt-teach-axis-title">
              <h2 id="gt-teach-axis-title" className="gt-teach__panel-title">
                {t('teach.axisRanges')}
              </h2>
              <div className="gt-teach__axis-grid">
                <div className="gt-teach__field">
                  <label htmlFor="gt-teach-axis-y" className="gt-teach__field-label">
                    {t('teach.xAxisY')}
                  </label>
                  <input
                    id="gt-teach-axis-y"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="gt-control gt-teach__input"
                    value={axisY}
                    onChange={(e) => handleAxisChange(e.target.value, axisX)}
                    placeholder="0.5"
                  />
                </div>
                <div className="gt-teach__field">
                  <label htmlFor="gt-teach-axis-x" className="gt-teach__field-label">
                    {t('teach.yAxisX')}
                  </label>
                  <input
                    id="gt-teach-axis-x"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="gt-control gt-teach__input"
                    value={axisX}
                    onChange={(e) => handleAxisChange(axisY, e.target.value)}
                    placeholder="0.5"
                  />
                </div>
              </div>
              {axisError && (
                <p className="gt-teach-modal__error" role="alert">
                  {axisError}
                </p>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Verify Form and Share Presentation */}
        <div className="gt-teach__right-col">
          <VerifyForm
            name={teacherName}
            note={teacherNote}
            isValidDiagram={isValidDiagram}
            onNameChange={setTeacherName}
            onNoteChange={setTeacherNote}
            onVerify={() => void handleVerify()}
          />

          {shareData && (
            <SharePanel
              url={shareData.url}
              qrUrl={shareData.qrUrl}
              onSpeak={speak}
              diagramTitle={history.present.title}
            />
          )}
        </div>
      </div>

      {/* Load Modal */}
      <LoadModal
        open={isLoadModalOpen}
        currentScene={currentExploreScene}
        drivers={drivers}
        onClose={() => setIsLoadModalOpen(false)}
        onLoadScene={handleLoadScene}
      />
    </main>
  );
}
