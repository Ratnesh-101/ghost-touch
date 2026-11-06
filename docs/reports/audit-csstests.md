# Audit A: CSS-Reading Tests & Lab Redesign Compatibility

> **Audit Target:** CSS parsers, raw imports, and markup tests in `frontend/tests/`  
> **Status:** AUDIT ONLY (No code or test files modified)  
> **Target Output:** `docs/reports/audit-csstests.md`  
> **Baseline Verification:** `npm --prefix frontend test` -> **42 test files passed, 473 tests passed** (797 ms)

---

## 1. Executive Summary

The Frankenstein's Laboratory redesign (`docs/briefs/lab-spec.md`) introduces visual changes: deep lab charcoal backgrounds (`#0b0e0c`), blueprint grids, voltage cyan and aged copper accents, stitched seam dividers, Atkinson Hyperlegible typography, and "IT'S ALIVE" animations.

However, the existing Ghost Touch test suite contains **six test suites** that programmatically inspect CSS stylesheets (via Node `node:fs` or Vite `?raw` imports) or inspect static rendered markup for accessibility and BEM invariants. These tests do **not** use a real browser CSS engine. Instead, they rely on custom, naive regular expressions and string splitting.

If parallel redesign lanes modularise styles into multiple files (e.g. `src/styles/lab.css`, `settings.css`) or use modern CSS features (CSS nesting, `clamp()`, `rem`, CSS variables for touch targets, multi-selector lists, non-hex color functions), **the test suite will immediately fail across dozens of tests**, even if the rendered output in a browser is compliant with WCAG 2.1 AAA.

This audit breaks down each test's parser mechanics, documents every exact pattern that breaks them, uncovers 7 real parser bugs (both false passes and false failures), recommends a safe CSS architecture for the redesign, proposes a new universal test suite, and provides a prioritised action table.

---

## 2. In-Depth Test File Analysis

### 2.1 `frontend/tests/a11y.contrast.test.ts`
- **File Read Method:** Direct disk access via Node `node:fs` runtime (`fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf-8')`). Does not go through Vite or bundle `@import` statements.
- **Parsing Mechanism (`parseColourTokens`):**
  1. Splits input by `\r?\n` (line-by-line).
  2. Trims each line and checks `if (!line.startsWith('--')) continue;`.
  3. Locates the first `:` and extracts token name and raw value.
  4. Matches value against `/^(#[0-9a-fA-F]{3,8})/`.
  5. If matched, stores `tokens[name] = hex.toLowerCase()`.
- **Contrast Computation:**
  - `hexToRgb`: Parses 3-char hex by duplicating characters (`#abc` -> `aabbcc`). For other lengths, executes `num = parseInt(clean, 16)` and extracts bytes: `[(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]`.
  - `relativeLuminance`: Standard WCAG 2.1 formula with sRGB-to-linear conversion.
  - `contrastRatio`: `(L1 + 0.05) / (L2 + 0.05)`.
- **What It Tests:**
  - Token count `> 5`.
  - Brand identity: asserts `--gt-green === '#39ff88'`, `--gt-line === '#39ff88'`, `--gt-focus === '#39ff88'`.
  - 17 body text / background pairs must achieve WCAG AAA **>= 7.0:1**:
    `--gt-text` across 6 surfaces (`--gt-bg`, `--gt-bg-elevated`, `--gt-surface`, `--gt-surface-card`, `--gt-surface-hover`, `--gt-surface-active`).
    `--gt-text-primary` across 2 surfaces (`--gt-bg`, `--gt-surface`).
    `--gt-text-secondary` across 3 surfaces (`--gt-bg`, `--gt-surface`, `--gt-surface-card`).
    `--gt-text-muted` across 5 surfaces (`--gt-bg`, `--gt-surface`, `--gt-surface-card`, `--gt-surface-hover`, `--gt-surface-active`).
    `--gt-text-dark` on `--gt-green` and `--gt-line`.
  - 5 large text / UI component pairs must achieve **>= 4.5:1**:
    `--gt-line` on `--gt-bg`, `--gt-surface`, `--gt-surface-card`.
    `--gt-focus` on `--gt-bg`.
    `--gt-green-dim` on `--gt-bg`.
- **What Would Break It:**
  1. **Non-Hex Tokens:** Using `rgb()`, `rgba()`, `hsl()`, `oklch()`, or `var(--other)` for any token. If `--gt-line: var(--gt-green);` is used, `tokens['--gt-line']` is `undefined`. The brand check throws, and contrast tests fail with `Token --gt-line exists`.
  2. **8-digit Hex (`#rrggbbaa`) or 4-digit Hex (`#rgba`):** Although regex `/^(#[0-9a-fA-F]{3,8})/` accepts up to 8 chars, `hexToRgb` assumes 6 chars. For 8-digit hex, bitwise operations extract green, blue, and alpha channels while dropping red, yielding corrupted luminance and false failures.
  3. **Multi-line Declarations or Comments:**
     ```css
     --gt-bg:
       #0b0e0c; /* FAILS: line 1 has no hex, line 2 does not start with -- */
     /* lab bg */ --gt-bg: #0b0e0c; /* FAILS: line starts with /* */
     ```
  4. **Deleting or Renaming Tested Tokens:** All 15 token names listed above are hardcoded in the test. If any is deleted or renamed, `expect(token).toBeDefined()` throws.
  5. **Moving Tokens:** Defining tokens in `lab.css` or `global.css` instead of `src/styles/tokens.css` will be completely invisible to this test.
  6. **Contrast Regressions:** If `--gt-bg` is changed to `#0b0e0c` (lab charcoal) or `--gt-surface-card` is altered, any pair dropping below 7.0:1 will fail.

---

### 2.2 `frontend/tests/a11y.targets.test.ts`
- **File Read Method:** Vite raw string import: `import globalCss from '../src/styles/global.css?raw'`.
- **Parsing Mechanism (`parseCssRules` & `findDeclarations`):**
  1. Comments stripped using `css.replace(/\/\*[\s\S]*?\*\//g, '')`.
  2. Rules matched with flat regex: `ruleRegex = /([^{]+)\{([^}]+)\}/g`.
  3. Selectors split by `,` and trimmed.
  4. Declarations split by `;`, property and value separated by `:`.
  5. `findDeclarations(rules, targetClass)`: Loops over rules sequentially and returns the declarations of the **first** rule where any selector equals `targetClass` or `sel.split(/\s+/)[0] === targetClass`.
  6. `parseDimensionPx(val)`:
     - Returns 48 if `val.includes('var(--gt-target)')`.
     - Else regex matches `/(\d+(?:\.\d+)?)\s*px/` and parses float.
     - Else returns `null`.
- **What It Tests:**
  - Asserts `--gt-target: 48px` is present in `globalCss` via regex `expect(globalCss).toMatch(/--gt-target:\s*48px/)`.
  - Asserts BOTH `min-width >= 48` AND `min-height >= 48` on 10 interactive selectors:
    `.gt-control`, `.gt-start-surface`, `.gt-capture__button`, `.gt-capture__sample-btn`, `.gt-explore__ask`, `.gt-explore__back`, `.gt-explore__send`, `.gt-explore__ask-input`, `.gt-lang-selector__btn`, `.gt-rate-selector__btn`.
- **What Would Break It:**
  1. **Moving Classes to External Files:** Moving rules into `settings.css` or `lab.css` causes `findDeclarations` to return `null`, failing with `Rules for <selector> must exist`. Raw imports do not resolve `@import`.
  2. **Nested CSS / CSS Nesting:**
     ```css
     .gt-control {
       min-width: 48px;
       min-height: 48px;
       &:hover { background: red; }
     }
     ```
     The regex `/([^{]+)\{([^}]+)\}/g` stops at the first `}` after `&:hover`. The rest of the rule is mutilated, throwing off all subsequent CSS parsing in the file.
  3. **Nested At-Rules (`@media`, `@supports`):**
     If an interactive rule is wrapped in an at-rule:
     ```css
     @media (min-width: 320px) {
       .gt-control { min-width: 48px; min-height: 48px; }
     }
     ```
     `rawSelectors` matches `@media (min-width: 320px)`, and `.gt-control` is treated as a declaration property name, completely losing the selector.
  4. **Non-Pixel / Modern Units:**
     Using `min-height: 3rem;`, `min-height: clamp(48px, 5vw, 64px);` with `rem`, or custom variables like `min-height: var(--lab-target);`. `parseDimensionPx` only recognizes literal numbers before `px` or the exact string `var(--gt-target)`.
  5. **First-Rule-Wins Bug:**
     If a modifier or reset rule appears before the dimension rule:
     ```css
     .gt-capture__button { background: #14141e; }
     .gt-capture__button { min-width: 48px; min-height: 48px; }
     ```
     `findDeclarations` takes the first block (which lacks `min-width`), causing an immediate failure.
  6. **Multi-Selector Rules:**
     Writing `button.gt-control` or `.gt-control.primary` will fail `sel.split(/\s+/)[0] === targetClass`.

---

### 2.3 `frontend/tests/a11y.motion.test.ts`
- **File Read Method:** Vite raw string import: `import globalCss from '../src/styles/global.css?raw'`.
- **Parsing Mechanism (`extractMediaBlock`):**
  1. Locates `css.indexOf(mediaFeature)`.
  2. Finds first `{` after `mediaFeature`.
  3. Loops character-by-character, incrementing `depth` on `{` and decrementing on `}`.
  4. Slices out the substring between opening and closing braces.
- **What It Tests:**
  - `@media (prefers-reduced-motion: reduce)` block must exist.
  - Inside the block, strict regexes require:
    - `animation-duration:\s*0\.001ms\s*!important`
    - `animation-play-state:\s*paused\s*!important`
    - `transition-duration:\s*0\.001ms\s*!important`
    - Must contain exact selector strings: `.gt-start__pulse-dot`, `.gt-capture__status-indicator`, `.gt-capture__progress-bar`, `.gt-mascot`.
    - `animation:\s*none\s*!important`
    - `filter:\s*none\s*!important`
    - `transform:\s*none\s*!important`
  - Visible focus rings:
    - Regex: `/\.gt-control:focus-visible\s*\{([^}]+)\}/`
      - `outline:\s*(\d+)px\s+solid\s+var\(--gt-focus\)` with px >= 3.
      - `box-shadow:[^;]*0\s+0\s+0\s+(\d+)px\s+var\(--gt-focus\)`.
    - Same outline checks on `.gt-start-surface:focus-visible`, `.gt-explore__canvas:focus-visible`, and `.gt-explore__ask-input:focus-visible`.
  - Forced colors mode:
    - `@media (forced-colors: active)`
    - `outline:\s*3px\s+solid\s+Highlight\s*!important`
    - `border:\s*2px\s+solid\s+ButtonText\s*!important`
- **What Would Break It:**
  1. **Focus Ring Color in Lab Redesign:**
     The Lab redesign specification (`lab-spec.md` line 23) notes: *"Visible focus rings (copper or cyan)."*
     However, this test strictly regexes for `solid var(--gt-focus)`!
     If a developer writes `outline: 3px solid var(--gt-copper);` or `outline: 3px solid var(--gt-cyan);`, **the test fails**.
     To satisfy both, `--gt-focus` itself must be set to the copper/cyan hex token in `tokens.css`, and CSS rules must continue using `var(--gt-focus)`.
  2. **Focus-Visible Selector Grouping:**
     Writing `.gt-control:focus, .gt-control:focus-visible { ... }` breaks the regex `/\.gt-control:focus-visible\s*\{([^}]+)\}/` because of the preceding selector or comma.
  3. **Braces in Comments or Strings inside Media Blocks:**
     If a developer puts `/* { note } */` or `content: "}";` inside or before the media query, `extractMediaBlock` miscounts braces and truncates the media block early, failing all subsequent assertions.
  4. **Multiple `@media (prefers-reduced-motion: reduce)` Blocks:**
     `indexOf` only extracts the first block. If a lane adds a second reduced-motion block in `lab.css` or later in `global.css`, it is ignored.
  5. **Renaming / Removing Legacy Animated Elements:**
     If `.gt-capture__progress-bar` or `.gt-start__pulse-dot` is replaced by lab-themed components (e.g. `.gt-lab__meter`) and removed from the reduced-motion block, `expect(content!).toContain('.gt-capture__progress-bar')` fails.
  6. **Alternative Reduced Motion Values:**
     Writing `animation-duration: 0s !important` or `animation: none` on `*` will fail because `0.001ms !important` is specifically asserted.

---

### 2.4 `frontend/tests/screens.render.test.ts`
- **File Read Method:** Vite raw string import: `import css from '../src/styles/global.css?raw'`.
- **Parsing Mechanism:** Direct regex execution on raw CSS string.
- **What It Tests:**
  - CSS Touch Target Assertions (Lines 146-170):
    - `expect(css).toMatch(/--gt-target:\s*48px/);`
    - `expect(css).toMatch(/\.gt-control\s*{[^}]*min-height:\s*var\(--gt-target\)/s);`
    - `expect(css).toMatch(/\.gt-control\s*{[^}]*min-width:\s*var\(--gt-target\)/s);`
    - `/\.gt-capture__button\s*{[^}]*min-height:\s*(\d+)px/s.exec(css)` (asserts >= 48).
    - `/\.gt-explore__back\s*{[^}]*min-height:\s*(\d+)px/s.exec(css)` (asserts >= 48).
    - `/\.gt-explore__ask\s*{[^}]*min-height:\s*(\d+)px/s.exec(css)` (asserts >= 48).
    - `/\.gt-explore__send\s*{[^}]*min-height:\s*(\d+)px/s.exec(css)` (asserts >= 48).
  - Markup Assertions (Server-side rendering via `renderToStaticMarkup`):
    - `Start`: One button only, `class="gt-start-surface"`, specific aria-label.
    - `Capture`: All 6 button labels present ("Take photo", "Choose image", "Saved diagrams", "Sample: triangle", "Sample: sine graph", "Sample: bar chart").
    - `Explore`: Canvas with role `img`, back button, ask button, text fallback when speech unavailable.
- **What Would Break It:**
  1. **The Inverted Variable Trap (`var(--gt-target)` vs Literal `px`):**
     Notice the strict clash in expectations:
     - `.gt-control` **MUST** declare `min-height: var(--gt-target)`. Writing `min-height: 48px;` fails!
     - BUT `.gt-capture__button`, `.gt-explore__back`, `.gt-explore__ask`, and `.gt-explore__send` **MUST** declare `min-height: (\d+)px`. Writing `min-height: var(--gt-target);` returns `undefined`, which coerces to `NaN`, and `NaN >= 48` evaluates to **false**!
  2. **Moving Screen Rules to Screen CSS Files:**
     If `.gt-capture__button` or `.gt-explore__back` are moved to `src/styles/screens/capture.css` or `explore.css`, `css` (which imports `global.css?raw`) will not match them.
  3. **Selector Grouping:**
     Writing `.gt-explore__ask, .gt-explore__send { min-height: 48px; }` fails the regex `/\.gt-explore__ask\s*{[^}]*min-height/`.
  4. **Modifying Sample Card Labels:**
     The redesign plan mentions converting samples to "specimen jar" cards. If the button text is changed from `"Sample: triangle"` to `"Specimen: Triangle"` or icon-only, line 40 throws.

---

### 2.5 `frontend/tests/polish.test.ts`
- **File Read Method:** Does not import raw CSS. Uses `renderToStaticMarkup` on React screen components.
- **What It Tests:**
  - `Start`: Contains `gt-start__creature-emblem`, `<svg`, `gt-start__triad`, `gt-start__action-badge`, exactly 1 button.
  - `Capture`: Contains `gt-capture__button--primary`, `gt-capture__button--secondary`, `gt-capture__button--saved`, `gt-capture__samples-grid`, `gt-capture__status-card`.
    - **CRITICAL ASSERTION:** `expect(html).not.toContain('aria-hidden')`.
  - `Explore`: Contains `gt-explore__badge`, `gt-explore__status-card`, `gt-explore__canvas-container`, `gt-explore__ask`, `gt-explore__back`.
- **What Would Break It:**
  1. **The `aria-hidden` Trap on Capture:**
     Line 49 asserts `expect(html).not.toContain('aria-hidden')` across the entire Capture screen markup! If decorative SVG icons, specimen jar illustrations, rivets, bolts, or stitched seam dividers are added to `Capture.tsx` with `aria-hidden="true"`, **this test fails**.
  2. **Renaming BEM Elements:**
     Renaming `gt-capture__samples-grid` to `gt-capture__specimens-grid` fails line 46.
  3. **Adding a Button to Start:**
     Adding a secondary settings button or help button on Start fails `html.match(/<button/g)).toHaveLength(1)`.

---

### 2.6 `frontend/tests/mascot.test.ts`
- **File Read Method:**
  - `import mascotSvg from '../public/mascot/frankenstein-phone.svg?raw';`
  - `import captureSource from '../src/screens/Capture.tsx?raw';`
  - `import exploreSource from '../src/screens/Explore.tsx?raw';`
  - `import startSource from '../src/screens/Start.tsx?raw';`
  - SSR of `<Mascot />`.
- **What It Tests:**
  - `Mascot.tsx`: Renders `<svg`, `aria-hidden="true"`, strict class `class="gt-mascot "`, no `<text` or `<tspan`, total byte size <= 8192 bytes.
  - Hardcoded SVG path geometry:
    - `A12 12 0 0 0`
    - `stroke="#25a357"`
    - `r="14"`
    - `r="5.5"`
    - `fill="#ffffff"`
    - `d="M78 24 V7"`
    - `r="3.5"`
    - `stroke-dasharray="3 2"`
  - Screen placement constraints:
    - `startSource` must contain `from '../components/Mascot'` and `<Mascot`.
    - `captureSource` **MUST NOT** contain `'Mascot'`.
    - `exploreSource` **MUST NOT** contain `'Mascot'`.
- **What Would Break It:**
  1. **The Mascot Placement Conflict:**
     `lab-spec.md` line 19 states: *"6. Mascot (inline SVG...) on Start and the empty states."*
     If a lane adds `<Mascot />` to `Capture.tsx` (for an empty state) or `Explore.tsx`, lines 94 and 98 will **fail immediately** because `captureSource` and `exploreSource` explicitly forbid the string `'Mascot'`.
  2. **Redesigning the Mascot SVG:**
     Any visual changes that alter the stroke color `#25a357`, remove the antenna path `d="M78 24 V7"`, alter eye radii, or remove dashed seams `stroke-dasharray="3 2"` will fail.
  3. **Missing Trailing Space in Class:**
     Line 39 asserts `toContain('class="gt-mascot "')`. Omitting the trailing space in the class string fails.

---

## 3. Exact Patterns the Redesign Must Avoid

| Category | Pattern to AVOID | Why It Breaks Tests | Required Compliant Pattern |
| :--- | :--- | :--- | :--- |
| **Tokens** | Non-hex tokens (`rgb()`, `hsl()`, `oklch()`) | `a11y.contrast.test.ts` regex `/^(#[0-9a-fA-F]{3,8})/` fails to extract value | Use 6-digit hex (`#0b0e0c`) in `tokens.css` |
| **Tokens** | Token aliases (`--gt-line: var(--gt-green);`) | `parseColourTokens` does not resolve variables; returns `undefined` | Repeat literal hex: `--gt-line: #39ff88;` |
| **Tokens** | 8-digit hex (`#rrggbbaa`) or 4-digit hex | `hexToRgb` bit shift misaligns channels, breaking contrast checks | Use 6-digit hex only |
| **Tokens** | Renaming or omitting any of the 15 tested tokens | Test has static list of 15 token names; asserts each is defined | Retain all 15 token names with compliant hex values |
| **Tokens** | Modifying tokens such that contrast drops < 7.0:1 | 17 text/surface pairs are tested for WCAG AAA 7.0:1 | Validate all 17 pairs against dark background tokens |
| **Architecture** | Splitting tested classes into `@import`ed files | Raw imports (`?raw`) and `fs.readFileSync` do NOT resolve `@import` | Keep tested selectors directly in `src/styles/global.css` |
| **Architecture** | Removing `--gt-target: 48px;` from `global.css` | Both `a11y.targets` and `screens.render` regex `global.css` for it | Keep `--gt-target: 48px;` declared in `:root` of `global.css` |
| **CSS Syntax** | CSS native nesting (`& { ... }`) | Flat regex `/([^{]+)\{([^}]+)\}/` truncates at first inner `}` | Write flat, standard CSS rules for all tested classes |
| **CSS Syntax** | Wrapping target classes in `@media` / `@supports` | At-rule opening brace desynchronizes `ruleRegex` | Keep base target declarations in top-level unnested rules |
| **CSS Syntax** | Comma-separated multi-selectors | Regexes expect exact single selector before `{` | Use single selector per block: `.gt-control:focus-visible {` |
| **CSS Syntax** | Element qualifiers (`button.gt-control`) | Selector match `sel.split(/\s+/)[0] === targetClass` fails | Use class selector directly: `.gt-control {` |
| **Dimensions** | `min-height: 48px;` on `.gt-control` | `screens.render.test.ts` demands `min-height: var(--gt-target)` | Use `min-height: var(--gt-target); min-width: var(--gt-target);` |
| **Dimensions** | `min-height: var(--gt-target);` on screen buttons | `screens.render.test.ts` demands literal `(\d+)px` | Use literal `min-height: 48px;` (or larger px) on screen buttons |
| **Dimensions** | Using `rem`, `em`, `clamp()`, `calc()` | `parseDimensionPx` returns `null` | Use integer `px` or `var(--gt-target)` |
| **Focus Rings** | Changing `var(--gt-focus)` to another token | `a11y.motion.test.ts` regex requires `solid var(--gt-focus)` | Redefine `--gt-focus` in `tokens.css`; keep `var(--gt-focus)` in CSS |
| **Reduced Motion** | Multiple reduced-motion blocks | `extractMediaBlock` only extracts the first block in the file | Consolidate all reduced motion rules into ONE block |
| **Reduced Motion** | Using `animation-duration: 0s` | Regex requires `animation-duration: 0.001ms !important` | Maintain exact `0.001ms !important` string |
| **Reduced Motion** | Removing legacy animated classes | Test checks `.gt-start__pulse-dot`, `.gt-capture__progress-bar`, etc. | Keep those class names in the reduced-motion rule |
| **Markup** | Adding `aria-hidden` anywhere on `Capture.tsx` | `polish.test.ts` asserts `expect(html).not.toContain('aria-hidden')` | Avoid `aria-hidden` on Capture; use CSS presentation or empty alt |
| **Markup** | Adding Mascot to `Capture.tsx` or `Explore.tsx` | `mascot.test.ts` asserts source does not contain `'Mascot'` | Only use `<Mascot />` on `Start.tsx` |

---

## 4. Real Bugs in the Existing Parsers

Below are 7 concrete bugs discovered in the test parsers, including minimal CSS examples proving false passes and false failures.

### Bug 1: False Pass in `a11y.targets.test.ts` via `min()` or subtraction `calc()`
- **Parser Function:** `parseDimensionPx` in `frontend/tests/a11y.targets.test.ts`
- **Root Cause:** Uses regex `/(\d+(?:\.\d+)?)\s*px/` to find the first occurrence of `px`.
- **Minimal CSS Example:**
  ```css
  .gt-explore__ask {
    min-width: 48px;
    min-height: min(48px, 24px); /* Resolves to 24px in browser, violating Req 12.1 */
  }
  ```
- **Behavior:** The regex extracts `"48"` from `min(48px, 24px)`, returns `48`. The assertion `expect(48).toBeGreaterThanOrEqual(48)` **passes**, creating a **false pass** for an inaccessible 24px button.

### Bug 2: False Failure in `a11y.targets.test.ts` via Valid `rem` or mathematical `calc()`
- **Parser Function:** `parseDimensionPx` in `frontend/tests/a11y.targets.test.ts`
- **Root Cause:** Does not evaluate `rem` or multiplication in `calc()`.
- **Minimal CSS Example:**
  ```css
  .gt-explore__ask {
    min-width: 3rem; /* 3rem * 16px = 48px */
    min-height: calc(2 * 24px); /* 48px */
  }
  ```
- **Behavior:**
  - For `3rem`, no `px` is found, returns `null`. Fails with `expected null not to be null`.
  - For `calc(2 * 24px)`, regex matches `24px` instead of computing 48px. Fails with `expected 24 to be >= 48`.
  - Result: **False failure** on valid 48px targets.

### Bug 3: False Failure in `a11y.targets.test.ts` via "First Rule Wins"
- **Parser Function:** `findDeclarations` in `frontend/tests/a11y.targets.test.ts`
- **Root Cause:** Returns declarations for the *first* matching rule without merging subsequent rules for the same selector.
- **Minimal CSS Example:**
  ```css
  /* Base reset or state modifier declared first */
  .gt-capture__button {
    background: #14141e;
  }

  /* Actual dimension declaration declared later */
  .gt-capture__button {
    min-width: 48px;
    min-height: 48px;
  }
  ```
- **Behavior:** `findDeclarations` stops at the first rule and returns `{ background: '#14141e' }`. `decls['min-width']` is `undefined`, resulting in a **false failure**.

### Bug 4: False Pass / Desynchronization in `a11y.targets.test.ts` via Nested At-Rules
- **Parser Function:** `parseCssRules` in `frontend/tests/a11y.targets.test.ts`
- **Root Cause:** Flat regex `/([^{]+)\{([^}]+)\}/g` treats the first opening `{` to the first closing `}` as a rule.
- **Minimal CSS Example:**
  ```css
  @media (max-width: 600px) {
    .gt-control {
      min-width: 20px; /* Inaccessible responsive override! */
      min-height: 20px;
    }
  }
  ```
- **Behavior:** The parser treats `@media (max-width: 600px)` as the selector and `.gt-control { min-width: 20px; min-height: 20px;` as the declaration body. The nested rule is never parsed as a rule. The parser only evaluates the desktop `.gt-control` rule, creating a **false pass**.

### Bug 5: Catastrophic Color Channel Corruption in `a11y.contrast.test.ts` on 8-digit Hex
- **Parser Function:** `hexToRgb` in `frontend/tests/a11y.contrast.test.ts`
- **Root Cause:** The regex matches 8-digit hex `/^(#[0-9a-fA-F]{3,8})/`, but `hexToRgb` bitshifts a 32-bit integer assuming a 24-bit 6-digit hex:
  ```ts
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
  ```
- **Minimal CSS Example:**
  ```css
  --gt-text: #ffffffcc; /* 8-digit hex (white with 80% alpha) */
  --gt-bg: #000000ff;   /* 8-digit hex (black with 100% alpha) */
  ```
- **Behavior:**
  For `0x11223344`:
  Channel 0 becomes `(0x11223344 >> 16) & 0xff = 0x22` (Green channel instead of Red!).
  Channel 1 becomes `(0x11223344 >> 8) & 0xff = 0x33` (Blue channel instead of Green!).
  Channel 2 becomes `0x11223344 & 0xff = 0x44` (Alpha channel instead of Blue!).
  Red channel `0x11` is completely discarded. Produces corrupted contrast ratios and **false failures or false passes**.

### Bug 6: Truncated Extraction in `a11y.motion.test.ts` via Braces in Comments
- **Parser Function:** `extractMediaBlock` in `frontend/tests/a11y.motion.test.ts`
- **Root Cause:** Character scanner balances `{` and `}` without ignoring comments or strings.
- **Minimal CSS Example:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    /* Reset all pulse animations { note } */
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
    }
  }
  ```
- **Behavior:** The `}` inside the comment `/* Reset all pulse animations { note } */` decrements `depth` to 0. `extractMediaBlock` returns only `"/* Reset all pulse animations { note "`. The assertion for `animation-duration: 0.001ms` fails with a **false failure**.

### Bug 7: Secondary Media Block Blindness in `a11y.motion.test.ts`
- **Parser Function:** `extractMediaBlock` in `frontend/tests/a11y.motion.test.ts`
- **Root Cause:** Uses `css.indexOf('prefers-reduced-motion: reduce')`, which matches only the first block.
- **Minimal CSS Example:**
  ```css
  /* Block 1: Passed baseline */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001ms !important; }
    .gt-mascot svg { filter: none !important; transform: none !important; }
  }

  /* Block 2: Added by Lab lane later in stylesheet */
  @media (prefers-reduced-motion: reduce) {
    .gt-lab__spark { animation: arc-pulse 1s infinite; /* Violates reduced motion! */ }
  }
  ```
- **Behavior:** `extractMediaBlock` inspects only Block 1. Block 2 is never scanned, creating a **false pass** for active motion under reduced motion.

---

## 5. CSS Architecture Recommendations for the Redesign

### 5.1 Single-File vs. Multi-File Architecture Analysis
- **The Risk of Multi-File Splitting:**
  In Vite and Vitest, `?raw` imports return the exact source code of the targeted file without executing PostCSS or resolving `@import` statements.
  Furthermore, `frontend/vitest.config.ts` specifically whitelists only `global.css`:
  ```ts
  css: { include: [/global\.css/] }
  ```
  If styles for `.gt-control`, `.gt-capture__button`, `.gt-explore__back`, `:focus-visible`, reduced-motion, or forced-colors are moved into separate files (`lab.css`, `settings.css`, `capture.css`), **the test suites will immediately fail**.
- **The Token Location Invariant:**
  `frontend/tests/a11y.contrast.test.ts` uses `fs.readFileSync` pointed explicitly at `src/styles/tokens.css`. Tokens **cannot** be moved to `global.css` or `lab.css`.
- **Target Variable Invariant:**
  Both `a11y.targets.test.ts` and `screens.render.test.ts` explicitly assert that `--gt-target: 48px;` exists as a text match in `global.css`.

### 5.2 Recommended Redesign Architecture
1. **Core Single-Entrypoint Strategy:**
   - Keep `frontend/src/styles/tokens.css` as the single source of truth for all color, spacing, radius, and font tokens.
   - Keep `frontend/src/styles/global.css` as the consolidated master stylesheet. All interactive classes, touch targets, focus-visible outlines, reduced-motion blocks, and forced-colors blocks **must remain directly in `global.css`**.
2. **Modular Extension for Lab Features:**
   - If lanes build modular CSS (e.g. `src/styles/lab.css` for blueprint grids, specimen jar borders, voltage sparks), `@import './lab.css';` can be placed at the bottom of `global.css`.
   - **Crucial Rule:** Any class evaluated by existing tests (`.gt-control`, `.gt-capture__button`, `.gt-capture__sample-btn`, `.gt-explore__*`, `.gt-lang-selector__btn`, `.gt-rate-selector__btn`) **must remain declared in `global.css`**.
3. **Dual Definition of Target:**
   - Define `--gt-target: 48px;` in `tokens.css` AND retain `:root { --gt-target: 48px; }` in `global.css`.

---

## 6. Design for a NEW Universal CSS Test Suite

To eliminate the blind spots of the existing regex parsers without breaking existing tests, a new test file should be added: `frontend/tests/css.universal.test.ts`.

### 6.1 Motivation & Scope
- **File Discovery:** Scans **every** CSS file in `src/styles/` and `src/components/`, not just `global.css`.
- **Robust Parsing:** Strips comments and handles nested braces cleanly using a balanced-brace tokenizer.
- **Universal Standards Enforcement:** Ensures that any new components (e.g. lab dialogs, specimen buttons) satisfy 48px targets, visible focus, and reduced motion.

### 6.2 Architectural Sketch

```ts
/**
 * Universal CSS Accessibility & Token Conformance Test
 * Scans ALL CSS files in frontend/src/ for a11y compliance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 1. Recursive CSS collector
function getAllCssFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllCssFiles(fullPath));
    } else if (entry.name.endsWith('.css')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 2. Tokenized parser (handles strings, comments, and nested media queries)
interface RuleDeclaration {
  file: string;
  selector: string;
  media: string | null;
  declarations: Map<string, string>;
}

function parseAllStylesheets(): RuleDeclaration[] {
  // Balanced brace walker that preserves @media context and extracts clean rules
  // ...
}

describe('Universal CSS Quality Gates', () => {
  const rules = parseAllStylesheets();

  it('enforces 48x48px touch targets on ALL interactive controls across all files', () => {
    const interactivePattern = /(?:button|input|select|a|\.gt-[a-z0-9_-]*(?:btn|button|control|surface|item))/i;
    for (const rule of rules) {
      if (interactivePattern.test(rule.selector) && !rule.selector.includes(':')) {
        const minW = rule.declarations.get('min-width');
        const minH = rule.declarations.get('min-height');
        // Validates px >= 48, rem >= 3rem, or var(--gt-target)
      }
    }
  });

  it('ensures every keyframe animation is suppressed under reduced motion', () => {
    // Collects all @keyframes names across all files
    // Asserts each keyframe or its animated element has animation: none under prefers-reduced-motion
  });

  it('prohibits raw hardcoded hex colors outside tokens.css', () => {
    // Ensures all color/background/border declarations use var(--gt-*) tokens
  });
});
```

---

## 7. Prioritised Risk & Issue Register

| Priority | Affected File | Problem Description | Impact on Redesign | Required Fix / Safe Pattern |
| :---: | :--- | :--- | :--- | :--- |
| **CRITICAL** | `frontend/tests/screens.render.test.ts` | Demands literal `(\d+)px` on `.gt-capture__button`, `.gt-explore__back`, `.gt-explore__ask`, `.gt-explore__send`, but demands `var(--gt-target)` on `.gt-control`. | Redesigning buttons to use `var(--gt-target)` causes `NaN >= 48` failure. | Keep literal `min-height: 48px;` (or `52px`/`56px`) on screen buttons; use `var(--gt-target)` only on `.gt-control`. |
| **CRITICAL** | `frontend/tests/a11y.motion.test.ts` | Focus-visible regex strictly demands `solid var(--gt-focus)`. | Spec calls for copper/cyan focus rings; changing CSS variable breaks test. | Do not write `var(--gt-copper)` or `var(--gt-cyan)` in CSS. Instead, redefine `--gt-focus` in `tokens.css`. |
| **CRITICAL** | `frontend/tests/polish.test.ts` | Asserting `expect(html).not.toContain('aria-hidden')` across Capture screen. | Adding decorative icons, seams, or specimen SVGs with `aria-hidden="true"` breaks Capture tests. | Never add `aria-hidden` attributes to elements in `Capture.tsx`. Use CSS backgrounds or empty decorative spans. |
| **HIGH** | `frontend/tests/mascot.test.ts` | Asserts `captureSource` and `exploreSource` strictly do not contain `'Mascot'`. | Spec suggests mascot on empty states; importing Mascot in Capture or Explore fails test. | Restrict Mascot component usage strictly to `Start.tsx`. |
| **HIGH** | `frontend/tests/a11y.targets.test.ts` | Parser uses first-matching-rule logic; does not merge declarations across blocks. | Placing a state or modifier rule before the base dimension rule fails the test. | Ensure the base rule containing `min-width` and `min-height` is the FIRST rule for that selector in `global.css`. |
| **HIGH** | `frontend/tests/a11y.contrast.test.ts` | Does not resolve `var()` aliases in `tokens.css`. | Defining `--gt-line: var(--gt-green);` returns `undefined` and fails brand check and 17 contrast checks. | Always declare token values as literal 6-digit hex strings (`--gt-line: #39ff88;`). |
| **MEDIUM** | `frontend/tests/a11y.targets.test.ts` & `screens.render.test.ts` | Tests load `global.css?raw` without resolving `@import`. | Moving interactive rules to `lab.css` or `settings.css` causes tests to see null rules. | Keep all 10 tested interactive classes directly in `frontend/src/styles/global.css`. |
| **MEDIUM** | `frontend/tests/a11y.motion.test.ts` | Requires exact strings `.gt-start__pulse-dot`, `.gt-capture__status-indicator`, `.gt-capture__progress-bar`. | Replacing progress bar with a lab power meter causes reduced-motion tests to fail. | Keep legacy class names listed in the reduced-motion block even if new lab classes are added. |
| **LOW** | `frontend/tests/a11y.contrast.test.ts` | Fails on 8-digit hex (`#rrggbbaa`) and 4-digit hex (`#rgba`). | Adding alpha hex tokens corrupts RGB channel math. | Use 6-digit hex tokens (`#123456`) and `rgba(...)` only for non-tested alpha tokens. |
