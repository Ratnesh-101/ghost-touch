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
import {
  resolveTarget,
  type ResolvedTarget,
  resolveSemantic,
  matchSemanticPhrase,
  type SemanticName,
} from '../guide';
import { t } from '../i18n';

export type CommandType =
  | 'where_am_i'
  | 'repeat'
  | 'next_corner'
  | 'describe'
  | 'help'
  | 'set_rate'
  | 'guide_to'
  | 'guide_semantic'
  | 'stop'
  | 'unknown';

export interface ParsedCommand {
  readonly type: CommandType;
  readonly raw: string;
  readonly rateSetting?: SpeechRateSetting;
  readonly targetLabel?: string;
  readonly semanticTarget?: SemanticName;
}

export interface ExploreCommandContext {
  readonly scene: DiagramScene;
  readonly view: Viewport;
  readonly cursorNorm: NormPoint | null;
  readonly lastSpoken: string;
  readonly currentCornerIndex: number;
  readonly currentRate: SpeechRateSetting;
  readonly isGuiding?: boolean;
  readonly isGuideActive?: boolean;
}

export interface ExploreCommandResult {
  readonly speech: string;
  readonly nextCornerIndex?: number;
  readonly nextCursor?: ScreenPoint;
  readonly nextRate?: SpeechRateSetting;
  readonly earcon?: 'success' | 'error' | 'listening' | 'start' | 'back';
  readonly guideTarget?: ResolvedTarget;
  readonly stopGuide?: boolean;
}

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?।]/g, '')
    .replace(/\s+/g, ' ');
}

export function extractGuideTargetLabel(norm: string): string | null {
  // English: take me to ..., find ..., guide me to ..., guide to ...
  let m = norm.match(/^(?:take me to|guide me to|guide to)\s+(?:point|vertex|corner|line|bar)?\s*(.+)$/i);
  if (m && m[1]) return m[1].trim();

  m = norm.match(/^find\s+(?:point|vertex|corner|line|bar)?\s*(.+)$/i);
  if (m && m[1]) return m[1].trim();

  // English: go to point <x> (exclude 'go to next corner')
  if (norm !== 'go to next corner' && norm !== 'go to corner') {
    m = norm.match(/^go to\s+(?:point|vertex|corner|line|bar)?\s*(.+)$/i);
    if (m && m[1] && m[1] !== 'next corner' && m[1] !== 'next vertex' && m[1] !== 'corner') {
      return m[1].trim();
    }
  }

  // Hindi: मुझे [बिंदु] <label> पर ले चलो / ले जाओ
  m = norm.match(/^मुझे\s+(?:बिंदु|शीर्ष|कोना|रेखा)?\s*(.+?)\s*पर ले (?:चलो|जाओ)$/);
  if (m && m[1]) return m[1].trim();

  // Hindi: <label> पर ले चलो / ले जाओ
  m = norm.match(/^(.+?)\s*पर ले (?:चलो|जाओ)$/);
  if (m && m[1]) return m[1].trim();

  // Hindi: <label> खोजें / ढूंढें / खोजो / ढूंढो
  m = norm.match(/^(?:बिंदु|शीर्ष|कोना|रेखा)?\s*(.+?)\s*(?:खोजें|ढूंढें|खोजो|ढूंढो)$/);
  if (m && m[1]) return m[1].trim();

  m = norm.match(/^(?:खोजें|ढूंढें)\s+(?:बिंदु|शीर्ष|कोना|रेखा)?\s*(.+)$/);
  if (m && m[1]) return m[1].trim();

  // Gujarati: મને [બિંદુ] <label> પર લઈ જાઓ
  m = norm.match(/^મને\s+(?:બિંદુ|ખૂણો|રેખા)?\s*(.+?)\s*પર લઈ જાઓ$/);
  if (m && m[1]) return m[1].trim();

  // Gujarati: <label> પર લઈ જાઓ
  m = norm.match(/^(.+?)\s*પર લઈ જાઓ$/);
  if (m && m[1]) return m[1].trim();

  // Gujarati: <label> શોધો
  m = norm.match(/^(?:બિંદુ|ખૂણો|રેખા)?\s*(.+?)\s*શોધો$/);
  if (m && m[1]) return m[1].trim();

  m = norm.match(/^શોધો\s+(?:બિંદુ|ખૂણો|રેખા)?\s*(.+)$/);
  if (m && m[1]) return m[1].trim();

  return null;
}

/** Pure parser for voice commands supporting English, Hindi, and Gujarati. */
export function parseExploreCommand(
  transcript: string,
  guideActiveOrOptions: boolean | { isGuideActive?: boolean } = false,
): ParsedCommand {
  const norm = normalizeInput(transcript);
  const isGuide =
    typeof guideActiveOrOptions === 'boolean'
      ? guideActiveOrOptions
      : Boolean(guideActiveOrOptions?.isGuideActive);

  // Guide commands (active only when guide feature flag & setting are active)
  if (isGuide) {
    if (
      norm === 'stop' ||
      norm === 'stop guide' ||
      norm === 'stop guiding' ||
      norm === 'cancel guide' ||
      norm === 'end guide' ||
      norm === 'रुकें' ||
      norm === 'रुक जाओ' ||
      norm === 'रोको' ||
      norm === 'गाइड रोको' ||
      norm === 'बंद करो' ||
      norm === 'गाइड बंद करो' ||
      norm === 'ઊભા રહો' ||
      norm === 'રોકો' ||
      norm === 'બંધ કરો' ||
      norm === 'થોભો' ||
      norm === 'ગાઇડ બંધ કરો' ||
      norm === 'ગાઈડ રોકો'
    ) {
      return { type: 'stop', raw: transcript };
    }

    // Semantic guide targets (peak, trough, origin, tallestBar, shortestBar, rightAngle, longestSide)
    const semTarget = matchSemanticPhrase(norm);
    if (semTarget) {
      return { type: 'guide_semantic', semanticTarget: semTarget, raw: transcript };
    }

    const targetLabel = extractGuideTargetLabel(norm);
    if (targetLabel && targetLabel.length > 0) {
      const semFromLabel = matchSemanticPhrase(targetLabel);
      if (semFromLabel) {
        return { type: 'guide_semantic', semanticTarget: semFromLabel, raw: transcript };
      }
      return { type: 'guide_to', targetLabel, raw: transcript };
    }
  }

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

/** Find element in scene by label or ID matching query. */
export function findElementByLabelOrId(
  scene: DiagramScene,
  query: string,
): { id: string; label: string } | null {
  const q = query.toLowerCase().trim();
  const strippedQ = q
    .replace(
      /^(?:point|vertex|corner|line|segment|bar|polyline|बिंदु|शीर्ष|कोना|रेखा|બિંદુ|ખૂણો|રેખા)\s+/i,
      '',
    )
    .trim();

  // 1. Points
  if (scene.points) {
    for (const p of scene.points) {
      const pLabel = (p.label ?? '').toLowerCase().trim();
      const pId = p.id.toLowerCase().trim();
      if (pLabel === q || pId === q || pLabel === strippedQ || pId === strippedQ) {
        return { id: p.id, label: p.label || p.id };
      }
    }
  }

  // 2. Segments
  if (scene.segments) {
    for (const s of scene.segments) {
      const sLabel = (s.label ?? '').toLowerCase().trim();
      const sId = s.id.toLowerCase().trim();
      if (sLabel === q || sId === q || sLabel === strippedQ || sId === strippedQ) {
        return { id: s.id, label: s.label || s.id };
      }
    }
  }

  // 3. Polylines
  if (scene.polylines) {
    for (const pl of scene.polylines) {
      const plLabel = (pl.label ?? '').toLowerCase().trim();
      const plId = pl.id.toLowerCase().trim();
      if (plLabel === q || plId === q || plLabel === strippedQ || plId === strippedQ) {
        return { id: pl.id, label: pl.label || pl.id };
      }
    }
  }

  // 4. Bars
  if (scene.bars) {
    for (const b of scene.bars) {
      const bLabel = (b.label ?? '').toLowerCase().trim();
      const bId = b.id.toLowerCase().trim();
      if (bLabel === q || bId === q || bLabel === strippedQ || bId === strippedQ) {
        return { id: b.id, label: b.label || b.id };
      }
    }
  }

  return null;
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
    case 'stop': {
      if (ctx.isGuiding) {
        return {
          speech: t('guide.stopped'),
          stopGuide: true,
          earcon: 'back',
        };
      }
      return {
        speech: t('guide.notGuiding'),
        earcon: 'back',
      };
    }

    case 'guide_to': {
      if (!cmd.targetLabel) {
        return { speech: t('commands.unrecognized'), earcon: 'error' };
      }
      // Check if targetLabel is a semantic target
      const sem = matchSemanticPhrase(cmd.targetLabel);
      if (sem) {
        const resolved = resolveSemantic(scene, sem);
        if (!resolved) {
          return {
            speech: t(`guide.semantic.none.${sem}`),
            earcon: 'error',
          };
        }
        return {
          speech: t('guide.start').replace('{label}', resolved.label),
          guideTarget: resolved,
          earcon: 'success',
        };
      }
      const found = findElementByLabelOrId(scene, cmd.targetLabel);
      if (!found) {
        return {
          speech: t('guide.notFound').replace('{label}', cmd.targetLabel),
          earcon: 'error',
        };
      }
      const resolved = resolveTarget(scene, { kind: 'element', elementId: found.id });
      if (!resolved) {
        return {
          speech: t('guide.notFound').replace('{label}', cmd.targetLabel),
          earcon: 'error',
        };
      }
      return {
        speech: t('guide.start').replace('{label}', resolved.label),
        guideTarget: resolved,
        earcon: 'success',
      };
    }

    case 'guide_semantic': {
      if (!cmd.semanticTarget) {
        return { speech: t('commands.unrecognized'), earcon: 'error' };
      }
      const resolved = resolveSemantic(scene, cmd.semanticTarget);
      if (!resolved) {
        return {
          speech: t(`guide.semantic.none.${cmd.semanticTarget}`),
          earcon: 'error',
        };
      }
      return {
        speech: t('guide.start').replace('{label}', resolved.label),
        guideTarget: resolved,
        earcon: 'success',
      };
    }

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
      const nextCursor = toScreen(pt, view);

      if (ctx.isGuideActive) {
        const resolved = resolveTarget(scene, { kind: 'element', elementId: pt.id });
        if (resolved) {
          return {
            speech: t('guide.start').replace('{label}', resolved.label),
            nextCornerIndex: nextIndex,
            nextCursor,
            guideTarget: resolved,
            earcon: 'success',
          };
        }
      }

      const speech = t('commands.cornerAnnounce')
        .replace('{index}', String(nextIndex + 1))
        .replace('{total}', String(points.length))
        .replace('{label}', label)
        .replace('{pos}', ptCoarse);

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
