# Implementation Plan: Ghost Touch

Spec-driven implementation plan for Ghost Touch (React PWA + FastAPI).
Properties P1–P13 validate the core contracts via fast-check and Hypothesis.

---

## Phase 1 — MVP (STEMergent Hacks)

- [x] 1. Project skeleton and environment
  - [x] 1.1 Repo layout: `frontend/` (Vite + React + TS), `backend/` (FastAPI + Python 3.11), `prototypes/`
  - [x] 1.2 Pure core setup: Vitest with `fast-check` in frontend; pytest with `hypothesis` in backend
  - [x] 1.3 `tech.md` rule 3 codegen: JSON Schema from Pydantic `DiagramScene` -> `frontend/src/types/scene.gen.ts`
  - [x] 1.4 Dark theme CSS skeleton with glowing green accent (`#39ff88`) and 7:1 contrast tokens
  - [x] 1.5 PWA manifest, service worker registration, and mobile viewport locks
- [x] 2. Pure geometry, hit-testing, and property tests (P1, P2, P8)
  - [x] 2.1 `frontend/src/core/geometry.ts`: `toScreen`, `toNorm`, `distToSegment`
  - [x] 2.2 `frontend/src/core/hitTest.ts`: `Target` discriminator, priority `vertex > bar edge/line > bar interior > none`
  - [x] 2.3 Property P8: coordinate round-trip `toNorm(toScreen(p)) ≈ p`
  - [x] 2.4 Property P1: every point is reachable; at its screen position hitTest returns that vertex
  - [x] 2.5 Property P2: vertex beats line within vertex radius (22 CSS px)
- [x] 3. Audio & pitch mapping (theremin tone) and property P7
  - [x] 3.1 `frontend/src/core/pitch.ts`: `pitchForY` (200–1000 Hz, top higher) and `pitchForValue`
  - [x] 3.2 Property P7: pitch is monotonic with graph height and stays in [200, 1000]
  - [x] 3.3 `frontend/src/drivers/audio.ts`: Web Audio API wrapper (one sine oscillator, smoothed frequency/gain, audio unlock on first user gesture)
- [x] 4. Haptic engine state machine and properties (P3, P4, P5, P6)
  - [x] 4.1 `frontend/src/core/hapticEngine.ts`: pure `step(state, input, cfg) -> { state, effects }`
  - [x] 4.2 Property P3: corner pulse never merged with line buzz (quiet window enforced)
  - [x] 4.3 Property P4: consecutive moves on the same vertex emit corner pattern exactly once
  - [x] 4.4 Property P5: continuous line buzz while finger stays on a line
  - [x] 4.5 Property P6: finger lift silences everything (`vibrate(0)`, `tone(null)`)
  - [x] 4.6 `frontend/src/drivers/haptics.ts`: `WebHapticDriver` with feature detection and silent fallback
- [x] 5. Start screen, speech driver, and unlock flow (Requirement 1)
  - [x] 5.1 `frontend/src/drivers/speech.ts`: Web Speech API wrapper (`speak`, `listen`, cancel on new utterance)
  - [x] 5.2 `frontend/src/screens/Start.tsx`: full-screen touchable surface, speaks "Ghost Touch. Tap anywhere to begin."
  - [x] 5.3 First-gesture unlock handler: calls `audio.unlock()`, triggers confirmation vibration, navigates to Capture
  - [x] 5.4 Unsupported-vibration banner & speech announcement ("Audio-only mode")
  - [x] 5.5 Hidden `#/debug` page displaying Vibration API, Web Audio, and Web Speech availability
- [x] 6. Diagram capture and image intake (Requirement 2)
  - [x] 6.1 `frontend/src/screens/Capture.tsx`: "Take photo" (`capture="environment"`), "Choose image", and sample selector
  - [x] 6.2 Client-side image shrink to 1600 px longest side; 50 MB raw rejection
  - [x] 6.3 PDF first-page rendering to image before upload (`pdfjs-dist` or browser canvas)
  - [x] 6.4 Progress tone (soft repeating beep every 1.5 s) and spoken "Reading your diagram"
  - [x] 6.5 Bundle 3 offline sample diagrams in `frontend/public/samples/` (triangle, sine curve, bar chart)
- [x] 7. Backend service: schema, validation, Raw Mode, and property tests (P9, P10)
  - [x] 7.1 `backend/app/schema.py`: Pydantic `DiagramScene` model with four kinds
  - [x] 7.2 `backend/app/validate.py`: post-LLM validation, repair (clamp ±0.02, drop dangling segments), enforce unique ids
  - [x] 7.3 Property P9: validator invariants hold on any accepted scene; garbage input never raises 500
  - [x] 7.4 `backend/app/raw_mode.py`: OpenCV edge detection -> simplified segments (Douglas–Peucker, <=300 segments)
  - [x] 7.5 Property P10: Raw Mode bound (<=300 segments, all normalized in [0, 1])
  - [x] 7.6 `backend/app/vision/`: provider interface + concrete Gemini / Claude vision provider from env var
  - [x] 7.7 `POST /api/v1/scene`: 15 s timeout, 1 retry on invalid JSON, fallback to Raw Mode
- [x] 8. Explore screen: touch canvas and multimodal loop (Requirements 4, 5, 6, 8)
  - [x] 8.1 `frontend/src/screens/Explore.tsx`: full-screen canvas, captures pointer events directly
  - [x] 8.2 Pointer move handler: connects `hitTest` -> `hapticEngine.step` -> driver effect execution
  - [x] 8.3 Theremin tone integration: curves drive `audio.setTone(pitchForY(y))`
  - [x] 8.4 Bar chart exploration: speaks bar label and value on entry; pitch proportional to value
  - [x] 8.5 Axis crossing announcements: speaks "x-axis" / "y-axis" once per crossing
  - [x] 8.6 Two-finger swipe down gesture to exit Explore back to Capture
  - [x] 8.7 Integration test with synthetic pointer events verifying vibration + tone + speech coordination
- [x] 9. Ask questions by voice (Requirement 7)
  - [x] 9.1 Long-press gesture (two fingers, 500 ms) or accessible "Ask" button opens voice input
  - [x] 9.2 `POST /api/v1/ask`: backend endpoint taking `{ scene, question }`, uses LLM with strict prompt (answer from scene only, else "I don't know")
  - [x] 9.3 Speech recognition input with listening tone; text input fallback if SpeechRecognition is unavailable
  - [x] 9.4 Spoken answer playback with cancellation on new touch
- [ ] 10. Deploy and submit to STEMergent
  - [~] 10.1 Frontend on Vercel, backend on Render; health check
  - [~] 10.2 Record a short demo; write the STEMergent description (problem, STEM link, AI disclosure)
  - [~] 10.3 Submit before **Nov 16, 9:00 am IST**

## Phase 2 — Kiroween polish

- [x] 11. Teacher Correct mode (overlay, drag points, edit labels, validate on save)
  - [x] 11.1 Pure core `core/correct.ts`: immutable edits (movePoint, renameLabel, deletePoint, deleteSegment) and history reducer
  - [x] 11.2 Property tests P16 and P17 in `tests/correct.prop.test.ts`
  - [x] 11.3 Client `api/validate.ts` for `POST /api/v1/validate` and unit tests
  - [x] 11.4 Screen `screens/Correct.tsx`, `flow/correct.ts`, styling `styles/correct.css`
  - [x] 11.5 Explore entry button, photo URL state in `App.tsx`, and i18n keys
  - _Requirements: 9.1–9.3_
- [x] 12. Hindi and Gujarati (i18n strings, speech language, ask language)
  - _Requirements: 10.1, 10.2_
- [ ] 13. Saved diagrams and offline exploring (IndexedDB)
  - _Requirements: 11.1–11.7_
  - [x] 13.1 P11 bar pitch order
  - [ ] 13.2 `core/savedDiagrams.ts`: `SavedDiagram` type, `savedTitle`, `makeId`, `chooseEviction`, `capExceeded`, `orderForDisplay` — pure, no browser APIs
  - [ ] 13.3 P14 serialise round-trip (fast-check, 200 runs)
  - [ ] 13.4 P15 eviction invariants (fast-check, 200 runs)
  - [ ] 13.5 `drivers/diagramStore.ts`: `DiagramStore` interface, `IDBDiagramStore` (IndexedDB), `MemoryDiagramStore` (in-memory fake for tests); all calls in try/catch; storage-unavailable path returns error string
  - [x] 13.6 Save on scene load: after every successful `handleScene`, generate thumbnail (canvas toDataURL) and call `diagramStore.put`; if it fails speak `t('saved.errorSave')`
  - [x] 13.7 `screens/SavedDiagrams.tsx`: list view reachable from Capture via "Saved diagrams" button (48×48 px, accessible name); each entry has open and delete controls; pinning control; spoken state changes; `t()` for all strings; offline-open goes straight to Explore
  - [x] 13.8 i18n: add all `saved.*` and any new `capture.*` keys to `en`, `hi`, and `gu` tables
  - [x] 13.9 Unit + render tests: `tests/drivers.diagramStore.test.ts`, additions to `tests/screens.render.test.ts` for SavedDiagrams, i18n parity test that all `saved.*` keys exist in every language table
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
