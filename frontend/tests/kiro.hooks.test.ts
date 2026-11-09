/**
 * Kiro Hooks Schema and Regex Validation Test
 *
 * Verifies that all hook definitions in `.kiro/hooks/` are valid JSON, adhere
 * strictly to the Kiro v1 schema, and have compilable matcher regular expressions.
 *
 * Written by Antigravity (agy), awaiting Kiro review.
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
const hooksDir = path.resolve(__dirname, '../../.kiro/hooks');

interface KiroHookAction {
  type: 'command' | 'agent';
  command?: string;
  prompt?: string;
  timeout?: number;
}

interface KiroHookItem {
  name: string;
  trigger: 'PostFileSave' | 'PreCommit' | 'Stop';
  description?: string;
  matcher?: string;
  action: KiroHookAction;
  enabled?: boolean;
}

interface KiroHookFile {
  version: string;
  hooks: KiroHookItem[];
}

describe('Kiro Hooks Configuration (.kiro/hooks/*.json)', () => {
  it('discovers hook JSON files in .kiro/hooks directory', () => {
    expect(fs.existsSync(hooksDir)).toBe(true);
    const files = (fs.readdirSync(hooksDir) as string[]).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(6);

    // Verify all three new Prompt 6 hooks are present
    expect(files).toContain('css-guard-on-save.json');
    expect(files).toContain('a11y-on-save.json');
    expect(files).toContain('pre-commit-build-log.json');

    // Verify existing hooks are preserved
    expect(files).toContain('review-builder-handoff.json');
    expect(files).toContain('prop-tests-on-save.json');
    expect(files).toContain('review-on-stop.json');
  });

  it('validates schema, required keys, and compilable matchers for all hooks', () => {
    const files = (fs.readdirSync(hooksDir) as string[]).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const fullPath = path.join(hooksDir, file);
      const raw = fs.readFileSync(fullPath, 'utf-8') as string;

      // 1. Must be valid JSON
      let data: KiroHookFile;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Invalid JSON in ${file}: ${(err as Error).message}`);
      }

      // 2. Top-level keys
      expect(data.version, `${file} missing or invalid version`).toBe('v1');
      expect(Array.isArray(data.hooks), `${file} hooks must be an array`).toBe(true);
      expect(data.hooks.length, `${file} hooks array must not be empty`).toBeGreaterThan(0);

      for (const hook of data.hooks) {
        // 3. Required hook fields
        expect(typeof hook.name, `Hook in ${file} missing name`).toBe('string');
        expect(hook.name.length, `Hook in ${file} has empty name`).toBeGreaterThan(0);

        expect(typeof hook.trigger, `Hook ${hook.name} in ${file} missing trigger`).toBe('string');
        expect(['PostFileSave', 'PreCommit', 'Stop']).toContain(hook.trigger);

        expect(typeof hook.action, `Hook ${hook.name} in ${file} missing action`).toBe('object');
        expect(['command', 'agent']).toContain(hook.action.type);

        if (hook.action.type === 'command') {
          expect(typeof hook.action.command, `Command hook ${hook.name} missing action.command`).toBe('string');
          expect(hook.action.command?.trim().length).toBeGreaterThan(0);
          if (hook.action.command?.includes('vitest')) {
            expect(
              hook.action.command,
              `Command hook ${hook.name} in ${file} runs vitest but is missing "--prefix frontend"`,
            ).toContain('--prefix frontend');
          }
        } else if (hook.action.type === 'agent') {
          expect(typeof hook.action.prompt, `Agent hook ${hook.name} missing action.prompt`).toBe('string');
          expect(hook.action.prompt?.trim().length).toBeGreaterThan(0);
        }

        // 4. Matcher regex validity
        if (hook.matcher !== undefined) {
          expect(typeof hook.matcher).toBe('string');
          expect(() => new RegExp(hook.matcher!)).not.toThrow();
        }

        // 5. Enabled flag
        if (hook.enabled !== undefined) {
          expect(typeof hook.enabled).toBe('boolean');
        }
      }
    }
  });

  it('verify-tests-on-save runs the Spec Ghost tests for exactly the verify files (Kiro, task 29)', () => {
    const hookPath = path.join(hooksDir, 'verify-tests-on-save.json');
    expect(fs.existsSync(hookPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(hookPath, 'utf-8')) as KiroHookFile;
    const hook = config.hooks[0]!;
    expect(hook.trigger).toBe('PostFileSave');
    expect(hook.action.type).toBe('command');
    for (const file of ['tests/verify.test.ts', 'tests/verify.review.test.ts', 'tests/k1.verifyWiring.test.ts']) {
      expect(hook.action.command).toContain(file);
    }

    const matcher = new RegExp(hook.matcher!);
    for (const yes of [
      'frontend/src/core/verify.ts',
      'frontend\\src\\core\\verify.ts',
      'frontend/src/verify/verify.ts',
      'frontend/tests/verify.test.ts',
      'frontend/tests/verify.review.test.ts',
      'frontend/tests/k1.verifyWiring.test.ts',
    ]) {
      expect(matcher.test(yes), yes).toBe(true);
    }
    for (const no of [
      'frontend/src/core/hitTest.ts',
      'frontend/src/screens/Teach.tsx',
      'frontend/src/components/teach/VerifyForm.tsx',
      'frontend/tests/teach.verify.test.tsx',
      'frontend/src/core/verify.ts.bak',
    ]) {
      expect(matcher.test(no), no).toBe(false);
    }
  });

  it('verifies matcher patterns correctly match expected file paths', () => {
    // CSS guard matcher
    const cssHookPath = path.join(hooksDir, 'css-guard-on-save.json');
    const cssHook: KiroHookFile = JSON.parse(fs.readFileSync(cssHookPath, 'utf-8'));
    const cssMatcher = new RegExp(cssHook.hooks[0]!.matcher!);
    expect(cssMatcher.test('frontend/src/styles/explore.css')).toBe(true);
    expect(cssMatcher.test('frontend\\src\\styles\\tokens.css')).toBe(true);
    expect(cssMatcher.test('frontend/src/screens/Explore.tsx')).toBe(false);

    // A11y guard matcher
    const a11yHookPath = path.join(hooksDir, 'a11y-on-save.json');
    const a11yHook: KiroHookFile = JSON.parse(fs.readFileSync(a11yHookPath, 'utf-8'));
    const a11yMatcher = new RegExp(a11yHook.hooks[0]!.matcher!);
    expect(a11yMatcher.test('frontend/src/screens/Explore.tsx')).toBe(true);
    expect(a11yMatcher.test('frontend\\src\\components\\AccessibleButton.tsx')).toBe(true);
    expect(a11yMatcher.test('frontend/src/styles/explore.css')).toBe(false);
  });
});
