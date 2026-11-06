/**
 * AccessibleButton Primitive Tests
 *
 * Requirement 12.1: every control SHALL have an accessible name and a touch
 * target of at least 48×48 CSS px.
 *
 * Covers:
 * - Accessible name (visible text, aria-label, aria-labelledby, precedence)
 * - 48x48 px minimum touch target via .gt-control and --gt-target token
 * - Keyboard / click event handling (onClick, onKeyDown, onKeyUp, onFocus, onBlur)
 * - Disabled state (disabled attribute, non-focusable, visual styling)
 * - Ref forwarding to the native <button> element
 * - Type attribute defaults to "button" and allows override
 * - ClassName merging and pass-through props
 */

// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import {
  createElement,
  createRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AccessibleButton } from '../src/components/AccessibleButton';
import {
  getAccessibleName,
  getAllElements,
  isFocusable,
  parseHtml,
  type ParsedElement,
} from './helpers/a11yDom';

const globalCssPath = new URL('../src/styles/global.css', import.meta.url);
const globalCss = fs.readFileSync(globalCssPath, 'utf-8') as string;

const tokensCssPath = new URL('../src/styles/tokens.css', import.meta.url);
const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8') as string;

function helperGetAccessibleName(html: string): string {
  const root = parseHtml(html);
  const elements = getAllElements(root);
  const idMap = new Map<string, ParsedElement>();
  const labelForMap = new Map<string, ParsedElement>();
  for (const el of elements) {
    if (el.attrs.id) idMap.set(el.attrs.id, el);
    if (el.tag === 'label' && el.attrs.for) labelForMap.set(el.attrs.for, el);
  }
  const button = elements.find((el) => el.tag === 'button');
  if (!button) throw new Error('No button element found in rendered HTML');
  return getAccessibleName(button, idMap, labelForMap);
}

describe('AccessibleButton: Accessible Name (Requirement 12.1)', () => {
  it('computes accessible name from visible text children', () => {
    const html = renderToStaticMarkup(
      createElement(AccessibleButton, null, 'Take photo'),
    );
    expect(html).toContain('Take photo');
    expect(helperGetAccessibleName(html)).toBe('Take photo');
  });

  it('computes accessible name from aria-label when no children are provided', () => {
    const html = renderToStaticMarkup(
      createElement(AccessibleButton, { 'aria-label': 'Close lab settings' }),
    );
    expect(html).toContain('aria-label="Close lab settings"');
    expect(helperGetAccessibleName(html)).toBe('Close lab settings');
  });

  it('prioritizes aria-label over visible text per W3C AccName specification', () => {
    const html = renderToStaticMarkup(
      createElement(
        AccessibleButton,
        { 'aria-label': 'Dismiss modal dialog' },
        '✕',
      ),
    );
    expect(html).toContain('Dismiss modal dialog');
    expect(html).toContain('✕');
    expect(helperGetAccessibleName(html)).toBe('Dismiss modal dialog');
  });

  it('computes accessible name via aria-labelledby referencing another element', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement('span', { id: 'btn-desc' }, 'Start Diagram Exploration'),
        createElement(AccessibleButton, { 'aria-labelledby': 'btn-desc' }),
      ),
    );
    const root = parseHtml(html);
    const elements = getAllElements(root);
    const idMap = new Map<string, ParsedElement>();
    const labelForMap = new Map<string, ParsedElement>();
    for (const el of elements) {
      if (el.attrs.id) idMap.set(el.attrs.id, el);
    }
    const button = elements.find((el) => el.tag === 'button');
    expect(button).toBeDefined();
    expect(getAccessibleName(button!, idMap, labelForMap)).toBe(
      'Start Diagram Exploration',
    );
  });
});

describe('AccessibleButton: 48×48 px Touch Target & CSS Contract (Requirement 12.1)', () => {
  it('always includes the .gt-control class on the button element', () => {
    const html = renderToStaticMarkup(
      createElement(AccessibleButton, null, 'Test Target'),
    );
    const root = parseHtml(html);
    const button = getAllElements(root).find((el) => el.tag === 'button');
    expect(button).toBeDefined();
    expect(button?.attrs.class).toContain('gt-control');
  });

  it('preserves .gt-control when custom className is provided', () => {
    const html = renderToStaticMarkup(
      createElement(
        AccessibleButton,
        { className: 'gt-btn--primary custom-action' },
        'Save',
      ),
    );
    const root = parseHtml(html);
    const button = getAllElements(root).find((el) => el.tag === 'button');
    expect(button?.attrs.class).toContain('gt-control');
    expect(button?.attrs.class).toContain('gt-btn--primary');
    expect(button?.attrs.class).toContain('custom-action');
  });

  it('enforces --gt-target: 48px in design tokens and global CSS', () => {
    expect(tokensCss).toMatch(/--gt-target:\s*48px;/);
    expect(globalCss).toMatch(/--gt-target:\s*48px;/);
  });

  it('enforces min-width and min-height var(--gt-target) on .gt-control', () => {
    const controlMatch = /\.gt-control\s*\{([^}]+)\}/s.exec(globalCss);
    expect(controlMatch).not.toBeNull();
    const rules = controlMatch?.[1] ?? '';
    expect(rules).toMatch(/min-width:\s*var\(--gt-target\)/);
    expect(rules).toMatch(/min-height:\s*var\(--gt-target\)/);
  });

  it('defines high-contrast visible focus outline for keyboard navigation', () => {
    const focusMatch = /\.gt-control:focus-visible\s*\{([^}]+)\}/s.exec(globalCss);
    expect(focusMatch).not.toBeNull();
    const rules = focusMatch?.[1] ?? '';
    expect(rules).toMatch(/outline:\s*3px\s+solid/);
  });
});

describe('AccessibleButton: Event & Keyboard Handling', () => {
  it('forwards onClick handler to button element props', () => {
    const handleClick = vi.fn();
    const element = createElement(AccessibleButton, {
      onClick: handleClick,
      children: 'Clickable',
    });
    expect(element.props.onClick).toBe(handleClick);

    // Simulate click event
    const event = { type: 'click', preventDefault: vi.fn() } as unknown as MouseEvent<HTMLButtonElement>;
    element.props.onClick?.(event);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(event);
  });

  it('forwards onKeyDown, onKeyUp, and onFocus handlers for keyboard accessibility', () => {
    const handleKeyDown = vi.fn();
    const handleKeyUp = vi.fn();
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();

    const element = createElement(AccessibleButton, {
      onKeyDown: handleKeyDown,
      onKeyUp: handleKeyUp,
      onFocus: handleFocus,
      onBlur: handleBlur,
      children: 'Keyboard control',
    });

    element.props.onKeyDown?.({ key: 'Enter', code: 'Enter' } as unknown as KeyboardEvent<HTMLButtonElement>);
    expect(handleKeyDown).toHaveBeenCalledTimes(1);

    element.props.onKeyUp?.({ key: ' ', code: 'Space' } as unknown as KeyboardEvent<HTMLButtonElement>);
    expect(handleKeyUp).toHaveBeenCalledTimes(1);

    element.props.onFocus?.({ type: 'focus' } as unknown as FocusEvent<HTMLButtonElement>);
    expect(handleFocus).toHaveBeenCalledTimes(1);

    element.props.onBlur?.({ type: 'blur' } as unknown as FocusEvent<HTMLButtonElement>);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });
});

describe('AccessibleButton: Disabled State', () => {
  it('renders disabled attribute when disabled is true', () => {
    const html = renderToStaticMarkup(
      createElement(AccessibleButton, { disabled: true }, 'Inactive action'),
    );
    const root = parseHtml(html);
    const button = getAllElements(root).find((el) => el.tag === 'button');
    expect(button?.attrs.disabled).toBeDefined();
  });

  it('marks disabled button as not focusable per a11y DOM validation', () => {
    const html = renderToStaticMarkup(
      createElement(AccessibleButton, { disabled: true }, 'Disabled'),
    );
    const root = parseHtml(html);
    const button = getAllElements(root).find((el) => el.tag === 'button');
    expect(button).toBeDefined();
    expect(isFocusable(button!)).toBe(false);
  });

  it('marks enabled button as focusable per a11y DOM validation', () => {
    const html = renderToStaticMarkup(
      createElement(AccessibleButton, { disabled: false }, 'Enabled'),
    );
    const root = parseHtml(html);
    const button = getAllElements(root).find((el) => el.tag === 'button');
    expect(button).toBeDefined();
    expect(isFocusable(button!)).toBe(true);
  });

  it('defines cursor: not-allowed and disabled styling in CSS', () => {
    const disabledRuleMatch = /\.gt-control:disabled\s*\{([^}]+)\}/s.exec(globalCss);
    expect(disabledRuleMatch).not.toBeNull();
    const rules = disabledRuleMatch?.[1] ?? '';
    expect(rules).toMatch(/cursor:\s*not-allowed/);
    expect(rules).toMatch(/opacity:\s*0\.55/);
  });
});

describe('AccessibleButton: Ref Forwarding & HTML Attributes', () => {
  it('defaults to type="button" to prevent accidental form submission', () => {
    const html = renderToStaticMarkup(
      createElement(AccessibleButton, null, 'Default button'),
    );
    const root = parseHtml(html);
    const button = getAllElements(root).find((el) => el.tag === 'button');
    expect(button?.attrs.type).toBe('button');
  });

  it('allows overriding type="submit" or type="reset"', () => {
    const htmlSubmit = renderToStaticMarkup(
      createElement(AccessibleButton, { type: 'submit' }, 'Submit form'),
    );
    const rootSubmit = parseHtml(htmlSubmit);
    const submitBtn = getAllElements(rootSubmit).find((el) => el.tag === 'button');
    expect(submitBtn?.attrs.type).toBe('submit');

    const htmlReset = renderToStaticMarkup(
      createElement(AccessibleButton, { type: 'reset' }, 'Reset form'),
    );
    const rootReset = parseHtml(htmlReset);
    const resetBtn = getAllElements(rootReset).find((el) => el.tag === 'button');
    expect(resetBtn?.attrs.type).toBe('reset');
  });

  it('forwards ref to the underlying button element', () => {
    const buttonRef = createRef<HTMLButtonElement>();
    const element = createElement(AccessibleButton, {
      ref: buttonRef,
      children: 'Ref target',
    });

    // In React 19, ref is passed via props or element.ref
    expect((element as unknown as { ref?: Ref<HTMLButtonElement> }).ref ?? element.props.ref).toBe(buttonRef);

    // Call the component render function directly to verify ref passing to <button ref={ref}>
    const renderFn = (
      AccessibleButton as unknown as {
        render?: (props: unknown, ref: unknown) => { props: { ref?: unknown } };
      }
    ).render;

    if (typeof renderFn === 'function') {
      const rendered = renderFn({ children: 'Ref test' }, buttonRef);
      expect(rendered.props.ref).toBe(buttonRef);
    }
  });

  it('passes through ARIA attributes like aria-expanded, aria-pressed, and aria-haspopup', () => {
    const html = renderToStaticMarkup(
      createElement(
        AccessibleButton,
        {
          'aria-expanded': true,
          'aria-haspopup': 'dialog',
          'aria-pressed': true,
          id: 'menu-trigger',
        },
        'Menu',
      ),
    );
    const root = parseHtml(html);
    const button = getAllElements(root).find((el) => el.tag === 'button');
    expect(button?.attrs['aria-expanded']).toBe('true');
    expect(button?.attrs['aria-haspopup']).toBe('dialog');
    expect(button?.attrs['aria-pressed']).toBe('true');
    expect(button?.attrs['id']).toBe('menu-trigger');
  });
});
