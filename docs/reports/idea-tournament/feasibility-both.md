# Feasibility: Planchette (B) and Ghost Hand (C), both
Checked in the repo at `8128f5d` on 2026-11-22. Nothing was run, built or tried on a phone. Only cited lines were verified.

## Verdict: YES, in this order
Both fit as code. They touch different files except `i18n/index.ts` and Kiro's three spec files. There is one design conflict: a walk on a student's own draft. It is fixed in pure core, so Explore still needs no prop. Order: Kiro B, then Kiro C (C owns the draft guard). Then agy lanes in parallel: B's single Explore lane in the EX queue, C's lanes outside it.

## Numbering (verified, re-check before writing)
- Highest requirement is 50 (`requirements.md:731`). The highest property is P158 (`design.md:942`), and there is no P159 or higher. Tasks 82 and 83 do not exist: 81 is followed by 84 (`tasks.md:660,668`). Do not fill that gap.
- Reserve these numbers: **B = Requirement 51, task 85, P159-P170. C = Requirement 52, task 86, P171 onward.** Kiro runs 85 and 86 one after the other, because both append to `requirements.md`, `design.md` and `tasks.md`.

## Build order and lanes
| # | Who | Lane | Files | Waits for |
|---|---|---|---|---|
| 1 | Kiro | **T85 Planchette spec + core**: Req 51; amend **Req 37.2** to name "a walk step" (`requirements.md:556`); add "walk me through" and "next step" rows to the Req 45 table; `core/walk.ts` (templates: Pythagoras, bar difference from `bars[].value`, longest side; reducer emits only `speak` and `guideTo`); `core/walkAnchor.ts` (sine walk only if reachability passes); Explore oracles as `it.fails` | core, tests, spec | nothing |
| 2 | Kiro | **T86 Ghost Hand spec + core**: Req 52; `core/pegboard.ts` (grid 0-6 x 0-8, snap, pin, stitchInOrder via `addSegment`, describeWork, grid fact line); properties; **guard: `templateWalk` returns null on a scene that carries the grid fact line** | core, tests, spec | T85 |
| 3 | agy | B-flow: `flow/walk.ts`, phrases in `flow/commands.ts`, i18n en/hi/gu, translation-review rows | flow, i18n | T85 |
| 4 | agy | **B-EX (serialized)**: feed the post-sticky target of the 6 `processPointerMove` sites to `walkStep` (`Explore.tsx:1861-2288`, same pattern as `applyHighlight`, 6 calls); extend the lift guard `isAskAnswerSpeaking` (`:554`, used at `:2347`, `:2350`) to walk steps; "Walk me through" button in the Ask form (`:2596`), shown only when a walk exists | Explore.tsx only | B-flow; **task 84.6** (open, also edits Explore.tsx and the footer CSS) |
| 5 | agy | C-screen: `flow/build.ts`, `screens/Build.tsx` (sliders, Pin, list, Undo, Stitch, Feel), CSS | new files | T86 |
| 6 | agy | C-wire: `'build'` in `SCREEN_NAMES` + `leaveByBack` (`flow/navigation.ts:187-249`), route in `App.tsx`, Capture button, i18n en/hi/gu | App, nav, Capture, i18n | C-screen; i18n after B-flow |
| 7 | agy | C-hand-in: share link + text list of points (existing codec, `flow/share.ts`); image export stays stretch | flow/share, Build | C-wire |
| 8 | agy | e2e: one spec per feature (below) | `frontend/e2e/` | 4 and 7 |

**Effort:** B = 1 Kiro task + 3 agy lanes (1 of them in Explore). C = 1 Kiro task + 3 agy lanes (0 in Explore). e2e = 1 lane, or 2 if split. **Total: 2 Kiro + 7 agy lanes.** Expect at least 1 fix pass per Explore lane, as with tasks 81 and 84.

## Conflicts and how to avoid them
1. **Walk on a student's draft (real).** A longest-side or slope walk would answer the plotting homework (judge-2 condition 2). Fix in core: T86 adds a property that `templateWalk(draft) === null`. B-EX shows the button only when a walk exists, so Explore mounted on a draft shows nothing. There is no new Explore prop, so C keeps its "zero Explore edits" rule.
2. **`i18n/index.ts`** is one 1,774-line file with `en`, `hi` and `gu` tables (`:570`, `:1097`, `:1625`; `tables` at `:1634`). Two lanes adding keys conflict. Merge B-flow first, then rebase C-wire. Use key prefixes `walk.*` and `build.*`.
3. **`App.tsx`:** only C touches it. Today Explore mounts only in `case 'explore'` (`App.tsx:772-782`). If Feel switches App to `'explore'`, Back goes to Capture (`navigation.ts:242-245`) and the draft is lost. So Build must mount Explore itself (`ExploreProps` `:255-268`: scene, announced, drivers, onBack), and `'build'` must handle back.
4. **Voice "stop" already exists:** it is Guide's command, with `stopGuide` and the `back` earcon (`commands.ts:301-332`, `:697-707`). The walk must reuse that one command (stop ends both) and add no new earcon (Req 39). "next" alone already matches next_corner under Req 45 clause 1.2, so the walk phrase must be "next step".
5. **Req 37:** the amendment comes before any code. The single code point is `isAskAnswerSpeaking`, not a new guard.
6. **Hit-testing anchors:** `hitTest` returns only vertex, line, axis or bar ids. On a draft, a pin on the axis is a vertex, which takes priority (tech.md hit radii), so C needs no change. The sine anchor needs `walkAnchor` (final1-B §2) or it is dropped.
7. **Tuned values:** neither feature adds a vibrate, tone or earcon. B's property is "reducer never emits vibrate/tone". C uses only the engine's existing cues.
8. **`core/correct.ts`:** `addPoint` does not refuse an occupied spot. It nudges the point by `NUDGE_STEP = 0.04` (`correct.ts:239`, `freeSpot` `:263`). An occupied crossing would therefore give an off-grid pin. `pegboard.pin` must refuse before it calls `addPoint` (property: every pin is on a crossing). Ids A-Z, then P1... (`:226-234`). Both features only call `correct.ts`; neither edits it.
9. **`share/validate.ts:501-509`** rejects a scene with no points, segments, polylines or bars. Axes do not count. So Feel and hand-in must stay disabled until there is 1 pin. Facts survive the codec (`validate.ts:467-468`, max 50 facts, `limits.ts`).
10. **`flow/explore.ts`:** neither feature needs to edit it. B reuses `lineName` (`:864`) and the sticky target. C relies on the segment line-name with ends (`:887-907`).

## Acceptance tests
**Planchette:** (a) Kiro: P159+ pass at 200 runs or more (anchors exist, a step is spoken only after its anchor hit, stop gives idle, no vibrate or tone, exact 3-4-5 and 5-12-13 calcs, null when a fact is missing, no self-premise, null on a Raw scene and on a draft). (b) vitest: Explore oracles flip green; Req 45 table: "walk me through" starts a walk, a sentence of more than 3 words containing it does not. (c) Playwright, CDP touch as in `explore.help-highlight.spec.ts`, on the bar sample: Walk me through, touch Q4, step 1 is spoken, next step, touch Q1, step 2, then "22"; a wrong bar does not advance; a lift does not cut step speech; the layout specs still pass. (d) Owner phone row.
**Ghost Hand:** (a) Kiro: snap is idempotent; no two pins on one crossing; a pin is always on a crossing; stitchInOrder makes no polylines and joins neighbours in x order; drafts pass `isRenderableScene` and a share round trip; `parseFacts` ignores the grid line. (b) Playwright (built with `VITE_FEATURE_SHARE=1`, `playwright.config.ts:43`): sliders change with the keyboard and are spoken via `aria-valuetext`, Pin, Undo, Stitch, then Feel opens the Explore canvas, a touch on a pin speaks its label, Back returns to the form with the pins kept, and the hand-in link decodes to the same scene. (c) PHONE_TEST rows: sliders under TalkBack, Feel, hand-in.

## Risks
- **The 48 px cell rule cannot hold for the fixed 0-8 grid on common phones.** `scale = min(canvasWidth, canvasHeight)` (`geometry.ts:68`). That gives at most 360/8 = 45 px at 360 px width, less on the 360x640 e2e viewport. Kiro must either restate the rule as spacing of at least 44 px (twice the 22 px vertex radius, so pin discs never overlap) or shrink the grid. Owner decision.
- **Explore lane failure pattern:** `Explore.tsx` is 2,686 lines with 20 `isGuiding()` sites. B-EX is the riskiest lane and must wait for 84.6.
- **Share flag on the live build:** not verified (owner decisions `:149`).
- **Honesty:** nothing above has been tested on a phone or with TalkBack. Hindi and Gujarati are machine-translated until reviewed.
- **Calendar:** the owner said there is no limit, but the repo's own freeze is Nov 30 (owner decisions `:152`). Building both before Dec 5 conflicts with that plan.
