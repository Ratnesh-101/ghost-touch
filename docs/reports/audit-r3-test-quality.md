# Round-3 re-audit: quality of the round 2 tests (Claude Sonnet subagent, read-only, 2026-11-08)
Tests were read, not run. `test_round2_security.py` was only listed by name (not judged). **Supervisor has not re-verified the five surviving mutants; the lane that strengthens the tests re-runs them.**

| ID | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| R3-01 | HIGH | test_round2_props.py (P45) | The two-sentence bound is never exercised (generators rarely give 3+ sentences); `clamp_answer` returning "" passes every case. | Generate 1..6 sentences joined with `. ` `! ` `? ` `। `; assert non-empty for non-blank input and the output without its closing `.` is a prefix of the sanitised input. |
| R3-02 | HIGH | P41 | `_allow` return value ignored; "never admits more than per_minute" untested. | Track admitted timestamps per client; assert the count in any sliding 60 s window <= per_minute. |
| R3-03 | HIGH | P42 | Middleware built with `body_limits={}`; "same body limit" half untested. | Give a body limit; send oversize bodies on variant paths; assert 413 for all. |
| R3-04 | MED | round2.navigation.prop.test.ts (P43) | The `for (lang of ['en','hi','gu'])` loop never changes the language; the property is a table check over 7 screens x 4 flags. | Call the real language setter or drop the loop. |
| R3-05 | MED | P40 | Entries <=20 chars, IPs <=15, so the `[:64]` truncation never fires; "hops>0 with fewer entries" and "hops>0 with no header" are single examples only. | Generate entries/peers over 64 chars; property-test the short-header and no-header cases. |
| R3-06 | MED | P46 | One fixed negative; substring match (`ask.py:196`) unchecked for false positives such as "The unknown angle is 30 degrees". | More negative controls. |
| R3-07 | MED | round2.sources.test.ts, app.hooksOrder.test.ts | Source-text pins pass even if the call is dead code. Honest in their headers, but must not be cited as property evidence. | Extract the hash-handler decision into a pure function and test it, or add a jsdom test. |
| R3-08 | LOW | saved.focus.test.tsx | Rewrite partly weakened to source pins, but round2.saved.test.ts covers the behaviour. OK, regex pin brittle. | |
| R3-09 | LOW | round2.announce.prop.test.ts | `joinAnnouncements` used as oracle (acceptable); never generates several `speak` followed by non-speak effects. | |
| R3-10 | LOW | hitTest.nan.prop.test.ts | `constantFrom` of three values = three cases; bar rects and axes with NaN not covered. | |
| R3-11 | LOW | security.headers.test.ts | Config literals; `vercel.json` vs `siteHeaders` compared from one source. | |

## Five surviving mutants
1. P45: `sentences[:MAX_ANSWER_SENTENCES + 1]` passes (inputs rarely have 3+ sentences).
2. P41: `len(window) > per_minute` (admits one extra) passes (admit result never inspected; only the HTTP 4th-request test catches the `>` variant).
3. P42: `limit = self.body_limits.get(scope["path"])` (raw path) passes (`body_limits={}`).
4. P40: dropping `[:MAX_CLIENT_KEY_CHARS]` passes (entries too short).
5. P46: removing `.replace("’", "'")` passes (no curly apostrophes in the inputs).

Verdicts: test_round2_props.py OK (P40 OK, P41 WEAK, P42 OK, P45 WEAK, P46 OK); round2.announce.prop STRONG; round2.navigation.prop OK; round2.saved STRONG for behaviour; round2.sources WEAK; hitTest.nan OK; app.hooksOrder WEAK; security.headers OK; saved.focus OK.
