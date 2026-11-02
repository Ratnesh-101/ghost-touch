# Implementation Plan

> MVP target: STEMergent submission by **Nov 15** (tasks 1–10).
> Polish target: Kiroween submission by **Dec 4** (tasks 11–16).
> Tasks marked `*` are property-based tests from design.md.

## Phase 1 — MVP

- [x] 1. Scaffold the monorepo
  - Create `frontend/` (React + Vite + TS, strict) and `backend/` (FastAPI, Pydantic v2) per `structure.md`
  - Add Vitest + fast-check, pytest + Hypothesis, ruff
  - Add MIT `LICENSE`, `README.md`, PWA manifest
  - _Requirements: 12.1_

- [x] 2. Define the DiagramScene schema
  - [x] 2.1 Implement Pydantic models in `backend/app/schema.py`
  - [x] 2.2 Add a script that exports JSON Schema and generates `frontend/src/types/scene.gen.ts`
  - [x] 2.3 Create fixtures: triangle, sine graph, bar chart (also used as in-app samples)
  - _Requirements: 3.1, 3.2, 3.5, 2.4_

- [x] 3. Build the pure geometry and hit-testing core
  - [x] 3.1 `core/geometry.ts`: `toScreen`, `toNorm`, `distToSegment`, letterboxed `Viewport`
  - [x] 3.2 `core/hitTest.ts` with priority vertex > line > bar interior > none
  - [x] 3.3 P8 coordinate round-trip
  - [x] 3.4 P1 every point reachable
  - [x] 3.5 P2 vertex beats line
  - _Requirements: 3.2, 4.3, 4.6_

- [x] 4. Build the haptic engine state machine
  - [x] 4.1 `core/hapticEngine.ts` implementing engine rules 1–6 with `HapticConfig` defaults from `tech.md`
  - [x] 4.2 `core/pitch.ts`: `pitchForY`, `pitchForValue`
  - [x] 4.3 P3 corner pulse never merged
  - [x] 4.4 P4 no repeated corner
  - [x] 4.5 P5 continuous line buzz
  - [x] 4.6 P6 lift silences everything
  - [x] 4.7 P7 pitch monotonic and bounded
  - _Requirements: 4.1–4.7, 5.1, 5.2_

- [x] 5. Implement browser drivers
  - [x] 5.1 `WebHapticDriver` behind `HapticDriver`; report support status
  - [x] 5.2 `AudioDriver` theremin (smoothed frequency, 100 ms fade-out)
  - [x] 5.3 `SpeechDriver` speak (cancel-previous) and listen
  - _Requirements: 1.2, 1.3, 5.3, 7.1_

- [x] 6. Build Start and Capture screens
  - [x] 6.1 Full-screen tap-to-start that unlocks vibration, audio, speech; spoken intro
  - [x] 6.2 Camera capture + file picker + sample diagrams; client-side downscale to 1600 px
  - [x] 6.3 Spoken "Reading your diagram" + progress tone
  - [x] 6.4 PDF first page upload (rendered to image in browser); 50 MB raw file limit with spoken reason
  - _Requirements: 1.1-1.3, 2.1-2.5_

- [ ] 7. Build the Explore screen
  - [x] 7.1 Canvas renders the scene (dark theme, glowing green strokes)
  - [x] 7.2 Pointer events → `hitTest` → `step` → drivers
  - [x] 7.3 Axis-crossing announcements and bar label/value speech
  - [x] 7.4 Two-finger swipe down exit shortcut (TalkBack off)
  - [~] 7.5 Manual device check on Nord CE6 against the checklist in design.md
  - [x] 7.6 Explore gesture: double-tap-hold-drag cursor, centre reference tick on hold start (Req 13.1-13.4)
  - [x] 7.7 Back button / labelled Back exit; no two-finger-only exit (Req 13.5, 13.6)
  - [x] 7.8 Hide spoken text from screen reader to prevent double-reading (Req 13.7)
  - [x] 7.9 P12 explore gesture events reach the engine (integration test)
  - _Requirements: 4.*, 5.*, 6.*, 12.3, 13.*_

- [x] 8. Implement the backend scene pipeline
  - [x] 8.1 `VisionProvider` interface + one provider (model and key from env)
  - [x] 8.2 Extraction prompt that requests schema-matching JSON with normalized coordinates and `facts`
  - [x] 8.3 `validate.py` with repair rules; one retry on failure
  - [x] 8.4 `raw_mode.py` (Canny → contours → simplify → ≤300 segments)
  - [x] 8.5 `POST /api/v1/scene` with 15 s timeout → Raw Mode fallback
  - [x] 8.6 P9 validator invariants (Hypothesis, including garbage input)
  - [x] 8.7 P10 Raw Mode segment bound
  - [x] 8.8 Validator rejects colour/shape-only labels; retry then Raw Mode (Req 3.6)
  - [x] 8.9 P13 validator rejects colour- or shape-only labels (property test)
  - _Requirements: 3.1-3.6, 8.1-8.3_

- [x] 9. Implement voice questions
  - [x] 9.1 `POST /api/v1/ask` answering only from scene + facts; "I don't know" when unsupported
  - [x] 9.2 Ask flow in the frontend (two-finger long-press, listening tone, spoken answer, text fallback)
  - _Requirements: 7.1–7.4_

- [ ] 10. Deploy and submit to STEMergent
  - [~] 10.1 Frontend on Vercel, backend on Render; health check
  - [~] 10.2 Record a short demo; write the STEMergent description (problem, STEM link, AI disclosure)
  - [~] 10.3 Submit before **Nov 16, 9:00 am IST**

## Phase 2 — Kiroween polish

- [~] 11. Teacher Correct mode (overlay, drag points, edit labels, validate on save)
  - _Requirements: 9.1–9.3_
- [~] 12. Hindi and Gujarati (i18n strings, speech language, ask language)
  - _Requirements: 10.1, 10.2_
- [ ] 13. Saved diagrams and offline exploring (IndexedDB)
  - _Requirements: 11.1, 11.2_
  - [x] 13.1 P11 bar pitch order
- [~] 14. Accessibility pass (TalkBack walkthrough, 48 px targets, 7:1 contrast) and Halloween presentation layer (creature mascot, theremin branding)
  - _Requirements: 12.1–12.3_
- [~] 15. Budget-phone test and Capacitor decision
  - Test on one budget Android phone; if patterns blur, implement `CapacitorHapticDriver`
- [ ] 16. Kiroween submission package
  - [~] 16.1 Demo video under 3 minutes (blindfolded trace + real student session if possible)
  - [~] 16.2 Kiro write-up: specs, steering, hooks, property-based tests (P1–P13), what PBT caught
  - [~] 16.3 Blog post mentioning Kiroween 2026; social post starting with `#KiroweenHackathon26`
  - [~] 16.4 Confirm `/.kiro` is committed, license visible in GitHub About, repo public
  - [~] 16.5 Submit before **Dec 5, 3:30 am IST**; request Kiro credits before **Dec 1**
