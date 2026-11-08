# Lane b1-docs-honesty Audit Report: Public Documentation Honesty & Verifiability

**Status:** DONE  
**Auditor:** agy, reviewed by Claude  
**Date:** 2026-11-08  
**Scope:** Public documentation claims audited against the codebase, automated tests, `BUILD_LOG.md`, `.kiro/specs/`, and `docs/kiro-evidence/`.

---

## 1. Executive Summary

This audit evaluated all factual, architectural, operational, and attribution claims across the ten public-facing and planning documents of Ghost Touch. Every claim was cross-referenced against the current source code, test suites, git commit history, and runtime configuration.

### Key Audit Findings
1. **Critical Usability Misdirection in Deployment Guide (`docs/DEPLOY.md:208`):** The guide claims that dragging a single finger traces lines and generates continuous vibration/pitch while TalkBack is running. In reality, TalkBack intercepts all single-finger gestures for accessibility navigation; users MUST execute TalkBack's double-tap-and-hold pass-through gesture.
2. **Kiro Attribution Under-reporting across Major Docs (`docs/KIRO_WRITEUP.md`, `README.md`, `docs/STEMERGENT_SUBMISSION.md`, `docs/SOCIAL.md`):** Multiple documents state that Kiro's work ended at Task 13 (covering properties P1–P13 or P1–P17). In reality, Kiro returned in Tasks 19, 23, 24, and 25 to author EARS Requirements 16–17, tasks 23–28, property suites P31–P39 and P40–P46, Task 24 backend Ask fixes, and Task 25 full-stack security hardening. Under-reporting Kiro's later work violates Kiroween rules penalizing insufficient or misattributed Kiro usage.
3. **Severe Drift in Public Test Counts:** Test counts vary widely across documents (from 418 frontend / 346 backend in `docs/BLOG.md` to 1049/348 in `docs/SOCIAL.md` and 1203/422 in `README.md` and `docs/KIRO_WRITEUP.md`). The true current count is **1556 frontend tests across 113 files** and **561 backend tests** (all passing).
4. **Obsolete CI Retry Workaround in Documentation (`docs/BOTS.md:9`):** Claims CI retains a 1x retry for `hitTest.prop.test.ts` (P1). That workaround was completely removed on 2026-11-03 after Kiro fixed the generator's screen-space separation.
5. **Conflicting Vision Provider Hierarchy:** `docs/STEMERGENT_SUBMISSION.md` claims Google Gemini is the primary multimodal vision model, whereas the production Render blueprint (`render.yaml:42-43`) and `docs/DEPLOY.md` configure OpenAI as the primary provider (`VISION_PROVIDERS: openai,gemini,nebius`).

---

## 2. Scope Files Audited

1. `README.md`
2. `docs/STEMERGENT_SUBMISSION.md`
3. `docs/DEMO_SCRIPT.md`
4. `docs/KIRO_WRITEUP.md`
5. `docs/BLOG.md`
6. `docs/SOCIAL.md`
7. `docs/WIN_PLAN.md`
8. `docs/DEPLOY.md`
9. `docs/BOTS.md`
10. `docs/OWNER_CHECKLIST.md`

---

## 3. Comprehensive Claims Audit Table

| Claim | File:Line | Verdict | Evidence | Proposed Rewrite |
|---|---|---|---|---|
| **Frontend & Backend Test Counts** | `README.md:138-146` | **FALSE** (Stale) | `npm --prefix frontend test` runs **1556 tests across 113 files**; `BUILD_LOG.md:1690` (Task 25, commit `f45f04e`) confirms **561 backend tests** pass. | "Current test suite status: **1556 frontend tests across 113 files** and **561 backend tests** pass cleanly." |
| **Kiro Property Scope (P1–P15)** | `README.md:98` | **FALSE** (Stale) | `.kiro/specs/ghost-touch/design.md:140-184` defines properties **P1–P46**. Kiro authored P1–P13, P31–P39, and P40–P46. | Update table to state Kiro authored P1–P13, P31–P39, and P40–P46 across Tasks 1–4, 19, 23–25. |
| **Commit Authorship Count (303 commits)** | `README.md:94` | **FALSE** (Stale) | Commit history includes commits beyond 303 following Round 2 security and documentation merges. | "Git log history shows over 300 commits authored under the repository owner's identity..." |
| **Render Cold Start (~30s)** | `README.md:18` | **PARTLY INCONSISTENT** | `DEPLOY.md:221` states 50–70s; `DEMO_SCRIPT.md:13` states ~30–35s. Real cold boot time spans 30–60s depending on container spin-up. | "if idle, the first request takes about 30 to 60 seconds to wake up." |
| **TalkBack Single-Finger Drag** | `docs/DEPLOY.md:208` | **FALSE** (High Technical Error) | TalkBack intercepts single-finger drag for touch exploration. `WIN_PLAN.md:14` and `docs/research/talkback-spike.md` prove only pass-through (double-tap-and-hold then drag) delivers touch events. | "Dragging with TalkBack requires the pass-through gesture (double-tap-and-hold then drag); ordinary single-finger drags are consumed by TalkBack." |
| **Frontend Framework Version (React 18)** | `docs/DEPLOY.md:75` | **FALSE** (Stale) | `frontend/package.json:20` specifies `"react": "^19.3.1"`. | "The frontend is a Vite + React 19 Progressive Web App configured via `frontend/vercel.json`." |
| **P1 Generator Flake Retry in CI** | `docs/BOTS.md:9` | **FALSE** (Obsolete) | `.github/workflows/ci.yml:42-45` explicitly notes the retry workaround was removed on 2026-11-03 after Kiro fixed the generator. | Remove the note or clarify: "The previous 1x retry workaround was removed on 2026-11-03 after Kiro resolved the generator separation flake." |
| **Primary Multimodal Vision Model** | `docs/STEMERGENT_SUBMISSION.md:33, 51` | **CONFLICTING** | `STEMERGENT_SUBMISSION.md` claims Gemini is primary; `render.yaml:42` and `DEPLOY.md:36, 48` configure `openai,gemini,nebius` with OpenAI as primary. Code default in `app/vision/__init__.py:20` is `gemini,openai,nebius`. | Clarify that Gemini is the default architectural vision model in code, while production deployment on Render sets OpenAI first via `VISION_PROVIDERS`. |
| **Property Test Inventory (P1–P17 only)** | `docs/STEMERGENT_SUBMISSION.md:62` | **FALSE** (Stale) | Ignores properties P31–P46 authored by Kiro during Round 2. | "Mathematical property tests implemented and passing using fast-check and Hypothesis: P1–P46 (P1–P13, P31–P46 authored by Kiro; P10, P12, P14–P20 by Antigravity)." |
| **Blog Test Counts (418 FE / 346 BE)** | `docs/BLOG.md:19` | **FALSE** (Severely Stale) | Passes 1556 frontend tests and 561 backend tests. Numbers are from an early project milestone. | "Ghost Touch passes 1556 frontend tests and 561 backend tests..." |
| **Blog Tool Attribution** | `docs/BLOG.md:15-18` | **FALSE** (Incomplete) | Blog narrative credits only Kiro and fails to disclose Antigravity (Lab redesign, secondary core) and Claude Code (supervision). | Add explicit acknowledgement of Antigravity's role in the Frankenstein Lab redesign and Claude Code's role in supervision. |
| **Social Test Counts (1049 FE / 348 BE)** | `docs/SOCIAL.md:16, 79` | **FALSE** (Stale) | Passes 1556 frontend tests and 561 backend tests. | "1556 frontend + 561 backend tests, 46 mathematical properties verified with fast-check & Hypothesis." |
| **Social Kiro Properties (P1–P13 only)** | `docs/SOCIAL.md:73` | **FALSE** (Stale) | Kiro authored P1–P13, P31–P39, and P40–P46. | "Kiro: formal EARS requirements, locked haptic steering, 5 agent hooks, and property tests (P1–P13, P31–P46)" |
| **Kiro Write-up Test Counts** | `docs/KIRO_WRITEUP.md:270-274` | **FALSE** (Stale) | Cites 1203 frontend tests in 82 files and 422 backend tests. Actual: 1556 frontend in 113 files, 561 backend. | Update to: "Frontend: 1556 unit and property tests passing across 113 test files... Backend: 561 tests collected and passing..." |
| **Kiro Write-up Property Catalog** | `docs/KIRO_WRITEUP.md:129-158` | **FALSE** (Incomplete) | Section 5 only catalogs P1–P17, omitting P18–P30 and Kiro's Round 2 suites P31–P46. | Expand Section 5 to catalog P1–P46, adding Kiro's Round 2 suites P31–P39 and P40–P46. |
| **Kiro Write-up Credit Pause Narrative** | `docs/KIRO_WRITEUP.md:226-240` | **FALSE** (Incomplete) | Narrative ends at Nov 2 credit pause, ignoring Kiro's subsequent work on Tasks 19, 23, 24, and 25. | Add section documenting Kiro's Round 2 return for Task 19 review, Task 23 specs, Task 24 Ask fixes, and Task 25 security. |
| **Broken Native Spike Brief Link** | `docs/WIN_PLAN.md:53` | **FALSE** (Broken Reference) | `docs/briefs/T00b-native-spike.md` does not exist because Gate A passed and Phase 0b was skipped. | Annotate that `T00b-native-spike.md` was never authored because Gate A passed with method A1. |
| **Offline Specimen Cards Operation** | `docs/DEMO_SCRIPT.md:14`, `README.md:90` | **TRUE** | Verified in `frontend/src/core/sampleDiagrams.ts`; 100% client-side, zero network calls. | (Keep as is). |
| **Guide My Finger Flagged OFF by Default** | `README.md:33, 133, 155` | **TRUE** | Verified in `frontend/src/config/flags.ts` and `Explore.tsx`; requires `VITE_FEATURE_GUIDE=1` and settings toggle. | (Keep as is). |
| **Teacher Verify & Share Flagged OFF by Default** | `README.md:34, 134, 155` | **TRUE** | Verified in `frontend/src/config/flags.ts`; requires `VITE_FEATURE_SHARE=1` and settings toggle. | (Keep as is). |
| **Zero Server Storage for Diagram Sharing** | `README.md:35`, `docs/DEMO_SCRIPT.md:49` | **TRUE** | Verified; uses client-side `lz-string` compression in URL hash `#s=...`; URL fragments never leave the browser. | (Keep as is). |
| **Zero Server Storage for Uploaded Images** | `docs/WIN_PLAN.md:99`, `README.md:64` | **TRUE** | Verified in `backend/app/main.py:527-540`; images are processed in-memory and hashed for caching; no image files are saved to disk. | (Keep as is). |
| **Atkinson Hyperlegible Self-Hosted Font** | `README.md:87` | **TRUE** | Woff2 files present in `frontend/src/assets/fonts/` and loaded via `@font-face` in `styles/fonts.css`. | (Keep as is). |
| **48×48 px Minimum Touch Targets** | `README.md:85`, `docs/DEMO_SCRIPT.md:26` | **TRUE** | Verified in `frontend/src/styles/tokens.css` (`--gt-target: 48px`) and enforced across all controls. | (Keep as is). |
| **TalkBack Pass-Through Implementation** | `docs/DEMO_SCRIPT.md:28`, `README.md:31` | **TRUE** (in code) / **UNVERIFIED** (hardware) | Implemented in `frontend/src/screens/Explore.tsx` (relative cursor and centre reference tick); hardware phone verification pending. | Clearly state automated implementation is verified; physical phone testing is pending per `docs/OWNER_CHECKLIST.md`. |
| **Two-Finger Long-Press for Voice Ask** | `docs/DEMO_SCRIPT.md:30` | **TRUE** | Implemented in `frontend/src/screens/Explore.tsx:860-877` via `checkTwoFingerLongPress`. | (Keep as is). |
| **Raw Mode Deterministic Fallback** | `README.md:19`, `docs/DEMO_SCRIPT.md:31` | **TRUE** | Implemented in `backend/app/raw_mode.py` and `backend/app/main.py:583`; returns Canny edge segments under timeout or failure. | (Keep as is). |

---

## 4. Detailed Findings

### CONFIRMED Findings (Traced in Code and Test Logs)

#### B1-01 · HIGH · `docs/DEPLOY.md:208`
- **What is wrong:** The deployment verification checklist instructs the tester: *"Dragging a single finger traces lines and generates vibration and pitch audio continuously while TalkBack is running."* This is technically impossible on Android Chrome with TalkBack enabled.
- **Concrete failure scenario:** A tester boots TalkBack on an Android device and attempts to drag a single finger across the Explore canvas. TalkBack captures the touch for its own accessibility focus box. Zero pointer events reach the canvas; no vibration occurs; no audio pitch sounds. The tester assumes the application is broken.
- **Proposed minimal fix:** Replace the line with:
  ```markdown
  - Enter the **Explore screen**: because TalkBack consumes single-finger touch gestures for screen navigation, explore using TalkBack's **pass-through gesture: double-tap, hold down on the second tap, then drag**. The engine fires a 25 ms centre tick and tracks the cursor relative to hold position, generating continuous vibration and theremin pitch.
  ```
- **Proposed test:** Manual verification on an Android device running TalkBack; verify that single-finger drag is intercepted by TalkBack while double-tap-and-hold pass-through delivers pointermove events.

#### B1-02 · HIGH · `docs/KIRO_WRITEUP.md:129-158, 226-240, 254`, `README.md:98`, `docs/STEMERGENT_SUBMISSION.md:52, 62`, `docs/SOCIAL.md:16, 73-76`
- **What is wrong:** Public documentation repeatedly asserts that Kiro's contributions ceased during Task 13 (limiting Kiro to P1–P13/P1–P15). In reality, Kiro executed substantial work in Round 2: Tasks 19 (review of agent core, P31–P39), Task 23 (authoring Requirements 16–17, tasks 23–28, properties P40–P46), Task 24 (Ask fixes), and Task 25 (security hardening A6-01..A6-05, CSP, rate limiter spoof resistance). Kiroween judging rules strictly penalize under-attributing or misattributing Kiro's work.
- **Concrete failure scenario:** Kiroween judges reviewing `docs/KIRO_WRITEUP.md` see a narrative stating Kiro paused at Task 13 and only authored P1–P13, concluding that Kiro was abandoned mid-project, despite git logs and `BUILD_LOG.md` showing Kiro authored 20 additional properties and led major security and bug fixes.
- **Proposed minimal fix:** Update `KIRO_WRITEUP.md`, `README.md`, `STEMERGENT_SUBMISSION.md`, and `SOCIAL.md` to document the complete property suite (P1–P46) and add a dedicated section in `KIRO_WRITEUP.md` detailing Kiro's Round 2 return.
- **Proposed test:** Automated regex check confirming all occurrences of "P1–P13" or "P1–P17" in write-ups accurately reference the full P1–P46 suite and credit Kiro for P31–P46.

#### B1-03 · HIGH · `README.md:138-146`, `docs/KIRO_WRITEUP.md:270-274`, `docs/BLOG.md:19`, `docs/SOCIAL.md:16, 79`
- **What is wrong:** Severe discrepancy in advertised test counts across public materials:
  - `docs/BLOG.md`: 418 frontend / 346 backend
  - `docs/SOCIAL.md`: 1049 frontend / 348 backend
  - `README.md`: 1203 frontend / 422 backend
  - `docs/KIRO_WRITEUP.md`: 1203 frontend / 422 backend
  - **Actual Current Status:** **1556 frontend tests (113 files)** and **561 backend tests**.
- **Concrete failure scenario:** A judge or developer clones the repository, runs `npm --prefix frontend test` and sees 1556 passing tests, but reads `BLOG.md` stating 418 tests. The inconsistency damages credibility and looks like invented or unverified numbers.
- **Proposed minimal fix:** Synchronize all documentation to the verified counts: **1556 frontend tests (113 test files)** and **561 backend tests**.
- **Proposed test:** Run `npm --prefix frontend test` and verify that the console output matches the numbers documented in the reports and README.

#### B1-04 · HIGH · `docs/BOTS.md:9`
- **What is wrong:** Under the CI row, the document states: *"Note: `hitTest.prop.test.ts` (P1) has an automatic 1x retry in CI for known generator flakiness."* This is factually false; the retry workaround in `.github/workflows/ci.yml` was deleted on 2026-11-03 when Kiro resolved the generator's screen-space separation.
- **Concrete failure scenario:** A contributor inspecting `.github/workflows/ci.yml` finds no retry logic for `npm test`, causing confusion about whether CI is properly configured or if flaky tests are being masked.
- **Proposed minimal fix:** Remove the sentence or update it:
  ```markdown
  Note: The historical 1x retry workaround for `hitTest.prop.test.ts` (P1) was removed on 2026-11-03 after Kiro fixed the generator separation logic in `pbt-p1-flake.md`.
  ```
- **Proposed test:** Inspect `.github/workflows/ci.yml` lines 42–46 to verify `run: npm test` has no `--retry` or loop wrapper.

#### B1-05 · MEDIUM · `docs/STEMERGENT_SUBMISSION.md:33, 51`, `render.yaml:42-43`, `docs/DEPLOY.md:36, 48`, `backend/app/vision/__init__.py:20`
- **What is wrong:** `docs/STEMERGENT_SUBMISSION.md` asserts that Google Gemini is the primary multimodal vision model and OpenAI is secondary. However, the production deployment blueprint (`render.yaml:42-43`) and `docs/DEPLOY.md:36` place OpenAI first (`VISION_PROVIDERS: openai,gemini,nebius`).
- **Concrete failure scenario:** Judges evaluate the submission expecting Google Gemini inference in production, but inspect the live Render environment or `render.yaml` and discover OpenAI is invoked first.
- **Proposed minimal fix:** Clarify the relationship in `docs/STEMERGENT_SUBMISSION.md` and `docs/DEPLOY.md`: note that Gemini is the default architectural vision model in codebase defaults, but Render's deployment configuration currently designates OpenAI as primary in `VISION_PROVIDERS`.
- **Proposed test:** Verify `render.yaml` environment variable `VISION_PROVIDERS` and compare against `backend/app/vision/__init__.py:20`.

#### B1-06 · MEDIUM · `docs/BLOG.md:15-18`
- **What is wrong:** `docs/BLOG.md` attributes development exclusively to Kiro, with zero mention of Antigravity (who built the Frankenstein Lab redesign, Teacher Correct, and IndexedDB storage) or Claude Code (who supervised). Kiroween competition guidelines require transparent disclosure of all AI tools used.
- **Concrete failure scenario:** Kiroween judges compare the blog post against `docs/KIRO_WRITEUP.md` and notice that the blog omits Antigravity and Claude Code, suspecting an attempt to claim agent-built UI as Kiro's work.
- **Proposed minimal fix:** Add a concluding paragraph in `docs/BLOG.md`:
  ```markdown
  Ghost Touch was built through transparent multi-agent pairing: Kiro authored the formal EARS requirements, system architecture, steering guardrails, agent hooks, and foundational property suites; Antigravity built the Frankenstein Laboratory redesign, Teacher Correct mode, and offline drivers; and Claude Code supervised integration.
  ```
- **Proposed test:** Text verification confirming `docs/BLOG.md` includes proper multi-agent attribution.

#### B1-07 · MEDIUM · `docs/DEPLOY.md:75`
- **What is wrong:** States: *"The frontend is a Vite + React 18 Progressive Web App configured via frontend/vercel.json."*
- **Concrete failure scenario:** Developers checking dependency compatibility assume React 18 and attempt to use legacy APIs or react-18 types, whereas `frontend/package.json` installs `"react": "^19.3.1"`.
- **Proposed minimal fix:** Update React version string to `React 19`.
- **Proposed test:** Check `frontend/package.json` line 20.

#### B1-08 · LOW · `docs/WIN_PLAN.md:53`
- **What is wrong:** Mentions `Brief docs/briefs/T00b-native-spike.md`, but that file was never created because Gate A passed and Phase 0b was dropped.
- **Concrete failure scenario:** A developer following `WIN_PLAN.md` clicks or searches for `docs/briefs/T00b-native-spike.md` and encounters a broken file error.
- **Proposed minimal fix:** Add note: `(Brief was not created as Gate A passed with method A1, making the native spike unnecessary)`.
- **Proposed test:** Verify file existence in `docs/briefs/`.

#### B1-09 · LOW · `README.md:18`, `docs/DEMO_SCRIPT.md:13`, `docs/DEPLOY.md:221`
- **What is wrong:** Inconsistent cold start estimates for Render free tier: `README.md` and `DEMO_SCRIPT.md` state ~30–35 seconds, while `DEPLOY.md` states 50 to 70 seconds.
- **Concrete failure scenario:** A user reading the README waits 35 seconds, encounters a timeout, and assumes the backend is down when it actually takes 50 seconds on cold boot.
- **Proposed minimal fix:** Standardize wording across all three documents to: *"takes 30 to 60 seconds (up to 70 seconds under heavy load) to wake up."*
- **Proposed test:** Check text across `README.md`, `DEMO_SCRIPT.md`, and `DEPLOY.md`.

#### B1-10 · LOW · `README.md:94`, `docs/KIRO_WRITEUP.md:248`
- **What is wrong:** States that git history contains exactly 303 commits authored under the owner's identity. New commits have been added since this snapshot.
- **Concrete failure scenario:** A reviewer verifying the git log notes a different commit count and flags it as inaccurate.
- **Proposed minimal fix:** Replace exact count with *"over 300 commits"*.
- **Proposed test:** Run `git log --oneline` and verify count.

---

### UNVERIFIED (Hardware / External Validation)

The following items are correctly implemented in software and tested in automated suites, but require physical hardware or field validation:

1. **TalkBack Physical Exploration (UNVERIFIED):** Pass-through gesture (double-tap-and-hold then drag) and 25 ms centre tick are fully implemented in `Explore.tsx` and tested in Vitest suite P12/P36/P37, but physical motor feel and gesture responsiveness on a physical Android smartphone remain pending owner testing (`docs/OWNER_CHECKLIST.md`).
2. **Guide My Finger Haptics & Pan (UNVERIFIED):** Accelerating vibration pulses and Web Audio stereo panning are implemented behind `VITE_FEATURE_GUIDE=1` (default OFF), but unverified on physical hardware.
3. **Teacher Verify & Share QR Scanning (UNVERIFIED):** URL hash compression (`#s=...`) and QR code rendering are implemented behind `VITE_FEATURE_SHARE=1` (default OFF), but end-to-end scanning via physical mobile camera is unverified.
4. **BPA Ahmedabad User Session (UNVERIFIED):** In-person testing with blind students at the Blind People's Association in Ahmedabad has not yet taken place; numbers and quotes must not be entered until the session occurs.
5. **Native-Speaker Translation Validation (UNVERIFIED):** Hindi and Gujarati translations were machine-translated and await formal educator review.

---

## 5. Sound Areas (Verified Truthful)

- **Pure Core Isolation:** Traced in `frontend/src/core/`; all hit testing, geometry transforms, haptic sequencing, and pitch sonification are pure TypeScript functions with zero DOM dependencies.
- **Data Privacy & Image Handling:** Verified in `backend/app/main.py`; uploaded images are processed in-memory and never stored on disk.
- **Offline URL Fragment Sharing:** Verified in `frontend/src/core/`; diagrams compressed via `lz-string` into URL fragment hashes (`#s=...`) are entirely client-side and never sent to the server.
- **WCAG AAA Tokens & Touch Targets:** Verified in `frontend/src/styles/tokens.css`; touch targets meet `--gt-target: 48px`, text contrast exceeds 7:1, and Atkinson Hyperlegible fonts are self-hosted.
- **Raw Mode Resilience Floor:** Verified in `backend/app/raw_mode.py`; OpenCV Canny edge extraction reliably converts images to $\le 300$ segments on timeout or failure.
- **Sample Diagrams Zero Network:** Verified in `frontend/src/core/sampleDiagrams.ts`; the three sample diagrams run 100% locally with zero fetch calls.

---

## 6. Top 5 to Fix First

1. **Fix `docs/DEPLOY.md:208` (B1-01):** Correct the TalkBack instruction from single-finger drag to double-tap-and-hold pass-through gesture to prevent device test failures.
2. **Expand Kiro Attribution to P1–P46 Across All Docs (B1-02):** Update `docs/KIRO_WRITEUP.md`, `README.md`, `STEMERGENT_SUBMISSION.md`, and `SOCIAL.md` to credit Kiro for Round 2 work (Tasks 19, 23, 24, 25 and properties P31–P46).
3. **Synchronize Test Counts Across All Public Documents (B1-03):** Update `README.md`, `KIRO_WRITEUP.md`, `BLOG.md`, and `SOCIAL.md` to reflect **1556 frontend tests across 113 files** and **561 backend tests**.
4. **Remove Obsolete P1 CI Retry Claim from `docs/BOTS.md:9` (B1-04):** Eliminate the false claim that CI retains a retry workaround for P1.
5. **Align Vision Provider Hierarchy Between Submission and Blueprint (B1-05):** Reconcile `docs/STEMERGENT_SUBMISSION.md` with `render.yaml` to clarify that OpenAI is currently the primary provider in production deployment, with Gemini as the code default and fallback.

> **Supervisor note (2026-11-08):** this lane was checked out before the Claude Code commits that finished T25-T28. (1) B1-02 ("credit Kiro for Round 2 work") must NOT be applied as written: attribution follows docs/BUILD_LOG.md and docs/kiro-evidence/round2.md (Kiro: round 2 spec, T24, most T25/T26 code; Claude Code: gated and committed T25/T26, wrote P40-P46 backend properties, T28 evidence). (2) B1-03 test counts are stale; recount on submission day (main was 121 files / 1632 tests at the time of this note). Other items are unverified until re-checked.
