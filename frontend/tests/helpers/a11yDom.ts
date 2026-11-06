/**
 * a11yDom.ts — Lightweight static DOM parser and accessibility validator for Ghost Touch.
 *
 * Runs in pure Node.js test environment (no jsdom or external dependencies needed).
 * Parses static markup output from React's `renderToStaticMarkup`.
 */

export interface ParsedElement {
  tag: string;
  attrs: Record<string, string>;
  children: (ParsedElement | string)[];
  parent: ParsedElement | null;
}

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Tolerant HTML tokenizer & tree builder for React renderToStaticMarkup strings.
 */
export function parseHtml(html: string): ParsedElement {
  const root: ParsedElement = {
    tag: '#root',
    attrs: {},
    children: [],
    parent: null,
  };

  const stack: ParsedElement[] = [root];
  const tagRegex = /<(\/)?([a-zA-Z0-9:-]+)([^>]*?)(\/)?>|([^<]+)/g;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = Boolean(match[1]);
    const tagName = match[2]?.toLowerCase();
    const rawAttrs = match[3];
    const isSelfClosingSlash = Boolean(match[4]);
    const textContent = match[5];

    if (textContent !== undefined) {
      if (textContent.length > 0) {
        const current = stack[stack.length - 1];
        if (current) {
          current.children.push(textContent);
        }
      }
      continue;
    }

    if (!tagName) continue;

    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i--) {
        const top = stack[i];
        if (top && top.tag === tagName) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs: Record<string, string> = {};
    if (rawAttrs) {
      const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
        const key = attrMatch[1];
        if (!key) continue;
        const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
        attrs[key.toLowerCase()] = val;
      }
    }

    const parent = stack[stack.length - 1] ?? root;
    const element: ParsedElement = {
      tag: tagName,
      attrs,
      children: [],
      parent,
    };
    parent.children.push(element);

    const isVoid = VOID_ELEMENTS.has(tagName) || isSelfClosingSlash;
    if (!isVoid) {
      stack.push(element);
    }
  }

  return root;
}

/** Flatten all descendant elements of a node */
export function getAllElements(node: ParsedElement): ParsedElement[] {
  const result: ParsedElement[] = [];
  for (const child of node.children) {
    if (typeof child !== 'string') {
      result.push(child);
      result.push(...getAllElements(child));
    }
  }
  return result;
}

/** Recursively extracts text content from an element */
export function getTextContent(element: ParsedElement): string {
  let text = '';
  for (const child of element.children) {
    if (typeof child === 'string') {
      text += child;
    } else {
      text += getTextContent(child);
    }
  }
  return text.trim();
}

/** Check if element is inside an aria-hidden ancestor */
export function isInsideAriaHidden(element: ParsedElement): boolean {
  let curr: ParsedElement | null = element.parent;
  while (curr) {
    if (curr.attrs['aria-hidden'] === 'true') {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

/** Check if element has the hidden attribute or is inside an element with hidden */
export function isElementHidden(element: ParsedElement): boolean {
  let curr: ParsedElement | null = element;
  while (curr) {
    if (curr.attrs['hidden'] !== undefined || curr.attrs['type'] === 'hidden') {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

/** Determines whether an element is inherently or explicitly focusable */
export function isFocusable(element: ParsedElement): boolean {
  if (isElementHidden(element)) return false;
  const tag = element.tag;
  if (tag === 'button') {
    return element.attrs.disabled === undefined;
  }
  if (tag === 'a' && element.attrs.href !== undefined) {
    return true;
  }
  if (tag === 'input') {
    return element.attrs.type !== 'hidden' && element.attrs.disabled === undefined;
  }
  if (tag === 'select' || tag === 'textarea') {
    return element.attrs.disabled === undefined;
  }
  if (element.attrs.tabindex === '0') {
    return true;
  }
  return false;
}

/**
 * Resolves accessible name for an element following W3C AccName principles:
 * aria-labelledby -> aria-label -> label[for] -> visible text -> title.
 */
export function getAccessibleName(
  element: ParsedElement,
  idMap: Map<string, ParsedElement>,
  labelForMap: Map<string, ParsedElement>,
): string {
  // 1. aria-labelledby
  const labelledBy = element.attrs['aria-labelledby'];
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const parts = ids
      .map((id) => {
        const target = idMap.get(id);
        return target ? getTextContent(target) : '';
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ').trim();
    }
  }

  // 2. aria-label
  if (element.attrs['aria-label'] !== undefined) {
    return element.attrs['aria-label'].trim();
  }

  // 3. Form control association via label[for]
  if (element.tag === 'input' || element.tag === 'select' || element.tag === 'textarea') {
    const id = element.attrs.id;
    if (id) {
      const label = labelForMap.get(id);
      if (label) {
        const labelText = getTextContent(label);
        if (labelText) return labelText;
      }
    }
    if (element.attrs.type === 'submit' || element.attrs.type === 'button') {
      if (element.attrs.value) return element.attrs.value.trim();
    }
  }

  // 4. Visible text content
  const visible = getTextContent(element);
  if (visible) return visible;

  // 5. title attribute
  if (element.attrs.title) return element.attrs.title.trim();

  return '';
}

export interface A11yCheckViolation {
  rule: string;
  elementTag: string;
  details: string;
  attrs: Record<string, string>;
}

export interface A11yValidationResult {
  violations: A11yCheckViolation[];
  h1Count: number;
  interactiveCount: number;
  svgCount: number;
  duplicateIds: string[];
}

/**
 * Comprehensive screen markup validation according to AGENTS.md and brief requirements.
 */
export function validateScreenMarkup(
  html: string,
  options: { allowNoH1?: boolean } = {},
): A11yValidationResult {
  const root = parseHtml(html);
  const elements = getAllElements(root);
  const violations: A11yCheckViolation[] = [];

  const idMap = new Map<string, ParsedElement>();
  const labelForMap = new Map<string, ParsedElement>();
  const duplicateIds: string[] = [];

  // Build ID & Label mappings and detect duplicate IDs
  for (const el of elements) {
    const id = el.attrs.id;
    if (id) {
      if (idMap.has(id)) {
        duplicateIds.push(id);
        violations.push({
          rule: 'no-duplicate-ids',
          elementTag: el.tag,
          details: `Duplicate ID attribute encountered: "${id}"`,
          attrs: el.attrs,
        });
      } else {
        idMap.set(id, el);
      }
    }
    if (el.tag === 'label' && el.attrs.for) {
      labelForMap.set(el.attrs.for, el);
    }
  }

  // 1. Interactive element accessible name check:
  // every <button>, <a>, <input>, <select>, <textarea> has non-empty accessible name
  let interactiveCount = 0;
  for (const el of elements) {
    const tag = el.tag;
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') {
      // Elements that are hidden with hidden attribute or type="hidden" are outside a11y tree
      if (isElementHidden(el)) continue;

      interactiveCount++;
      const name = getAccessibleName(el, idMap, labelForMap);
      if (!name) {
        violations.push({
          rule: 'interactive-accessible-name',
          elementTag: tag,
          details: `<${tag}> element has no non-empty accessible name`,
          attrs: el.attrs,
        });
      }
    }
  }

  // 2. ARIA references & attributes:
  // no empty aria-label or aria-labelledby; targets in aria-labelledby and aria-describedby exist
  for (const el of elements) {
    if (el.attrs['aria-label'] !== undefined && el.attrs['aria-label'].trim() === '') {
      violations.push({
        rule: 'no-empty-aria-label',
        elementTag: el.tag,
        details: `<${el.tag}> has empty aria-label=""`,
        attrs: el.attrs,
      });
    }

    if (el.attrs['aria-labelledby'] !== undefined) {
      const trimmed = el.attrs['aria-labelledby'].trim();
      if (!trimmed) {
        violations.push({
          rule: 'no-empty-aria-labelledby',
          elementTag: el.tag,
          details: `<${el.tag}> has empty aria-labelledby=""`,
          attrs: el.attrs,
        });
      } else {
        const ids = trimmed.split(/\s+/).filter(Boolean);
        for (const targetId of ids) {
          if (!idMap.has(targetId)) {
            violations.push({
              rule: 'aria-labelledby-target-missing',
              elementTag: el.tag,
              details: `<${el.tag}> references non-existent id "${targetId}" in aria-labelledby`,
              attrs: el.attrs,
            });
          }
        }
      }
    }

    if (el.attrs['aria-describedby'] !== undefined) {
      const trimmed = el.attrs['aria-describedby'].trim();
      if (!trimmed) {
        violations.push({
          rule: 'no-empty-aria-describedby',
          elementTag: el.tag,
          details: `<${el.tag}> has empty aria-describedby=""`,
          attrs: el.attrs,
        });
      } else {
        const ids = trimmed.split(/\s+/).filter(Boolean);
        for (const targetId of ids) {
          if (!idMap.has(targetId)) {
            violations.push({
              rule: 'aria-describedby-target-missing',
              elementTag: el.tag,
              details: `<${el.tag}> references non-existent id "${targetId}" in aria-describedby`,
              attrs: el.attrs,
            });
          }
        }
      }
    }
  }

  // 3. Heading hierarchy:
  // exactly one <h1> per screen (except Start); heading levels never skip downward > 1 step
  let h1Count = 0;
  let previousLevel = 0;

  for (const el of elements) {
    const match = /^h([1-6])$/.exec(el.tag);
    if (match && match[1]) {
      const level = parseInt(match[1], 10);
      if (level === 1) h1Count++;

      if (previousLevel > 0 && level > previousLevel + 1) {
        violations.push({
          rule: 'heading-order-skip',
          elementTag: el.tag,
          details: `Heading level jumped downward from h${previousLevel} to h${level} (> 1 step skip)`,
          attrs: el.attrs,
        });
      }
      previousLevel = level;
    }
  }

  if (!options.allowNoH1 && h1Count !== 1) {
    violations.push({
      rule: 'single-h1',
      elementTag: 'h1',
      details: `Expected exactly one <h1> per screen, found ${h1Count}`,
      attrs: {},
    });
  } else if (options.allowNoH1 && h1Count > 1) {
    violations.push({
      rule: 'single-h1',
      elementTag: 'h1',
      details: `Expected at most one <h1>, found ${h1Count}`,
      attrs: {},
    });
  }

  // 4. Focusability & aria-hidden:
  // no tabindex > 0; aria-hidden="true" contains no focusable descendants
  for (const el of elements) {
    if (el.attrs.tabindex !== undefined) {
      const tabNum = parseInt(el.attrs.tabindex, 10);
      if (!isNaN(tabNum) && tabNum > 0) {
        violations.push({
          rule: 'no-tabindex-positive',
          elementTag: el.tag,
          details: `<${el.tag}> has tabindex="${el.attrs.tabindex}" (> 0)`,
          attrs: el.attrs,
        });
      }
    }

    if (isInsideAriaHidden(el)) {
      if (isFocusable(el)) {
        violations.push({
          rule: 'aria-hidden-focusable-descendant',
          elementTag: el.tag,
          details: `Focusable <${el.tag}> found inside an aria-hidden="true" container`,
          attrs: el.attrs,
        });
      }
    }
  }

  // 5. SVG and Image contracts:
  // every <svg> is aria-hidden="true" or has role="img" + <title>/aria-label; every <img> has alt
  let svgCount = 0;
  for (const el of elements) {
    if (el.tag === 'svg') {
      svgCount++;
      const isHidden = el.attrs['aria-hidden'] === 'true';
      const isRoleImg = el.attrs.role === 'img';
      const hasAriaLabel = Boolean(el.attrs['aria-label']);
      const hasTitleChild = el.children.some(
        (c) => typeof c !== 'string' && c.tag === 'title' && getTextContent(c).length > 0,
      );

      if (!isHidden && !(isRoleImg && (hasAriaLabel || hasTitleChild))) {
        violations.push({
          rule: 'svg-accessible-contract',
          elementTag: 'svg',
          details: `<svg> must be aria-hidden="true" or have role="img" with a title or aria-label`,
          attrs: el.attrs,
        });
      }
    }

    if (el.tag === 'img') {
      if (el.attrs.alt === undefined) {
        violations.push({
          rule: 'img-alt-required',
          elementTag: 'img',
          details: `<img> is missing required alt attribute`,
          attrs: el.attrs,
        });
      }
    }
  }

  return {
    violations,
    h1Count,
    interactiveCount,
    svgCount,
    duplicateIds,
  };
}
