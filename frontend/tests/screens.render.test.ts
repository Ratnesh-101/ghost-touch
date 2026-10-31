import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import type { Drivers } from '../src/drivers';
import { Capture } from '../src/screens/Capture';
import { Explore } from '../src/screens/Explore';
import { Start } from '../src/screens/Start';
import css from '../src/styles/global.css?raw';

const drivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), state: 'locked' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
};

describe('screen markup (server render)', () => {
  it('Start is one full-screen button named by the intro line', () => {
    const html = renderToStaticMarkup(createElement(Start, { drivers, onBegin: vi.fn() }));
    expect(html).toContain('class="gt-start-surface"');
    expect(html).toContain('aria-label="Ghost Touch. Tap anywhere to begin."');
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it('Capture has every control, a live status, and the rear-camera input', () => {
    const html = renderToStaticMarkup(
      createElement(Capture, { drivers, initialStatus: 'Take a photo.', onScene: vi.fn() }),
    );
    for (const label of ['Take photo', 'Choose image', 'Sample: triangle', 'Sample: sine graph', 'Sample: bar chart']) {
      expect(html).toContain(label);
    }
    // The app speaks the status itself: no live region (that is what makes a screen
    // reader read it twice), and the text stays readable so a missed message can be re-read.
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('aria-hidden');
    expect(html).toContain('Take a photo.');
    expect(html).toContain('capture="environment"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp,application/pdf"');
  });

  it('Capture turns the status into a live region only when the app cannot speak', () => {
    const silent: Drivers = { ...drivers, speech: { ...drivers.speech, canSpeak: false } };
    const html = renderToStaticMarkup(
      createElement(Capture, { drivers: silent, initialStatus: 'Take a photo.', onScene: vi.fn() }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('Explore markup has the canvas with aria-label, a Back button outside it, and the status text', () => {
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', title: 'Triangle' },
        announced:
          'Triangle. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave.',
        drivers,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('<canvas');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Triangle. Double-tap and hold, then drag to feel the diagram. You start at the centre."');
    expect(html).toContain('Back');
    expect(html).toContain('gt-explore__back');
    expect(html).toContain('Ask');
    expect(html).toContain('gt-explore__ask');
    // When drivers can speak, StatusText contains no aria-live
    expect(html).not.toContain('aria-live');
  });

  it('Explore renders text fallback box and Send button when speech recognition is unavailable', () => {
    const noListen: Drivers = { ...drivers, speech: { ...drivers.speech, canListen: false } };
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', title: 'Triangle' },
        announced: 'Triangle announcement',
        drivers: noListen,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('gt-explore__ask-form');
    expect(html).toContain('gt-explore__ask-input');
    expect(html).toContain('Send');
    expect(html).toContain('gt-explore__send');
  });

  it('Explore turns status text into polite live region when drivers cannot speak', () => {
    const silent: Drivers = { ...drivers, speech: { ...drivers.speech, canSpeak: false } };
    const html = renderToStaticMarkup(
      createElement(Explore, {
        scene: { kind: 'geometry', title: 'Triangle' },
        announced: 'Triangle announcement',
        drivers: silent,
        onBack: vi.fn(),
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('App opens on the Start screen', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('gt-start-surface');
  });
});

describe('touch targets (Requirement 12.1)', () => {
  it('defines a 48px minimum target used by every control', () => {
    expect(css).toMatch(/--gt-target:\s*48px/);
    expect(css).toMatch(/\.gt-control\s*{[^}]*min-height:\s*var\(--gt-target\)/s);
    expect(css).toMatch(/\.gt-control\s*{[^}]*min-width:\s*var\(--gt-target\)/s);
  });

  it('makes the Capture buttons at least 48px tall', () => {
    const match = /\.gt-capture__button\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(48);
  });

  it('makes the Explore back button at least 48px tall', () => {
    const match = /\.gt-explore__back\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(48);
  });

  it('makes the Explore ask and send buttons at least 48px tall', () => {
    const matchAsk = /\.gt-explore__ask\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(matchAsk?.[1])).toBeGreaterThanOrEqual(48);

    const matchSend = /\.gt-explore__send\s*{[^}]*min-height:\s*(\d+)px/s.exec(css);
    expect(Number(matchSend?.[1])).toBeGreaterThanOrEqual(48);
  });
});
