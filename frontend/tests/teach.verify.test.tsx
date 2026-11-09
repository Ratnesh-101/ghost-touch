/**
 * Tests for VerifyForm and Diagram Validation in Teacher Editor (Lane t2-teach-editor).
 *
 * Requirements:
 * - Every edit result checked with validateShareScene
 * - Plain language errors shown; "Mark verified" disabled until valid
 * - Teacher name required (<= 60 chars)
 * - Note optional (<= 280 chars)
 * - Honest copy on screen: "This diagram was shared as a link. Ghost Touch has not verified it."
 * - i18n copy across en, hi, gu
 * - Minimum 48x48 px touch targets
 */

// @ts-expect-error Node runtime fs in Vitest node environment
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyForm } from '../src/components/teach/VerifyForm';
import { Teach } from '../src/screens/Teach';
import { MemoryDiagramStore, type Drivers, type SpeechRateSetting } from '../src/drivers';
import { LIMITS } from '../src/share';
import { setLang, t, tables } from '../src/i18n';
import type { DiagramScene } from '../src/core/scene';
import { parseHtml, getAllElements, getTextContent } from './helpers/a11yDom';

const teachCssPath = new URL('../src/styles/teach.css', import.meta.url);
const teachCss = fs.readFileSync(teachCssPath, 'utf-8') as string;

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('VerifyForm & Validation Blocking', () => {
  beforeEach(() => {
    setLang('en');
  });

  afterEach(() => {
    setLang('en');
  });

  it('renders honest copy on screen in English, Hindi, and Gujarati', () => {
    // English
    setLang('en');
    const honestEn = t('share.honesty');
    expect(honestEn).toBe(tables.en['share.honesty']);
    expect(honestEn).not.toContain('Verified');
    expect(honestEn.toLowerCase()).not.toContain('person reviewed');

    const htmlEn = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: 'Mrs. Sharma',
        note: '',
        isValidDiagram: true,
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );
    expect(htmlEn).toContain(honestEn);
    const rootEn = parseHtml(htmlEn);
    const noticeEn = getAllElements(rootEn).find((el) =>
      el.attrs['class']?.includes('gt-teach__honesty-notice'),
    );
    expect(noticeEn).toBeDefined();
    const noticeEnText = noticeEn ? getTextContent(noticeEn) : '';
    expect(noticeEnText).toBe(tables.en['share.honesty']);
    expect(noticeEnText).not.toContain('Verified');
    expect(noticeEnText.toLowerCase()).not.toContain('person reviewed');

    // Hindi
    setLang('hi');
    const honestHi = t('share.honesty');
    expect(honestHi).toBe(tables.hi['share.honesty']);
    expect(honestHi).not.toContain('Verified');
    expect(honestHi).not.toContain('सत्यापित');
    expect(honestHi.toLowerCase()).not.toContain('व्यक्ति ने');

    const htmlHi = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: 'श्रीमती शर्मा',
        note: '',
        isValidDiagram: true,
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );
    expect(htmlHi).toContain(honestHi);
    const rootHi = parseHtml(htmlHi);
    const noticeHi = getAllElements(rootHi).find((el) =>
      el.attrs['class']?.includes('gt-teach__honesty-notice'),
    );
    expect(noticeHi).toBeDefined();
    const noticeHiText = noticeHi ? getTextContent(noticeHi) : '';
    expect(noticeHiText).toBe(tables.hi['share.honesty']);
    expect(noticeHiText).not.toContain('Verified');
    expect(noticeHiText).not.toContain('सत्यापित');
    expect(noticeHiText.toLowerCase()).not.toContain('व्यक्ति ने');

    // Gujarati
    setLang('gu');
    const honestGu = t('share.honesty');
    expect(honestGu).toBe(tables.gu['share.honesty']);
    expect(honestGu).not.toContain('Verified');
    expect(honestGu).not.toContain('પ્રમાણિત');
    expect(honestGu.toLowerCase()).not.toContain('વ્યક્તિએ');

    const htmlGu = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: 'શ્રીમતી શર્મા',
        note: '',
        isValidDiagram: true,
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );
    expect(htmlGu).toContain(honestGu);
    const rootGu = parseHtml(htmlGu);
    const noticeGu = getAllElements(rootGu).find((el) =>
      el.attrs['class']?.includes('gt-teach__honesty-notice'),
    );
    expect(noticeGu).toBeDefined();
    const noticeGuText = noticeGu ? getTextContent(noticeGu) : '';
    expect(noticeGuText).toBe(tables.gu['share.honesty']);
    expect(noticeGuText).not.toContain('Verified');
    expect(noticeGuText).not.toContain('પ્રમાણિત');
    expect(noticeGuText.toLowerCase()).not.toContain('વ્યક્તિએ');
  });

  it('disables "Mark verified" button when diagram is invalid, even if name is entered', () => {
    const html = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: 'Teacher Name',
        note: 'Some note',
        isValidDiagram: false, // Diagram invalid!
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    const verifyBtn = buttons.find((b) => b.attrs['type'] === 'submit');

    expect(verifyBtn).toBeDefined();
    expect(verifyBtn?.attrs['disabled']).toBeDefined();
  });

  it('disables "Mark verified" button when teacher name is empty or whitespace', () => {
    const htmlEmpty = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: '',
        note: 'Valid note',
        isValidDiagram: true,
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );
    expect(htmlEmpty).toContain('disabled');

    const htmlWhitespace = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: '    ',
        note: 'Valid note',
        isValidDiagram: true,
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );
    expect(htmlWhitespace).toContain('disabled');
  });

  it('enforces limits: name <= 60 chars and note <= 280 chars with character counters', () => {
    const html = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: 'Teacher A',
        note: 'Note content',
        isValidDiagram: true,
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );

    expect(html).toContain(`9/${LIMITS.maxName}`);
    expect(html).toContain(`12/${LIMITS.maxNote}`);
    expect(html).toContain(`maxLength="${LIMITS.maxName}"`);
    expect(html).toContain(`maxLength="${LIMITS.maxNote}"`);
  });

  it('enables "Mark verified" button when diagram is valid and name is provided', () => {
    const html = renderToStaticMarkup(
      createElement(VerifyForm, {
        name: 'Valid Teacher',
        note: 'Helpful hints for students',
        isValidDiagram: true,
        onNameChange: vi.fn(),
        onNoteChange: vi.fn(),
        onVerify: vi.fn(),
      }),
    );

    const root = parseHtml(html);
    const buttons = getAllElements(root).filter((el) => el.tag === 'button');
    const verifyBtn = buttons.find((b) => b.attrs['type'] === 'submit');

    expect(verifyBtn).toBeDefined();
    expect(verifyBtn?.attrs['disabled']).toBeUndefined();
  });

  it('Teach screen displays valid status banner for a valid diagram', () => {
    const drivers = createMockDrivers();
    const validScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      title: 'Valid Square',
      points: [
        { id: 'p1', x: 0.2, y: 0.2 },
        { id: 'p2', x: 0.8, y: 0.2 },
        { id: 'p3', x: 0.8, y: 0.8 },
        { id: 'p4', x: 0.2, y: 0.8 },
      ],
      segments: [
        { id: 's1', a: 'p1', b: 'p2' },
        { id: 's2', a: 'p2', b: 'p3' },
        { id: 's3', a: 'p3', b: 'p4' },
        { id: 's4', a: 'p4', b: 'p1' },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: validScene,
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain(t('teach.validDiagram'));
    expect(html).toContain('gt-teach__validation-banner--valid');
  });

  it('Teach screen displays validation errors in plain language when scene is invalid', () => {
    const drivers = createMockDrivers();
    // Invalid scene: point coordinate out of range [0, 1]
    const invalidScene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      title: 'Broken Triangle',
      points: [{ id: 'p1', x: 5.0, y: 0.1 }],
      segments: [],
    };

    const html = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: invalidScene,
        drivers,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain('gt-teach__validation-banner--invalid');
    expect(html).toContain('coordinate out of range');
  });

  it('verifies CSS compliance for .gt-control and touch target rules', () => {
    expect(teachCss).toContain('.gt-teach');
    expect(teachCss).toContain('min-height: 48px');
    expect(teachCss).toContain('--gt-charcoal');
  });
});
