# K4: core fixes from the Kiro audit (2026-11-12)

Source: `docs/reviews/kiro-audit-2026-11-12-core.md`. Each fix: requirement first, a test that failed on the old code, then the fix, one commit per finding. Nothing pushed. No tuned haptic value, pattern, timing or effect structure changed.

| Finding | Commit | Requirement | Change | Tests |
|---|---|---|---|---|
| CORE-A1 | 6a81b99 | 18.11 | The right-angle regex in `core/verify.ts` now needs the phrase to end at "right angle" (not "angled", not followed by "triangle"). | `tests/verify.rightAngledTriangle.test.ts` (5 phrasings x 2; the 6 phrasing cases failed before the fix) |
| CORE-A5 | a844193 | 9.10 | `movePoint` returns the same scene for a non-finite x or y; `clamp01(+Infinity)` is 1 (NaN and -Infinity stay 0). | `tests/correct.k4.test.ts`; P31 amended (non-finite gives the same scene); `correct.test.ts` clamp01(Infinity) now 1 |
| CORE-A7 | ca28671 | 9.12 | `deletePoint` and `deleteSegment` return the same scene for an unknown id. | `tests/correct.k4.delete.test.ts` (4 failed before) |
| CORE-A6 | 280e59b | 16.12 | `hitTest` returns none when `view.scale` is not > 0 (zero or NaN). | `tests/hitTest.zeroViewport.test.ts` |
| CORE-A4 | 80da5e8 | 6.4 | The bar announcement uses `spokenNumber`: `Number(value.toFixed(2))` as text. | `tests/hapticEngine.barSpeech.test.ts` |

## Decisions
- A5: the existing P31 asserted the old behaviour for a non-finite coordinate on one axis (the finite axis was still clamped). Under Requirement 9.10 the whole move is ignored, so P31 and one `clamp01` example were amended with the requirement. This is a deliberate contract change, not a weakened check; the finite-input assertions are unchanged.
- A4: not skipped. Only the speech string changes; no existing property or the P-numbered contract depends on the raw number text (full suite stayed green). Non-finite values are left as `String(value)` because `hitTest` already never yields them (P53). Localised number formats for Hindi and Gujarati are not done: the engine has no language.

## Skipped
- CORE-A8 (as instructed). CORE-A2, A3, A9 and everything outside `core/` belong to agy lanes r7-explore and r7-flow.

## Gate
- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 171 files, 2202 tests passed (run before the A4 commit's requirement text edit and before this doc). Playwright not run.
- Not verified: behaviour on a phone.
