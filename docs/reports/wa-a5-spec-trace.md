# WA-A5 spec trace: task 92 and P188 to P198

Read-only audit, 2026-11-28. I read CLAUDE.md and `.kiro/steering/*.md` first. I changed no file other than this report. I did not run the build, commit, or open any secret.

## Targeted test run

`npx vitest run tests/hostPolicy.prop.test.ts tests/host.i18n.oracle.test.ts tests/host.screen.oracle.test.tsx` (in `frontend/`): 3 files passed, 56 tests passed, 0 failed, 0 `.fails` left in those files.

## Trace: task 92 subtasks

| Subtask | Ticked | Evidence found | Verdict |
|---|---|---|---|
| 92.1 spec text | yes | Requirement 53 at requirements.md:839; P188 to P198 at design.md:1148 to 1159 | ok |
| 92.2 `core/hostPolicy.ts` | yes | imported by the prop test; P197 and P198 test it | ok |
| 92.3 P188 to P191, P197, P198 | yes | `tests/hostPolicy.prop.test.ts`, `numRuns` 250 (P188 to P191), 100 (P197 value checks), 300 (P198); 11 mutants M1 to M11 recorded in the header | ok, see F-03 |
| 92.4 oracles P192 to P196 | yes | `host.i18n.oracle.test.ts` (P192, P193), `host.screen.oracle.test.tsx` (P194, P195, P196) | ok |
| 92.5 H-copy | yes | covered by P192 and P193 passing | ok; hi and gu are machine translated, native review is open (stated in the task) |
| 92.6 H-wire | yes | P194 and P195 pass in the jsdom rig | ok |
| 92.7 review | yes | review items recorded in the task text | ok |
| 92.8 phone-test rows | **open** | `docs/PHONE_TEST.md` line 100 (Step 20) and rows 20.1 to 20.6 (lines 430 to 435) exist | rows are written; the box stays open until the owner records results. That is correct. |
| 92.9 gate | yes | claims tsc 0 errors, 264 files, 3384 tests. I did not rerun the full suite (out of scope). | not verified by me |

Parent 92 is correctly unticked.

## Trace: properties to tests

| P | Test file and describe | Runs | Note |
|---|---|---|---|
| P188 | hostPolicy.prop.test.ts:57 | 250 | matches design (250) |
| P189 | hostPolicy.prop.test.ts:105 | 250 | |
| P190 | hostPolicy.prop.test.ts:141 | 250 | |
| P191 | hostPolicy.prop.test.ts:174 | 250 | |
| P192 | host.i18n.oracle.test.ts:45 | n/a (example) | |
| P193 | host.i18n.oracle.test.ts:63 | n/a (example) | |
| P194 | host.screen.oracle.test.tsx:74 and :151 | example | covers Start, first tap, Capture line, Explore entry only; the design row says "each screen in turn" |
| P195 | host.screen.oracle.test.tsx:105 | example per reason | |
| P196 | host.screen.oracle.test.tsx:192 | example | stylesheet text only, no layout measurement |
| P197 | hostPolicy.prop.test.ts:245 | 100 | matches design (100) |
| P198 | hostPolicy.prop.test.ts:267 | 300 | |

Every P in the range has a real, passing test. None is missing.

## Findings

| ID | Sev | file:line | Problem | Suggested fix | Owner |
|---|---|---|---|---|---|
| F-01 | Low | .kiro/specs/ghost-touch/design.md:1153 to 1157 | P192 to P196 rows still say "`it.fails` until lane H-copy" and "until lane H-wire". Tasks 92.4 to 92.6 and the tests show the `.fails` are gone. The spec contradicts the code. | Remove the "`it.fails` until lane ..." text from the five rows. | Kiro (`.kiro/specs`) |
| F-02 | Low | .kiro/specs/ghost-touch/design.md:1155 vs host.screen.oracle.test.tsx:7 | P194 states "opening each screen in turn". The test header and task 92.6 say it covers Start, the first tap, the Capture line and Explore entry only. Scope in the spec is wider than the test. | Narrow the P194 wording to the screens covered, or add the missing screens. | Kiro |
| F-03 | Low | .kiro/specs/ghost-touch/design.md:1157 | P196 says it checks "computed `min-height` and `min-width` of at least 48". jsdom cannot compute layout. The test (line 195) reads stylesheet text and checks for no fixed height; it does not check a 48 px computed value. | State "stylesheet text check" in the P196 row. Real measurement belongs to the phone-test rows. | Kiro |
| F-04 | Low | tasks.md:778, 779 vs requirements.md:864 | Tasks cite "53.14b" and "53.14c", but requirements.md has one item 53.14 with sub-points (a) onward. The letter citations are looser than the spec's own numbering. | Cite "53.14 (b)" and "53.14 (c)", or split the items. | Kiro |
| F-05 | Low | host.i18n.oracle.test.ts:2 to 3 | Header comment says "was `it.fails` until lane H-copy ... the lane removes `.fails`". It is stale and reads as if the work is pending. | Reword to past tense. | Kiro (test file) |

## Open checkboxes in tasks.md

47 open lines in total. The ones under task 92 are only 92.8 and the parent 92. The rest are outside this audit's task; they are mostly owner phone tests (10, 16, 22.x, 58b.4, 59b.4, 84.7), later agy lanes (56.1, 58b, 59b, 61b, 67.4, 69b, 70b, 71b, 72b, 81, 84.3 to 84.6, 85b, 86b, 89b), and review follow-ups (20.x, 21.x). Examples with a known test gap: 58b.3 says `stickyWiring.test.ts` tests `processPointerMove` only and has no guard-deletion mutant. That matches what is recorded; I did not re-check it.

## Areas that are good

- P188 to P198 each map to a real test with run counts that match design.md.
- The mutation list in `hostPolicy.prop.test.ts` is specific (11 named mutants).
- Parent 92 stays unticked while 92.8 is open, as the task text requires.
- Step 20 rows exist in PHONE_TEST.md for the TalkBack overlap and TTS reading checks.

## Not verified

- Full gate numbers in 92.9.
- Whether the mutants were re-killed; I read the claims, I did not rerun mutations.
- hi and gu string quality.
