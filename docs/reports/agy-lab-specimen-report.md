# Lane lab-specimen Report: Real Mini Previews for "Specimen Jar" Sample Cards

**Agent:** Antigravity (builder)  
**Lane:** `lab-specimen` (`agy/lab-specimen`)  
**Task:** Real mini previews for Capture screen specimen jar cards  
**Reviewer:** Claude Code  
**Date:** 2026-11-06  

---

## 1. Executive Summary

This run executed the full brief specified in `docs/briefs/agy-lab-specimen.md` and `docs/briefs/lab-spec.md` for lane `lab-specimen`. It delivers real inline SVG mini previews for Ghost Touch's three bundled sample diagrams (`triangle`, `sine`, `barchart`), preparing them for the Frankenstein's Laboratory "specimen jar" UI theme.

Key accomplishments:
- Created `frontend/src/components/specimenPaths.ts`: a pure, zero-DOM TypeScript module that transforms normalized `DiagramScene` data into SVG path data mapped to a 100×100 box with padding. It handles segments, polylines (down-sampling to at most 40 points), axes, bars, and vertex dots, with extensive guards for edge cases (missing point IDs, inverted coordinates, NaN values).
- Created `frontend/src/components/SpecimenPreview.tsx`: an inline `<svg viewBox="0 0 100 100">` component taking `{ id: SampleId; className?: string }`. It draws diagram paths in life green on a charcoal plate with rounded caps and vertex dots. It is strictly decorative (`aria-hidden="true"`, `focusable="false"`, no `<title>`), preserves button accessible names, relies on precached `loadSample(id)`, caches scenes in memory, and renders a static neutral specimen jar outline while loading or on failure (never displaying error text or spoken messages).
- Created `frontend/src/styles/specimen.css`: isolated stylesheet imported directly by `SpecimenPreview.tsx` using CSS custom properties with strict fallbacks (`var(--gt-copper, var(--gt-green-dim))`, `var(--gt-green)`, `var(--gt-bg)`), with zero animations and explicit reduced-motion protection.
- Created `frontend/tests/specimenPaths.test.ts` (19 tests) and `frontend/tests/specimen.test.tsx` (15 tests): 34 new unit and component tests verifying all three real sample JSON files read from disk with `node:fs`, edge cases, contrast tokens, byte budgets (< 2 KB, well under 30 KB limit), and accessibility.

Zero Kiro-owned files were touched. Zero existing files were modified. Zero new dependencies were added.

---

## 2. Definition of Done Proof (Real Counts)

### 2.1 TypeScript Type Check
```bash
$ npm --prefix frontend exec -- tsc -p frontend --noEmit
# Exit code: 0 (clean, 0 errors across entire frontend codebase and test suite)
```

### 2.2 Frontend Test Suite
```bash
$ npm --prefix frontend test
# Vitest v5.1.0
# Test Files: 44 passed (44) — up from 42 passed (+2 new test files)
# Tests:      507 passed (507) — up from 473 passed (+34 new tests)
# Duration:   802ms
```

New test files:
- `frontend/tests/specimenPaths.test.ts` (19 tests)
- `frontend/tests/specimen.test.tsx` (15 tests)

### 2.3 Frontend Production Build
```bash
$ npm --prefix frontend run build
# vite v8.3.5 building client environment for production...
# transforming...
# ✓ 60 modules transformed.
# rendering chunks...
# dist/registerSW.js                           0.13 kB
# dist/manifest.webmanifest                    0.48 kB
# dist/index.html                              0.70 kB │ gzip:   0.40 kB
# dist/assets/pdf.worker.min-CjEcRF4W.mjs  1,264.34 kB
# dist/assets/index-DkhKiTy5.css              23.69 kB │ gzip:   4.84 kB
# dist/assets/index-DiKDvnGx.js              330.17 kB │ gzip:  99.91 kB
# dist/assets/pdf-ULJPBbF3.js                430.16 kB │ gzip: 129.27 kB
# PWA v2.0.0: precache 14 entries (378.97 KiB)
# Exit code: 0
```

### 2.4 Backend Health & Regression Checks
```bash
$ backend/.venv/Scripts/python -m pytest backend
# 348 passed, 1 skipped, 1 warning in 30.67s
# Exit code: 0

$ backend/.venv/Scripts/python -m ruff check backend
# All checks passed!
# Exit code: 0

$ backend/.venv/Scripts/python -m ruff format --check backend
# 52 files already formatted
# Exit code: 0
```

---

## 3. Component API & Architecture

### 3.1 `SpecimenPreview` Component API

Located in [`frontend/src/components/SpecimenPreview.tsx`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-specimen/frontend/src/components/SpecimenPreview.tsx).

```typescript
export interface SpecimenPreviewProps {
  /** The sample diagram identifier ('triangle' | 'sine' | 'barchart') */
  id: SampleId;
  /** Optional extra CSS class name for card styling and responsive layout */
  className?: string;
  /** Optional preloaded scene (bypasses fetch / cache; ideal for testing or synchronous rendering) */
  scene?: DiagramScene;
  /** Optional custom fetch implementation */
  fetchImpl?: typeof fetch;
}

export function SpecimenPreview(props: SpecimenPreviewProps): JSX.Element;
```

#### Cache Utilities
`SpecimenPreview.tsx` also exports pure in-memory cache helpers:
- `getCachedSample(id: SampleId): DiagramScene | undefined`
- `setCachedSample(id: SampleId, scene: DiagramScene): void`
- `clearSampleCache(): void`

#### Rendering Lifecycle
1. **Initial Mount:** Checks module-level `sampleCache`. If present or if `props.scene` is provided, synchronously renders the diagram immediately with zero layout shift or delay.
2. **Precache Fetch:** If not yet cached, loads from `/samples/${id}.json` using `loadSample(id, fetchImpl)`. Because `/samples/*.json` is precached by the service worker workbox configuration, no remote network round-trip occurs.
3. **Placeholder Glyph:** While loading or if the file fails to parse, renders a static specimen jar outline glyph. It contains strictly zero text nodes and zero live regions so screen readers remain completely undisturbed.
4. **Content Generation:** When loaded, turns the scene into SVG path strings via `generateSpecimenPaths(scene)` and renders:
   - Charcoal card base (`rect.gt-specimen__bg`)
   - Coordinate axes (`path.gt-specimen__axis`)
   - Segments / polylines / bars (`path.gt-specimen__line`)
   - Vertex dots (`circle.gt-specimen__dot`)
5. **Accessibility:**
   - Root `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">`
   - No `<title>` element
   - Preserves parent button's accessible name 100%

### 3.2 `specimenPaths.ts` Pure Generator

Located in [`frontend/src/components/specimenPaths.ts`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-specimen/frontend/src/components/specimenPaths.ts).

Pure, side-effect-free geometry converter:
- **Padded Box Mapping:** Normalized $[0, 1]$ coordinates are mapped to a $100 \times 100$ viewBox with 10 px padding (mapping $[0, 1]$ to $[10, 90]$).
- **Coordinate Formatting:** `formatCoord(val)` clamps floating points to at most 2 decimal places to keep the rendered SVG under a few hundred bytes.
- **Polyline Down-sampling:** `downsamplePoints(pts, maxPoints = 40)`:
  - If length $\le 40$, preserves points as-is.
  - If length $> 40$, uniformly down-samples while strictly preserving `pts[0]` and `pts[last]`.
  - The 100-point sine curve from `sine.json` is down-sampled to exactly 40 points (39 `L` commands).
- **Segments:** Connects referenced point IDs `a` and `b`. Safely skips any segment referencing non-existent IDs.
- **Bars:** Handles `barchart.json` bars. Safely normalizes inverted coordinates (`Math.min` / `Math.max` across $x_0, x_1$ and $y_{\text{top}}, y_{\text{base}}$).
- **Axes:** Renders horizontal $x$-axis and vertical $y$-axis across the padded diagram bounds.
- **Vertex Dots:** Extracts point center coordinates and radius ($r = 2.5$) for named vertices in geometry diagrams (e.g., points A, B, C in `triangle.json`).
- **Static Jar Placeholder:** `getPlaceholderJarPath()` returns the path string for the neutral laboratory specimen jar silhouette.

### 3.3 `specimen.css` Lab Theme Styling

Located in [`frontend/src/styles/specimen.css`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-specimen/frontend/src/styles/specimen.css).

Imported directly from `SpecimenPreview.tsx` (not from `global.css`). Uses only CSS variables with fallbacks:
- Deep charcoal card base: `fill: var(--gt-bg, #0b0e0c)`
- Primary diagram lines & dots: `stroke: var(--gt-green, #39ff88)`, `fill: var(--gt-green, #39ff88)`
- Aged copper accents / axes / placeholder: `stroke: var(--gt-copper, var(--gt-green-dim, #2ea363))`
- Reduced motion: `@media (prefers-reduced-motion: reduce)` zeroes any transitions or animations.

---

## 4. Mounting Guide for Capture Screen Lane

When the Capture screen lane implements the "specimen jar" cards in [`frontend/src/screens/Capture.tsx`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-lab-specimen/frontend/src/screens/Capture.tsx), mount `SpecimenPreview` inside the existing sample buttons as follows:

### Step 1: Import the component
```tsx
import { SpecimenPreview } from '../components/SpecimenPreview';
```

### Step 2: Mount inside `Capture.tsx` sample button loop
In `Capture.tsx` (lines 184–195):
```diff
        <div className="gt-capture__samples-grid">
          {SAMPLES.map(({ id, labelKey }) => (
            <AccessibleButton
              key={id}
              className={`gt-capture__button gt-capture__sample-btn gt-capture__sample-btn--${id}`}
              onClick={() => void handleSample(id)}
            >
-             <span className={`gt-capture__sample-icon gt-capture__sample-icon--${id}`} />
+             <SpecimenPreview id={id} className="gt-capture__sample-preview" />
              <span>{t(labelKey)}</span>
            </AccessibleButton>
          ))}
        </div>
```

### Accessibility Assurance
Because `SpecimenPreview` renders with `aria-hidden="true"`, `focusable="false"`, and contains no `<title>` or text tags, the button's accessible name spoken by TalkBack or screen readers remains exactly `t(labelKey)` ("Sample: triangle", "Sample: sine graph", "Sample: bar chart"). Touch target size ($\ge 48 \times 48$ px) is preserved by `AccessibleButton`.

---

## 5. Test Evidence

### 5.1 `frontend/tests/specimenPaths.test.ts` (19 tests)
- **Sample files from disk:** Parses `triangle.json`, `sine.json`, and `barchart.json` using `node:fs`.
- **Triangle:** Validates 3 segments (CA, AB, BC) and 3 vertex dots at (30, 30), (66, 78), and (30, 78).
- **Sine:** Validates coordinate axes ($y = 50$, $x = 16.4$) and down-sampling of 100 points to 40 points (39 `L` commands), with start point (18, 50) and end point (82, 50).
- **Bar chart:** Validates coordinate axes and 4 distinct bar outlines (`Z` closures) with exact mapped bounds.
- **Downsampling:** Validates preservation of points $\le 40$, boundary preservation, and single/empty arrays.
- **Edge cases:**
  - Empty or null scene handling (`hasContent: false`).
  - Segments referencing missing or non-existent point IDs safely ignored.
  - Inverted bar coordinates correctly ordered with `Math.min` / `Math.max`.
  - Non-finite (NaN / Infinity) numbers filtered out.
  - Single-point and NaN polylines handled gracefully.
  - Valid static jar placeholder outline.

### 5.2 `frontend/tests/specimen.test.tsx` (15 tests)
- **Accessibility:** Verifies `aria-hidden="true"`, `focusable="false"`, absence of `<title>`, absence of `<text>` and `<tspan>`.
- **Render output:** Verifies `viewBox="0 0 100 100"`, base plate `rect.gt-specimen__bg`, custom `className` concatenation.
- **Shape rendering:** Verifies segment lines + 3 dots for triangle, axes + polyline for sine, axes + bars for barchart.
- **Byte size budget:** Measures UTF-8 byte length of rendered SVGs (all between 200 and 1,500 bytes, well under 30 KB budget).
- **Lifecycle & Cache:** Verifies neutral static glyph on un-cached mount, instant synchronous render when cached, and cache clearing.
- **CSS tokens:** Verifies tokens fallbacks (`--gt-bg`, `--gt-green`, `--gt-copper`), absence of keyframes/animations, and reduced-motion block.

---

## 6. Self-Audit Against Rules

| Rule | Requirement | Status | Verification Evidence |
|---|---|---|---|
| **AGENTS.md Rule 1** | Never edit Kiro-owned files | **PASS** | No files in `frontend/src/core/**`, `*.prop.test.ts`, `.kiro/**`, `backend/app/schema.py`, `backend/app/validate.py` touched. |
| **AGENTS.md Rule 4** | No git commands | **PASS** | No git add, commit, push, branch, or reset commands executed. |
| **AGENTS.md Rule 5** | Secrets protection | **PASS** | No `.env` files opened, read, printed, or created. |
| **AGENTS.md Rule 6** | No new dependencies | **PASS** | Pure React, SVG, and CSS. No packages added to `package.json`. |
| **AGENTS.md Rule 7** | Architecture & A11y | **PASS** | Decorative SVG with `aria-hidden="true"`, no `any`, no `console.log`. |
| **Brief File Scope** | Edit only allowed files | **PASS** | Only the 5 new files permitted by `agy-lab-specimen.md` created. |
| **Brief DoD** | Real verification proofs | **PASS** | `tsc`, `npm test` (507 passing), `npm run build`, `pytest` (348 passing), `ruff` clean. |

---

## 7. Commit Groups

The following ordered logical commit groups are prepared for the reviewer to merge:

### Commit Group 1: Pure geometry path generator and tests
- **Message:** `feat(lab): pure SVG path generator for specimen jar diagram previews`
- **Files:**
  - `frontend/src/components/specimenPaths.ts`
  - `frontend/tests/specimenPaths.test.ts`

### Commit Group 2: SpecimenPreview component, stylesheet, and tests
- **Message:** `feat(lab): add SpecimenPreview component for specimen jar diagram cards`
- **Files:**
  - `frontend/src/components/SpecimenPreview.tsx`
  - `frontend/src/styles/specimen.css`
  - `frontend/tests/specimen.test.tsx`

### Commit Group 3: Lane handoff report
- **Message:** `docs(lab): add agy-lab-specimen lane completion report`
- **Files:**
  - `docs/reports/agy-lab-specimen-report.md`
