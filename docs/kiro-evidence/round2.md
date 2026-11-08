# Round 2 evidence: spec to task to tests to what the tests caught

## Who did what (honest attribution)
- **Kiro:** spec for round 2 (Requirements 16 and 17, design section, properties P40-P46, tasks 23-28), Task 24 (backend Ask fixes, committed `abd4640`), most of the Task 25 code and the Task 26 code (found in the working tree when Kiro stopped), the frontend properties P43 and P44 and the seven mutation checks for T26.
- **Claude Code (finishing Kiro's work after the owner shut Kiro off, at the owner's instruction):** gated and committed T25 (`dabd499`) and T26 (`8f60415`); wrote the backend properties P40, P41, P42, P45, P46 (`backend/tests/test_round2_props.py`), ran their mutation checks, fixed the 301-character bug below, filled the review table, and wrote this file.
- **agy / Antigravity:** the round-1 audit reports (a6, a7) and the f4 lane that T24 built on. Claude subagent audits after round 1 are credited in `docs/reports/`.
The `tasks.md` boxes for T26-T28 were NOT ticked by Claude.

## Requirement to task to test
| Requirement | Task | Property / test | Where |
|---|---|---|---|
| 16.1 client identity cannot be forged | 25.1 | P40 forged `X-Forwarded-For` never changes the key; entries left of the trusted hops are never read | `backend/tests/test_round2_props.py` |
| 16.2 limiter state bounded | 25.2 | P41 no empty window; no client kept longer than window + sweep interval | same |
| 16.5 guards path-invariant | 25.5 | P42 `normalize_path` maps every slash variant to the route and is idempotent; a mix of variants shares one rate limit | same |
| 16.10 fact answers bounded | 24 | P45 at most 2 sentences, at most 300 characters; clamping twice equals once | same |
| 16.x "don't know" with punctuation | 24 | P46 trailing `.`, danda, double danda never change `is_dont_know`, including exact-match phrases | same |
| 17.1 Back navigation total and spoken | 26.1 | P43 | `frontend/tests/round2.navigation.prop.test.ts` |
| 17.2 announcements join without loss | 26.2 | P44 | `frontend/tests/round2.announce.prop.test.ts` |
| 17.x non-finite hit distance is a miss | 26.5 | `hitTest.nan.prop.test.ts` | frontend |

## What the properties caught (real bugs)
1. **P45 found a real off-by-one in `clamp_answer`** (`backend/app/ask.py`): a long answer with no spaces was cut to 300 characters and then a full stop was appended, giving **301** characters (`clamp_answer("a" * 400)`). The first version of the property did not find it, because the generator rarely produced long text without spaces; adding such a strategy plus explicit examples made it fail (`assert 301 <= 300`). Fixed by reserving one character for the full stop.
2. **P46 as first written was too weak:** its mutant (stop stripping trailing punctuation) survived, because the Hindi and Gujarati phrases are matched as substrings. The property now also covers the exact-match phrases ("unknown", "don't know" and so on), where the stripping matters, and the mutant is killed.
3. The T26 mutation checks (Kiro) and the CSP browser check found **K2-01**: opening `#/debug` while the app runs crashed React (error #300, a hook order violation); fixed in T25.

## Mutation checks (T27.6): every new property fails on a deliberately broken version
| Property | Mutant | Result |
|---|---|---|
| P40 | `client_key` reads the leftmost forwarded entry | fails |
| P41 | `_sweep` does nothing | fails |
| P42 | `normalize_path` returns the path unchanged | fails |
| P45 | the "reserve one character" fix removed | fails |
| P46 | trailing punctuation no longer stripped | fails |
| P43, P44 and `hitTest` NaN | seven mutants run by Kiro in T26 | all killed (per Kiro's gate log) |
Each mutant was applied by a one-line edit, the matching test run, and the file restored from a backup; the suite is green after restoring.

## Gates at the end of T27
Frontend: `tsc` clean, 118 test files, 1585 tests pass, `npm run build` ok (Kiro's last gate run; no frontend source changed afterwards). Backend: full pytest exit 0, `ruff check` clean, `ruff format --check` clean (67 files). `frontend/src/core` diff: only the NaN fix in `hitTest.ts` (T26.5). Nothing pushed.

## Not done
CORE-09 (lost pointer capture) and NEEDS-KIRO-02 (`hapticEngine.ts:132`) remain OPEN. CORE-08 (pointer capture try/catch) is fixed in code but UNVERIFIED on a phone with TalkBack. Low findings (A6-11..16 subset, CORE-14..16) were not requested.
