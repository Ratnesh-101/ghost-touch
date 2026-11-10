# Session review (Kiro, T39: round-5 audit items for core and tests): 2026-11-10

**Verdict: SHIP** (nothing pushed; nothing tried on a phone)

**Test totals at the end of T39:** frontend 149 files, **1989 tests passed, 0 skipped**; `tsc --noEmit` 0 errors; build ok. Backend **783 passed**, 0 skipped; `ruff check` and `ruff format --check` clean (79 files).

Commits: `de00897` (pending spec and review notes, tasks 36-38), `a004b04` (39.0), `d520aca` + `a3a1e2d` (spec), `538d8eb` + `1c612b9` (39.1), `8076e86` + `8664992` (39.2 and its tsc fix), `030af85` (39.3), `f257be7` (39.4), and the 39.5 commit.

## Audit claims, checked against the code
| Item | Claim | Verdict | Evidence |
|---|---|---|---|
| 39.1 | `addPoint` accepts `title`; a rename then changes the scene title | **Right** | A probe gave point `title`, then `renameLabel(…, 'title', 'Top')` set `scene.title` to "Top" and left the point "Apex" |
| 39.1 | The share export drops the point's segment | **Wrong** | `validateShareScene` renames the point *and* the endpoints: `titleB: el_title-B`. P79 pins it |
| 39.2 | >500 points can be saved offline through `addPoint` | **Not reachable today** | `addPoint` has one caller, `flow/ghostwriter.ts`, which caps at 300; Correct has no add |
| 39.3 | `localizedFindingTarget` falls back to English | Right for hand-built findings; `verifyScene` always sets `angleVertex` | Fixed anyway (P80) |
| 39.3 | Hindi and Gujarati facts are ignored | Right, and now intended | Requirement 18.10: the vision prompt asks for English fact shapes, and no screen lets anyone type a fact (P81) |
| 39.4 | Three tests can pass vacuously | **Right** | A "never disagree" mutant passes the old 18.2 property (1 passed) and fails the new one |
| 39.5 | Coincident points make the earlier one unselectable | **Right** | `hitTestPoint` takes the later point on a tie |

## Checks
1. **Architecture:** pass. Every change to `frontend/src/core` is pure; no browser API or React. No file under `screens/`, `flow/` or `App.tsx` was edited. `share/validate.ts` only swaps its reserved-id set for the identical core one.
2. **Tuned haptic values and `hitTest`:** unchanged.
3. **Properties:** P79-P82 added at 250 runs; every new or tightened test is mutation-checked: 5 + 2 + 2 + 5 + 5 mutants, all killed. P66-P78 pass under 9 recorded seeds and 3 fresh ones. No `numRuns` below 200.
4. **TEMP stubs:** none.
5. **tasks.md:** 38, 38.4, 39 and 39.0-39.5 ticked; every one matches a commit.

## Needs someone else (not done here)
- **UI lane (flow/ and screens/):** `planAddPoint` should report a nudge (`nudgedFrom`), and Teach should speak `teach.pointNudged` in en, hi and gu (design.md, "Round-5 core fixes").
- **Backend decision:** `validate.py` keeps reserved ids such as `title`. A model scene with such an id passes the backend but now fails `validateSceneInvariants`. Teach and share are unaffected, because the share validator renames first. Renaming in the backend too would align them.
- **My process slips, fixed:** two parallel commit races, once for the spec files and once for the 39.1 BUILD_LOG line. Each was fixed with an extra commit. 39.2 was first committed without running `tsc` (it used `node:fs`) and fixed in `8664992`.
