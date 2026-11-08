/**
 * Security headers and CI permissions (Task 25, Requirement 16.4, 16.6, 16.8).
 *
 * Written by Kiro. `vercel.json` is the single source of the headers: Vercel sends them in
 * production and `vite preview` sends the same ones locally (see `siteHeaders` in
 * vite.config.ts), so the CSP can be checked with `npm run build && npm run preview`.
 */
import { describe, expect, it } from 'vitest';
import ciWorkflow from '../../.github/workflows/ci.yml?raw';
import vercelConfig from '../vercel.json';
import { siteHeaders } from '../vite.config';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const rules = (vercelConfig as { headers: HeaderRule[] }).headers;
const allRoutes = rules.find((r) => r.source === '/(.*)');
const header = (name: string): string | undefined =>
  allRoutes?.headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;

/** `directive -> list of sources` for a CSP string. */
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out[name] = sources;
  }
  return out;
}

describe('Content-Security-Policy (A6-04)', () => {
  const csp = parseCsp(header('Content-Security-Policy') ?? '');

  it('is sent on every route', () => {
    expect(allRoutes).toBeDefined();
    expect(header('Content-Security-Policy')).toBeTruthy();
  });

  it('forbids framing, plugins and foreign base URLs', () => {
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
  });

  it('keeps scripts strict: own origin only, no inline, no eval, no wildcard', () => {
    expect(csp['script-src']).toEqual(["'self'"]);
    for (const [directive, sources] of Object.entries(csp)) {
      expect(sources, directive).not.toContain("'unsafe-eval'");
      expect(sources, directive).not.toContain('*');
      expect(sources.filter((s) => s === 'http:' || s === 'https:'), directive).toEqual([]);
    }
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
  });

  it('allows what the PWA needs: fonts, images, workers, camera/audio blobs, own API', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['font-src']).toEqual(expect.arrayContaining(["'self'"]));
    expect(csp['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:']));
    expect(csp['worker-src']).toEqual(expect.arrayContaining(["'self'", 'blob:']));
    expect(csp['media-src']).toEqual(expect.arrayContaining(["'self'", 'blob:']));
    expect(csp['manifest-src']).toEqual(["'self'"]);
  });

  it('connects only to itself and the API origin', () => {
    const connect = csp['connect-src'] ?? [];
    expect(connect).toContain("'self'");
    const origins = connect.filter((s) => s !== "'self'");
    expect(origins).toEqual(['https://ghost-touch-api.onrender.com']);
  });
});

describe('Transport and permissions headers (A6-06)', () => {
  it('sends Strict-Transport-Security with at least a year', () => {
    const hsts = header('Strict-Transport-Security') ?? '';
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
  });

  it('grants camera and microphone to the app only and denies the rest', () => {
    const policy = header('Permissions-Policy') ?? '';
    expect(policy).toContain('camera=(self)');
    expect(policy).toContain('microphone=(self)');
    for (const feature of ['geolocation', 'payment', 'usb']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('keeps the framing and sniffing headers it already had', () => {
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBeTruthy();
  });

  it('serves the same headers from `vite preview` as Vercel sends', () => {
    const preview = siteHeaders();
    for (const { key, value } of allRoutes?.headers ?? []) {
      expect(preview[key]).toBe(value);
    }
  });
});

describe('CI workflow token (A6-09)', () => {
  it('declares read-only contents permission at the top level', () => {
    const topLevel = ciWorkflow.split(/^jobs:/m)[0] ?? '';
    expect(topLevel).toMatch(/^permissions:\s*\r?\n\s+contents:\s*read\s*$/m);
  });

  it('pins every action to a major version tag', () => {
    const uses = [...ciWorkflow.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1] ?? '');
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action, action).toMatch(/@v\d+$/);
  });
});
