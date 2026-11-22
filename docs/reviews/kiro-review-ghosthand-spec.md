# Kiro review and lane briefs: Ghost Hand (task 86, Requirement 52)

Written by Kiro on 2026-11-22. Spec: `requirements.md` 52, `design.md` "Ghost Hand", properties P171 to P182, `tasks.md` 86. Source: `docs/reports/idea-tournament/` (final2-C cut scope, judge-final conditions 1 to 7, feasibility-both). Nothing here has been tried on a phone or with TalkBack. Hindi and Gujarati wording does not exist yet.

Numbers were re-checked after task 85: Requirement 52, task 86 and P171 on were free (highest were 51, 85 and P170).

## 1. Owner decisions to confirm

| # | Decision | What Kiro did | Why it needs you |
|---|---|---|---|
| OD-A | **The 48 px cell rule is replaced by "pin positions at least 44 px apart"** (twice the 22 px vertex radius). Your standing decision for this build; written as Requirement 52.12. | `pinSpacingPx(scale) = scale / 8`, `pinSpacingOk` true from scale 352. P179 checks it against a brute-force minimum built from `geometry.ts`. | The rule holds only when the Explore canvas's short side is at least 352 CSS px. On a 360 px phone the canvas is narrower than the screen (padding), so it can fall under 352, and then adjacent rows are closer than 44 px (at 320 px: 40 px). The grid is fixed, so Feel cannot refine it. Requirement 52.12 makes the Build screen speak one short notice (`build.feelSmall`) and still open Feel. If you prefer to refuse Feel, or to make the Feel canvas at least 352 px by scrolling, say so. |
| OD-B | **Ask stays on in Feel.** Explore is unchanged, so a student can ask "Is it a straight line?" and `semantic.py` can answer about her own plot. | Nothing; Requirement 52.18(a) records it. | Hiding Ask needs one optional prop on `Explore` (for example `hideAsk`), a small exception to "zero Explore edits" that I did not take. Planchette already refuses a walk on a draft (the `Grid:` guard), so only Ask leaks. |
| OD-C | **The draft is `kind: 'geometry'`**, with axes on the unit-square border. | `emptyDraft()`. Geometry gives an overview that counts labelled points; `function_graph` would have said "0 curves". | Axes on the border mean a pin at gx = 0 or gy = 0 is at the page edge (a vertex beats an axis, so it is still found as a corner). A margin would shrink the scale and make OD-A worse. |
| OD-D | **A pin is labelled `x 2 y 5`, not "(2, 5)" or "2, 5".** | `pinLabel`. No bracket (TTS may read it), no comma (it makes "to x 0 y 1, up-right to x 1 y 3" ambiguous). | The tournament judge preferred "2, 5". Whether Android TTS reads `x 2 y 5` well in Hindi and Gujarati is for the phone test. |
| OD-E | **No autosave.** Leaving Build with pins asks for confirmation; the draft is not kept in Saved diagrams. | Requirement 52.9 and 52.18(c). | I-28 (a palm exit) loses the draft if she confirms by accident. |
| OD-F | **Share on the live build** needs `VITE_FEATURE_SHARE=1` on Vercel. | Not checked (cannot be from the repo). | Judge-final risk 1: the hand-in depends on it. Open one share link on the phone first. |

## 2. What Kiro did, and did not do

Done (path-scoped commits, nothing pushed): `8c66cf1` spec (Requirement 52, design, task 86); `a5b0cb5` `core/pegboard.ts` and P171 to P180; `edbfea4` the Build oracles; `a6df5d1` a fix found by P180.

Not done, on purpose:

- No file under `screens/`, `flow/`, `App.tsx`, `i18n/`, `hitTest.ts`, `hapticEngine.ts` or any tuned value was touched. No new vibration, tone or earcon, no backend call.
- Not in scope, as you said: second-finger tap, voice "pin", spoken grid ranges, image export. The "up 2, right 1" readout is only a later clause (52.17): off by default, the hand-in says whether it was on, and it needs the teacher-worksheet control first because it would answer "is it a straight line?" for the student.
- The tails of the `it.fails` screen oracles have never run against a real `Build`. They share the rig and coordinates of the two passing controls (a touch on a pin speaks `x 3 y 4`; a touch on a stitched side buzzes `vibrate(80)`), but the first lane run may find an oracle that is wrong. If so, fix the oracle and say so; do not weaken a property.
- Playwright was not run and no e2e exists for Build yet.

Real defect found by a property in Kiro's own first draft: P180 (seed -1963959690) showed that `pin` threw on a scene whose `points` list held `null` or a number, because `addPoint` reads every element's id. `pin` and `stitchInOrder` now refuse such a scene (`badInput`, same object). Pinned as an example. It showed up only in full-suite runs: of three full runs, two had exactly one failing test. I captured the name only on the third (P180, above); the failing test of the first run was not captured, so I cannot say it was the same one. After the fix the suite passed, and the file also passed at `FC_RUNS_MULT=20`.

### Mutants run (task 86)

19 mutants of `core/pegboard.ts`, 18 killed, 1 equivalent (source restored byte for byte after each):

y not inverted (`gridToNorm`); `Math.floor` for `Math.round`; x clamp off by one; occupied test only on x; occupied test removed (so `addPoint` nudges); label with a comma; stale segments kept; no `gy` tie-break; stitch never returns the same object; spacing divided by 6; minimum 48; grid fact parsed as a length (`AB = 5 cm`); grid fact without the `Grid:` prefix (the walk control fails); `canFeel` accepts 0 pins; axes swapped; occupied returns a copy; `snapNorm` y not inverted; "stitched" line always listed. The survivor: dropping `next === scene` from the `badInput` check after `addPoint`. It is equivalent: with the occupied test in front, `addPoint` cannot return the same scene for finite input.

## 3. Exports (`frontend/src/core/pegboard.ts`)

`GRID_MAX_X` 6, `GRID_MAX_Y` 8, `GRID_FACT`, `MIN_PIN_SPACING_PX` 44, `Crossing`, `PinEntry`, `PinResult`, `WorkLine`, `WorkSummary`, `BUILD_WORK_KEYS`, `snapCrossing`, `snapNorm`, `gridToNorm`, `pinLabel`, `emptyDraft`, `isDraft`, `pinsOf`, `pin`, `stitchInOrder`, `canFeel`, `canHandIn`, `describeWork`, `handInList`, `pinSpacingPx`, `pinSpacingOk`.

Behaviour the lanes rely on:

- `pin(scene, gx, gy)` returns `{ kind: 'pinned', scene, id, label, crossing }`, `{ kind: 'occupied', scene, id }` (id of the point already there) or `{ kind: 'badInput', scene }`. Refusals return the same scene object, so `historyReducer` adds no entry.
- `stitchInOrder(scene)` rebuilds all segments as the neighbour chain (x, then gy, then id). It returns the same object when nothing changes. Apply it as ONE `apply`.
- `pinsOf` and `handInList` are in stitch order and contain only points that sit on a crossing.
- `describeWork(scene)` returns `{ pinCount, segmentCount, pins, lines }` where `lines` are `{ key, params }` for `build.work.*`.

## 4. i18n keys (`frontend/tests/support/buildKeys.ts`, prefix `build.`)

The test list is the contract. Suggested English; the lane may reword, the meaning and placeholders stay. Hindi and Gujarati must differ from English, keep the same `{placeholders}`, and be listed in `docs/user-test/translation-review.csv` and `.md`.

| Key | Placeholders | Suggested English |
|---|---|---|
| `build.open` | | Make my own graph |
| `build.title` | | Plot a graph |
| `build.prompt` | | Empty graph. x goes from 0 to 6 and y from 0 to 8. Set x and y, then press Pin. |
| `build.xName`, `build.yName` | | x position, y position |
| `build.pin`, `build.undo`, `build.stitch`, `build.feel`, `build.handIn` | | Pin, Undo, Stitch in order, Feel, Hand in |
| `build.pinned` | id, label | Added point {id} at {label}. |
| `build.occupied` | id, label | There is already a point at {label}. It is {id}. |
| `build.badInput` | | That position is not on the grid. |
| `build.undoPin` | id | Undone. Point {id} removed. |
| `build.undoStitch`, `build.undoNothing` | | Undone. The joins are removed. / Nothing to undo. |
| `build.stitched` | count | Joined {count} pairs of points, left to right. |
| `build.stitchNone` | | Add at least two points to join them. |
| `build.needPin` | | Add a point first. |
| `build.feelSmall` | | Points are close together on this screen. |
| `build.backToForm` | | Back to the graph form. Your points are kept. |
| `build.leaveConfirm` | | Leave without handing in? Your points will be lost. |
| `build.work.empty` | | No points yet. |
| `build.work.count` | count | {count} points. |
| `build.work.pin` | id, label (and numbers x, y) | Point {id}, {label}. |
| `build.work.stitched` | count | {count} joins. |
| `build.handin.title` | | Hand in |
| `build.handin.madeBy` | name | Made by {name}. Not checked. |
| `build.handin.notChecked` | | Not checked. |
| `build.handin.copy`, `build.handin.copied` | | Copy link and list / Copied. |

Rules (P181): none contains "verified", "correct" or "approved"; "checked" appears only in `build.handin.madeBy` and `build.handin.notChecked`, as "not checked" (hi: जाँचा नहीं गया, gu: ચકાસાયેલ નથી). The slider value text is `x 3` and `y 5`, built like the label, not a key. The hand-in list line is `{id}: {label}` (for example `A: x 2 y 5`), also not a key.

## 5. Lane briefs

Order (feasibility-both): C-screen first (new files, no conflicts), then C-wire (i18n after the walk strings of lane 85b are merged, to avoid a conflict in `i18n/index.ts`), then C-hand-in. None edits `Explore.tsx`, `hitTest.ts`, `hapticEngine.ts` or a tuned value. Each removes the `.fails` of the oracles it makes pass and changes nothing else in the test files.

### C-screen: `flow/build.ts`, `screens/Build.tsx`, CSS
- `flow/build.ts` (pure, no React): the draft's `HistoryState` (`createHistory(emptyDraft())`), the slider values, one function per press (`pressPin`, `pressStitch`, `pressUndo`) returning the new history and the key and params to speak. Pin: `pin()` then `applyEdit` only for `pinned`. Stitch: `stitchInOrder()` as ONE `apply`; speak `build.stitchNone` for fewer than 2 pins. Undo: speak `build.undoPin` with the removed id (`describeUndo` from `flow/ghostwriter.ts` already finds the added point), `build.undoStitch` for a stitch, `build.undoNothing` when empty.
- `Build` exports `{ drivers, onBack }` props. Root `data-testid="build-root"` with `data-pins`, `data-segments`, `data-mode` (`form` | `feel`).
- Form: two `input[type="range"]` (min 0, max 6 and 0, 8, step 1), each with an accessible name (`build.xName`, `build.yName`), `aria-valuetext` `x 3` / `y 5` (built from the number, no key), at least 48 px tall. Buttons Pin, Undo, Stitch in order, Feel, Hand in, each at least 48 x 48 and named by `t()`. Feel and Hand in are `disabled` (or `aria-disabled`) while `canFeel` is false; pressed anyway they speak `build.needPin`.
- Speak every outcome with `drivers.speech.speak`. Never call `vibrate`, `setTone` or `playEarcon` in the form (B6).
- Feel: mount the unchanged `Explore` with `scene`, `announced` (the `build.work.*` summary joined with `joinAnnouncements`), `drivers`, `onBack` (which sets `data-mode` back to `form`, keeps the history and speaks `build.backToForm`). Do not pass `onCorrect`. When the Feel canvas scale is under 352 (`pinSpacingOk` false), speak `build.feelSmall` once and open Feel anyway (52.12).
- Spec Ghost and the walk need nothing: the `Grid:` fact keeps both silent.

### C-wire: navigation, route, Capture, i18n
- `flow/navigation.ts`: `'build'` in `SCREEN_NAMES`; `BackContext` gains optional `buildDirty`, `buildFeel`; `leaveByBack('build', ctx)` as Requirement 52.9 (`buildFeel` stays on `build` with `build.backToForm`, no confirmation; otherwise `capture` with `capture.prompt`, confirming only when `buildDirty`). `needsConfirm` formula in 52.9. Extend the existing P43 test to the three flags; `build.navigation.oracle.test.ts` (P182) loses its `.fails`.
- `App.tsx`: a `build` case that mounts `Build` and passes `buildDirty` (pins at least 1) and `buildFeel` to the Back handler, including the browser and Android Back paths. Feel is NOT an App screen: Build mounts Explore itself, so Back never reaches Capture and the draft is not lost (feasibility conflict 3).
- `Capture.tsx`: a "Make my own graph" button (`build.open`, at least 48 x 48).
- `i18n/index.ts`: every key of section 4 in `en`, `hi`, `gu`; the translation sheets. `build.i18n.oracle.test.ts` (P181) loses its `.fails`.

### C-hand-in: share link and point list
- Hand in builds `encodeShare({ v: 1, scene, verifiedBy: <name or ''>, note: '', verifiedAt })` and `shareUrl(origin, encoded)`; shows the link as an `<a data-testid="build-handin-link">` and the list in a read-only `data-testid="build-handin-text"` with one `{id}: {label}` line per entry of `handInList(scene)`, headed by `build.handin.madeBy` (or `build.handin.notChecked` with no name). Offer copy through the existing clipboard driver and speak `build.handin.copied`.
- Disabled until `canHandIn`. A draft with at least 1 pin always passes `validateShareScene` (P175), so `encodeShare` cannot reject it; if it throws anyway, speak the existing share error, never "verified".
- Opening the link stays gated by `VITE_FEATURE_SHARE` and the Settings switch (unchanged). Image export is not part of this lane.

## 6. Tests

| File | What | Today |
|---|---|---|
| `tests/pegboard.prop.test.ts` | P171 to P180, 26 tests, 200 to 300 runs each (also green at `FC_RUNS_MULT=20`) | passes |
| `tests/build.screen.oracle.test.tsx` | 2 controls pass; B1 to B7 `it.fails` | 2 pass, 7 expected fail |
| `tests/build.i18n.oracle.test.ts` | control passes; P181 `it.fails` | 1 pass, 1 expected fail |
| `tests/build.navigation.oracle.test.ts` | formula control over all current screens passes (and holds for `build` once added); 2 `it.fails` | 1 pass, 2 expected fail |

Gate: `tsc --noEmit` 0 errors; `vitest run --maxWorkers=4`: 251 files, 3193 passed, 22 expected fail, 1 todo.

## 7. Not verified

Phone, TalkBack (sliders under TalkBack are a platform pattern, not evidence in this app), Hindi and Gujarati wording and TTS reading of `x 2 y 5`, Playwright, the live `VITE_FEATURE_SHARE` value, the real size of the Feel canvas on a 360 px phone (OD-A). The 44 px and 352 px numbers are proposals; `tech.md` has no row for them because they are not haptic values.
