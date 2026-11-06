# Lab Fixes Report (Lane: lab-fixes)

## Executive Summary
This report documents the resolution of the three findings (F-01, F-02, F-03) identified during the independent review of the Frankenstein Laboratory redesign in `docs/reports/review-lab-final.md`, alongside restoring the lost submission day verification marker in `docs/KIRO_WRITEUP.md`.

All items were resolved strictly within the permitted files without altering functional logic, state machines, or tuned haptics. All 1052 tests pass clean, TypeScript type-check exits with 0 errors, and the production build compiles cleanly without warnings.

---

## Findings & Resolutions

### 1. F-01: Bare Hex Color Literals in `frontend/src/styles/explore.css`
- **Issue**: Hard-coded bare hex colors existed in button gradients (`#13271f`, `#0d1a15`), hover text (`#051309`), raw mode badge text (`#0b0e0c`), and corner rivets (`#e0a370`, `#4a2810`).
- **Resolution**:
  - Replaced `.gt-explore__raw-badge` text `#0b0e0c` with `var(--gt-bg, #0b0e0c)`.
  - Replaced hover text `#051309` on `.gt-explore__ask:hover` and `.gt-explore__send:hover` with `var(--gt-text-dark, #051309)`.
  - Added `--gt-surface-raised: #13271f;` and `--gt-surface-sunken: #0d1a15;` to `frontend/src/styles/tokens.css` preserving exact visual look, and referenced them in `.gt-explore__ask` and `.gt-explore__send` gradients: `linear-gradient(180deg, var(--gt-surface-raised, #13271f) 0%, var(--gt-surface-sunken, #0d1a15) 100%)`.
  - Added `--gt-copper-highlight: #e0a370;` and `--gt-copper-shadow: #4a2810;` to `tokens.css` and wrapped rivet gradient stops in `.gt-lab-rivet`: `radial-gradient(circle at 35% 35%, var(--gt-copper-highlight, #e0a370) 0%, var(--gt-copper, #b87333) 50%, var(--gt-copper-shadow, #4a2810) 100%)`.
- **Proof**: A comprehensive search of `explore.css` confirms that zero bare hex literals remain outside `var(--x, #hex)` fallbacks.

### 2. F-02: Bare Hex on Primary Button Hover in `frontend/src/styles/global.css`
- **Issue**: Bare hex `#4dff95` was used on `.gt-btn--primary:hover`.
- **Resolution**:
  - Added `--gt-green-bright: #4dff95;` to `frontend/src/styles/tokens.css` under the Creature Life Green Accents section.
  - Replaced line in `.gt-btn--primary:hover` in `frontend/src/styles/global.css` with `background: var(--gt-green-bright, #4dff95);`. Only the `.gt-btn--primary:hover` rule was touched.

### 3. F-03: Raw Mode Badge Pair Added to Contrast Test in `frontend/tests/a11y.contrast.test.ts`
- **Issue**: The Raw Mode badge color pair (`--gt-bg` text on `--gt-copper` background, 6.65:1 contrast) was missing from the automated contrast suite table.
- **Resolution**:
  - Added `{ text: '--gt-bg', bg: '--gt-copper', label: 'raw badge text on copper' }` to the `large text / UI component pairs (>= 4.5:1)` test table in `frontend/tests/a11y.contrast.test.ts`.
  - Verified it passes with contrast ratio 6.65:1 (well above the 4.5:1 minimum).
  - Extended `frontend/tests/lab.tokens.test.ts` to assert the presence and exact values of the newly introduced design tokens (`--gt-surface-raised`, `--gt-surface-sunken`, `--gt-green-bright`, `--gt-copper-highlight`, `--gt-copper-shadow`).

### 4. Lost Submission Marker in `docs/KIRO_WRITEUP.md`
- **Issue**: The submission day verification marker was missing from Section 10 "Verification & Proof".
- **Resolution**:
  - Added `- **Submission Day Verification:** [FILL: re-run the counts and gates on submission day]` as the last bullet of the list in Section 10 of `docs/KIRO_WRITEUP.md`.

---

## Verification Proof & Test Results

Executed allowable commands from repository root:

1. **TypeScript Compilation Check**:
   ```bash
   npm --prefix frontend exec -- tsc -p frontend --noEmit
   ```
   - **Result**: Clean exit (code 0). Zero type errors across all files.

2. **Frontend Test Suite**:
   ```bash
   npm --prefix frontend test
   ```
   - **Result**: 74 test files passed (100%), 1052 tests passed (increased by 3 from baseline of 1049, 0 failed, 1.23s duration).

3. **Frontend Production Build**:
   ```bash
   npm --prefix frontend run build
   ```
   - **Result**: Build passed cleanly in 163ms with no CSS warnings. PWA v2.0.0 generated with 18 precached assets (503.32 KiB).

4. **Bare Hex Search in `explore.css`**:
   - Total hex occurrences in `frontend/src/styles/explore.css`: 52.
   - 1 in top comment (`#0b0e0c`).
   - 51 inside `var(--token, #hex)` fallback parameters.
   - 0 bare hex literals outside `var(--x, #hex)` fallbacks.

---

## Commit groups

The changes fall cleanly into three logical commit groups:

1. **`fix(design-tokens): add new lab tokens and tokenize bare hexes in explore.css and global.css`**
   - `frontend/src/styles/tokens.css` (add `--gt-green-bright`, `--gt-surface-raised`, `--gt-surface-sunken`, `--gt-copper-highlight`, `--gt-copper-shadow`)
   - `frontend/src/styles/global.css` (use `var(--gt-green-bright, #4dff95)` on `.gt-btn--primary:hover`)
   - `frontend/src/styles/explore.css` (replace bare hexes in button gradients, hover text, badge text, and rivet gradients with design tokens and fallbacks)

2. **`test(a11y): add raw badge contrast test pair and new token assertions`**
   - `frontend/tests/a11y.contrast.test.ts` (add raw badge text on copper pair to UI component contrast suite)
   - `frontend/tests/lab.tokens.test.ts` (assert existence and values of newly introduced tokens)

3. **`docs(writeup): re-add submission day verification marker in section 10`**
   - `docs/KIRO_WRITEUP.md` (re-add lost submission marker bullet in Section 10)
