# Ghost Touch: heartbeat at corners, idea check and worker plan (2026-11-16)

Read-only pass by Claude Code (planning agent). Nothing in the repo was changed except this file.
Read: `CLAUDE.md`, `.kiro/steering/tech.md`, `prototypes/haptics-test.html`,
`frontend/src/core/hapticEngine.ts`, `frontend/src/flow/explore.ts`, `frontend/src/screens/Explore.tsx`,
`frontend/src/screens/Debug.tsx`, `frontend/src/drivers/haptics.ts`, Requirement 4 and 33,
`tasks.md`, and `docs/reports/fable-blind-user-plan.md`.

Not done: no phone, no motor, no TalkBack, no tests run. **Every number in this file is PROPOSED
until the owner has felt it on the phone.** Nothing here belongs in the STEMergent build.

Owner request: "for the corners I want a heartbeat vibration, so that we get to know that we are
at a vertex."

---

## (a) Verdict

- Good idea, but the useful part is the **repetition**, not a new pulse shape. The tuned corner
  pattern `[50, 90, 50]` is already two short pulses, so it is already a "lub-dub". What is missing
  is everything after it: a finger resting on a corner feels nothing at all (engine rule 2).
- Recommended: keep the tuned entry pattern exactly as it is, and add a **resting heartbeat**: while
  the finger stays on the vertex, the double pulse repeats about once every 900 ms (PROPOSED).
- Build it as an **opt-in, default OFF**, in a new pure module `frontend/src/core/heartbeat.ts`.
  `hapticEngine.ts`, `DEFAULT_HAPTICS` and every row of the `tech.md` table stay untouched, the same
  way the click cue (`proximity.ts`) and sticky line (`sticky.ts`) were added.
- Not recommended: replacing `[50, 90, 50]` with a different one-shot. It changes a tuned value and
  does nothing for a resting finger. If the owner still prefers a different entry pulse after the
  phone test, that is a separate one-line tuned-value change needing his written yes.
- First slice: six candidate patterns and a "resting on corner" pad on the hidden `#/debug` page.
  It touches no core file, no tuned value and not `Explore.tsx`, so it can run now.
- Zero-code check available today: `prototypes/haptics-test.html` already has a "Heartbeat" button
  (`40,120,80`) next to "Corner" (`50,90,50`).
- Spec conflict to settle: Requirement 4.4 says the corner pattern shall not repeat while the finger
  stays on a vertex. The heartbeat (when switched on) repeats it. 4.4 must be amended by Kiro.

---

## (b) Blind-user reasoning (one finger, eyes closed)

What I get at a corner today:
1. I arrive: "bzzzz-tap", then the label and the directions of the edges.
2. For 450 ms no line buzz (quiet window).
3. If I stay: nothing. Silence. The keep-alive timer re-runs the pipeline every 60 ms, but the
   engine answers "same vertex, no effects" every time.

So a corner is the one place where resting is punished. On a line, resting keeps buzzing. On a
corner, resting feels the same as empty space, the letterbox, or a crashed app. The earlier report
(section 2.4) listed five meanings of silence; this is a sixth. When I pause on B to listen to
"Down-left to C", I cannot tell whether my finger has slid off the 22 px circle while I listened.

What a heartbeat gives me:
- "Still on the corner" without moving and without speech. I can rest, think, and leave when ready.
- A way to find the corner's exact spot: wobble until the beat is steady.
- A third state that is clearly different from the other two. Line = continuous buzz. Empty = nothing.
  Corner = sparse beats with long rests. The phone cannot change strength, so rhythm is the only
  tool, and "continuous" versus "two taps per second or slower" is about as far apart as rhythm gets.

What a one-shot lub-dub at entry would give me: nothing new. I already get a double pulse there.

What could annoy or mislead me:
- A beat that keeps going for 200 ms after I have left the corner would lie. It must be cut at once.
- A beat that swallows the first line buzz when I leave along an edge would bring back the worst
  problem of the old report (section 2.3: no confirmation after a corner).
- A wobbling finger on the edge of a line can make its own irregular on/off buzz. The heartbeat
  must be regular and slow enough that I never mistake one for the other.
- Vibration during voice listening adds motor noise to the microphone.
- On phones that drop array patterns the driver falls back to one solid pulse
  (`fallbackPulse`, at least 100 ms). The beat then becomes one thump per period. That still says
  "corner", because the meaning is carried by the repetition. This is a strong reason to make the
  repetition the signal and not the fine shape of the pulse.

---

## (c) Design and numbers

### c.1 The two options

| | A. One-shot lub-dub replaces `[50,90,50]` | B. Resting heartbeat, entry unchanged (recommended) |
|---|---|---|
| Resting finger knows it is on a corner | no | yes |
| Tuned value changed | yes (needs approval + phone test) | no |
| Requirement 4.4 | unchanged | must be amended (switch on only) |
| Quiet window, K2 re-entry (4.9 / P96) | unchanged | unchanged (see c.3) |
| Demo risk | changes the demo feel | none while the switch is off |
| Cheap phones that drop arrays | same as today | still works as a slow single thump |
| Battery, heat | same | about 11% motor duty on a corner (100 ms per 900 ms); a line is close to 100% |

### c.2 Behaviour (option B)

All times are engine time `t` in ms. PROPOSED defaults: beat pattern `[50, 90, 50]` (the tuned
corner pattern reused, so one meaning has one feel and no new pulse length is introduced), period
**900 ms** start to start (about 67 beats per minute). The owner picks the final pair in section (d).

1. **Entry:** unchanged. The engine emits `vibrate([50,90,50])`, the label, `tone(null)`, and sets
   the 450 ms quiet window. The heartbeat module only notes the time: next beat at `t + periodMs`.
2. **Resting:** on any later step where the target is the same vertex and the engine emitted no
   vibrate, if `t >= nextBeatAt` the module adds one `vibrate(beatPattern)`. Then
   `nextBeatAt += periodMs` (or `t + periodMs` if it has fallen more than one period behind, so a
   paused timer never fires a burst). Steps come from `pointermove` or the 60 ms keep-alive, so a
   beat can be up to about 60 ms late. One beat is one `navigator.vibrate` call lasting 190 ms.
3. **No speech, no tone** on a beat. The label is spoken once at entry as today.
4. **Leaving the vertex** (any non-vertex target): if a beat may still be playing
   (`t < lastBeatAt + sum(beatPattern)`):
   - target is a line and the engine emits the line buzz in this step: nothing extra, the
     `vibrate(80)` call replaces the beat (a new `navigator.vibrate` call cancels the old pattern);
   - otherwise: the module puts `vibrate(0)` first in the effect list.
   So the beat stops within one move event, at most 60 ms for a finger that is truly still.
5. **Lift:** the engine already emits `vibrate(0)`; the module resets.
6. **Quiet window is not touched by beats.** Only the entry sets `quietUntil`. Because
   `periodMs >= quietMs + beat length` is enforced (900 >= 450 + 190), no beat can fall inside the
   entry quiet window, and leaving a corner from rest gives the line buzz at once. That is better
   than leaving at entry, where I wait up to 450 ms.
7. **K2 re-entry (Requirement 4.9):** re-entering the same vertex inside the quiet window emits
   nothing from the engine; the module restarts its clock (`nextBeatAt = t + periodMs`). A finger
   jittering on the 22 px boundary therefore gets no beats until it settles. Correct: it is not
   resting yet.
8. **Invalid config** (empty pattern, non-finite or non-positive numbers, period below
   `quietMs + beat length`) means off.

### c.3 Why one call per beat, not one long repeating pattern

A single call such as `vibrate([50,90,50,710,50,90,50,710,...])` was considered and rejected:
- any other `vibrate` call (line buzz, centre tick 25 ms) silently kills the rest of it;
- it keeps playing after the finger leaves unless something cancels it, and nothing does today when
  a finger goes from a vertex to empty space (the engine sends `vibrate(0)` only when leaving a line);
- browsers may truncate long patterns; the limit is implementation defined;
- the fallback path would turn it into one very long solid buzz (`fallbackPulse` sums the "on" entries).

One call per beat fails safe: if every later step is lost, the motor stops by itself after 190 ms.

### c.4 Interactions checked in code

| Thing | What happens | Action |
|---|---|---|
| Line buzz 80 / 70 | Never emitted on a vertex target. On exit it replaces the beat. | property P125 |
| Near-line click (audio) | `distPx` is null on a vertex, so no clicks there. Unchanged. | none |
| Theremin / graph scan | Beats emit no tone. Corner entry still stops the tone. | none |
| Centre tick `vibrate(25)` | Fired by the shell, only once on arrival at the centre, suppressed in the quiet window. Could clip one beat if a vertex sits at the centre. | accept; phone check |
| Keep-alive timer | Drives the beats for a still finger. It stops during Ask, Guide, leaving, blur, hidden. So do the beats. | lane test |
| Ask (microphone) | Pipeline is paused, so no new beats. A beat already playing ends within 190 ms. | lane: send `vibrate(0)` when Ask starts if not already done |
| Guide | Paused while guiding. Arrival pulse (`drivers/index.ts` uses `cornerPattern`) unchanged. | none |
| Directions speech at a corner | Beats start 900 ms after entry, under the speech. Vibration does not cut speech. | phone check: is it distracting |
| TalkBack | Same pointer path after double-tap-hold. TalkBack's own haptics may mix in. | phone check |
| Fallback driver (no motor: audible buzz) | Each beat becomes an audible double buzz. Opt-in, so acceptable. | phone/laptop check |
| Battery, heat | About 11% duty; less than tracing a line. | none |

### c.5 Where it lives

- **Decision logic: pure core, Kiro.** New file `frontend/src/core/heartbeat.ts`. It is a rule about
  when the motor fires, so it must be property-testable (tech.md architecture rules 1 and 2).
- **Not in `hapticEngine.ts`.** `step()` and `DEFAULT_HAPTICS` stay byte-identical; P3 to P6 and P96
  cannot be affected. The module wraps the engine's output for one step.
- **Not in the driver.** The driver "decides nothing" (its own header comment). A driver timer
  would also outlive the finger.
- **Shell (agy):** a Settings switch "Corner heartbeat", default OFF, and wiring in
  `flow/explore.ts` (`processPointerMove`) and `Explore.tsx`. With the switch off the module is not
  called at all.

Proposed shape (Kiro may rename):

```ts
export interface HeartbeatConfig { pattern: number[]; periodMs: number; quietMs: number }
export const DEFAULT_HEARTBEAT: HeartbeatConfig = { pattern: [50, 90, 50], periodMs: 900, quietMs: 450 };
export interface HeartbeatState { vertexId: string | null; nextBeatAt: number; lastBeatAt: number }
export function initialHeartbeatState(): HeartbeatState;
export type HeartbeatInput =
  | { kind: 'move'; t: number; target: Target; engineEffects: readonly Effect[] }
  | { kind: 'lift'; t: number; engineEffects: readonly Effect[] };
// Returns the complete effect list for the step: the engine's effects, in order, plus at most
// one added vibrate (a beat at the end, or vibrate(0) at the front).
export function heartbeatStep(state: HeartbeatState, input: HeartbeatInput, cfg?: HeartbeatConfig | null):
  { state: HeartbeatState; effects: Effect[] };
```

`quietMs` is copied from the tuned 450 (as `proximity.ts` copies the 14 px line radius); it is not a
new value.

### c.6 Spec impact

Next free numbers seen today: **Requirement 34, property P120, task 59** (last used: Requirement 33,
P119, task 58 / 58b). Kiro has uncommitted spec edits in the working tree, so Kiro must re-check the
numbers before writing.

- New **Requirement 34: "Resting on a corner has a heartbeat (optional, off by default, phone-untested)"**.
- Amend **Requirement 4.4**: holds as written when the heartbeat is off; when on, the speech still
  never repeats and the pattern repeats only as Requirement 34 says.
- New **PROPOSED row in `tech.md`** (separate row, existing rows untouched), like the click cue and
  sticky rows.
- Properties (fast-check, 200+ runs):

| # | Property |
|---|---|
| P120 | **Off is identity.** With `cfg` null, undefined or invalid, for any trace the returned effects deep-equal `engineEffects` and the state stays initial. |
| P121 | **Beats only on a resting vertex.** An added array pattern appears only on a step whose target is a vertex with the same id as the step before and where the engine emitted no vibrate. |
| P122 | **Rate.** With non-decreasing timestamps, the gap between an entry and the first beat, and between any two beats of one visit, is at least `periodMs`. No beat has `t` inside the entry quiet window. |
| P123 | **Liveness.** A finger resting on one vertex with steps at most 60 ms apart never goes longer than `periodMs + 60` without a beat. |
| P124 | **Stops at once.** On the first non-vertex step after a beat with `t < lastBeatAt + sum(pattern)`, the effects contain an engine vibrate, or `vibrate(0)` as the first vibrate effect. No beat follows until a vertex step. A lift returns exactly the engine's effects. |
| P125 | **Never over the line buzz.** On a step whose target is a line no array pattern is added, and an engine line buzz is the last vibrate in the list. |
| P126 | **Additive only.** Removing the (at most one) added effect gives exactly `engineEffects` in order. So P3 to P6 and P96 hold for the engine part with the heartbeat on. |
| P127 | **Total.** NaN, infinite or backward timestamps, junk targets and junk configs never throw and add no beat. Inputs are not mutated. |

Plus one example test: triangle sample, rest on B for 3 s gives corner at 0, beats near 900, 1800,
2700; moving onto side BC at 2750 gives `vibrate(80)` in that step.

---

## (d) Phone test plan (10 minutes, owner, OnePlus Nord CE6, then the budget phone)

Before any lane lands (2 minutes): open `prototypes/haptics-test.html` on the phone the usual way,
tap "Corner" then "Heartbeat" a few times each. This only compares one-shot shapes.

After lane hb1 lands, open the deployed site with `#/debug`. Eyes closed, phone held as when tracing.

Candidates on the page (pattern is on, off, on in ms; period is start to start). All PROPOSED.

| Id | Name | Pattern | Period | Note |
|---|---|---|---|---|
| H1 | Tuned corner, repeated | `[50, 90, 50]` | 900 | no new pulse length; recommended start |
| H2 | Tight | `[40, 60, 40]` | 800 | shortest; may vanish on weak motors |
| H3 | Soft then strong | `[30, 70, 60]` | 900 | 30 ms may not be felt |
| H4 | Strong then soft | `[60, 80, 40]` | 1000 | closest to a real heart |
| H5 | Prototype | `[40, 120, 80]` | 1000 | the existing prototype button |
| H6 | Heavy | `[70, 110, 70]` | 1100 | for the budget phone |

Note on forms such as `[40, 60, 40, 400]`: a trailing "off" does nothing in a single call; it only
means "rest 400 ms before the next beat", which is a period of 540 ms (about 110 per minute, a
running heart). Resting heart rhythm is a period of 800 to 1000 ms. The page offers period buttons
700 / 900 / 1100 so the owner can feel this.

Controls on the page:
1. Per candidate: "Once" and "Repeat" (one `vibrate` call per beat on a timer, auto-stop after 10 s).
2. Period: 700 / 900 / 1100 ms, applied to "Repeat" and to the pad.
3. "Line buzz 2 s" (80 ms re-triggered every 70 ms) for side-by-side comparison.
4. "Line, then corner": 1 s of line buzz, then the tuned corner pattern, then the chosen heartbeat.
5. **Resting pad:** a large area. Finger down = tuned corner pattern, then the chosen candidate
   beats while held. Finger up or sliding off = `vibrate(0)` at once.
6. "Stop" (exists).

Checklist (write yes/no and the candidate id next to each):
1. With eyes closed, can I tell "Repeat" from "Line buzz 2 s" within one second? Every time?
2. Can I feel both pulses of the beat, or does it feel like one? (One is acceptable; note it.)
3. Does it feel like a heartbeat, or like a notification?
4. Is the period comfortable for 10 seconds? Too slow to trust, or too busy?
5. On the pad: does the beat stop the moment I lift? The moment I slide off?
6. On "Line, then corner": is the change from line to corner obvious?
7. With the page's "Speak" button running: is the beat distracting under speech?
8. Does the debug line report `returned true` for the array pattern? (false means this phone drops
   arrays and plays one solid pulse.)
9. Repeat 1, 2 and 5 on the budget phone and with TalkBack on.
10. Pick: one candidate id and one period. Or "none, leave corners as they are".

After lane hb2 lands (switch on, real Explore), on the triangle:
- Rest on A for 5 s: steady beats, label spoken once.
- Leave A along AB from rest: line buzz starts immediately, no leftover beat.
- Leave A into empty space: beat stops at once.
- Start a voice question while resting on A: beats stop.
- Sine and bar samples behave exactly as before (no vertices on them).
- Switch off: everything exactly as today.

---

## (e) Worker plans

Order and dependencies:

```
Now, parallel, no collisions      hb1 debug candidates (agy)      KH1 spec + core/heartbeat.ts (Kiro)
Owner                             phone test (d), pick a candidate and period, or stop here
After KH1 and the owner's pick    hb2 switch + wiring (agy)       <- edits Explore.tsx, flow/explore.ts, LabSettings.tsx
After hb2 phone check             KH2 record the chosen values (Kiro)   hb3 docs (agy)
```

- **Only hb2 edits `Explore.tsx`, `flow/explore.ts` and `LabSettings.tsx`.** It must wait for the
  lane driver to finish merging the current lanes and must not run beside any other lane that
  touches those files (58b sticky wiring, the bu7/bu8 follow-ups). One at a time.
- hb1 touches `Debug.tsx` only (plus i18n, CSS, tests). `i18n/index.ts` is shared with other lanes:
  append keys at the end of the debug block to keep merges trivial.
- KH1 does not depend on the owner's choice: the pattern and period are config values.

### KIRO WORKER TASKS

Kiro owns `frontend/src/core/`, `.kiro/specs/ghost-touch/*`, `.kiro/steering/tech.md` and the
property tests, and ticks its own boxes.

#### KH1. Resting heartbeat machine (pure), spec first

- Requirement idea (34): "WHERE the corner heartbeat is switched on, WHILE the finger stays on the
  same vertex after its corner pattern, the system SHALL repeat a double pulse once per period.
  It SHALL NOT repeat speech or tone. WHEN the finger leaves the vertex or lifts THEN any beat in
  progress SHALL stop in that same step. A beat SHALL NOT fall inside the corner quiet window and
  SHALL NOT change it. WHERE the heartbeat is off the output SHALL be exactly today's."
- Properties: P120 to P127 in section c.6.
- Acceptance: new `frontend/src/core/heartbeat.ts`, pure, named exports, no `any`;
  `hapticEngine.ts`, `hitTest.ts`, `DEFAULT_HAPTICS` and existing `tech.md` rows unchanged
  (`git diff` empty on them); Requirement 4.4 amended; a separate PROPOSED row in `tech.md`;
  properties at 200+ runs, mutation-checked; existing suite green.

```
Task: add an optional "resting heartbeat" for corners as a new pure core module. Spec before code.

Read first: .kiro/steering/tech.md (tuned values: change none), .kiro/steering/product.md,
docs/reports/fable-heartbeat-plan.md (sections b, c and e), frontend/src/core/hapticEngine.ts,
frontend/src/core/proximity.ts and frontend/src/core/sticky.ts (same opt-in pattern),
frontend/tests/hapticEngine.prop.test.ts, Requirement 4 (4.3, 4.4, 4.5, 4.9) and Requirement 33.

1. Spec (check the next free numbers yourself; expected Requirement 34, P120-P127, task 59):
   - New requirement "Resting on a corner has a heartbeat (optional, off by default,
     phone-untested)" with EARS criteria: repeat a double pulse once per period while the finger
     stays on the same vertex; first beat no earlier than one period after the corner pattern; no
     speech and no tone on a beat; a beat never falls inside the quiet window and never changes
     quietUntil; leaving the vertex or lifting stops a beat in progress in that same step (the line
     buzz of that step, or vibrate(0)); off, null or invalid config gives exactly the engine's
     output; pure and total.
   - Amend Requirement 4.4: unchanged when the heartbeat is off; when on, speech still never
     repeats and the pattern repeats only as the new requirement says.
   - design.md section and properties P120-P127 as listed in the plan, section c.6.
   - tech.md: ONE new row marked "PROPOSED, pending owner approval, not phone-tested": beat pattern
     [50, 90, 50] (the tuned corner pattern, reused), period 900 ms, optional, OFF by default.
     Do not edit any existing row.
   - tasks.md: task 59 (core) and 59b (agy wiring; not yours, leave unticked).
2. Code: frontend/src/core/heartbeat.ts, named exports only:
   - HeartbeatConfig { pattern: number[]; periodMs: number; quietMs: number }
   - DEFAULT_HEARTBEAT = { pattern: [50, 90, 50], periodMs: 900, quietMs: 450 }  (quietMs copied
     from the tuned value, like proximity.ts copies the line radius)
   - HeartbeatState { vertexId: string | null; nextBeatAt: number; lastBeatAt: number },
     initialHeartbeatState()
   - HeartbeatInput = { kind: 'move'; t: number; target: Target; engineEffects: readonly Effect[] }
                    | { kind: 'lift'; t: number; engineEffects: readonly Effect[] }
   - heartbeatStep(state, input, cfg?: HeartbeatConfig | null) -> { state, effects: Effect[] }
   Rules:
   a. cfg null/undefined/invalid (empty pattern, non-finite or non-positive entries, periodMs not
      finite, or periodMs < quietMs + sum(pattern)): return engineEffects unchanged, state initial.
   b. lift: engineEffects unchanged, state reset.
   c. vertex target and engineEffects contains a vibrate (corner entry): remember the id,
      nextBeatAt = t + periodMs. Add nothing.
   d. vertex target, different id from the state, no engine vibrate (Requirement 4.9 re-entry):
      remember the id, nextBeatAt = t + periodMs. Add nothing.
   e. vertex target, same id, no engine vibrate, t >= nextBeatAt: append vibrate(pattern) (a copy);
      lastBeatAt = t; nextBeatAt = nextBeatAt + periodMs, or t + periodMs if that is not after t.
   f. non-vertex target: if a vertex was remembered and t < lastBeatAt + sum(pattern) and
      engineEffects has no vibrate effect, put vibrate(0) first. Forget the vertex.
   Return the engine's effects in their order plus at most one added effect. Never add speak or tone.
   Pure: no DOM, React, window, navigator, timers. Never throw; never mutate inputs.
3. Do NOT edit hapticEngine.ts, hitTest.ts, DEFAULT_HAPTICS, DEFAULT_RADII, screens/, flow/ or
   drivers/. The module is not called by the app until lane hb2.
4. Tests: P120-P127 in frontend/tests/heartbeat.prop.test.ts (fast-check, 200+ runs each), driving
   the real step() and feeding its effects in. One example test on
   frontend/public/samples/triangle.json: rest on B for 3 s at 60 ms steps gives the corner pattern
   at 0 and beats near 900, 1800, 2700; a step onto side BC at 2750 contains vibrate(80) and no
   array pattern. Mutation-check with at least five mutants (beat inside quiet window, beat on a
   line step, missing vibrate(0) on exit, cfg off still beats, period ignored); revert them.
5. Run tsc --noEmit and vitest run; report results, and note in docs/BUILD_LOG.md (tool = Kiro)
   any property that found a real bug. Say plainly that all numbers are untested on a phone.
```

#### KH2. Record the owner's choice (after the phone test)

- Acceptance: `DEFAULT_HEARTBEAT` and the `tech.md` row carry the pattern and period the owner
  chose, with the date and "tested on OnePlus Nord CE6" (and the budget phone if done); the
  PROPOSED mark is removed only if the owner said yes in writing; if the owner said no, the row
  says "rejected" and the switch stays off. Properties still pass (they are generic in the config).

```
Task: record the owner's heartbeat decision. Only start with the owner's written choice in
docs/BUILD_LOG.md (candidate id, pattern, period, phones tested).

Read: docs/reports/fable-heartbeat-plan.md section (d) and (f), .kiro/steering/tech.md,
frontend/src/core/heartbeat.ts.

1. Set DEFAULT_HEARTBEAT.pattern and periodMs to the chosen values. Keep quietMs = 450.
2. Update the heartbeat row in tech.md: chosen values, date, phones. Remove "PROPOSED" only if the
   owner approved; keep "optional, OFF by default" unless the owner asked for default on.
3. If the owner asked to change the ENTRY corner pattern [50, 90, 50] itself, stop and ask: that is
   a tuned-value change in hapticEngine.ts and needs its own explicit approval line.
4. Update the example test's expected times if the period changed. Run tsc and vitest; report.
```

### AGY WORKER TASKS

Lanes own everything outside `frontend/src/core/` and `.kiro/`. No shell commands; the orchestrator
runs the gates (tsc, vitest, build, Playwright). Lane ids: `hb1`, `hb2`, `hb3`.

#### hb1. Debug page: heartbeat candidates and resting pad (first slice; no Explore.tsx)

- Scope: `frontend/src/screens/Debug.tsx`, new `frontend/src/flow/heartbeatDemo.ts`,
  `frontend/src/i18n/index.ts`, debug CSS, `frontend/tests/**`, lane report.
- Acceptance: the six candidates of section (d) each have "Once" and "Repeat"; period buttons
  700 / 900 / 1100; "Line buzz 2 s"; "Line, then corner"; a resting pad that plays the tuned corner
  pattern on pointer down, then beats while held, and calls `vibrate(0)` on up, cancel, leave and
  lost capture; "Repeat" sends one `vibrate` call per beat and stops by itself after 10 s; every
  timer is cleared on Stop, unmount, blur and hidden tab; all controls are 48 x 48 px with
  accessible names; the status line shows the call and its return value; existing debug buttons
  unchanged; no tuned value and no core file changed.

```
You are lane hb1 (debug heartbeat candidates). Do NOT run any shell command, terminal command, npm,
npx, git or script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/screens/Debug.tsx, frontend/src/flow/heartbeatDemo.ts (new),
frontend/src/i18n/index.ts, the stylesheet that holds the .gt-debug rules, frontend/tests/**,
docs/reports/agy-hb1-debug-heartbeat-report.md.
Forbidden: frontend/src/core/** (read only), .kiro/**, tasks.md, .gitignore, any .env file,
package.json, frontend/src/screens/Explore.tsx, frontend/src/flow/explore.ts.

Read first: docs/reports/fable-heartbeat-plan.md sections (c.3) and (d), .kiro/steering/tech.md,
frontend/src/screens/Debug.tsx, frontend/src/drivers/haptics.ts, prototypes/haptics-test.html.

Goal: let the owner feel candidate "heartbeat" corner patterns on the phone and choose one. This is
a test bench only. It must not change how Explore behaves.

Do:
1. flow/heartbeatDemo.ts (pure data and pure helpers, no browser API):
   - HEARTBEAT_CANDIDATES: [{ id: 'H1', pattern: [50, 90, 50], periodMs: 900 },
     { id: 'H2', pattern: [40, 60, 40], periodMs: 800 }, { id: 'H3', pattern: [30, 70, 60], periodMs: 900 },
     { id: 'H4', pattern: [60, 80, 40], periodMs: 1000 }, { id: 'H5', pattern: [40, 120, 80], periodMs: 1000 },
     { id: 'H6', pattern: [70, 110, 70], periodMs: 1100 }], each with an i18n name key.
   - DEMO_PERIODS_MS = [700, 900, 1100]; DEMO_REPEAT_MAX_MS = 10000.
   - patternDurationMs(pattern): sum of entries.
   Mark the file header: "PROPOSED test values, not tuned, not used by Explore".
2. Debug.tsx, a new section under the existing rows:
   - For each candidate: a "Once" button (one drivers.haptics.vibrate(pattern)) and a "Repeat"
     button (vibrate(pattern) now and then every selected period with setInterval; ONE vibrate call
     per beat, never one long pattern array; stops after DEMO_REPEAT_MAX_MS).
   - Period selector: three buttons (700, 900, 1100), aria-pressed on the selected one; default is
     the candidate's own period until the owner picks one.
   - "Line buzz 2 s": vibrate(DEFAULT_HAPTICS.lineMs) every DEFAULT_HAPTICS.retriggerMs for 2 s,
     then vibrate(0). Read the two values from DEFAULT_HAPTICS; do not copy the numbers.
   - "Line, then corner": 1 s of line buzz as above, then vibrate(DEFAULT_HAPTICS.cornerPattern),
     then, one selected period later, start "Repeat" for the last selected candidate.
   - Resting pad: a large (at least 160 x 160 px) element with an accessible name. pointerdown:
     setPointerCapture, vibrate(DEFAULT_HAPTICS.cornerPattern), then one beat of the selected
     candidate every selected period, first beat one period after the down. pointerup,
     pointercancel, lostpointercapture, or a pointermove that leaves the pad's box: clear the timer
     and call drivers.haptics.stop() immediately. touch-action: none on the pad.
   - The existing Stop button also clears every timer of this section.
   - Only one demo runs at a time: starting any demo stops the previous one first.
   - Clear all timers and call drivers.haptics.stop() on unmount, window blur and
     document.visibilitychange to hidden.
   - Status line (the existing role="status" message): show the call and its return value as the
     existing buzz() helper does.
3. All visible text through i18n keys under debug.* in en, hi and gu (follow how the existing
   debug.* keys are done). Use AccessibleButton. Every control at least 48 x 48 px.
4. Do not import anything new from core except what Debug.tsx already imports. Do not change any
   value in core. Do not touch the existing buttons' behaviour.
5. Tests (fake timers, fake VibrateHost): "Repeat" for H1 at 900 ms calls vibrate([50,90,50]) at
   0, 900, 1800 and stops by 10 s; the pad sends the corner pattern on down, a beat one period
   later, and vibrate(0) on up with no call after it; starting a second demo stops the first;
   unmount leaves no timer; every new key exists and is non-blank in en, hi and gu.
6. Report in docs/reports/agy-hb1-debug-heartbeat-report.md: files changed, tests added, anything
   unsure, and copy the owner checklist from the plan section (d) into the report.
```

#### hb2. Settings switch and Explore wiring (needs KH1 merged and the owner's go; edits Explore.tsx)

- Scope: `frontend/src/drivers/storage.ts`, `frontend/src/components/LabSettings.tsx`,
  `frontend/src/flow/explore.ts`, `frontend/src/screens/Explore.tsx`, i18n, tests, report.
- Acceptance: a "Corner heartbeat" switch, stored, **default OFF**, state in `aria-checked`, strings
  in en, hi, gu; with the switch off the `vibrate`, `tone` and `speak` calls of fixed traces on all
  three samples are identical to today (a test proves it, and removing the switch guard turns it
  red); with it on, a still finger on triangle vertex B gets the corner pattern once, the label
  once, and a beat about every period; moving onto BC gives `vibrate(80)` in that step; moving into
  empty space gives `vibrate(0)` in that step; no beat during Ask listening, while Guide is guiding,
  after lift, blur or hidden; the heartbeat state is reset on lift, new touch, pointer promotion
  and scene change.
- Serialize: this lane must run alone on `Explore.tsx`, `flow/explore.ts` and `LabSettings.tsx`.

```
You are lane hb2 (corner heartbeat switch and wiring). Do NOT run any shell command, terminal
command, npm, npx, git or script. Only read and edit files. The orchestrator runs all tests and builds.

Allowed paths: frontend/src/drivers/storage.ts, frontend/src/components/LabSettings.tsx,
frontend/src/flow/explore.ts, frontend/src/screens/Explore.tsx, frontend/src/i18n/index.ts,
frontend/tests/**, docs/reports/agy-hb2-heartbeat-wiring-report.md.
Forbidden: frontend/src/core/** (read only), .kiro/**, tasks.md, .gitignore, any .env file, package.json.

Read first: docs/reports/fable-heartbeat-plan.md sections (c) and (e), .kiro/steering/tech.md,
frontend/src/core/heartbeat.ts (heartbeatStep, DEFAULT_HEARTBEAT, initialHeartbeatState),
frontend/src/flow/explore.ts (processPointerMove, how proximityStep is called and returned),
frontend/src/screens/Explore.tsx (applyMoveResult, the keep-alive onTick, every call of
processPointerMove and of step with a lift, the Ask, Guide, blur and hidden handlers),
frontend/src/drivers/storage.ts (getStoredDirectionsSetting pattern),
frontend/src/components/LabSettings.tsx (the Directions switch).

Do:
1. storage.ts: STORAGE_KEY_CORNER_HEARTBEAT = 'gt_corner_heartbeat_enabled',
   getStoredCornerHeartbeatSetting() (default FALSE when nothing is stored),
   setStoredCornerHeartbeatSetting(enabled), _resetCornerHeartbeatSettingForTesting().
2. LabSettings.tsx: a "Corner heartbeat" switch built exactly like the Directions switch (one fixed
   label, state in aria-checked only, 48 x 48 px). Strings in en, hi and gu. No string may claim
   the feature is tested or approved.
3. flow/explore.ts: processPointerMove takes two more optional arguments at the END of its list,
   heartbeatState (default initialHeartbeatState()) and heartbeatCfg (HeartbeatConfig | null,
   default null). When heartbeatCfg is null do not call heartbeatStep and return the engine's
   effects array untouched. Otherwise call heartbeatStep(heartbeatState, { kind: 'move', t, target,
   engineEffects: effects }, heartbeatCfg) and return its effects as `effects`. Add
   heartbeatState to MovePipelineResult. Keep the function pure. Compute everything else
   (inQuietWindow, proximity) from the ENGINE state exactly as now.
4. Explore.tsx: keep the heartbeat state in a ref. At every processPointerMove call pass the ref and
   (getStoredCornerHeartbeatSetting() ? DEFAULT_HEARTBEAT : null). Store the returned state in
   applyMoveResult. Reset the ref to initialHeartbeatState() on lift, pointer cancel, a new primary
   touch, pointer promotion, scene change, exit and unmount. Do not add any timer: the existing
   keep-alive tick drives the beats.
5. When Ask listening starts, when Guide starts guiding, on blur and on hidden: make sure
   drivers.haptics.stop() is called once so a beat in progress does not run into the microphone.
   If the existing code already does this on a path, leave that path alone and say so in the report.
6. Never call drivers.haptics.vibrate for this feature from the screen. All beats arrive as engine
   effects through runEffects. Do not change any haptic value, hitTest, or the keep-alive interval.
7. Tests (real Explore where the existing tests do so, fake timers, fake VibrateHost):
   - switch OFF: the vibrate, tone and speak calls for a fixed trace on triangle.json, sine.json and
     the bar sample are identical to a run with the heartbeat arguments omitted;
   - switch ON, still finger on vertex B for 3 s: corner pattern once, label spoken once, a beat
     pattern about every DEFAULT_HEARTBEAT.periodMs (within one keep-alive tick);
   - ON, then a move onto side BC: that step calls vibrate(80) and no array pattern after it;
   - ON, then a move into empty space within 100 ms of a beat: that step calls vibrate(0);
   - ON: no vibrate call after lift; none while Ask is listening; none while Guide is guiding;
   - the switch defaults to off; keys present in en, hi and gu; the a11y target-size test covers it.
8. Report in docs/reports/agy-hb2-heartbeat-wiring-report.md: files changed, every
   processPointerMove call site you changed, tests added, anything unsure, and the phone checks
   from the plan section (d) "After lane hb2 lands".
```

#### hb3. Docs (after the owner's phone verdict; no source files)

- Scope: `docs/PHONE_TEST.md`, `docs/DEMO_SCRIPT.md`, lane report.
- Acceptance: PHONE_TEST gains a "Corner heartbeat" block (the checklist of section (d), with blank
  result fields; no invented results); DEMO_SCRIPT mentions the heartbeat only if the owner has
  approved it and turned it on for the demo, otherwise nothing changes there.

```
You are lane hb3 (heartbeat docs). Do NOT run any shell command, terminal command, npm, npx, git or
script. Only read and edit files.

Allowed paths: docs/PHONE_TEST.md, docs/DEMO_SCRIPT.md, docs/reports/agy-hb3-heartbeat-docs-report.md.
Forbidden: frontend/**, backend/**, .kiro/**, tasks.md, .gitignore, any .env file, docs/BUILD_LOG.md.

Read first: docs/reports/fable-heartbeat-plan.md sections (d) and (f), docs/PHONE_TEST.md,
docs/DEMO_SCRIPT.md.

Do:
1. PHONE_TEST.md: add a section "Corner heartbeat (optional, off by default)" with the ten debug
   page checks and the six Explore checks from the plan, each with an empty result field, the phone
   model and the date left blank. Do not write any result yourself.
2. DEMO_SCRIPT.md: only if the orchestrator's prompt says the owner approved the heartbeat for the
   demo, add one sentence where the volunteer rests on corner B ("a slow heartbeat says: still on
   the corner"). Otherwise do not edit this file.
3. Report what you changed in docs/reports/agy-hb3-heartbeat-docs-report.md.
```

Gates after each lane (orchestrator): `tsc --noEmit`, `vitest run`, build, Playwright; `git diff`
empty on `frontend/src/core/hapticEngine.ts` and on the existing `tech.md` rows; BUILD_LOG entry
with the tool that did the work. This report also needs a BUILD_LOG entry (tool: Claude Code,
kind: plan); I was limited to writing this one file.

---

## (f) Owner decisions and phone-only checks

Owner decisions:
1. **Resting heartbeat (recommended) or a new one-shot entry pattern?** The second changes the tuned
   `[50, 90, 50]` and needs an explicit written yes plus a phone test. This plan assumes the first.
2. **Go for hb1 now?** It is a test bench on `#/debug`; no tuned value, no core file, no Explore.
3. **Pick a candidate and a period** after section (d), or say "none". Until then everything stays
   PROPOSED and the switch stays off.
4. **Default off (recommended) or on** once approved. On by default would change the demo feel and
   makes Requirement 4.4's old wording false for every user.
5. **Amend Requirement 4.4** (Kiro does it in KH1; the owner should know the spec changes).
6. **Should the beat ever stop by itself** (for example after 20 s on one corner)? This plan says
   no: the beat means "you are on a corner" for as long as that is true.
7. **Demo:** show the heartbeat in the Kiroween video or keep the demo on the tuned behaviour.
8. Timing against `docs/reports/fable-win-plan.md` (phone test, video, real user first): hb1 and
   KH1 are small; hb2 should not jump ahead of that plan's items.

Phone-only checks (nothing in this file has been felt on a motor):
- Can the beat be told from the line buzz with eyes closed, on the Nord CE6 and on the budget phone?
- Are both pulses felt, or does the motor merge them into one? Are 30 and 40 ms pulses felt at all?
- Does `navigator.vibrate` return true for array patterns on the budget phone, or does the driver
  fall back to one 100 ms pulse per beat?
- Is the beat steady when driven by the 60 ms keep-alive timer (up to 60 ms late per beat)?
- Does the beat really stop the instant the finger leaves or lifts?
- Leaving a corner from rest along an edge: is the line buzz immediate and clean?
- Does the beat under the spoken label and directions distract, or help?
- With TalkBack on: do beats arrive during double-tap-hold-drag, and do TalkBack's own haptics
  confuse the rhythm?
- Does a beat ending as voice listening starts disturb speech recognition?
- Does the phone's vibration setting or Do Not Disturb silence web vibration (unverified here)?
- One blind or low-vision tester resting on a corner with the switch on and off: which do they keep?
