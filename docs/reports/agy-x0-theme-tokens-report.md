# Lane x0-theme-tokens Report (agy)

**Builder:** agy (Antigravity)  
**Reviewer:** Claude Code  
**Date:** 2026-11-06  
**Status:** Complete  

## Overview
Migrated legacy bare-hex color declarations across `frontend/src/styles/` (`global.css` and `explore.css`) to `var(--gt-*)` design tokens declared in `frontend/src/styles/tokens.css`. Emptied the `legacyBareHexAllowList` in Property P20 (`frontend/tests/labTheme.prop.test.ts`) so that all CSS color declarations conform to the design token system with zero visual changes.

---

## Hex to Token Mappings

| Legacy Hex | File & Line | Usage | Token Name | Token Definition in `tokens.css` | Replacement in Stylesheet |
|---|---|---|---|---|---|
| `#183324` | `global.css:744, 1102, 1149` | Primary button gradient start | `--gt-btn-gradient-start` | `--gt-btn-gradient-start: #183324;` | `var(--gt-btn-gradient-start, #183324)` |
| `#12241b` | `global.css:744, 1102, 1149` | Primary button gradient end | `--gt-btn-gradient-end` | `--gt-btn-gradient-end: #12241b;` | `var(--gt-btn-gradient-end, #12241b)` |
| `#20202e` | `global.css:1027` | Explore canvas container border | `--gt-border-canvas` | `--gt-border-canvas: #20202e;` | `var(--gt-border-canvas, #20202e)` |
| `#050508` | `global.css:1080` | Ask input legacy dark background | `--gt-surface-input` | `--gt-surface-input: #050508;` | `var(--gt-surface-input, #050508)` |
| `#ffffff` | `global.css:1278` | Active language/rate button text | `--gt-text-active` | `--gt-text-active: #ffffff;` | `var(--gt-text-active, #ffffff)` |
| `#e8ffe8` | Historical (allow-list) | Early prototype canvas vertex text; no occurrences in existing CSS | `--gt-text-vertex` | `--gt-text-vertex: #e8ffe8;` | Retained token in `tokens.css` for completeness; removed from allow-list |
| `#0b0b10` | `explore.css:89, 357` | Focus ring offset fallback | `--gt-bg` | `--gt-bg: #0b0e0c;` | Aligned fallback to match `--gt-bg`: `var(--gt-bg, #0b0e0c)` |
| `#080a09` | `explore.css:348` | Ask input dark background fallback | `--gt-lab-charcoal` | `--gt-lab-charcoal: #080a09;` | Consumed as `var(--gt-lab-charcoal, #080a09)` |

---

## Allow-List Status (P20)
In `frontend/tests/labTheme.prop.test.ts`:
```ts
/**
 * Documented allow-list of legacy bare hex literals identified during retroactive spec audit.
 * All 8 legacy instances in global.css and explore.css have been migrated to var(--gt-*) tokens
 * (Lane x0-theme-tokens). Allow-list is now empty.
 */
const legacyBareHexAllowList = new Set<string>();
```
The allow-list is now completely empty (`size === 0`). Property P20 asserts that every hex occurrence in `screenStylesheets` is either a token definition (`--gt-*: #hex`) or managed inside a `var(--gt-*)` call.

---

## Verification Results

### 1. Frontend Test Suite
- Command: `npm --prefix frontend test`
- Result: **Passed** (82 test files, 1203 tests passed, 0 failed).
- Key test suites verified:
  - `frontend/tests/labTheme.prop.test.ts` (P18, P19, and P20 all pass with empty allow-list)
  - `frontend/tests/a11y.contrast.test.ts` (All WCAG AAA text/background >= 7:1 and UI component >= 4.5:1 pass)
  - `frontend/tests/css.imports.test.ts` (All @import ordering and file existence checks pass)
  - `frontend/tests/lab.tokens.test.ts` (All required token presence and contrast checks pass)

### 2. TypeScript Type-Check & Build Note
- Commands:
  - `npm --prefix frontend exec -- tsc -p frontend --noEmit`
  - `npm --prefix frontend run build`
- Result: Pre-existing TS2578 error (`Unused '@ts-expect-error' directive`) across 31 test files in `frontend/tests/` (e.g. `AccessibleButton.test.tsx`, `RateSelector.test.tsx`).
- Root cause: `@types/qrcode` was installed by the planner/owner for the sharing contract, which transitively installed `@types/node`. As a result, Node.js runtime imports (`node:fs`, `node:path`, `node:url`) now have type definitions, making the historical `@ts-expect-error` comments in those test files trigger TS2578.
- Code integrity: Zero errors exist in `frontend/src/` or any stylesheet. The 31 test files are outside the allowed files for lane `x0-theme-tokens` and were left untouched in compliance with AGENTS.md Rule 1 and the headless run rules.

---

## Needs from Planner / Kiro
- In `frontend/tests/`, remove the now-unused `@ts-expect-error` directives above `node:fs`, `node:path`, and `node:url` across the 31 test files so that `tsc -p frontend --noEmit` and `npm --prefix frontend run build` pass cleanly with `@types/node` present.

---

## Files Touched
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/global.css`
- `frontend/src/styles/explore.css`
- `frontend/tests/labTheme.prop.test.ts`
- `docs/reports/agy-x0-theme-tokens-report.md`
- `docs/BUILD_LOG.md`
