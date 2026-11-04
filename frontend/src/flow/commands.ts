/**
 * Explore screen pure voice command parser and executor.
 *
 * Supports commands in English, Hindi, and Gujarati:
 * - "where am I" (nearest labelled vertex/line + coarse position)
 * - "repeat" (last spoken line)
 * - "next corner" (move to / announce the next vertex by index)
 * - "describe" (read scene name + facts)
 * - "help" (list commands)
 * - "faster" / "slower" / "normal speed" (speech rate setting)
 *
 * All functions are pure and use scene data and geometry public exports only.
 */

import { toScreen, type NormPoint, type ScreenPoint, type Viewport } from '../core/geometry';
import type { DiagramScene, Point } from '../core/scene';
import type { SpeechRateSetting } from '../drivers/speech';
import { t } from '../i18n';

export type CommandType =
  | 'where_am_i'
  | 'repeat'
  | 'next_corner'
  | 'describe'
  | 'help'
  | 'set_rate'
  | 'unknown';

export interface ParsedCommand {
  readonly type: CommandType;
  readonly raw: string;
  readonly rateSetting?: SpeechRateSetting;
}

export interface ExploreCommandContext {
  readonly scene: DiagramScene;
  readonly view: Viewport;
  readonly cursorNorm: NormPoint | null;
  readonly lastSpoken: string;
  readonly currentCornerIndex: number;
  readonly currentRate: SpeechRateSetting;
}

export interface ExploreCommandResult {
  readonly speech: string;
  readonly nextCornerIndex?: number;
  readonly nextCursor?: ScreenPoint;
  readonly nextRate?: SpeechRateSetting;
  readonly earcon?: 'success' | 'error' | 'listening' | 'start' | 'back';
}

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?।]/g, '')
    .replace(/\s+/g, ' ');
}

/** Pure parser for voice commands supporting English, Hindi, and Gujarati. */
export function parseExploreCommand(transcript: string): ParsedCommand {
  const norm = normalizeInput(transcript);

  // 1. Where am I
  if (
    // English
    norm === 'where am i' ||
    norm === 'where am i now' ||
    norm === 'where i am' ||
    norm === 'my position' ||
    norm === 'my location' ||
    norm === 'location' ||
    norm === 'what is here' ||
    norm === "what's here" ||
    norm.startsWith('where am i') ||
    // Hindi
    norm === 'कहाँ हूँ मैं' ||
    norm === 'कहाँ हूँ' ||
    norm === 'मैं कहाँ हूँ' ||
    norm === 'मेरी स्थिति' ||
    norm === 'यहाँ क्या है' ||
    norm.includes('कहाँ हूँ') ||
    norm.includes('kahan hoon') ||
    norm.includes('kahan hu') ||
    // Gujarati
    norm === 'હું ક્યાં છું' ||
    norm === 'ક્યાં છું' ||
    norm === 'મારી જગ્યા' ||
    norm === 'અહીં શું છે' ||
    norm.includes('ક્યાં છું') ||
    norm.includes('kya chu')
  ) {
    return { type: 'where_am_i', raw: transcript };
  }

  // 2. Repeat
  if (
    // English
    norm === 'repeat' ||
    norm === 'say again' ||
    norm === 'repeat that' ||
    norm === 'what did you say' ||
    norm === 'again' ||
    norm === 'repeat last' ||
    norm.startsWith('repeat') ||
    // Hindi
    norm === 'दोहराएं' ||
    norm === 'फिर से बोलो' ||
    norm === 'फिर बोलो' ||
    norm === 'क्या कहा' ||
    norm === 'दोबारा' ||
    norm.includes('दोहराएं') ||
    norm.includes('phir se bolo') ||
    norm.includes('dohrayen') ||
    // Gujarati
    norm === 'ફરી બોલો' ||
    norm === 'ફરીથી બોલો' ||
    norm === 'દોહરાવો' ||
    norm === 'શું કહ્યું' ||
    norm.includes('ફરી બોલો') ||
    norm.includes('fari bolo')
  ) {
    return { type: 'repeat', raw: transcript };
  }

  // 3. Next corner
  if (
    // English
    norm === 'next corner' ||
    norm === 'next vertex' ||
    norm === 'next point' ||
    norm === 'corner' ||
    norm === 'go to next corner' ||
    norm === 'advance corner' ||
    norm.includes('next corner') ||
    norm.includes('next vertex') ||
    // Hindi
    norm === 'अगला कोना' ||
    norm === 'अगला शीर्ष' ||
    norm === 'अगला बिंदु' ||
    norm === 'कोना' ||
    norm.includes('अगला कोना') ||
    norm.includes('agla kona') ||
    // Gujarati
    norm === 'આગળનો ખૂણો' ||
    norm === 'આગળનો પોઇન્ટ' ||
    norm === 'ખૂણો' ||
    norm.includes('આગળનો ખૂણો') ||
    norm.includes('aagal no khuno')
  ) {
    return { type: 'next_corner', raw: transcript };
  }

  // 4. Describe
  if (
    // English
    norm === 'describe' ||
    norm === 'describe diagram' ||
    norm === 'what is this' ||
    norm === "what's this" ||
    norm === 'read scene' ||
    norm === 'diagram facts' ||
    norm === 'facts' ||
    norm === 'summary' ||
    norm.startsWith('describe') ||
    // Hindi
    norm === 'वर्णन करें' ||
    norm === 'चित्र का वर्णन' ||
    norm === 'यह क्या है' ||
    norm === 'तथ्य' ||
    norm === 'वर्णन' ||
    norm.includes('वर्णन') ||
    norm.includes('varnan') ||
    // Gujarati
    norm === 'વર્ણન કરો' ||
    norm === 'આ શું છે' ||
    norm === 'માહિતી' ||
    norm === 'વિગત' ||
    norm.includes('વર્ણન') ||
    norm.includes('varnan')
  ) {
    return { type: 'describe', raw: transcript };
  }

  // 5. Help
  if (
    // English
    norm === 'help' ||
    norm === 'commands' ||
    norm === 'what can i say' ||
    norm === 'list commands' ||
    norm === 'help me' ||
    norm.includes('help') ||
    // Hindi
    norm === 'मदद' ||
    norm === 'सहायता' ||
    norm === 'कमांड्स' ||
    norm === 'मैं क्या बोल सकता हूँ' ||
    norm.includes('मदद') ||
    norm.includes('madad') ||
    // Gujarati
    norm === 'મદદ' ||
    norm === 'સહાય' ||
    norm === 'હું શું કહી શકું' ||
    norm === 'કમાન્ડ' ||
    norm.includes('મદદ') ||
    norm.includes('sahay')
  ) {
    return { type: 'help', raw: transcript };
  }

  // 6. Speech rate commands
  if (
    norm === 'faster' ||
    norm === 'speed up' ||
    norm === 'speak faster' ||
    norm === 'fast speech' ||
    norm === 'तेज़' ||
    norm === 'गति बढ़ाएं' ||
    norm === 'ઝડપી' ||
    norm === 'ઝડપ વધારો' ||
    norm.includes('faster')
  ) {
    return { type: 'set_rate', rateSetting: 'fast', raw: transcript };
  }

  if (
    norm === 'slower' ||
    norm === 'slow down' ||
    norm === 'speak slower' ||
    norm === 'slow speech' ||
    norm === 'धीमा' ||
    norm === 'धीमी गति' ||
    norm === 'ધીમું' ||
    norm === 'ધીમી ગતિ' ||
    norm.includes('slower')
  ) {
    return { type: 'set_rate', rateSetting: 'slow', raw: transcript };
  }

  if (
    norm === 'normal speed' ||
    norm === 'reset speed' ||
    norm === 'regular speed' ||
    norm === 'normal rate' ||
    norm === 'सामान्य गति' ||
    norm === 'સામાન્ય ગતિ'
  ) {
    return { type: 'set_rate', rateSetting: 'normal', raw: transcript };
  }

  return { type: 'unknown', raw: transcript };
}

/** Pure helper to describe a coarse normalized 2D position. */
export function getCoarsePosition(pos: NormPoint): string {
  const { x, y } = pos;
  const isCentreX = x >= 0.35 && x <= 0.65;
  const isCentreY = y >= 0.35 && y <= 0.65;

  if (isCentreX && isCentreY) {
    return t('pos.centre');
  }

  const vertical = y < 0.35 ? 'top' : y > 0.65 ? 'bottom' : '';
  const horizontal = x < 0.35 ? 'left' : x > 0.65 ? 'right' : '';

  if (vertical === 'top' && horizontal === 'left') return t('pos.topLeft');
  if (vertical === 'top' && horizontal === 'right') return t('pos.topRight');
  if (vertical === 'bottom' && horizontal === 'left') return t('pos.bottomLeft');
  if (vertical === 'bottom' && horizontal === 'right') return t('pos.bottomRight');

  if (vertical === 'top') return t('pos.top');
  if (vertical === 'bottom') return t('pos.bottom');
  if (horizontal === 'left') return t('pos.left');
  if (horizontal === 'right') return t('pos.right');

  return t('pos.centre');
}

/** Find nearest labelled vertex to a normalized point. */
export function findNearestVertex(
  points: readonly Point[] | undefined,
  target: NormPoint,
): { point: Point; dist: number } | null {
  if (!points || points.length === 0) return null;
  let best: { point: Point; dist: number } | null = null;

  for (const p of points) {
    const dist = Math.hypot(p.x - target.x, p.y - target.y);
    if (!best || dist < best.dist) {
      best = { point: p, dist };
    }
  }

  return best;
}

/** Pure execution of an Explore voice command. */
export function executeExploreCommand(
  cmd: ParsedCommand,
  ctx: ExploreCommandContext,
): ExploreCommandResult {
  const { scene, view, cursorNorm, lastSpoken, currentCornerIndex, currentRate } = ctx;
  const currentPos: NormPoint = cursorNorm ?? { x: 0.5, y: 0.5 };
  const coarsePos = getCoarsePosition(currentPos);

  switch (cmd.type) {
    case 'where_am_i': {
      const nearest = findNearestVertex(scene.points, currentPos);
      if (nearest && nearest.dist <= 0.35) {
        const label = nearest.point.label ?? nearest.point.id;
        const speech = t('commands.whereNearVertex')
          .replace('{label}', label)
          .replace('{pos}', coarsePos);
        return { speech, earcon: 'success' };
      }
      const speech = t('commands.whereEmpty').replace('{pos}', coarsePos);
      return { speech, earcon: 'success' };
    }

    case 'repeat': {
      const speech = lastSpoken.trim().length > 0 ? lastSpoken : t('commands.noSpoken');
      return { speech };
    }

    case 'next_corner': {
      const points = scene.points ?? [];
      if (points.length === 0) {
        return { speech: t('commands.noPoints'), earcon: 'error' };
      }
      const nextIndex = (currentCornerIndex + 1) % points.length;
      const pt = points[nextIndex];
      if (!pt) {
        return { speech: t('commands.noPoints'), earcon: 'error' };
      }
      const ptCoarse = getCoarsePosition({ x: pt.x, y: pt.y });
      const label = pt.label ?? pt.id;
      const speech = t('commands.cornerAnnounce')
        .replace('{index}', String(nextIndex + 1))
        .replace('{total}', String(points.length))
        .replace('{label}', label)
        .replace('{pos}', ptCoarse);

      const nextCursor = toScreen(pt, view);
      return {
        speech,
        nextCornerIndex: nextIndex,
        nextCursor,
        earcon: 'success',
      };
    }

    case 'describe': {
      const title = scene.title ?? t('app.name');
      let factsText = '';
      if (scene.facts && scene.facts.length > 0) {
        factsText = scene.facts.join('. ');
      } else {
        factsText = t('commands.noFacts');
      }
      const speech = t('commands.describe')
        .replace('{title}', title)
        .replace('{facts}', factsText);
      return { speech, earcon: 'success' };
    }

    case 'help': {
      return { speech: t('commands.help'), earcon: 'success' };
    }

    case 'set_rate': {
      const targetRate = cmd.rateSetting ?? currentRate;
      let speech = t('rate.setNormal');
      if (targetRate === 'slow') speech = t('rate.setSlow');
      else if (targetRate === 'fast') speech = t('rate.setFast');

      return {
        speech,
        nextRate: targetRate,
        earcon: 'success',
      };
    }

    case 'unknown':
    default: {
      return { speech: t('commands.unrecognized'), earcon: 'error' };
    }
  }
}
