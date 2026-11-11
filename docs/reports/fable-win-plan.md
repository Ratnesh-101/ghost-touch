# Ghost Touch win plan (strategist pass, 2026-11-10 evening)

Read-only review by Claude Code. Nothing in the repo was changed except this file.
Checked against: the code on local `main` (47 commits ahead of `origin/main`), the docs, `.kiro/`, and the live deployment.
Live checks made (4 requests in total): `GET /api/v1/health` (200 after 32.6 s, cold), the Vercel page and bundle, one `POST /api/v1/scene` with `research/samples/synthetic/clean/01_right_triangle.png` (200, `mode: "ai"`, 5.4 s), one `POST /api/v1/ask` on the sample triangle ("How long is AC?" gave "AC is 4 cm long.", 2.2 s).
Not done: I did not run the test suites (other sessions are gating, and memory is tight). Test counts below come from `docs/handoffs/LOOP-CLAIMS.md` and are not re-measured.

---

## 1. Verdict

- **Impact / potential value: strong idea, zero proof.** No blind or low-vision person has used it, and the full app has never been run on a phone (`docs/PHONE_TEST.md` has no results; `research/samples/real/` is empty).
- **Use of Kiro: deep on paper, thin on show.** 24 requirements, P1 to P84, 5 steering files, 9 hooks, 40 tasks. But no MCP, no proof a hook ever fired, no screenshots, and a 6,374-word write-up that says many times what Kiro did not build.
- **Design / quality: good on a phone (by code), poor for a judge on a laptop.** With no Vibration API, tracing a triangle side gives no sound and no visual change (`frontend/src/drivers/index.ts:170`). Most judges will open the URL on a laptop or an iPhone.
- **Presentation: not started.** No video, no filled `[FILL]` or `[RECOUNT]` markers, and submission texts that read like a commit log.
- **Biggest risk to winning:** the project keeps hardening code (39 audit reports, 38 `agy/*` branches) while the three things judges score first are missing: a phone-verified demo, a video, and one real user. Five days are left for STEMergent.

---

## 2. Judging-criteria map

What I could confirm about the rules:

| Source | What it says | Status |
|---|---|---|
| https://kiro.dev/blog/kiroween-2025/ (official, 2025 edition) | Criteria: Potential Value, Implementation (how well the project uses Kiro), Quality and Design. Categories: Resurrection, Frankenstein, Skeleton Crew, Costume Contest. Needs public repo with `.kiro`, app URL, 3-minute video, write-up on vibe coding, hooks, specs, steering, MCP. | Confirmed for 2025 |
| https://www.startupgrantsindia.com/aws-kiroween-hackathon-2026 (third party) | 2026: deadline Dec 4 2:00 pm PT, credits request by Dec 1 12:00 pm PT, judging Dec 16 to Jan 29. Stage one checks basic requirements and Kiro use. Equally weighted criteria "including potential impact and presentation". Video under 3 minutes on YouTube. Teams up to 3. New work only; other existing code must be disclosed. Bonus prizes: Best Student Project, Best Demo, blog and social. | Third party, unconfirmed |
| https://internshala.com/competitions/?p=13309 (third party) | Same dates and categories. No criteria. | Third party |
| https://kiroween.devpost.com/rules | Returned HTTP 403 to my fetch. | **Not read. The owner must open it and paste the criteria and the write-up questions into `docs/kiro-evidence/rules.md`.** |
| STEMergent | Two web searches found nothing under this name. | **Unconfirmed. The seven criteria in `docs/WIN_PLAN.md` have no source in the repo. The owner must paste the official rubric.** |

`docs/WIN_PLAN.md` says "five criteria, 20% each" for Kiroween. I could not confirm that.

| Criterion | Evidence we have | Gap |
|---|---|---|
| Potential value / impact | `docs/research/competitors.md`, `docs/user-test/plan.md`, `docs/research/talkback-spike.md` (owner's own phone test of the gesture on the prototype, Nov 1) | No user session. No real-photo accuracy. No full-app phone test. |
| Implementation (Kiro) | `.kiro/specs/ghost-touch/` (24 requirements, P1 to P84, `tasks.meta.json` with 65 task-run entries), `.kiro/steering/` (5 files, 2 with inclusion rules), `.kiro/hooks/` (9 files), `docs/kiro-evidence/` (11 notes), 37 commits prefixed `kiro` | No MCP. No hook-firing proof (`docs/kiro-evidence/hooks-check.md` still says "Needs Owner"). No images. No vibe-coding account. Write-up does not follow the five headings. |
| Quality and design | Lab theme, `frontend/tests/a11y.*.test.ts`, screenshots in `docs/design/screenshots/`, CI green on `origin/main` | Laptop and iPhone experience is silent on lines. AI scenes can hug the canvas edge (item W5). |
| Presentation | `docs/DEMO_SCRIPT.md`, `docs/BLOG.md`, `docs/SOCIAL.md` | No video. Script hook line is not what the app says (section 6). Drafts are unreadable to an outsider. |
| STEM merit (STEMergent, unconfirmed) | Geometry, graphs, bar charts; `backend/app/semantic.py`; Spec Ghost `frontend/src/core/verify.ts` | Fine. Needs one plain paragraph, not nine. |
| Honest AI disclosure (STEMergent) | `docs/STEMERGENT_SUBMISSION.md` section 6 | Too long. Cut to four sentences, one per tool. |

---

## 3. Ranked action list

Ranking = (win impact x chance it lands by Nov 14) / effort. "Conflicts" were checked against `docs/handoffs/LOOP-CLAIMS.md` and `git branch --list 'agy/*'` (in flight: a1-reserved-ids, x1-w2-fixes, y1-w3-fixes-a, z1 pass 2; queued: a2-teach-nudge, y2-w3-fixes-b; Kiro has uncommitted T40 test files).

### W1 · Phone test of the full app · RISK · OWNER-only · 1.5 h · impact HIGH
- Why: every claim in every document hangs on this, and it has never been done. A failure found on Nov 13 cannot be fixed.
- Files: `docs/PHONE_TEST.md` steps 0 to 8 only (skip Guide and Share), results into `docs/OWNER_CHECKLIST.md` section B.
- Do first: push or use a Vercel preview so the phone runs current code (see W2).
- Acceptance: PASS or FAIL written for steps 0 to 8, including one real textbook photo and TalkBack on. Each FAIL becomes a one-line bug.
- Conflicts: none.

### W2 · Push `main` and confirm both deploys · SUBMISSION · OWNER decision, Claude gates · 0.5 h · impact HIGH
- Why: judges see `origin/main` and the live site. Both are 47 commits old (Correct delete curves and bars, share fixes, language fixes are missing).
- Files: none. Before the push, Kiro's test-first oracles that are meant to be red (amended P43 in `frontend/tests/round2.navigation.prop.test.ts`, P83 and P84 in `frontend/tests/saved.writeOrder.prop.test.ts`) must be green or stay uncommitted, or CI goes red on the public badge.
- Acceptance: `gh run list -L 5` all green; live bundle hash changes; one photo on the phone returns AI mode.
- Conflicts: wait for the lanes that are mid-merge (a1, x1, y1, z1). Agree a push time in `LOOP-CLAIMS.md`.

### W3 · Audible and visible haptics when vibration is missing · FIX · Kiro writes the requirement and property, agy lane builds · 3 h · impact HIGH
- Why: on a laptop or iPhone `runEffects` calls `drivers.haptics.vibrate`, which does nothing. A judge who drags a mouse along a triangle side hears nothing and sees only a 5 px dot. The same gap hurts the video: viewers cannot feel a motor.
- What: when `haptics.supported` is false (and as a "Show haptics" switch in Lab settings for filming), play a short low buzz through `AudioDriver` for the same durations and draw a pulse ring at the cursor. Show one line of text: "No vibration on this device. You will hear a buzz instead. Use Chrome on Android to feel it."
- Files: `frontend/src/drivers/haptics.ts` (a fallback driver behind the same `HapticDriver` interface), `frontend/src/drivers/audio.ts` (one buzz voice), `frontend/src/screens/Explore.tsx` (ring), `frontend/src/i18n/index.ts`, new tests. `frontend/src/core/` and the tuned values stay untouched.
- Acceptance: desktop Chrome, sample triangle, mouse drag gives a buzz on sides and a different double buzz at corners; on Android with vibration nothing changes; a property test shows the fallback fires only when `supported` is false and uses the engine's own durations.
- Conflicts: `Explore.tsx` is in y2's planned scope; `drivers/audio.ts` is free. Launch after y1 merges, and claim `Explore.tsx` in `LOOP-CLAIMS.md`.

### W4 · Record the 3-minute video · DEMO · OWNER-only · 3 h · impact HIGH
- Why: required for Kiroween, expected for STEMergent, and Best Demo is a separate prize (third-party source).
- Files: `docs/DEMO_SCRIPT.md` (use the storyboard in section 5 below).
- Acceptance: public YouTube link under 3:00, motor hum audible, URL pasted into the three `[FILL: video URL]` markers.
- Conflicts: needs W1. Better after W3.

### W5 · Keep AI scenes off the canvas edge · FIX · Kiro (core) · 2 h · impact HIGH
- Evidence: the live API returned the triangle with A at (0.25, 0.0), B at (0.25, 1.0), C at (1.0, 1.0). `makeViewport` in `frontend/src/core/geometry.ts` maps the unit square to the full canvas with no inset, so two corners and one whole side sit on the canvas border. The bundled samples have their own margins, so tests and sample demos never show this. Not yet seen on a phone: check it during W1 step 8 before spending the time.
- What: an inset in the viewport (for example 24 CSS px), or rescale each scene to its bounding box plus a margin in `backend/app/validate.py` (already suggested in `docs/research/vision-spike.md` finding 5).
- Files: `frontend/src/core/geometry.ts` or `backend/app/validate.py` (both Kiro-owned), `.kiro/specs/ghost-touch/requirements.md`, `design.md`, a new property.
- Acceptance: property "every point with coordinates in [0, 1] lands at least the vertex radius inside the canvas"; P1 and P8 still pass; the live triangle's corners can all be found by finger.
- Conflicts: a1-reserved-ids is editing `backend/app/validate.py`. Prefer the frontend viewport route.

### W6 · One real user before Nov 15 · ADD · OWNER-only · 2 to 3 h · impact HIGH, chance MEDIUM
- Why: the owner leaves Ahmedabad on Nov 15. `docs/WIN_PLAN.md` section 4 says the BPA email was drafted; nothing in the repo says it was sent. One 20-minute session with one TalkBack user, with consent, is worth more to an impact score than any code change left.
- Files: `docs/user-test/consent-script.md`, `task-sheet.md`, `results-template.md` (all ready).
- Acceptance: `docs/user-test/results.md` exists with real numbers and no names. If no session happens, write that sentence plainly and move on.
- Conflicts: none. Needs W1 first.

### W7 · Rewrite the STEMergent text for a human judge · SUBMISSION · Claude drafts, OWNER edits · 1.5 h · impact HIGH
- Why: `docs/STEMERGENT_SUBMISSION.md` sections 5 to 7 are full of lane names (p1, q1, m3) and P-numbers. A STEM judge will stop reading.
- What: 350 to 450 words. Problem, who, what the student feels, STEM link, what is proven (W1, W6, W8 results), AI disclosure in four sentences, what is next. Move the long tables to a linked appendix.
- Acceptance: no `[FILL]`, no `[RECOUNT]`, no lane ids, no P-numbers above P13 in the main text.
- Conflicts: none (w1-docs-refresh is merged).

### W8 · Ten real textbook photos through the pipeline · ADD · OWNER takes photos (20 min), Claude runs the spike (30 min) · impact MEDIUM-HIGH
- Why: "Gate B is not closed" (`docs/research/vision-spike.md`). All accuracy numbers are on synthetic images. One honest line such as "7 of 10 real NCERT photos were usable" is the kind of evidence both rubrics reward.
- Files: `research/samples/real/`, `research/vision_spike.py`, `docs/research/vision-spike.md`.
- Acceptance: a table of 10 real photos with usable / partly / unusable, and the sentence in both submissions.
- Conflicts: none. Uses provider quota: run after W10.

### W9 · Honesty fixes in the docs · FIX · agy docs lane or Claude · 1 h · impact MEDIUM
- Files and sentences: section 6 below.
- Acceptance: each row of section 6 is applied or answered.
- Conflicts: none open on docs.

### W10 · Spend caps and a warm backend for judging · RISK · OWNER-only · 20 min · impact MEDIUM
- Why: the health check took 32.6 s cold. The Gemini key was on the free tier at 20 requests a day (`docs/research/vision-spike.md`). Production puts OpenAI first, so a judge burst costs money.
- What: caps on the OpenAI, Gemini and Nebius dashboards. Decide on a free keep-warm (a scheduled GitHub Actions `curl` of `/api/v1/health` every 10 minutes during the two judging windows). This is a new workflow file, so the owner decides.
- Acceptance: caps visible on the dashboards; first photo after an idle hour answers in under 15 s.

### W11 · Capture Kiro evidence in the IDE, and request credits now · SUBMISSION · OWNER-only · 40 min · impact MEDIUM (HIGH for Kiroween)
- What: open the repo in Kiro. Screenshot the Hooks panel with all 9 hooks. Save `frontend/src/core/pitch.ts` and record the hook run. Screenshot the spec with tasks, and one steering file in use. Check that the `PreCommit` trigger in `.kiro/hooks/pre-commit-build-log.json` is accepted (I could not confirm that trigger name in the public hook docs at https://kiro.dev/docs/hooks/). Request the 4,000 credits today, not on Nov 30.
- Files: new images under `docs/kiro-evidence/` (none exist today).
- Acceptance: at least 4 images plus one short clip, linked from `docs/KIRO_WRITEUP.md`.

### W12 · Truth pass on `tasks.md` and `tech.md` · FIX · Kiro · 15 min · impact MEDIUM
- Why: a Kiroween judge opens `.kiro/specs/ghost-touch/tasks.md` first. Task 36 (Ghostwriter UI) is built and merged but unticked. Tasks 17 and 18 have every sub-task ticked and the parent open. Task 16.1 says "blindfolded trace", which `docs/DEMO_SCRIPT.md` forbids. `.kiro/steering/tech.md` says React 18; the app is on React 19.
- Acceptance: Kiro commits the corrections with a `kiro:` prefix.
- Conflicts: Kiro has uncommitted `.kiro` work for T40. Bundle it.

### W13 · Speak "C, right angle" at a right-angle corner · ADD · Kiro · 2 h · impact MEDIUM
- Why: today the engine speaks only the label (`frontend/src/core/hapticEngine.ts:135`), so the sample says "C". A single letter is hard to hear, and the script's hook line needs the words "right angle". The facts already hold "angle C = 90 degrees" and `core/verify.ts` already parses them.
- Acceptance: property "a vertex with a parsed 90-degree fact speaks the localised right-angle phrase once per entry; other vertices are unchanged". The 450 ms quiet window is unchanged.
- Conflicts: core is Kiro's. Do it after W5. If time is short, drop it and fix the script instead (section 6, row 1).

### W14 · Rebuild the Kiro write-up, blog and social post · SUBMISSION · Claude drafts, OWNER rewrites · 3 h · slips to Kiroween
- What: write-up of at most 1,200 words under five headings (vibe coding, specs, hooks, steering, MCP), then link the long version. Lead with the strongest real bug a property caught: P83, a failed save that loses an older diagram (BUILD_LOG, Kiro T40.2), and the four defects the P14 and P15 tests found in Kiro's own draft. The P1 flake was a test-generator bug, so it is the weaker story. The social post must be the owner's own words about one Kiro feature.

### W15 · A small custom MCP server, built by Kiro · ADD · Kiro · 4 h · slips to Kiroween
- See section 7.

---

## 4. What not to do before Nov 14

| Tempting | Why not |
|---|---|
| Another audit round (r7) or more fix lanes for audit findings | 39 audit reports exist. Each round touches `App.tsx` and `Explore.tsx` and risks the demo path. Fix only what the phone test finds. |
| Turning Guide or Share on by default | Never run on hardware. A broken headline feature costs more than a missing one. |
| Capacitor or a native build | The owner's own test showed web vibration and the TalkBack gesture work. No evidence it is needed. |
| Hindi and Gujarati fact parsing, more languages | Kiro already recorded it as a non-goal (Requirement 18.10). The strings are still machine-translated. |
| More property numbers for edge cases | P1 to P84 is already more than a judge will read. Depth of story beats count. |
| Growing Spec Ghost | It parses facts on about 35% of scenes. Keep it as an honest side feature. |
| Rewriting git history or squashing for tidiness | 47 unpushed commits, several sessions in one checkout. Just push. |
| Changing the tuned haptic values | Rule 5. Only the phone test can justify it, and only with the owner's approval. |
| Starting the MCP server or the write-up rebuild this week | Worth nothing to STEMergent. Dec 5 is far enough. |

---

## 5. Demo plan

### Storyboard (2:55). "HW" marks a step that depends on something not yet verified on hardware in the full app.

| Time | Shot | Say | Depends on |
|---|---|---|---|
| 0:00 to 0:12 | Close shot, finger on the sample triangle. Buzz, then the corner double pulse, then the voice. No narration. | (silence) then "Ghost Touch. Feel diagrams you cannot see." | HW (W1 step 4). The voice says "C" today, not "Point C. Right angle." (W13 or fix the script). |
| 0:12 to 0:30 | Textbook page next to a phone. | Tactile graphics take weeks. A tactile tablet costs about £6,500. The phone in the student's pocket already has a motor, a camera and a speaker. | Nothing. |
| 0:30 to 0:45 | Start screen, three organ tiles, tap "Wake the creature". | Three spare parts, one creature: buzzer for nerves, vision AI for eyes, synthesizer for voice. | Works by code. |
| 0:45 to 1:20 | Photograph a real textbook triangle. Loading meter. Explore opens. Trace it. | A teacher or parent takes one photo. | Live AI mode worked for me on a clean digital triangle in 5.4 s. A real photo on the phone is HW (W1 step 8). Check W5 first, or corners may sit on the screen edge. |
| 1:20 to 1:40 | Ask aloud: "How long is AC?" | The answer comes from the diagram's facts. | The backend answered "AC is 4 cm long." Voice input on the phone is HW (W1 step 7). Keep a typed take as backup. |
| 1:40 to 2:00 | Sine wave sample. The tone rises and falls. Then one bar of the bar chart. | Height becomes pitch. | Works by code. HW for sound level on the phone speaker. |
| 2:00 to 2:15 | TalkBack on. Double-tap and hold, then drag. | It works with the screen reader blind students already use. | The owner verified the gesture on the prototype on Nov 1. In the full app it is HW (W1 step 5). If it fails, cut this shot. Do not claim it. |
| 2:15 to 2:30 | A messy photo. "The creature's eyes are blurry, you can still feel the outlines." | It never leaves the student with nothing. | HW. Raw Mode on a real cluttered photo has not been seen on the phone. |
| 2:30 to 2:45 | Kiro IDE: the spec, a hook firing on save, a property test failing then passing. | Specs, steering, hooks and property tests, built with Kiro. | Needs W11 recordings. |
| 2:45 to 2:55 | One real result. | If W6 happens: one number and one quote, with consent. If W8 happens: "N of 10 real textbook photos". If neither: "Next: first sessions with blind students." | W6 or W8. Say only what exists. |

Cut from the current script: the settings and Hindi switch shot (machine-translated, 20 seconds for little gain), the "testing protocol is ready" shot, and the closing list of P-numbers and lane names.

### What a judge will try in the first 60 seconds, and what happens

| # | Judge does | Today | After the fixes |
|---|---|---|---|
| 1 | Opens the live URL on a laptop | Page loads in under 1 s. The warm-up call in `frontend/src/api/health.ts` starts waking the backend. | Same. |
| 2 | Clicks "Wake the creature", picks the Right triangle sample, drags the mouse | Speech works. Sides are silent because there is no vibration on a laptop. Corners speak "A", "B", "C". This looks broken. | W3: buzz sound, pulse ring, and a one-line note about Android. |
| 3 | Picks the Sine wave sample | Tone follows the curve. This is the best laptop moment today. | Same. |
| 4 | Presses Ask and types "How long is AC?" | "AC is 4 cm long." in about 2 s once warm. | Same. |
| 5 | Uploads their own image | Cold backend: 30 s or more, then AI mode in about 5 s for a clean image. Corners may land on the canvas edge. | W10 keeps it warm. W5 adds a margin. |

Also expect the judge to open the GitHub repo, read the first screen of `README.md`, and open `.kiro/`. The README has no "for judges: try this in 60 seconds" block and does not say what to expect on a laptop. Add five lines at the top of "Try it" (part of W9).

---

## 6. Honesty audit

| # | Where | Claim | What the code or record shows | Corrected sentence |
|---|---|---|---|---|
| 1 | `docs/DEMO_SCRIPT.md` rows 0:00 and 1:15; `docs/STEMERGENT_SUBMISSION.md` section 4; `docs/DEPLOY.md:197` ("Corner B") | The voice says "Point C. Right angle." | The engine speaks the point's label only (`hapticEngine.ts:135`). The sample label is "C". | "At a corner the phone gives a double pulse and speaks the corner's label, for example 'C'." (or build W13) |
| 2 | `README.md` (tool table), `docs/KIRO_WRITEUP.md` sections 4 and 9, `docs/BLOG.md`, `docs/SOCIAL.md` | "5 agent hooks", authored by Kiro | `.kiro/hooks/` holds 9 files. `tasks.md` 18.3 says agy added three; the write-up says agents scaffolded three of the first five. | "Nine agent hooks: five run tests on save, four ask the agent to review or regenerate. Kiro wrote [n], agy wrote [n]." Fill n from BUILD_LOG. |
| 3 | `docs/KIRO_WRITEUP.md` section 4, "Agent Hooks in Action" | Hooks fire and halt saves | Only static checks exist. `hooks-check.md` and `step6-hooks.md` say firing was not observed. The quoted commands (`py -3.11`, `npx vitest`) are not the ones in the file. | "The hooks are defined and their patterns checked. A recorded run is in docs/kiro-evidence/[file]." (after W11; until then say "not yet recorded") |
| 4 | `docs/KIRO_WRITEUP.md` section 9.3 | "Live production deployments fell back to Raw Mode" | On 2026-11-10 the live API returned `mode: "ai"` in 5.4 s for one clean triangle. | "The live backend returned an AI reading for a clean test image on Nov 10. Real photos on the phone are not yet tested." |
| 5 | `README.md`, `docs/STEMERGENT_SUBMISSION.md`, `docs/BLOG.md` | Guide and Share are "flagged OFF by default" | The live bundle is built with `VITE_FEATURE_GUIDE=1` and `VITE_FEATURE_SHARE=1`. Only the Settings switch is off. | "Guide and Share ship in the live app but stay off until the user turns them on in Settings. Neither has been tested on a phone." |
| 6 | `README.md`, `docs/BLOG.md`, `docs/SOCIAL.md` | TalkBack pass-through is "unverified on hardware" | `docs/research/talkback-spike.md`: the owner tested the gesture on the prototype on the Nord CE6 and it passed. The full app is untested. The docs under-claim and over-hedge at once. | "The TalkBack gesture worked on our prototype on a OnePlus Nord CE6. It has not yet been tested in the full app." |
| 7 | `docs/DEMO_SCRIPT.md` row 0:35 | "full screen-reader compliance" | No TalkBack run of the full app. | "designed for TalkBack; phone check pending" |
| 8 | `README.md` accessibility list | "Every" control is 48 px; "every" change is spoken | True for what `frontend/tests/a11y.targets.test.ts` and the render tests cover. Audit w3 found silent paths (some fixed, y2 not launched). | "Controls are tested for 48 px targets; state changes are spoken (see tests/a11y.*)." |
| 9 | `docs/KIRO_WRITEUP.md` section 10 | "1203 frontend tests in 82 files, 422 backend" | Stale. Handoff notes say about 1,973 frontend tests in 145 files and 783 backend. I did not re-run. | Recount on submission day and replace every `[RECOUNT]`. |
| 10 | `docs/BLOG.md` | Property tests "caught subtle edge cases before any student touched the screen" | No student has touched it. The example given (P1) was a fault in the test generator. | "Property tests found real faults, for example a failed save that could lose an older diagram (P83)." |
| 11 | `.kiro/specs/ghost-touch/tasks.md` 16.1, `CLAUDE.md` section 8 | "blindfolded trace", "blindfolded volunteer" | `docs/DEMO_SCRIPT.md` and `product.md` forbid blindfolds. | Kiro: "eyes-closed trace by a sighted helper, or a real student with consent". |
| 12 | `docs/DEMO_SCRIPT.md` row 1:55 | "Where is the right angle?" answers "angle C = 90 degrees." | Not checked by me. I checked "How long is AC?" only. | Verify in W1 step 7 or use the checked question. |
| 13 | `docs/SOCIAL.md` | Ready-to-post drafts | They are feature and lane lists. The social prize is said to judge the owner's own view of one Kiro feature (from `docs/WIN_PLAN.md`; not confirmed). | Owner writes it. |

Claims I checked and found sound: the tuned values in the docs match `tech.md` and the engine config; `.kiro` is not ignored; the repo is public with an MIT licence; the three samples load with no backend call; Hindi and Gujarati are stated as machine-translated everywhere.

---

## 7. Kiro-usage showcase

What a judge sees today in `.kiro/`:

| Part | Exists | Weak point |
|---|---|---|
| Specs | `requirements.md` (24 requirements, EARS), `design.md` (P1 to P84), `tasks.md` (40 tasks), `tasks.meta.json` (65 run entries) | `tasks.meta.json` shows one chat session id. Open parents for finished work (W12). "Spec after code" for Spec Ghost is honest and marked. |
| Steering | `product.md`, `tech.md`, `structure.md`, `review.md` (manual), `verify.md` (file match) | `tech.md` says React 18. No example of steering changing Kiro's output. |
| Hooks | 9 files in the v1 JSON format (matches https://kiro.dev/docs/hooks/): 5 run tests on save, 4 agent prompts | No proof of firing. `PreCommit` trigger unconfirmed. Docs say 5. |
| MCP | Nothing. No `.kiro/settings/`, no mention in `docs/KIRO_WRITEUP.md` | Zero on one of the five headings. |
| Vibe coding | Not mentioned in the write-up | Zero on one of the five headings. |
| Property tests | 29 `*.prop.*` files of 153 test files; nightly soak workflow `.github/workflows/pbt-soak.yml`; mutation checks logged | Strong. The write-up leads with the weakest story. |
| Share of work | 37 commits prefixed `kiro`, 4 authored "Kiro", of 737 | The write-up repeats "Kiro did NOT build" many times. Honest, but it reads as a case against the entry. |

Cheapest additions, in order:

1. **W11 evidence images** (40 min, owner). Hooks panel, a hook run, a spec task run, a steering file. This removes the largest doubt.
2. **W12 truth pass** (15 min, Kiro).
3. **Reframe, do not hide** (part of W14). One table: "Kiro wrote the contract and the core: every requirement, every design property, the haptic engine, hit test, geometry, pitch, validator, and the oracles that agy's code had to pass." Then one sentence: "Faster builders wrote screens and plumbing against Kiro's spec, and had to turn Kiro's test-first oracles green (P66 to P78 were written before the fixes; check the exact count of oracles that started red in BUILD_LOG before using a number)." The second sentence is the real and unusual story: Kiro as the specifier and judge of other agents.
4. **A vibe-coding paragraph** (owner, 15 min, only if true): one or two Kiro chat sessions that were not spec-driven, and how they compared. The 2025 write-up asked for this comparison.
5. **MCP, real and small (W15, Kiro, 4 h, after Nov 16).** A stdio server at `scripts/mcp/ghost_touch_mcp.py` with two tools that wrap code that already exists: `validate_scene(scene_json)` calling `backend/app/validate.py`, and `raw_outline(image_path)` calling `backend/app/raw_mode.py`. Register it in `.kiro/settings/mcp.json` (confirm the path in the Kiro docs first). Use it for real once: Kiro checks a scene from a real photo while fixing W5 or a W8 failure. Record that session. Do not add an MCP server that is never used.
6. **Route the Nov 16 to Dec 1 features through Kiro** with the 4,000 credits (W5, W13, W15, BPA feedback). Stage one of judging checks Kiro use; the last three weeks should be mostly Kiro commits.

---

## 8. Owner-only list (ranked)

| # | Task | Time | When |
|---|---|---|---|
| 1 | Phone test steps 0 to 8 (W1) | 1.5 h | Nov 11 |
| 2 | Send or chase the BPA message; book one session (W6) | 15 min, then 2 to 3 h | Nov 11; session Nov 12 to 14 |
| 3 | Open the Kiroween Devpost rules and the STEMergent rubric; paste both into the repo | 15 min | Nov 11 |
| 4 | Decide: push `main` (W2) | 5 min | Nov 11, after the lanes merge |
| 5 | Spend caps on OpenAI, Gemini, Nebius (W10) | 15 min | Nov 11 |
| 6 | Request the 4,000 Kiro credits | 10 min | Nov 11 |
| 7 | Ten real textbook photos into `research/samples/real/` (W8) | 20 min | Nov 11 or 12 |
| 8 | Kiro IDE evidence captures (W11) | 40 min | Nov 12 |
| 9 | Record and upload the video (W4) | 3 h | Nov 13 |
| 10 | Edit the STEMergent text into your own words; fill team details (W7) | 1 h | Nov 13 |
| 11 | Hindi and Gujarati strings review by a native reader (367 rows in `docs/user-test/translation-review.csv`; do the spoken ones first). Ahmedabad is the easy place to find a Gujarati reader, so do it before you leave. | 45 min + 30 min | Nov 12 to 14 |
| 12 | Submit STEMergent | 30 min | Nov 14 |
| 13 | Decide on the keep-warm workflow (W10) | 5 min | Nov 14 |
| 14 | Render: confirm `TRUSTED_PROXY_HOPS` and the service name against the CSP host (open since Nov 9) | 15 min | After Nov 16 |
| 15 | Blog on a third-party site and the social post, in your own words | 2 h | By Dec 2 |

---

## 9. Schedule to Nov 14

| Day | OWNER | Kiro | agy lanes | Claude |
|---|---|---|---|---|
| **Tue Nov 11** | Phone test (W1). BPA message. Rules pasted. Caps. Credits. Push decision. | W12 truth pass with the T40 commit. Requirement and property for W3. Start W5 if the phone test shows edge corners. | Finish a1, x1, y1, z1. Then W3 lane. No new audit lanes. | Gate and merge. Agree the push in `LOOP-CLAIMS.md`. Turn phone-test FAILs into briefs. W9 docs fixes. |
| **Wed Nov 12** | Real photos (W8). Kiro evidence captures (W11). User session if booked. Hindi review. | W5 finish. W13 only if W5 is done by noon. | Fix lanes for phone-test FAILs only. W3 pass 2. | Run the real-photo spike. Draft the STEMergent text (W7). Re-gate, push, check the live site. |
| **Thu Nov 13 (feature freeze 12:00)** | Second short phone pass on the pushed build. Record the video (W4). Edit the STEMergent text. | Nothing new. Review only. | Nothing new after 12:00. | Recount tests once, fill `[RECOUNT]`. Final honesty pass over the four documents. |
| **Fri Nov 14** | Upload the video. Fill `[FILL]`. Submit STEMergent. User session if it could only be today. | | | Check every link in the submission. Log in `docs/BUILD_LOG.md`. |
| Nov 15 to 16 | Travel. Hard stop Nov 16 09:00 IST. | | | Buffer only. |

**Slips to Kiroween (Nov 16 to Dec 4):** W14 (write-up, blog, social), W15 (MCP), W13 if not done, BPA or VIT Bhopal feedback fixes, budget-phone test (task 15), Guide and Share phone tests and the decision to switch them on, Gujarati review, the Render proxy items. Feature freeze Nov 30. Dec 1 to 4: video re-cut with real user footage if any, write-up, submit by Dec 3.

**If only three things happen this week:** the phone test (W1), the video (W4), and the laptop fallback (W3).
