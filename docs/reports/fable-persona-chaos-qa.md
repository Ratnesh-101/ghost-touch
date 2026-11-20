# Chaos QA: the gremlin's report on Explore feature interactions

Persona: QA gremlin, paid per bug. Tool: Claude Code (review only). Date: 2026-11-17.
Repo state read: `main` at `a82f7bf` (all lanes merged, Kiro T66 in).

**How this was made.** I read the code; I ran nothing (no test suite, no browser, no phone:
the machine is memory-starved and the brief forbade it). Every item below is a paper repro from
the current files. Line numbers are from `a82f7bf`. Items marked **[confirm on phone]** depend on
how Android Chrome really behaves, which reading cannot settle.

Files read in full: `frontend/src/screens/Explore.tsx`, `frontend/src/flow/explore.ts`,
`frontend/src/core/{hapticEngine,heartbeat,proximity,sticky}.ts`,
`frontend/src/drivers/{storage,haptics,index}.ts`. Read in part: `flow/commands.ts`,
`drivers/audio.ts`, `drivers/speech.ts`, `flow/guide.ts`, the two e2e specs, and a sample of
tests. Not read: `core/compass.ts`, `core/curve.ts`, `core/sceneGuard.ts`, `core/hitTest.ts`
beyond the bar-edge lines, most of the 140 test files. Gaps in those are not covered here.

Verdict in one line: **fix B1, B2, B3 and B4 before the phone test video; the rest can wait.**
None of the four is in `docs/reviews/kiro-review-*.md` or `fable-hardening-plan.md` (grep for
the key identifiers found nothing).

---

## 1. Ranked bug list

Format: `severity · file:line · problem · fix`. Then the repro reasoning.

### B1 · HIGH · Explore.tsx:1928 + flow/explore.ts:770 · keep-alive never restarts inside a hold

`handlePointerMove` calls `keepAliveTimer.update(coords, now)`. `update` only stores the
coordinates; it does not start a stopped timer. The timer is stopped by Guide start
(Explore.tsx:572, 732, 1671, 1845), by Ask (630, 1862), and by `shouldRun()` returning false
once (flow/explore.ts:757-759 calls `stop()`, permanently). It is started only on pointerdown
(1806) and on pointer promotion (2048).

Repro: Guide is on. Ask "take me to B". Touch the canvas (pointerdown while guiding returns at
1676 with the timer stopped). Follow the guide tone to B. Guide arrives; `isGuiding()` becomes
false; the finger is still down, as it must be at an arrival. Hold still on B.

- Expected: everything a hold normally gets. Line buzz while still on a line, corner heartbeat
  (if ON), line-name dwell, where-am-I dwell, bar rest speech, near-line clicks.
- Actual: none of them. All six features are driven by keep-alive ticks, and there are none
  until the finger lifts and touches again. A still finger on a line goes dead after one 80 ms
  buzz. Heartbeat ON gives zero beats after every guide arrival.

Same result after a two-finger long-press Ask if a finger stays down, and after any single
`shouldRun() === false` tick.

Fix: in `update`, restart the interval when `timer === null`, or have the screen call `start`
when a normal move arrives and `isActive()` is false.

### B2 · HIGH · Explore.tsx:1670-1677 · stale axis side after Guide speaks a false "y-axis"

Pointerdown while guiding returns before `seedAxisState` (1706). `axisState` is not reset on
lift either (see 2050-2066). So after a guide, the tracker still holds the side from the hold
before it.

Repro: sine sample. Hold on the left of the y-axis, lift. Start a guide to a peak on the right.
Arrive. First normal move after arrival: `checkAxisCrossing` sees `lastXSide === 'left'`, finger
on the right, and speaks "y-axis", merged in front of the corner label.

- Expected: no axis announcement; the finger did not cross anything in this hold.
- Actual: a false crossing, spoken at the moment the user most needs a clean arrival.

Fix: seed axis state (and reset page-edge state) in the guiding branch of pointerdown, or on the
first non-guide move after a guide ends.

### B3 · HIGH · flow/explore.ts:1251-1258, Explore.tsx:1398-1408 · Short detail cuts corner labels at the first full stop

In Short mode `paceSpeech` returns `extractCornerLabel(text)`, which keeps everything before the
first `.`, `!`, `?` or danda.

Repro: Speech detail = Short. A function graph with a point labelled `(2.5, 3)`, or a geometry
point labelled `3.5 cm`. Touch it.

- Expected: "(2.5, 3)".
- Actual: "(2". Any label with a decimal point is cut. Graph points with coordinate labels are
  the normal case, not an edge case.

Sibling: `extractBarLabel` (1242) cuts at the first comma, so bar "Q1, 2024" is spoken as "Q1"
when it follows another bar within 700 ms.

Fix: the engine already hands over the bare label for a corner; in Short mode speak it unchanged
and only drop the compass text (which Explore.tsx:1412 already does). For bars, pass label and
value separately instead of re-parsing the joined string.

### B4 · HIGH · Explore.tsx:1592-1606, 1354-1360 · Short detail: bar value needs zero pointer events for 500 ms

In Short mode a bar entered within 700 ms of another speaks the label only; the full
"label, value" waits for `checkBarRest`, which needs `t - lastMoveTime >= 500`. Every real
`pointermove` on a bar calls `updateBarMove` (1356) and pushes `lastMoveTime` forward. There is
no movement threshold.

- Expected: resting a finger on the bar speaks the value after half a second.
- Actual: any pointermove, however small, resets the clock. **[confirm on phone]** A resting
  fingertip on a touchscreen usually keeps emitting 1 px moves; if it does on the Nord CE6, the
  value is never spoken in Short mode during a sweep-then-rest.

Fix: only count a move as movement beyond a few px from an anchor, as `checkLineDwell` does with
`WHERE_AM_I_REST_MAX_MOVE_PX`.

### B5 · HIGH · core/sticky.ts:74-90 · Stay on line ON makes narrow bar interiors unreachable

`followTarget` keeps a held line when `hitTest` reports a bar interior and the finger is within
24 px of that line. Bar edges are lines (hitTest.ts:255-258). The sample `barchart.json` has bars
0.15 wide. At 360x640 the canvas is 237 px high (the figure recorded in
`e2e/explore.actions-layout.spec.ts:527`), so scale is 237 and a bar is about 35 px wide.

Repro: Stay on line ON, 360x640, bar sample. Slide slowly into a bar across its left edge (more
than 200 ms inside the 14 px edge band).

- Expected: inside the bar, hear "Mon, 5" and the value tone.
- Actual: every interior point is within 17.8 px of a vertical edge, which is under the 24 px
  sticky radius, so the target stays `bar-edge`. The bar's value is never spoken and its tone
  never plays until the finger leaves the bar altogether.

Related, with the switch OFF: the two 14 px edge bands leave an interior strip only about 7 px
wide on that screen. Bar values are hard to reach on compact phones regardless.

Fix: do not stick when `base.kind === 'bar'`, or never stick to `bar-edge`.

### B6 · MEDIUM · Explore.tsx:1608-1630, 1930-1951 · where-am-I dwell is consumed without speaking

`checkWhereAmIDwell` returns `shouldSpeak: true` and sets `spoken: true, armed: false`. The
screen then refuses to speak if `isSpeechSpeaking()`. The quiet guard is 1500 ms from speech
*start*, so any utterance longer than 1.5 s defeats it.

Repro: Directions ON. Enter Explore (overview is spoken, several seconds). Rest a finger in empty
space. At 1.5 s the dwell fires, speech is still running, nothing is said, and the state is
spent. The finger must move 20 px to re-arm.

- Expected: where-am-I spoken once the overview ends (as `checkLineDwell` does: it sets
  `spoken` inside the guard, Explore.tsx:1531).
- Actual: silence for as long as the finger rests there. Same after any long Ask answer.

Fix: pass `isSpeaking` into `checkWhereAmIDwell`, or only commit `nextState` when speech ran.

### B7 · MEDIUM · Explore.tsx:1447-1470, flow/explore.ts:129-132 · graph scan tone plays through corners

`scanTone` excludes only the polyline target. On a vertex in a `function_graph` the engine emits
`tone(null)` (hapticEngine.ts:163, "a corner stops the tone") and four lines later the scan
branch calls `setTone(hz, 0.33)`.

- Expected (engine rule 1, design.md): silence at a corner so the label is heard clean.
- Actual: with Graph scan ON (the default) the tone keeps sounding under the label, and keep-alive
  renews it every 60 ms. The engine's corner rule is overridden by a later lane.

Also on an axis line: the engine sends `tone(null)` on every move (hapticEngine.ts:185) and scan
re-sets the tone straight after. In `audio.ts:236` `setTone(null)` clears `earconRestoreAt`, so a
tone on an axis is not ducked under an earcon. Small, but it is two lanes fighting every 60 ms.

Fix: return null from `scanTone` for `target.kind === 'vertex'`; decide scan vs engine tone in
one place.

### B8 · MEDIUM · Explore.tsx:1339 · page-edge cue plays the same earcon as leaving the screen

The edge cue calls `playEarcon('back')`. `handleExit` (609) and system back (1197) play the same
earcon. An eyes-closed user who drifts off the diagram hears the "you left Explore" sound and the
words "Edge, left". Two meanings, one sound.

Fix: give the edge its own earcon, or speech only. Owner decision (a new sound is a new value).

### B9 · MEDIUM · flow/commands.ts:234, 264, 294, 322, 351, 365 · substring commands swallow real questions

`norm.includes('help')`, `includes('faster')`, `includes('slower')`, `includes('next corner')`,
`startsWith('describe')`, `startsWith('repeat')` all run before the Ask backend.

Repro: ask "Which bar grows faster?".

- Expected: an answer from the diagram.
- Actual: `set_rate fast`. Speech rate changes and is persisted (`setRate` writes storage). The
  question is never sent. "Can you help me find AB" reads the help text. "Describe angle B"
  reads the overview.

Fix: exact match, or match only when the transcript is at most three words.

### B10 · MEDIUM · Explore.tsx:714-716 vs 2127 · three "where am I" paths, three position sources

- Voice command: `pendingCursor.current`, which is set to null on lift (2065 via `scheduleDraw`),
  then `whereAmI` falls back to the centre (commands.ts:425).
- Button: `lastFingerNormRef`, which survives a lift.
- Dwell: live coordinates.

Repro: explore the top-left corner, lift, tap Ask, say "where am I".

- Expected: the last place the finger was (what the button gives).
- Actual: "Centre ...", described as if the finger were there.

Also the "next corner" voice command moves `pendingCursor` but not `lastFingerNormRef`, so the
button then reports the old finger position, not the corner just announced.

### B11 · MEDIUM · Explore.tsx:1436-1445 · near-line clicks never stop while a finger rests

Keep-alive feeds `proximityStep` every 60 ms with the same distance. A finger resting 30 px from
a line clicks about every 250 ms for as long as it is down, including under where-am-I speech,
the overview, and an Ask answer in the "thinking" phase. Nothing checks `isSpeechSpeaking()`.
Before the keep-alive lane, clicks needed movement.

Fix: mute clicks while speech is running, or stop after N clicks without movement. Proposed
values; owner decision.

### B12 · MEDIUM · drivers/storage.ts:67-73 and three copies · any odd stored value turns a default-ON switch OFF

`stored === 'true'` is the only accepted spelling. `'1'`, `'TRUE'`, `'on'` or a truncated value
all read as false. Directions, Finding sound and Graph scan default to ON, so a bad value turns
them off without a word. `getStoredSpeechDetailSetting` (flow/explore.ts:96) validates and falls
back; the four booleans do not.

Second failure: if `setItem` throws (quota, private mode) while an old value is still stored,
`safeGet` keeps returning the old value and the in-memory copy is never consulted. The switch
flips back on the next read (pointerdown re-reads all six, Explore.tsx:1638).

Fix: accept only `'true'`/`'false'`, otherwise use the default; prefer the in-memory value when
it is set.

### B13 · LOW · Explore.tsx:1729-1762, 1861-1894 · moves during Ask listening advance state with no effects

The engine, heartbeat, proximity and sticky states are stepped and the effects thrown away. A
finger that lands on corner A while listening is "already on A" when listening ends: no corner
pattern and no label until it leaves and comes back. Same for a bar's label and value.

### B14 · LOW · Explore.tsx:1346-1348 · centre tick fires late on a resting finger

A vertex within 24 px of the canvas centre (a circle's centre "O" is typical). The corner fires,
the quiet window blocks the centre tick, and the first keep-alive tick after 450 ms fires
`vibrate(25)` while the finger has not moved. Felt as "bzz-tap ... tick". The tick is also not
guarded against a heartbeat beat in progress.

### B15 · LOW · Explore.tsx:472-488 · scene swap inside a mounted Explore resets only engine and heartbeat

`lastVertexVisitRef` (keyed by vertex id: "A" in the new diagram is "visited recently" for 10 s,
so no compass), `cornerIndexRef`, `axisState`, `speechPacingState`, `lineDwellRef`,
`lastFingerNormRef` and `prevTargetRef` all survive. `App.tsx:764` gives `<Explore>` no `key`.
Only reachable when the scene prop changes without leaving the screen (shared link opened while
exploring).

### B16 · LOW · Raw Mode: line-name dwell and where-am-I speak internal ids

`backend/app/raw_mode.py:283, 312` names points `raw_p0` and segments `raw_s0`, with no labels.
`lineName` (flow/explore.ts:867-876) and `whereAmI` (commands.ts:493) fall back to the id.
Resting on a contour for 800 ms speaks "Side raw_s12. Up-left to raw_p3, ..." No file I read
guards on raw mode. I did not read `core/compass.ts`, so the exact wording is unchecked.

---

## 2. Dead code and merge leftovers

| Where | What |
|---|---|
| Explore.tsx:490-515 and 1209-1258 | Two separate blur/visibility listener sets. The first only stops the tone; the second does everything. The first is redundant. |
| Explore.tsx:563-566 | `sendProximityLift` is a no-op: `proximityStep` returns the same state object for a lift (proximity.ts:132). Called 9 times. |
| Explore.tsx:1236-1257 vs 1209-1233 | Blur handler lacks the `resetBarRest` the hidden handler has (1224). Drifted copies. |
| Explore.tsx:1180-1206 vs 591-623 | System-back handler and `handleExit` are near copies; back lacks tone stop and four state resets. Saved only by the unmount cleanup. |
| Explore.tsx:591-623 | `handleExit` never calls `drivers.haptics.stop()`; relies on unmount. |
| Explore.tsx:1608-1630 and 1930-1951 | Where-am-I dwell block pasted twice (B6 lives in both). |
| Explore.tsx:1731, 1779, 1863, 1901, 2014, 1559 | Six 15-argument positional calls to `processPointerMove`. All six are in the right order today. |
| flow/explore.ts:1434 | `noteBarMove` is an alias of `updateBarMove`; the screen uses only the latter. |
| flow/explore.ts:1338-1356 | `paceSpeech` "rest query" branch duplicates `checkBarRest`; the screen never sends an empty bar text. |
| flow/commands.ts:302, 309 | `includes('varnan')` twice. |
| flow/explore.ts:66-114 | Graph scan and speech detail storage live in `flow/`; the other four switches live in `drivers/storage.ts`. Six copies of one getter/setter/reset trio. |

i18n: I checked `src/i18n/index.ts` for a key defined twice inside one language table with a
script and found none. I did not check for keys present in `en` but missing in `hi`/`gu`.

---

## 3. Feature interaction matrix

RISK = I can state a wrong outcome from the code. warn = plausible, needs the phone. ok = read
and found consistent. blank = not examined.

| Feature | Geometry | Graph | Bars | Raw Mode |
|---|---|---|---|---|
| Hold keep-alive | RISK B1 after Guide/Ask | RISK B1 | RISK B1 | RISK B1 |
| Corner compass | ok; warn 10 s window slides (each visit renews it) | ok | n/a | warn: every contour point is an unlabelled corner |
| Line-name dwell | ok | warn: unlabelled curve speaks its id | ok (label only, no value) | RISK B16 |
| Near-line click | RISK B11 | RISK B11 | RISK B11 | warn: 300 segments, clicks nearly everywhere |
| Where-am-I dwell | RISK B6 | RISK B6 | RISK B6 | RISK B6, B16 |
| Where-am-I voice/button | RISK B10 | RISK B10 | RISK B10 | RISK B10 |
| Graph scan tone | n/a | RISK B7 | n/a | n/a (kind unknown) |
| Speech pacing, Full | ok | ok | ok | ok |
| Speech pacing, Short | RISK B3 | RISK B3 | RISK B3 comma, B4 rest | warn |
| Page-edge cue | RISK B8 | RISK B8 | RISK B8; warn baseline at y=1 | RISK B8 |
| Corner heartbeat ON | RISK B1; warn B14 | RISK B1 | n/a | warn: beats on contour corners |
| Stay on line ON | ok | warn: tone pitch follows finger y, up to 24 px off the curve | RISK B5 | warn: sticks to noise contours |
| Guide | RISK B1, B2 | RISK B1, B2 | RISK B1 | |
| Ask listening | warn B13 | warn B13 | warn B13 | warn B13 |
| Voice commands | RISK B9 | RISK B9 | RISK B9 | RISK B9 |

Setting combinations most likely to misbehave, worst first:

1. **Short + Stay on line + bars at 360x640.** B3, B4 and B5 together: label cut at a comma,
   value waits for a stillness that may never come, interior unreachable.
2. **Heartbeat ON + Guide.** B1: the heartbeat is silent exactly where a user rests, at arrival.
3. **Graph scan ON + Finding sound ON + Directions ON, finger resting off the curve.** Scan
   drone, endless clicks (B11) and where-am-I speech at once; B6 may eat the speech.
4. **Graph scan ON + labelled graph points + Short.** B7 tone under a label that B3 has cut.
5. **Any stored value other than the two exact strings.** B12 turns three default-ON features off.

Lifecycle resets I checked: lift, blur and hidden reset engine, heartbeat, sticky, page edge,
dwell and stop the timer (ok). Ask start resets engine, heartbeat, sticky and tone (ok). Guide
start does the same (ok). Exit relies on unmount (ok in effect). Axis state is reset by none of
them (B2). Pacing state is kept across holds on purpose.

Ordering inside one move (Explore.tsx:1331-1479): page-edge earcon, centre tick vibrate, merged
speech plus engine vibrate and tone via `runEffects`, proximity click, scan tone. The last
vibrate wins on the motor, so a centre tick is always overwritten by a line buzz in the same
move. Speech is one merged utterance per move, but line dwell, bar rest and where-am-I each call
`speak` directly afterwards and cancel it. Bar rest (1601) has no `isSpeechSpeaking` guard.

---

## 4. Tests that prove nothing (or less than their name says)

I sampled; this is not a full audit of 140 files.

| Test | Why it cannot catch the bug it names |
|---|---|
| `tests/explore.keepAlive.test.ts:84-100` | Builds its own `createExploreHoldSession` with a hand-written `applyMove`. It tests the timer plus a copy of the screen glue, not `Explore.tsx`. "Stops when Ask is active" and "stops while guiding" (339, 354) pass, and B1 (never restarts) is invisible because the copy has no later move. |
| `tests/explore.keepAlive.test.ts:193` | Accepts gaps "of at most 150 ms" between 80 ms buzzes. A still finger pulsing 80 on / 70 off passes. The moving-finger feel (retrigger about every 72-80 ms) is not compared. |
| `tests/graphScan.test.ts:190-232` | `simulateSweep` re-implements the scan branch of `applyMoveResult` with its own `playingScanTone` flag. A change to the real branch (B7) cannot fail it. |
| `tests/heartbeat.test.ts:120-127`, `graphScan.test.ts:161`, `overview.test.ts:162-171`, `cornerCompass.test.ts:261` | i18n checks assert "defined and non-empty". An English string pasted into `hi` and `gu` passes. |
| `tests/cornerCompass.test.ts:432`, `nearLineClick.test.ts:593` | `vibrations.length > 0`: any vibration of any pattern passes. |
| `tests/flow.pageEdge.test.ts:342`, `cornerCompass.test.ts:457` | `expect(speakEffect).toBeDefined()` with no check of the words. |
| `tests/explorePacing.test.tsx:186, 260` | Real `Explore` render (good), but two cases only: bars sweep in Short, axis repeat in Full. No Short corner with a decimal label (B3), no rest-for-value (B4). |
| Most `processPointerMove` callers in tests | Pass 7 to 10 arguments. The trailing five (heartbeat state, heartbeat config, page-edge state, sticky) are exercised only in `heartbeat.test.ts` and `flow.pageEdge.test.ts`. A swap of two trailing same-typed arguments in `Explore.tsx` would pass every unit test; only TypeScript's distinct types protect the order today. |
| `tests/share.decodeBound.test.ts:94` | `it.todo`: the 2 MB bound is not tested. |

Order dependence: settings are module-level state plus `localStorage` (`inMemory*Setting`,
storage.ts:65-131). A test file that sets a switch and does not call the `_reset...ForTesting`
helper leaks it to later tests in the same worker. I did not audit which files reset.

Playwright coverage gaps (`frontend/e2e/`, two specs):

- Covered: 360x640, 390x844, the project default, a height shrink, one width/height swap
  (`explore.canvas-stable.spec.ts:677`). Layout and canvas stability only.
- Not covered: any behaviour (speech, vibrate, tone calls) in a real browser; 200% font scale
  (no `font-size` or text-zoom anywhere in `e2e/`); landscape for the actions layout spec; the
  status line growing when a long page-edge or where-am-I sentence replaces it; Hindi and
  Gujarati string lengths; the text-fallback form open at 360x640 with five buttons; Raw notice
  plus Verified banner plus no-vibration note stacked together.
- The 360x640 canvas floor is now 230 px (measured 237). Honest, but it leaves 7 px of margin
  and B5 shows that 237 px is already too small for the bar sample.

---

## 5. Cheap tests that would catch the most

Unit and property (pure, fast, no DOM):

1. **Keep-alive restart (B1).** Fake timers: `start`, `stop`, then `update`; advance 200 ms;
   assert `onTick` fired. Fails today.
2. **Short-mode label round trip (B3).** fast-check: for any label string, `paceSpeech` with
   `source: 'corner', detail: 'short'` returns the label unchanged. Fails on any `.`.
3. **Bar interior reachable (B5).** fast-check over bar widths and scales: for a finger at the
   bar's centre with `prevTarget` its edge and `heldMs` 1000, `followTarget` returns `bar`
   whenever `hitTest` does. Fails for widths under 48 px.
4. **Dwell not lost (B6).** Drive `checkWhereAmIDwell` with "speaking" true for 3 s then false;
   assert one speak within 1.5 s of speech ending.
5. **Scan tone silent on a vertex (B7).** `scanTone(graph, vertexTarget, x, y) === null`.
6. **Command parser does not eat questions (B9).** Table test: ten real questions containing
   "help", "faster", "slower", "describe", "repeat" must parse as `unknown`.
7. **Storage garbage (B12).** fast-check any string in storage: the four boolean getters return
   their documented default unless the value is exactly `'true'` or `'false'`.
8. **Named-argument guard.** One test calling `processPointerMove` with all 15 arguments set to
   distinguishable values, asserting each lands in the right result field. Better: change the
   trailing parameters to one options object (a Kiro task, not mine).

Screen-level (jsdom, real `Explore`, fake drivers):

9. **Guide arrival then stillness (B1, B2).** Start guide, pointerdown, arrive, advance 1 s with
   no moves; assert at least one `vibrate(80)` on a line target and no "y-axis" in speech.
10. **Where-am-I parity (B10).** After a lift, the voice command and the button give the same
    sentence.
11. **Ask listening then corner (B13).** Land on A while listening, end listening, one more move
    on A; assert the label is spoken.

Soak (one test, fake timers, about 60 simulated seconds):

12. **Random walk with random switch flips.** fast-check model: random moves, lifts, blur,
    hidden, Ask start/stop, Guide start/arrive, and the six switches. Invariants after every
    step: no `vibrate` or tone while lifted; no tone other than null while Ask is listening; at
    most one `speak` per event; after any event sequence ending with the finger down on a line
    and 300 ms of stillness, a line buzz occurred in the last 200 ms. The last invariant finds
    B1 on its own.

e2e (Playwright, cheap additions to the existing specs):

13. 200% root font size at 360x640: all five buttons at least 48 px and inside the viewport.
14. Landscape 640x360 for the actions-layout spec.
15. Status line set to the longest `whereAmI` sentence in `hi`: canvas height unchanged.

---

## 6. For the owner

Test on the phone (five minutes, eyes closed):

- B4: Speech detail Short, sweep across two bars and rest. Is the value ever spoken?
- B1: Guide to a corner, stay still on arrival. Any buzz, any heartbeat?
- B5: Stay on line ON, bar sample. Can you get a bar's value?
- B8: drift off the diagram edge. Does the sound read as "edge" or as "I left"?
- B11: rest a finger near a line while the overview is speaking. Are the clicks in the way?

Decisions that are yours, not mine:

- B8 and B11 need a new sound or a new limit: proposed values, per `tech.md`.
- B9: exact-match commands will make some loose phrasings fall through to Ask (costs a request).
- Whether Raw Mode should speak line names and compass at all (B16).

Not done: I did not add an entry to `docs/BUILD_LOG.md`, because the brief allowed writes to
this file only. It needs one line: "Claude Code, chaos QA review, read-only, 16 findings".
All fixes belong to Kiro; I changed no source.
