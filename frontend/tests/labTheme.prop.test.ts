/**
 * Property-based tests for Frankenstein's Laboratory theme (Requirement 14, P18–P20)
 *
 * Written by Antigravity (agy) on the owner's instruction, awaiting Kiro review.
 * Tests validate:
 * - P18: Alive animation duration bound (<= 1.2s) and flash frequency (<= 3 flashes/s) (WCAG 2.3.1)
 * - P19: CSS @import ordering and stylesheet integrity
 * - P20: Design token color conformance and detection of bare hex literals
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
// @ts-expect-error Node.js runtime path module in Vitest node environment
import path from 'node:path';
// @ts-expect-error Node.js runtime url module in Vitest node environment
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stylesDir = path.resolve(__dirname, '../src/styles');
const componentsDir = path.resolve(__dirname, '../src/components/lab');

// Helper to load stylesheet content
function loadStylesheet(fileName: string): string {
  return fs.readFileSync(path.join(stylesDir, fileName), 'utf-8') as string;
}

// Strip CSS comments
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('Requirement 14: Frankenstein Laboratory Theme Property Tests (agy, awaiting Kiro review)', () => {
  // ---------------------------------------------------------------------------
  // Property P18: Alive animation bound and flash frequency
  // ---------------------------------------------------------------------------
  describe('Property P18: Alive animation bound and flash frequency (Req 14.5, WCAG 2.3.1)', () => {
    interface AliveAnimationSpec {
      name: string;
      sourceFile: string;
      durationMs: number;
      pulseCount: number;
      keyframePercentages: number[];
      peakPercentages: number[];
    }

    interface KeyframeStop {
      percentage: number;
      intensity: number;
    }

    // Helper: parse custom properties declared in tokens.css
    function parseTokens(tokensCss: string): Record<string, string> {
      const clean = stripCssComments(tokensCss);
      const tokenMap: Record<string, string> = {};
      const tokenRegex = /(--gt-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
      let match: RegExpExecArray | null;
      while ((match = tokenRegex.exec(clean)) !== null) {
        tokenMap[match[1]!] = match[2]!.trim();
      }
      return tokenMap;
    }

    // Helper: resolve duration in ms from duration expression (supporting var(--token, fallback) and direct ms/s values)
    function parseDurationMs(rawDuration: string, tokens: Record<string, string>): number {
      let val = rawDuration.trim();
      const varMatch = val.match(/var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\)/);
      if (varMatch) {
        const varName = varMatch[1]!;
        const fallback = varMatch[2];
        if (tokens[varName]) {
          val = tokens[varName]!.trim();
        } else if (fallback) {
          val = fallback.trim();
        }
      }

      const msMatch = val.match(/(\d+(?:\.\d+)?)\s*ms/);
      if (msMatch) {
        return Number(msMatch[1]);
      }
      const sMatch = val.match(/(\d+(?:\.\d+)?)\s*s/);
      if (sMatch) {
        return Number(sMatch[1]) * 1000;
      }
      throw new Error(`Could not parse duration: "${rawDuration}" (resolved: "${val}")`);
    }

    // Helper: find animation / animation-duration rule using animationName and resolve its duration
    function findAnimationDuration(animationName: string, css: string, tokens: Record<string, string>): number {
      const clean = stripCssComments(css);
      const animRegex = new RegExp(`animation\\s*:\\s*([^;]*\\b${animationName}\\b[^;]*);`);
      const animMatch = animRegex.exec(clean);
      if (animMatch) {
        const decl = animMatch[1]!;
        const durVarMatch = decl.match(/var\(\s*--gt-[a-zA-Z0-9_-]+(?:\s*,\s*[^)]+)?\)/);
        if (durVarMatch) {
          return parseDurationMs(durVarMatch[0], tokens);
        }
        const directDurMatch = decl.match(/\b\d+(?:\.\d+)?(?:ms|s)\b/);
        if (directDurMatch) {
          return parseDurationMs(directDurMatch[0], tokens);
        }
      }

      const blockRegex = /\{([^}]+)\}/g;
      let blockMatch: RegExpExecArray | null;
      while ((blockMatch = blockRegex.exec(clean)) !== null) {
        const block = blockMatch[1]!;
        if (block.includes(animationName)) {
          const durMatch = block.match(/animation-duration\s*:\s*([^;]+);/);
          if (durMatch) {
            return parseDurationMs(durMatch[1]!, tokens);
          }
        }
      }

      throw new Error(`Could not find animation declaration using ${animationName}`);
    }

    // Helper: parse keyframe stops and extract visual intensity (opacity, glow box-shadow)
    function parseKeyframeStops(animationName: string, css: string): KeyframeStop[] {
      const clean = stripCssComments(css);
      const kfHeaderRegex = new RegExp(`@keyframes\\s+${animationName}\\s*\\{`);
      const kfHeaderMatch = kfHeaderRegex.exec(clean);
      if (!kfHeaderMatch) {
        throw new Error(`@keyframes ${animationName} not found`);
      }

      const startIndex = kfHeaderMatch.index + kfHeaderMatch[0].length;
      let braceCount = 1;
      let endIndex = startIndex;
      while (endIndex < clean.length && braceCount > 0) {
        if (clean[endIndex] === '{') braceCount++;
        else if (clean[endIndex] === '}') braceCount--;
        endIndex++;
      }
      const kfBody = clean.slice(startIndex, endIndex - 1);

      const stopRegex = /(from|to|\d+(?:\.\d+)?%)\s*\{([^}]*)\}/g;
      let stopMatch: RegExpExecArray | null;
      const stops: KeyframeStop[] = [];

      while ((stopMatch = stopRegex.exec(kfBody)) !== null) {
        const rawPct = stopMatch[1]!;
        const body = stopMatch[2]!;

        let percentage = 0;
        if (rawPct === 'from') percentage = 0;
        else if (rawPct === 'to') percentage = 100;
        else percentage = parseFloat(rawPct.replace('%', ''));

        let intensity = 0;
        const opacityMatch = body.match(/opacity\s*:\s*([0-9.]+)/);
        if (opacityMatch) {
          intensity = parseFloat(opacityMatch[1]!);
        } else if (body.includes('box-shadow')) {
          const shadowMatch = body.match(/box-shadow\s*:\s*([^;]+);/);
          if (shadowMatch) {
            const shadowVal = shadowMatch[1]!.trim();
            if (shadowVal === 'none') {
              intensity = 0;
            } else {
              // Extract glow blur radius from 0 0 (\d+)px
              const glowMatches = [...shadowVal.matchAll(/0\s+0\s+(\d+)px/g)];
              if (glowMatches.length > 0) {
                intensity = Math.max(...glowMatches.map((m) => Number(m[1])));
              } else {
                intensity = 0;
              }
            }
          }
        }

        stops.push({ percentage, intensity });
      }

      stops.sort((a, b) => a.percentage - b.percentage);
      return stops;
    }

    // Dynamically parse all alive animations from stylesheets and tokens
    function parseAliveAnimations(): AliveAnimationSpec[] {
      const labCss = loadStylesheet('lab.css');
      const exploreCss = loadStylesheet('explore.css');
      const tokensCss = loadStylesheet('tokens.css');
      const tokens = parseTokens(tokensCss);

      const targets = [
        { name: 'gt-spark-arc-play', sourceFile: 'lab.css', css: labCss },
        { name: 'gt-spark-glow-play', sourceFile: 'lab.css', css: labCss },
        { name: 'gt-alive-border-pulse', sourceFile: 'explore.css', css: exploreCss },
        { name: 'gt-alive-hud-pulse', sourceFile: 'explore.css', css: exploreCss },
      ];

      return targets.map(({ name, sourceFile, css }) => {
        const durationMs = findAnimationDuration(name, css, tokens);
        const stops = parseKeyframeStops(name, css);
        const keyframePercentages = stops.map((s) => s.percentage);

        // Derive peaks: a peak is a stop where the animated opacity/box-shadow glow value
        // is strictly higher than both neighbours (local maximum). This matches the visual
        // pulse energy peaks and counts the non-zero interior pulse stops.
        const peakPercentages: number[] = [];
        for (let i = 1; i < stops.length - 1; i++) {
          const prev = stops[i - 1]!.intensity;
          const curr = stops[i]!.intensity;
          const next = stops[i + 1]!.intensity;
          if (curr > prev && curr > next) {
            peakPercentages.push(stops[i]!.percentage);
          }
        }

        return {
          name,
          sourceFile,
          durationMs,
          pulseCount: peakPercentages.length,
          keyframePercentages,
          peakPercentages,
        };
      });
    }

    const aliveAnimations: AliveAnimationSpec[] = parseAliveAnimations();

    it('asserts that parsed CSS animation durations in explore.css and lab.css are <= 1.2s', () => {
      const labCss = loadStylesheet('lab.css');
      const exploreCss = loadStylesheet('explore.css');
      const tokensCss = loadStylesheet('tokens.css');

      // Verify that alive keyframes are declared in the expected stylesheets
      expect(labCss).toContain('@keyframes gt-spark-arc-play');
      expect(labCss).toContain('@keyframes gt-spark-glow-play');
      expect(exploreCss).toContain('@keyframes gt-alive-border-pulse');
      expect(exploreCss).toContain('@keyframes gt-alive-hud-pulse');

      // Check --gt-spark-duration token
      const durationTokenMatch = tokensCss.match(/--gt-spark-duration:\s*(\d+)ms/);
      expect(durationTokenMatch).not.toBeNull();
      const declaredTokenMs = Number(durationTokenMatch?.[1]);
      expect(declaredTokenMs).toBeLessThanOrEqual(1200);

      // Verify Spark.tsx timer duration
      const sparkTsx = fs.readFileSync(path.join(componentsDir, 'Spark.tsx'), 'utf-8') as string;
      const sparkTimeoutMatch = sparkTsx.match(/setTimeout\(\(\)\s*=>\s*\{[^}]*onDoneRef[^}]*\},?\s*(\d+)\)/);
      expect(sparkTimeoutMatch).not.toBeNull();
      const sparkTimeoutMs = Number(sparkTimeoutMatch?.[1]);
      expect(sparkTimeoutMs).toBeLessThanOrEqual(1200);

      // Fast-check property across all alive animations
      fc.assert(
        fc.property(fc.constantFrom(...aliveAnimations), (anim) => {
          const durationSec = anim.durationMs / 1000;
          expect(durationSec).toBeLessThanOrEqual(1.2);
          const flashFrequencyHz = anim.pulseCount / durationSec;
          expect(flashFrequencyHz).toBeLessThanOrEqual(3.0);
          return durationSec <= 1.2 && flashFrequencyHz <= 3.0;
        }),
        { numRuns: 100 },
      );
    });

    it('P18: temporal sampling over arbitrary 1.0s intervals confirms <= 3 flashes per second', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...aliveAnimations),
          fc.double({ min: 0, max: 0.2, noNaN: true }), // Start of arbitrary 1s observation window
          (anim, windowStartSec) => {
            const windowEndSec = windowStartSec + 1.0;
            const animDurationSec = anim.durationMs / 1000;

            // Count peaks that fall within [windowStartSec, windowEndSec]
            // Keyframe peaks occur at peakPercentages / 100 * animDurationSec
            let flashesInWindow = 0;
            for (const peakPct of anim.peakPercentages) {
              const peakSec = (peakPct / 100) * animDurationSec;
              if (peakSec >= windowStartSec && peakSec <= windowEndSec) {
                flashesInWindow++;
              }
            }

            expect(flashesInWindow).toBeLessThanOrEqual(3);
            return flashesInWindow <= 3;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Property P19: CSS @import ordering and stylesheet integrity
  // ---------------------------------------------------------------------------
  describe('Property P19: CSS @import ordering and stylesheet integrity (Req 14.1, 14.6)', () => {
    const cssFileNames = (fs.readdirSync(stylesDir) as string[]).filter((f: string) => f.endsWith('.css'));

    it('asserts that every @import in any styles/*.css file precedes all style rules', () => {
      expect(cssFileNames.length).toBeGreaterThan(0);

      fc.assert(
        fc.property(fc.constantFrom(...cssFileNames), (fileName) => {
          const rawCss = loadStylesheet(fileName);
          const cleanCss = stripCssComments(rawCss);

          const importRegex = /@import\s+[^;]+;/g;
          let match: RegExpExecArray | null;

          while ((match = importRegex.exec(cleanCss)) !== null) {
            const preceding = cleanCss.slice(0, match.index);
            // Preceding content may only contain whitespace, @charset, and prior @import statements
            const nonImportPreceding = preceding
              .replace(/@charset\s+[^;]+;/g, '')
              .replace(/@import\s+[^;]+;/g, '')
              .trim();

            expect(
              nonImportPreceding,
              `In "${fileName}", @import statement "${match[0]}" appears after style rules: "${nonImportPreceding.slice(0, 80)}"`,
            ).toBe('');
          }
          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('asserts that every @import target file actually exists on disk', () => {
      fc.assert(
        fc.property(fc.constantFrom(...cssFileNames), (fileName) => {
          const rawCss = loadStylesheet(fileName);
          const cleanCss = stripCssComments(rawCss);

          const importRegex = /@import\s+(?:url\(['"]?([^'"\)]+)['"]?\)|['"]([^'"]+)['"])/g;
          let match: RegExpExecArray | null;

          while ((match = importRegex.exec(cleanCss)) !== null) {
            const importTarget = match[1] || match[2];
            if (!importTarget) continue;
            const resolvedPath = path.resolve(stylesDir, importTarget);
            expect(
              fs.existsSync(resolvedPath),
              `Imported file "${importTarget}" in "${fileName}" not found at "${resolvedPath}"`,
            ).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Property P20: Design token color conformance
  // ---------------------------------------------------------------------------
  describe('Property P20: Design token color conformance (Req 14.1, 14.6)', () => {
    interface HexOccurrence {
      file: string;
      line: number;
      hex: string;
      fullLine: string;
      isTokenDefinition: boolean;
      isInsideVar: boolean;
    }

    /**
     * Documented allow-list of legacy bare hex literals identified during retroactive spec audit.
     * All 8 legacy instances in global.css and explore.css have been migrated to var(--gt-*) tokens
     * (Lane x0-theme-tokens). Allow-list is now empty.
     */
    const legacyBareHexAllowList = new Set<string>();

    function extractHexOccurrences(fileName: string): HexOccurrence[] {
      const raw = loadStylesheet(fileName);
      const clean = stripCssComments(raw);
      const lines = clean.split(/\r?\n/);
      const occurrences: HexOccurrence[] = [];

      const hexRegex = /#(?:[0-9a-fA-F]{3,8})\b/g;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Check if line defines a CSS variable (--gt-*: #hex)
        const isTokenDefinition = /^\s*--gt-[a-zA-Z0-9_-]+:\s*#[0-9a-fA-F]{3,8}/.test(line);

        let match: RegExpExecArray | null;
        while ((match = hexRegex.exec(line)) !== null) {
          const hex = match[0].toLowerCase();
          const matchIndex = match.index;

          // Check if this hex occurrence is inside a var(--gt-*, #hex) call
          const precedingOnLine = line.slice(0, matchIndex);
          const hasOpenVar = /var\(\s*--gt-[a-zA-Z0-9_-]+(?:\s*,\s*[^)]*)?$/.test(precedingOnLine);

          occurrences.push({
            file: fileName,
            line: i + 1,
            hex,
            fullLine: line.trim(),
            isTokenDefinition,
            isInsideVar: hasOpenVar,
          });
        }
      }
      return occurrences;
    }

    const screenStylesheets = ['lab.css', 'explore.css', 'correct.css', 'saved.css', 'settings.css', 'global.css', 'teach.css'];

    it('extracts hex color occurrences from all screen and component stylesheets', () => {
      let totalOccurrences = 0;
      for (const file of screenStylesheets) {
        const occs = extractHexOccurrences(file);
        totalOccurrences += occs.length;
      }
      expect(totalOccurrences).toBeGreaterThan(0);
    });

    it('P20: every color declaration consumes CSS custom properties var(--gt-*) or documented fallbacks', () => {
      const allOccurrences: HexOccurrence[] = [];
      for (const file of screenStylesheets) {
        allOccurrences.push(...extractHexOccurrences(file));
      }

      fc.assert(
        fc.property(fc.constantFrom(...allOccurrences), (occ) => {
          // Token definitions in tokens.css or :root are valid source-of-truth definitions
          if (occ.isTokenDefinition) {
            return true;
          }

          // Conformance requirement: Hex must be wrapped in var(--gt-*) as a fallback,
          // OR must be explicitly registered on the retroactive spec allow-list.
          const isManagedByToken = occ.isInsideVar;
          const isDocumentedLegacy = legacyBareHexAllowList.has(`${occ.file}:${occ.hex}`);

          const isCompliant = isManagedByToken || isDocumentedLegacy;

          expect(
            isCompliant,
            `Unmanaged bare hex literal ${occ.hex} at ${occ.file}:${occ.line} ("${occ.fullLine}"). ` +
              `Every color declaration must consume var(--gt-*) tokens or documented fallbacks.`,
          ).toBe(true);

          return isCompliant;
        }),
        { numRuns: 200 },
      );
    });
  });
});
