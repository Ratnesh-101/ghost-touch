# Kiro review of lane hi10 (commit b100c74): Planchette flow glue, walk commands, walk.* strings

**Verdict: ship.** No real bug found in the lane's code. The Requirement 45.6 whole-phrase rule holds, the walk.* keys are complete in en, hi and gu with matching placeholders, and one mutation proved the tests can fail. Two low items and one medium item below belong to follow-up work. The medium item is outside this commit.

Scope reviewed: `frontend/src/flow/walk.ts`, `frontend/src/flow/commands.ts` (`walk_start`, `walk_next`), `frontend/src/i18n/index.ts` (35 `walk.*` keys per language), `frontend/tests/walk.flow.test.ts`, and the two flipped oracles (`walk.commands.table.test.ts`, `explore.walk.oracle.test.tsx` W7). Checked against CLAUDE.md, tech.md, Requirements 45.6 and 51, and the Planchette and Ghost Hand spec briefs.

## Findings

| Severity | File:line | Problem | Fix |
|---|---|---|---|
| Medium (not hi10; Explore wiring, later commit) | `frontend/src/screens/Explore.tsx` 1127-1138 | Input "next step" with no walk active, or "walk me through" when `walk === null` (Raw Mode, or no template), hits a bare `return` with no speech. Before hi10 "next step" was `unknown` and went to Ask, so it is now swallowed silently. This breaks "never silent failure" and "spoken state changes". | Speak a short line ("There is no walk running" / "No walk is available for this diagram") through `t()` in en/hi/gu. Or return from the branch only when a walk exists, and let `unknown` handling run otherwise. |
| Low | `frontend/src/i18n/index.ts` (`walk.start`, `walk.next`, hi and gu) | Exactly one phrase per command in hi and gu. Common recogniser outputs fall through to Ask: `मुझे समझाइए`, `मुझे समझाओ`, `आगे बढ़ो`, `mujhe samjhao`. Other commands carry romanised variants (`agla kona`). The spec only requires "its listed form", so this is not a violation. Adding commas to the same key would be wrong, because `walkPhrases()` splits on commas and the same key is the button label, so the label would read the whole list. | If wanted, add separate keys (for example `walk.start.alt`) that `walkPhrases()` reads, and keep `walk.start` as the label. Each phrase must stay at most 3 words. Get native-speaker review first (already flagged in `docs/user-test/translation-review.md`). |
| Low | `frontend/src/flow/walk.ts` (`walkLineText`, unit branch), `i18n/index.ts` (`walk.pyth.leg`, `walk.longest.side`, `walk.intro`) | Unit words are always plural, so a value of 1 is spoken "1 centimetres" or "1 feet" (en). `walk.intro` says "in {count} steps" even if count is 1. | Accept for now. If a one-step walk or a length of 1 can occur, add singular keys or word the line without a number agreement. |
| Info | `frontend/src/flow/commands.ts:298` | `walkCommandOf` runs before the Guide and stop checks. A phrase equal to a walk phrase therefore always wins over any other command. No collision exists today: `next` stays `next_corner`, and `अगला कदम` is not in `NEXT_CORNER_PHRASES`. | None. |
| Info | `frontend/src/flow/commands.ts:815-820` | `executeExploreCommand` returns `speech: ''` for `walk_start` and `walk_next`. That is safe only because Explore intercepts both before calling it. Any other caller would say nothing. | None now. Keep the interception when Explore changes. |
| Info | `frontend/tests/walk.flow.test.ts` | No assertion for bare `अगला` or `આગળ` in hi/gu, or a long hi/gu sentence containing the walk phrase. The English cases and the mutation cover the rule itself. | Optional extra cases. |

## Checks against the brief

- **Requirement 45.6 whole phrase:** a transcript matches only when the normalised text equals a listed phrase of at most 3 words. Inputs I ran, with the result:
  - `can you walk me through this` (6 words): `unknown`.
  - `walk me through this`, `please walk me through`, `walk me through please`, `walk me through the triangle`: `unknown`.
  - `next` stays `next_corner`.
  - `walk`, `step`, `walk me`, `me through`, `next step please`, `the next step`: `unknown`.
  - `Walk me through.` and `  WALK   ME  THROUGH! `: `walk_start`.
  - `Next step.` and `NEXT  Step!`: `walk_next`.
  - `next, step` also gives `walk_next`, because punctuation is stripped. That is harmless.
- **hi and gu phrase lists:** `मुझे समझाएं` (also with `।`) and `મને સમજાવો` start a walk. `अगला कदम` and `આગળનું પગલું` move it on. The fragments `समझाएं`, `कदम`, `પગલું`, `આગળનું` and `समझाओ` stay `unknown`. `अगला` alone stays `next_corner`. A longer hi sentence containing the phrase is `unknown`. Each language has one phrase only (see the Low finding).
- **Key parity and placeholders:** all 35 `walk.*` keys are present in en, hi and gu (`WALK_KEYS` test passes). Placeholder sets match per key. No hi or gu string equals English. The unit keys cover every code in `WALK_UNITS` (mm, cm, m, km, in, ft).
- **Honest wording:** none of the `walk.*` strings says verified, correct, checked or approved. Right-angle lines say "as the facts say" or "looks like ... in the drawing". `walk.done` ("That is why.") and `walk.turn.right` ("Yes, that is {name}.") state a result of the arithmetic or the student's touch, not a check of the diagram. Acceptable.
- **No new vibration, tone or earcon:** the diff adds none. `walk.stopped` has no earcon. The combined Guide+walk stop gives one spoken line, `guide.stopped`, with the existing `back` earcon, as 51.7 asks.
- **Tuned values:** `tech.md` is untouched, and no haptic constant is touched.
- **Purity and ownership:** `flow/walk.ts` has no React or browser API (it imports i18n only). The commit does not touch `core/**`, `.kiro/**`, `*.prop.test.ts`, `schema.py` or `validate.py`. It flips `it.fails` to `it` in two Kiro-written oracle files. Those are not on the protected list, and the flip is what those oracles announced they were waiting for. Kiro should still acknowledge it.
- **Requirement 25 canvas stability:** the commit has no layout or overlay change (`flow/canvasSize.ts` is not touched).
- **Accessibility:** the commit adds no UI, so there is no 48 px or accessible-name change to review. Requirement 51.7(a) requires the "Walk me through" button to be at least 48 x 48 CSS px and to exist only when `templateWalk` is not null. That is checked in the Explore lane, not here.
- **Secrets and dependencies:** no `.env`, no key, no `package.json` change.

## What I ran

- `npx vitest run tests/walk.flow.test.ts tests/walk.commands.table.test.ts tests/explore.walk.oracle.test.tsx`: 3 files, 30 tests passed.
- `npx vitest run` on `commands.table`, `commands.parse`, `flow.commands`, `guide.ui.commands`, `walk.prop`, `walkAnchor.prop`: 6 files, 132 tests passed.
- `npx vitest run -t "i18n|parity"`: 157 passed, 3096 skipped by filter.
- `npx tsc -p . --noEmit`: errors only in `tests/round2.navigation.prop.test.ts` (`buildDirty`, `"build"`). They come from the later Ghost Hand oracles, not from hi10. No error mentions walk, `flow/commands` or i18n.
- A throwaway probe script in `%TEMP%` (outside the repo) called `parseExploreCommand` with the inputs above in en, hi and gu, with and without `isWalkActive`.
- **Mutation:** in `frontend/src/flow/commands.ts` I replaced `walkCommandOf(transcript, walkPhrases())` with `/walk me through/i.test(transcript) ? 'start' : walkCommandOf(...)`. This is a substring match, which breaks 45.6. Two tests failed:
  - `walk.flow.test.ts > a 6-word sentence containing "walk me through" is NOT a command`
  - `walk.commands.table.test.ts > a sentence that contains the phrase is not a walk command`

  I restored the file from a byte copy. The SHA-256 hash matched the original, and `git status --short` was empty. I could not use `git checkout` for the restore because the tool refused it, so I used the byte copy.
- No source file or test was edited. The only file written is this review.
