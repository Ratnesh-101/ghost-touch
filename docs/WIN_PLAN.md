# WIN_PLAN.md — Ghost Touch master plan

> **For Claude Code (planner).** This file sits on top of `CLAUDE.md`. Where they conflict, this file wins (it is newer). Roles are unchanged: you plan and verify, Antigravity builds, Kiro builds the core and reviews. Work through the phases in order. Do not skip a gate.
>
> Written 2026-10-31. User is in Ahmedabad until **Nov 15**, then at VIT Bhopal.

---

## 0. Situation (read this first)

### What we learned today
| Finding | Consequence |
|---|---|
| Web haptics work on the user's OnePlus Nord CE6 (Chrome, TalkBack **off**) | Core idea validated |
| **With TalkBack on, a plain one-finger drag gets no vibration** — TalkBack consumes it for its own explore-by-touch | **SOLVED (2026-11-01, Gate A, A1 passes in code):** TalkBack's pass-through gesture (double-tap, hold on the second tap, then drag) delivers events and the phone vibrates when the cursor crosses a line. TalkBack starts the virtual finger at the centre of the focused element and movement is relative, so Explore uses a "relative cursor" design (`docs/briefs/T07-explore.md`). Stay on web; the Capacitor native spike is optional Phase 2. (Note: physical phone hardware verification is pending per `docs/OWNER_CHECKLIST.md`). |
| Competitors (see §8): Dot Pad (~£6,500+ hardware), Seeing AI explore-photo (people/objects, no diagram haptics), Desmos Audio Trace (typed equations only), Grafici Accessibili (Android tablet, typed equations, 3 function types), TouchSight (hackathon, embosser/3D-print output, no phone haptics, never tested with blind users) | Our gap is real: **photo of any diagram → instant haptic + audio exploration + voice Q&A on a budget phone, free.** |
| Vision-LLM accuracy on real textbook photos is **untested** | #2 risk |

### How we win (judging criteria → our plan)
| Criterion (Kiroween, 20% each) | How we score |
|---|---|
| Potential Impact | Real blind students at BPA Ahmedabad using it; works **with TalkBack**; budget phone |
| Technological Implementation (Kiro) | Specs drive the build, 5 hooks, steering, **P1–P46 property tests**, MCP, honest multi-tool write-up following BUILD_LOG |
| Design | Eyes-closed-usable, dark glowing UI, theremin signature sound, coherent end-to-end flow |
| Innovation | Unique combo vs. competitors table; TalkBack-compatible touch exploration is itself novel |
| Presentation | Real student on camera tracing a triangle; < 3 min; memorable "creature" framing |

STEMergent judges: innovation, problem/need, STEM merit, feasibility, impact, execution, presentation. Same plan covers it.

---

## PHASE 0 — Validation gates (Oct 31 – Nov 2). NOTHING ELSE UNTIL BOTH ARE DECIDED.

### Gate A — TalkBack compatibility spike
**RESULT (2026-11-01): A1 PASSES. Stay on web. Phase 0b (native spike) is NOT needed for the MVP; keep it as an optional Phase 2 experiment.** See `docs/research/talkback-spike.md`.

**Goal:** find at least one way a TalkBack user can explore the diagram by touch and feel the vibrations.

The updated prototype (`prototypes/index.html`) now starts on TalkBack's double-tap and shows an event counter (tap ⚙ to see it: `down · move · touchmove · hover · type`). Ask the user to run these tests **with TalkBack ON**, on the prototype served over HTTPS, and record results in `docs/research/talkback-spike.md`:

| # | Method | How the user tests it | Pass = |
|---|---|---|---|
| A1 | **TalkBack pass-through gesture** | On the canvas: double-tap and **hold** on the second tap, then drag without lifting | Vibration on lines; counter shows `move` rising |
| A2 | **Two-finger drag** | Drag with two fingers together over the lines | Vibration, or counter shows events |
| A3 | **Hover events** | Plain one-finger drag; watch whether `hover` or `move` rises at all | Any events arrive → we can drive the engine from them |
| A4 | **Suspend TalkBack** | Use the accessibility shortcut (hold both volume keys ~3 s) to turn TalkBack off, explore, turn it back on | Works (we know it does) — fallback only |

**Decision rule**
- **A1, A2 or A3 passes →** that becomes the official "explore gesture". The app announces it on entering Explore (e.g. "Double-tap and hold, then drag to feel the diagram"). Stay on web.
- **Only A4 passes →** do **both**: (1) ship web with a spoken, one-step instruction to suspend TalkBack in Explore and resume after; (2) start **Capacitor native spike** (Phase 0b) immediately, because a native app can receive TalkBack's touch-exploration as hover events and drive haptics without suspending TalkBack.

### Phase 0b — Native spike (NOT needed: Gate A passed with A1; optional Phase 2 experiment only), assign to agy
Brief `docs/briefs/T00b-native-spike.md` *(Note: Brief was not created as Gate A passed with method A1, making the native spike unnecessary)*:
1. Minimal Capacitor Android project wrapping the prototype.
2. A small native plugin: set an `OnHoverListener` (and `OnTouchListener`) on the WebView; forward `x, y, action` to JS via `evaluateJavascript`; trigger vibration natively with `VibrationEffect` (amplitude control).
3. In JS, if native events arrive, feed them to the same `handle()` logic.
4. Test with TalkBack **on**: does one-finger drag now produce vibration while TalkBack is running? Note what TalkBack still speaks over it.
5. Also research (and note in the spike file) whether current Android offers a supported "direct touch / pass-through region" for accessibility that we could set on the canvas. Use official Android docs only; don't guess.
**DoD:** a written yes/no with evidence (screen recording) in `docs/research/talkback-spike.md`.

If native works → **promote Task 15 (Capacitor) to the MVP**, right after T7. Update `tech.md` (via Kiro) to make Capacitor the primary runtime for Explore.

### Gate B — Vision accuracy spike
Write a throwaway script (Claude Code may write this one — it's research, not product code): `research/vision_spike.py`.
1. Input: a folder `research/samples/` with **10 real photos** the user takes of textbook diagrams (4 geometry, 3 function graphs, 3 bar charts — NCERT class 8–10 is ideal), plus 3 clean digital ones (screenshots/PDF crops).
2. Call Gemini with the extraction prompt from `CLAUDE.md` §6 Task 8 (add the TouchSight lesson: require teacher vocabulary, forbid colour/shape-only labels).
3. Validate against the schema rules; draw the returned points/segments/polylines over the photo; save `research/out/NN.png` and a summary table.
4. Score each: **usable** (right type, right shape, labels correct, corners within ~5% of image size) / **partly** / **unusable**.

**Decision rule**
- **≥6/10 photos usable →** proceed as planned.
- **<6/10 but clean digital ones usable →** reposition: primary input = screenshots/PDFs (NCERT e-books, ePathshala) + teacher correction (move Task 11 into MVP). Camera stays, labelled "beta".
- **Digital ones also fail →** stop and tell the user; re-plan before building T8.

Put results in `docs/research/vision-spike.md`. These results also go in the write-up (it shows rigour).

---

## PHASE 1 — MVP for STEMergent (Nov 2 – Nov 15)

Build order and owners (task numbers = `.kiro/specs/ghost-touch/tasks.md`). Write a brief for every agy task using the template in `CLAUDE.md` §11.

| Dates | Kiro | Agy | Claude Code / User |
|---|---|---|---|
| Nov 1–2 | T1 finish, T2 | — | Gates A + B; T05/T06 briefs |
| Nov 3–4 | T3 (+P1, P2, P8) | T5 drivers, T6 Start/Capture | Verify; spec change request (§2 below) |
| Nov 5–6 | T4 haptic engine (+P3–P7) | T7 Explore (with the explore gesture from Gate A) | Verify; **user phone test with TalkBack on** |
| Nov 7–8 | T8.3 validator (+P9, P10) | T8 pipeline (Gemini primary, OpenAI + Nebius fallbacks, Raw Mode) | Verify; BPA session prep (§4) |
| Nov 9–10 | Review hooks | T9 Ask; Capacitor if Gate A required it | **BPA session window opens** |
| Nov 11–12 | Fix-ups from reviews | T10 deploy | STEMergent description + demo |
| Nov 13–14 | — | Bug fixes only (feature freeze Nov 13) | Record demo; submit STEMergent on **Nov 14** (1-day buffer) |
| Nov 15 | — | — | User travels. Deadline Nov 16 09:00 IST is the hard stop |

**Cut list if behind (cut in this order):** bar charts (Req 6) → axis-crossing speech (5.4) → Ask by voice (keep text Ask) → Raw Mode polish. **Never cut:** TalkBack compatibility, geometry + graph exploration, samples that work offline.

### Must-have additions to the MVP (not in the original spec)
1. **TalkBack compatibility** (from Gate A) — the explore gesture, spoken on entry, and an exit gesture that works with TalkBack on.
2. **Non-camera input:** upload screenshot/PDF page (first page rendered with pdf.js), because blind students rarely frame photos themselves; teachers/parents/digital textbooks are the real source. Pitch it that way.
3. **Session logging (local only, no personal data):** count of corners found, time to identify a shape — feeds the impact numbers from the BPA session.

---

## 2. Spec changes (ask Kiro to apply — Kiro owns `.kiro/`)

Give the user this to paste into Kiro chat after Gate A/B results are in (fill the brackets):

```
Update the ghost-touch spec with these changes, keeping EARS format and existing numbering:
1. New Requirement 13 "Works with TalkBack": WHEN TalkBack is active THE system SHALL let the user explore the diagram using [winning method from Gate A], SHALL announce that gesture on entering Explore, and SHALL provide an exit gesture that works with TalkBack.
2. Requirement 2: add "upload a screenshot or a PDF page (first page)" as an input.
3. Requirement 3: labels must use subject vocabulary; the validator SHALL reject colour-only or shape-only labels and retry once.
4. [If Gate B moved teacher correction into MVP] move Requirement 9 into the MVP scope.
5. [If native needed] tech.md: Capacitor becomes the primary runtime for Explore; web stays for Capture.
6. Add design properties: P12 "explore gesture events reach the engine" (integration test with synthetic events) and P13 "validator rejects colour/shape-only labels".
Then update tasks.md with new tasks for each change, marked with requirement numbers.
```

---

## 3. Kiro evidence plan (Technological Implementation = 20%)

Collect as you go — don't reconstruct at the end. Folder: `docs/kiro-evidence/`.
- [ ] Screenshot: spec requirements → design → tasks running ("In Progress"/"Done")
- [ ] Screenshot/clip: each hook firing (review hook, test-on-save, type regen)
- [ ] At least one **real bug caught by a property test** — log it in `BUILD_LOG.md` with the failing counterexample. If none happens naturally, the honest move is to report that; do not fake one.
- [ ] Steering in action: one example where `tech.md`'s haptic values or pure-core rule changed Kiro's output
- [ ] MCP: enable the fetch MCP server in Kiro and use it once for real (e.g. reading Android accessibility or Web Vibration docs during the TalkBack spike); screenshot it
- [ ] Tool comparison notes: Kiro IDE vs. Kiro CLI (try the CLI once), and how Kiro + Antigravity + Claude Code split the work
- [ ] Confirm `/.kiro` is committed and not ignored (`git check-ignore .kiro` prints nothing)

---

## 4. BPA user session (Nov 7–14, in person, Ahmedabad)

Status: email drafted; user to send with a 30-s prototype video (Vastrapur office; contacts in the user's chat history — do not store phone numbers in the repo).

Prepare `docs/user-test/plan.md`:
- **Consent:** verbal + written consent per student (guardian if under 18) and BPA approval before any recording. Offer a no-recording option. Never record faces without explicit consent; hands-and-phone shots are enough for the demo.
- **Kit:** 2 charged Android phones (Nord CE6 + a cheap one), printed sample diagrams, offline samples in the app, a Bluetooth speaker if the room is noisy.
- **Tasks (measure time + success):**
  1. Find all corners of the triangle and name them.
  2. Which corner is the right angle?
  3. On the sine graph: how many peaks?
  4. (If built) Which bar is tallest?
  5. Ask one question by voice.
- **Questions:** What was confusing? Which vibration felt unclear? Would you use this for homework? What diagrams are hardest for you in class?
- **Also ask the teacher:** which diagrams students struggle with most; would they correct AI mistakes if it took 1 minute.
- **Output:** `docs/user-test/results.md` with numbers ("3 of 4 students named all corners in under 40 s") and 2–3 quotes (with permission). These go straight into both submissions and the demo.

Fallback if BPA can't schedule before Nov 15: VIT Bhopal disability support cell / blind student groups in late November; or an online follow-up where students use their own phones (still useful as the budget-phone test).

---

## PHASE 2 — Kiroween polish (Nov 16 – Dec 4)

Priority order:
1. Apply BPA feedback (whatever confused real users is the top bug).
2. Capacitor build polished (if Explore went native) + budget-phone test (Task 15).
3. Teacher Correct mode (Task 11) if not already in MVP.
4. Accessibility + Halloween presentation pass (Task 14): creature mascot on start screen, theremin branding; theme never touches blindness.
5. Hindi voice (Task 12) — big for India impact story; Gujarati only if time.
6. Saved diagrams offline (Task 13).
7. Online follow-up session with BPA students on the improved build (late Nov) → second round of numbers ("before/after").

Feature freeze **Nov 30**. Dec 1–4 = demo, write-up, submission only.

---

## 5. Submission checklists

### STEMergent (by Nov 14, hard deadline Nov 16 09:00 IST)
- [ ] Pathway: **Hackathon**
- [ ] Description: problem, who it helps, STEM connection, how it works, what's next
- [ ] **AI disclosure:** Gemini (vision + Q&A), Kiro, Antigravity, Claude Code — what each did
- [ ] Screenshots/GIFs, demo video (optional but do it), repo link, live URL
- [ ] Team details (max 4; keep ≤3 for Kiroween)

### Kiroween (by Dec 4 PT = **Dec 5, 3:30 am IST**; aim for Dec 3)
- [ ] Category: **Frankenstein**; bonus: **Best Student Project**, Blog, Social Blitz, Best Demo (auto)
- [ ] Public GitHub repo, MIT license visible in About, `/.kiro` committed
- [ ] Live URL (+ APK link if native) and testing instructions for judges, including **how to test with and without TalkBack**
- [ ] YouTube video < 3:00, public, no copyrighted music
- [ ] Kiro write-up (`docs/KIRO_WRITEUP.md`): specs, hooks, steering, PBT (P1–P13 + real bug caught), MCP, tools compared
- [ ] Student details for every team member (LinkedIn, student email, year, degree, school)
- [ ] Blog post on a third-party platform, published during the submission period, mentioning **Kiroween 2026** (draft by Claude Code, rewritten in the user's own voice)
- [ ] Social post **starting with** `#KiroweenHackathon26`, sharing the user's favourite Kiro feature and how it changed their approach — judged for original thought, so the user writes it; Claude Code only suggests points
- [ ] Kiro credits requested before **Dec 1** (user)
- [ ] Disclose pre-existing work: `prototypes/haptics-test.html` was built Oct 31, 2026 during the submission period

---

## 6. Demo video (≤ 3:00) — final structure
1. **0:00–0:15** Hook: real student's hands tracing a triangle, phone buzzing, "Point B" spoken. Title card: *Ghost Touch — feel diagrams you can't see.*
2. **0:15–0:35** Problem: diagrams lock blind students out of STEM; Dot Pad costs lakhs; tactile graphics take weeks. They already own an Android phone.
3. **0:35–0:55** The creature: buzzer = nerves, vision AI = eyes, synthesizer = voice.
4. **0:55–1:50** End-to-end: teacher snaps a textbook page → student explores **with TalkBack on** → asks "How long is AC?" → spoken answer. Then graph + theremin.
5. **1:50–2:10** Never fails: messy photo → Raw Mode outlines.
6. **2:10–2:35** Evidence: BPA session numbers + one quote.
7. **2:35–3:00** Built with Kiro: specs → tasks, hooks firing, property tests passing. Close on the creature.

---

## 7. Risk register
| Risk | Status | Mitigation |
|---|---|---|
| TalkBack blocks touch exploration | **Solved in code via pass-through gesture** (A1 passes in code and emulation; unverified on physical hardware) | Explore uses double-tap-and-hold then drag, announced on entry; relative-cursor design; Android Back exit. Remaining: physical phone testing per `docs/OWNER_CHECKLIST.md`; Capacitor only as optional Phase 2 |
| Vision LLM inaccurate on photos | Untested | Gate B; digital-first input; teacher correction |
| Kiro credits run out (50 free) | Active | User requests 4,000 now; Kiro used for core + reviews only |
| BPA can't schedule before Nov 15 | Possible | VIT Bhopal alternative; online follow-up |
| Free-tier rate limits on demo day | Possible | Nebius fallback provider; cache by image hash; offline samples |
| Exams / travel on Nov 15 | Certain | Submit STEMergent Nov 14; feature freeze Nov 13 |
| "Insufficient use of Kiro" | Managed | Ownership split; evidence plan §3; honest BUILD_LOG |
| Frankenstein fit judged weak | Possible | Lead with the creature framing + strongest demo; impact carries it |

---

## 8. Competitor table (for submissions — keep it factual)
| Product | What it does | Gap vs. Ghost Touch |
|---|---|---|
| Dot Pad | Refreshable tactile pin display for graphics | ~£6,500–7,800 hardware |
| Microsoft Seeing AI (explore photo) | Touch a photo, hear people/objects | Not built for STEM diagrams; no line/corner haptics; no maths Q&A |
| Desmos Audio Trace | Sonifies graphs | Equations/data typed in, not photos |
| Grafici Accessibili (Univ. Padova) | Android tablet app with haptic points for 3 function types | Typed equations, tablet, no photos |
| TouchSight (hackathon) | Photo → embosser/3D-print tactile sheet + voice | Needs embosser/printer; no phone haptics; not user-tested |
| Raised Lines Foundation / IIT Delhi | Physical tactile textbooks | Slow, not on demand |

Keep the full source list in `docs/research/competitors.md`.

---

## 9. What Claude Code does first (right now)
1. Create `docs/research/` with `talkback-spike.md` (test table from Gate A, empty results), `vision-spike.md`, and `competitors.md` (table §8 + sources the user gives you).
2. Write `research/vision_spike.py` + `research/README.md` (how to run it on Windows with the backend venv and `GEMINI_API_KEY`).
3. Write the T05 and T06 briefs (unchanged from the spec, but T06 must include screenshot/PDF upload, and all screens must work with TalkBack on).
4. Write `docs/user-test/plan.md` from §4.
5. Log all of this in `docs/BUILD_LOG.md`.
6. Reply to the user with: the Gate A test steps (short, phone-friendly), how to run the vision spike, and the exact message to give agy for T05.

---

## 10. Honest Disclosures, Known Limits & Open Items
- **Hardware Verification Pending:** TalkBack pass-through gesture, Guide-my-finger haptics/pan, and Teacher verify QR sharing are unverified on physical phone hardware (`docs/OWNER_CHECKLIST.md`). Guide and Share remain flagged OFF by default (`VITE_FEATURE_GUIDE=1`, `VITE_FEATURE_SHARE=1`).
- **Open Round 2 Items (No 'bug free' or 'secure' claims):** Active security and bug audits remain ongoing. Open items: CORE-09 (lost pointer capture on canvas boundary traversal) and NEEDS-KIRO-02 (`hapticEngine.ts:132` line tone sequencing).
- **Spec Ghost (`frontend/src/verify`):** Experimental consistency check designed to detect impossible shapes; not yet wired into the main flow; parse rate is ~35% on real scenes.
- **Data Privacy Architecture:** All diagram processing is stateless in RAM; images are never written to disk or database (see `docs/PRIVACY.md`).
- **BPA Ahmedabad Testing:** In-person user testing sessions at the Blind People's Association in Ahmedabad are pending.
