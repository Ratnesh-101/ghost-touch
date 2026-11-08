/**
 * Regression test (Kiro, round 2, Task 26): `App` must call every hook on every render.
 *
 * Found by the round 2 CSP browser check: opening `#/debug` while the app was running crashed
 * React with error #300 ("Rendered fewer hooks than expected"), because `App` returned
 * `<Debug />` before a later `useCallback`. React only reports this at run time, and the test
 * suite has no DOM environment, so this test checks the rule on the source: inside `App`, no
 * `return` may come before the last hook call.
 */
import { describe, expect, it } from 'vitest';
import source from '../src/App.tsx?raw';

/** The body of `export function App()`, found by matching braces from its opening line. */
function appBody(): string {
  const start = source.indexOf('export function App(');
  expect(start).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error('App body not closed');
}

/** Only statements at the top level of the function body, so nested callbacks are ignored. */
function topLevelLines(body: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  let depth = 0;
  let lineStart = 0;
  let lineDepth = 0;
  for (let i = 0; i <= body.length; i++) {
    const ch = body[i];
    if (ch === '\n' || i === body.length) {
      if (lineDepth === 0) out.push({ text: body.slice(lineStart, i).trim(), index: out.length });
      lineStart = i + 1;
      lineDepth = depth;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
  }
  return out;
}

describe('App calls its hooks unconditionally (React error #300)', () => {
  const lines = topLevelLines(appBody());
  const hookLines = lines.filter((l) => /\buse[A-Z]\w*\(/.test(l.text));
  const lastHook = Math.max(...hookLines.map((l) => l.index));

  it('finds the hooks it is meant to check', () => {
    expect(hookLines.length).toBeGreaterThanOrEqual(5);
  });

  it('has no return statement before the last hook call', () => {
    const early = lines.filter((l) => l.index < lastHook && /^(if\s*\(.*\)\s*)?return\b/.test(l.text));
    expect(early.map((l) => l.text)).toEqual([]);
  });

  it('still renders the debug page for #/debug', () => {
    expect(source).toMatch(/hash === DEBUG_HASH\)\s*return <Debug \/>/);
  });
});
