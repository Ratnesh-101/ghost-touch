/**
 * Pure semantic targets module for "Guide my finger".
 *
 * Implements resolveSemantic and voice phrase matcher according to:
 * - docs/briefs/semantic-targets-spec.md
 * - docs/briefs/agy-g4-semantic-voice.md
 *
 * Pure TypeScript: no DOM, React, or browser drivers imported.
 */

import type { DiagramScene } from '../types/scene.gen';
import { resolveTarget, type ResolvedTarget } from './geometry';

export type SemanticName =
  | 'peak'
  | 'trough'
  | 'origin'
  | 'tallestBar'
  | 'shortestBar'
  | 'rightAngle'
  | 'longestSide';

export const SEMANTIC_NAMES: readonly SemanticName[] = [
  'peak',
  'trough',
  'origin',
  'tallestBar',
  'shortestBar',
  'rightAngle',
  'longestSide',
] as const;

/**
 * Normalise a phrase for semantic matching:
 * - lowercase
 * - trim
 * - strip punctuation
 * - collapse whitespace
 */
export function normalizeSemanticInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?।]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Strip common voice command prefixes / suffixes in en, hi, and gu.
 */
function stripCommandAffixes(norm: string): string {
  let s = norm;

  // English leading command verbs and articles
  s = s.replace(
    /^(?:take me to|guide me to|guide to|go to|find|show me|where is|locate|navigate to)\s+(?:the\s+)?(?:point|vertex|corner|line|segment|bar)?\s*/i,
    ''
  );
  s = s.replace(/^(?:the)\s+/i, '');

  // Hindi leading prefixes
  s = s.replace(
    /^(?:मुझे\s+)?(?:कृपया\s+)?(?:खोजें|ढूंढें|ढूंढो|दिखाओ|बताओ|ले चलो|ले जाओ)?\s*(?:बिंदु|शीर्ष|कोना|रेखा)?\s*/,
    ''
  );

  // Hindi trailing suffixes
  s = s.replace(
    /\s*(?:पर ले चलो|पर ले जाओ|ले चलो|ले जाओ|खोजें|ढूंढें|ढूंढो|दिखाओ|बताओ|कहाँ है|कहां है)$/,
    ''
  );

  // Gujarati leading prefixes
  s = s.replace(
    /^(?:મને\s+)?(?:કૃપા કરીને\s+)?(?:શોધો|બતાવો|લઈ જાઓ)?\s*(?:બિંદુ|ખૂણો|રેખા)?\s*/,
    ''
  );

  // Gujarati trailing suffixes
  s = s.replace(
    /\s*(?:પર લઈ જાઓ|લઈ જાઓ|શોધો|બતાવો|ક્યાં છે)$/,
    ''
  );

  return s.trim();
}

/**
 * Canonical phrase table mapping phrases (in en, hi, gu) to SemanticName.
 */
const PHRASES_TO_SEMANTIC: Record<string, SemanticName> = {
  // --- 1. peak ---
  // English
  'peak': 'peak',
  'the peak': 'peak',
  'highest point': 'peak',
  'the highest point': 'peak',
  'maximum': 'peak',
  'the maximum': 'peak',
  'top of the curve': 'peak',
  'top of curve': 'peak',
  'the top of the curve': 'peak',
  'the top of curve': 'peak',
  'highest vertex': 'peak',
  // Hindi
  'शिखर': 'peak',
  'सबसे ऊँचा बिंदु': 'peak',
  'सबसे ऊंचा बिंदु': 'peak',
  'अधिकतम': 'peak',
  'अधिकतम बिंदु': 'peak',
  'वक्र का शीर्ष': 'peak',
  'वक्र का सबसे ऊँचा बिंदु': 'peak',
  'वक्र का सबसे ऊंचा बिंदु': 'peak',
  'वक्र की चोटी': 'peak',
  // Gujarati
  'શિખર': 'peak',
  'સૌથી ઊંચો બિંદુ': 'peak',
  'સૌથી ઊંચું બિંદુ': 'peak',
  'મહત્તમ': 'peak',
  'મહત્તમ બિંદુ': 'peak',
  'વળાંકની ટોચ': 'peak',

  // --- 2. trough ---
  // English
  'lowest point': 'trough',
  'the lowest point': 'trough',
  'minimum': 'trough',
  'the minimum': 'trough',
  'trough': 'trough',
  'the trough': 'trough',
  'bottom of the curve': 'trough',
  'bottom of curve': 'trough',
  'the bottom of the curve': 'trough',
  'the bottom of curve': 'trough',
  'lowest vertex': 'trough',
  // Hindi
  'न्यूनतम बिंदु': 'trough',
  'सबसे निचला बिंदु': 'trough',
  'न्यूनतम': 'trough',
  'गर्त': 'trough',
  'वक्र का तल': 'trough',
  'वक्र का सबसे निचला बिंदु': 'trough',
  // Gujarati
  'સૌથી નીચો બિંદુ': 'trough',
  'સૌથી નીચું બિંદુ': 'trough',
  'ન્યૂનતમ': 'trough',
  'ન્યૂનતમ બિંદુ': 'trough',
  'ગર્ત': 'trough',
  'ખાડો': 'trough',
  'વળાંકનું તળિયું': 'trough',

  // --- 3. origin ---
  // English
  'origin': 'origin',
  'the origin': 'origin',
  'where the axes cross': 'origin',
  'where axes cross': 'origin',
  'where the axis cross': 'origin',
  'where axis cross': 'origin',
  'axes cross': 'origin',
  'axis cross': 'origin',
  'axes crossing': 'origin',
  'axis crossing': 'origin',
  // Hindi
  'मूल बिंदु': 'origin',
  'उद्गम बिंदु': 'origin',
  'उद्गम': 'origin',
  'जहां अक्ष मिलते हैं': 'origin',
  'जहाँ अक्ष मिलते हैं': 'origin',
  'जहां अक्ष काटते हैं': 'origin',
  'जहाँ अक्ष काटते हैं': 'origin',
  'अक्ष मिलन': 'origin',
  // Gujarati
  'ઉદ્ભવ બિંદુ': 'origin',
  'મૂળ બિંદુ': 'origin',
  'જ્યાં ધરીઓ મળે છે': 'origin',
  'જ્યાં અક્ષો મળે છે': 'origin',
  'ધરીઓનું છેદન બિંદુ': 'origin',

  // --- 4. tallestBar ---
  // English
  'tallest bar': 'tallestBar',
  'the tallest bar': 'tallestBar',
  'highest bar': 'tallestBar',
  'the highest bar': 'tallestBar',
  'biggest bar': 'tallestBar',
  'the biggest bar': 'tallestBar',
  'maximum bar': 'tallestBar',
  'the maximum bar': 'tallestBar',
  'max bar': 'tallestBar',
  'largest bar': 'tallestBar',
  // Hindi
  'सबसे ऊँचा बार': 'tallestBar',
  'सबसे ऊंचा बार': 'tallestBar',
  'सबसे बड़ा बार': 'tallestBar',
  'उच्चतम बार': 'tallestBar',
  'सबसे ऊँचा स्तंभ': 'tallestBar',
  'सबसे ऊंचा स्तंभ': 'tallestBar',
  'सबसे बड़ा स्तंभ': 'tallestBar',
  // Gujarati
  'સૌથી ઊંચો બાર': 'tallestBar',
  'સૌથી મોટો બાર': 'tallestBar',
  'સૌથી ઊંચો સ્તંભ': 'tallestBar',
  'સૌથી મોટો સ્તંભ': 'tallestBar',

  // --- 5. shortestBar ---
  // English
  'shortest bar': 'shortestBar',
  'the shortest bar': 'shortestBar',
  'smallest bar': 'shortestBar',
  'the smallest bar': 'shortestBar',
  'lowest bar': 'shortestBar',
  'the lowest bar': 'shortestBar',
  'minimum bar': 'shortestBar',
  'min bar': 'shortestBar',
  // Hindi
  'सबसे छोटा बार': 'shortestBar',
  'सबसे निचला बार': 'shortestBar',
  'सबसे लघु बार': 'shortestBar',
  'सबसे छोटा स्तंभ': 'shortestBar',
  // Gujarati
  'સૌથી ટૂંકો બાર': 'shortestBar',
  'સૌથી ટૂંકી બાર': 'shortestBar',
  'સૌથી નાનો બાર': 'shortestBar',
  'સૌથી ટૂંકો સ્તંભ': 'shortestBar',
  'સૌથી નાનો સ્તંભ': 'shortestBar',

  // --- 6. rightAngle ---
  // English
  'right angle': 'rightAngle',
  'the right angle': 'rightAngle',
  'right corner': 'rightAngle',
  'the right corner': 'rightAngle',
  '90 degree angle': 'rightAngle',
  '90 degrees angle': 'rightAngle',
  // Hindi
  'समकोण': 'rightAngle',
  'नब्बे अंश का कोण': 'rightAngle',
  '90 अंश का कोण': 'rightAngle',
  '90 डिग्री का कोण': 'rightAngle',
  // Gujarati
  'કાટખૂણો': 'rightAngle',
  'કાટકોણ': 'rightAngle',
  '90 ડિગ્રીનો ખૂણો': 'rightAngle',
  'નેવું અંશનો ખૂણો': 'rightAngle',

  // --- 7. longestSide ---
  // English
  'longest side': 'longestSide',
  'the longest side': 'longestSide',
  'longest segment': 'longestSide',
  'longest line': 'longestSide',
  'biggest side': 'longestSide',
  // Hindi
  'सबसे लंबी भुजा': 'longestSide',
  'सबसे लंबा किनारा': 'longestSide',
  'सबसे बड़ी भुजा': 'longestSide',
  // Gujarati
  'સૌથી લાંબી બાજુ': 'longestSide',
  'સૌથી મોટો કાંઠો': 'longestSide',
};

// Sorted list of phrases by length descending for substring matching
const SORTED_PHRASES = Object.keys(PHRASES_TO_SEMANTIC).sort(
  (a, b) => b.length - a.length
);

/**
 * Match a raw or normalized transcript against registered semantic target phrases.
 * Returns the matching SemanticName or null if not a semantic target phrase.
 */
export function matchSemanticPhrase(input: string): SemanticName | null {
  if (!input) return null;
  const norm = normalizeSemanticInput(input);
  if (!norm) return null;

  // 1. Direct match on normalized phrase
  if (PHRASES_TO_SEMANTIC[norm]) {
    return PHRASES_TO_SEMANTIC[norm] ?? null;
  }

  // 2. Direct match after stripping common command prefixes/suffixes
  const stripped = stripCommandAffixes(norm);
  if (stripped && PHRASES_TO_SEMANTIC[stripped]) {
    return PHRASES_TO_SEMANTIC[stripped] ?? null;
  }

  // 3. Fallback: check if any multi-word semantic phrase is contained within norm
  // We prioritize longer phrases first.
  for (const phrase of SORTED_PHRASES) {
    if (phrase.includes(' ')) {
      // Must match at word boundary
      const regex = new RegExp(`(?:^|\\s)${phrase}(?:\\s|$)`);
      if (regex.test(norm)) {
        return PHRASES_TO_SEMANTIC[phrase] ?? null;
      }
    }
  }

  return null;
}

/**
 * Resolve a SemanticName against a DiagramScene according to semantic-targets-spec.md.
 *
 * Rules:
 * - peak: smallest y across all polyline vertices; ties: first in document order -> point {x,y}, label "peak"
 * - trough: largest y across all polyline vertices; ties: first in document order -> point {x,y}, label "lowest point"
 * - origin: scene.axes with BOTH x_axis_y and y_axis_x non-null -> point (y_axis_x, x_axis_y), label "origin"
 * - tallestBar: bar with max value; ties: first in document order -> element {bar.id}
 * - shortestBar: bar with min value; ties: first in document order -> element {bar.id}
 * - rightAngle: point with exactly two incident segments with angle 90 +/- 3 deg; ties: first in document order -> element {point.id}
 * - longestSide: segment with max Euclidean length; ties: first in document order -> element {segment.id}
 *
 * Returns ResolvedTarget if found, null otherwise. Never throws.
 */
export function resolveSemantic(
  scene: DiagramScene | null | undefined,
  name: SemanticName
): ResolvedTarget | null {
  if (!scene) return null;

  try {
    switch (name) {
      case 'peak': {
        if (!scene.polylines || scene.polylines.length === 0) return null;
        let bestPt: { x: number; y: number } | null = null;
        let minY = Infinity;

        for (const poly of scene.polylines) {
          if (!poly.points || !Array.isArray(poly.points)) continue;
          for (const pt of poly.points) {
            if (
              !Array.isArray(pt) ||
              pt.length < 2 ||
              typeof pt[0] !== 'number' ||
              typeof pt[1] !== 'number' ||
              !Number.isFinite(pt[0]) ||
              !Number.isFinite(pt[1]) ||
              pt[0] < 0 ||
              pt[0] > 1 ||
              pt[1] < 0 ||
              pt[1] > 1
            ) {
              continue;
            }
            const y = pt[1];
            // Ties: first in document order -> strict less than
            if (y < minY) {
              minY = y;
              bestPt = { x: pt[0], y: pt[1] };
            }
          }
        }

        if (!bestPt) return null;
        return {
          x: bestPt.x,
          y: bestPt.y,
          label: 'peak',
        };
      }

      case 'trough': {
        if (!scene.polylines || scene.polylines.length === 0) return null;
        let bestPt: { x: number; y: number } | null = null;
        let maxY = -Infinity;

        for (const poly of scene.polylines) {
          if (!poly.points || !Array.isArray(poly.points)) continue;
          for (const pt of poly.points) {
            if (
              !Array.isArray(pt) ||
              pt.length < 2 ||
              typeof pt[0] !== 'number' ||
              typeof pt[1] !== 'number' ||
              !Number.isFinite(pt[0]) ||
              !Number.isFinite(pt[1]) ||
              pt[0] < 0 ||
              pt[0] > 1 ||
              pt[1] < 0 ||
              pt[1] > 1
            ) {
              continue;
            }
            const y = pt[1];
            // Ties: first in document order -> strict greater than
            if (y > maxY) {
              maxY = y;
              bestPt = { x: pt[0], y: pt[1] };
            }
          }
        }

        if (!bestPt) return null;
        return {
          x: bestPt.x,
          y: bestPt.y,
          label: 'lowest point',
        };
      }

      case 'origin': {
        if (!scene.axes) return null;
        const { x_axis_y, y_axis_x } = scene.axes;
        if (
          x_axis_y == null ||
          y_axis_x == null ||
          typeof x_axis_y !== 'number' ||
          typeof y_axis_x !== 'number' ||
          !Number.isFinite(x_axis_y) ||
          !Number.isFinite(y_axis_x) ||
          x_axis_y < 0 ||
          x_axis_y > 1 ||
          y_axis_x < 0 ||
          y_axis_x > 1
        ) {
          return null;
        }
        // point (y_axis_x, x_axis_y) per spec
        return {
          x: y_axis_x,
          y: x_axis_y,
          label: 'origin',
        };
      }

      case 'tallestBar': {
        if (!scene.bars || scene.bars.length === 0) return null;
        let bestBar: (typeof scene.bars)[number] | null = null;
        let maxValue = -Infinity;

        for (const bar of scene.bars) {
          if (
            bar.value == null ||
            typeof bar.value !== 'number' ||
            !Number.isFinite(bar.value)
          ) {
            continue;
          }
          // Ties: first in document order -> strict greater than
          if (bar.value > maxValue) {
            maxValue = bar.value;
            bestBar = bar;
          }
        }

        if (!bestBar) return null;
        return resolveTarget(scene, { kind: 'element', elementId: bestBar.id });
      }

      case 'shortestBar': {
        if (!scene.bars || scene.bars.length === 0) return null;
        let bestBar: (typeof scene.bars)[number] | null = null;
        let minValue = Infinity;

        for (const bar of scene.bars) {
          if (
            bar.value == null ||
            typeof bar.value !== 'number' ||
            !Number.isFinite(bar.value)
          ) {
            continue;
          }
          // Ties: first in document order -> strict less than
          if (bar.value < minValue) {
            minValue = bar.value;
            bestBar = bar;
          }
        }

        if (!bestBar) return null;
        return resolveTarget(scene, { kind: 'element', elementId: bestBar.id });
      }

      case 'rightAngle': {
        if (
          !scene.points ||
          !scene.segments ||
          scene.points.length === 0 ||
          scene.segments.length === 0
        ) {
          return null;
        }

        // Map points by id for fast lookup
        const pointMap = new Map<string, (typeof scene.points)[number]>();
        for (const p of scene.points) {
          pointMap.set(p.id, p);
        }

        // Check points in document order
        for (const p of scene.points) {
          if (
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            p.x < 0 ||
            p.x > 1 ||
            p.y < 0 ||
            p.y > 1
          ) {
            continue;
          }

          // Ensure this point is not shadowed by an earlier point with identical coordinates
          const firstWithCoords = scene.points.find(
            (pt) => Math.abs(pt.x - p.x) < 1e-5 && Math.abs(pt.y - p.y) < 1e-5
          );
          if (firstWithCoords && firstWithCoords.id !== p.id) {
            continue;
          }

          // Must have EXACTLY two incident segments
          const incident = scene.segments.filter(
            (s) => s.a === p.id || s.b === p.id
          );
          if (incident.length !== 2) continue;

          const s1 = incident[0];
          const s2 = incident[1];
          if (!s1 || !s2) continue;

          const other1Id = s1.a === p.id ? s1.b : s1.a;
          const other2Id = s2.a === p.id ? s2.b : s2.a;
          if (other1Id === other2Id) continue;

          const p1 = pointMap.get(other1Id);
          const p2 = pointMap.get(other2Id);
          if (!p1 || !p2) continue;

          if (
            !Number.isFinite(p1.x) ||
            !Number.isFinite(p1.y) ||
            !Number.isFinite(p2.x) ||
            !Number.isFinite(p2.y)
          ) {
            continue;
          }

          // Incident vectors from p in scene space
          const v1x = p1.x - p.x;
          const v1y = p1.y - p.y;
          const v2x = p2.x - p.x;
          const v2y = p2.y - p.y;

          const len1 = Math.hypot(v1x, v1y);
          const len2 = Math.hypot(v2x, v2y);
          if (len1 <= 1e-9 || len2 <= 1e-9) continue;

          const dot = v1x * v2x + v1y * v2y;
          const cosTheta = Math.max(-1, Math.min(1, dot / (len1 * len2)));
          const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;

          // Angle within 90 +/- 3 degrees in scene space
          if (Math.abs(angleDeg - 90) <= 3) {
            return resolveTarget(scene, { kind: 'element', elementId: p.id });
          }
        }

        return null;
      }

      case 'longestSide': {
        if (
          !scene.segments ||
          !scene.points ||
          scene.segments.length === 0 ||
          scene.points.length === 0
        ) {
          return null;
        }

        const pointMap = new Map<string, (typeof scene.points)[number]>();
        for (const p of scene.points) {
          pointMap.set(p.id, p);
        }

        let bestSeg: (typeof scene.segments)[number] | null = null;
        let maxLength = -1;

        for (const seg of scene.segments) {
          const p1 = pointMap.get(seg.a);
          const p2 = pointMap.get(seg.b);
          if (!p1 || !p2) continue;

          if (
            !Number.isFinite(p1.x) ||
            !Number.isFinite(p1.y) ||
            !Number.isFinite(p2.x) ||
            !Number.isFinite(p2.y)
          ) {
            continue;
          }

          const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          // Ties: first in document order -> strict greater than
          if (length > maxLength) {
            maxLength = length;
            bestSeg = seg;
          }
        }

        if (!bestSeg) return null;
        return resolveTarget(scene, { kind: 'element', elementId: bestSeg.id });
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
