/**
 * Requirement 53.15 to 53.18 (task 93): the Ghost Host wording is what the app actually speaks.
 * Covers W1 (next-step lines in the Explore and Raw Mode entry), W8 (Back to Start and Capture),
 * W4 to W6 (separate causes, a place for the typing box, an action in every capture line),
 * A3-02 (an online device that cannot reach the backend does not say "offline") and 53.17
 * (the app warms the backend when it starts).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { lintHostLine } from '../src/core/hostPolicy';
import type { DiagramScene } from '../src/core/scene';
import { leaveByBack, exploreAnnouncement, SCREEN_NAMES, type BackContext } from '../src/flow/navigation';
import { getLang, setLang, t, tables, type Lang } from '../src/i18n';
import appSource from '../src/App.tsx?raw';
import captureSource from '../src/screens/Capture.tsx?raw';

const LANGS: readonly Lang[] = ['en', 'hi', 'gu'];
const startLang = getLang();
afterEach(() => setLang(startLang));

const triangle: DiagramScene = {
  kind: 'geometry',
  title: 'Right triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.5, y: 0.2, label: 'C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B' },
    { id: 'BC', a: 'B', b: 'C' },
    { id: 'AC', a: 'A', b: 'C' },
  ],
};

describe('W1: the Explore and Raw Mode entry speak their host line, once', () => {
  it.each(LANGS)('Explore entry in %s uses host.explore.next and the Back hint', (lang) => {
    setLang(lang);
    const text = exploreAnnouncement(triangle, 'ai');
    expect(text).toContain(t('host.explore.next'));
    expect(text).toContain(t('explore.backHint'));
    expect(text.split(t('host.explore.next')).length - 1).toBe(1);
    expect(text).not.toContain(t('explore.gestureHint'));
  });

  it.each(LANGS)('Raw Mode entry in %s uses host.raw.next and not a second Back hint', (lang) => {
    setLang(lang);
    const raw: DiagramScene = { kind: 'unknown', points: [], segments: [] };
    const text = exploreAnnouncement(raw, 'raw', undefined, undefined, 'unreadable');
    expect(text).toContain(t('raw.announce'));
    expect(text).toContain(t('host.raw.next'));
    expect(text.split(t('host.raw.next')).length - 1).toBe(1);
    expect(text).not.toContain(t('explore.backHint'));
  });
});

describe('W8: no spoken Back path uses the old Start or Capture wording', () => {
  const contexts: BackContext[] = [];
  for (const dirty of [false, true]) {
    for (const fromShare of [false, true]) {
      for (const hasScene of [false, true]) {
        contexts.push({ dirty, fromShare, hasScene, correctDirty: dirty, buildDirty: dirty });
      }
    }
  }

  it('every Back step speaks a host line or a purpose-built key, never start.intro, capture.prompt or explore.gestureHint', () => {
    for (const screen of SCREEN_NAMES) {
      for (const ctx of contexts) {
        const step = leaveByBack(screen, ctx);
        expect(['start.intro', 'capture.prompt', 'explore.gestureHint']).not.toContain(step.announceKey);
        expect(tables.en[step.announceKey], `${screen} ${step.announceKey}`).toBeTruthy();
      }
    }
  });

  it('Back to Start speaks host.start.next and Back to Capture speaks host.capture.next', () => {
    const ctx: BackContext = { dirty: false, fromShare: false };
    expect(leaveByBack('capture', ctx).announceKey).toBe('host.start.next');
    expect(leaveByBack('explore', ctx).announceKey).toBe('host.capture.next');
    expect(leaveByBack('saved', ctx).announceKey).toBe('host.capture.next');
    expect(t('host.capture.next')).toMatch(/internet/i);
  });

  it('App.tsx speaks the host lines on its own Back paths', () => {
    expect(appSource).not.toContain("t('start.intro')");
    expect(appSource).not.toContain("t('capture.prompt')");
    expect(appSource).toContain("t('host.start.next')");
    expect(appSource).toContain("t('host.capture.next')");
  });
});

describe('W4, W5, W6: ask and capture error lines', () => {
  const ASK_KEYS = Object.keys(tables.en).filter((k) => k.startsWith('ask.error'));
  const CAPTURE_KEYS = Object.keys(tables.en).filter((k) => k.startsWith('capture.error'));

  it('has the three separate ask causes in every language', () => {
    for (const lang of LANGS) {
      const busy = tables[lang]['ask.errorBusy'];
      const http = tables[lang]['ask.errorServer'];
      const bad = tables[lang]['ask.errorBadResponse'];
      expect(new Set([busy, http, bad]).size, lang).toBe(3);
    }
  });

  it('every ask and capture error line passes the lint with an action word (en)', () => {
    expect(ASK_KEYS.length).toBeGreaterThan(8);
    expect(CAPTURE_KEYS.length).toBeGreaterThan(10);
    for (const key of [...ASK_KEYS, ...CAPTURE_KEYS]) {
      const lint = lintHostLine(tables.en[key] ?? '', 'en', 'error');
      expect(lint.problems, key).toEqual([]);
    }
  });

  it('the text-box lines say where the box is, in every language', () => {
    for (const key of ['ask.errorUnsupported', 'ask.errorEmpty']) {
      expect(tables.en[key], key).toMatch(/box below the diagram/);
    }
    for (const lang of LANGS) {
      for (const key of ['ask.errorUnsupported', 'ask.errorEmpty']) {
        const line = tables[lang][key] ?? '';
        expect(line, `${lang} ${key}`).not.toBe('');
        if (lang !== 'en') expect(line, `${lang} ${key}`).not.toBe(tables.en[key]);
      }
    }
  });

  it('an online failure names what still works and the offline line is separate (A3-02)', () => {
    expect(tables.en['capture.errorServer']).toMatch(/Samples and saved diagrams still work/);
    expect(tables.en['capture.errorServer']).not.toBe(tables.en['capture.errorOffline']);
    expect(tables.en['capture.errorServer']).not.toMatch(/offline/i);
  });
});

describe('A3-01 / 53.17: the backend is warmed when the app starts', () => {
  it('App.tsx and the Capture screen both call warmBackend', () => {
    expect(appSource).toMatch(/void warmBackend\(\)/);
    expect(captureSource).toMatch(/void warmBackend\(\)/);
  });

  it('Capture leaves the capture flow on unmount', () => {
    expect(captureSource).toContain('hostFlows.capture.leave()');
  });
});
