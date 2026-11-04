# Step 1 evidence: P1 property-test generator fix

## What the spec said
Design.md P1: "Every point is reachable: for any valid scene and viewport,
`hitTest` at a point's screen position returns that vertex."

Requirements 4.3 (vertex hit) and 4.6 (vertex priority over line).

## What was wrong
The test generator used `fc.float` (32-bit) and allowed 1 px viewports. Two
points 1e-45 apart in normalised space collapsed to the same screen pixel
after `toScreen`, making the property unprovable for the second point.
Failure rate: 6 of 30 isolated runs (20%).  Root cause: generator, not
`hitTest`.

## What was built (commits on main, 2026-11-03)
| File | Change |
|---|---|
| `frontend/tests/hitTest.prop.test.ts` | Screen-space separation filter (reject pairs ≤ 22 px apart), `fc.double`, canvas range 200–2000 px. Regression test "Tie rule" pins seed -732699702. |
| `docs/kiro-evidence/pbt-p1-flake.md` | "Fix applied" addendum documenting the 10-seed run (30/30 green). |
| `.github/workflows/ci.yml` | Retry workaround removed (single `npm test`). |

## Which tests caught what
- P1 (200 runs): 10 seeded runs all green after the fix; had failed in ~20% of
  runs before.
- "Tie rule" regression test: permanently documents the counterexample from
  seed -732699702, ensuring the tie-resolution rule stays covered.

## Verification
`npx vitest run tests/hitTest.prop.test.ts` — 3 tests, 249 total frontend
tests, all green.
