# Ghost Touch — Community, Learner & Open-Source Audit Report (WA-A7)

**Document Target:** `docs/reports/wa-a7-community.md`  
**Date:** 2026-11-28  
**Auditor:** Antigravity (agy)  
**Scope:** Open-source readiness, learner onboarding, educator experience, `CONTRIBUTING.md`, `docs/TEACHER_GUIDE.md`, `README.md`, `LICENSE` compliance, good-first-issue catalog, and missing community documentation.  
**Mode:** Read-only audit; no shell commands executed, no git commits made.

---

## 1. Executive Summary

Ghost Touch has achieved an extraordinary level of technical rigor: 3,300+ frontend tests, 930+ backend tests, property-based verification oracles (P1–P186), Playwright phone-emulation suites, and rock-solid privacy and security runbooks.

However, an audit of the repository from the perspective of **new open-source contributors, student learners, and non-technical educators** reveals a significant friction barrier:
1. **Conflation of AI Agent Rules with Human Open-Source Guidelines:** `CONTRIBUTING.md` contains constraints intended for autonomous AI builders (e.g., *"Do not commit or push unless you were asked to"*, *"Add an entry to docs/BUILD_LOG.md: the tool you used"*), which directly discourage external human contributors from contributing.
2. **Technical Code Leakage in the Teacher's Guide:** `docs/TEACHER_GUIDE.md`, described as a *"one-page, plain-language guide for a teacher"*, exposes internal Vite build-flag variables (`VITE_FEATURE_SHARE=1`), React component props (`onCorrect={isTeacherActive() ? handleCorrect : undefined}`), CSS selectors (`.gt-capture__button--settings`), and API routes (`POST /api/v1/validate`), creating an intimidating barrier for special educators.
3. **Missing Community Core Artifacts:** The repository lacks a `CODE_OF_CONDUCT.md`, has an unlinked `LICENSE` reference in `README.md`, omits the license identifier from `frontend/package.json`, and provides no introductory onboarding guide explaining the coordinate math and architecture to human developers.
4. **Classroom Reality Gaps:** Neither the README nor the Teacher's Guide addresses physical classroom challenges: Android OS touch feedback settings, Battery Saver disabling vibration motors, audio channel volume separation, or step-by-step coaching scripts for teaching blind students the TalkBack pass-through gesture.

This report catalogs all identified gaps, provides a prioritized findings table (`ID, severity, file, gap, fix`), details 8 concrete "Good First Issue" proposals, and outlines the missing documentation required to transform Ghost Touch into a thriving, accessible open-source community.

---

## 2. Audit Findings Table

| ID | Severity | File | Gap | Fix |
|---|---|---|---|---|
| **COMM-01** | High | `CONTRIBUTING.md` | **AI agent constraints conflated with human workflow:** Line 69 states *"Do not commit or push unless you were asked to"* and line 56 requires logging the AI tool used in `BUILD_LOG.md`. External human contributors are confused about whether PRs and git commits are permitted. | Delineate AI agent rules (`AGENTS.md`) from human open-source workflows. Replace line 69 with standard Fork-and-Pull-Request instructions (fork, create branch, test, open PR). Clarify that `BUILD_LOG.md` is for automated agents; humans use PR summaries. |
| **COMM-02** | High | `CODE_OF_CONDUCT.md` | **Missing Code of Conduct:** No `CODE_OF_CONDUCT.md` exists in the repository. Assistive technology projects serving blind and disabled learners require explicit community standards, anti-harassment policies, and reporting channels. | Adopt the Contributor Covenant v2.1 in `CODE_OF_CONDUCT.md`. Link it prominently in `README.md` and `CONTRIBUTING.md`. |
| **COMM-03** | High | `CONTRIBUTING.md` | **Incomplete verification gates:** Lines 25–34 only mention `npm test` and `pytest`. They omit Playwright E2E tests (`npx playwright test`), TypeScript typecheck (`tsc --noEmit`), and schema drift check (`python -m app.export_schema && npm run gen:types`), all of which are enforced in CI (`.github/workflows/ci.yml`). | Expand the "Gates" section to list all required CI commands matching `.github/workflows/ci.yml`, explaining that CI will fail if schema drift or typecheck errors occur. |
| **COMM-04** | High | `CONTRIBUTING.md` | **Blanket prohibition on `core/**` without human exception:** Lines 36–46 forbid modifying `frontend/src/core/**` or property tests because Kiro owned them during hackathons. Outside math/geometry contributors cannot tell if human contributions to core logic are welcomed. | Clarify that while autonomous AI agents are restricted from modifying `core/`, human contributors are welcome to propose improvements via GitHub Issues/RFCs and collaborative PRs. |
| **COMM-05** | High | `docs/TEACHER_GUIDE.md` | **Technical code leakage in non-technical guide:** Exposes React props (`onCorrect={isTeacherActive() ? ...}`), build-time Vite flags (`VITE_FEATURE_SHARE=1`), CSS selectors (`.gt-capture__button--settings`), and API routes (`POST /api/v1/validate`) to teachers. | Strip all code symbols, React props, CSS selectors, and build variables from the body of the guide. Move technical/deployment requirements into a collapsible developer note or separate technical appendix. |
| **COMM-06** | High | `docs/TEACHER_GUIDE.md` | **Missing classroom device setup & troubleshooting:** Fails to explain Android OS-level blockers: disabled touch feedback/vibration in system settings, Battery Saver killing the vibration motor, media vs ringtone volume, Chrome camera permissions, and Render 30–60s cold starts. | Add a "Classroom Device Setup & Troubleshooting Checklist" with step-by-step solutions for Android vibration settings, battery saver bypass, volume settings, and friendly explanations of free-tier backend cold starts. |
| **COMM-07** | High | `README.md` | **Unlinked `LICENSE`:** Line 206 displays raw text `MIT` without a markdown hyperlink to `LICENSE`. Open-source compliance standards require direct links to the full license text. | Update `## License` in `README.md` to `[MIT License](LICENSE)`. |
| **COMM-08** | High | `README.md` | **Missing Community & Contributing links:** `README.md` does not link to `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, or the GitHub Issue Tracker anywhere in its 206 lines. | Add a dedicated `## Community & Contributing` section in `README.md` linking directly to `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/TEACHER_GUIDE.md`, and GitHub Issues/Discussions. |
| **COMM-09** | Medium | `CONTRIBUTING.md` | **Platform-specific backend setup commands:** Lines 17–20 specify Windows `.venv\Scripts\activate` and omit the existing unified setup script `scripts/setup-dev.ps1`, while offering no POSIX bash script for Linux/macOS developers. | Document cross-platform commands for Windows, macOS, and Linux, and reference `scripts/setup-dev.ps1` (and introduce `scripts/setup-dev.sh`). |
| **COMM-10** | Medium | `CONTRIBUTING.md` | **Missing accessibility contribution guide:** States rules like "48×48 px touch targets" and "t()", but provides no instruction on how a developer should verify accessibility (TalkBack pass-through gesture, keyboard tabs, ARIA live regions, Chrome DevTools touch emulation). | Add an "Accessibility Contribution Standards" section explaining how to test with screen readers, touch emulation, and verify ARIA announcements and touch targets. |
| **COMM-11** | Medium | `docs/TEACHER_GUIDE.md` | **Missing diagram photography best practices:** Teachers receive no guidance on optimal lighting, contrast, avoiding page glare/shadows, line thickness, or which diagrams work well (e.g. 2D geometry, function curves) versus poorly (3D perspectives, chemical formulas, circuit schematics). | Add a "Photography Tips for Accurate Recognition" section and a "Supported vs Unsupported Diagrams" matrix. |
| **COMM-12** | Medium | `docs/TEACHER_GUIDE.md` | **Missing pedagogical tactile exploration protocol:** Lacks guidance on how teachers should introduce the app to a blind student, how to coach the tricky TalkBack "double-tap-and-hold" pass-through gesture, and how to teach mental mapping (centre reference tick, perimeter-first tracing). | Add a "Pedagogical Guide: Teaching Tactile Exploration" with verbatim teacher coaching scripts, practice drills, and student accommodation tips. |
| **COMM-13** | Medium | `README.md` | **Missing persona-based navigation / Table of Contents:** The 206-line README contains dense multi-agent history and tables, but lacks a Table of Contents or quick-start routing for the three primary audiences: Students, Teachers, and Developers. | Add a quick-navigation banner at the top of `README.md`: `[Try Live App] · [Teacher's Guide] · [Contributor Guide] · [Architecture]`. |
| **COMM-14** | Medium | `README.md` | **Inconsistent manual run command syntax:** Line 147 uses `python -m venv backend/.venv && backend/.venv/Scripts/activate`, which fails in standard PowerShell (where `&&` requires PS 7+) and on macOS/Linux (where `Scripts` is `bin`). | Provide separate, copy-pasteable blocks for Windows PowerShell and macOS/Linux bash. |
| **COMM-15** | Medium | `frontend/package.json` | **Missing license field in frontend package:** `frontend/package.json` specifies `"private": true` but omits `"license": "MIT"`. Automated SBOM and license scanners may flag the frontend bundle as unlicensed or proprietary. | Add `"license": "MIT"` to `frontend/package.json` matching `backend/pyproject.toml` and root `LICENSE`. |
| **COMM-16** | Medium | `docs/` | **Missing `docs/CONTRIBUTOR_ONBOARDING.md`:** No document explains the monorepo design, pure core (`frontend/src/core/`) vs browser driver isolation (`frontend/src/drivers/`), normalized `[0, 1]` coordinates, or how to develop without an Android phone using Playwright emulation. | Create `docs/CONTRIBUTOR_ONBOARDING.md` walking new developers through the Frankenstein architecture, coordinate transforms, and testing workflows. |
| **COMM-17** | Medium | `docs/` | **Missing printable sample diagrams and quick-reference cards:** Teachers have no ready-to-print PDF sample sheets to test the app in classrooms without hunting for specific textbooks. | Add print-ready high-contrast PDF sample sheets in `frontend/public/samples/` and link them in a new `docs/DIAGRAM_BEST_PRACTICES.md`. |
| **COMM-18** | Low | `CONTRIBUTING.md` | **Missing issue labels and triage navigation:** No explanation of GitHub labels (`good first issue`, `help wanted`, `a11y`, `i18n`, `teacher-feedback`) or pointers to where beginner contributors should start. | Add a "Finding an Issue to Work On" section with direct search links for `good first issue` and `help wanted`. |
| **COMM-19** | Low | `README.md` | **Multi-agent hackathon provenance distracting external learners:** Extensive sections on Kiro pauses, Opus tournament agents, and internal lane IDs (`bu10`, `hi18`, `k1`) confuse outside contributors looking for current project status. | Add an explanatory note clarifying that multi-agent provenance is historical, directing active development to the standard open-source roadmap. |

---

## 3. Deep Dive: Open-Source Contributor Gaps

### 3.1 The "AI Agent Rules" Barrier in `CONTRIBUTING.md`
`CONTRIBUTING.md` currently reflects a transition state from the Kiroween multi-agent competition. It inherits rules directly from `AGENTS.md` that were designed to constrain autonomous LLM subagents:
- **Line 69:** *"Do not commit or push unless you were asked to."* For an open-source contributor or student developer wanting to submit a bug fix or translation, this reads as an outright prohibition on git actions.
- **Line 54–56:** *"Add an entry to docs/BUILD_LOG.md: the tool you used, what you built, what broke, and the files you touched."* While essential for multi-agent audits, human contributors do not log entries in `BUILD_LOG.md`; they write GitHub pull request descriptions.
- **What Kiro owns:** The list of locked paths (`frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`) without an explanation of how humans can contribute to core geometry or test suites discourages math and accessibility researchers from participating.

### 3.2 Incomplete Verification & CI Failure Traps
`CONTRIBUTING.md` states:
```bash
npm --prefix frontend test
cd backend && pytest
```
However, `.github/workflows/ci.yml` enforces four distinct jobs:
1. `frontend`: runs `npm ci`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
2. `backend`: runs `pip install -r requirements.lock`, `ruff check .`, `ruff format --check .`, and `pytest`.
3. `schema-drift`: runs `python -m app.export_schema`, `npm run gen:types`, and checks `git diff --exit-code frontend/src/types/scene.gen.ts`.
4. `e2e`: runs `npx playwright install --with-deps chromium` and `npx playwright test`.

If a contributor only runs `npm test` and `pytest`, their PR can fail in CI due to formatting (`ruff format`), typecheck errors (`tsc`), Playwright touch tests, or generated schema drift. `CONTRIBUTING.md` must document the complete local pre-flight command suite.

### 3.3 Cross-Platform Developer Experience
`README.md` features `scripts/setup-dev.ps1` for Windows, but:
- There is no `scripts/setup-dev.sh` for macOS or Linux developers.
- Manual backend instructions use Windows-only syntax (`.venv\Scripts\activate`), alienating Unix/macOS contributors.
- The command chaining `python -m venv backend/.venv && backend/.venv/Scripts/activate` fails on Windows PowerShell unless running PowerShell 7+, because Windows PowerShell 5.1 does not support `&&`.

---

## 4. Deep Dive: Educator & Learner Gaps

### 4.1 Jargon and Code Exposure in `docs/TEACHER_GUIDE.md`
`docs/TEACHER_GUIDE.md` is positioned as a guide for teachers, but contains developer-centric implementation details:
- Mentions Vite feature flags: `"Technical flag: Teacher tools requires the build-time flag VITE_FEATURE_SHARE=1 (frontend/src/config/features.ts: isShareEnvOn())."`
- Mentions React implementation code: `"In frontend/src/App.tsx, the Explore screen only renders the Correct button when teacher tools is active: onCorrect={isTeacherActive() ? handleCorrect : undefined}"`
- Exposes internal i18n keys and CSS selectors: `.gt-capture__button--settings`, `lab.settings.moreSettings`, `role="switch"`, `correct.pointMoved`, `POST /api/v1/validate`.

A special education teacher in a high school or blind school does not know what a Vite flag or React handler is. If their deployed instance lacks `VITE_FEATURE_SHARE=1`, they have no control over it and are left confused why the button is missing.

### 4.2 Missing Classroom Environment Preparation
In actual school environments, multiple hardware and OS factors prevent Ghost Touch from working out-of-the-box:
1. **System Vibration Muted:** On many Android phones (Samsung One UI, Xiaomi MIUI, Motorola), "Touch feedback / Haptic interactions" is turned off by default in Android Settings -> Sound & Vibration. When turned off at the OS level, `navigator.vibrate()` returns `true` but the motor remains completely still!
2. **Battery Saver Mode:** Android automatically disables vibration motors when the device enters Battery Saver mode (< 20% battery).
3. **Volume Mismatch:** Phones have separate sliders for Ringtone, Notifications, and Media. Ghost Touch theremin tones and speech run on the **Media** volume channel. If Media is at 0%, the student feels vibrations but hears silence.
4. **Camera Permissions in PWA:** When launched as an installed PWA from the home screen, Chrome prompts for camera permissions. If the teacher accidentally taps "Block", taking diagram photos fails silently.
5. **Render Cold-Start Anxiety:** On the free tier, waking the backend takes 30–60 seconds. Teachers assume the application has crashed and refresh the page, restarting the wake timer.

### 4.3 Pedagogical Protocol for Blind Students
Exploring a diagram tactually on glass is fundamentally different from feeling a paper embosser (swell paper):
- On glass, there are no physical ridges. The student's finger must learn to move slowly and maintain continuous contact.
- **The TalkBack Pass-Through Gesture:** Blind students using TalkBack navigate by single-finger swiping. To interact with the diagram canvas, TalkBack requires a **double-tap-and-hold, then drag** gesture. This gesture is difficult for young students and requires guided practice.
- The guide needs a dedicated coaching section: *"How to Guide Your Student's First 5 Minutes"*, including hand-over-hand exploration and using the centre reference tick to re-orient when lost.

---

## 5. License & Compliance Audit

### 5.1 Root `LICENSE` File
- **Status:** Present (`LICENSE`, MIT, Copyright 2026 Ratnesh Singh).
- **Issue:** `README.md` line 206 states:
  ```markdown
  ## License

  MIT
  ```
  It is unlinked. Open-source repositories should link directly: `[MIT License](LICENSE)`.

### 5.2 Frontend Package Manifest (`frontend/package.json`)
- **Status:** Line 3 specifies `"private": true`, but omits `"license"`.
- **Backend comparison:** `backend/pyproject.toml` declares `license = { text = "MIT" }`.
- **Risk:** Automated open-source compliance checkers and package auditors flag packages with `"private": true` and no license as proprietary or ambiguous. Adding `"license": "MIT"` resolves this ambiguity while preserving `"private": true` to prevent accidental npm registry publication.

---

## 6. Catalog of "Good First Issue" Opportunities

To attract new open-source contributors and student learners, the following 8 issues should be created in the GitHub issue tracker with the `good first issue` label:

### GFI-01: Native Speaker Review for Hindi (`hi`) and Gujarati (`gu`) Translations
- **Label:** `good first issue`, `i18n`, `a11y`
- **Context:** Interface and spoken strings in `frontend/src/i18n/hi.ts` and `gu.ts` are machine-translated and pending native speaker review (`README.md` line 191).
- **Task:** Review and refine mathematical vocabulary (e.g., angle names, hypotenuse, bar chart axes) and speech announcements for natural phrasing and cultural clarity.
- **Skills Required:** Fluency in Hindi or Gujarati; no complex coding required.
- **Files Involved:** `frontend/src/i18n/hi.ts`, `frontend/src/i18n/gu.ts`.

### GFI-02: Additional Indian Regional Language Support (Tamil, Telugu, Marathi)
- **Label:** `good first issue`, `i18n`, `enhancement`
- **Context:** Ghost Touch targets STEM education in India, where students study in varied regional languages.
- **Task:** Add a new language dictionary (e.g., `mr.ts` for Marathi or `ta.ts` for Tamil) following the structure in `en.ts`, and register the language option in `frontend/src/i18n/index.ts` and the Settings modal.
- **Skills Required:** TypeScript basics, language fluency.
- **Files Involved:** `frontend/src/i18n/index.ts`, `frontend/src/screens/Settings.tsx`.

### GFI-03: Cross-Platform POSIX Dev Setup Script (`scripts/setup-dev.sh`)
- **Label:** `good first issue`, `developer-experience`, `linux`, `macos`
- **Context:** The repository has `scripts/setup-dev.ps1` for Windows, but Linux and macOS contributors must execute 8 manual setup commands.
- **Task:** Create an idempotent, POSIX-compliant bash script `scripts/setup-dev.sh` that checks for Node 22 and Python 3.11+, sets up the backend venv, installs dependencies, and runs pre-flight tests.
- **Skills Required:** Bash scripting.
- **Files Involved:** `scripts/setup-dev.sh`, `CONTRIBUTING.md`, `README.md`.

### GFI-04: High-Contrast & Large-Print Visual Mode for Low-Vision Learners
- **Label:** `good first issue`, `a11y`, `frontend`
- **Context:** `README.md` line 11 notes: *"Low-vision students use the same touch and sound; the screen has no large-print or contrast options yet."*
- **Task:** Introduce a "High Contrast / Large Print" toggle in Settings that applies high-visibility tokens (e.g., vivid yellow `#FFFF00` on pure black `#000000`, thicker 4px diagram strokes, and scalable typography).
- **Skills Required:** CSS variables, React state.
- **Files Involved:** `frontend/src/index.css`, `frontend/src/screens/Settings.tsx`, `frontend/src/screens/Explore.tsx`.

### GFI-05: Curate 5 Vetted Offline STEM Diagrams in `frontend/public/samples/`
- **Label:** `good first issue`, `stem`, `data`
- **Context:** The application currently ships with only 3 offline samples: Right Triangle, Sine Wave, and Bar Chart.
- **Task:** Author 5 new valid `DiagramScene` JSON files covering common school curricula: (1) Circle with radius and diameter, (2) Intersecting lines with vertical angles, (3) Number line with negative/positive integers, (4) Parabola ($y = x^2$), and (5) Simple Venn diagram. Validate them against `backend/scene.schema.json`.
- **Skills Required:** JSON schema, basic geometry.
- **Files Involved:** `frontend/public/samples/*.json`, `frontend/src/screens/Capture.tsx`.

### GFI-06: Independent Audio Volume & Sound Cue Sliders in Settings
- **Label:** `good first issue`, `a11y`, `audio`
- **Context:** Some sensory-sensitive or autistic learners find the simultaneous combination of theremin pitch, speech synthesis, and edge click ticks overwhelming.
- **Task:** Add independent volume / toggle controls in the Settings modal for: (1) Theremin tone pitch, (2) Spoken announcements, and (3) Haptic boundary clicks.
- **Skills Required:** React, Web Audio API (`GainNode`).
- **Files Involved:** `frontend/src/drivers/audio.ts`, `frontend/src/screens/Settings.tsx`.

### GFI-07: Android Vibration Motor Pre-flight & Troubleshooter Modal
- **Label:** `good first issue`, `a11y`, `ux`
- **Context:** If a student's phone has Android OS "Touch Feedback" turned off or Battery Saver on, the phone will not vibrate even though web permissions succeed.
- **Task:** Add a "Test Vibration" button on the Start screen. If the student taps it and reports no vibration, display a modal explaining how to enable "Touch Feedback" in Android Sound Settings and how to disable Battery Saver.
- **Skills Required:** React component design, accessible dialogs.
- **Files Involved:** `frontend/src/screens/Start.tsx`, `frontend/src/i18n/en.ts`.

### GFI-08: Plain-Language Teacher Guide Refactor & Printable 1-Page Cheat Sheet
- **Label:** `good first issue`, `documentation`, `teachers`
- **Context:** `docs/TEACHER_GUIDE.md` contains code references that confuse teachers.
- **Task:** Refactor `docs/TEACHER_GUIDE.md` into plain, teacher-friendly prose and create a clean, 1-page printable PDF layout (or markdown cheat sheet) that teachers can print out on standard A4/Letter paper for classroom desks.
- **Skills Required:** Technical writing, Markdown, graphic/PDF layout.
- **Files Involved:** `docs/TEACHER_GUIDE.md`, `docs/TEACHER_CHEAT_SHEET.md`.

---

## 7. Missing Documentation for New Contributors and Teachers

To build an inclusive, self-sustaining community, Ghost Touch requires five foundational documentation files:

```
docs/
├── CONTRIBUTOR_ONBOARDING.md   # [MISSING] Architecture, coordinate math, testing without phone
├── CLASSROOM_PRACTICE.md       # [MISSING] 15-minute lesson plan & pedagogical coaching
├── DIAGRAM_BEST_PRACTICES.md   # [MISSING] Diagram photography, lighting, supported shapes
├── ACCESSIBILITY.md            # [MISSING] WCAG 2.2 AA/AAA, TalkBack gestures, screen readers
└── TEACHER_CHEAT_SHEET.md      # [MISSING] Printable 1-page classroom quick-reference
CODE_OF_CONDUCT.md              # [MISSING in root] Contributor Covenant v2.1
```

### 7.1 Proposed `CODE_OF_CONDUCT.md`
The project must adopt the **Contributor Covenant v2.1**. It explicitly protects disabled, neurodivergent, and student community members.
- **Key Pledge:** Fostering an open, welcoming, diverse, inclusive, and healthy community where participation is free from harassment.
- **Enforcement & Reporting:** Provide an explicit email address (e.g., project owner's public security/contact email) with clear response SLAs (e.g. 48 hours).

### 7.2 Outline for `docs/CONTRIBUTOR_ONBOARDING.md`
A dedicated guide for new developers covering:
1. **The Core Mental Model:**
   - The Frankenstein philosophy: Android vibration motor + Vision LLM + Web Audio theremin.
   - Pure Core vs Driver Boundary: Why `core/` contains no DOM or browser APIs, and why browser APIs live strictly in `frontend/src/drivers/`.
2. **Coordinate Normalization Math:**
   - All diagram elements are defined in normalized $[0, 1] \times [0, 1]$ floating-point coordinates.
   - Letterboxing, aspect ratio scaling, and viewport denormalization in `frontend/src/core/geometry.ts`.
3. **How to Test Without an Android Phone:**
   - Using Chrome DevTools Mobile Emulation (Sensors -> Touch).
   - Running Playwright emulation tests (`npx playwright test`).
   - Testing audio oscillators and synthesized speech directly on desktop Chrome.
4. **Step-by-Step "Your First Pull Request" Tutorial:**
   - Forking, setting up local venv/npm, writing unit tests, running property tests, and opening a PR.

### 7.3 Outline for `docs/CLASSROOM_PRACTICE.md` (Teacher Lesson Plan)
A pedagogical resource for special education teachers:
1. **15-Minute Sample Lesson: "Exploring the Right Triangle"**
   - Minute 0–3: Orientation. Show student the phone, feel the smooth glass, locate the centre reference tick.
   - Minute 3–7: Tracing edges. Guide the student's index finger to find the buzzing perimeter line.
   - Minute 7–10: Discovering corners. Feel the double pulse at vertex C, hear the spoken label, identify the right angle.
   - Minute 10–13: Voice Q&A. Tap Ask and ask aloud *"Which side is the hypotenuse?"*.
   - Minute 13–15: Reflection and student diagram sketching using Ghost Hand.
2. **Teaching the TalkBack Pass-Through Gesture:**
   - Verbal script for teachers: *"Tap-tap, hold on the second tap, and slide your finger like a hockey puck."*
3. **Audio Accommodations:**
   - When to use wired earphones (stereo guidance pan) vs phone loudspeaker.

### 7.4 Outline for `docs/DIAGRAM_BEST_PRACTICES.md`
A photography and preparation guide for teachers and parents:
1. **Diagram Suitability Matrix:**
   - *Works Great:* High-contrast black line art on white paper, 2D geometric shapes (triangles, polygons, circles), single-variable function graphs, clear bar charts.
   - *Requires Raw Mode:* Dotted lines, shaded regions, complex multi-line plots, textbook pages with dense text surrounding the diagram.
   - *Currently Unsupported:* 3D projections, chemical molecular bonds, electrical circuit schematics, handwritten diagrams.
2. **Photography Checklist:**
   - Lay book completely flat (use clips or weights to flatten page gutter curvature).
   - Position phone parallel to paper (avoid angled/keystone perspective distortion).
   - Avoid direct overhead light that causes glossy paper glare.
   - Frame tightly around the diagram, cropping out surrounding textbook paragraphs.

---

## 8. Prioritized Remediation Roadmap

### Immediate Fixes (1–2 Hours)
- [ ] **Fix `README.md` License Link:** Update `## License` to `[MIT License](LICENSE)`.
- [ ] **Add `frontend/package.json` License:** Add `"license": "MIT"`.
- [ ] **Add `CODE_OF_CONDUCT.md`:** Commit Contributor Covenant v2.1 to repository root.
- [ ] **Fix `CONTRIBUTING.md` Git Rule:** Remove *"Do not commit or push unless you were asked to"* and clarify standard fork/PR workflow for human contributors.
- [ ] **Add `README.md` Community Section:** Link `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `docs/TEACHER_GUIDE.md`.

### Short-Term Improvements (1–2 Days)
- [ ] **Clean Technical Code from `docs/TEACHER_GUIDE.md`:** Remove React props, CSS selectors, and Vite flags; add a Classroom Checklist (vibration, volume, cold-start notice).
- [ ] **Update `CONTRIBUTING.md` Gates:** List all CI checks (typecheck, schema-drift, Playwright E2E, ruff format).
- [ ] **Publish Good First Issues:** Post the 8 cataloged issues (GFI-01 through GFI-08) on GitHub with clear tags.
- [ ] **Create `scripts/setup-dev.sh`:** Provide POSIX setup automation for macOS/Linux developers.

### Medium-Term Goals (1–2 Weeks)
- [ ] **Author `docs/CONTRIBUTOR_ONBOARDING.md`:** Publish the comprehensive architecture and coordinate math onboarding guide.
- [ ] **Author `docs/CLASSROOM_PRACTICE.md`:** Publish the pedagogical teacher guide and 15-minute lesson plan.
- [ ] **Author `docs/DIAGRAM_BEST_PRACTICES.md`:** Publish the photography guide with printable sample diagram PDFs in `frontend/public/samples/`.
- [ ] **Implement High-Contrast Mode (GFI-04):** Add large-print and high-contrast options for low-vision learners.

---
*Report compiled autonomously via read-only repository audit. No git commits, branches, or shell commands were executed.*
