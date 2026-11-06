# Antigravity lane report: x-readme

- **Date:** 2026-11-06
- **Lane:** x-readme
- **Agent:** Antigravity (agy)
- **Status:** Complete
- **Allowed commands used:** `git status`, `git diff --stat`, `git diff`

---

## 1. Executive Summary

`README.md` was updated to provide an accurate, honest, and easy-to-scan presentation for Kiroween and STEMergent judges, educators, and school contacts. The documentation adheres strictly to the brief in `docs/briefs/agy-x-readme.md`, `AGENTS.md`, and the facts verified across the codebase.

No code files or other documentation files were modified. Zero `[FILL]` markers were added. Total line count of `README.md` is 160 lines, cleanly within the target range of 150 to 250 lines.

---

## 2. Changes Made to `README.md`

1. **Frankenstein Creature Pitch:**
   - Synthesized the opening paragraph with the core narrative: an inexpensive buzzer (nerves), a vision LLM (eyes), and a Web Audio theremin synthesizer (voice) stitched together to help blind and low-vision students explore STEM diagrams by touch on standard Android phones.
2. **"Try it" Section:**
   - Added direct links to the live PWA frontend (`https://ghost-touch-iota.vercel.app`) and backend API (`https://ghost-touch-api.onrender.com`).
   - Included the ~30s cold-start note for Render free-tier idle wake-up.
   - Documented the OpenCV edge-detection (Raw Mode) resilience floor when AI providers are slow, ensuring the user is never left with an empty screen.
   - Noted the target environment: Android Chrome (iOS lacks Web Vibration API support).
3. **"How it feels" & Visual Gallery:**
   - Added a 4-column visual gallery linking directly to verified phone screenshots:
     - Start screen (`docs/design/screenshots/after-start-390x844.png`)
     - Capture & Samples screen (`docs/design/screenshots/after-capture-390x844.png`)
     - Tactile Explore screen (`docs/design/screenshots/after-explore-390x844.png`)
     - Teacher Correction screen (`docs/design/screenshots/after-correct-390x844.png`)
   - Summarized the tactile interactions: continuous line buzz, vertex [50, 90, 50] ms double-tap with 450 ms quiet period, 200–1000 Hz rising theremin pitch, TalkBack pass-through gesture with centre reference tick, and voice Q&A.
   - Included the tuned haptic vocabulary table from `tech.md` with physical timings and hit radii (vertex: 22 px, line: 14 px).
4. **Architecture & Project Structure:**
   - Highlighted the vision fallback chain (`OpenAI` → `Gemini` → `Nebius` → OpenCV Canny `Raw Mode`).
   - Documented the strict architectural separation: FastAPI backend, pure core TypeScript in `frontend/src/core/` (zero DOM/browser dependencies), and thin browser drivers in `frontend/src/drivers/`.
   - Preserved the clean repository directory tree.
5. **Accessibility Commitments:**
   - Explicitly listed the product's accessibility foundations: 48×48 CSS px minimum touch targets, 7:1 contrast ratio (WCAG AAA) across laboratory tokens, self-hosted Atkinson Hyperlegible typography, spoken state changes, `prefers-reduced-motion` support, and offline PWA precaching.
6. **Multi-Agent Tool Attribution:**
   - Provided an honest breakdown between Kiro, Antigravity, and Claude Code:
     - **Kiro:** Requirements, design doc, tasks, steering docs, 5 agent hooks, pure core modules (`hapticEngine.ts`, `geometry.ts`, `hitTest.ts`, `pitch.ts`), Pydantic schema and validator, property suites P1–P13, and P1 generator flake fix. Noted that Kiro credits paused during Task 13 and Kiro did not build the Lab redesign.
     - **Antigravity:** Entire Frankenstein Laboratory redesign across parallel lanes (tokens, fonts, brand SVGs, i18n, screens, HUD, previews, PWA precaching), Teacher Correct mode (`core/correct.ts`, `screens/Correct.tsx`, `POST /api/v1/validate`, P16/P17), Saved Diagrams completion (`core/savedDiagrams.ts`, P14/P15, IndexedDB driver), screen flows and browser drivers, vision pipeline and OpenCV Raw Mode (`raw_mode.py`), Ask pipeline (`ask.py`), and localized speech/earcons in Hindi and Gujarati.
     - **Claude Code:** Supervised the build, authored briefs, reviewed diffs, resolved merge conflicts, took headless screenshots, maintained runner and dev setup scripts, and verified deployments.
   - Clarified Git authorship context: 303 commits sit under the repository owner's identity, directing readers to `docs/KIRO_WRITEUP.md` and `docs/BUILD_LOG.md` for verifiable evidence.
7. **Local Setup & Environment Variables:**
   - Verified commands matching existing README and `CLAUDE.md`: `powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1` and manual setup commands.
   - Updated environment variables table to reflect primary OpenAI and fallback Gemini/Nebius order.
8. **Tests & Current Status:**
   - Recorded the exact verified test counts on `main`: 1109 frontend tests across 76 files, 348 backend tests (1 skipped).
9. **Status and Honest Limitations:**
   - Stated clearly: not yet tested on a physical phone by the owner; Hindi and Gujarati text is machine-translated and not yet reviewed by a native speaker; AI fallback to Raw Mode on free tier; and Android Chrome scope.

---

## 3. Verified Links & File Paths

Every relative link and image path in `README.md` was verified to exist using the file tools:
- `frontend/public/brand/logo-full.svg` (exists, verified)
- `docs/design/screenshots/after-start-390x844.png` (exists, verified)
- `docs/design/screenshots/after-capture-390x844.png` (exists, verified)
- `docs/design/screenshots/after-explore-390x844.png` (exists, verified)
- `docs/design/screenshots/after-correct-390x844.png` (exists, verified)
- `docs/KIRO_WRITEUP.md` (exists, verified)
- `docs/BUILD_LOG.md` (exists, verified)
- `docs/DEPLOY.md` (exists, verified)
- `scripts/setup-dev.ps1` (exists, verified)
- `scripts/agy-run.sh` (exists, verified)
- `LICENSE` (exists, verified)
- Referenced directories: `.kiro/specs/`, `.kiro/steering/`, `.kiro/hooks/`, `frontend/src/core/`, `docs/kiro-evidence/`, `frontend/src/`, `backend/app/`, `docs/reports/`, `docs/briefs/`, `docs/reviews/` (all exist)

---

## 4. Items Not Directly Verified / Limitations for Owner

- **Physical device haptic vibration:** Motor timing sensation and TalkBack relative drag on OnePlus Nord CE6 hardware could not be tested directly in headless mode; documented as a known limitation in the README.
- **Native-speaker localization review:** Hindi (`hi`) and Gujarati (`gu`) UI translations are machine-translated and await native-speaker review; documented as a known limitation.
- **Live web endpoint HTTP requests:** Network commands were not executed per headless run rules; endpoints were verified against `docs/DEPLOY.md` and brief specifications.

---

## 5. Commit Groups

Recommended single atomic commit for this lane:

```
docs(readme): bring README.md up to date for Kiroween and STEMergent judges

- Add Frankenstein creature pitch (buzzer nerves, vision LLM eyes, theremin voice)
- Add "Try it" section with live Vercel and Render URLs and cold-start note
- Add visual screenshot gallery (Start, Capture, Explore, Correct)
- Clarify vision fallback chain (OpenAI -> Gemini -> Nebius -> Raw Mode)
- Include tuned haptic table from tech.md and core accessibility commitments
- Provide honest multi-agent attribution matrix (Kiro, Antigravity, Claude Code)
- Update test metrics (1109 frontend tests in 76 files, 348 backend tests)
- State honest limitations (physical phone testing, i18n review, Android scope)
```
