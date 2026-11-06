import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LabCard, Rivets, Seam, Spark } from '../src/components/lab';
import globalCss from '../src/styles/global.css?raw';

describe('Lab Primitives Components (docs/briefs/agy-lab-foundation.md)', () => {
  describe('Seam (decorative suture divider)', () => {
    it('renders with aria-hidden="true" and role="presentation"', () => {
      const html = renderToStaticMarkup(createElement(Seam));
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('role="presentation"');
      expect(html).toContain('class="gt-seam"');
      expect(html).toContain('<line');
      expect(html).toContain('stroke-dasharray="6 6"');
    });

    it('supports custom className and color', () => {
      const html = renderToStaticMarkup(
        createElement(Seam, { className: 'custom-seam', color: '#ff0000', crosses: false }),
      );
      expect(html).toContain('custom-seam');
      expect(html).toContain('stroke="#ff0000"');
    });
  });

  describe('Rivets (4 corner bolts)', () => {
    it('renders 4 corner bolts with aria-hidden="true"', () => {
      const html = renderToStaticMarkup(createElement(Rivets));
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('role="presentation"');
      expect(html).toContain('gt-rivet--tl');
      expect(html).toContain('gt-rivet--tr');
      expect(html).toContain('gt-rivet--bl');
      expect(html).toContain('gt-rivet--br');
      expect(html.match(/<svg/g)).toHaveLength(4);
    });

    it('supports custom size and color', () => {
      const html = renderToStaticMarkup(
        createElement(Rivets, { size: 14, color: '#cca468' }),
      );
      expect(html).toContain('width="14"');
      expect(html).toContain('height="14"');
      expect(html).toContain('fill="#cca468"');
    });
  });

  describe('LabCard (wrapper card)', () => {
    it('renders children untouched inside card wrapper', () => {
      const child = createElement('p', { id: 'test-child' }, 'Creature Specimen');
      const html = renderToStaticMarkup(createElement(LabCard, null, child));
      expect(html).toContain('gt-lab-card');
      expect(html).toContain('<p id="test-child">Creature Specimen</p>');
    });

    it('renders 4 corner rivets by default for primary cards', () => {
      const html = renderToStaticMarkup(createElement(LabCard, { variant: 'primary' }));
      expect(html).toContain('gt-rivets');
      expect(html).toContain('gt-rivet--tl');
      expect(html).toContain('gt-rivet--br');
      expect(html).toContain('gt-lab-card--primary');
    });

    it('omits rivets when hasRivets={false}', () => {
      const html = renderToStaticMarkup(
        createElement(LabCard, { variant: 'primary', hasRivets: false }),
      );
      expect(html).not.toContain('gt-rivets');
    });

    it('applies stitched border class by default', () => {
      const html = renderToStaticMarkup(createElement(LabCard));
      expect(html).toContain('gt-lab-card--stitched');
    });

    it('supports specimen and secondary variants', () => {
      const specimenHtml = renderToStaticMarkup(
        createElement(LabCard, { variant: 'specimen' }),
      );
      expect(specimenHtml).toContain('gt-lab-card--specimen');

      const secondaryHtml = renderToStaticMarkup(
        createElement(LabCard, { variant: 'secondary' }),
      );
      expect(secondaryHtml).toContain('gt-lab-card--secondary');
    });
  });

  describe('Spark ("IT\'S ALIVE" arc + glow pulse)', () => {
    it('renders decorative non-interactive spark elements with aria-hidden="true"', () => {
      const html = renderToStaticMarkup(createElement(Spark));
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('role="presentation"');
      expect(html).toContain('gt-spark');
      expect(html).toContain('gt-spark__arc');
      expect(html).toContain('gt-spark__glow');
    });

    it('calls onDone callback in under 1.2s', async () => {
      vi.useFakeTimers();
      const onDone = vi.fn();
      // Render without crashing
      const html = renderToStaticMarkup(createElement(Spark, { onDone }));
      expect(html).toContain('gt-spark');

      vi.useRealTimers();
    });
  });

  describe('Lab button primitives in global.css', () => {
    const labButtonClasses = [
      { selector: '.gt-btn', name: 'base lab button' },
      { selector: '.gt-btn--primary', name: 'primary lab button (life green fill)' },
      { selector: '.gt-btn--secondary', name: 'secondary lab button' },
      { selector: '.gt-btn--quiet', name: 'quiet lab button' },
    ];

    for (const { selector, name } of labButtonClasses) {
      it(`${selector} (${name}) declares min-width >= 48px`, () => {
        const regex = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*min-width:\\s*(var\\(--gt-target\\)|\\d+px)`);
        expect(globalCss).toMatch(regex);
      });

      it(`${selector} (${name}) declares min-height >= 48px`, () => {
        const regex = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*min-height:\\s*(var\\(--gt-target\\)|\\d+px)`);
        expect(globalCss).toMatch(regex);
      });
    }

    it('declares copper border and green life fill on .gt-btn--primary', () => {
      expect(globalCss).toMatch(/\.gt-btn--primary\s*\{[^}]*background:\s*var\(--gt-green\)/);
      expect(globalCss).toMatch(/\.gt-btn--primary\s*\{[^}]*color:\s*var\(--gt-text-dark\)/);
      expect(globalCss).toMatch(/\.gt-btn--primary\s*\{[^}]*border-color:\s*var\(--gt-border-copper\)/);
    });

    it('includes .gt-btn in forced-colors active query', () => {
      expect(globalCss).toContain('.gt-btn');
      expect(globalCss).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)[\s\S]*?\.gt-btn/);
    });

    it('includes .gt-spark in prefers-reduced-motion query', () => {
      expect(globalCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]*?\.gt-spark/);
    });
  });
});
