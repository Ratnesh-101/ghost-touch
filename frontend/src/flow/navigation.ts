/**
 * What is spoken when a screen opens. Pure text helpers, shared by App and tests.
 */
import type { DiagramScene } from '../core/scene';
import type { SceneMode } from '../api/scene';
import { verifyScene, getFindingTarget, type VerifyMode } from '../verify/verify';
import { joinAnnouncements } from './explore';
import { t } from '../i18n';

/** Spoken name of a scene: its title, or its kind when it has none. */
export function sceneName(scene: DiagramScene): string {
  const title = scene.title;
  return typeof title === 'string' && title.trim() !== '' ? title : scene.kind;
}

/**
 * Resolves the localized caveat sentence if verifyScene returns 'disagree'.
 * Returns null if status is 'consistent' or 'silent'.
 * SPEC GHOST: never says "verified" or "trust the text".
 */
export function verifyCaveatForScene(
  scene: DiagramScene,
  mode: VerifyMode = 'ai',
): string | null {
  const result = verifyScene(scene, { mode });
  if (result.status === 'disagree' && result.findings.length > 0) {
    const finding = result.findings[0]!;
    const targetName = getFindingTarget(finding);
    return t('verify.disagree').replace('{name}', targetName);
  }
  return null;
}

/**
 * Entry announcement for the Explore screen. A Raw Mode scene starts with the
 * exact sentence required by Requirement 8.1.
 *
 * Runs verifyScene(scene, {mode}) once on entry:
 * - If 'disagree', appends ONE extra sentence localized in en, hi, gu via joinAnnouncements.
 * - If 'consistent' or 'silent', says NOTHING extra.
 */
export function exploreAnnouncement(
  scene: DiagramScene,
  mode: SceneMode | VerifyMode = 'ai',
  verifyMode?: VerifyMode,
): string {
  const name = sceneName(scene);
  const hint = `${t('explore.gestureHint')} ${t('explore.backHint')}`;
  const base =
    mode === 'raw'
      ? `${t('raw.announce')} ${name}. ${hint}`
      : `${name}. ${hint}`;

  const vMode: VerifyMode =
    verifyMode ??
    (mode === 'raw'
      ? 'raw'
      : mode === 'sample'
        ? 'sample'
        : mode === 'shared'
          ? 'shared'
          : 'ai');

  const caveat = verifyCaveatForScene(scene, vMode);
  return caveat ? joinAnnouncements([base, caveat]) : base;
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
  /** An Explore scene exists to return to when leaving Teach. */
  hasScene?: boolean;
}

export interface BackStep {
  next: ScreenName;
  /** i18n key of the sentence to speak on arrival. Never empty. */
  announceKey: string;
  /** The user must confirm first, because leaving would discard their work. */
  needsConfirm: boolean;
}

/**
 * Navigation policy table: where the Back control (Android Back, browser Back,
 * TalkBack Back) leads from `screen`.
 *
 * This function is the application's central policy table for hardware and
 * gesture Back navigation.
 * Total: every screen has a destination and a sentence to speak, so Back is never silent
 * (Requirement 17.1). Leaving the Teacher editor with unsaved changes needs a confirmation.
 */
export function leaveByBack(screen: ScreenName, ctx: BackContext): BackStep {
  switch (screen) {
    case 'teach':
      return ctx.hasScene
        ? { next: 'explore', announceKey: 'explore.gestureHint', needsConfirm: ctx.dirty }
        : { next: 'start', announceKey: 'start.intro', needsConfirm: ctx.dirty };
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

export interface HashBackActions {
  confirm: (msg: string) => boolean;
  speak: (text: string, langBcp47: string) => void;
  restoreHash: () => void;
  focusHeading: () => void;
  onNavigateStart: () => void;
  onNavigateExplore: (scene: DiagramScene, announcement: string) => void;
}

/**
 * Handle Back triggered by hash change (`#/teach` -> `#` or shared link -> `#`).
 *
 * Implements R3-01 and R3-03:
 * - Speaks `teach.confirmLeave` before the confirm dialog.
 * - If confirm is cancelled or suppressed (returns false):
 *   Restores URL hash to `#/teach`, speaks `teach.stayingInEditor`, and refocuses editor heading.
 * - If confirmed or not dirty:
 *   Navigates to Explore with the diagram if an Explore scene exists, otherwise to Start.
 */
export function handleAppHashBack(
  leaving: ScreenName | null,
  ctx: BackContext,
  lastExploreScene: DiagramScene | null | undefined,
  actions: HashBackActions,
  langBcp47: string,
): { stayed: boolean; next?: ScreenName } {
  if (leaving === null) return { stayed: false };

  const step = leaveByBack(leaving, ctx);
  if (step.needsConfirm) {
    actions.speak(t('teach.confirmLeave'), langBcp47);
    const confirmed = actions.confirm(t('teach.confirmLeave'));
    if (!confirmed) {
      actions.restoreHash();
      actions.speak(t('teach.stayingInEditor'), langBcp47);
      actions.focusHeading();
      return { stayed: true };
    }
  }

  if (step.next === 'explore' && lastExploreScene) {
    const scene = lastExploreScene;
    const announced = exploreAnnouncement(scene, 'ai');
    actions.speak(announced, langBcp47);
    actions.onNavigateExplore(scene, announced);
    return { stayed: false, next: 'explore' };
  } else {
    actions.speak(t(step.announceKey), langBcp47);
    actions.onNavigateStart();
    return { stayed: false, next: step.next };
  }
}
