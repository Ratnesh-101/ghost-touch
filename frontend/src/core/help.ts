/**
 * Which gesture sentences the Explore Help button speaks (Requirement 50).
 *
 * Pure, no imports. Returns i18n KEYS only: the wording lives in `i18n/` and the screen joins
 * `t(key)` into one utterance. The keys are in one declared order, so the result is stable.
 */

export const HELP_KEYS = [
  'help.touch',
  'help.back',
  'help.ask',
  'help.guide',
  'help.stop',
  'help.raw',
] as const;

export type HelpKey = (typeof HELP_KEYS)[number];

/** The Help button's own name. */
export const HELP_BUTTON_KEY = 'explore.help';

/** Every i18n key the Help feature needs in en, hi and gu. */
export const HELP_I18N_KEYS: readonly string[] = [HELP_BUTTON_KEY, ...HELP_KEYS];

export interface HelpContext {
  /** The scene is a Raw Mode scene. */
  raw: boolean;
  /** The Guide feature is switched on. */
  guideOn: boolean;
  /** The Ask control is available. */
  askOn: boolean;
}

function on(ctx: unknown, field: keyof HelpContext): boolean {
  return typeof ctx === 'object' && ctx !== null && (ctx as Record<string, unknown>)[field] === true;
}

/** The Help keys for this mode, in declared order. Anything not exactly `true` counts as off. */
export function helpSentences(ctx: HelpContext): HelpKey[] {
  const raw = on(ctx, 'raw');
  const guideOn = on(ctx, 'guideOn');
  const askOn = on(ctx, 'askOn');
  return HELP_KEYS.filter((key) => {
    switch (key) {
      case 'help.ask':
        return askOn;
      case 'help.guide':
      case 'help.stop':
        return guideOn;
      case 'help.raw':
        return raw;
      default:
        return true;
    }
  });
}
