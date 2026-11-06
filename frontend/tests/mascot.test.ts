/**
 * Creature Mascot Verification Tests (Task 4)
 *
 * Requirements:
 * - Decorative SVG mascot: a friendly stitched "Frankenstein phone" with
 *   a buzzer, an eye, and a theremin antenna.
 * - Original art, no copyrighted characters.
 * - frontend/src/components/Mascot.tsx.
 * - aria-hidden="true", no text tags.
 * - Rendered size <= 8 KB (8192 bytes).
 * - Used on screens/Start.tsx only.
 * - Decorative only: must not be the only way to understand anything.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import mascotSvg from '../public/mascot/frankenstein-phone.svg?raw';
import { Mascot } from '../src/components/Mascot';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import captureSource from '../src/screens/Capture.tsx?raw';
import exploreSource from '../src/screens/Explore.tsx?raw';
import { Start } from '../src/screens/Start';
import startSource from '../src/screens/Start.tsx?raw';

const dummyDrivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
};

describe('creature mascot component (Mascot.tsx & Task 4)', () => {
  const rendered = renderToStaticMarkup(createElement(Mascot));
  const byteSize = new TextEncoder().encode(rendered).length;

  it('renders an SVG element with aria-hidden="true"', () => {
    expect(rendered).toContain('<svg');
    expect(rendered).toContain('aria-hidden="true"');
    expect(rendered).toContain('class="gt-mascot "');
  });

  it('contains NO readable text tags (<text>, <tspan>)', () => {
    expect(rendered).not.toContain('<text');
    expect(rendered).not.toContain('<tspan');
    // Ensure no plain text nodes exist outside attributes
    const strippedTags = rendered.replace(/<[^>]+>/g, '').trim();
    expect(strippedTags).toBe('');
  });

  it('is under the 8 KB size budget (<= 8192 bytes)', () => {
    expect(byteSize).toBeLessThanOrEqual(8192);
    // Realistically around 2-3 KB
    expect(byteSize).toBeGreaterThan(500);
  });

  it('includes the tactile buzzer module with vibration waves (Nerves)', () => {
    // Buzzer rect and vibration waves
    expect(rendered).toContain('A12 12 0 0 0');
    expect(rendered).toContain('stroke="#25a357"'); // copper coil windings
  });

  it('includes the cybernetic eye sensor with glowing optic pupil (Eyes)', () => {
    // Eye circle lens, aperture and pupil
    expect(rendered).toContain('r="14"');
    expect(rendered).toContain('r="5.5"'); // pupil
    expect(rendered).toContain('fill="#ffffff"'); // glint reflection
  });

  it('includes the theremin antenna rod with pitch waves (Voice)', () => {
    // Antenna rod and sine wave arcs
    expect(rendered).toContain('d="M78 24 V7"'); // antenna rod
    expect(rendered).toContain('r="3.5"'); // antenna sphere
  });

  it('features Frankenstein stitched seams across the chassis', () => {
    expect(rendered).toContain('stroke-dasharray="3 2"');
  });

  it('standalone public SVG asset exists and is <= 8 KB', () => {
    const svgBytes = new TextEncoder().encode(mascotSvg).length;
    expect(svgBytes).toBeLessThanOrEqual(8192);
    expect(mascotSvg).toContain('aria-hidden="true"');
    expect(mascotSvg).not.toContain('<text');
  });

  it('honours custom size and className props', () => {
    const custom = renderToStaticMarkup(createElement(Mascot, { size: 144, className: 'lab-mascot-glow' }));
    expect(custom).toContain('width="144"');
    expect(custom).toContain('height="144"');
    expect(custom).toContain('class="gt-mascot lab-mascot-glow"');
    expect(custom).toContain('focusable="false"');
    expect(custom).toContain('data-testid="gt-creature-mascot"');
  });

  it('features a friendly glowing two-eyed screen face matching brand palette', () => {
    // Both left and right pupils
    expect(rendered).toContain('cx="51" cy="50"');
    expect(rendered).toContain('cx="69" cy="50"');
    // Bone parchment sutures matching logo mark
    expect(rendered).toContain('stroke="#e8dfc8"');
  });

  it('includes chassis mounting electrodes and friendly stitched smile', () => {
    // Mounting electrodes / bolts
    expect(rendered).toContain('rect x="25" y="56"');
    expect(rendered).toContain('rect x="88" y="56"');
    // Stitched smile
    expect(rendered).toContain('d="M51 72 Q60 80 69 72"');
  });
});

describe('mascot usage constraints', () => {
  it('is used on screens/Start.tsx', () => {
    expect(startSource).toContain("from '../components/Mascot'");
    expect(startSource).toContain('<Mascot');
  });

  it('is NOT used on screens/Capture.tsx', () => {
    expect(captureSource).not.toContain('Mascot');
  });

  it('is NOT used on screens/Explore.tsx', () => {
    expect(exploreSource).not.toContain('Mascot');
  });

  it('Start screen retains single full-screen button contract for screen readers', () => {
    const html = renderToStaticMarkup(createElement(Start, { drivers: dummyDrivers, onBegin: vi.fn() }));
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('gt-start-surface');
    expect(html).toContain('aria-label=');
    expect(html).toContain('gt-mascot');
  });
});
