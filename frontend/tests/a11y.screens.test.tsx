interface NodeFs {
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory(): boolean };
}

interface NodePath {
  join: (...paths: string[]) => string;
}

const fsModule = 'node:fs';
const pathModule = 'node:path';
const fs = (await import(/* @vite-ignore */ fsModule)) as unknown as NodeFs;
const path = (await import(/* @vite-ignore */ pathModule)) as unknown as NodePath;

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import type { SavedDiagram } from '../src/core/savedDiagrams';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { getLang, setLang, tables, t, type Lang } from '../src/i18n';
import { Capture } from '../src/screens/Capture';
import { Correct } from '../src/screens/Correct';
import { Explore } from '../src/screens/Explore';
import { SavedDiagrams } from '../src/screens/SavedDiagrams';
import { Start } from '../src/screens/Start';
import { LabSettings } from '../src/components/LabSettings';
import {
  getAllElements,
  getAccessibleName,
  isElementHidden,
  parseHtml,
  validateScreenMarkup,
  type ParsedElement,
} from './helpers/a11yDom';

interface ReactDispatcher {
  useState?: <T>(initial: T | (() => T)) => [T, (val: T) => void];
  _gtPatched?: boolean;
}

interface ReactInternalContainer {
  H?: ReactDispatcher | null;
}

type StateOverride = <T>(initial: T | (() => T)) => [T, (val: T) => void];
let currentStateOverride: StateOverride | null = null;

const internals = (React as unknown as Record<string, unknown>)
  .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as ReactInternalContainer | undefined;

if (internals) {
  let hVal = internals.H;
  Object.defineProperty(internals, 'H', {
    configurable: true,
    enumerable: true,
    get(): ReactDispatcher | null | undefined {
      return hVal;
    },
    set(dispatcher: ReactDispatcher | null | undefined): void {
      hVal = dispatcher;
      if (dispatcher && !dispatcher._gtPatched) {
        dispatcher._gtPatched = true;
        const origUseState = dispatcher.useState;
        dispatcher.useState = (<T,>(initial: T | (() => T)): [T, (val: T) => void] => {
          if (currentStateOverride) {
            return currentStateOverride(initial);
          }
          return origUseState
            ? origUseState(initial)
            : [typeof initial === 'function' ? (initial as () => T)() : initial, () => {}];
        });
      }
    },
  });
}

// In ESM without @types/node, resolve directory from import.meta.url
const testDir = new URL('.', import.meta.url).pathname.replace(/^\/([a-zA-Z]:\/)/, '$1');

const sampleTriangle: DiagramScene = JSON.parse(
  fs.readFileSync(path.join(testDir, '../public/samples/triangle.json'), 'utf-8'),
);
const sampleSine: DiagramScene = JSON.parse(
  fs.readFileSync(path.join(testDir, '../public/samples/sine.json'), 'utf-8'),
);
const sampleBarchart: DiagramScene = JSON.parse(
  fs.readFileSync(path.join(testDir, '../public/samples/barchart.json'), 'utf-8'),
);

const rawScene: DiagramScene = {
  kind: 'unknown',
  title: 'Raw Diagram',
  polylines: [
    {
      id: 'p1',
      label: null,
      points: [
        [0.1, 0.1],
        [0.9, 0.9],
      ],
    },
  ],
};

function createMockDrivers(options: { canSpeak?: boolean; canListen?: boolean } = {}): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: options.canSpeak ?? true,
      canListen: options.canListen ?? true,
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

function renderSavedDiagramsWithState(
  drivers: Drivers,
  state: { entries: SavedDiagram[]; loading: boolean },
): string {
  let callCount = 0;
  currentStateOverride = <T,>(initial: T | (() => T)): [T, (val: T) => void] => {
    callCount++;
    if (callCount === 1) return [state.entries as unknown as T, () => {}];
    if (callCount === 2) return ['' as unknown as T, () => {}];
    if (callCount === 3) return [state.loading as unknown as T, () => {}];
    if (callCount === 4) return [null as unknown as T, () => {}];
    return [typeof initial === 'function' ? (initial as () => T)() : initial, () => {}];
  };

  try {
    return renderToStaticMarkup(
      createElement(SavedDiagrams, {
        diagramStore: drivers.diagramStore,
        speech: drivers.speech,
        onOpen: vi.fn(),
        onBack: vi.fn(),
      }),
    );
  } finally {
    currentStateOverride = null;
  }
}

function getPrimaryControlNames(html: string): string[] {
  const root = parseHtml(html);
  const elements = getAllElements(root);
  const idMap = new Map<string, ParsedElement>();
  const labelForMap = new Map<string, ParsedElement>();

  for (const el of elements) {
    if (el.attrs.id) idMap.set(el.attrs.id, el);
    if (el.tag === 'label' && el.attrs.for) labelForMap.set(el.attrs.for, el);
  }

  const names: string[] = [];
  for (const el of elements) {
    if (el.tag === 'button' || (el.tag === 'input' && !isElementHidden(el))) {
      const name = getAccessibleName(el, idMap, labelForMap);
      if (name) names.push(name);
    }
  }
  return names;
}

function getTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getTsxFiles(fullPath));
    } else if (entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Accessibility validation: all screens in en, hi, gu', () => {
  let initialLang: Lang;

  beforeEach(() => {
    initialLang = getLang();
  });

  afterEach(() => {
    setLang(initialLang);
  });

  const languages: Lang[] = ['en', 'hi', 'gu'];

  for (const lang of languages) {
    describe(`Language: ${lang}`, () => {
      beforeEach(() => {
        setLang(lang);
      });

      it('Start screen passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));
        const result = validateScreenMarkup(html, { allowNoH1: true });
        expect(result.violations).toEqual([]);
        expect(result.interactiveCount).toBeGreaterThanOrEqual(1);
      });

      it('Capture screen passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(
          createElement(Capture, {
            drivers,
            initialStatus: t('capture.prompt'),
            onScene: vi.fn(),
            onSavedDiagrams: vi.fn(),
          }),
        );
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
        expect(result.interactiveCount).toBeGreaterThanOrEqual(5);
      });

      it('Explore with triangle sample passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(
          createElement(Explore, {
            scene: sampleTriangle,
            announced: 'Triangle announcement',
            drivers,
            onBack: vi.fn(),
            onCorrect: vi.fn(),
          }),
        );
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
      });

      it('Explore with sine sample passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(
          createElement(Explore, {
            scene: sampleSine,
            announced: 'Sine announcement',
            drivers,
            onBack: vi.fn(),
            onCorrect: vi.fn(),
          }),
        );
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
      });

      it('Explore with bar chart sample passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(
          createElement(Explore, {
            scene: sampleBarchart,
            announced: 'Bar chart announcement',
            drivers,
            onBack: vi.fn(),
            onCorrect: vi.fn(),
          }),
        );
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
      });

      it('Explore in Raw Mode passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(
          createElement(Explore, {
            scene: rawScene,
            announced: t('raw.announce'),
            drivers,
            onBack: vi.fn(),
            isRaw: true,
          }),
        );
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
      });

      it('Saved diagrams empty passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderSavedDiagramsWithState(drivers, { entries: [], loading: false });
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
      });

      it('Saved diagrams with two entries passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const twoEntries: SavedDiagram[] = [
          {
            id: 'saved-1',
            title: 'Right Triangle ABC',
            createdAt: 1000,
            thumbnailDataUrl: 'data:image/png;base64,abc',
            scene: sampleTriangle,
            pinned: false,
          },
          {
            id: 'saved-2',
            title: 'Sales by quarter',
            createdAt: 2000,
            thumbnailDataUrl: '',
            scene: sampleBarchart,
            pinned: true,
          },
        ];
        const html = renderSavedDiagramsWithState(drivers, { entries: twoEntries, loading: false });
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
        expect(result.interactiveCount).toBe(7);
      });

      it('Correct screen passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(
          createElement(Correct, {
            scene: sampleTriangle,
            photoUrl: null,
            drivers,
            onSave: vi.fn(),
            onCancel: vi.fn(),
          }),
        );
        const result = validateScreenMarkup(html);
        expect(result.violations).toEqual([]);
        expect(result.h1Count).toBe(1);
      });

      it('Lab settings sheet when open passes a11y DOM checks', () => {
        const drivers = createMockDrivers();
        const html = renderToStaticMarkup(
          createElement(LabSettings, {
            open: true,
            onClose: vi.fn(),
            drivers,
          }),
        );
        // Modal sheet dialog header begins with h2 (#lab-settings-title)
        const result = validateScreenMarkup(html, { allowNoH1: true });
        expect(result.violations).toEqual([]);
        expect(result.interactiveCount).toBeGreaterThanOrEqual(7);
      });
    });
  }
});

describe('Live regions for spoken announcements (Requirement 2)', () => {
  it('Capture renders polite live region status when speech synthesis cannot speak', () => {
    const silent = createMockDrivers({ canSpeak: false });
    for (const lang of ['en', 'hi', 'gu'] as const) {
      setLang(lang);
      const html = renderToStaticMarkup(
        createElement(Capture, {
          drivers: silent,
          initialStatus: t('capture.prompt'),
          onScene: vi.fn(),
          onSavedDiagrams: vi.fn(),
        }),
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
    }
  });

  it('Explore renders polite live region status when speech synthesis cannot speak', () => {
    const silent = createMockDrivers({ canSpeak: false });
    for (const lang of ['en', 'hi', 'gu'] as const) {
      setLang(lang);
      const html = renderToStaticMarkup(
        createElement(Explore, {
          scene: sampleTriangle,
          announced: 'Triangle announcement',
          drivers: silent,
          onBack: vi.fn(),
        }),
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
    }
  });

  it('Explore in Raw Mode renders status live region banner in all three languages', () => {
    const drivers = createMockDrivers();
    for (const lang of ['en', 'hi', 'gu'] as const) {
      setLang(lang);
      const html = renderToStaticMarkup(
        createElement(Explore, {
          scene: rawScene,
          announced: t('raw.announce'),
          drivers,
          onBack: vi.fn(),
          isRaw: true,
        }),
      );
      expect(html).toContain('gt-explore__raw-notice');
      expect(html).toContain('role="status"');
    }
  });
});

describe('Document language (Requirement 2)', () => {
  it('frontend/index.html has lang attribute set on <html> tag', () => {
    const htmlPath = path.join(testDir, '../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const langMatch = /<html[^>]*\blang=["']([^"']+)["']/i.exec(htmlContent);
    expect(langMatch).not.toBeNull();
    expect(langMatch?.[1]).toBe('en');
  });
});

describe('Translation parity for primary controls (Requirement 2)', () => {
  const allowedBrandWordsAndUnits = new Set([
    'Ghost Touch',
    '1.0×',
    '1.0x',
    '0.8x',
    '1.25x',
    'English (English)',
    'Hindi (हिन्दी)',
    'Gujarati (ગુજરાતી)',
  ]);

  it('Start primary controls differ between English and Hindi/Gujarati', () => {
    const drivers = createMockDrivers();

    setLang('en');
    const namesEn = getPrimaryControlNames(renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() })));

    setLang('hi');
    const namesHi = getPrimaryControlNames(renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() })));

    setLang('gu');
    const namesGu = getPrimaryControlNames(renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() })));

    expect(namesEn.length).toBe(1);
    expect(namesHi.length).toBe(1);
    expect(namesGu.length).toBe(1);

    expect(namesHi[0]).not.toEqual(namesEn[0]);
    expect(namesGu[0]).not.toEqual(namesEn[0]);
  });

  it('Capture primary controls differ between English and Hindi/Gujarati', () => {
    const drivers = createMockDrivers();

    setLang('en');
    const namesEn = getPrimaryControlNames(
      renderToStaticMarkup(createElement(Capture, { drivers, initialStatus: t('capture.prompt'), onScene: vi.fn() })),
    );

    setLang('hi');
    const namesHi = getPrimaryControlNames(
      renderToStaticMarkup(createElement(Capture, { drivers, initialStatus: t('capture.prompt'), onScene: vi.fn() })),
    );

    setLang('gu');
    const namesGu = getPrimaryControlNames(
      renderToStaticMarkup(createElement(Capture, { drivers, initialStatus: t('capture.prompt'), onScene: vi.fn() })),
    );

    expect(namesEn.length).toBeGreaterThan(0);
    expect(namesHi.length).toEqual(namesEn.length);
    expect(namesGu.length).toEqual(namesEn.length);

    for (let i = 0; i < namesEn.length; i++) {
      const en = namesEn[i] ?? '';
      const hi = namesHi[i] ?? '';
      const gu = namesGu[i] ?? '';
      if (!allowedBrandWordsAndUnits.has(en)) {
        expect(hi, `Missing Hindi translation for Capture control "${en}"`).not.toEqual(en);
        expect(gu, `Missing Gujarati translation for Capture control "${en}"`).not.toEqual(en);
      }
    }
  });

  it('Explore primary controls differ between English and Hindi/Gujarati', () => {
    const drivers = createMockDrivers();

    setLang('en');
    const namesEn = getPrimaryControlNames(
      renderToStaticMarkup(
        createElement(Explore, { scene: sampleTriangle, announced: 'Triangle', drivers, onBack: vi.fn(), onCorrect: vi.fn() }),
      ),
    );

    setLang('hi');
    const namesHi = getPrimaryControlNames(
      renderToStaticMarkup(
        createElement(Explore, { scene: sampleTriangle, announced: 'Triangle', drivers, onBack: vi.fn(), onCorrect: vi.fn() }),
      ),
    );

    setLang('gu');
    const namesGu = getPrimaryControlNames(
      renderToStaticMarkup(
        createElement(Explore, { scene: sampleTriangle, announced: 'Triangle', drivers, onBack: vi.fn(), onCorrect: vi.fn() }),
      ),
    );

    for (let i = 0; i < namesEn.length; i++) {
      const en = namesEn[i] ?? '';
      const hi = namesHi[i] ?? '';
      const gu = namesGu[i] ?? '';
      if (!allowedBrandWordsAndUnits.has(en)) {
        expect(hi, `Missing Hindi translation for Explore control "${en}"`).not.toEqual(en);
        expect(gu, `Missing Gujarati translation for Explore control "${en}"`).not.toEqual(en);
      }
    }
  });

  it('Saved diagrams primary controls differ between English and Hindi/Gujarati', () => {
    const drivers = createMockDrivers();
    const entries: SavedDiagram[] = [
      {
        id: 'saved-1',
        title: 'Right Triangle ABC',
        createdAt: 1000,
        thumbnailDataUrl: 'data:image/png;base64,abc',
        scene: sampleTriangle,
        pinned: false,
      },
    ];

    setLang('en');
    const namesEn = getPrimaryControlNames(renderSavedDiagramsWithState(drivers, { entries, loading: false }));

    setLang('hi');
    const namesHi = getPrimaryControlNames(renderSavedDiagramsWithState(drivers, { entries, loading: false }));

    setLang('gu');
    const namesGu = getPrimaryControlNames(renderSavedDiagramsWithState(drivers, { entries, loading: false }));

    for (let i = 0; i < namesEn.length; i++) {
      const en = namesEn[i] ?? '';
      const hi = namesHi[i] ?? '';
      const gu = namesGu[i] ?? '';
      if (!allowedBrandWordsAndUnits.has(en)) {
        expect(hi, `Missing Hindi translation for SavedDiagrams control "${en}"`).not.toEqual(en);
        expect(gu, `Missing Gujarati translation for SavedDiagrams control "${en}"`).not.toEqual(en);
      }
    }
  });

  it('Correct primary controls differ between English and Hindi/Gujarati', () => {
    const drivers = createMockDrivers();

    setLang('en');
    const namesEn = getPrimaryControlNames(
      renderToStaticMarkup(createElement(Correct, { scene: sampleTriangle, photoUrl: null, drivers, onSave: vi.fn(), onCancel: vi.fn() })),
    );

    setLang('hi');
    const namesHi = getPrimaryControlNames(
      renderToStaticMarkup(createElement(Correct, { scene: sampleTriangle, photoUrl: null, drivers, onSave: vi.fn(), onCancel: vi.fn() })),
    );

    setLang('gu');
    const namesGu = getPrimaryControlNames(
      renderToStaticMarkup(createElement(Correct, { scene: sampleTriangle, photoUrl: null, drivers, onSave: vi.fn(), onCancel: vi.fn() })),
    );

    for (let i = 0; i < namesEn.length; i++) {
      const en = namesEn[i] ?? '';
      const hi = namesHi[i] ?? '';
      const gu = namesGu[i] ?? '';
      if (!allowedBrandWordsAndUnits.has(en)) {
        expect(hi, `Missing Hindi translation for Correct control "${en}"`).not.toEqual(en);
        expect(gu, `Missing Gujarati translation for Correct control "${en}"`).not.toEqual(en);
      }
    }
  });

  it('Lab settings sheet controls differ between English and Hindi/Gujarati', () => {
    const drivers = createMockDrivers();

    setLang('en');
    const namesEn = getPrimaryControlNames(
      renderToStaticMarkup(createElement(LabSettings, { open: true, onClose: vi.fn(), drivers })),
    );

    setLang('hi');
    const namesHi = getPrimaryControlNames(
      renderToStaticMarkup(createElement(LabSettings, { open: true, onClose: vi.fn(), drivers })),
    );

    setLang('gu');
    const namesGu = getPrimaryControlNames(
      renderToStaticMarkup(createElement(LabSettings, { open: true, onClose: vi.fn(), drivers })),
    );

    for (let i = 0; i < namesEn.length; i++) {
      const en = namesEn[i] ?? '';
      const hi = namesHi[i] ?? '';
      const gu = namesGu[i] ?? '';
      if (!allowedBrandWordsAndUnits.has(en)) {
        expect(hi, `Missing Hindi translation for LabSettings control "${en}"`).not.toEqual(en);
        expect(gu, `Missing Gujarati translation for LabSettings control "${en}"`).not.toEqual(en);
      }
    }
  });
});

describe('Static i18n key coverage (Requirement 3)', () => {
  it('every static t(...) key called in src/**/*.tsx exists in en, hi, and gu dictionaries', () => {
    const srcDir = path.join(testDir, '../src');
    const tsxFiles = getTsxFiles(srcDir);
    const regex = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g;
    const foundKeys = new Set<string>();

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) {
          foundKeys.add(match[1]);
        }
      }
    }

    expect(foundKeys.size).toBeGreaterThan(30);

    const missingEn: string[] = [];
    const missingHi: string[] = [];
    const missingGu: string[] = [];

    for (const key of Array.from(foundKeys).sort()) {
      if (!(key in tables.en)) missingEn.push(key);
      if (!(key in tables.hi)) missingHi.push(key);
      if (!(key in tables.gu)) missingGu.push(key);
    }

    expect(missingEn, `Missing keys in EN dictionary: ${missingEn.join(', ')}`).toEqual([]);
    expect(missingHi, `Missing keys in HI dictionary: ${missingHi.join(', ')}`).toEqual([]);
    expect(missingGu, `Missing keys in GU dictionary: ${missingGu.join(', ')}`).toEqual([]);
  });
});
