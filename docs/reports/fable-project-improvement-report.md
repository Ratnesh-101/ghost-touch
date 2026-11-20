# Ghost Touch: project improvement report (synthesis of six persona reviews, 2026-11-17)

Tool: Claude Code (Fable, read-only synthesis agent). Base: `main` at `8eda0ac` (the six reviews were
written at `a82f7bf`; the only later commit is a BUILD_LOG entry, so their line numbers still hold).

Sources: the six `fable-persona-*.md` reports (Amara, Verma, Rohan, Judge, SRE, Chaos). Context read
and not repeated: the blind-user, heartbeat and hardening plans, the last BUILD_LOG entry, CLAUDE.md,
`.kiro/steering/*`.

How claims were checked: the evidence for each backlog item was re-read in the current files (grep or
direct read). Nothing was run: no tests, no browser, no phone, no deployed site. No `.env` file was
opened. This task wrote this one file; no source, spec, `tasks.md` or BUILD_LOG change was made.

---

## (a) Verdict

### What Ghost Touch is now

A working Android PWA with a strong pure core, 36 requirements, properties numbered to P136, 213
frontend test files, a hardened backend, and eight Explore additions that landed in two days
(keep-alive, overview, compass, near-line click, where-am-I, graph scan, pacing, page edge) plus two
opt-in ones (heartbeat, stay on line). **None of the new cues has been felt on a phone, and no blind
or low-vision person has used the app.** The engineering is ahead of the evidence.

### Usable or not

- **For a demo on the three samples: yes**, after the P0 Explore fixes below. The core loop (buzz on
  a line, double pulse and a letter at a corner, tone on a curve) is sound and tuned.
- **For a blind student alone: one week, with surprises.** Speech cannot be stopped by lifting, the
  gestures are never taught, Raw Mode reads machine ids, and Short detail cuts labels.
- **For a teacher: not yet.** No teacher path, English first on a Hindi phone, diagram words stay in
  English, the Raw Mode reason is dropped, and a class behind one router is rate-limited as one abuser.
- **For a judge: finalist, not winner.** No video, stale numbers that understate the truth, `[FILL]`
  slots, one in-app overclaim ("TalkBack & touch ready"), a steering file that contradicts the code.

### Top 5 themes across the six reviews

1. **Many voices, no conductor** (Amara, Chaos). Each lane is correct alone; together they talk over
   each other, reuse one sound for two meanings, and override the engine's own rules (scan tone through
   a corner, clicks under speech, Short removing the compass while Directions says on).
2. **Hold services are fragile at the seams** (Chaos). Six features hang off one keep-alive timer that
   never restarts after Guide or Ask; axis and dwell state leak across holds. Lane gates did not see it
   because several tests exercise a copy of the screen glue, not `Explore.tsx`.
3. **Built for a stranger, not a classroom** (Verma, SRE). Per-IP caps, English default, hidden
   teacher tools, 20 unnamed saved diagrams, "never fails" needs a network, no reason given for Raw Mode.
4. **Evidence lags the work** (Judge, all). Docs quote 2,231 tests, 25 requirements, P87, 841 commits;
   the repo has 2,700 passing (BUILD_LOG gate), 36, P136, 898. No phone pass, video or hook firing.
5. **The screen is drawn for observers** (Rohan). A 4 px glowing line, 16 px canvas labels, no
   highlight under the finger, no vision setting; "low-vision" appears in the pitch and nowhere in the product.

### Where reviewers conflict, and the ruling

| # | Conflict | Ruling | Reason |
|---|---|---|---|
| 1 | More cues (blind-user plan, Judge wants them shown) vs less speech (Amara) | **No new cue before Dec 5.** Conduct the existing ones: lift means quiet, one sound per meaning, clicks muted under speech, engine corner rule wins over scan tone | Every surprise Amara lists comes from an added cue; none comes from a missing one |
| 2 | More Settings (Rohan: vision; Amara: quiet mode; Verma: teacher) vs fewer (Amara P5) | **Three presets (Simple, Standard, Explorer) on top, every switch under "More".** New options join a preset, never the top level | Eleven sections are already about thirty TalkBack swipes; presets add capability without adding stops |
| 3 | Short detail = label only (pacing lane) vs Directions (Amara P6) | **Short keeps the corner compass on a first visit**; it drops the overview tail and line names. Kiro amends the pacing requirement | The turn is where a blind tracer gets lost; a switch that says on must be on |
| 4 | "Shared, not checked" (security audits) vs teacher authority (Verma P8) | **Keep "not checked" for links** (they can be forged). Add "Checked by your teacher" only for a diagram saved and marked on the same phone (P2) | Honesty about the channel, respect for the teacher where the channel is trusted |
| 5 | Photo never stored (PRIVACY) vs next-morning verification (Verma P3) | **Opt-in, local only, default off, P2**, with PRIVACY.md updated in the same change | Minors' photos; the default must stay the private one |
| 6 | Correct button for everyone (discoverable) vs hidden from students (Verma P8) | **Gate Correct behind Teacher tools, and stop tying Teacher tools to `VITE_FEATURE_SHARE`** (owner decision 6) | A blind student cannot use an editor they cannot see; it overwrites the teacher's work |
| 7 | Own sound for the page edge (Amara) vs no new untested value (tech.md rule, Chaos) | **P0: speech only at the edge** (remove the `back` earcon there). A dedicated earcon comes later as a PROPOSED row after a phone test | Removes the collision today without inventing a value |
| 8 | Strict per-IP limits (hardening plan) vs classroom NAT (SRE-01) | **Classroom profile as env values the owner picks**; the provider-console spend cap is the real ceiling; the runbook tells teachers to scan once and share | Limits tuned for abuse lock out the target user |
| 9 | Exact-match voice commands (Chaos B9) vs loose phrasing | **A command matches only when the transcript is at most three words or matches exactly**; everything else goes to Ask | A question that silently changes the speech rate is worse than one extra request |
| 10 | Highlight for low vision on by default (Rohan) vs eyes-closed product | **On by default, after the P0 work**, with no low-vision claim in any doc until a low-vision person has tried it | Harmless to blind users, makes the video legible; the claim still needs a person |
| 11 | Heartbeat and sticky were wired before the owner's phone test (tasks 58b, 59b say wait) | **Do not revert.** Both stay off by default and PROPOSED; Kiro makes `tech.md` and `tasks.md` say what the code does | Reverting costs a serialized Explore lane; the dishonesty is in the docs, not the switch |

---

## (b) Ranked backlog (40 items)

Personas: A = Amara, V = Verma, R = Rohan, J = Judge, S = SRE, C = Chaos. Effort: S under half a day
for one lane, M about a day, L more. Owner: Kiro owns `frontend/src/core/**`, `.kiro/**`, property
tests, `backend/app/schema.py` and `validate.py`; agy owns the shell; "owner" means the human.
"EX" marks a lane that edits `Explore.tsx` or `flow/explore.ts` and must be serialized.
All evidence was re-checked at `8eda0ac` unless it says "to confirm".

### P0: before the Kiroween submission (Dec 5, 03:30 IST)

| Id | Title | By | Evidence | Impact | Eff | Owner |
|---|---|---|---|---|---|---|
| I01 | Keep-alive never restarts inside a hold: after Guide arrival, Ask, or one `shouldRun() === false` tick, a resting finger loses line buzz, heartbeat, line name, where-am-I, bar rest and clicks | C (B1) | `flow/explore.ts:770-773` (`update` only stores coords), `:757-760` (stop is final); `Explore.tsx:1928` update, `:1806`, `:2048` the only starts | Six features dead until lift and re-touch; visible in any Guide or Ask demo | S | Kiro oracle, agy fix (EX) |
| I02 | Lift does not stop speech | A (P1) | `Explore.tsx:2051-2065` runs only the engine lift effects; `stopSpeaking` used once, `:667`; entry speech is one long utterance, `flow/navigation.ts:88-108` | The phone finishes a sentence into a quiet classroom; the top reason Amara mutes the app | S | Kiro spec, agy (EX) |
| I03 | Raw Mode speaks machine ids ("Point raw_p17", "Side raw_s4. Up to raw_p3") | A (P3), C (B16), J (25) | `backend/app/raw_mode.py:283`, `:312`; `flow/explore.ts:823` falls back to `toId`; `i18n/index.ts:106`; only `flow/overview.ts:39-40` filters ids, and not `raw_` | The "never leaves you with nothing" path becomes noise; it is a demo shot (2:15) | S | Kiro helper, agy wiring (EX) |
| I04 | Page-edge cue plays the `back` earcon, the same sound as leaving Explore | A (P4), C (B8) | `Explore.tsx:1339` vs `:609`, `:1197` | A drifting finger hears "you left"; ruling 7: speech only at the edge | S | agy (EX) |
| I05 | Short detail cuts labels at the first full stop or comma ("(2.5, 3)" becomes "(2"), and a bar's value waits for 500 ms with zero pointer events | C (B3, B4) | `flow/explore.ts:1242-1258`, `:1323`, `:1373`; `Explore.tsx:1354-1360`, `:1592-1606` | Wrong label spoken; value may never be spoken on a real touchscreen (B4 to confirm on phone) | S | Kiro property, agy fix (EX) |
| I06 | Where-am-I dwell is spent without speaking when other speech is running (always the case right after entry) | C (B6) | `Explore.tsx:1608-1630` and the copy at `:1930-1951`: `nextState` committed before the `isSpeechSpeaking()` guard | The cue Amara calls "the moment I start to trust it" is silent on the first rest | S | agy (EX) |
| I07 | Graph scan tone plays through corners and re-arms on axes, overriding the engine's "a corner stops the tone" | C (B7) | `flow/explore.ts:123-132` excludes only polyline targets; default ON | Tone under a spoken label on the sine demo | S | agy (EX) |
| I08 | Axis side is stale after a Guide: a false "y-axis" is spoken at arrival | C (B2) | `Explore.tsx:1670-1677` returns before `seedAxisState` at `:1706`; lift does not reset `axisState` (`:2051-2065`) | Wrong speech at the moment of arrival; only when Guide is on | S | agy (EX) |
| I09 | The gesture hint is false with TalkBack off, and the Start screen says "TalkBack & touch ready" while every doc says TalkBack is untested in the full app | A (P2), J (13) | `i18n/index.ts:95-97` ("Double-tap and hold, then drag"), `:248`, `:738`, `:1231` | Every demo runs with TalkBack off; the app overclaims where the docs refuse to | S | agy; wording is owner decision 3 |
| I10 | A scene after an idle period is not re-warmed; boot (30 to 70 s) plus processing can pass the 65 s client timeout | S (SRE-11) | `warmBackend()` only at `App.tsx:343`, `flow/ask.ts:309`, `:451`; `api/scene.ts:28` | A judge's first photo on the live site times out | S | agy (Capture, not EX) |
| I11 | Docs truth pass: stale counts and soft claims | J (4.1 to 4.5), R (P10), S (SRE-15), V (P1) | `README.md:149-157`, `docs/KIRO_WRITEUP.md:30`, `BLOG.md:48`, `SOCIAL.md:26,57,100`, `STEMERGENT_APPENDIX.md:51,62,70`; `DEPLOY.md` never mentions `VITE_FEATURE_SHARE` | Stale numbers in honesty documents cost trust; the truth is larger than the claim | S | agy docs lane, numbers from the orchestrator's gate |
| I12 | Steering and tasks contradict the code: `tech.md` says sticky and heartbeat are "not wired into the app"; tasks 58b and 59b are unticked and say "do not start"; both are wired behind off-by-default switches | J (Q12) | `.kiro/steering/tech.md` rows for tasks 58 and 59; `tasks.md:470-491`; `LabSettings.tsx:459-565` | A judge reading `.kiro/` finds it; no value changes, wording only | S | Kiro |
| I13 | Kiro write-up refresh: lead with what Kiro built, add the four `.kiro/agents`, the Nov 15 to 17 Kiro work, the P109 to P113 gap, the two pinned test gaps | J (7.8, 11) | `docs/KIRO_WRITEUP.md:5`, `:30`; `.kiro/agents/`; `tasks.md:444`; `tests/explore.wiring.guards.test.tsx:395` (`it.fails`), `tests/share.decodeBound.test.ts:94` (`it.todo`) | Lowers the "insufficient use of Kiro" risk with facts already in the repo | S | agy docs lane; the vibe-coding paragraph is the owner's |
| I14 | Owner evidence: video, one recorded phone pass, one hook firing, `[FILL]`/`[OWNER]`/`[HW]` slots, team line, blank test sheet | J (7.1 to 7.3, 7.6, 7.15) | Marker counts: `DEMO_SCRIPT.md` 7, `SOCIAL.md` 7, `STEMERGENT_APPENDIX.md` 6, `STEMERGENT_SUBMISSION.md` 5, `KIRO_WRITEUP.md` 4; `docs/kiro-evidence/hooks-check.md`; `docs/OWNER_TEST_SHEET.md` | The largest score movement available; nothing else substitutes | M | owner |

### P1: next

| Id | Title | By | Evidence | Impact | Eff | Owner |
|---|---|---|---|---|---|---|
| I15 | Voice commands swallow real questions ("Which bar grows faster?" sets the speech rate and saves it); voice "where am I" after a lift reports the centre | C (B9, B10) | `flow/commands.ts:234`, `:264`, `:294`, `:322`, `:351`, `:365`; `Explore.tsx:714-716` uses `pendingCursor`, the button uses `lastFingerNormRef` | A question is lost and a setting changes silently | S | Kiro table test, agy fix (EX for the cursor line) |
| I16 | Language on first run: read the phone's language; plain start label in hi and gu ("जीव को जगाएं" reads as "wake the animal") | V (P2, P1) | `i18n/index.ts:29-33` returns `'en'` unless stored; `:736`, `:1229` | A Hindi-medium child hears English first and cannot find the switch alone | S | agy (not EX) |
| I17 | Say why Raw Mode happened and what to do | V (P6) | `api/scene.ts:136-137` parses `reason`; `Capture.tsx` never reads it; `backend/app/main.py:772`, `:844-890` | A teacher retakes the same photo five times on a spent budget | S | agy (not EX) |
| I18 | Settings: three presets on top, all switches under "More"; one naming rule for switches; hints tied with `aria-describedby`; no app speech on open | A (P5, P6), R (8), V (P1) | `LabSettings.tsx:308-690`; Graph scan is named by a status sentence (`:525-527`) unlike its siblings; `i18n/index.ts:256,260` | Thirty swipes become three choices; see section (c) | M | Kiro (pure preset map), agy UI |
| I19 | Any stored value other than exactly `'true'` turns a default-ON switch off; a failed write reverts on the next read | C (B12) | `drivers/storage.ts:67-73` and its copies | Directions, Finding sound and Graph scan vanish with no word | S | agy; Kiro property |
| I20 | First-run practice diagram and a Help button that speaks the gestures for the current mode | A (P2) | No practice sample in `frontend/public/samples/`; `commands.help` (`i18n/index.ts:185`) is reachable only by saying "help" and omits guide and stop | The first diagram stops being the first lesson in five cues | M | Kiro spec, agy (EX for the footer button) |
| I21 | Teacher path: a three-step guide, `DEPLOY.md` documents `VITE_FEATURE_SHARE`, Correct gated behind Teacher tools | V (P1, P8) | `config/features.ts:30-41`; `App.tsx:769` passes `onCorrect` to every user; `Explore.tsx:2337` | A teacher given only the link never finds correction or sharing; a student slips into the editor | S to M | agy; owner decision 6 |
| I22 | Classroom limits profile: per-client in-flight is 2 and unset in `render.yaml`; scenes 20 per minute per address | S (SRE-01) | `backend/app/limits.py:43`, `:378`, `:387`; `render.yaml:60-65` | About two of thirty students get a diagram in the first minute | S | agy backend; owner decision 7 |
| I23 | The service cannot see itself: `app.*` INFO logs are never emitted, health is always `ok` | S (SRE-03) | No `basicConfig`/`dictConfig`/`--log-level` in `backend/app` or `render.yaml:10`; `main.py:541-544` | A mistyped key means Raw Mode for everyone under a green health check | S | agy backend |
| I24 | Ask gives the first provider the whole 10 s; no circuit breaker on the vision chain | S (SRE-08, SRE-02) | `backend/app/ask.py:1037-1039` (no `timeout`); `vision/chain.py:122-162` | One slow provider is a full brownout; the fallback chain is decorative | S to M | agy backend |
| I25 | Near-line click: full pan can vanish in one earbud; clicks never stop on a resting finger or under speech | A (P7), C (B11) | `core/proximity.ts:110-114` (pan to plus or minus 1); `Explore.tsx:1436-1445` has no speech check | The rescue cue disappears on one side; clicks cover the overview | S | Kiro (core, PROPOSED row); owner decision 4 |
| I26 | Two readers under TalkBack: overlay focus speaks through the app while TalkBack reads the same label; Raw notice is a live region and also spoken; a side's button is its bounding box | A (P8) | `Explore.tsx:2082-2103`, `:2136-2168`, `:2194-2199` | Overlapping voices; breaks Requirement 13.7. Needs a TalkBack session before any change | M | owner phone check first, then agy (EX) |
| I27 | The app never says the picture came from AI; only the first disagreement is spoken | A (P9) | `flow/navigation.ts:44-55`, `:88-108` | A self-consistent wrong diagram sounds as sure as a right one | S to M | Kiro spec (once per scene), agy |
| I28 | Classroom safety: a palm can trigger the two-finger exit with no undo; the typed question box exists only after voice fails | A (P10) | `flow/explore.ts:460-480`; `Explore.tsx:404`, `:1822-1830`; `drivers/speech.ts:138` | Lost diagram mid-trace; a student must speak aloud in class | S | Kiro (gesture property), agy (EX) |
| I29 | Low-vision quick wins: dark outline on dot, cursor and guide ring; visible canvas and status-card border; "show me" highlight of the touched element | R (P3, P4, table) | `Explore.tsx:971-973`, `:1051`, `:1081-1092`; pulse ring only for the fallback driver, `:428-446`, 120 ms | Sight and touch finally agree; the video becomes readable | S to M | agy (EX) |
| I30 | Hindi and Gujarati wording fixes and the missing-voice notice (says "GU", not the language, and not how to install it) | V (P10) | `i18n/index.ts:541-649`, `:1385`; `drivers/speech.ts:314-317`; keys are complete (425 in each of en, hi, gu, counted) but unreviewed | Reads like a software manual; an old phone with no Gujarati voice gives no help | S | agy for the table; native review is the owner's |
| I31 | The diagram's own words stay English: no language goes to the AI, no language line in the prompt | V (P4) | `api/scene.ts:165` (image only); `backend/app/vision/prompts.py` has no language instruction | A Hindi voice reads "hypotenuse AC"; half the app is Hindi | M | agy backend and client; Kiro property (ids never change with language) |
| I32 | Tests that cannot fail: keep-alive and graph-scan tests drive a copy of the screen glue; "defined and non-empty" i18n checks; P109 to P113 untested | C (4, 5), J (3) | `tests/explore.keepAlive.test.ts:84-100`, `tests/graphScan.test.ts:190-232`; `tasks.md:444` | The gates passed while B1 to B7 existed | M | Kiro |
| I33 | A red `main` still deploys; deploys cut live requests | S (SRE-10) | `render.yaml` has no deploy trigger and no `--timeout-graceful-shutdown` (`:10`) | A bad merge reaches students; a daytime deploy looks like a network error | S | agy YAML; the Render key name is to confirm (owner) |

### P2: later

| Id | Title | By | Evidence | Impact | Eff | Owner |
|---|---|---|---|---|---|---|
| I34 | Raw Mode has a 2.5 s reserve on a free instance; quadratic de-dup; slot released before the thread ends | S (SRE-07) | `backend/app/main.py:76`; `raw_mode.py:46-70` | The promised fallback may 504 exactly when AI timed out; measure first | M | agy backend |
| I35 | Explore leftovers: Stay on line makes narrow bar interiors unreachable; moves during Ask listening advance state with no effects; late centre tick; scene swap resets two of nine states; duplicated handlers; six 15-argument calls | C (B5, B13 to B15, section 2) | `core/sticky.ts:74-90` (bar falls through to the held edge); `Explore.tsx:472-488`, `:490-515` vs `:1209-1258` | Off-by-default or low-frequency; the options object removes a whole bug class | M | Kiro (sticky, spec), agy cleanup (EX) |
| I36 | Teacher verification: keep the photo on the phone if asked; "Checked by me" flag; check-before-hand-over screen | V (P3, P8) | `App.tsx:604`, `:634`, `:708` clear the photo; saved entries hold a thumbnail only | Next-morning checking without the textbook | M | Kiro (saved model), agy |
| I37 | Saved diagrams for a term: rename, date, higher cap, export and import, Raw results cannot evict prepared work; then a teacher-checked chapter pack | V (P7, P5) | `core/savedDiagrams.ts:37` (cap 20); `screens/SavedDiagrams.tsx` | One chapter becomes a term; packs remove most photo and quota problems | M to L | Kiro (core), agy; a human teacher checks every pack diagram |
| I38 | Visual profile: stroke width, label size, glow off, Atkinson labels with a backing plate, bar and axis text, caption sheet, landscape layout | R (P1, P2, P5 to P9) | `Explore.tsx:936-1063`; `explore.css:20-35`, `:214-226`; dead rule `global.css:1572-1576` | Makes "low-vision" true; joins the Explorer and Low-vision presets | M | Kiro (label placement property), agy |
| I39 | Backend under load: budget charged for failures, bare 503 without CORS at the uvicorn limit, no `Retry-After` on rate-limit 429, no client jitter, late in-flight acquire, CPU work on the event loop, one frozen schema version | S (SRE-04 to 06, 09, 12, 14, 15) | `limits.py:316-329`; `render.yaml:10`; `api/scene.ts:185-198`; `schema.py:84` | Each fails live with no alert; none is a data-loss bug | M | agy backend; Kiro for `schema.py` |
| I40 | Sharing and offline for real schools: WhatsApp-shaped message, file for long diagrams, a set per chapter, offline photo queue | V (P9, P5) | `share/limits.ts:10`, `:14`; `flow/capture.ts:80-85` | Matches how a school actually passes things around | M to L | Kiro spec, agy |

Carried from earlier plans, still open, not counted above: the share-decode bound fix (task 63: 12,000
characters expand to about 19 M; an `it.todo` pins it), provider spend caps, the fail-open
`PAID_CALLS_PER_CLIENT_PER_DAY` parse. Corrections to the reviews: no hi or gu key is missing (425
each), so "Hindi completeness" is wording and content; the commit count is 898; the backend test
count stays unverified (pytest was not run here).

---

## (c) Make it usable in a real classroom for one week

Target: a teacher prepares at home on wifi; students use their own phones in class on a weak signal.
The smallest set that gets there: **I01 to I10, I16, I17, I18, I21, I22**. The rest is a stretch.

### 1. Defaults for a first-time user

| Setting | Today | First run | Why |
|---|---|---|---|
| Language | English always | Phone language if `hi` or `gu`, else English; one spoken line offers the other two (I16) | No adult needed to set up a phone |
| Preset | none (eight switches) | **Standard** | See presets below |
| Speech detail | Full | Full; Short keeps the corner compass (ruling 3) | The turn is where a tracer gets lost |
| Finding sound | On, full pan | On; pan limited once owner decision 4 is made (I25) | One earbud in class |
| Graph scan | On | On, silent on corners (I07) | Engine rule 1 |
| Stay on line, Corner heartbeat | Off | Off until felt on the Nord CE6 and a budget phone | PROPOSED values, `tech.md` |
| Centre word and tick | On, no switch | Owner decision 5; recommended off outside the Explorer preset | Unasked speech; the tick is still "proposed" in `tech.md` |
| Entry speech | Overview + two hints every time | Overview + a true hint once per diagram; title only on return (I09, stretch) | Ten repeated words per visit |

### 2. Presets instead of switches (I18)

Three large radio buttons at the top of Settings; the current switches move under one "More settings"
button and keep working. A hand-set switch shows the preset as "Custom".

| Preset | For | Speech | Directions | Finding sound | Graph scan | Stay on line | Heartbeat |
|---|---|---|---|---|---|---|---|
| **Simple** | first week, class use | Short (label + compass on first visit) | On | Off | Off | Off | Off |
| **Standard** (default) | most students | Full | On | On | On | Off | Off |
| **Explorer** | confident users, after the phone test | Full | On | On | On | On | On |

Explorer stays hidden or marked "experimental" until the owner has felt sticky and heartbeat on a
phone. A later "Low vision" preset (I38) and a "Quiet" option attach here, not as new switches.

### 3. Three-step teacher path (I21, I17, I36)

1. **At home, on wifi: photograph and check.** Turn on Teacher tools (documented; no longer needs the
   share build flag). Take the photo; if Raw Mode comes back, the phone says why and what to do (I17).
   Press Correct, fix a label over the photo.
2. **Save and name.** Today: auto-save, pin the ones for tomorrow (cap 20, enough for a week of one
   class). Stretch: rename and "Raw results cannot evict pinned or prepared work" (I37).
3. **Hand over or send.** Hand the phone to the student with Teacher tools off (Correct hidden, I21),
   or send the share link. The guide says: one scan by the teacher, thirty opens by students, zero
   backend calls (this also sidesteps I22 on a school router).

The guide is one page (`docs/TEACHER_GUIDE.md`, new, by a docs lane) in en, hi and gu, with a "before
class" list: volume up, vibration on, battery saver off, open once on wifi, no faces in the photo.

### 4. First-run learning of gestures (I09, I20)

- P0 (I09): the entry hint is true without TalkBack ("Drag one finger to feel the diagram."); the
  double-tap wording lives only where TalkBack reads it.
- P1 (I20): a fourth sample, "Practice", about 60 seconds, spoken between steps: find the line,
  follow it, feel a corner, hear the direction, drift and hear the clicks, hold still, **lift for
  quiet**, ask one question. Offered once on first launch, then from Help.
- P1 (I20): a Help button in the Explore footer speaks the gestures for the current mode, including
  "guide me to" and "stop". The footer already wraps at 360 px, so fold Correct and Where am I into
  "More" (check with the e2e layout spec).

### 5. Hindi and Gujarati completeness

| Layer | State (checked) | Needed for the week | Item |
|---|---|---|---|
| UI keys | 425 keys in each of en, hi, gu; none missing | nothing | none |
| UI wording | machine-translated; spelling and number errors listed by Verma | fix the eight listed lines; then one native maths teacher per language | I30, owner |
| First run | English until changed inside Settings | phone language, plain start label | I16 |
| Diagram content | title, labels, facts in English regardless of language | language sent with the photo; point ids and printed measurements unchanged | I31 (P1, after the week if needed) |
| Voices | missing-voice notice shows a code | name the language, say how to install, offer Hindi before the default | I30 |
| Ask | already answers in the chosen language (`ask.py`) | nothing | none |

### 6. Offline

Works today with no network (read in code, not tried on a phone): the three samples, saved diagrams
and a share link on a phone that has opened the app before. Does not: a new photo, Raw Mode, Ask.
The week needs only honesty about that: the teacher guide says "prepare on wifi; a new photo needs
signal", the offline sentence mentions saved diagrams as well as samples, and the docs stop saying
"never fails" without "online" (I11). A photo queue and on-phone outlines are I40.

### Acceptance for "usable for a week" (owner, on phones)

A teacher phone and a student phone, Hindi chosen by the phone's language. The teacher prepares five
diagrams at home, corrects one label, pins them. Next day, mobile data off, the student opens all
five, traces each eyes-closed, lifts to silence the voice, and never hears an id starting `raw_`.
Count the surprises; fewer than three is a pass.

---

## (d) Worker plans

### Shared rules

Serialization: **every lane marked EX edits `frontend/src/screens/Explore.tsx` or
`frontend/src/flow/explore.ts` and runs alone, one after another, in the order ux1, ux2, ux3, then
the P1 EX lanes.** No other lane may touch those two files. `frontend/src/i18n/index.ts` is shared:
each lane adds its keys in en, hi and gu and changes no existing key except the ones it names; the
orchestrator merges lanes that touch it one at a time. `frontend/src/core/**`, `.kiro/**` and
`*.prop.test.ts` are Kiro only. Before any launch re-check `git log`, `git status` and running lanes:
Kiro and a second Claude session share this checkout. Oracle protocol: Kiro commits each failing
oracle as `it.fails`; when a lane makes one pass, the orchestrator changes that one word to `it` in
the merge (test-only) and logs it. A lane never edits Kiro's test files.

Paste this block at the top of every agy prompt:

```
UX RULES (agy):
- Do NOT run any shell command. No npm, npx, node, python, pytest, ruff, git, curl. The orchestrator runs all gates.
- Do NOT open, read, create or edit any .env file (any name starting with .env, including .env.example).
- Do NOT edit: frontend/src/core/**, any *.prop.test.ts, backend/app/schema.py, backend/app/validate.py, frontend/src/types/scene.gen.ts, .kiro/**, .gitignore, or any path outside the ALLOWED list of this lane.
- Explore.tsx and flow/explore.ts may be edited ONLY if this lane's ALLOWED list names them (EX lanes).
- Do NOT change any tuned or PROPOSED haptic or audio value (.kiro/steering/tech.md). Do NOT add a dependency or a paid service.
- Browser APIs only in frontend/src/drivers/. Every new spoken or shown string goes through i18n with en, hi, gu.
- Every new control: accessible name, at least 48x48 px, state changes spoken.
- Do not weaken, skip or delete an existing test. If a Kiro test must change, write it under "Needs from Kiro".
- If the task cannot be done inside ALLOWED paths, stop and write why in your report.
- End with docs/reports/agy-<lane>-report.md: files changed, tests added, what you could not verify.
```

### Suggested order

| Slice | Work (parallel inside a slice unless noted) | Why here |
|---|---|---|
| **1** | K-U1 (spec and failing oracles), K-U3 (steering truth), ux5 (warm on Capture), ux6 (docs truth), ux7 (write-up) | No Explore edits; closes the honesty items; gives the EX lanes their tests |
| 2 (EX, serial) | ux1, then ux2, then ux3; K-U2 lands before ux3 | The eight Explore P0 bugs, three small lanes, each turning Kiro's oracles green |
| 3 | ux4 (hint and Start copy), then the owner's phone pass and the video | Film only after slice 2; I14 depends on it |
| 4 | K-U4, K-U5; ux8, ux9, ux11, ux12 in parallel; ux10 after K-U5 | Top P1: language, Raw reason, classroom limits, observability, presets |
| 5 (EX, serial) | commands fix (I15), Help and practice (I20), highlight (I29), exit guard (I28) | One lane each; prompts written from Kiro's spec at that time |

Slice 1 is the suggested first slice: five jobs, none blocked, none touching Explore.

### KIRO WORKER TASKS

Rules for every Kiro task: spec first (requirement, design note, property numbers, task entry; next free are Requirement 37, P137, task 67, re-check before use). Tests in `frontend/tests`. Never push.
Never change a value in `.kiro/steering/tech.md`. Log in `docs/BUILD_LOG.md`. Gate: `npx tsc --noEmit` and `npx vitest run`.

**K-U1 · Spec and failing oracles for the Explore P0 fixes (I01, I02, I04 to I08)** · slice 1
Scope: `.kiro/specs/ghost-touch/*`, `frontend/tests/explore.p0.oracles.test.tsx` (new, real `Explore` with fake drivers, in the style of `explore.wiring.guards.test.tsx`), `frontend/tests/pacing.short.prop.test.ts` (new).
Acceptance: every oracle fails on `8eda0ac` for the stated reason and is committed as `it.fails` with the item id in its name; properties run 200+ times; no `src` change.
```
Task: write the spec and the failing tests for seven Explore bugs; do not fix them (agy lanes ux1 to ux3 will).
Spec first: new requirements (next free numbers) for
 (a) "Lift means quiet": WHEN the last finger lifts THEN exploration speech SHALL stop within 400 ms; an Ask answer in progress SHALL NOT be cut; a re-touch within 300 ms SHALL NOT cut a label.
 (b) "Hold services survive Guide and Ask": WHILE a finger is down and neither Guide nor Ask is active, keep-alive ticks SHALL run, whatever stopped them earlier in the same hold.
 (c) "One sound, one meaning": the page-edge cue SHALL NOT play the earcon used for leaving Explore.
 (d) Amend the speech-pacing requirement: Short detail speaks a corner or bar label unchanged (no cut at '.', ',', '!', '?' or danda), keeps the corner compass on a first visit, and speaks a bar's value after 500 ms with less than 20 px of movement (not zero pointer events).
 (e) Where-am-I on rest is spoken once other speech ends; a dwell is never consumed silently.
 (f) Graph scan tone is null on a vertex target and never re-arms a tone the engine just stopped.
 (g) Axis side is re-seeded at the start of every hold and after a Guide ends.
Tests (real Explore, fake drivers, fake timers), each it.fails today:
 1. start, Guide start, pointerdown, arrive, 1 s still on a line: at least one vibrate(80) after arrival.
 2. corner speech running, all fingers up, advance 400 ms: speech.stopSpeaking called; not called during an Ask answer.
 3. finger leaves the canvas edge: playEarcon('back') not called; the edge sentence is spoken.
 4. fast-check: for any label string, paceSpeech(source 'corner', detail 'short') returns it unchanged; same for bars with the label passed separately from the value.
 5. Short, enter a bar within 700 ms of another, then 1 px jitter moves for 600 ms: the value is spoken.
 6. overview speaking for 3 s, finger resting in empty space: where-am-I is spoken within 1.5 s of speech ending.
 7. scanTone(graph, vertex target, x, y) === null; no setTone with a frequency while the target is a vertex.
 8. sine sample: hold left of the y-axis, lift, guide to a point on the right, arrive, one move: no "y-axis" spoken.
Do not change src, any tuned value, or tech.md. Log each oracle and why it fails in BUILD_LOG.md.
```

**K-U2 · Speakable names (I03)** · before ux3
Scope: `frontend/src/core/speakable.ts` (new), `frontend/tests/speakable.prop.test.ts`, spec files.
Acceptance: pure, total, no i18n; properties at 300 runs; mutation check logged.
```
Task: one pure rule for "may this id be spoken". Spec first: requirement "An element with no label is described, never named by its id, when the id is machine-made", properties, task entry. Create core/speakable.ts exporting isMachineId(id: string): boolean (true for ids starting raw_, point_, pt_, seg_, line_, poly_, bar_ followed by digits, and for any id longer than 12 characters or containing an underscore and a digit) and speakableName(label: string | undefined, id: string): string | null (the trimmed label when non-empty; else the id when it is not a machine id; else null).
Properties: total (never throws for any string); every label wins over its id; single letters and short textbook names (A, B', P1, O) are speakable; every id produced by the backend raw_mode naming (raw_p<n>, raw_s<n>) is not.
Do not edit flow/ or screens/; an agy lane wires it. No tuned value changes.
```

**K-U3 · Steering and tasks say what the code does (I12)** · slice 1
Scope: `.kiro/steering/tech.md` (wording of the three PROPOSED rows only), `.kiro/specs/ghost-touch/tasks.md` (58b, 59b), `docs/BUILD_LOG.md`.
Acceptance: no number in `tech.md` changes; the rows keep "PROPOSED, not phone-tested"; "not wired into the app" becomes "wired behind a Settings switch that is OFF by default (lanes bu12, hb2)"; 58b.1 to 58b.3 and 59b.1 to 59b.3 are ticked only if Kiro verifies each against the code, and 58b.4 and 59b.4 (phone tests) stay open; the "do not start before" notes are replaced by a dated sentence that the wiring landed early.
```
Task: make .kiro tell the truth about sticky line and corner heartbeat. Read LabSettings.tsx, flow/explore.ts and Explore.tsx to confirm both are wired behind switches that default to off. Then edit tech.md wording only (every number and pattern stays byte-identical), and update tasks 58b and 59b: tick a sub-task only after checking its acceptance text against the code and tests; leave the phone-test sub-tasks open; add one dated line saying the wiring landed before the owner's phone test and both features remain off by default. Log it in BUILD_LOG.md.
```

**K-U4 · Properties for commands, stored switches and the hold soak (I15, I19, I32)** · slice 4
Scope: `frontend/tests/commands.table.test.ts`, `frontend/tests/storage.bool.prop.test.ts`, `frontend/tests/explore.soak.prop.test.tsx` (all new), P109 to P113 from task 56.2, spec files.
Acceptance: the table test and the storage property fail today and are pinned as `it.fails`; the soak finds I01 before ux1 and passes after it; P109 to P113 exist or task 56 says why not.
```
Task: three tests the gates were missing. Spec first.
1. Table test: twenty real questions containing help, faster, slower, describe, repeat, next corner (for example "Which bar grows faster?", "Can you help me find AB?", "Describe angle B") parse as unknown; the bare commands in en, hi, gu still parse. Rule to specify: a command matches only an exact phrase or a transcript of at most 3 words.
2. fast-check over any string in storage: each boolean setting getter returns its documented default unless the value is exactly 'true' or 'false'; after a failed write the in-memory value wins.
3. Soak (real Explore, fake drivers and timers, about 60 simulated seconds): random moves, lifts, blur, hidden, Ask start and stop, Guide start and arrive, and the six switches. Invariants: no vibrate or tone while lifted; no tone while Ask listens; after any sequence ending with the finger down on a line and 300 ms still, a line buzz happened in the last 200 ms.
4. Finish task 56.2 (P109 to P113) or record in tasks.md why a property cannot be written.
Keep failing seeds as pinned examples. No src change, no tuned value change.
```

**K-U5 · Settings presets, pure half (I18)** · slice 4
Scope: `frontend/src/core/presets.ts` (new), `frontend/tests/presets.prop.test.ts`, spec files.
Acceptance: pure data and functions; properties at 200 runs.
```
Task: presets as pure data. Spec first: requirement "Three presets set every Explore switch at once; a preset never turns on a feature whose values are PROPOSED unless the user picked Explorer", properties, task entry. core/presets.ts exports type PresetId = 'simple' | 'standard' | 'explorer', type ExploreSettings (speechDetail, directions, findingSound, graphScan, stickyLine, cornerHeartbeat), PRESETS: Record<PresetId, ExploreSettings> (Simple: short, on, off, off, off, off. Standard: full, on, on, on, off, off. Explorer: full, on, on, on, on, on), applyPreset(id), and presetOf(settings): PresetId | 'custom'.
Properties: presetOf(applyPreset(id)) === id; Standard equals today's shipped defaults (read them from the storage getters' documented defaults, do not guess); only Explorer has stickyLine or cornerHeartbeat on; presetOf is total.
No storage, no React, no i18n. The agy lane ux10 builds the UI.
```

### AGY WORKER TASKS

Each prompt starts with the UX RULES block. The orchestrator runs the gates. Frontend: `tsc --noEmit`, `vitest run`, `build`, and **Playwright for every EX lane** (only it caught the T66 regression).
Backend: `pytest`, `ruff check`, `ruff format --check`.

**ux1 · Hold lifecycle (I01, I06, I08)** · EX, serialized, first · needs K-U1
Acceptance: K-U1 oracles 1, 6 and 8 now pass (the lane reports them; the orchestrator flips `it.fails`); no change to vibrate or tone calls on the three recorded sample traces; Playwright 22 of 22.
```
[UX RULES]
LANE ux1 (EX): three hold-lifecycle bugs. Smallest change for each; no refactor.
ALLOWED: frontend/src/screens/Explore.tsx, frontend/src/flow/explore.ts, frontend/tests/explore.holdLifecycle.test.tsx (new).
DO:
1. flow/explore.ts createHoldKeepAliveTimer: update(coords, now) must restart the interval when timer === null (same body as start, without the leading stop). The screen still decides when update is called.
2. Explore.tsx where-am-I dwell (both copies, near 1608 and 1930): commit dwellResult.nextState only when the sentence was actually spoken; when speech is running keep the state armed so it fires when speech ends. Move the two copies into one local function.
3. Explore.tsx pointerdown, guiding branch (near 1670): seed axisState with seedAxisState(norm, scene.axes) and reset pageEdgeState before returning. Also reset axisState in the all-fingers-up branch.
TESTS (real Explore, fake drivers, fake timers): guide arrival then 1 s still gives a line buzz; a dwell during a 3 s utterance speaks after it ends, once; no "y-axis" on arrival after a guide across the axis.
Do not touch any tuned value, the engine, or other lanes' switches.
```

**ux2 · Quiet and clean speech (I02, I04, I05)** · EX, serialized, after ux1 · needs K-U1
Acceptance: K-U1 oracles 2 to 5 pass; an Ask answer is never cut by a lift; the edge sentence is still spoken; status-line height unchanged (Requirement 25.4, Playwright).
```
[UX RULES]
LANE ux2 (EX): lift means quiet, the edge has no exit sound, Short detail stops cutting labels.
ALLOWED: frontend/src/screens/Explore.tsx, frontend/src/flow/explore.ts, frontend/tests/explore.quietSpeech.test.tsx (new).
DO:
1. All-fingers-up branch (near 2051): after the existing lift effects, schedule drivers.speech.stopSpeaking?.() 300 ms later; cancel that timer on the next pointerdown; skip it while an Ask answer is being spoken or leaving is true. Clear the timer on unmount.
2. Page-edge cue (near 1339): remove the playEarcon('back') call there. Keep the spoken edge sentence. Do not add a new earcon (a new sound needs the owner's approval).
3. Short detail: in paceSpeech, a corner label is spoken unchanged (delete the cut at the first '.', '!', '?', danda). For bars, pass label and value as separate fields from the screen instead of re-parsing "label, value" at the first comma. Keep the corner compass in Short on a first visit (delete the block near 1411 that empties afterAnnouncements), as Kiro's amended requirement says.
4. Bar rest: count a pointermove as movement only when it is 20 px or more from the rest anchor (reuse WHERE_AM_I_REST_MAX_MOVE_PX); smaller moves must not push lastMoveTime forward.
TESTS: lift during corner speech stops it after 300 ms and a re-touch at 200 ms does not; label "(2.5, 3)" and bar "Q1, 2024" are spoken whole in Short; 1 px jitter for 600 ms on a bar speaks its value; edge crossing plays no earcon.
```

**ux3 · Raw Mode names and scan tone (I03, I07)** · EX, serialized, after ux2 · needs K-U2
Acceptance: on a Raw Mode scene of 300 segments no spoken or status text contains `raw_`; corners say the new generic word; buzz, corner pattern, clicks and edge cue are unchanged; K-U1 oracle 7 passes.
```
[UX RULES]
LANE ux3 (EX): never speak a machine id; scan tone respects corners.
ALLOWED: frontend/src/screens/Explore.tsx, frontend/src/flow/explore.ts, frontend/src/flow/commands.ts, frontend/src/flow/overview.ts, frontend/src/i18n/index.ts, frontend/tests/explore.rawNames.test.tsx (new).
DO:
1. Use speakableName / isMachineId from frontend/src/core/speakable.ts (Kiro's; do not edit it) everywhere an id can reach speech or the status line: the vertex label fallback ('vertex.unlabelled'), cornerCompass clauses (flow/explore.ts near 823: when the target has no speakable name say only the direction), lineName, whereAmI in commands.ts, and the overview filter (replace its point_/pt_ check with isMachineId).
2. New i18n keys in en, hi, gu: 'vertex.unnamed' ("Corner"), 'line.unnamed' ("Line"), used when speakableName is null.
3. scanTone (flow/explore.ts near 123): return null when target.kind === 'vertex'. In the screen, do not call setTone from the scan branch in a move where the engine emitted tone(null) for a vertex.
TESTS: a 300-segment raw scene traced for 30 simulated seconds speaks no string matching /raw_|point_|pt_/; the triangle sample speaks exactly what it spoke before (snapshot of speak calls on a fixed trace); scan tone is silent on a labelled graph point.
```

**ux4 · True hint and honest Start copy (I09)** · not EX · slice 3
Acceptance: entry speech with TalkBack off contains no "double-tap"; the Start sub-hint makes no readiness claim; hi and gu updated; existing navigation tests updated only where they assert the old sentence.
```
[UX RULES]
LANE ux4: say only what is true. ALLOWED: frontend/src/i18n/index.ts, frontend/src/flow/navigation.ts, frontend/src/screens/Start.tsx, frontend/tests/navigation.hint.test.ts (new).
DO: 1. 'explore.gestureHint' becomes "Drag one finger to feel the diagram." (en, hi, gu). Add 'explore.gestureHintTalkBack' with the double-tap-and-hold wording and use it only for the canvas accessible description (the text TalkBack reads), never in the app's own speech.
2. 'lab.start.subhint' becomes "Touch, sound and speech" (en, hi, gu); the owner may reword.
3. Do not change any other key. TESTS: buildEntryAnnouncement output has no "double-tap" in any language; the canvas description still carries the TalkBack wording.
```

**ux5 · Warm the backend from Capture (I10)** · not EX · slice 1
Acceptance: `warmBackend()` is called when Capture mounts and when a file is picked (before downscale); a first-attempt scene timeout with no response is retried once inside a 120 s outer budget with "Waking the server" spoken; samples still load with no network call.
```
[UX RULES]
LANE ux5: remove the cold-start gap on the scene path. ALLOWED: frontend/src/screens/Capture.tsx, frontend/src/flow/capture.ts, frontend/src/api/scene.ts, frontend/src/i18n/index.ts, frontend/tests/capture.warm.test.tsx (new).
DO: call warmBackend() (frontend/src/api/health.ts, do not edit) on Capture mount and at the start of the photo handler; never await it. In the scene request, treat a first-attempt timeout with no response as "waking": speak the new key 'capture.waking' (en, hi, gu), retry once, total wait at most 120 s; a second timeout is the existing error. Add 0 to 30 percent random jitter to the existing Retry-After wait. Picking a sample must make no fetch.
TESTS with a fake fetch: mount warms once; pick warms; timeout then success yields a scene and one 'waking' announcement; timeout twice yields the existing timeout error; sample path makes zero calls.
```

**ux6 · Docs truth pass (I11)** · docs only · slice 1 · the orchestrator fills the numbers block first
Acceptance: no occurrence of 2,231, 181 files, P1 to P87, P1 to P57, 25 requirements, 42 tasks, 841 commits, `gemini-3.8-flash`; every count carries its date; no new claim without a file to point at.
```
[UX RULES]
LANE ux6: make every number and claim in the public docs true today. Edit text only.
ALLOWED: README.md, docs/BLOG.md, docs/SOCIAL.md, docs/STEMERGENT_APPENDIX.md, docs/DEMO_SCRIPT.md, docs/DEPLOY.md, docs/PRIVACY.md. FORBIDDEN: docs/STEMERGENT_SUBMISSION.md (it may already be submitted; owner decision 1), docs/BUILD_LOG.md, and every [FILL], [OWNER] and [HW] slot (leave each exactly as it is).
NUMBERS (pasted by the orchestrator from its own gate run on <date>; use exactly these, invent none): frontend tests <N> in <N> files; backend tests <N>; Playwright <N>; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits <N>, of which <N> carry the kiro: prefix.
DO:
1. Replace every stale count with the block above, one sentence per document, each with the date.
2. Phone status, same sentence everywhere: "The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype."
3. README "How it feels": add one line: "Experimental, off by default or awaiting a phone test: corner compass, where-am-I, near-line click, graph scan, stay on line, corner heartbeat. Their values are proposals, not tuned."
4. Soften: "never leaves the student with nothing" to "still gives outlines to follow when online, even if rough"; "works offline" to "samples and saved diagrams work offline; a new photo needs the server"; "without hallucination" to "geometry questions are answered by code; others go to the model with the facts"; "WCAG AAA" to "colour tokens are tested at 7:1 or more"; "never written to server disk" to "not stored; a large upload may pass through a temporary file that is deleted when the request ends". Name only the models render.yaml sets.
5. Low vision: wherever "blind and low-vision" is used as a feature claim, add once: "Low-vision students use the same touch and sound; the screen has no large-print or contrast options yet."
6. DEPLOY.md: document VITE_FEATURE_GUIDE and VITE_FEATURE_SHARE and that Teacher tools are hidden without the latter.
7. DEMO_SCRIPT.md: mark the 2:00 TalkBack shot and the 2:30 hook shot "film only if recorded evidence exists"; change "Kiro authored ... hooks" to "Kiro and Antigravity wrote the hooks".
Report every sentence you changed, old and new.
```

**ux7 · Kiro write-up refresh (I13)** · docs only · slice 1, after ux6 (both edit `README.md`)
Acceptance: opens with what Kiro built, then what it did not; counts from the ux6 numbers block; one paragraph on `.kiro/agents/`; the Nov 15 to 17 Kiro tasks (58 to 66) listed with task numbers; the two pinned gaps and the P109 to P113 gap stated; P83 stays the lead bug story; the `[OWNER]` vibe-coding slot untouched.
```
[UX RULES]
LANE ux7: bring the Kiro write-up up to date without adding a single unverifiable claim.
ALLOWED: docs/KIRO_WRITEUP.md, README.md (the "Built with" table and "Project structure" list only).
DO: reorder the opening: first "Kiro wrote the specification, every module in frontend/src/core and every property test; other agents may not edit those files (AGENTS.md rule 1)", then "Kiro did not build most of the screens". Replace the counts paragraph using the numbers block from lane ux6. Add: the four Kiro CLI agents (gt-fixer, gt-writer, gt-reviewer, gt-auditor) and their allow-lists; tasks 58 to 66 with one line each, read from tasks.md; "Two known gaps are pinned in the suite as an expected failure and a todo"; "P109 to P113 are specified and not yet tested (task 56)". Keep the disclosure of trust-all-tools runs. README: shorten each "Built with" cell to one sentence plus a link to the write-up; add .kiro/agents/ to the structure list. Leave every [OWNER] slot as it is.
```

**ux8 · Language on first run (I16)** · not EX · slice 4
Acceptance: with nothing stored and `navigator.language` starting `hi` or `gu`, the app starts in that language; a stored choice always wins; `getStoredLang` stays free of browser APIs beyond the existing safe storage read (the locale read lives in `drivers/`); the Start label in hi is "शुरू करें" and in gu "શરૂ કરો"; English keeps "Wake the creature".
```
[UX RULES]
LANE ux8: a Hindi phone starts in Hindi. ALLOWED: frontend/src/i18n/index.ts, frontend/src/drivers/locale.ts (new), frontend/src/screens/Start.tsx, frontend/src/flow/start.ts, frontend/tests/locale.firstRun.test.ts (new).
DO: drivers/locale.ts exports deviceLang(): 'en' | 'hi' | 'gu' from navigator.languages (first match on the prefix, else 'en'), inside try/catch. On start, when no language is stored, use deviceLang() and store nothing until the user chooses. After the intro, speak one line once per install naming the other two languages and where to change them (new key 'start.langOffer', en, hi, gu). Change 'lab.start.wake' in hi and gu to the plain verbs above.
TESTS: no stored value + hi-IN gives hi; stored en + hi-IN gives en; navigator.languages missing gives en.
```

**ux9 · Say why Raw Mode happened (I17)** · not EX · slice 4
Acceptance: `reason` reaches the entry announcement; four sentences per language (timeout, budget_exhausted, provider_error or no_provider or error, unreadable); unknown reasons fall back to today's sentence; no reason text from the server is ever spoken verbatim.
```
[UX RULES]
LANE ux9: tell the user what to do after Raw Mode. ALLOWED: frontend/src/screens/Capture.tsx, frontend/src/App.tsx, frontend/src/flow/navigation.ts, frontend/src/i18n/index.ts, frontend/tests/raw.reason.test.ts (new).
DO: pass result.reason from Capture through App to the Explore entry announcement as a closed union ('timeout' | 'budget' | 'provider' | 'unreadable'); map server strings to it in one function and map anything else to 'unreadable'. New keys raw.reason.timeout ("The reader was slow. Try once more."), raw.reason.budget ("Today's AI limit is used up. Saved diagrams still work. Try again tomorrow."), raw.reason.provider ("The reader is not available right now. Try again in a minute."), raw.reason.unreadable ("Try again with the page flat, closer, and in more light."), in en, hi, gu. Append the sentence after raw.announce. Never speak the raw server string.
TESTS: each server reason maps to its sentence in all three languages; an unknown or missing reason gives 'unreadable'.
```

**ux10 · Settings presets UI (I18)** · not EX · slice 4 · needs K-U5
Acceptance: a radio group of three presets is the first control after Language; all existing switches sit under one "More settings" disclosure, collapsed by default; choosing a preset writes every setting through the existing setters; hand-set switches show "Custom"; every switch is named by its feature only (Graph scan and Guide fixed) with its hint attached by `aria-describedby`; the app no longer speaks "Lab settings opened"; the title is "Settings"; a Reset button restores Standard; the vibration help card is collapsed at the bottom.
```
[UX RULES]
LANE ux10: three choices instead of eight switches. ALLOWED: frontend/src/components/LabSettings.tsx, frontend/src/styles/settings.css, frontend/src/i18n/index.ts, frontend/src/drivers/storage.ts, frontend/tests/settings.presets.test.tsx (new). Use PRESETS, applyPreset and presetOf from frontend/src/core/presets.ts (Kiro's; do not edit).
DO: add the preset radio group (role="radiogroup", three role="radio" buttons, 48 px, each with a one-line hint): Simple "Fewer words, no extra sounds", Standard "Words, directions and finding sounds", Explorer "Everything, including experimental stay-on-line and corner heartbeat". Move all current sections except Language and Speech speed into a "More settings" disclosure (button with aria-expanded). Give every switch one fixed accessible name (the feature), state only in aria-checked, hint via aria-describedby; fix Graph scan and Guide, which today use a status sentence as the name. Remove the spoken 'lab.settings.opened' / 'closed' calls (the dialog title is read by the screen reader); rename the title key text to "Settings" in en, hi, gu. Add Reset (applies Standard). In drivers/storage.ts make each boolean getter return its default unless the stored value is exactly 'true' or 'false', and prefer the in-memory value when it is set.
TESTS: choosing each preset sets all six settings; flipping one switch shows Custom; names do not change when toggled; the disclosure is collapsed on open; garbage in storage yields defaults.
```

**ux11 · Classroom limits and a service that can see itself (I22, I23)** · backend · slice 4
Acceptance: `app.*` loggers emit INFO with one handler; `GET /api/v1/status` returns `ai_available`, `providers_configured` (count), `uptime_seconds`, `commit`, `scene_schema_version` and no budget numbers, keys, addresses or provider names; health unchanged; `SCENE_CLIENT_MAX_CONCURRENCY` and `ASK_CLIENT_MAX_CONCURRENCY` appear in `render.yaml` at today's value 2 with a comment giving the classroom profile (8 and 60 per minute) as an owner decision; a request rejected by the in-flight cap does not consume a rate-limit slot; rate-limit 429 carries `Retry-After`; the smoke script fails when `ai_available` is false; logs contain no photo, question, label or address.
```
[UX RULES]
LANE ux11: classroom-ready limits and basic observability. ALLOWED: backend/app/main.py, backend/app/limits.py, render.yaml, scripts/smoke-deployed.mjs, docs/SECURITY_RUNBOOK.md, backend/tests/test_ux11_status.py (new), backend/tests/test_ux11_limits.py (new). Do not touch schema.py, validate.py, paid_budget.py or the providers.
DO: 1. In lifespan set logging.getLogger("app") to INFO with one StreamHandler and a fixed format; leave uvicorn's loggers alone. 2. Add GET /api/v1/status as described in the acceptance text; commit comes from the RENDER_GIT_COMMIT environment variable or "unknown"; rate-limit it like health. 3. limits.py: send Retry-After on the rate-limit 429, computed from the oldest hit in the window and clamped to 1..60; make an in-flight rejection give back its rate slot. 4. render.yaml: add the two client concurrency keys at "2" with the classroom-profile comment; change no existing value. 5. Runbook: add the symptom table rows for "busy for a whole class" and "outlines only for everyone".
6. Smoke script: fetch /api/v1/status and fail when ai_available is false.
TESTS: status shape and that it leaks nothing (assert the exact key set); ai_available false with no provider and with the kill switch; INFO line emitted for a processed scene (caplog); rejected-by-in-flight does not reduce the remaining rate allowance; 429 has Retry-After between 1 and 60.
```

**ux12 · Ask fallback that works, and a provider breaker (I24)** · backend · slice 4, after ux11 (both edit `main.py` only if ux12 needs it; otherwise parallel)
Acceptance: Ask passes a per-call timeout so two providers fit in the 10 s budget; with a fake slow first provider and a healthy second, Ask answers from the second; the chain skips a provider for 60 s after 2 consecutive timeouts, 5xx or 429, then lets one probe through; a healthy provider is never skipped; existing chain tests unchanged.
```
[UX RULES]
LANE ux12: one slow provider must not be everyone's outage. ALLOWED: backend/app/ask.py, backend/app/vision/chain.py, backend/tests/test_ux12_ask_timeout.py (new), backend/tests/test_ux12_breaker.py (new).
DO: 1. ask.py (near 1037): pass timeout=min(chain.call_timeout, total_budget * 0.55) to chain.complete.
2. chain.py: a small per-provider breaker held on the chain object: consecutive failure count and open-until time (time.monotonic, injectable clock for tests). Failures that count: timeout, HTTP 5xx, HTTP 429, connect error. Open after 2 in a row for 60 s; then half-open: one call allowed, success closes it, failure reopens. When every provider is open, try the one whose open-until is earliest (never return "no provider" because of the breaker alone). Log state changes at INFO with the provider name only.
TESTS with fake providers and a fake clock: slow first, healthy second answers within budget; breaker opens after 2 failures, skips for 60 s, probes once, closes on success; interleaved successes never open it; all-open still tries one.
```

Later lanes, prompts written when their slice arrives. agy, EX and serialized unless noted: commands
exact-match and one position source (I15); Help and practice sample (I20); teacher guide and Correct
gating (I21, not EX); highlight and marker outlines (I29); exit guard and typed Ask (I28); hi/gu fixes
(I30, not EX); scene language (I31, backend); deploy-after-CI YAML (I33, not EX). Kiro: once-per-scene
AI honesty clause (I27), exit-gesture property (I28), click pan and mute after owner decision 4 (I25),
sticky never holds a bar edge (I35), labels stay inside the canvas (I38).

---

## (e) Honesty and evidence checklist, and owner decisions

### Stale numbers (fix in ux6 and ux7; the orchestrator supplies each figure from its own run)

| Claim in docs | Where | Repo today (checked) |
|---|---|---|
| 2,231 frontend tests in 181 files | `README.md:149,152`, `BLOG.md:48`, `SOCIAL.md:26,57,100`, `STEMERGENT_APPENDIX.md:70` | 213 files, 2,700 passed, 1 expected fail, 1 todo (BUILD_LOG gate at `a82f7bf`); rerun before quoting |
| 834 backend tests | same files | not rerun since Nov 12; run pytest and save the summary line |
| 25 requirements, P1 to P87, 42 tasks | `KIRO_WRITEUP.md:30` | 36 requirements, properties to P136, 66 tasks |
| P1 to P57 "all passing" | `STEMERGENT_APPENDIX.md:62` | P109 to P113 untested; one `it.fails`, one `it.todo` |
| 841 commits, 69 `kiro:` | `KIRO_WRITEUP.md` | 898 commits, 89 with the `kiro:` prefix |
| `gemini-3.8-flash` | `STEMERGENT_APPENDIX.md:51` | `render.yaml` sets `gemini-3.5-flash-lite`, `gpt-4.1-mini`, and OpenAI first |

### Claims against reality

| Claim | Reality (checked in code or docs) | Action |
|---|---|---|
| Start screen: "TalkBack & touch ready" | TalkBack tried on the prototype only | ux4, owner decision 3 |
| Sticky and heartbeat "not wired" (`tech.md`) | Wired behind off-by-default switches | K-U3 |
| "Never leaves the student with nothing" | Raw Mode is server-side; offline gives samples and saved only; Raw speech reads ids today | ux6 wording, ux3 fix |
| "Blind and low-vision" | Nothing on screen is adjustable; canvas labels are 16 px | ux6 sentence now; I29, I38 later |
| "Hindi and Gujarati" | UI keys complete, machine-translated; diagram content English | say exactly that; I30, I31 |
| "Tested on a phone" | One run on a Galaxy S24+ found and confirmed one bug; no recorded pass; new cues unfelt | one sentence everywhere (ux6); owner pass |
| "Agent hooks run tests on save" | Nine hooks defined; no firing recorded (task 21.4 open) | owner: screenshot, or cut the shot |
| "Images never written to disk" | Large multipart uploads may spool to a temp file | ux6 wording |
| Demo line "AC is 4 cm long" | Matches `frontend/public/samples/triangle.json` (right angle at C) | none; CLAUDE.md sections 6 and 8 still say corner B and AB = 3 cm (internal, low) |
| Costs and "most students own an Android phone" | Sources not checked here | owner: cite `docs/research/competitors.md` or soften |

### Only the owner can supply

1. The under-3-minute video on a real Android phone, captions saying what the motor is doing. Film
   after slice 2; show at most one new cue, labelled experimental.
2. One recorded pass of `docs/PHONE_TEST.md` in `docs/OWNER_TEST_SHEET.md` (blank today, dated "before Nov 14").
3. Eyes-closed checks from the reviews: Short + bars rest (I05); Guide arrival then still (I01); edge
   drift (I04); one earbud each side (I25); a messy photo in Raw Mode (I03); TalkBack focus on the
   overlay (I26); Stay on line and heartbeat on the Nord CE6 and a budget phone.
4. A hook firing in the Kiro IDE, screenshot into `docs/kiro-evidence/` (task 21.4), and the dated
   `vitest` and `pytest` summary lines saved beside it.
5. Every `[FILL]`, `[OWNER]` and `[HW]` slot, the team line, the vibe-coding paragraph; remove the "draft" banners.
6. One session with one blind or low-vision person, with consent, and three plain sentences about
   what happened. No low-vision or classroom claim before it.
7. Native review of hi and gu by one maths teacher per language (`docs/user-test/translation-review.csv`).
8. Dashboards: provider spend caps, Render deploy trigger, `VITE_FEATURE_SHARE` in production, CI green.

### Decisions needed from the owner

1. Was STEMergent submitted on Nov 16, and with which numbers? If yes, ux6 must not rewrite that text.
2. Which new cues, if any, appear in the video (recommended: graph scan only, labelled experimental).
3. Start-screen wording to replace "TalkBack & touch ready" (ux4 proposes "Touch, sound and speech").
4. Near-line click: limit pan to about 0.4 and mute clicks under speech? (PROPOSED rows; Kiro edits after a yes.)
5. Centre word and 25 ms tick: keep on, move to the Explorer preset, or debug only.
6. Correct button: gate behind Teacher tools, and show Teacher tools without `VITE_FEATURE_SHARE`?
7. Classroom limits for Render (in-flight 8, scenes 60 per minute) and provider order (`openai` first today; the decision table says Gemini).
8. A dedicated page-edge earcon later (new PROPOSED value), or speech only for good.
9. "Show me" highlight on by default (recommended yes).
10. Local photo keeping for teachers (opt-in, default off) and the PRIVACY.md change it needs.
11. Commit `docs/media/devpost/` or upload only; list PR 36's outside contributor or describe the adopted PR.
12. Explorer preset: hidden, or shown as "experimental", until sticky and heartbeat are phone-tested.

### Orchestrator notes

- Log this report in `docs/BUILD_LOG.md` (tool = Claude Code, Fable: "synthesis of six persona
  reviews, read-only, one file"); the six persona reports still need their one-line entries too.
- Line numbers are from `8eda0ac`; every EX lane shifts them, so each EX prompt also names the code
  by what it does.
- Not verified here: anything on a phone, the deployed site, CI status, the pytest count, Render's
  deploy-after-checks key, and the Chrome-on-Android behaviour behind I05 (B4) and I26.
