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

/** Every screen the app can show. */
export const SCREEN_NAMES = [
  'start',
  'capture',
  'explore',
  'correct',
  'saved',
  'teach',
  'shareError',
] as const;

export type ScreenName = (typeof SCREEN_NAMES)[number];

export interface BackContext {
  /** The Teacher editor holds changes that were not saved or shared. */
  dirty: boolean;
  /** The Explore screen was opened from a shared link. */
  fromShare: boolean;
}

export interface BackStep {
  next: ScreenName;
  /** i18n key of the sentence to speak on arrival. Never empty. */
  announceKey: string;
  /** The user must confirm first, because leaving would discard their work. */
  needsConfirm: boolean;
}

/**
 * Where the Back control (Android Back, browser Back, TalkBack Back) leads from `screen`.
 *
 * Total: every screen has a destination and a sentence to speak, so Back is never silent
 * (Requirement 17.1). Leaving the Teacher editor with unsaved changes needs a confirmation.
 */
export function leaveByBack(screen: ScreenName, ctx: BackContext): BackStep {
  switch (screen) {
    case 'teach':
      return { next: 'start', announceKey: 'start.intro', needsConfirm: ctx.dirty };
    case 'shareError':
    case 'capture':
    case 'start':
      return { next: 'start', announceKey: 'start.intro', needsConfirm: false };
    case 'explore':
      return ctx.fromShare
        ? { next: 'start', announceKey: 'start.intro', needsConfirm: false }
        : { next: 'capture', announceKey: 'capture.prompt', needsConfirm: false };
    case 'saved':
      return { next: 'capture', announceKey: 'capture.prompt', needsConfirm: false };
    case 'correct':
      return { next: 'explore', announceKey: 'explore.gestureHint', needsConfirm: false };
  }
}
