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
- [x] 13. Saved diagrams and offline exploring (IndexedDB)
  - _Requirements: 11.1–11.7_
  - [x] 13.1 P11 bar pitch order
  - [x] 13.2 `core/savedDiagrams.ts`: `SavedDiagram` type, `savedTitle`, `makeId`, `chooseEviction`, `capExceeded`, `orderForDisplay` — pure, no browser APIs
  - [x] 13.3 P14 serialise round-trip (fast-check, 200 runs)
  - [x] 13.4 P15 eviction invariants (fast-check, 200 runs)
  - [x] 13.5 `drivers/diagramStore.ts`: `DiagramStore` interface, `IDBDiagramStore` (IndexedDB), `MemoryDiagramStore` (in-memory fake for tests); all calls in try/catch; storage-unavailable path returns error string
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
- [ ] 17. Frankenstein's Laboratory theme, retroactive spec verification, and CSS correctness properties (Requirement 14, P18–P20)
  - UI components and stylesheets implemented by Antigravity; specification, design, and property tests written by Antigravity, awaiting Kiro review.
  - [x] 17.1 Retroactive spec & design documentation for Frankenstein Lab theme in requirements.md and design.md (agy)
  - [x] 17.2 Property test P18: Alive animation bound and flash frequency (fast-check in frontend/tests/labTheme.prop.test.ts) (agy)
  - [x] 17.3 Property test P19: CSS @import ordering and stylesheet integrity (fast-check in frontend/tests/labTheme.prop.test.ts) (agy)
  - [x] 17.4 Property test P20: Design token color conformance and bare hex literal detection (fast-check in frontend/tests/labTheme.prop.test.ts) (agy)
  - [x] 17.5 Verification pass: full frontend test suite (vitest), TypeScript compilation (tsc), and Vite production build (agy)
- [ ] 18. Audit findings resolution (agy, awaiting Kiro review)
  - [x] 18.1 Frontend Finding 5: Suppress redundant canvas aria-label during speech synthesis to prevent TalkBack speech collision (Requirement 13.8) (agy, awaiting Kiro review)
  - [x] 18.2 Frontend Finding 14: Eliminate secondary pointer dead-zone by promoting oldest active pointer upon primary lift (Requirement 4.8) (agy, awaiting Kiro review)
  - [x] 18.3 Kiro hooks: Add CSS guard, accessibility guard, and pre-commit build log hooks in `.kiro/hooks/` with schema and regex validation tests (agy, awaiting Kiro review)
  - [x] 18.4 Backend SEC-01: Wrap `/api/v1/scene` in concurrency semaphore `asyncio.Semaphore(2)` with HTTP 503/429 retry headers (already implemented and merged by agy lane x-hardening; verify against the code)
  - [x] 18.5 Backend SEC-02: Lower `MAX_IMAGE_PIXELS` from 40 MP to 12 MP in `backend/app/image_utils.py` to prevent memory exhaustion (already implemented and merged by agy lane x-hardening; verify against the code)
  - [x] 18.6 Backend SEC-03: Add `await request.is_disconnected()` cancellation checks before provider dispatch and Raw Mode worker threads (already implemented and merged by agy lane x-hardening; verify against the code)
  - [x] 18.7 Backend SEC-04: Parse EXIF orientation tag in OpenCV Raw Mode to prevent 90° rotated diagram geometry (already implemented and merged by agy lane x-hardening; verify against the code)
  - [x] 18.8 Backend SEC-06: Apply scene element count and size bounds on `POST /api/v1/validate` (already implemented and merged by agy lane x-hardening; verify against the code)
  - [x] 18.9 Backend SEC-07 & SEC-08: Add security headers (`X-Content-Type-Options: nosniff`, `Cache-Control: no-store`) and disable OpenAPI docs in production (already implemented and merged by agy lane x-hardening; verify against the code)
  - [x] 18.10 Backend SEC-09: Align `docs/DEPLOY.md` model configuration with `render.yaml` (`gemini-3.5-flash-lite`) (already implemented and merged by agy lane x-hardening; verify against the code)

## Phase 3 — Kiro review, property gaps, and open items (Kiro, 2026-11-07)

> Rule from the owner: every new piece of work starts as a task here before any code is written.
> Legend: `[ ]` open, `[x]` done and verified, `[~]` needs the owner, a device, or an outside service.

- [x] 19. Kiro review of agent-written core (Task 11, Task 13) and property-test gaps for Req 9, 11, 13
  - [x] 19.1 Review `core/correct.ts`, P16, P17, `POST /api/v1/validate` and the Task 13 completion against `design.md` and `requirements.md`; write `docs/reviews/kiro-core-review.md` (adopt / rewrite / reject verdict per module)
  - [x] 19.2 Req 9: add P31 (edit operations are total, touch only their target, and keep coordinates in [0, 1] for any numeric input including NaN and Infinity) in `tests/correct.prop.test.ts`
  - [x] 19.3 Req 9: add P32 (`validateSceneInvariants` detects every injected violation: duplicate id, dangling reference, out-of-range or non-finite coordinate); fix any counterexample the property finds in `core/correct.ts`
  - [x] 19.4 Req 11: add P33 (`orderForDisplay` is a newest-first permutation; `savedTitle` is never blank and uses the scene title when present), P34 (re-saving or pinning an existing id never evicts and never changes the count), P35 (`deserialise` never throws on arbitrary input) in `tests/savedDiagrams.prop.test.ts`
  - [x] 19.5 Req 13: add P36 (centre tick fires once per excursion), P37 (centre tick never fires inside the corner quiet window; "Centre." is spoken at most once), P38 (two-finger exit swipe accepts only downward, fast, mostly vertical motion) in `tests/explore.gesture.prop.test.ts`
  - [x] 19.6 Req 9.3: add P39 backend property (Hypothesis, 200 examples): a valid scene passes `validate_scene` unchanged, and `validate_scene` is idempotent on its own output
  - [x] 19.7 Update `design.md` (P31–P39 rows; `DiagramStore` signature now returns `StoreResult`; `serialise` returns a string; `applyAdd` replaces an existing id in place)
  - [x] 19.8 Raise backend property tests below 200 cases (P10 uses 40; P13 has no explicit setting) or document the exception
  - [x] 19.9 Run `tsc`, full Vitest, ruff and pytest; record real results in `docs/BUILD_LOG.md` with "Kiro" as the tool
  - _Requirements: 9.2, 9.3, 11.1, 11.3, 11.5, 11.6, 13.2, 13.3, 13.5_

- [ ] 20. Follow-ups from the Kiro review (each needs a spec decision or app-code change; not part of Task 19)
  - [ ] 20.1 `drivers/diagramStore.ts`: wait for `tx.oncomplete` and handle `tx.onabort` before reporting success, and close the database on error paths (a quota error surfaces at commit, so Req 11.7 can be missed today)
  - [ ] 20.2 `App.tsx` `saveDiagram`: write the new entry first, then delete the evicted one, so a failed save cannot lose an old diagram (Req 11.5, 11.7)
  - [ ] 20.3 Req 11.3: open and delete saved diagrams by voice (not implemented in `SavedDiagrams.tsx` or `flow/commands.ts`)
  - [ ] 20.4 Req 11.1: `savedTitle` ignores its language argument and speaks the raw `kind` slug (for example "geometry") in Hindi and Gujarati; use i18n kind names
  - [x] 20.5 Req 9.2: Correct mode cannot delete polylines or bars; add `deletePolyline` and `deleteBar` to `core/correct.ts` and wire the screen (core half done in task 37.1, Requirement 21; the screen wiring is a later agy lane, specified in design.md "Correct mode: delete curves and bars")
  - [ ] 20.6 `tech.md` rule 1: centre-tick, axis-crossing and gesture decision logic lives in `flow/explore.ts` and calls `t()`; move the pure parts to `core/` and pass spoken text in
  - [ ] 20.7 Req 11.1 says "every scene loaded successfully" but samples are not saved (`App.tsx` `source !== 'sample'`); decide and update the requirement or the code
  - [x] 20.8 `package.json` `test:prop` finds nothing (`-t prop` matches test names, not file names); change to `vitest run .prop.test`
  - [x] 20.9 Replace the four remaining `fc.float` uses in `*.prop.test.ts` with `fc.double` (done by agy lane m2 in `22a64e4`; checked in task 37.2)
  - [x] 20.10 Keep `share/validate.ts` and `backend/app/validate.py` rules in sync (hand-mirrored); add a shared-fixture parity test (done in task 37.3: 32 cases, 14 known mismatches in `docs/reports/validator-parity.md`; the validators themselves are not changed, and the follow-ups there need a decision)
  - _Requirements: 9.2, 11.1, 11.3, 11.5, 11.7_

- [~] 21. Open items from `docs/handoffs/` (SESSION-2026-11-04 to 11-06-night, for-kiro.md, KIRO-PAUSE.md)
  - [ ] 21.1 Re-verify the state of lanes g5-semantic-ask, f1-fix-runtime, f2-fix-share, f3-fix-teach (reports say unreviewed; git log shows g5 merged) and review them against the spec
  - [ ] 21.2 Backend ask follow-ups A4-01 to A4-05 from `docs/reports/audit-a4-backend-ask.md` (Hindi danda in don't-know detection, clamp facts answers, polyline point cap, article "A", string answer check)
  - [ ] 21.3 Re-verify audit claims A1 G-RUN-02 (theremin during guiding) and G-RUN-04 (Back and history); record NOT REPRODUCED if false
  - [ ] 21.4 Confirm the five hooks (plus a11y, css-guard, pre-commit-build-log) appear in the Kiro hooks panel and fire; save a screenshot to `docs/kiro-evidence/`
  - [ ] 21.5 Decide on the centre reference tick (25 ms): approve it into `tech.md` or change it, using the phone-test result (task 22.4)
  - [ ] 21.6 Review Req 14/15, Task 17/18, P18–P30 and the three new hooks (all "agy, awaiting Kiro review")
  - [ ] 21.7 Tick parent tasks 7, 10, 14, 15, 16 only after the matching device and deployment checks
  - [~] 21.8 Owner: native-speaker check of Hindi and Gujarati (`docs/user-test/translation-review.md`), including key `capture.errorBusy`
  - [~] 21.9 Owner: fill the remaining `[FILL]` markers in `STEMERGENT_SUBMISSION.md`, `SOCIAL.md`, `KIRO_WRITEUP.md`; set the TalkBack row to "verified" only after the phone test passes
  - [~] 21.10 Owner: Render env check, one real photo on the live backend (expect mode "ai"), feature flags for Guide and Share, push local main, request Kiro credits before Dec 1
  - [ ] 21.11 Remove stale entries: KIRO-PAUSE defects 1 and 5 are fixed in code; defects 6 and 8 are still open (see 20.8, 20.9)

- [~] 22. Phone test (`docs/PHONE_TEST.md`, OnePlus Nord CE6, Chrome): `PHONE_TEST.md` is still an unfilled script with no recorded results, so these tasks cover running it and triaging what it finds
  - [~] 22.1 Step 0: wake the Render backend and confirm `{"ok":true}` before testing
  - [~] 22.2 Steps 5.1–5.4: TalkBack on, Explore entry, double-tap-hold pass-through; if TalkBack is silent on entry, revert the canvas `aria-label` suppression (Finding 5)
  - [~] 22.3 Step 4.4: corner "bzzzz-tap" `[50, 90, 50]` with the 450 ms quiet window is still distinct from the line buzz
  - [~] 22.4 Steps 5.2 and 5.4: centre tick (25 ms) is felt and distinct; feeds task 21.5
  - [~] 22.5 Steps 6.x and 12.x: voice recognition and text-to-speech in English, Hindi, Gujarati
  - [~] 22.6 Steps 8 and 9: a real photo (AI vs Raw Mode, reason and seconds) and a PDF first page
  - [~] 22.7 Steps 13.1–13.9 (Guide my finger) and 14.1–14.8 (Teacher share), only if the feature flags are turned on
  - [ ] 22.8 Record each result in `PHONE_TEST.md`; turn every FAIL into a new task under this heading before any code is written
  - _Requirements: 4.*, 5.*, 10.*, 12.*, 13.*_

## Phase 5 — Round 2 fixes (Kiro, 2026-11-07)

> Order of work for every task: finding verified and recorded in `docs/reviews/kiro-round2.md` (FIXED / NOT REPRODUCED / SKIPPED), then tests, then code. Gate before ticking: frontend `npx tsc --noEmit; npx vitest run; npm run build`; backend `pytest; ruff check; ruff format --check`. One commit per task: `kiro: T<n> <summary>`.
> Not changed in this round: contract decisions A2 SEC-01, A2 SEC-04, A5-05; the tuned haptic constants; `frontend/src/core` except for a real bug noted in the review.

- [x] 23. Spec for round 2: Requirements 16 and 17, design section, properties P40–P46, tasks 23–28
  - [x] 23.1 Requirement 16 (security and robustness) and Requirement 17 (navigation and announcement integrity) in `requirements.md`
  - [x] 23.2 Design section "Security and Robustness, round 2" and rows P40–P46 in `design.md`
  - [x] 23.3 Create `docs/reviews/kiro-round2.md` with one row per finding, filled in as each task verifies it
  - _Requirements: 16.*, 17.*_

- [x] 24. Backend Ask fixes (lane f4 plus CORE-04, CORE-05, CORE-06, CORE-11, CORE-12)
  - [x] 24.1 Bring the f4 lane work onto main. The branch `agy/f4-fix-backend-ask` has no commits (its work is uncommitted in the lane worktree), so apply the worktree diff as a patch instead of `git merge --squash`; record this in the review
  - [x] 24.2 Fix `test_fix_ask_regression.py`: facts answers are clamped; a client disconnect gives 499; the element-id list in the prompt contains no raw `</user_question>`
  - [x] 24.3 Fix `test_hardening.py::test_validate_structural_limits`: `/validate` keeps its limits; only the `/ask` polyline cap becomes 2000
  - [x] 24.4 Fix `test_review_fixes.py`: a lone unit word must not select a fact
  - [x] 24.5 CORE-04: Hindi danda and double danda in `is_dont_know`; "don't know" carries no target
  - [x] 24.6 CORE-06: `MAX_POLYLINE_POINTS = 2000` for `/ask`
  - [x] 24.7 Confirmed mediums CORE-11 (point "A") and CORE-12 (non-string `answer`), if reproduced
  - [x] 24.8 Gate (backend and frontend) passes; commit `kiro: T24 ...`
  - _Requirements: 16.9, 16.10, 16.11_

- [x] 25. Security A6-01 to A6-05 and confirmed mediums
  - [x] 25.1 A6-01: client identity from the trusted proxy hop, else the socket address
  - [x] 25.2 A6-02: prune empty rate-limit windows
  - [x] 25.3 A6-03: concurrency cap on `POST /api/v1/ask`
  - [x] 25.4 A6-04: CSP in `frontend/vercel.json` and on FastAPI; verify with `npm run build` and `npm run preview` that the console shows no violation
  - [x] 25.5 A6-05: guards apply under trailing and repeated slashes
  - [x] 25.6 A6-06 HSTS and Permissions-Policy; A6-07 WebP chunk walk; A6-08 Raw Mode candidate cap; A6-09 CI permissions and action versions; A6-10 improve-pass concurrency; A6-15 streamed overflow gives 413 (each only if reproduced)
  - [x] 25.7 Gate passes; commit `kiro: T25 ...`
  - _Requirements: 16.1 to 16.8_

- [x] 26. Bugs CORE-01 to CORE-03 and confirmed mediums (finished by Claude Code after Kiro was stopped; closed by Kiro 2026-11-09)
  - [x] 26.1 CORE-01: Back from `#/teach`, `#/share` and the share error screen speaks the destination, and unsaved Teacher edits need confirmation (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 26.2 CORE-02: axis crossings and the vertex are spoken as one utterance (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 26.3 CORE-03: `SavedDiagrams` does not speak or set state after unmount (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 26.4 CORE-07 combined delete message and focus; CORE-08 pointer capture try/catch; CORE-09 lost pointer capture; CORE-10 localised missing-voice notice (each only if reproduced) (code by Kiro in T26, committed by Claude Code after Kiro was stopped; CORE-09 proven by Kiro in task 30; CORE-08 not checked on a phone)
  - [x] 26.5 NEEDS-KIRO-01: `hitTest` treats non-finite distance as a miss (a real bug in `core/`; noted in the review) (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 26.6 Gate passes; commit `kiro: T26 ...` (committed as `8f60415` by Claude Code after Kiro was stopped, not as `kiro: T26`; gate re-run green by Kiro 2026-11-09)
  - _Requirements: 16.12, 17.*_

- [x] 27. Property tests for round 2 (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 27.1 P40 rate-limit identity resists spoofing; P41 limiter state is bounded (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 27.2 P42 guards are path-normalisation invariant (finished by Claude Code after Kiro was stopped; Kiro raised its two slow tests from 80 and 60 to 200 cases on 2026-11-09)
  - [x] 27.3 P43 Back navigation is total and spoken (Kiro)
  - [x] 27.4 P44 announcements join in order without loss (Kiro)
  - [x] 27.5 P45 fact answers are bounded; P46 "don't know" ignores trailing punctuation (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 27.6 Each new property is confirmed to fail on a deliberately broken version (P43, P44: Kiro; P40-P42, P45, P46: Claude Code after Kiro was stopped, all five re-run against current code by Kiro 2026-11-09 and killed)
  - [x] 27.7 Gate passes; commit `kiro: T27 ...` (committed as `1ca4cdb` by Claude Code after Kiro was stopped)
  - _Requirements: 16.1, 16.2, 16.5, 16.10, 17.1, 17.2_

- [x] 28. Evidence and log (finished by Claude Code after Kiro was stopped; closed by Kiro 2026-11-09)
  - [x] 28.1 `docs/kiro-evidence/round2.md`: spec to task to tests to what the tests caught (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 28.2 `docs/reviews/kiro-round2.md` complete: every finding FIXED, NOT REPRODUCED or SKIPPED with a reason (closed by Kiro 2026-11-09 after tasks 30 and 31)
  - [x] 28.3 `docs/BUILD_LOG.md` entry: Kiro did this work; agent-written findings and code are credited to Antigravity (finished by Claude Code after Kiro was stopped; verified by Kiro 2026-11-09)
  - [x] 28.4 Commit `kiro: T28 ...`; nothing is pushed (committed as `1ca4cdb` by Claude Code after Kiro was stopped; nothing pushed)

## Phase 6 — Round 3 (Kiro, 2026-11-09)

> Same rules as round 2: task first, failing test before the fix, one commit per task (`kiro: T<nn> ...`), full gate before ticking, BUILD_LOG entry with tool = Kiro.
> Do not edit while lanes k1, k4, k6 are being merged: `App.tsx`, `Explore.tsx`, `Correct.tsx`, `vite.config.ts`, `backend/app/main.py`. New i18n keys go in a separate, last commit after k1 and k6 are on `main`.
> Tuned haptic values and `frontend/src/core` purity unchanged.

- [x] 29. Spec Ghost: spec after code (built by agy, reviewed by Kiro)
  - [x] 29.1 Requirement 18 in `requirements.md` (EARS), written from the tournament brief and the shipped behaviour, marked "spec after code"
  - [x] 29.2 Design section and properties P47-P50 in `design.md`, exactly as implemented in `frontend/src/verify/verify.ts` and `tests/verify.test.ts`
  - [x] 29.3 `.kiro/steering/verify.md`: consistency check, not forgery protection; never "verified"; silent when unsure
  - [x] 29.4 Hook `.kiro/hooks/verify-tests-on-save.json`, modelled on `run-tests-on-core-save.json`, plus a hooks-test entry
  - [x] 29.5 Review `verify.ts` against Requirement 18; for each contradiction write a failing test first, then fix
  - [x] 29.6 Move to `frontend/src/core/verify.ts` if it is pure (no browser API, no React); keep one import path for callers
  - [x] 29.7 Bring P47-P50 to at least 200 cases and mutation-check each
  - [x] 29.9 (found by the gate, not planned) `validate_scene` must never raise when `facts` or `segments` is not a list (P9 counterexample from lane k3 code); failing test first in `backend/tests/test_validate_raw_meta.py`
  - [x] 29.8 `docs/KIRO_WRITEUP.md`: what was Kiro's (spec, steering, hook, review, fixes) and what was agy's (module and first tests)
  - _Requirements: 18.*_

- [x] 30. CORE-09: a revoked pointer capture ends the Teacher drag
  - [x] 30.1 Component test (jsdom, this file only) that fails when `onLostPointerCapture` is removed: after a lost capture, a later move and lift must not move the point
  - [x] 30.2 Keep the handler; gate; commit
  - _Requirements: 17.5_

- [x] 31. NEEDS-KIRO-02: unlabelled vertices are spoken in the active language
  - [x] 31.1 Engine emits `{ kind: 'speak', textKey: 'vertex.unlabelled', params: { id } }` for an unlabelled vertex; a labelled vertex keeps `{ kind: 'speak', text }`
  - [x] 31.2 `runEffects` resolves `textKey` through i18n; `mergeAnnouncements` and the Explore speech helpers handle both forms
  - [x] 31.3 Property: unlabelled gives the key effect, labelled gives the label text; P3-P7 and the tuned values unchanged
  - [x] 31.4 Key `vertex.unlabelled` in `en`, `hi`, `gu` and the translation sheets (separate commit `6bd9503`, after k1 and k6 were on `main`; committed before the code that uses it so `main` never spoke the raw key)
  - _Requirements: 4.3, 10.1_

- [x] 32. Hit test: PERF-01 and R3-07
  - [x] 32.1 Keep the current `hitTest` as a test oracle
  - [x] 32.2 PERF-01: bounding-box pre-checks per segment and polyline piece, endpoints transformed once, no per-segment allocation, identical results (no per-polyline box: without a cache it costs a pass over the points, and a cache in a pure module would go stale on in-place edits)
  - [x] 32.3 R3-07: a bar whose value is not finite is never hit
  - [x] 32.4 Properties: optimised equals oracle on random scenes including a 2000-point polyline (200+ runs); non-finite bar is never a hit; P1, P2, P8 green; each new property mutation-checked
  - _Requirements: 4.6, 6.1, 16.12_

- [x] 33. Round 3 evidence and log
  - [x] 33.1 `docs/kiro-evidence/round3.md`: requirement to task to test to what the test caught
  - [x] 33.2 BUILD_LOG entry per task (tool = Kiro); report anything unfinished

## Ghostwriter core (Requirement 19, spec written before the code)
> Core half only. Do not edit `Correct.tsx`, `Teach.tsx` or `flow/`: the UI hook-up is the next Antigravity lane. Tuned haptic values and `hitTest` unchanged; `frontend/src/core` stays pure.

- [x] 34. Ghostwriter: `addPoint` and `addSegment` in `core/correct.ts`
  - [x] 34.1 Requirement 19 (EARS), design section and properties P54-P57 written before any code
  - [x] 34.2 `addPoint(scene, x, y, label?, id?)`: rejects NaN and Infinity (same scene), clamps to [0, 1], free id given or generated (`A`..`Z`, then `P1`, `P2`, ...), optional trimmed label, immutable
  - [x] 34.3 `addSegment(scene, a, b, id?)`: same scene for unknown endpoints, a == b or an existing pair in either direction; id `${a}${b}` with a numeric suffix when taken; immutable
  - [x] 34.4 Properties P54-P57 in `frontend/tests/correct.ghostwriter.prop.test.ts` (fast-check, at least 200 runs each), plus an example: add the missing corner D and edge CD to the sample triangle
  - [x] 34.5 Requirement 19.6: check that no Spec Ghost path can say "verified" or "correct" after an edit; add a test only if one can (checked: every sentence is built from fact names, never from labels a teacher types; no path found, so no test)
  - [x] 34.6 Mutation-check each new property; gate (`tsc`, `npm test`, build); BUILD_LOG line (tool = Kiro)
  - _Requirements: 19.*_

- [x] 35. M4-10: a disputed angle is named in the active language (Requirement 18.2)
  - [x] 35.1 Decision: localise the word "angle" through i18n (option a). English stays "angle B", so the 18.2 property is unchanged; hi and gu use their own word. Requirement 18.2 and the design note updated first
  - [x] 35.2 `core/verify.ts`: angle findings carry `angleVertex`; pure `localizedFindingTarget(finding, angleName)`; no i18n in core
  - [x] 35.3 Key `verify.angleName` in en, hi, gu and the translation sheets; `flow/navigation.ts` and `flow/ask.ts` use it for the spoken name
  - [x] 35.4 Un-skip the M4-10 block in `tests/n2.round4.test.ts` (agy's file), expectations moved to option a with the intent kept: no English "angle" in the hi or gu caveat
  - [x] 35.5 P47-P50 and the 18.2 property at their run counts and green; gate; BUILD_LOG line (tool = Kiro)
  - _Requirements: 18.2, 10.1_

## Ghostwriter in Teach mode (Requirement 20; spec by Kiro, to be built by Antigravity lane g1)
> Teach screen only. Do not edit `frontend/src/core/**`, the tuned haptic values, or the Explore screen. Requirement 20 wins over `docs/briefs/agy-g1-ghostwriter-ui.md` where they differ (the cap is 300 points and 300 segments, set by sharing, not 500; Correct mode is out of scope).

- [ ] 36. Ghostwriter UI on the Teach screen
  - [ ] 36.1 Pure module `frontend/src/flow/ghostwriter.ts` as in design.md: the caps, `planAddPoint`, `planAddSegment`, `describeUndo`, `nextMode`, `ghostwriterSpeech`, `undoSpeech`, `GHOSTWRITER_KEYS`. No React, no browser API
  - [ ] 36.2 Properties P58-P61 in `frontend/tests/ghostwriter.prop.test.ts`, at least 200 runs each; mutation-check each one and record the mutants in the report
  - [ ] 36.3 i18n: every key in the design table in `en`, `hi`, `gu` with the same placeholders, plus rows in `docs/user-test/translation-review.csv` and `.md` marked for native review
  - [ ] 36.4 `screens/Teach.tsx`: "Add vertex" becomes "Add point" (20.2.6); add the "Add edge" control; both at least 48 × 48 CSS px with accessible names; apply adds through `applySceneEdit` / `applyEdit`; speak every outcome; undo speaks `undoSpeech` for an add
  - [ ] 36.5 Component tests in `frontend/tests/ghostwriter.teach.test.tsx` (jsdom), the list in design.md, including the 20.6 example
  - [ ] 36.6 Report what happened to `flow/teach.ts` `addVertex` / `generateUniquePointId` and their tests (kept for another caller, or removed)
  - [ ] 36.7 Gate (`tsc` 0 errors, `npm test` green with nothing skipped, build); BUILD_LOG entry (tool = "agy, reviewed by Claude"); report in `docs/reports/agy-g1-ghostwriter-ui-report.md`
  - _Requirements: 20.*_

## Review follow-ups 20.5, 20.9, 20.10 (task 37; spec written before the code)
> Do not edit `App.tsx`, `Explore.tsx`, `Correct.tsx`, `Teach.tsx`, `flow/`, `hitTest` or the tuned haptic values. Agy lanes are editing tests: skip any test file a non-Kiro commit changed in the last hour, and say so.

- [x] 37. Close review follow-ups 20.5 (core half), 20.9 and 20.10
  - [x] 37.1 Requirement 21, design and P62-P65 first; then `deletePolyline` and `deleteBar` in `core/correct.ts`; properties in `frontend/tests/correct.deleteKinds.prop.test.ts` (200+ runs), mutation-checked; the UI lane's controls and keys listed in design.md
  - [x] 37.2 (already done by agy lane m2 in `22a64e4`, TQ-09: the four `fc.float` in `geometry.prop.test.ts` became `fc.double` with the same ranges and `noNaN: true`; Kiro checked on 2026-11-09 that no `fc.float` is left in `frontend/tests`, so no file was edited) Replace the remaining `fc.float` uses in `frontend/tests/*.prop.test.ts` with `fc.double` (same ranges, `noNaN: true` where the old generator could not give NaN, same run counts)
  - [x] 37.3 Validator parity: fixture `backend/fixtures/validator_parity.json` (named scenes, expected `accept`/`reject`, a reason key for rejects, `known_mismatch` where the two validators differ); one pytest and one vitest that run it through `backend/app/validate.py` and `frontend/src/share/validate.ts`; mismatches written up in `docs/reports/validator-parity.md`; neither validator changed
  - _Requirements: 9.2, 9.3, 21.*_

## Round-5 audit invariants as property tests (task 38; spec written before the tests)
> Tests only. Do not edit `frontend/src/`, `core/`, the tuned haptic values, `App.tsx`, `Explore.tsx`, `Correct.tsx` or `Teach.tsx`. Lanes p2 (saved diagrams) and p3 (share and accessibility) had already merged into `main` (2d108ca) when these first ran; the properties that still fail are gaps those fixes left, listed in `docs/reviews/kiro-round5.md`. Do not skip, weaken or `.fails`-mark them to get a green run.

- [x] 38. Pin the round-5 invariants behind the HIGH findings as property tests (closed in task 39.0: all 13 pass under the recorded and fresh seeds after agy fixes 3fdad91, 3a6353d, c3855b6)
  - [x] 38.1 Requirement 22, the design section, P66-P78 (Requirement 21 and P62-P65 were already taken by task 37)
  - [x] 38.2 `frontend/tests/share.sanitize.prop.test.ts` (P66-P70), `share.template.prop.test.ts` (P71), `saved.eviction.prop.test.ts` (P72-P76), `share.honesty.prop.test.ts` (P77-P78); 200+ runs each; `tsc --noEmit` 0 errors
  - [x] 38.3 Run them; every failing property with its shrunk counterexample and replay seed in `docs/reviews/kiro-round5.md`
  - [x] 38.4 After an agy lane fixes the gaps in `docs/reviews/kiro-round5.md` (or the lead accepts one as intended and Requirement 22 is amended first): rerun all four files with the recorded seeds and fresh ones; every property green; then tick 38
  - _Requirements: 22.*_

## Round-5 audit items for core and tests (task 39; sources `docs/reports/audit-r5-kiro-glue.md`, `docs/reports/audit-u1-g1.md`, `docs/reviews/kiro-round5.md`)
> Each audit claim is checked against the code first; a wrong claim is written up with the evidence and gets no code. Spec before code. Do not edit `screens/`, `flow/`, `App.tsx`, `hitTest` or the tuned haptic values; a fix that needs one is listed in the report.

- [x] 39. Close the core and test items from the round-5 audits
  - [x] 39.0 Rerun the four round-5 property files (P66-P78) with the recorded seeds and fresh ones; all green, so 38 and 38.4 are ticked and `docs/reviews/kiro-round5.md` updated
  - [x] 39.1 (HIGH) Reserved ids: `RESERVED_ELEMENT_IDS` / `isReservedId` in core, used by `addPoint`, `addSegment`, `validateSceneInvariants` and `share/validate.ts`; P79 (200+ runs), mutation-checked. Audit check: the `renameLabel` claim is right; the claim that the share export drops the segment is wrong (the share validator renames the endpoints too)
  - [x] 39.2 (MED) Point cap stays with the caller (23.4); `tests/caps.agree.test.ts` checks the Ghostwriter caps against the share and backend limits. Audit check: `addPoint` has one caller (`flow/ghostwriter.ts`), which already caps at 300, so the >500 offline-save scenario is not reachable through `addPoint` today
  - [x] 39.3 (MED) `localizedFindingTarget` without `angleVertex` (P80); English-only facts written into Requirement 18.10 as a non-goal, pinned by P81
  - [x] 39.4 (LOW) Tighten the 18.2 property (a forged side must be flagged), `verify.angleName.test.ts` (go through `verifyScene` and an independent expected sentence) and P56 (a pair that always adds, plus redo); mutation-check each
  - [x] 39.5 (LOW) Coincident points: nudge (23.6), P82; the UI lane's string `teach.pointNudged` is in design.md
  - _Requirements: 18.10, 23.*_
