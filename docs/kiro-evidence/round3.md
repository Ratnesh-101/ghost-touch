# Round 3 evidence: requirement to task to test to what the test caught

## Who did what (honest attribution)
- **Kiro (this round):** checked the round 2 FIXED rows and re-ran their mutants (task 28), the CORE-09 fix (30), NEEDS-KIRO-02 (31), hit-test PERF-01 and R3-07 (32), the Spec Ghost spec, steering, hook and review (29), one validator fix found by the gate (29.9), and this file (33).
- **Antigravity (agy):** built Spec Ghost: the module (first at `frontend/src/verify/verify.ts`), its first tests P47-P50 and the k1 wiring. Kiro wrote the spec for it after the code existed and says so in Requirement 18. agy also built lanes k3, k4, n1 and m2, which landed on `main` during this round.
- **Claude Code:** planned and reviewed; finished T25 and T26 after Kiro was stopped in round 2 (those ticks say so).

## Requirement to task to test to what it caught
| Requirement / finding | Task | Test | What it caught |
|---|---|---|---|
| Round 2 rows marked FIXED | 28 | Re-ran the P40, P41, P42, P45, P46 mutants | All killed. P40 had to be rewritten first, because the code had moved to `_normalize_ip_key(entries[-trusted_hops])`; P42 raised from 80/60 to 200 runs. |
| CORE-09: losing pointer capture must end the stroke like a cancel | 30 | `frontend/tests/teach.canvas.pointer.test.tsx` (jsdom) | Without the handler the dragged point stays where the browser dropped it: "expected 0.9 to be close to 0.5". |
| NEEDS-KIRO-02 / Req 4: an unlabelled corner is spoken in the active language | 31 | P51 `frontend/tests/vertexSpeech.prop.test.ts` (7 tests, 200-250 runs) | 5 of 7 failed on the old engine (English "Point B" in Hindi and Gujarati). Mutants killed: engine speaks English again, `runEffects` speaks the raw key, merge drops keyed speech. |
| PERF-01: hit test without per-piece allocations, same answers | 32 | P52 `frontend/tests/hitTest.perf.prop.test.ts`, oracle `tests/helpers/hitTestOracle.ts` | Equal to the frozen old code on 700 random scenes (24 fingers each, including a 2000-point polyline in 200 runs). Mutants killed: box margin too tight, last candidate wins a line tie, last candidate wins a vertex tie, polyline start not advanced. |
| R3-07: a bar with a non-finite value is never announced | 32 | P53, same file | 3 of 3 failed on the old code: a NaN bar was spoken "label, NaN", and an infinite bar flattened every other bar's pitch. Mutants killed: filter removed, maximum counts non-finite values. |
| Req 18.1-18.5: Spec Ghost as built (ratios, angles, silence, wording) | 29.1-29.4, 29.7 | P47-P50 `frontend/tests/verify.test.ts`, now 200 runs each | Mutants killed by agy's properties alone: P47 tolerance 0.15 to 0, P48 length depends on translation, P49 "not to scale" ignored, P50 median not sorted. |
| Req 18.6 (Kiro): measure in the diagram's own proportions | 29.5 | `frontend/tests/verify.review.test.ts` | Failed first: an honest wide right triangle (aspect 2) was flagged, and a right angle that is only right in true proportions was flagged. Fixed in `core/verify.ts`. The "aspect ignored" mutant survives agy's tests and is killed by these (4 failures). |
| Req 18.7 (Kiro): different units | 29.5 | same file | Failed first: "3 cm", "40 mm", "0.05 m" on a real 3-4-5 triangle were compared as 3, 40, 0.05 and flagged. Now converted to mm; unknown or missing units among different ones give silence. The "units ignored" mutant is killed only by these (5 failures). |
| Req 18.2 / regression: no false disagreement on real scenes | 29.5 | regression test in `verify.test.ts`, plus `verify.review.test.ts` | agy's test was titled "ZERO false disagreements" but only checked the parse count (21 of 60). It now asserts 0 disagreements in AI mode; that assertion also kills the P48 and P50 mutants. |
| Req 5 / P9: the validator never raises | 29.9 | P9 `backend/tests/test_validate_props.py`; `backend/tests/test_validate_raw_meta.py` | P9 failed on a random draw during the gate: `"facts": <int>` raised `TypeError` in code added by lane k3. The new test failed 7 of 11 before the fix. |

## Measured
- Hit test (task 32), desktop, Node 24, temporary micro-benchmark deleted after the run: a 2000-point curve on a 412x800 view, 20 000 finger positions, three rounds. Old 33.4-34.4 µs per call, new 8.2-8.3 µs per call, about 4x. Not measured on a phone.

## Findings kept as known limits (not bugs, not changed)
- Spec Ghost tolerance: the research ground truth `01_right_triangle.json` is labelled 3-4-5 but drawn about 18% off. It is flagged at the 15% sample tolerance and not at the 25% AI tolerance. Tolerances are an owner decision.
- Spec Ghost bars are measured from `y_base`, so an axis that does not start at 0 can mislead; with exactly 2 lengths both sides are named; the renderer ignores `aspect`; a shared link can show "Verified by ..." next to the caveat (owner decision R1).

## Process notes (mistakes included)
- Commit `801b222` (T30) also swept in agy lane k4 source files that were staged in the shared index. The BUILD_LOG was corrected in `5b8b972`; history was not rewritten. Since then Kiro commits with a path list (`git commit -- <paths>`).
- The brief said to add i18n keys last. The key `vertex.unlabelled` went in as its own commit (`6bd9503`) just before the code that uses it, after k1 and k6 were merged, so `main` never speaks the raw key.
- `jsdom@31.0.0` was added as a pinned dev dependency for the CORE-09 component test.
- Moving `verify.ts` kept the old path as a one-line re-export, so git records a new file rather than a rename.

## Commits
`8be6678` (28), `801b222` and `5b8b972` (30), `6bd9503` and `d8e6d09` (31), `8fa8db2` (32), `5c2cd29`, `67ce954`, `6c52a2e`, `dce1b89` (29), and the commit that adds this file (33). Nothing pushed.

## Not verified
Nothing in this round was tried on a phone: vibration feel, TalkBack, and how Hindi and Gujarati voices read "बिंदु B" / "બિંદુ B". The hi and gu wording needs a native speaker.
