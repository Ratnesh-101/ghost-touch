# Audit Report: Lane r6-tests-tonight (Test Quality and Soundness Audit)

**Status:** DONE  
**Auditor:** Antigravity (agy)  
**Date:** 2026-11-10  
**Scope:** Strict read-only audit of every test file under `frontend/tests` and
`backend/tests` added or changed in commits since 2026-11-09 (lanes n1, m1, m2, m3,
n2, p1, p2, p3, p5, g1, q1, and Kiro round-5 files: `correct.ghostwriter.prop.test.ts`,
`correct.deleteKinds.prop.test.ts`, `validator.parity.test.ts`,
`test_validator_parity.py`).

---

## 1. Findings (Highest Severity First)

- **HIGH · backend/tests/test_n1_backend.py:398-400 · Tautological assertion on longest-side
  calculation cannot catch broken aspect scaling · Concrete failure scenario:** In
  `test_m4_05_semantic_calculations_safe_with_boundary_aspect`, `scene_high` is defined with
  `aspect=20.0`, segment `AB` along the x-axis (`pa=(0.0, 0.0), pb=(0.5, 0.0)`), and segment `AC`
  along the y-axis (`pa=(0.0, 0.0), pb=(0.0, 0.5)`). Lines 398-400 assert only:
  ```python
  best_seg, _, _ = _find_longest_side(scene_high)
  assert best_seg is not None
  ```
  `assert best_seg is not None` passes for any valid scene with segments. If
  `dx = (float(pb.x) - float(pa.x)) * aspect` in `backend/app/semantic.py:716` is mutated to ignore
  aspect (`dx = float(pb.x) - float(pa.x)`), both segments have length `0.5`. By document order
  tie-breaker (`AB` evaluated before `AC`), `_find_longest_side` still returns `AB`, and
  `assert best_seg is not None` passes without verifying whether aspect ratio scaled the segment
  length or which segment was returned.
  - **What the test should assert:** `AC` should be defined with raw Euclidean length strictly
    longer than `AB` at aspect 1.0 (e.g., `Point(id="C", x=0.0, y=0.8)` giving `AC = 0.8 > 0.5`),
    so that without aspect `AC` wins, but with `aspect=20.0`, `AB` (effective length
    `0.5 * 20 = 10.0 > 0.8`) strictly wins. The test must assert:
    `assert best_seg.element_id == "AB"`.
    Additionally, a low aspect boundary (`aspect=0.05`) should assert `best_seg.element_id == "AC"`.
  - **One-line production mutation that survives:** In `backend/app/semantic.py:716`, change:
    `dx = (float(pb.x) - float(pa.x)) * aspect`
    to:
    `dx = float(pb.x) - float(pa.x)`
    `test_m4_05_semantic_calculations_safe_with_boundary_aspect` continues to pass cleanly.
  - **Minimal fix:**
    ```python
    scene_high = DiagramScene(
        kind="geometry",
        aspect=20.0,
        points=[
            Point(id="A", x=0.0, y=0.0),
            Point(id="B", x=0.5, y=0.0),
            Point(id="C", x=0.0, y=0.8),
        ],
        segments=[Segment(id="AB", a="A", b="B"), Segment(id="AC", a="A", b="C")],
    )
    best_seg, _, _ = _find_longest_side(scene_high)
    assert best_seg is not None
    assert best_seg.element_id == "AB"
    ```

- **MED · backend/tests/test_ask_ids.py:290 · Hypothesis property run count below project standard
  (100 vs 200) · Concrete failure scenario:** In `backend/tests/test_ask_ids.py:290`,
  `test_hypothesis_unknown_id_never_gets_answer` uses `@settings(max_examples=100)`. Lane
  `m2-test-quality` (tasks TQ-07 and TQ-08) raised and standardized all property-based tests in
  `test_infra_props.py`, `test_semantic_props.py`, and `test_validate_props.py` to 200 examples.
  Running only 100 examples over the wide product space of point IDs (`A`..`Z`, `P1`..`P99`) and
  candidate unknown queries reduces coverage of edge cases such as numeric ID boundary collisions
  (`P9` vs `P99`, `P10` vs `P100`).
  - **Quoted code line:**
    ```python
    @settings(max_examples=100)
    ```
  - **What the test should assert:** The property should execute at least 200 iterations matching
    project-wide standards:
    `@settings(max_examples=200)`.
  - **One-line production mutation that survives:** A subtle regex boundary flaw in
    `backend/app/ask.py:101` affecting 3-digit point IDs `P100`..`P999` has a high survival
    probability under 100 iterations on random ID draws.
  - **Minimal fix:** In `backend/tests/test_ask_ids.py:290`, change:
    `@settings(max_examples=100)`
    to:
    `@settings(max_examples=200)`

- **LOW · frontend/tests/ (Task 38 files) · Round-5 Kiro property test files named in scope are
  unmerged in current worktree · Concrete failure scenario:** The brief names `share.*.prop` and
  `saved.eviction.prop` in scope for this audit (recorded in `BUILD_LOG.md:2957` as Kiro Task 38:
  `share.sanitize.prop.test.ts`, `share.template.prop.test.ts`, `saved.eviction.prop.test.ts`,
  `share.honesty.prop.test.ts`). Verification of the filesystem confirmed that these four test files
  do not exist on disk in worktree `gt-lane-r6-tests-tonight`. They were authored on Kiro's branch
  and unmerged into this worktree.
  - **Quoted reference:** `BUILD_LOG.md:2958`:
    `four new test files: frontend/tests/share.sanitize.prop.test.ts (P66-P70),`
    `share.template.prop.test.ts (P71), saved.eviction.prop.test.ts (P72-P76...),`
    `share.honesty.prop.test.ts (P77-P78)`
  - **What the suite should assert:** The test files should be present in the repository and
    executed during CI gates to continuously verify P66-P78 invariants.
  - **One-line production mutation that survives:** Regressions in `sanitizeShareName` token
    scanning or `saveDiagramWithEviction` rollback logic will not be caught in this branch without
    these test files.
  - **Minimal fix:** Merge or cherry-pick Kiro's Task 38 commit into the mainline/worktree branch so
    these test files are tracked and run by Vitest.

---

## 2. Sound Areas

The gesture decision properties (`explore.gesture.prop.test.ts`), Frankenstein lab theme token and
animation verification (`labTheme.prop.test.ts`), diagram persistence rollback and transactional
isolation (`drivers.diagramStore.test.ts`, `k6.pwa-offline.test.ts`, `n2.round4.test.ts`), PWA
offline gateway retry isolation (`502` retried with speech, `504` immediate timeout), Ghostwriter
core additions and deletions (`correct.ghostwriter.prop.test.ts`, `correct.deleteKinds.prop.test.ts`
at 250 runs), Ghostwriter flow contracts (`ghostwriter.prop.test.ts`, `teach.editor.test.tsx` with
behavioral jsdom event dispatching), validator parity suite (`backend/fixtures/validator_parity.json`,
`validator.parity.test.ts`, `test_validator_parity.py`), and accessibility screen DOM assertions
across English, Hindi, and Gujarati (`m1.a11y.test.tsx`, `a11y.screens.test.tsx`,
`RateSelector.test.tsx`, `share.open.banner.test.tsx`, `share.open.routing.test.tsx`,
`share.open.errors.test.tsx`) are sound, assert rigorous behavioral invariants, use >= 200 runs
for all properties, enforce GT-06 speech silence on background storage errors, and contain zero
tautological assertions.

---

## 3. Audited Files Summary

| File | Suite / Lane | Verdict |
|---|---|---|
| `backend/tests/test_n1_backend.py` | n1, p1 | FINDING (HIGH: line 399 tautology) |
| `backend/tests/test_ask_ids.py` | p5 | FINDING (MED: max_examples=100) |
| `backend/tests/test_hardening.py` | n1 | SOUND (concurrency, limits, 499) |
| `backend/tests/test_infra_props.py` | n1, m2 | SOUND (P21-P30 at 200 runs) |
| `backend/tests/test_semantic_props.py` | n1, m2 | SOUND (P1-P3 at 200 runs) |
| `backend/tests/test_validator_parity.py` | Kiro T37.3 | SOUND (32 parity fixture cases) |
| `frontend/tests/m1.a11y.test.tsx` | m1, p3 | SOUND (A11Y-01 through A11Y-10) |
| `frontend/tests/RateSelector.test.tsx` | m1, p3 | SOUND (a11y, multiplier sign, speech) |
| `frontend/tests/fix.share.security.test.ts` | m1, p3 | SOUND (SEC-01..10, nesting, caps) |
| `frontend/tests/drivers.diagramStore.test.ts`| m2, p2 | SOUND (atomic eviction rollback) |
| `frontend/tests/geometry.prop.test.ts` | m2 | SOUND (P8 at 200 runs, noNaN) |
| `frontend/tests/explore.gesture.prop.test.ts` | m2 | SOUND (P36-P38 at 300 runs) |
| `frontend/tests/labTheme.prop.test.ts` | m2 | SOUND (P18-P20 at 200 runs) |
| `frontend/tests/m3.sharedLinkGate.test.ts` | m3, p3 | SOUND (gate, honesty, GT-06 silence) |
| `frontend/tests/round2.navigation.prop.test.ts`| m3 | SOUND (P43 at 300 runs, all screens) |
| `frontend/tests/share.open.banner.test.tsx` | m3, p3 | SOUND (banner honesty and targets) |
| `frontend/tests/share.open.routing.test.tsx` | m3, p3 | SOUND (hash routes, gate transition) |
| `frontend/tests/n2.round4.test.ts` | n2, p2 | SOUND (M4-02..04, M4-10 angle name) |
| `frontend/tests/k6.pwa-offline.test.ts` | n2, p2 | SOUND (502 retry, 504 no-retry) |
| `frontend/tests/a11y.screens.test.tsx` | p3 | SOUND (multilingual DOM checks) |
| `frontend/tests/flow.capture.test.ts` | p3 | SOUND (localized kind names) |
| `frontend/tests/labSettings.test.tsx` | p3 | SOUND (dialog semantics, 48px target) |
| `frontend/tests/share.open.errors.test.tsx` | p3 | SOUND (polite/alert live regions) |
| `frontend/tests/ghostwriter.prop.test.ts` | g1, v1 | SOUND (P58-P61 at 250 runs) |
| `frontend/tests/ghostwriter.teach.test.tsx` | g1, v1 | SOUND (behavioral UI tests) |
| `frontend/tests/teach.editor.test.tsx` | g1, v1 | SOUND (jsdom keyboard events) |
| `frontend/tests/correct.ghostwriter.prop.test.ts` | Kiro T34 | SOUND (P54-P57 at 250 runs) |
| `frontend/tests/correct.deleteKinds.prop.test.ts` | Kiro T37.1 | SOUND (P62-P65 at 250 runs) |
| `frontend/tests/validator.parity.test.ts` | Kiro T37.3 | SOUND (32 parity cases) |
| `frontend/tests/share.*.prop.test.ts` | Kiro T38 | FINDING (LOW: unmerged in worktree) |
| `frontend/tests/saved.eviction.prop.test.ts` | Kiro T38 | FINDING (LOW: unmerged in worktree) |
