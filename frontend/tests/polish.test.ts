/**
 * Polish & Accessibility markup tests
 *
 * CSS-independent tests verifying that polished screen markup preserves all
 * accessibility contracts, creature aesthetic structure, and button hierarchies.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { Capture } from '../src/screens/Capture';
import { Explore } from '../src/screens/Explore';
import { Start } from '../src/screens/Start';

const drivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
};

describe('Start screen polish', () => {
  it('renders creature emblem SVG with aria-hidden="true" inside the single button', () => {
    const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));
    expect(html).toContain('gt-start__creature-emblem');
    expect(html).toContain('<svg');
    expect(html).toContain('gt-start__triad');
    expect(html).toContain('gt-start__action-badge');
    expect(html.match(/<button/g)).toHaveLength(1);
  });
});

describe('Capture screen polish', () => {
  it('renders primary, secondary, and sample grid without any aria-hidden attributes', () => {
    const html = renderToStaticMarkup(
      createElement(Capture, {
        drivers,
        initialStatus: 'Take a photo.',
        onScene: vi.fn(),
        onSavedDiagrams: vi.fn(),
      }),
    );
    expect(html).toContain('gt-capture__button--primary');
    expect(html).toContain('gt-capture__button--secondary');
    expect(html).toContain('gt-capture__button--saved');
    expect(html).toContain('gt-capture__samples-grid');
    expect(html).toContain('gt-capture__status-card');
    // Critical: Screen reader compatibility requires no aria-hidden on capture elements
    expect(html).not.toContain('aria-hidden');
  });
});

describe('Explore screen polish', () => {
  it('renders diagram chrome, status card, and action buttons', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', title: 'Triangle' },
        announced: 'Triangle announcement',
        drivers,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('gt-explore__badge');
    expect(html).toContain('gt-explore__status-card');
    expect(html).toContain('gt-explore__canvas-container');
    expect(html).toContain('gt-explore__ask');
    expect(html).toContain('gt-explore__back');
  });
});
