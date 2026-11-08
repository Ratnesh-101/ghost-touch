# Lane h1-verify-core Report

**Tool**: agy (reviewed by Claude)  
**Lane**: h1-verify-core (pure frontend module)  
**Status**: DONE  
**Date**: 2026-11-08  

---

## 1. Executive Summary

Implemented **SPEC GHOST**, a pure TypeScript consistency checker between a scene's printed facts and its drawn geometry. Per specification:
- This is an honest consistency check, **NOT** forgery protection.
- It **never** uses the word "verified" and **never** advises "trust the text".
- It is completely silent when unsure, when facts cannot be parsed, when fewer than 2 parsed lengths are matched, or when any fact notes that the diagram is "not to scale".
- All distance checks are measured in the normalized unit square (preserving aspect ratio in the letterboxed canvas).
- All checks verify length **RATIOS** only ($\pm 15\%$, or $\pm 25\%$ when `mode === 'ai'`) and angles ($\pm 8^\circ$).

All constraints from `AGENTS.md`, `docs/briefs/agy-h1-verify-core.md`, and `docs/reports/feature-tournament.md` have been strictly met:
- Pure module with zero DOM / React / window / navigator / document / speech dependencies.
- Zero edits to Kiro-owned files (`frontend/src/core/**` untouched).
- All 119 test files pass (1,596 tests passed, including P47-P50 property tests and regression over all sample and research prediction scenes).

---

## 2. Done List

1. **`frontend/src/verify/verify.ts`**:
   - `parseFacts(facts: string[] | undefined, scene?: DiagramScene): ParsedFactsResult`:
     - Parses segment length patterns:
       - `"XY = n unit"` / `"XY = n"` (e.g. `AB = 5 cm`, `AC = 4`)
       - `"length of (side) XY is n unit"` / `"The length of side AB is 3 cm."` / `"The length of hypotenuse CA is 13."`
       - `"Side XY has a length of n unit"` / `"Side XY is n unit"`
       - `"XY: n"` (e.g. `AB: 5`, `CA: 4 cm`)
     - Parses angle patterns:
       - `"angle X = n°"` / `"angle X = n degrees"` / `"angle at X = n°"` / `"m∠X = n°"`
       - 3-letter vertex angle specifications (e.g. `"angle ADC = 90°"`)
       - Right angle descriptions (`"angle X is a right angle"` $\to 90^\circ$)
     - Parses bar chart facts:
       - `"label: n"` (e.g. `Maths: 12`, `Red: 35`)
       - `"label has a value of n"`
     - Parses scale disclaimers:
       - `"not to scale"`, `"not drawn to scale"`, etc. $\to$ flags `hasNotToScale = true`
     - Matches reversed segment names (e.g. fact target `AC` matches segment `CA`).
     - Ignores anything unparsed without error.
   - `verifyScene(scene: DiagramScene, opts?: VerifyOptions): VerifyResult`:
     - Modes: `'ai' | 'raw' | 'sample' | 'shared'` (default: `'sample'`).
     - Length ratio tolerance: $\pm 15\%$ default, $\pm 25\%$ when `mode === 'ai'`.
     - Angle tolerance: $\pm 8^\circ$.
     - Returns `{ status: 'silent', findings: [] }` if:
       - Scene has no facts.
       - Any fact states "not to scale".
       - Total matched lengths $< 2$.
     - Computes length ratio agreement against consensus (median scale for $N \ge 3$, or direct relative scale difference for $N = 2$).
     - Computes drawn angle from geometry using dot product / arccos on incident vectors.
     - Produces `{ status: 'disagree', findings: [...] }` if any checked ratio or angle exceeds tolerance.
     - Produces `{ status: 'consistent', findings: [] }` if all checked ratios and angles are within tolerance.
   - `VERIFY_WORDING`:
     - Exported wording constants for internationalization:
       - `disagree: (target: string) => "Facts and drawing disagree on ${target}. I can't tell which is right."`
       - `disagreeTemplate: "Facts and drawing disagree on {name}. I can't tell which is right."`
     - Strictly forbids "verified" or "trust the text".

2. **`frontend/tests/verify.test.ts`**:
   - Unit tests for fact parsing across all specified formats and wording verification.
   - **P47 (Self-consistency)**: A scene built from its own measurements is never flagged (100 fast-check runs on geometric scenes, 100 fast-check runs on bar charts).
   - **P48 (Transform invariance)**: Status and findings are invariant under arbitrary uniform scaling ($0.1\times - 10\times$) and translations (100 fast-check runs).
   - **P49 (Silence on unparsed / not-to-scale / single length)**: Facts with no parsable measurements, disclaimers stating "not to scale", or $<2$ lengths always yield `'silent'` and empty findings.
   - **P50 (Order independence)**: Permutations and shuffles of facts and segments produce identical status and findings (50 fast-check permutations).
   - **Regression Suite**:
     - Verified all 60 valid `DiagramScene` files across `frontend/public/samples/*.json` (3), `research/samples/synthetic/ground_truth/*.json` (10), and `research/results/**/predictions/**/*.json` (47).
     - **0 false disagreements** (`disagreeCount === 0`).
     - Tested honest `triangle.json` $\to$ `'consistent'`.
     - Tested forged `"AC = 7 cm"` on `triangle.json` $\to$ flags segment `CA` with message `"Facts and drawing disagree on AC. I can't tell which is right."`.

---

## 3. Real Scene Regression & Parse Rate

- **Total JSON files scanned**: 67
- **Valid `DiagramScene` files (`version` + `kind`)**: 60
  - `frontend/public/samples/`: 3 scenes
  - `research/samples/synthetic/ground_truth/`: 10 scenes
  - `research/results/**/predictions/`: 47 scenes
- **Scenes with at least 1 parsed fact**: 21
- **Parse rate**: **21 / 60 (35.0%)**
  - Note: The unparsed scenes consist of function curves (e.g. sine graphs, parabolas, lines) which lack geometry segment/bar facts, or legacy research runs with unstructured descriptive text.
- **False disagreements across real scenes**: **0 (0.0%)**
- **Forgery detection test (`triangle.json` with `AC = 7 cm`)**:
  - Expected: Flagged `CA` with disagreement on `AC`.
  - Actual: `status: 'disagree'`, finding: `{ segmentId: 'CA', message: "Facts and drawing disagree on AC. I can't tell which is right." }`.

---

## 4. Verification Proofs

Command execution logs from workspace root:

1. **Test Suite (`npm --prefix frontend test`)**:
   ```
   RUN  v5.1.0 frontend
   Test Files  119 passed (119)
        Tests  1596 passed (1596)
     Duration  2.24s
   ```

2. **TypeScript Compilation Check (`npm --prefix frontend exec -- tsc -p frontend --noEmit`)**:
   ```
   Exit code: 0 (No type errors)
   ```

3. **Production Build (`npm --prefix frontend run build`)**:
   ```
   vite v8.3.5 building client environment for production...
   ✓ 129 modules transformed.
   ✓ built in 252ms
   PWA v2.0.0 generateSW: precache 22 entries (661.16 KiB)
   Exit code: 0
   ```

---

## 5. Needs from Planner

The following items are outside the scope of this pure-module lane and are recommended for downstream lanes:
1. **Scene Load Integration**:
   - Wire `verifyScene` into the scene load lifecycle (`Explore.tsx` / `SavedDiagrams.tsx` / shared diagram loader).
   - If `status === 'disagree'`, announce findings through the speech driver once on load (ensuring single-utterance speech per architecture rules).
2. **Ask Integration**:
   - When answering user questions about a segment with a finding from `verifyScene`, append the caveat: `"Facts and drawing disagree on [target]. I can't tell which is right."`.
3. **Backend Prompt Tightening**:
   - Update `prompts.py` (line 24) to guide LLMs toward `"XY = n unit"` and `"label: n"` format so new AI extractions achieve $>90\%$ fact parse rates.
4. **i18n Translation Registration**:
   - Add Hindi (`hi`) and Gujarati (`gu`) translations for `VERIFY_WORDING`:
     - Template: `"Facts and drawing disagree on {name}. I can't tell which is right."`
