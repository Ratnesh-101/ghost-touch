# Audit Report: Lane r5-docs-claims (Factual Claims Audit)

**Status: DONE**  
**Auditor:** agy, reviewed by Claude  
**Date:** 2026-11-09  
**Scope:** Comprehensive factual audit across 8 project documentation and submission files:
`README.md`, `docs/STEMERGENT_SUBMISSION.md`, `docs/BLOG.md`, `docs/SOCIAL.md`,
`docs/DEMO_SCRIPT.md`, `docs/KIRO_WRITEUP.md`, `docs/PRIVACY.md`, `docs/DEPLOY.md`.
All claims were cross-checked against codebase implementations, configuration files,
test suites, and `docs/BUILD_LOG.md`.

---

## 1. Executive Summary

This audit evaluated all factual claims in the project's outward-facing documentation, submission
drafts, social announcements, demo script, write-up, privacy policy, and deployment guide.

Key findings include:
1. **Stale open-issue claims (HIGH · 6 files):** `README.md`, `STEMERGENT_SUBMISSION.md`,
   `BLOG.md`, `SOCIAL.md`, `DEMO_SCRIPT.md`, and `DEPLOY.md` all claim that Round 2 defect
   `CORE-09` (pointer capture) and `NEEDS-KIRO-02` (line tone sequencing) remain open.
   Both were fixed and verified by Kiro in Round 3 (`docs/BUILD_LOG.md:2448`).
2. **False "Spec Ghost unwired" claims (HIGH · 5 files):** Five scoped files claim Spec Ghost
   is "not yet wired into the main flow". Spec Ghost was wired into Explore and Ask by lane
   k1 and moved to pure core in Task 29 (`frontend/src/core/verify.ts`).
3. **Misleading "Verified by" teacher share banner (HIGH · 3 files):** `README.md`,
   `STEMERGENT_SUBMISSION.md`, and `DEMO_SCRIPT.md` claim students see a `"Verified by [Teacher]"`
   or `"✓ Verified by Mrs. Sharma"` banner. Lane m3 eliminated "Verified" badges from shared
   links to avoid false trust, stripping checkmarks and changing the text to "Shared by [Teacher],
   not checked" with an honesty disclaimer (`frontend/src/components/VerifiedBanner.tsx`).
4. **Impossible demo script steps (HIGH · `DEMO_SCRIPT.md`):** The demo script instructs the
   narrator to trace to vertex B in the sample triangle and hear "Point B. Right angle."
   In `frontend/public/samples/triangle.json`, the right angle is at vertex C; vertex B is an
   acute angle. Tracing to B will only speak "B" or "Point B". Additionally, the script's
   teacher-share demo ignores the mandatory `ShareGate` user activation screen.
5. **Hardware tuning overclaims (HIGH · 2 files):** `STEMERGENT_SUBMISSION.md` and
   `KIRO_WRITEUP.md` claim haptic parameters were tuned on a physical OnePlus Nord CE6 device.
   `docs/OWNER_CHECKLIST.md` confirms end-to-end phone testing on hardware is unverified and pending.
6. **Incomplete multi-agent attribution (MED · 6 files):** Documentation stops attribution at
   Round 2, omitting Kiro's Round 3 contributions (Tasks 29, 30–32, 34 Ghostwriter core P54–P57,
   and 35) and Antigravity's creation of Spec Ghost and lanes m1–m3, n1, n2.

---

## 2. HIGH Severity Findings

#### HIGH · README.md:156
- **Problem:** `README.md:156` claims:
  `"Two Round 2 items remain OPEN: CORE-09 (lost pointer capture on canvas boundary traversal) and NEEDS-KIRO-02 (hapticEngine.ts:132 line tone sequencing)."`
  This claim is factually false. Both items were fixed by Kiro in Round 3 on 2026-11-09
  (commit `3dc1e21`).
- **Code Evidence:**
  `docs/BUILD_LOG.md:2448` explicitly states: `"9.3 no longer lists CORE-09 and NEEDS-KIRO-02 as open"`.
  `docs/KIRO_WRITEUP.md:289` confirms: `"The Round 2 items CORE-09 and NEEDS-KIRO-02 were fixed by Kiro in Round 3 (docs/reviews/kiro-round2.md); later audits may still find more."`
  `frontend/src/core/hapticEngine.ts:28-29` and `frontend/tests/round3.kiro.prop.test.ts` implement
  P51 covering `NEEDS-KIRO-02`.
- **Concrete failure scenario:** Evaluators inspecting the codebase will find that both defects
  already have dedicated regression property tests passing in CI. Claiming they are open misinforms
  judges and suggests the maintainers do not know the state of their own bug tracker.
- **Minimal fix:**
  ```markdown
  - **Security & bug audits ongoing (no "bug free" or "secure" claims):** Comprehensive audits are actively ongoing. Round 2 items CORE-09 (pointer capture) and NEEDS-KIRO-02 (tone sequencing) were resolved in Round 3; subsequent audits continue to track edge-case refinements.
  ```

#### HIGH · README.md:157
- **Problem:** `README.md:157` claims:
  `"Spec Ghost status: Spec Ghost (frontend/src/verify) is an experimental client-side geometric consistency check designed to detect impossible shapes; it is not yet wired into the main flow, and has a measured parse rate of ~35% on real-world scenes."`
  This claim is factually false. Spec Ghost is fully wired into both Explore and Ask, and its pure
  logic was moved to `frontend/src/core/verify.ts`.
- **Code Evidence:**
  In `frontend/src/flow/navigation.ts:46`, `exploreAnnouncement` invokes `verifyCaveatForScene(scene, mode)`.
  In `frontend/src/flow/ask.ts:983`, `askCaveatForScene` attaches consistency caveats to Ask answers.
  In `frontend/src/App.tsx:46-50`, `verifyCaveatForScene` is imported and used.
  `docs/BUILD_LOG.md:2427` confirms: `"built by Antigravity: the module, its first tests P47-P50 and the k1 wiring."`
  `docs/BUILD_LOG.md:2429` confirms: `"it moved with git mv to frontend/src/core/verify.ts. frontend/src/verify/verify.ts is now a one-line re-export... flow/ask.ts and flow/navigation.ts import from core."`
- **Concrete failure scenario:** A user exploring a diagram with contradictory dimensions (such
  as ground truth sample `01_right_triangle.json`) hears the spoken caveat: *"Facts and drawing
  disagree on AB. I can't tell which is right."* If judges read the README claiming the feature
  is "not yet wired", they will assume the spoken warning is a phantom bug or uncommitted prototype.
- **Minimal fix:**
  ```markdown
  - **Spec Ghost status:** Spec Ghost (`frontend/src/core/verify.ts`) is a client-side geometric consistency check between printed facts and diagram drawings, wired into Explore and Ask by lane k1. It never claims "verified", remains silent when uncertain, and parses facts on ~35% of sample/research scenes (21 of 60).
  ```

#### HIGH · README.md:34
- **Problem:** `README.md:34` claims:
  `"Students open shared diagrams instantly and offline, greeted by a spoken 'Verified by [Name]' announcement and banner with zero server round-trips."`
  Lane m3 intentionally removed the word "Verified" and decorative checkmarks from shared links to
  eliminate misleading authority assertions (Requirement R1/R3).
- **Code Evidence:**
  `frontend/src/components/VerifiedBanner.tsx:6-7` states: `"Spoken and visible label says 'Shared by <name>, not checked' style wording (never 'Verified' for link content)."`
  `frontend/src/components/VerifiedBanner.tsx:57-59`: Leading checkmarks are stripped and text is
  rendered via `honestSharedByLabel(cleanName)`.
  `frontend/src/i18n/index.ts`: `share.sharedBy` is `"Shared by {name}, not checked"`.
  `docs/BUILD_LOG.md:2506`: `"R1: Replaced misleading 'Verified by <name>' link wording with honest attribution: 'Shared by <name>, not checked' ... Stripped decorative checkmark badge..."`
- **Concrete failure scenario:** A teacher shares a link expecting students to hear "Verified by Mrs.
  Sharma", but the student hears "Shared by Mrs. Sharma, not checked. Verified means a person
  reviewed this diagram. It is not cryptographic proof." Evaluators testing the feature will mark
  the documentation as inaccurate.
- **Minimal fix:**
  ```markdown
  - **Teacher verify & share (Flagged OFF by default, unverified on hardware):** Sighted teachers can review, adjust, and sign diagrams with their name and note at `#/teach`. Diagrams are compressed into URL fragment hashes (`#s=...`) using `lz-string` and shared via direct link or on-screen QR code. Students open shared diagrams offline via an accessible tap-to-open gate, greeted by an honest "Shared by [Name], not checked" banner and speech announcement. (Requires `VITE_FEATURE_SHARE=1` and Settings toggle; default OFF; unverified on hardware).
  ```

#### HIGH · docs/STEMERGENT_SUBMISSION.md:40
- **Problem:** `docs/STEMERGENT_SUBMISSION.md:40` claims:
  `"These haptic parameters were tuned for distinct perception on a physical smartphone (OnePlus Nord CE6)."`
  `docs/OWNER_CHECKLIST.md` establishes that physical testing on a OnePlus Nord CE6 has not been
  executed by the repository owner.
- **Code Evidence:**
  `docs/OWNER_CHECKLIST.md:4` states: `"Status: All items require owner action; no hardware verification is claimed in advance."`
  `docs/OWNER_CHECKLIST.md:17-36` lists Section `(B) Phone Test (OnePlus Nord CE6)` as entirely
  unchecked pending owner execution.
  `docs/STEMERGENT_SUBMISSION.md:61` contradicts line 40 directly: `"Physical Phone Verification: End-to-end testing with physical vibration motor, audio, and gestures on an actual OnePlus Nord CE6 device is unverified and pending"`.
- **Concrete failure scenario:** Competition judges auditing hardware claims may ask for evidence
  of OnePlus Nord CE6 test logs or oscilloscope / accelerometer motor traces. Since hardware tests
  have not run, asserting that parameters "were tuned on a physical smartphone" is an unverified claim.
- **Minimal fix:**
  ```markdown
  These haptic parameters were designed based on initial browser haptic spikes (`prototypes/haptics-test.html`) to target distinct perception on budget smartphones (OnePlus Nord CE6 physical phone validation remains officially pending per `docs/OWNER_CHECKLIST.md`).
  ```

#### HIGH · docs/STEMERGENT_SUBMISSION.md:46
- **Problem:** `docs/STEMERGENT_SUBMISSION.md:46` claims:
  `"Displays a 'Verified by [Teacher]' banner when loaded by students. Verification signifies human teacher review, not cryptographic proof."`
  The banner actually displays "Shared by [Teacher], not checked" per Lane m3.
- **Code Evidence:**
  `frontend/src/components/VerifiedBanner.tsx:51-59` renders `honestSharedByLabel(cleanName)`.
  `frontend/src/i18n/index.ts`: `share.sharedBy: "Shared by {name}, not checked"`.
- **Concrete failure scenario:** Judges testing shared links will observe that the banner explicitly
  avoids the word "Verified", displaying "Shared by..., not checked" instead.
- **Minimal fix:**
  ```markdown
  9. **Teacher Verify & Share (Optional / Feature Flagged OFF):** Allows sighted teachers to verify diagrams at `#/teach`, sign with their name and note, and generate offline URL fragment hashes (`#s=...`) and QR codes. Displays an honest "Shared by [Teacher], not checked" attribution banner when opened by students. Verification signifies human teacher review, not cryptographic proof. *(Feature-flagged OFF by default via `VITE_FEATURE_SHARE=1` and Settings toggle; unverified on physical hardware).*
  ```

#### HIGH · docs/STEMERGENT_SUBMISSION.md:69
- **Problem:** `docs/STEMERGENT_SUBMISSION.md:69` claims:
  `"Active open items: CORE-09 (lost pointer capture on canvas boundary traversal) and NEEDS-KIRO-02 (hapticEngine.ts:132 line tone sequencing). Spec Ghost (frontend/src/verify, parse rate ~35%) is an experimental consistency check not yet wired into the main flow."`
  Repeats the stale claims that CORE-09 and NEEDS-KIRO-02 are open, and that Spec Ghost is unwired.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2448` (CORE-09 and NEEDS-KIRO-02 fixed).
  `frontend/src/flow/navigation.ts:46`, `frontend/src/flow/ask.ts:983`, `frontend/src/core/verify.ts`
  (Spec Ghost wired).
- **Concrete failure scenario:** Direct contradiction with `docs/KIRO_WRITEUP.md:289-290` within the
  same repository.
- **Minimal fix:**
  ```markdown
  | **Security & Bug Audit in Progress:** An open security and bug audit is active; neither the application nor backend claims to be "bug free" or "secure". Round 2 items CORE-09 and NEEDS-KIRO-02 were resolved by Kiro in Round 3. Spec Ghost (`frontend/src/core/verify.ts`, parse rate ~35%) is wired into Explore and Ask announcements to flag inconsistencies between text and drawings. Diagram processing is stateless in RAM with zero disk writes (see `docs/PRIVACY.md`). |
  ```

#### HIGH · docs/BLOG.md:19
- **Problem:** `docs/BLOG.md:19` claims:
  `"Active security audits are ongoing with two open items (CORE-09, NEEDS-KIRO-02). Spec Ghost (frontend/src/verify) is an unwired consistency check (~35% parse rate)..."`
  Repeats the stale claims that CORE-09 and NEEDS-KIRO-02 are open, and that Spec Ghost is unwired.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2448`, `docs/KIRO_WRITEUP.md:289-290`, `frontend/src/flow/navigation.ts:46`.
- **Concrete failure scenario:** Readers of the blog post are told the consistency check is unwired
  even though it is actively running in Explore.
- **Minimal fix:**
  ```markdown
  Audits are ongoing (Round 2 items CORE-09 and NEEDS-KIRO-02 were resolved in Round 3). Spec Ghost (`frontend/src/core/verify.ts`) is wired into Explore and Ask to caution students when facts and drawings disagree (~35% parse rate), and our stateless in-memory data architecture is documented in `docs/PRIVACY.md`.
  ```

#### HIGH · docs/SOCIAL.md:40,79
- **Problem:**
  Line 40: `"Security audits ongoing (open items CORE-09, NEEDS-KIRO-02); Guide and Share flagged OFF by default."`
  Line 79: `"Security audits ongoing (CORE-09, NEEDS-KIRO-02 open)."`
  Repeats the stale claim that CORE-09 and NEEDS-KIRO-02 are open.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2448`, `docs/KIRO_WRITEUP.md:289`.
- **Concrete failure scenario:** Public social media posts report resolved bugs as open issues.
- **Minimal fix:**
  Line 40:
  ```markdown
  Security audits ongoing (Round 2 items CORE-09 and NEEDS-KIRO-02 resolved in Round 3); Guide and Share flagged OFF by default.
  ```
  Line 79:
  ```markdown
  Security audits ongoing (Round 2 items CORE-09 and NEEDS-KIRO-02 resolved in Round 3).
  ```

#### HIGH · docs/DEMO_SCRIPT.md:24,28
- **Problem:**
  Line 24: `"voice speaks: 'Point B. Right angle.'"`
  Line 28: `"Hitting vertex A triggers 'bzzzz-tap'... and speaks 'Point A'. Tracing to B speaks 'Point B. Right angle.'"`
  In `frontend/public/samples/triangle.json`, vertex B is NOT a right angle. The right angle is at
  vertex C. Tracing to B will only speak "B" or "Point B".
- **Code Evidence:**
  `frontend/public/samples/triangle.json:13-23`: Point B is at `(0.7, 0.85)`, Point C is at
  `(0.25, 0.85)`, Point A is at `(0.25, 0.25)`. CA is vertical and BC is horizontal; the 90° angle
  is at vertex C.
  `frontend/public/samples/triangle.json:49`: `"facts": ["angle C = 90 degrees", ...]`.
  `DEMO_SCRIPT.md:30` acknowledges this: `"Where is the right angle? Synthesizer answers deterministically from diagram facts: 'angle C = 90 degrees.'"`.
- **Concrete failure scenario:** Anyone following the script during video filming will trace to
  vertex B and hear "Point B" (or "B"), waiting in vain for "Right angle". The narration will not
  match what the phone actually speaks on camera.
- **Minimal fix:**
  In Line 24:
  ```markdown
  | **0:00–0:15** (15s) | **The Hook:** Extreme close-up of a finger tracing a glowing green line on a jet-black canvas framed by aged copper rivets and stitched seams. Motor hum is audible. At corner C, a sharp "bzzzz-tap" double pulse sounds, followed by a 450 ms quiet window, and the voice speaks: *"Point C. Right angle."* Fade in Title Card: **Ghost Touch: feel diagrams you cannot see.** | Explore screen (Right triangle on specimen table frame). | *(Silence for 7 seconds. Let the physical vibration motor hum and speech hook the audience.)* <br><br>*"Ghost Touch. Feel diagrams you cannot see."* |
  ```
  In Line 28:
  ```markdown
  | **1:15–1:40** (25s) | **Live Tactile Exploration:** Tap the **Right triangle** specimen card (zero network needed). A brief spark arc flashes as Explore opens. Finger traces lines (continuous buzz `vibrate(80)` every 70 ms). Hitting vertex A triggers "bzzzz-tap" (`vibrate([50, 90, 50])`), 450 ms quiet period, and speaks *"Point A"*. Tracing along the vertical leg to C speaks *"Point C. Right angle."* <br><br>*[OPTIONAL — TalkBack Pass-Through]: Demonstrate double-tap-and-hold relative drag with 25 ms centre tick. (Note: TalkBack hardware verification on physical device is pending).* | Explore screen (Specimen table, pure black canvas, glowing green strokes). | *"Tracing a line buzzes continuously under your finger. Hitting a corner triggers a distinct double-pulse with a 450-millisecond quiet window so vertices stand out clearly. Students can also explore using TalkBack's double-tap-and-hold pass-through gesture anchored by a centre reference tick."* |
  ```

#### HIGH · docs/DEMO_SCRIPT.md:48-49
- **Problem:**
  Line 48: `"Student phone scans QR code; Explore opens cold and completely offline with banner: '✓ Verified by Mrs. Sharma'."`
  Line 49: `"Narration: '...taps Mark verified...'"`
  This demo beat fails to reflect two real features implemented in Lane m3:
  1. Cold links open `ShareGate` first (`frontend/src/components/ShareGate.tsx`) with a large button
     ("Open the shared diagram") so user interaction unlocks audio context. Explore does not open cold.
  2. The banner never shows `"✓ Verified by Mrs. Sharma"`; checkmarks are stripped and the text reads
     `"Shared by Mrs. Sharma, not checked"`.
  3. If `VITE_FEATURE_SHARE` is not set to `1` on the student device, the URL hash is ignored.
- **Code Evidence:**
  `frontend/src/components/ShareGate.tsx:1-50`.
  `frontend/src/components/VerifiedBanner.tsx:51-59`.
  `frontend/src/App.tsx:118` (`if (!isFeatureOn) return { kind: 'ignored' };`).
  `docs/BUILD_LOG.md:2506`.
- **Concrete failure scenario:** Filming this beat as written will produce footage showing the
  "Open the shared diagram" gate button and "Shared by Mrs. Sharma, not checked" banner, contradicting
  the script's visual notes and spoken narration.
- **Minimal fix:**
  ```markdown
  ### [OPTIONAL] Beat B: Teacher Verify & Share (19s)
  - **Visual:** Sighted teacher on laptop at `#/teach` adjusts a vertex, enters name *"Mrs. Sharma"* and note *"Verified for Class 9 Geometry"*, then clicks **"Mark verified"**. App generates a compressed URL fragment hash (`#s=...`) and on-screen QR code (zero server storage). Student phone scans QR code; ShareGate opens cold; student taps "Open the shared diagram" to unlock audio; Explore opens offline with honest banner: *"Shared by Mrs. Sharma, not checked"*.
  - **Narration:** *"Teachers can prepare and distribute diagrams in seconds. In the teacher editor, a teacher adjusts a vertex, enters their name, and generates an offline QR code. The student scans it, taps to open, and explores the diagram directly from the URL hash—completely offline, with an honest attribution banner and zero server storage."*
  - **Status:** *Code complete behind `VITE_FEATURE_SHARE=1` and settings toggle; physical hardware verification pending.*
  ```

#### HIGH · docs/DEMO_SCRIPT.md:75
- **Problem:** `docs/DEMO_SCRIPT.md:75` claims:
  `"with open Round 2 items CORE-09 (lost pointer capture on canvas boundary traversal) and NEEDS-KIRO-02 (hapticEngine.ts:132 line tone sequencing). Spec Ghost (frontend/src/verify) is an unwired consistency check (~35% parse rate)"`
  Repeats the stale claim that CORE-09 and NEEDS-KIRO-02 are open, and that Spec Ghost is unwired.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2448`, `docs/KIRO_WRITEUP.md:289-290`.
- **Concrete failure scenario:** Demo video script advises presenters not to claim bug-free status
  by citing closed bugs as active failures.
- **Minimal fix:**
  ```markdown
  8. **No claims of bug-free or completely secure code:** Security and bug audits are actively ongoing (Round 2 items CORE-09 and NEEDS-KIRO-02 were resolved in Round 3). Spec Ghost (`frontend/src/core/verify.ts`) is an active consistency check wired into Explore and Ask (~35% parse rate), and privacy details are documented in `docs/PRIVACY.md`.
  ```

#### HIGH · docs/KIRO_WRITEUP.md:56
- **Problem:** `docs/KIRO_WRITEUP.md:56` claims:
  `"To prevent haptic feedback from blurring into indistinguishable vibration, physical motor timings were tuned on real hardware (OnePlus Nord CE6) and locked in tech.md:"`
  `docs/OWNER_CHECKLIST.md` establishes that physical phone testing on the OnePlus Nord CE6 has not
  been performed.
- **Code Evidence:**
  `docs/OWNER_CHECKLIST.md:17-36` (OnePlus Nord CE6 testing is unchecked and pending).
  `docs/KIRO_WRITEUP.md:287` confirms: `"Automated test suites and browser emulation pass cleanly, but physical vibration motor strength, live TalkBack pass-through gesture tracking, and headphone stereo pan are unverified on physical phone hardware (docs/OWNER_CHECKLIST.md)."`
- **Concrete failure scenario:** Internal contradiction within `docs/KIRO_WRITEUP.md` between line
  56 (claims tuning on real OnePlus Nord CE6) and line 287 (discloses hardware is unverified).
- **Minimal fix:**
  ```markdown
  To prevent haptic feedback from blurring into indistinguishable vibration, haptic timings were initially prototyped in `prototypes/haptics-test.html` to target OnePlus Nord CE6 hardware constraints and locked in `tech.md` (physical hardware verification remains officially pending per `docs/OWNER_CHECKLIST.md`):
  ```

#### HIGH · docs/DEPLOY.md:241-242
- **Problem:** `docs/DEPLOY.md:241-242` claims:
  `"- Security & Bug Audits Ongoing: No claims of 'bug free' or 'secure' software. Active open Round 2 items: CORE-09 (lost pointer capture on canvas boundary traversal) and NEEDS-KIRO-02 (hapticEngine.ts:132 line tone sequencing)."`
  `"- Spec Ghost (frontend/src/verify): Experimental client-side geometric consistency check; not yet wired into the main flow; parse rate is ~35% on real-world scenes."`
  Repeats the stale claim that CORE-09 and NEEDS-KIRO-02 are open, and that Spec Ghost is unwired.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2448`, `docs/KIRO_WRITEUP.md:289-290`, `frontend/src/flow/navigation.ts:46`.
- **Concrete failure scenario:** System administrators following deployment instructions are given
  stale operational limits.
- **Minimal fix:**
  ```markdown
  - **Security & Bug Audits Ongoing:** No claims of "bug free" or "secure" software. Round 2 items CORE-09 (pointer capture) and NEEDS-KIRO-02 (tone sequencing) were resolved by Kiro in Round 3.
  - **Spec Ghost (`frontend/src/core/verify.ts`):** Client-side geometric consistency check wired into Explore and Ask announcements; parse rate is ~35% on real-world scenes.
  ```

---

## 3. MEDIUM Severity Findings

#### MED · README.md:52,64,125-128
- **Problem:** `README.md:52, 64, 125-128` presents the vision fallback chain as `OpenAI → Gemini →
  Nebius → Raw Mode`, describing OpenAI as the primary provider and Gemini as fallback.
  In the codebase architecture, `Gemini` is the primary default provider and `OpenAI` is the first
  fallback. The `openai,gemini,nebius` order is an override configured only in the Render deployment
  blueprint (`render.yaml`).
- **Code Evidence:**
  `backend/app/vision/__init__.py:20`: `DEFAULT_PROVIDER_ORDER = "gemini,openai,nebius"`.
  `backend/app/vision/__init__.py:27-28`: `"...Treats empty or unset VISION_PROVIDERS as 'gemini,openai,nebius' (Gemini first, then OpenAI, then Nebius as the last fallback...)"`.
  `backend/app/main.py:4`: `"...with Gemini primary, OpenAI and Nebius fallbacks, and OpenCV Raw Mode..."`.
  `backend/app/vision/openai_provider.py:1`: `"OpenAI vision provider: the first fallback after Gemini."`.
  `render.yaml:42-43`: Configures `VISION_PROVIDERS: openai,gemini,nebius` for Render deployment.
  `docs/PRIVACY.md:67` accurately notes this distinction: `"As configured in render.yaml, the default deployment order is openai,gemini,nebius. The code default in backend/app/vision/__init__.py is gemini,openai,nebius."`.
- **Concrete failure scenario:** A developer running the backend locally per `README.md:116-118`
  with only a `GEMINI_API_KEY` set will find that Gemini works as the primary provider without
  setting `VISION_PROVIDERS`. If they configure only `OPENAI_API_KEY`, requests fail until they
  either supply a Gemini key or explicitly override `VISION_PROVIDERS`.
- **Minimal fix:**
  In Line 52:
  ```text
  Photo / PDF ──> FastAPI Backend ──> Vision Chain (Gemini [code default] / OpenAI [Render default] ──> Nebius ──> Raw Mode)
  ```
  In Line 64:
  ```markdown
  - **FastAPI backend (`backend/`):** Orchestrates the multi-provider vision chain (Google Gemini primary in code default, OpenAI primary in production `render.yaml`, Nebius fallback, OpenCV Canny edge detection in `Raw Mode`), validates JSON schema invariants, and provides Q&A endpoints.
  ```
  In Line 128:
  ```markdown
  | `VISION_PROVIDERS` | Backend | Provider fallback order (codebase default: `gemini,openai,nebius`; Render production: `openai,gemini,nebius`) |
  ```

#### MED · README.md:98-100
- **Problem:** The tool attribution matrix in `README.md:98-100` stops at Round 2.
  It omits Kiro's Round 3 contributions (Tasks 29, 30–32, 34 Ghostwriter core P54–P57, and 35) and
  Antigravity's role in building Spec Ghost and executing lanes m1–m3, n1, n2.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2426-2621`.
  `docs/KIRO_WRITEUP.md:183-184, 282`.
- **Concrete failure scenario:** Readers evaluating Kiroween judging criteria ("What Kiro Did vs
  What Agents Did") receive an incomplete summary that underclaims both Kiro's and Antigravity's
  later engineering work.
- **Minimal fix:**
  In Line 98 (Kiro):
  Append: `• Round 3: Authored Spec Ghost spec (Req 18), steering, and review (moving to core/verify.ts with aspect/unit fixes); resolved CORE-09 and NEEDS-KIRO-02 (P51); hit-test optimizations (P52, P53); Ghostwriter core addPoint/addSegment (Req 19, P54–P57); and localized angle naming (Task 35).`
  In Line 99 (Antigravity):
  Append: `• Built Spec Ghost fact-checking module (P47–P50) and k1 Explore/Ask wiring; built lanes m1 (a11y/tokens), m2 (test quality), m3 (ShareGate/honesty copy), n1 (backend stability), and n2 (frontend persistence/504 retry fix).`

#### MED · docs/STEMERGENT_SUBMISSION.md:27
- **Problem:** `docs/STEMERGENT_SUBMISSION.md:27` states:
  `"...announces the vertex label (e.g., 'Point B, Right angle')..."`
  In `frontend/public/samples/triangle.json`, vertex B is NOT a right angle (angle C is the right
  angle). Vertex B's label is `"B"`.
- **Code Evidence:**
  `frontend/public/samples/triangle.json:13-23,49`.
- **Concrete failure scenario:** A competition reviewer running the app will tap vertex B on the
  sample triangle and observe that it does not say "Right angle".
- **Minimal fix:**
  ```markdown
  announces the vertex label (e.g., "Point C, Right angle" or "Point A")
  ```

#### MED · docs/STEMERGENT_SUBMISSION.md:52-54,62
- **Problem:** In `docs/STEMERGENT_SUBMISSION.md:52-54,62`, property counts and tool attributions
  stop at P46 and Round 2. Tasks 29–35 (properties P47–P57) and lanes m1–m3, n1, n2 are omitted.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2426-2621`.
- **Concrete failure scenario:** Underclaims property coverage (claims 46 properties instead of 57).
- **Minimal fix:**
  In Line 52 (Kiro): Append Round 3 tasks (Spec Ghost Req 18 review, CORE-09, P51–P53, Task 34
  Ghostwriter P54–P57, Task 35).
  In Line 53 (Antigravity): Append Spec Ghost module creation (P47–P50), lanes m1–m3, n1, n2.
  In Line 62: Update range to `P1–P57` (P47–P50 by agy; P51–P57 by Kiro).

#### MED · docs/BLOG.md:15
- **Problem:** `docs/BLOG.md:15` attribution ends at Round 2, omitting Kiro's Round 3 work and
  Antigravity's Spec Ghost and hardening lanes.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2426-2621`.
- **Concrete failure scenario:** Incomplete attribution for hackathon write-up blog.
- **Minimal fix:**
  Update paragraph to mention Kiro's Round 3 contributions (Spec Ghost review, CORE-09, P51–P53,
  Ghostwriter P54–P57) and Antigravity's Spec Ghost build and post-round hardening.

#### MED · docs/SOCIAL.md:16,38,73-76
- **Problem:** Social media drafts omit Round 3 and properties P47–P57 from tool descriptions.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2426-2621`.
- **Concrete failure scenario:** Inaccurate summary of tool contributions in public posts.
- **Minimal fix:**
  Update Post 3/4 and Medium post attribution to include Round 3 and total property suite count.

#### MED · docs/DEMO_SCRIPT.md:33,72
- **Problem:** Demo script closing attribution omits Round 3 contributions.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2426-2621`.
- **Concrete failure scenario:** Presenter gives outdated credit breakdown in closing seconds of video.
- **Minimal fix:**
  Update line 33 and line 72 attribution to acknowledge Round 3 (Kiro for pure core P1–P13, P40–P46,
  P51–P57; Antigravity for Lab redesign, Spec Ghost, and hardening lanes).

#### MED · docs/DEMO_SCRIPT.md:43
- **Problem:** `docs/DEMO_SCRIPT.md:43` instructs the user to tap the "Guide me" button:
  `"In Explore, tap Ask → ask 'Where is the right angle?' → tap glowing 'Guide me' button."`
  The "Guide me" button (`data-testid="explore-guide-me"`) is conditionally rendered only when
  `isGuideActive()` evaluates to true. In default deployments, `VITE_FEATURE_GUIDE` is unset, so the
  button is omitted from the DOM.
- **Code Evidence:**
  `frontend/src/screens/Explore.tsx:1351`: `{offeredTarget && isGuideActive() && (`.
  `frontend/src/config/features.ts:35-37`: Requires `VITE_FEATURE_GUIDE === '1'` and user toggle.
- **Concrete failure scenario:** If a presenter tries to film this optional beat on a standard build
  without enabling the flag and setting, the "Guide me" button will not appear.
- **Minimal fix:**
  ```markdown
  - **Visual:** *(Pre-requisite: ensure `VITE_FEATURE_GUIDE=1` is set in build and enabled in Lab Settings)*. In Explore, tap Ask → ask *"Where is the right angle?"* → tap glowing **"Guide me"** button. Spoken prompt *"Guiding to C"*. Finger moves outward...
  ```

#### MED · docs/KIRO_WRITEUP.md:129,131,184,282
- **Problem:** In `docs/KIRO_WRITEUP.md:129, 131`, the section heading reads `Property-Based Testing
  (P1–P53)` and states the project verifies `46 mathematical and behavioural invariants`.
  Task 34 added Ghostwriter properties P54–P57 (`frontend/tests/correct.ghostwriter.prop.test.ts`),
  and Task 35 updated angle localization. Lines 184 and 282 omit Tasks 34 and 35 from Kiro's matrix.
- **Code Evidence:**
  `docs/BUILD_LOG.md:2617-2621` (Tasks 34 and 35).
  `frontend/tests/correct.ghostwriter.prop.test.ts` (contains P54, P55, P56, P57).
- **Concrete failure scenario:** The write-up claims 46/53 properties, undercounting the 57
  properties verified in the repository.
- **Minimal fix:**
  Update heading to `(P1–P57)`, update count to `57 mathematical and behavioural invariants`, and add
  Task 34 (Ghostwriter `addPoint`/`addSegment`, Req 19, P54–P57) and Task 35 (M4-10 angleName) to
  the Round 3 attribution rows.

---

## 4. LOW Severity Findings

#### LOW · docs/STEMERGENT_SUBMISSION.md:30
- **Problem:** `docs/STEMERGENT_SUBMISSION.md:30` states:
  `"...receiving short, grounded spoken answers derived strictly from verified diagram geometry and facts..."`
  Uses the overclaim word "verified". AI-extracted diagram geometry and facts can contain detection
  errors; calling them "verified" conflicts with project honesty rules.
- **Code Evidence:**
  `docs/briefs/agy-r5-docs-claims.md` ("words like secure / bug-free / verified / private").
  `frontend/src/core/verify.ts:1-12` (implemented specifically to catch unverified discrepancies).
- **Concrete failure scenario:** Evaluators may question whether the system guarantees verified
  accuracy on camera inputs.
- **Minimal fix:**
  ```markdown
  receiving short, grounded spoken answers derived strictly from detected diagram geometry and facts, backed by deterministic mathematical extraction.
  ```

#### LOW · docs/STEMERGENT_SUBMISSION.md:64
- **Problem:** `docs/STEMERGENT_SUBMISSION.md:64` names the IndexedDB database `ghost-touch-db`.
  The actual database name defined in `diagramStore.ts` is `ghost-touch`.
- **Code Evidence:**
  `frontend/src/drivers/diagramStore.ts:94`: `const DB_NAME = 'ghost-touch';`.
- **Concrete failure scenario:** A developer or technical evaluator looking for `ghost-touch-db` in
  Chrome DevTools Application > Storage > IndexedDB will find `ghost-touch`.
- **Minimal fix:**
  ```markdown
  Client-side IndexedDB diagram storage (`ghost-touch`), Saved Diagrams screen with specimen cards...
  ```

#### LOW · docs/BLOG.md:11-12
- **Problem:** `docs/BLOG.md:11-12` states:
  `"...receive concise answers drawn strictly from verified facts."`
  Uses the overclaim word "verified".
- **Code Evidence:**
  `docs/briefs/agy-r5-docs-claims.md`.
- **Concrete failure scenario:** Overstates model accuracy.
- **Minimal fix:**
  ```markdown
  receive concise answers drawn strictly from extracted diagram facts and deterministic geometry.
  ```

---

## 5. Sound Claims (Checked and Verified Against Code)

- **In-Memory Stateless Caching (`PRIVACY.md:96-105`):** Verified. `backend/app/scene_cache.py`
  stores SHA-256 hashes of `(image bytes + prompt + version)`, holds only `DiagramScene` JSON
  dictionaries in RAM, caps at 64 entries, and expires after 6 hours (21,600 s). Uploaded image
  bytes are never stored in cache or written to server disk.
- **Privacy Logging Sanitation (`PRIVACY.md:118-124`):** Verified. In `backend/app/ask.py:965, 996`,
  the logger records only `question_len=%d` and `scene_points=%d`. Student question strings and
  raw audio are never logged on the backend.
- **Client-Side Diagram Storage Limits (`PRIVACY.md:134-144`):** Verified. `SAVED_DIAGRAMS_CAP = 20`
  is strictly enforced in `frontend/src/core/savedDiagrams.ts:36`, and thumbnails are synthetic
  120×120 px canvas vector drawings (`renderSceneThumbnail`), not camera photos.
- **Zero Third-Party Telemetry (`PRIVACY.md:168-177`):** Verified. Neither `frontend/package.json`
  nor `backend/pyproject.toml` contains analytics, tracking, or telemetry SDKs.
- **Raw Mode Deterministic Fallback (`README.md:19, 160`):** Verified. `backend/app/raw_mode.py` runs
  classical OpenCV Canny edge detection when AI providers fail or time out, returning up to 300
  normalized segments without external network requests.
- **WCAG AAA Contrast and 48×48 px Targets (`README.md:85-87`):** Verified. Laboratory tokens in
  `frontend/src/styles/tokens.css` meet ≥ 7:1 contrast on `#0b0e0c`, and all interactive buttons
  enforce `.gt-control` (min 48×48 CSS px).
- **Theremin Pitch Range (`README.md:30, 44`):** Verified. `frontend/src/core/pitch.ts:25-27`
  strictly bounds audio oscillator frequency to `[200, 1000]` Hz mapped monotonically to y-height.
- **Haptic Timings (`README.md:37-47`):** Verified. `frontend/src/core/hapticEngine.ts:65-72` matches
  the locked `tech.md` table: line `80 ms` / retrigger `70 ms`, corner `[50, 90, 50] ms`, and
  quiet window `450 ms`.
- **PWA and Offline Capabilities (`README.md:90`):** Verified. `frontend/vite.config.ts` configures
  `vite-plugin-pwa` with offline precaching; bundled samples load locally from `/samples/*.json`.
- **TalkBack Pass-Through Gesture Qualification (`README.md:31, 154`):** Verified. Pass-through
  gesture logic is implemented in code (`frontend/src/screens/Explore.tsx`), but correctly
  disclosed as unverified on physical phone hardware.
- **Render Free-Tier Cold Starts (`README.md:18`, `DEPLOY.md:223-234`):** Verified. Accurately notes
  that the Render container sleeps after 15 minutes of inactivity and takes 30–60 seconds (up to 70 s)
  to wake up.

---

## 6. Document Correction Summary Table

| Document | Target Lines | Current Problem | Corrected Direction |
|---|---|---|---|
| `README.md` | 34 | Claims `"Verified by [Name]"` banner | Change to `"Shared by [Name], not checked"` per m3 |
| `README.md` | 52, 64, 128 | Calls OpenAI primary vision provider | Clarify Gemini is code default; OpenAI is Render default |
| `README.md` | 98–100 | Attribution stops at Round 2 | Add Kiro Round 3 (Req 18, T30–T35) & agy Spec Ghost/lanes |
| `README.md` | 156 | Claims CORE-09 & NEEDS-KIRO-02 are OPEN | State they were resolved by Kiro in Round 3 |
| `README.md` | 157 | Claims Spec Ghost is NOT wired into main flow | State it is wired into Explore and Ask by lane k1 |
| `STEMERGENT_SUBMISSION.md` | 27 | Gives `"Point B, Right angle"` as example | Change to `"Point C, Right angle"` (sample right angle is at C) |
| `STEMERGENT_SUBMISSION.md` | 30 | Uses `"verified diagram geometry and facts"` | Replace with `"detected diagram geometry and facts"` |
| `STEMERGENT_SUBMISSION.md` | 40 | Claims timings tuned on physical OnePlus Nord | Clarify hardware validation is pending per OWNER_CHECKLIST |
| `STEMERGENT_SUBMISSION.md` | 46 | Claims `"Verified by [Teacher]"` banner | Change to `"Shared by [Teacher], not checked"` per m3 |
| `STEMERGENT_SUBMISSION.md` | 52–54, 62 | Attribution & properties stop at P46 | Update to P57 and add Round 3 / lane contributions |
| `STEMERGENT_SUBMISSION.md` | 64 | Names database `ghost-touch-db` | Correct database name to `ghost-touch` |
| `STEMERGENT_SUBMISSION.md` | 69 | Claims CORE-09/NEEDS-KIRO open, Spec Ghost unwired | State bugs resolved and Spec Ghost wired |
| `BLOG.md` | 11–12 | Uses `"verified facts"` | Change to `"extracted diagram facts"` |
| `BLOG.md` | 15 | Attribution stops at Round 2 | Add Round 3 contributions for Kiro and agy |
| `BLOG.md` | 19 | Claims CORE-09/NEEDS-KIRO open, Spec Ghost unwired | State bugs resolved and Spec Ghost wired |
| `SOCIAL.md` | 16, 38, 73–76 | Attribution stops at Round 2 | Update attribution to include Round 3 & P57 |
| `SOCIAL.md` | 40, 79 | Claims CORE-09 and NEEDS-KIRO-02 are open | Update to state resolved in Round 3 |
| `DEMO_SCRIPT.md` | 24, 28 | Narration expects "Point B. Right angle" | Change to vertex C (right angle is at C in triangle.json) |
| `DEMO_SCRIPT.md` | 33, 72 | Closing credits stop at Round 2 | Update to include Round 3 and post-round lanes |
| `DEMO_SCRIPT.md` | 43 | Assumes "Guide me" button appears by default | Note prerequisite flag `VITE_FEATURE_GUIDE=1` & toggle |
| `DEMO_SCRIPT.md` | 48–49 | Claims cold open with "✓ Verified by Mrs. Sharma" | Update to ShareGate user tap & honest banner wording |
| `DEMO_SCRIPT.md` | 75 | Claims CORE-09/NEEDS-KIRO open, Spec Ghost unwired | State bugs resolved and Spec Ghost wired |
| `KIRO_WRITEUP.md` | 56 | Claims tuned on real OnePlus Nord CE6 | Clarify hardware validation is pending per OWNER_CHECKLIST |
| `KIRO_WRITEUP.md` | 129, 131 | Claims P1–P53 and 46 invariants | Update to P1–P57 and 57 invariants |
| `KIRO_WRITEUP.md` | 184, 282 | Matrix omits Tasks 34 and 35 | Add Task 34 Ghostwriter (P54–P57) and Task 35 angleName |
| `DEPLOY.md` | 241–242 | Claims CORE-09/NEEDS-KIRO open, Spec Ghost unwired | State bugs resolved and Spec Ghost wired |
