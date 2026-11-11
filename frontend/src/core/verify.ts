/**
 * Pure verification module: consistency check between a scene's printed facts
 * and its drawn geometry (SPEC GHOST).
 *
 * NOT forgery protection. Never says "verified". Silent when unsure.
 */

import type { DiagramScene, Point, Segment, Bar } from './scene';

export type VerifyMode = 'ai' | 'raw' | 'sample' | 'shared';

export interface VerifyOptions {
  mode?: VerifyMode;
}

export interface VerifyFinding {
  segmentId?: string;
  message: string;
  /** Set for an angle finding: the vertex as the fact names it ("B", "ADC"). M4-10. */
  angleVertex?: string;
}

/**
 * Pure helper to extract the disputed target name (e.g. "AC", "Red", "angle C") from a finding message.
 */
export function getFindingTarget(finding: VerifyFinding): string {
  const match = finding.message.match(/disagree on (.+?)\./i);
  return match?.[1]?.trim() ?? finding.segmentId ?? '';
}

/**
 * The disputed target as it should be spoken in the active language (Requirement 18.2, M4-10).
 * For an angle finding the caller's `angleName` words the vertex ("angle B", "कोण B"); every
 * other finding is named as in the English message. The core stays language-free.
 */
export function localizedFindingTarget(
  finding: VerifyFinding,
  angleName: (vertex: string) => string,
): string {
  if (finding.angleVertex !== undefined) return angleName(finding.angleVertex);
  const target = getFindingTarget(finding);
  // A finding built without `angleVertex` still names "angle X" (Requirement 23.5).
  const angle = /^angle\s+(\S+)$/i.exec(target);
  return angle ? angleName(angle[1]!) : target;
}

export type VerifyStatus = 'consistent' | 'disagree' | 'silent';

export interface VerifyResult {
  status: VerifyStatus;
  findings: VerifyFinding[];
}

// Wording constants exported (en only; listed so i18n can add hi/gu).
// Never "verified", never "trust the text".
export const VERIFY_WORDING = {
  disagree: (target: string): string =>
    `Facts and drawing disagree on ${target}. I can't tell which is right.`,
  disagreeTemplate: "Facts and drawing disagree on {name}. I can't tell which is right.",
} as const;

export interface ParsedLengthFact {
  type: 'length';
  raw: string;
  target: string; // e.g. "AB", "CA"
  value: number;
  unit?: string;
  reversedTarget?: string;
}

export interface ParsedAngleFact {
  type: 'angle';
  raw: string;
  vertex: string; // e.g. "C", "B", "ADC"
  value: number;
}

export interface ParsedBarFact {
  type: 'bar';
  raw: string;
  label: string;
  value: number;
}

export interface ParsedScaleFact {
  type: 'not_to_scale';
  raw: string;
}

export type ParsedFact =
  | ParsedLengthFact
  | ParsedAngleFact
  | ParsedBarFact
  | ParsedScaleFact;

export interface ParsedFactsResult {
  hasNotToScale: boolean;
  lengths: ParsedLengthFact[];
  angles: ParsedAngleFact[];
  bars: ParsedBarFact[];
  all: ParsedFact[];
}

/**
 * Parses facts into structured facts.
 *
 * Supported patterns:
 * - "XY = n unit", "XY = n"
 * - "length of (side) XY is n unit", "The length of (side) XY is n unit."
 * - "Side XY has a length of n unit", "The length of hypotenuse XY is n unit."
 * - "XY: n"
 * - "angle X = n°", "angle X = n degrees", "angle at X = n°", "m∠X = n°"
 * - bar facts: "label: n"
 * - "not to scale" (or "not drawn to scale")
 * - ignore anything unparsed
 */
export function parseFacts(facts: string[] | undefined, scene?: DiagramScene): ParsedFactsResult {
  const result: ParsedFactsResult = {
    hasNotToScale: false,
    lengths: [],
    angles: [],
    bars: [],
    all: [],
  };

  if (!facts || !Array.isArray(facts)) {
    return result;
  }

  for (const rawFact of facts) {
    if (typeof rawFact !== 'string') continue;
    const trimmed = rawFact.trim();
    if (!trimmed) continue;

    // Check "not to scale"
    if (/not\s+(?:drawn\s+)?to\s+scale/i.test(trimmed)) {
      result.hasNotToScale = true;
      const parsed: ParsedScaleFact = { type: 'not_to_scale', raw: trimmed };
      result.all.push(parsed);
      continue;
    }

    // Angle facts:
    // "angle X is a right angle" -> 90 degrees
    const rightAngleMatch = trimmed.match(
      /(?:(?:angle\s+(?:at\s+(?:vertex\s+)?)?|m∠|∠)\s*([A-Za-z0-9]+)|([A-Za-z0-9]+))\s+is\s+a\s+right\s+angle(?![A-Za-z0-9-])(?!\s+triangle)/i,
    );
    if (rightAngleMatch) {
      const vMatch = rightAngleMatch[1] ?? rightAngleMatch[2];
      if (vMatch) {
        const vertex = vMatch.trim();
        const parsed: ParsedAngleFact = {
          type: 'angle',
          raw: trimmed,
          vertex,
          value: 90,
        };
        result.angles.push(parsed);
        result.all.push(parsed);
        continue;
      }
    }

    // "angle X = n°", "angle X = n degrees", "angle at (vertex) X is n°", "m∠X = n°"
    const angleMatch = trimmed.match(
      /(?:(?:angle\s+(?:at\s+(?:vertex\s+)?)?|m∠|∠)\s*([A-Za-z0-9]+)\s*(?:=|is\s+equal\s+to|equal\s+to|is|:)\s*(\d+(?:\.\d+)?)\s*(?:°|deg(?:rees?)?)|(?:angle\s+(?:at\s+(?:vertex\s+)?)?|m∠|∠)\s*([A-Za-z0-9]+)\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*(?:°|deg(?:rees?)?)|([A-Za-z0-9]+)\s*=\s*(\d+(?:\.\d+)?)\s*(?:°|deg(?:rees?)?))/i,
    );
    if (angleMatch) {
      const vMatch = angleMatch[1] ?? angleMatch[3] ?? angleMatch[5];
      const valStr = angleMatch[2] ?? angleMatch[4] ?? angleMatch[6];
      if (vMatch && valStr) {
        const vertex = vMatch.trim();
        const val = parseFloat(valStr);
        if (Number.isFinite(val)) {
          const parsed: ParsedAngleFact = {
            type: 'angle',
            raw: trimmed,
            vertex,
            value: val,
          };
          result.angles.push(parsed);
          result.all.push(parsed);
          continue;
        }
      }
    }

    // Length pattern 1: "length of (side/hypotenuse) XY is n [unit]" or "The length of (side/hypotenuse) XY is n [unit]."
    const lengthOfMatch = trimmed.match(
      /^(?:the\s+)?length\s+of\s+(?:(?:the\s+)?(?:side|hypotenuse)\s+)?([A-Za-z0-9_]+)\s*(?:is|=|:)\s*(\d+(?:\.\d+)?)(?:\s*([a-zA-Z]+))?\.?$/i,
    );
    if (lengthOfMatch) {
      const tMatch = lengthOfMatch[1];
      const vMatch = lengthOfMatch[2];
      if (tMatch && vMatch) {
        const target = tMatch.trim();
        const val = parseFloat(vMatch);
        const unit = lengthOfMatch[3]?.trim();
        if (Number.isFinite(val)) {
          const char0 = target.charAt(0);
          const char1 = target.charAt(1);
          const parsed: ParsedLengthFact = {
            type: 'length',
            raw: trimmed,
            target,
            value: val,
            unit,
            reversedTarget: target.length === 2 ? `${char1}${char0}` : undefined,
          };
          result.lengths.push(parsed);
          result.all.push(parsed);
          continue;
        }
      }
    }

    // Length pattern 2: "Side (or Hypotenuse) XY has a length of n [unit]" or "Side XY is n [unit]"
    const sideHasLengthMatch = trimmed.match(
      /^(?:the\s+)?(?:side|hypotenuse)\s+([A-Za-z0-9_]+)(?:,\s*which\s+is\s+[^,]+,)?\s+(?:has\s+a\s+length\s+of|is)\s+(\d+(?:\.\d+)?)(?:\s*([a-zA-Z]+))?\.?$/i,
    );
    if (sideHasLengthMatch) {
      const tMatch = sideHasLengthMatch[1];
      const vMatch = sideHasLengthMatch[2];
      if (tMatch && vMatch) {
        const target = tMatch.trim();
        const val = parseFloat(vMatch);
        const unit = sideHasLengthMatch[3]?.trim();
        if (Number.isFinite(val)) {
          const char0 = target.charAt(0);
          const char1 = target.charAt(1);
          const parsed: ParsedLengthFact = {
            type: 'length',
            raw: trimmed,
            target,
            value: val,
            unit,
            reversedTarget: target.length === 2 ? `${char1}${char0}` : undefined,
          };
          result.lengths.push(parsed);
          result.all.push(parsed);
          continue;
        }
      }
    }

    // Length pattern 3: "XY = n [unit]"
    const xyEqualsMatch = trimmed.match(
      /^([A-Za-z0-9_]{1,4})\s*=\s*(\d+(?:\.\d+)?)(?:\s*([a-zA-Z°]+))?\.?$/i,
    );
    if (xyEqualsMatch) {
      const tMatch = xyEqualsMatch[1];
      const vMatch = xyEqualsMatch[2];
      if (tMatch && vMatch) {
        const target = tMatch.trim();
        const val = parseFloat(vMatch);
        const unit = xyEqualsMatch[3]?.trim();
        // Check if unit was degrees (in case it wasn't caught by angle parser)
        if (unit && /^(?:°|deg(?:rees?)?)$/i.test(unit)) {
          const parsed: ParsedAngleFact = {
            type: 'angle',
            raw: trimmed,
            vertex: target,
            value: val,
          };
          result.angles.push(parsed);
          result.all.push(parsed);
          continue;
        }
        if (Number.isFinite(val)) {
          const char0 = target.charAt(0);
          const char1 = target.charAt(1);
          const parsed: ParsedLengthFact = {
            type: 'length',
            raw: trimmed,
            target,
            value: val,
            unit,
            reversedTarget: target.length === 2 ? `${char1}${char0}` : undefined,
          };
          result.lengths.push(parsed);
          result.all.push(parsed);
          continue;
        }
      }
    }

    // Bar pattern: "label has a value of n"
    const barValueMatch = trimmed.match(
      /^([A-Za-z0-9_ ]+)\s+has\s+a\s+value\s+of\s+(\d+(?:\.\d+)?)\.?$/i,
    );
    if (barValueMatch) {
      const lMatch = barValueMatch[1];
      const vMatch = barValueMatch[2];
      if (lMatch && vMatch) {
        const label = lMatch.trim();
        const val = parseFloat(vMatch);
        if (Number.isFinite(val)) {
          const parsed: ParsedBarFact = {
            type: 'bar',
            raw: trimmed,
            label,
            value: val,
          };
          result.bars.push(parsed);
          result.all.push(parsed);
          continue;
        }
      }
    }

    // Pattern 4: "XY: n [unit]" or "label: n"
    const colonMatch = trimmed.match(
      /^([^:=]+):\s*(\d+(?:\.\d+)?)(?:\s*([a-zA-Z]+))?\.?$/i,
    );
    if (colonMatch) {
      const lMatch = colonMatch[1];
      const vMatch = colonMatch[2];
      if (lMatch && vMatch) {
        const labelOrTarget = lMatch.trim();
        const val = parseFloat(vMatch);
        const unit = colonMatch[3]?.trim();
        if (Number.isFinite(val)) {
          // If it's a 2-character geometry segment like "AB: 5" or "CA: 4"
          const isSegmentLike =
            /^[A-Za-z]{2}$/.test(labelOrTarget) ||
            (scene?.segments?.some(
              (s) =>
                s.id.toLowerCase() === labelOrTarget.toLowerCase() ||
                s.label?.toLowerCase() === labelOrTarget.toLowerCase(),
            ) ??
              false);

          if (isSegmentLike) {
            const char0 = labelOrTarget.charAt(0);
            const char1 = labelOrTarget.charAt(1);
            const parsed: ParsedLengthFact = {
              type: 'length',
              raw: trimmed,
              target: labelOrTarget,
              value: val,
              unit,
              reversedTarget:
                labelOrTarget.length === 2 ? `${char1}${char0}` : undefined,
            };
            result.lengths.push(parsed);
            result.all.push(parsed);
          } else {
            // Bar fact: "label: n"
            const parsed: ParsedBarFact = {
              type: 'bar',
              raw: trimmed,
              label: labelOrTarget,
              value: val,
            };
            result.bars.push(parsed);
            result.all.push(parsed);
          }
          continue;
        }
      }
    }

    // Anything unparsed is ignored
  }

  return result;
}

interface MatchedSegment {
  segment: Segment;
  factTarget: string;
  factValue: number;
  /** The unit as written in the fact ("cm", "mm", ...), if any. */
  unit?: string;
  drawnLength: number;
  scale: number; // drawnLength / factValue
}

/** Millimetres per unit, for the length units that can be converted (Requirement 18.7, Kiro). */
const MM_PER_UNIT: Readonly<Record<string, number>> = {
  mm: 1,
  millimetre: 1,
  millimetres: 1,
  millimeter: 1,
  millimeters: 1,
  cm: 10,
  centimetre: 10,
  centimetres: 10,
  centimeter: 10,
  centimeters: 10,
  m: 1000,
  metre: 1000,
  metres: 1000,
  meter: 1000,
  meters: 1000,
  km: 1_000_000,
  kilometre: 1_000_000,
  kilometres: 1_000_000,
  kilometer: 1_000_000,
  kilometers: 1_000_000,
  in: 25.4,
  inch: 25.4,
  inches: 25.4,
  ft: 304.8,
  foot: 304.8,
  feet: 304.8,
};

/**
 * Put matched lengths into one unit (Requirement 18.7, Kiro). With no unit, or one unit
 * throughout (bare numbers allowed), nothing changes. With different units, every one must be a
 * known length unit and none may be missing; then all are converted to millimetres. Otherwise
 * the answer is not knowable, so the caller stays silent.
 */
function inOneUnit(matched: MatchedSegment[]): MatchedSegment[] | 'unsure' {
  const written = new Set(
    matched.map((m) => m.unit?.toLowerCase()).filter((u): u is string => u !== undefined && u !== ''),
  );
  if (written.size <= 1) return matched;
  const converted: MatchedSegment[] = [];
  for (const m of matched) {
    const perUnit = m.unit === undefined ? undefined : MM_PER_UNIT[m.unit.toLowerCase()];
    if (perUnit === undefined) return 'unsure';
    const factValue = m.factValue * perUnit;
    converted.push({ ...m, factValue, scale: m.drawnLength / factValue });
  }
  return converted;
}

/**
 * The scene's width / height, used to measure drawn x distances in true proportions
 * (Requirement 18.6, Kiro; the backend `semantic.py` does the same). Anything that is not a
 * finite positive number counts as 1.
 */
function sceneAspect(scene: DiagramScene): number {
  const aspect = scene.aspect;
  return typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

interface MatchedBar {
  bar: Bar;
  factLabel: string;
  factValue: number;
  drawnLength: number; // height: y_base - y_top
  scale: number; // drawnLength / factValue
}

/**
 * Checks a scene's printed facts against its drawn geometry.
 *
 * Rules:
 * - Checks length RATIOS only (+-15%, +-25% when mode is 'ai').
 * - Checks angles +-8 degrees.
 * - Only runs checks when >=2 parsed lengths are matched.
 * - Silent if any fact says "not to scale".
 * - Distances and angles use the diagram's own proportions: x differences count `scene.aspect`
 *   times (18.6). Mixed known units are converted to mm; unknown mixes stay silent (18.7).
 * - Silent when unparsed, "not to scale", or <2 lengths.
 */
export function verifyScene(
  scene: DiagramScene,
  opts?: VerifyOptions,
): VerifyResult {
  const mode = opts?.mode ?? 'sample';
  const facts = scene.facts;
  if (!facts || facts.length === 0) {
    return { status: 'silent', findings: [] };
  }

  const parsed = parseFacts(facts, scene);

  // If any fact says "not to scale", silent immediately
  if (parsed.hasNotToScale) {
    return { status: 'silent', findings: [] };
  }

  const lengthRatioTolerance = mode === 'ai' ? 0.25 : 0.15;
  const angleToleranceDeg = 8.0;

  // Build point lookup map
  const pointMap = new Map<string, Point>();
  for (const pt of scene.points ?? []) {
    pointMap.set(pt.id, pt);
  }
  const aspect = sceneAspect(scene);

  // 1. Match segments
  const matchedSegments: MatchedSegment[] = [];
  const segments = scene.segments ?? [];

  for (const lengthFact of parsed.lengths) {
    const targetUpper = lengthFact.target.toUpperCase();
    const revUpper = lengthFact.reversedTarget?.toUpperCase();

    // Match segment by id, label, or endpoints (accept reversed names: AC matches segment CA)
    const seg = segments.find((s) => {
      const sId = s.id.toUpperCase();
      const sLabel = s.label?.toUpperCase();
      const sEndpoints = `${s.a}${s.b}`.toUpperCase();
      const sEndpointsRev = `${s.b}${s.a}`.toUpperCase();

      const pa = pointMap.get(s.a);
      const pb = pointMap.get(s.b);
      const ptLabels =
        pa?.label && pb?.label ? `${pa.label}${pb.label}`.toUpperCase() : undefined;
      const ptLabelsRev =
        pa?.label && pb?.label ? `${pb.label}${pa.label}`.toUpperCase() : undefined;

      return (
        sId === targetUpper ||
        (revUpper !== undefined && sId === revUpper) ||
        (sLabel !== undefined &&
          (sLabel === targetUpper || (revUpper !== undefined && sLabel === revUpper))) ||
        sEndpoints === targetUpper ||
        sEndpointsRev === targetUpper ||
        (ptLabels !== undefined &&
          (ptLabels === targetUpper || ptLabelsRev === targetUpper))
      );
    });

    if (seg) {
      const pa = pointMap.get(seg.a);
      const pb = pointMap.get(seg.b);
      if (pa && pb && lengthFact.value > 0) {
        // Horizontal distances count `aspect` times: the diagram's own proportions (18.6).
        const drawnLength = Math.hypot((pb.x - pa.x) * aspect, pb.y - pa.y);
        if (drawnLength > 0) {
          matchedSegments.push({
            segment: seg,
            factTarget: lengthFact.target,
            factValue: lengthFact.value,
            unit: lengthFact.unit,
            drawnLength,
            scale: drawnLength / lengthFact.value,
          });
        }
      }
    }
  }

  // Different units: convert, or stay silent when that is not possible (18.7).
  const sameUnit = inOneUnit(matchedSegments);
  if (sameUnit === 'unsure') {
    return { status: 'silent', findings: [] };
  }
  matchedSegments.splice(0, matchedSegments.length, ...sameUnit);

  // 2. Match bars (if bar chart)
  const matchedBars: MatchedBar[] = [];
  const bars = scene.bars ?? [];

  for (const barFact of parsed.bars) {
    const labelLower = barFact.label.toLowerCase();
    const bar = bars.find(
      (b) =>
        b.label.toLowerCase() === labelLower ||
        b.id.toLowerCase() === labelLower,
    );
    if (bar && barFact.value > 0) {
      const drawnLength = Math.abs(bar.y_base - bar.y_top);
      if (drawnLength > 0) {
        matchedBars.push({
          bar,
          factLabel: barFact.label,
          factValue: barFact.value,
          drawnLength,
          scale: drawnLength / barFact.value,
        });
      }
    }
  }

  // Condition: "only when >=2 parsed lengths; silent if any fact says 'not to scale'"
  const totalMatchedLengths = matchedSegments.length > 0 ? matchedSegments.length : matchedBars.length;
  if (totalMatchedLengths < 2) {
    return { status: 'silent', findings: [] };
  }

  const findings: VerifyFinding[] = [];

  // Check geometry segment length ratios
  if (matchedSegments.length >= 2) {
    if (matchedSegments.length === 2) {
      const m0 = matchedSegments[0]!;
      const m1 = matchedSegments[1]!;
      const ratioDiff =
        Math.abs(m0.scale - m1.scale) / Math.min(m0.scale, m1.scale);
      if (ratioDiff > lengthRatioTolerance) {
        findings.push({
          segmentId: m0.segment.id,
          message: VERIFY_WORDING.disagree(m0.factTarget),
        });
        findings.push({
          segmentId: m1.segment.id,
          message: VERIFY_WORDING.disagree(m1.factTarget),
        });
      }
    } else {
      const scales = matchedSegments.map((m) => m.scale).sort((a, b) => a - b);
      const mid = Math.floor(scales.length / 2);
      const medianScale =
        scales.length % 2 === 0
          ? (scales[mid - 1]! + scales[mid]!) / 2
          : scales[mid]!;

      for (const m of matchedSegments) {
        const relError = Math.abs(m.scale - medianScale) / medianScale;
        if (relError > lengthRatioTolerance) {
          findings.push({
            segmentId: m.segment.id,
            message: VERIFY_WORDING.disagree(m.factTarget),
          });
        }
      }
    }
  }

  // Check bar height ratios
  if (matchedBars.length >= 2) {
    if (matchedBars.length === 2) {
      const b0 = matchedBars[0]!;
      const b1 = matchedBars[1]!;
      const ratioDiff =
        Math.abs(b0.scale - b1.scale) / Math.min(b0.scale, b1.scale);
      if (ratioDiff > lengthRatioTolerance) {
        findings.push({
          message: VERIFY_WORDING.disagree(b0.factLabel),
        });
        findings.push({
          message: VERIFY_WORDING.disagree(b1.factLabel),
        });
      }
    } else {
      const scales = matchedBars.map((m) => m.scale).sort((a, b) => a - b);
      const mid = Math.floor(scales.length / 2);
      const medianScale =
        scales.length % 2 === 0
          ? (scales[mid - 1]! + scales[mid]!) / 2
          : scales[mid]!;

      for (const b of matchedBars) {
        const relError = Math.abs(b.scale - medianScale) / medianScale;
        if (relError > lengthRatioTolerance) {
          findings.push({
            message: VERIFY_WORDING.disagree(b.factLabel),
          });
        }
      }
    }
  }

  // Check angles (tolerance +-8 degrees)
  if (parsed.angles.length > 0 && scene.points && scene.segments) {
    for (const angleFact of parsed.angles) {
      const drawnAngle = computeDrawnAngle(
        angleFact.vertex,
        scene.points,
        scene.segments,
        aspect,
      );
      if (drawnAngle !== null) {
        const angleDiff = Math.abs(drawnAngle - angleFact.value);
        if (angleDiff > angleToleranceDeg) {
          const vertex = angleFact.vertex.replace(/^angle\s+/i, '');
          // The English message keeps "angle B" (18.2); `angleVertex` lets callers word it (M4-10).
          findings.push({
            message: VERIFY_WORDING.disagree(`angle ${vertex}`),
            angleVertex: vertex,
          });
        }
      }
    }
  }

  if (findings.length > 0) {
    return { status: 'disagree', findings };
  }

  return { status: 'consistent', findings: [] };
}

/**
 * Computes the drawn angle (in degrees) for a vertex name or 3-letter vertex code (e.g. "ADC").
 * Returns null if the angle cannot be uniquely determined from drawn geometry.
 * `aspect` (width / height) scales x differences so angles match the diagram's proportions (18.6).
 */
function computeDrawnAngle(
  vertexCode: string,
  points: Point[],
  segments: Segment[],
  aspect: number,
): number | null {
  const ptMap = new Map<string, Point>();
  for (const pt of points) {
    ptMap.set(pt.id, pt);
    if (pt.label) {
      ptMap.set(pt.label, pt);
    }
  }

  // Case 1: 3-letter angle like "ADC" -> vertex is D, arms are DA and DC
  if (vertexCode.length === 3) {
    const c0 = vertexCode.charAt(0);
    const c1 = vertexCode.charAt(1);
    const c2 = vertexCode.charAt(2);
    const p1 = ptMap.get(c0);
    const pv = ptMap.get(c1);
    const p2 = ptMap.get(c2);
    if (p1 && pv && p2) {
      const v1x = (p1.x - pv.x) * aspect;
      const v1y = p1.y - pv.y;
      const v2x = (p2.x - pv.x) * aspect;
      const v2y = p2.y - pv.y;
      const mag1 = Math.hypot(v1x, v1y);
      const mag2 = Math.hypot(v2x, v2y);
      if (mag1 > 0 && mag2 > 0) {
        const dot = v1x * v2x + v1y * v2y;
        const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        return Math.acos(cosTheta) * (180 / Math.PI);
      }
    }
  }

  // Case 2: 1-letter vertex like "C" or "B"
  const pv = ptMap.get(vertexCode);
  if (!pv) return null;

  // Find segments incident to this vertex
  const incident = segments.filter((s) => s.a === pv.id || s.b === pv.id);
  if (incident.length === 2) {
    const s0 = incident[0];
    const s1 = incident[1];
    if (s0 && s1) {
      const otherId1 = s0.a === pv.id ? s0.b : s0.a;
      const otherId2 = s1.a === pv.id ? s1.b : s1.a;
      const p1 = ptMap.get(otherId1);
      const p2 = ptMap.get(otherId2);
      if (p1 && p2) {
        const v1x = (p1.x - pv.x) * aspect;
        const v1y = p1.y - pv.y;
        const v2x = (p2.x - pv.x) * aspect;
        const v2y = p2.y - pv.y;
        const mag1 = Math.hypot(v1x, v1y);
        const mag2 = Math.hypot(v2x, v2y);
        if (mag1 > 0 && mag2 > 0) {
          const dot = v1x * v2x + v1y * v2y;
          const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
          return Math.acos(cosTheta) * (180 / Math.PI);
        }
      }
    }
  }

  return null;
}
