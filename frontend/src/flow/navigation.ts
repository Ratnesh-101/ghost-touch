/**
 * What is spoken when a screen opens. Pure text helpers, shared by App and tests.
 */
import type { DiagramScene } from '../core/scene';
import type { SceneMode } from '../api/scene';
import { verifyScene, localizedFindingTarget, type VerifyMode } from '../core/verify';
import { joinAnnouncements } from './explore';
import { buildOverview } from './overview';
import { sanitizeShareTitle } from './share';
import { t, tf } from '../i18n';

/** Words an angle's vertex in the active language ("angle B", "कोण B", "ખૂણા B"). M4-10. */
export function spokenAngleName(vertex: string): string {
  return tf('verify.angleName', { vertex });
}

/** Localized label for a scene kind (geometry, function_graph, bar_chart, unknown). */
export function localizedSceneKind(kind: string): string {
  switch (kind) {
    case 'geometry':
      return t('kind.geometry');
    case 'function_graph':
      return t('kind.function_graph');
    case 'bar_chart':
      return t('kind.bar_chart');
    default:
      return t('kind.unknown');
  }
}

/** Spoken name of a scene: its title, or its kind when it has none. */
export function sceneName(scene: DiagramScene): string {
  const title = scene.title;
  return typeof title === 'string' && title.trim() !== ''
    ? title
    : localizedSceneKind(scene.kind);
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
    const targetName = localizedFindingTarget(finding, spokenAngleName);
    return tf('verify.disagree', { name: targetName });
  }
  return null;
}

/** Closed union of supported Raw Mode fallback reasons. */
export type RawReason = 'timeout' | 'budget' | 'provider' | 'unreadable';

export const RAW_REASONS: readonly RawReason[] = [
  'timeout',
  'budget',
  'provider',
  'unreadable',
] as const;

/**
 * Maps arbitrary server strings or raw reason indicators to the closed union
 * ('timeout' | 'budget' | 'provider' | 'unreadable'). Any unknown or missing reason
 * maps to 'unreadable'.
 */
export function mapRawReason(serverReason?: string | null): RawReason {
  if (typeof serverReason !== 'string') {
    return 'unreadable';
  }
  const s = serverReason.trim().toLowerCase();
  if (s === 'timeout' || s.includes('timeout')) {
    return 'timeout';
  }
  if (s === 'budget' || s.includes('budget')) {
    return 'budget';
  }
  if (s === 'provider' || s.includes('provider')) {
    return 'provider';
  }
  return 'unreadable';
}

/**
 * Localized guidance sentence for the closed union RawReason.
 * Never speaks the raw server string.
 */
export function rawReasonSentence(reason?: RawReason | string | null): string {
  const mapped = mapRawReason(reason);
  return t(`raw.reason.${mapped}`);
}

export interface ExploreAnnouncementOptions {
  honestTitle?: boolean;
  rawReason?: RawReason | string;
}

/**
 * Entry announcement for the Explore screen. A Raw Mode scene starts with the
 * exact sentence required by Requirement 8.1, followed immediately by guidance
 * on what the user should do next based on the reason.
 *
 * Runs verifyScene(scene, {mode}) once on entry:
 * - If 'disagree', appends ONE extra sentence localized in en, hi, gu via joinAnnouncements.
 * - If 'consistent' or 'silent', says NOTHING extra.
 */
export function exploreAnnouncement(
  scene: DiagramScene,
  mode: SceneMode | VerifyMode = 'ai',
  verifyMode?: VerifyMode,
  options?: ExploreAnnouncementOptions,
  rawReason?: RawReason | string,
): string {
  const isShared = mode === 'shared' || verifyMode === 'shared';
  const rawTitle = scene.title;
  let name: string;
  if (
    options?.honestTitle &&
    isShared &&
    typeof rawTitle === 'string' &&
    rawTitle.trim() !== ''
  ) {
    const clean = sanitizeShareTitle(rawTitle);
    name =
      clean !== ''
        ? t('share.titlePrefix').replace('{title}', () => clean)
        : localizedSceneKind(scene.kind);
  } else {
    name = sceneName(scene);
  }
  const hint = `${t('explore.gestureHint')} ${t('explore.backHint')}`;
  const isRaw = mode === 'raw' || scene.kind === 'unknown';
  const overview = isRaw ? '' : buildOverview(scene, name);
  const lead = overview.length > 0 ? overview : name;

  const resolvedRawReason = rawReason ?? options?.rawReason;

  const base =
    mode === 'raw'
      ? joinAnnouncements([
          t('raw.announce'),
          rawReasonSentence(resolvedRawReason),
          `${name}. ${hint}`,
        ])
      : joinAnnouncements([lead, hint]);

  const vMode: VerifyMode =
    verifyMode &&
    (verifyMode === 'ai' ||
      verifyMode === 'raw' ||
      verifyMode === 'sample' ||
      verifyMode === 'shared')
      ? verifyMode
      : mode === 'raw'
        ? 'raw'
        : mode === 'sample'
          ? 'sample'
          : mode === 'shared'
            ? 'shared'
            : 'ai';

  const caveat = verifyCaveatForScene(scene, vMode);
  return caveat ? joinAnnouncements([base, caveat]) : base;
}

/** Pure text builder for Explore entry announcement; alias for exploreAnnouncement. */
export const buildEntryAnnouncement = exploreAnnouncement;

/** Accessible label for the Explore canvas (the text TalkBack reads). */
export function canvasAriaLabel(scene: DiagramScene): string {
  return `${sceneName(scene)}. ${t('explore.gestureHintTalkBack')}`;
}

/** Accessible description for the Explore canvas (the text TalkBack reads). */
export function canvasAriaDescription(scene?: DiagramScene): string {
  return scene
    ? `${sceneName(scene)}. ${t('explore.gestureHintTalkBack')}`
    : t('explore.gestureHintTalkBack');
}

export const SCREEN_NAMES = [
  'start',
  'capture',
  'explore',
  'correct',
  'saved',
  'teach',
  'shareError',
  'shareGate',
  'build',
] as const;

/** Every screen the app can show. */
export type ScreenName = (typeof SCREEN_NAMES)[number];

export interface BackContext {
  /** The Teacher editor holds changes that were not saved or shared. */
  dirty: boolean;
  /** The Correct screen holds corrections that were not saved. Default false. */
  correctDirty?: boolean;
  /** The Explore screen was opened from a shared link. */
  fromShare: boolean;
  /** An Explore scene exists to return to when leaving Teach. */
  hasScene?: boolean;
  /** The Build screen draft holds at least one placed pin. Default false. */
  buildDirty?: boolean;
  /** The Build screen is currently in Feel mode. Default false. */
  buildFeel?: boolean;
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
  const needsConfirm =
    (screen === 'teach' && ctx.dirty) ||
    (screen === 'correct' && ctx.correctDirty === true) ||
    (screen === 'build' && !ctx.buildFeel && Boolean(ctx.buildDirty));
  switch (screen) {
    case 'build':
      return ctx.buildFeel
        ? { next: 'build', announceKey: 'build.backToForm', needsConfirm: false }
        : { next: 'capture', announceKey: 'capture.prompt', needsConfirm };
    case 'teach':
      return ctx.hasScene
        ? { next: 'explore', announceKey: 'explore.gestureHint', needsConfirm }
        : { next: 'start', announceKey: 'start.intro', needsConfirm };
    case 'shareError':
    case 'shareGate':
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
      return { next: 'explore', announceKey: 'explore.gestureHint', needsConfirm };
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
    const confirmKey =
      leaving === 'correct'
        ? 'correct.confirmLeave'
        : leaving === 'build'
          ? 'build.leaveConfirm'
          : 'teach.confirmLeave';
    const stayKey =
      leaving === 'correct'
        ? 'correct.stayingInEditor'
        : leaving === 'build'
          ? 'build.prompt'
          : 'teach.stayingInEditor';
    actions.speak(t(confirmKey), langBcp47);
    const confirmed = actions.confirm(t(confirmKey));
    if (!confirmed) {
      actions.restoreHash();
      actions.speak(t(stayKey), langBcp47);
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
