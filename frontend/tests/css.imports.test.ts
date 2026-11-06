/**
 * CSS Import Ordering and Existence Guard Test
 *
 * Verifies (Lane lab-explore3 / Brief Item 2):
 * - For every .css file in src/styles/, assert every @import line appears before any rule
 *   (ignoring comments and @charset), preventing bundler drops (Vite/PostCSS syntax errors).
 * - Every imported file in @import exists on disk.
 * - Every CSS file imported by global.css or components (import '...css') exists on disk.
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
// @ts-expect-error Node.js runtime path module in Vitest node environment
import path from 'node:path';
// @ts-expect-error Node.js runtime url module in Vitest node environment
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stylesDir = path.resolve(__dirname, '../src/styles');
const srcDir = path.resolve(__dirname, '../src');

describe('CSS Import Ordering Guard (Brief Item 2)', () => {
  const cssFiles = (fs.readdirSync(stylesDir) as string[]).filter((f: string) => f.endsWith('.css'));

  it('scans all CSS files in src/styles/ and asserts every @import appears before any rule', () => {
    expect(cssFiles.length).toBeGreaterThan(0);

    for (const file of cssFiles) {
      const fullPath = path.join(stylesDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8') as string;

      // Strip comments
      const clean = content.replace(/\/\*[\s\S]*?\*\//g, '');
      const importRegex = /@import\s+[^;]+;/g;
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(clean)) !== null) {
        const preceding = clean.slice(0, match.index);
        // Preceding content may only contain whitespace, @charset, and prior @import statements
        const nonImportPreceding = preceding
          .replace(/@charset\s+[^;]+;/g, '')
          .replace(/@import\s+[^;]+;/g, '')
          .trim();

        expect(
          nonImportPreceding,
          `In "${file}", @import statement "${match[0]}" appears after rules or statements: "${nonImportPreceding.slice(0, 100)}..."`,
        ).toBe('');
      }
    }
  });

  it('asserts that every file imported via @import in src/styles/ exists on disk', () => {
    for (const file of cssFiles) {
      const fullPath = path.join(stylesDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8') as string;
      const clean = content.replace(/\/\*[\s\S]*?\*\//g, '');

      // Match @import './file.css' or @import url('./file.css')
      const importRegex = /@import\s+(?:url\(['"]?([^'"\)]+)['"]?\)|['"]([^'"]+)['"])/g;
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(clean)) !== null) {
        const importTarget = match[1] || match[2];
        if (!importTarget) continue;
        const resolvedPath = path.resolve(stylesDir, importTarget);
        expect(
          fs.existsSync(resolvedPath),
          `Imported file "${importTarget}" in "${file}" does not exist at "${resolvedPath}"`,
        ).toBe(true);
      }
    }
  });

  it('asserts that every CSS file imported by components or screens in src/ exists on disk', () => {
    function getSourceFiles(dir: string): string[] {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(getSourceFiles(entryPath));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          results.push(entryPath);
        }
      }
      return results;
    }

    const sourceFiles = getSourceFiles(srcDir);
    expect(sourceFiles.length).toBeGreaterThan(0);

    let cssImportsFound = 0;
    for (const sourceFile of sourceFiles) {
      const code = fs.readFileSync(sourceFile, 'utf-8') as string;
      // Match import '...css' or import ... from '...css'
      const cssImportRegex = /import\s+(?:[^'"]*from\s+)?['"]([^'"]+\.css)['"]/g;
      let match: RegExpExecArray | null;

      while ((match = cssImportRegex.exec(code)) !== null) {
        const cssPath = match[1];
        if (!cssPath) continue;
        cssImportsFound++;
        const resolvedPath = path.resolve(path.dirname(sourceFile), cssPath);
        expect(
          fs.existsSync(resolvedPath),
          `Component "${path.relative(srcDir, sourceFile)}" imports "${cssPath}" which was not found at "${resolvedPath}"`,
        ).toBe(true);
      }
    }

    expect(cssImportsFound).toBeGreaterThanOrEqual(3);
  });
});
