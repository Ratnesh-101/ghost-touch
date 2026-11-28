# Task 92, Ghost Host: spec first, then code (evidence)

Written by Kiro on 2026-11-27. Everything below can be checked in the repo. Nothing in this task is committed: `git log -1` shows `3166664` (a dependabot merge) and `git status` lists every file named here as modified or untracked. The commit hashes of this work do not exist yet, so none are given.

## 1. The chain

```
docs/reports/ghost-host-audit.md   (findings GH-01 to GH-12)
        |
.kiro/specs/ghost-touch/requirements.md   Requirement 53 (line 839, 14 criteria)
        |
.kiro/specs/ghost-touch/design.md         "Ghost Host" section (line 1127), P188 to P198
        |
.kiro/specs/ghost-touch/tasks.md          task 92 (line 772), subtasks 92.1 to 92.9
        |
code + tests (section 3)
```

The order is recorded in tasks.md: 92.1 reads "Requirement 53, design section and P188 to P198 written before any code". The task header says "Spec text only in task 92.1" and lists the files that task must not touch (`screens/`, `flow/`, `i18n/`, `hitTest.ts`, `hapticEngine.ts`, `.kiro/agents`, any tuned value).

## 2. Requirement 53 to properties

| Requirement 53 criterion | Property | Where it is tested | Status in the working tree |
|---|---|---|---|
| 53.6, 53.8, 53.11: no joke in protected lines, English-only jokes | P188 | `frontend/tests/hostPolicy.prop.test.ts` | passes |
| 53.6: second failure is plain, no repeated joke | P189 | same file, against an independent reference machine | passes |
| 53.4: error line useful without its joke | P190 | same file | passes |
| 53.7, 53.9: speakable text, banned characters and words | P191 | same file | passes |
| 53.3, 53.11: every shipped host string passes lint in en, hi, gu | P192 | `frontend/tests/host.i18n.oracle.test.ts` | passes (was `it.fails` until lane H-copy) |
| 53.1, 53.2, 53.3: greeting and one next-step line per screen | P193 | same file | passes (was `it.fails`) |
| 53.1, 53.3, 53.10: one utterance per screen opening | P194 | `frontend/tests/host.screen.oracle.test.tsx` | passes (was `it.fails`) |
| 53.5: a typing hint moves focus | P195 | same file | passes (was `it.fails`) |
| 53.10: names, 48 px targets, no fixed height | P196 | same file | passes (was `it.fails`) |
| 53.12: nothing else moves | P197 | `hostPolicy.prop.test.ts` (code half) | passes |
| 53.13: pure and total | P198 | `hostPolicy.prop.test.ts` | passes |

P192 to P196 were written as red oracles (`it.fails`) before the copy and wiring existed, so a missing piece was a visible test result. They were turned green by lanes H-copy and H-wire. P194 covers Start, the first tap and the Capture line only. It does not cover every screen's next-step line. P196 reads the stylesheet text, because jsdom has no layout.

## 3. Task 92 subtasks and the files that implement them

| Subtask (tasks.md) | State | Files |
|---|---|---|
| 92.1 spec before code | `[x]` | `.kiro/specs/ghost-touch/requirements.md`, `design.md`, `tasks.md` |
| 92.2 pure policy helper | `[x]` | `frontend/src/core/hostPolicy.ts` (new, untracked): `mayJoke`, `composeErrorLine`, `nextFlowState`, `lintHostLine`, `INITIAL_HOST_FLOW` |
| 92.3 P188 to P191, P197, P198 | `[x]` | `frontend/tests/hostPolicy.prop.test.ts` (250 to 300 runs; one `numRuns: 100` on P197, fixed constants) |
| 92.4 oracles P192 to P196 | `[x]` | `frontend/tests/host.i18n.oracle.test.ts`, `frontend/tests/host.screen.oracle.test.tsx` |
| 92.5 lane H-copy: strings | `[x]` | `frontend/src/i18n/index.ts` (keys `host.start.greeting`, `host.start.next`, `host.capture.next`, `host.explore.next`, `host.ask.next`, `host.correct.next`, `host.teach.next`, `host.build.next`, `host.saved.next`, `host.settings.next`, `host.raw.next`, plus replaced `ask.*`, `capture.*` values); `docs/user-test/translation-review.csv` and `.md` |
| 92.6 lane H-wire: focus, greeting, Back wording, CSS | `[x]` | `frontend/src/drivers/speech.ts`, `frontend/src/flow/start.ts`, `frontend/src/screens/Start.tsx`, `frontend/src/screens/Explore.tsx`, `frontend/src/styles/explore.css` |
| 92.7 review of H-copy and H-wire against Requirement 53 | `[ ]` open | owner decisions still open: English-only jokes or none (53.14b), greeting under TalkBack (53.14c) |
| 92.8 phone test rows | `[ ]` open | `docs/PHONE_TEST.md` is modified; the rows are for the owner to run, and no result is recorded |
| 92.9 gate, BUILD_LOG, commits | `[ ]` open | gate re-run below; no commits made |

Parent task 92 is not ticked, on purpose.

Existing tests whose English strings changed with the new wording are in the working tree: `flow.capture`, `flow.explore`, `flow.start`, `k8.i18n`, `lab.i18n`, `lang.rerender`, `locale.firstRun`, `n2.round4`, `overview`, `screens.render`, `speech.voice`, `start.lab`, `teach.routing` (all under `frontend/tests/`). The BUILD_LOG entry for the resumed run says they were left as found and that no a11y or behaviour assertion was weakened.

## 4. Mutation checks (recorded in the test file header and BUILD_LOG)

`hostPolicy.prop.test.ts` lists 11 mutants (M1 to M11), each made a property fail and was reverted: no category check, no language check, `failures > 2`, same-joke check removed, joke gap 3 to 2, success not resetting failures, joke before plain, joke returned for empty plain, em dash unbanned, sentence limit 26, sorry count removed. For the screen oracles the BUILD_LOG records three more killed: focus always to the Ask button (4 tests fail), fixed `height: 48px` back in `explore.css` (1 fails), Start `aria-label` set to the greeting (1 fails). These are hand mutations, not a mutation-testing tool run, and this note did not re-run them.

## 5. Real output from this session

Commands run in `frontend/` on 2026-11-27:

```
npx vitest run tests/hostPolicy.prop.test.ts tests/host.i18n.oracle.test.ts tests/host.screen.oracle.test.tsx
 Test Files  3 passed (3)
      Tests  53 passed (53)

npx tsc --noEmit
tsc exit 0

npx vitest run
 Test Files  264 passed (264)
      Tests  3381 passed | 1 todo (3382)
```

`npm run build` was not re-run for this note. The BUILD_LOG entry from the earlier run says it passed; that is the only evidence for it here.

## 6. Hooks and steering that applied

Defined in `.kiro/hooks/`. What I can say is which matchers cover the files this task touched. `docs/kiro-evidence/hooks-check.md` records that no hook firing has been observed, and I have no screenshot or log of one, so none is claimed.

| Hook (file) | Matcher covers | Files of this task it matches |
|---|---|---|
| `run-tests-on-core-save.json` | `frontend/src/core/*.ts`, runs `npm --prefix frontend test` | `core/hostPolicy.ts` |
| `a11y-on-save.json` | `frontend/src/(screens\|components)/*.ts(x)`, runs the contrast, target and motion tests plus `screens.render` | `screens/Start.tsx`, `screens/Explore.tsx` |
| `css-guard-on-save.json` | `frontend/src/styles/*.css`, runs `labTheme.prop` and `css.imports` | `styles/explore.css` |
| `pre-commit-build-log.json` | on commit, asks the agent to check honest attribution in `docs/BUILD_LOG.md` | applies when this work is committed |
| `review-on-stop.json` | session end, review of Kiro-owned files | applies to `core/hostPolicy.ts` and `*.prop.test.ts`. `docs/reviews/session-review-latest.md` ("Session review (2026-11-27, task 92 resumed)") reads like its output, but I cannot show it was produced by the hook |
| `prop-tests-on-save.json` | haptics, pitch, hit test, validator | does not match any file of this task |

Steering: `tech.md` (pure core with no browser APIs, no `any`, named exports, every string through `t()`, the tuned haptic table that P197 pins); `product.md` (principle 2 "never silent failure", principle 5 "Halloween lives in the creature, never the user", which became criterion 53.7 "the creature is the one who trips"); `structure.md` (`core/camelCase.ts`, `*.prop.test.ts`). `review.md` is manual and `verify.md` is file-matched to Spec Ghost files, so neither is cited as having acted here.

## 7. Who did what

- **Kiro:** Requirement 53, the design section, P188 to P198, `core/hostPolicy.ts`, the three test files, the review of the lanes, and (in the resumed run) the lane H-copy and H-wire work that was left unfinished, ticked 92.4 to 92.6.
- **Antigravity (agy):** per the owner, agy started the copy lane (lane H-copy) and stopped when its quota ran out. The repo does not record this: there is no agy report or brief for H-copy or H-wire under `docs/`, and the BUILD_LOG says only "A previous run stopped mid-way." The working tree holds edits that were there before Kiro resumed (the old-flow test files in section 3). I cannot split agy's lines from Kiro's by file, so this note does not give a split.
- **Kiro finished:** by the BUILD_LOG, on resume the full suite was already green, Kiro removed the `it.fails` from P192 and P193, wrote P194 to P196, checked the audit findings against the source, added section 6 to `translation-review.md`, and wired what was missing.
- **Claude Code:** per the owner, reviewed and verified the result. There is no Claude Code entry for task 92 in `docs/BUILD_LOG.md` yet, so this is the owner's statement, not a repo fact.

## 8. Not done, not claimed

- Nothing here has been tried on a phone or with TalkBack. The greeting and TalkBack overlap and how the speech engine reads the new lines are unverified (92.8).
- Hindi and Gujarati are machine-translated and have no native review. Jokes ship in English only.
- No commit exists. No hook run is recorded.
