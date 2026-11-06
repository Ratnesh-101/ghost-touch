/**
 * Tests for screen heading focus placement on mount (Finding 8 / MEDIUM).
 *
 * Requirements:
 * - Focus is lost on mount in Correct and SavedDiagrams: move focus to the screen heading
 * - Heading has tabIndex={-1} and is focused in a mount effect so TalkBack announces the screen
 * - Spoken messages are preserved without change (screens already speak on entry)
 */
// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers, type SpeechDriver } from '../src/drivers';
import { setLang } from '../src/i18n';
import { Correct } from '../src/screens/Correct';
import { SavedDiagrams } from '../src/screens/SavedDiagrams';

function makeMockSpeech(): SpeechDriver {
  return {
    speak: vi.fn(),
    listen: vi.fn(),
    canSpeak: true,
    canListen: true,
  };
}

function makeMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
    speech: makeMockSpeech(),
    diagramStore: new MemoryDiagramStore(),
  };
}

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Triangle',
  points: [
    { id: 'p1', x: 0.1, y: 0.1, label: 'A' },
    { id: 'p2', x: 0.9, y: 0.9, label: 'B' },
  ],
  segments: [{ id: 's1', a: 'p1', b: 'p2', label: 'AB' }],
};

describe('Finding 8: SavedDiagrams screen heading focus placement', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('renders heading with tabindex="-1" so it can receive programmatic focus', () => {
    const store = new MemoryDiagramStore();
    const speech = makeMockSpeech();
    const html = renderToStaticMarkup(
      createElement(SavedDiagrams, {
        diagramStore: store,
        speech,
        onOpen: vi.fn(),
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-saved__heading');
    expect(html).toMatch(/<h1[^>]*tabindex="-1"/);
    expect(html).toMatch(/<h1[^>]*class="[^"]*gt-saved__heading[^"]*"/);
  });

  it('attaches heading ref and executes .focus() in a mount useEffect in SavedDiagrams.tsx', () => {
    const tsxPath = new URL('../src/screens/SavedDiagrams.tsx', import.meta.url);
    const tsx = fs.readFileSync(tsxPath, 'utf-8') as string;

    // Check ref creation
    expect(tsx).toMatch(/headingRef\s*=\s*useRef<HTMLHeadingElement>\(null\)/);
    // Check ref attachment and tabIndex on h1
    expect(tsx).toMatch(/<h1[^>]*ref=\{headingRef\}/);
    expect(tsx).toMatch(/<h1[^>]*tabIndex=\{-1\}/);
    // Check focus call in useEffect
    expect(tsx).toMatch(/headingRef\.current\?\.focus\(\)/);
  });

  it('preserves spoken announcements on mount without duplication or alteration', () => {
    const tsxPath = new URL('../src/screens/SavedDiagrams.tsx', import.meta.url);
    const tsx = fs.readFileSync(tsxPath, 'utf-8') as string;

    // Must still speak error, empty, or diagram titles
    expect(tsx).toContain("say(t('saved.empty'))");
    expect(tsx).toContain("say(t('saved.errorLoad'))");
    expect(tsx).toContain('say(titles)');
  });
});

describe('Finding 8: Correct screen heading focus placement', () => {
  beforeEach(() => {
    setLang('en');
  });

  it('renders heading with tabindex="-1" so it can receive programmatic focus', () => {
    const drivers = makeMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Correct, {
        scene: sampleScene,
        photoUrl: null,
        drivers,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(html).toContain('gt-correct__title');
    expect(html).toMatch(/<h1[^>]*tabindex="-1"/);
    expect(html).toMatch(/<h1[^>]*class="[^"]*gt-correct__title[^"]*"/);
  });

  it('attaches heading ref and executes .focus() in a mount useEffect in Correct.tsx', () => {
    const tsxPath = new URL('../src/screens/Correct.tsx', import.meta.url);
    const tsx = fs.readFileSync(tsxPath, 'utf-8') as string;

    // Check ref creation
    expect(tsx).toMatch(/headingRef\s*=\s*useRef<HTMLHeadingElement>\(null\)/);
    // Check ref attachment and tabIndex on h1
    expect(tsx).toMatch(/<h1[^>]*ref=\{headingRef\}/);
    expect(tsx).toMatch(/<h1[^>]*tabIndex=\{-1\}/);
    // Check focus call in useEffect
    expect(tsx).toMatch(/headingRef\.current\?\.focus\(\)/);
  });

  it('preserves spoken announcement on mount in Correct.tsx', () => {
    const tsxPath = new URL('../src/screens/Correct.tsx', import.meta.url);
    const tsx = fs.readFileSync(tsxPath, 'utf-8') as string;

    // Must still speak intro on mount
    expect(tsx).toContain("speak(t('correct.intro'))");
  });
});
