# Lane submission-prep Report: STEMergent Submission & Demo Script

**Lane**: submission-prep (DOCS ONLY)  
**Builder**: agy, reviewed by Claude  
**Date**: 2026-11-07  
**Status**: Complete  
**Brief**: `docs/briefs/agy-submission-prep.md`  
**Rules & Contracts**: `AGENTS.md`, `docs/WIN_PLAN.md`, `docs/OWNER_CHECKLIST.md`, `docs/KIRO_WRITEUP.md`

---

## 1. Summary of Work Completed

Per the brief, zero source code was touched. All updates were restricted to `docs/STEMERGENT_SUBMISSION.md`, `docs/DEMO_SCRIPT.md`, `docs/BUILD_LOG.md`, and this report.

### 1.1 `docs/STEMERGENT_SUBMISSION.md`
- **Core Narrative:** Fully populated the problem, user audience (blind and low-vision STEM students, parents, educators), STEM curriculum alignment (geometry vertices/angles, graph curve theremin sonification, bar charts, grounded spoken Q&A), operational mechanics, and future roadmap based on `README.md`, `docs/WIN_PLAN.md`, and `docs/KIRO_WRITEUP.md`.
- **Honest Attribution:** Accurately disclosed tools and roles:
  - **Google Gemini** (`gemini-3.8-flash` / `gemini-3.5-flash-lite`) disclosed as primary multimodal vision model, with OpenAI/Nebius secondary fallbacks and OpenCV Raw Mode floor.
  - **Kiro:** Spec-driven development, EARS requirements, design contracts (P1–P15), tasks, locked haptic table in `tech.md`, 5 agent hooks, pure core modules (`geometry.ts`, `hitTest.ts`, `hapticEngine.ts`, `pitch.ts`), backend schema & validator, property test suites P1–P9, P11, P13, and P1 tie-rule fix. Explicitly noted Kiro credits ran out during Task 13 and Kiro did not build the Lab redesign.
  - **Antigravity (agy):** Laboratory visual redesign (tokens, Atkinson fonts, SVGs, i18n, screens, HUD, previews, PWA precaching), Teacher Correct mode (`core/correct.ts`, `screens/Correct.tsx`, `POST /api/v1/validate`, P16/P17), Saved Diagrams completion (IndexedDB driver, `core/savedDiagrams.ts`, P14/P15 tests), PDF intake driver, backend multi-provider pipeline, Raw Mode fallback, Ask pipeline with deterministic semantic target extraction, Hindi/Gujarati localization, and property tests P10/P12.
  - **Claude Code:** Architecture planning (`docs/WIN_PLAN.md`), lane briefs, supervisor runner, diff reviews, merge resolution, screenshot evidence, deployment checks, research spikes, and driver baseline.
- **`[FILL]` Restrictions:** Restricted `[FILL]` markers strictly to information only the owner can provide:
  - Media: `[FILL: owner to provide media (screenshots/GIFs and demo video URL)]`
  - Team details: `[FILL: owner to provide team member names, roles, institution, and student details]`
  - School testing: `[FILL: one sentence about the school session at BPA Ahmedabad, only if it takes place. Do not write numbers or quotes before they exist.]`
  - Video link: `[FILL: YouTube demo video URL (under 3 minutes)]`
- **`[RECOUNT]` Rule Enforced:** Placed `[RECOUNT]` for every test count and coverage figure so the owner re-runs automated suites on submission day without inventing numbers.
- **Hardware Claims Prohibited:** Clearly disclosed that TalkBack, Guide My Finger, and Teacher Share features have **NOT** been verified on physical hardware, that their feature flags default to OFF, and that on-device testing on the OnePlus Nord CE6 is pending.
- **Audit Transparency:** Explicitly disclosed that an open security and bug audit is active, with zero claims of "bug free" or "secure" software.

### 1.2 `docs/DEMO_SCRIPT.md`
- **Format & Duration:** Overwrote `docs/DEMO_SCRIPT.md` with a clean, concise, copy-paste ready video script strictly timed to under 3:00 (target: 2:50–3:00) with exact timestamps, visual actions, on-screen elements, and natural narration.
- **Working Features Spotlight:** Scripted demonstrations around features that work in the repository today:
  - 100% offline specimen cards (Right triangle, Sine wave, Bar chart).
  - Continuous line vibration buzz (`vibrate(80)` every 70 ms) and distinct corner "bzzzz-tap" double pulse (`vibrate([50, 90, 50])`) with 450 ms line quiet window.
  - Mathematical curve sonification using Web Audio theremin pitch glides (200 Hz to 1000 Hz).
  - Spoken Q&A (Ask) with deterministic diagram facts readout.
  - Teacher Correct mode canvas point adjustment and validation.
  - Classical OpenCV Canny edge detection (Raw Mode) safety net.
  - Machine-translated Hindi and Gujarati interface confirmation.
- **Unverified Features Marked OPTIONAL:** Explicitly marked hardware TalkBack, Guide My Finger (`VITE_FEATURE_GUIDE`), and Teacher Verify & Share (`VITE_FEATURE_SHARE`) as **[OPTIONAL]**, highlighting that physical hardware testing is pending.
- **Practical Troubleshooting & Fallbacks:** Included clear pre-filming checklist (Render backend wake-up, external lavalier mic placement, Web Audio gesture unlocking).

### 1.3 `docs/BUILD_LOG.md`
- Added an entry for `2026-11-07 — agy, reviewed by Claude — Lane submission-prep (STEMergent Submission & Demo Script Preparation)` documenting all files updated and verification commands executed.

---

## 2. Verification Proof

All required Definition of Done verification commands were executed from the repository root:

| Command | Result | Details |
|---|---|---|
| `npm --prefix frontend test` | **PASS** | 110 passed test files (1518 tests passed) |
| `npm --prefix frontend exec -- tsc -p frontend --noEmit` | **PASS** | 0 TypeScript errors |
| `npm --prefix frontend run build` | **PASS** | 128 modules transformed, clean PWA build (659.42 KiB precache) |
| `backend/.venv/Scripts/python -m pytest backend` | **PASS** | 474 passed, 1 skipped in 62.27s |
| `backend/.venv/Scripts/python -m ruff check backend` | **PASS** | All checks passed! |
| `backend/.venv/Scripts/python -m ruff format --check backend` | **PASS** | 63 files already formatted |
| `git status --short` | **PASS** | Only expected docs files modified/added |

---

## 3. Files Touched

- `docs/STEMERGENT_SUBMISSION.md` (updated submission draft with honest disclosures, `[FILL]`, and `[RECOUNT]`)
- `docs/DEMO_SCRIPT.md` (clean, copy-paste ready <=3:00 video script with optional beat markers)
- `docs/reports/agy-submission-prep-report.md` (this report)
- `docs/BUILD_LOG.md` (logged lane execution and DoD test passes)
