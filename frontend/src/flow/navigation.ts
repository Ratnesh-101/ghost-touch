/**
 * What is spoken when a screen opens. Pure text helpers, shared by App and tests.
 */
import type { DiagramScene } from '../core/scene';
import type { SceneMode } from '../api/scene';
import { t } from '../i18n';

/** Spoken name of a scene: its title, or its kind when it has none. */
export function sceneName(scene: DiagramScene): string {
  const title = scene.title;
  return typeof title === 'string' && title.trim() !== '' ? title : scene.kind;
}

/**
 * Entry announcement for the Explore screen. A Raw Mode scene starts with the
 * exact sentence required by Requirement 8.1.
 */
export function exploreAnnouncement(scene: DiagramScene, mode: SceneMode): string {
  const name = sceneName(scene);
  const hint = `${t('explore.gestureHint')} ${t('explore.backHint')}`;
  return mode === 'raw'
    ? `${t('raw.announce')} ${name}. ${hint}`
    : `${name}. ${hint}`;
}

/** Accessible label for the Explore canvas. */
export function canvasAriaLabel(scene: DiagramScene): string {
  return `${sceneName(scene)}. ${t('explore.gestureHint')}`;
}
