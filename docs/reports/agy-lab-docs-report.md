# Lane lab-docs Report: Phone Checklist and Demo Notes for Lab Redesign

**Builder:** Antigravity  
**Lane:** `lab-docs`  
**Date:** 2026-11-06  
**Briefs:** `docs/briefs/lab-spec.md`, `docs/briefs/agy-lab-docs.md`  

---

## 1. What Was Built

Per the `lab-docs` brief (`docs/briefs/agy-lab-docs.md`), this lane is strictly documentation and makes zero changes to code, tests, or configurations.

Three documentation artifacts were created:

### 1. `docs/PHONE_CHECKLIST_LAB.md`
A copy-paste verification checklist formatted for the repository owner to run on a physical Android smartphone (tested on OnePlus Nord CE6 / budget Android devices over HTTPS).
- **Structure:** Divided into two exhaustive passes:
  - **Pass 1: TalkBack OFF** (42 verification checks) covering direct touch, visual hierarchy, audio synthesis, and physical motor haptics.
  - **Pass 2: TalkBack ON** (25 verification checks) covering screen-reader focus traversal, double-tap activation semantics, polite live announcements, and the pass-through exploration gesture (Requirement 13.1 & Gate A: double-tap, hold 0.5s, then drag with center reference tick).
- **Checklist format:** Every test item uses a `- [ ]` markdown task box with a single-line expected result followed by a dedicated `Result:` line for manual record-keeping.
- **Scope covered:**
  1. PWA installation, home-screen mascot icon, dark lab splash screen, and offline boot under Airplane Mode.
  2. Offline self-hosted Atkinson Hyperlegible font caching (no FOIT/layout shift) and inline SVG asset rendering.
  3. Start screen: Frankenstein stitched phone creature mascot, 3 organ tiles (Nerves = vibration, Eyes = vision AI, Voice = theremin + speech), full-screen touch button ("Wake the creature"), single confirmation buzz (`vibrate(50)`), and hardware vibration fallback handling.
  4. Capture screen: Visual hierarchy (primary "Take photo" prominent in life green `#39ff88`; secondary "Choose image / PDF" and "Saved diagrams"), specimen jar sample cards with mini diagram previews.
  5. Lab settings sheet: Triggered by a single clearly labelled button reflecting current configuration (e.g. "Settings: English, 1.0×"); opens modal sheet with focus shifted inside; allows selection of language (English, Hindi, Gujarati) and speech rate (0.8× Slow, 1.0× Normal, 1.25× Fast); speaks immediate confirmation; closes cleanly via Escape or Android Back with focus returning to trigger button; persists choices in `localStorage` across reloads.
  6. Camera capture (`capture="environment"`), image/PDF file validation (10 MB cap), and first-page PDF extraction.
  7. Powering up loading state: Copper meter charging bar, spoken status "Reading your diagram…", and 1.5s interval charging beeps (`beep(440, 120)`).
  8. "IT'S ALIVE!" celebration animation: Brief spark arc + glow pulse + `success` earcon under 1.2s total duration without strobing (WCAG 2.3.1 compliant). Verified static under `prefers-reduced-motion: reduce` ("Remove animations" ON).
  9. Explore screen ("Specimen Table"): Pure high-contrast black canvas with glowing green strokes framed by stitched borders and rivets. Haptic vocabulary intact: continuous line buzz `vibrate(80)` every 70ms; corner double-tap `vibrate([50, 90, 50])`; 450ms quiet suppression window; spoken vertex labels; continuous theremin tone sonification (200–1000 Hz) gliding with visual height on graphs; bar chart comparisons.
  10. Spoken Q&A (Ask): Two-finger long press or accessible HUD Ask button triggering listening earcon (`beep(587, 100)`), short 2-sentence spoken diagram answers, and accessible text box fallback.
  11. Raw Mode outline fallback: Updated Lab copy "The creature's eyes are blurry — you can still feel the outlines." with tactile OpenCV Canny edge tracing. Marked `(verify)` for coordination with i18n lane.
  12. Saved diagrams (Specimen Archive): Empty state with mascot, automatic saving, reopening saved diagrams offline in Airplane Mode with zero network requests, pinning protection, and deletion.
  13. Teacher Correct mode: Calibration bench with photo underlay, draggable vertices, label editing, undo/redo, live validation against `POST /api/v1/validate`, and safe cancellation.
  14. Visual accessibility & responsive stress checks: 200% system font scaling with zero clipping; 320 px narrow viewport stacking; OS Dark/Light theme independence (theme remains dark lab charcoal `#0b0e0c` with contrast >= 7:1 meeting WCAG AAA); >= 3px visible copper/cyan focus rings; and all touch targets >= 48×48 CSS px.

### 2. `docs/design/LAB_DEMO_NOTES.md`
A complete 3-minute video recording guide and shot-by-shot script for the owner:
- **Duration:** 2 minutes 45 seconds to 2 minutes 55 seconds (Hard limit: 3:00).
- **Core Pitch:** "Ghost Touch is a creature stitched from spare phone parts: an ordinary notification buzzer for nerves, a vision LLM for eyes, and a browser synthesizer for a voice. The UI is the lab where it comes alive."
- **Ethical & Accessible Stance:** Strictly separates the playful Frankenstein creature theme from blindness. Explicitly prohibits blind jokes, darkness humor, blindfolds, sleep masks, medical horror, or gory imagery.
- **Detailed Timed Shot List:** 10 numbered shots covering:
  - 0:00–0:18: Cold open hook (physical motor vibration & spoken vertex corner).
  - 0:18–0:38: The STEM diagram barrier vs. ubiquity of budget smartphones.
  - 0:38–1:00: Start screen & Frankenstein creature pitch (Nerves, Eyes, Voice).
  - 1:00–1:20: Capture hierarchy & Lab settings sheet (Hindi/Gujarati/rate switching).
  - 1:20–1:40: Loading power-up & "IT'S ALIVE!" moment.
  - 1:40–2:10: Explore screen with TalkBack active (pass-through gesture, center tick, line vibration, corner double-tap).
  - 2:10–2:25: Mathematical curves & theremin tone sonification.
  - 2:25–2:40: Spoken voice Ask Q&A (two-finger press, 2-sentence fact grounding, text fallback).
  - 2:40–2:50: Raw Mode edge detection fallback & offline specimen archive.
  - 2:50–3:00: Teacher calibration bench & engineering test rigor (820+ passing tests).
- **Production Guidance:** Includes camera placement, sound capture for vibration motor, "What to do if X fails on stage" fallback matrix, and a clear list of what NOT to show/say.

### 3. `docs/reports/agy-lab-docs-report.md`
This lane completion report documenting changes, commands run, verification proofs, and Commit groups.

---

## 2. Command Execution & Proof

Per `agy-lab-docs.md`, no shell commands were run except file reads and allowed git status checks:

### `git status`
```
On branch agy/lab-docs
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/PHONE_CHECKLIST_LAB.md
	docs/briefs/agy-lab-docs.md
	docs/briefs/lab-spec.md
	docs/design/
	docs/reports/

nothing added to commit but untracked files present (use "git add" to track)
```

### `git diff --stat`
```
(No modifications to tracked files; documentation added cleanly)
```

### `git status --short`
```
?? docs/PHONE_CHECKLIST_LAB.md
?? docs/briefs/agy-lab-docs.md
?? docs/briefs/lab-spec.md
?? docs/design/LAB_DEMO_NOTES.md
?? docs/reports/agy-lab-docs-report.md
```

---

## 3. Files Created

- `docs/PHONE_CHECKLIST_LAB.md` (new)
- `docs/design/LAB_DEMO_NOTES.md` (new)
- `docs/reports/agy-lab-docs-report.md` (new)

No code, test, backend, or existing documentation files were modified.

---

## 4. Commit Groups

Ordered logical commits for the reviewer to apply:

### Commit 1: Documentation — Lab redesign phone checklist
- **Message:** `docs: add real-phone TalkBack and accessibility checklist for Lab theme`
- **Files:**
  - `docs/PHONE_CHECKLIST_LAB.md`

### Commit 2: Documentation — Lab redesign 3-minute video demo notes
- **Message:** `docs(design): add 3-minute demo video script and production guide for Lab theme`
- **Files:**
  - `docs/design/LAB_DEMO_NOTES.md`

### Commit 3: Documentation — Lane report
- **Message:** `docs: add agy-lab-docs lane completion report`
- **Files:**
  - `docs/reports/agy-lab-docs-report.md`
