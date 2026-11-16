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
  - [~] 16.1 Demo video under 3 minutes (eyes-closed trace by a sighted helper, or a real student with consent)
  - [~] 16.2 Kiro write-up: specs, steering, hooks, property-based tests (P1–P13), what PBT caught
  - [~] 16.3 Blog post mentioning Kiroween 2026; social post starting with `#KiroweenHackathon26`
  - [~] 16.4 Confirm `/.kiro` is committed, license visible in GitHub About, repo public
  - [~] 16.5 Submit before **Dec 5, 3:30 am IST**; request Kiro credits before **Dec 1**
- [x] 17. Frankenstein's Laboratory theme, retroactive spec verification, and CSS correctness properties (Requirement 14, P18–P20)
  - UI components and stylesheets implemented by Antigravity; specification, design, and property tests written by Antigravity, awaiting Kiro review.
  - [x] 17.1 Retroactive spec & design documentation for Frankenstein Lab theme in requirements.md and design.md (agy)
  - [x] 17.2 Property test P18: Alive animation bound and flash frequency (fast-check in frontend/tests/labTheme.prop.test.ts) (agy)
  - [x] 17.3 Property test P19: CSS @import ordering and stylesheet integrity (fast-check in frontend/tests/labTheme.prop.test.ts) (agy)
  - [x] 17.4 Property test P20: Design token color conformance and bare hex literal detection (fast-check in frontend/tests/labTheme.prop.test.ts) (agy)
  - [x] 17.5 Verification pass: full frontend test suite (vitest), TypeScript compilation (tsc), and Vite production build (agy)
- [x] 18. Audit findings resolution (agy, awaiting Kiro review)
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
  - [x] 19.8 Raise backend property tests below 200 cases (P10 uses 40; P13 has no explicit setting) or document the exception (2026-11-10, PR #25: the last two below 200, in `backend/tests/test_ask_target_props.py`, raised from 100 and 150 to 200)
  - [x] 19.9 Run `tsc`, full Vitest, ruff and pytest; record real results in `docs/BUILD_LOG.md` with "Kiro" as the tool
  - _Requirements: 9.2, 9.3, 11.1, 11.3, 11.5, 11.6, 13.2, 13.3, 13.5_

- [ ] 20. Follow-ups from the Kiro review (each needs a spec decision or app-code change; not part of Task 19)
  - [ ] 20.1 `drivers/diagramStore.ts`: wait for `tx.oncomplete` and handle `tx.onabort` before reporting success, and close the database on error paths (a quota error surfaces at commit, so Req 11.7 can be missed today)
  - [ ] 20.2 `App.tsx` `saveDiagram`: write the new entry first, then delete the evicted one, so a failed save cannot lose an old diagram (Req 11.5, 11.7)
  - [ ] 20.3 Req 11.3: open and delete saved diagrams by voice (not implemented in `SavedDiagrams.tsx` or `flow/commands.ts`)
  - [x] 20.4 Req 11.1: `savedTitle` ignores its language argument and speaks the raw `kind` slug (for example "geometry") in Hindi and Gujarati; use i18n kind names (done 2026-11-10, PR #26: `KIND_NAMES` in core; open: the Saved screen speaks the title stored at save time, so a language switch does not change it)
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

- [x] 36. Ghostwriter UI on the Teach screen (built by agy lane g1, merged; verified in git log, frontend/src/flow/ghostwriter.ts, Teach.tsx and docs/reports/agy-g1-ghostwriter-ui-report.md)
  - [x] 36.1 Pure module `frontend/src/flow/ghostwriter.ts` as in design.md: the caps, `planAddPoint`, `planAddSegment`, `describeUndo`, `nextMode`, `ghostwriterSpeech`, `undoSpeech`, `GHOSTWRITER_KEYS`. No React, no browser API
  - [x] 36.2 Properties P58-P61 in `frontend/tests/ghostwriter.prop.test.ts`, at least 200 runs each; mutation-check each one and record the mutants in the report
  - [x] 36.3 i18n: every key in the design table in `en`, `hi`, `gu` with the same placeholders, plus rows in `docs/user-test/translation-review.csv` and `.md` marked for native review
  - [x] 36.4 `screens/Teach.tsx`: "Add vertex" becomes "Add point" (20.2.6); add the "Add edge" control; both at least 48 × 48 CSS px with accessible names; apply adds through `applySceneEdit` / `applyEdit`; speak every outcome; undo speaks `undoSpeech` for an add
  - [x] 36.5 Component tests in `frontend/tests/ghostwriter.teach.test.tsx` (jsdom), the list in design.md, including the 20.6 example
  - [x] 36.6 Report what happened to `flow/teach.ts` `addVertex` / `generateUniquePointId` and their tests (kept for another caller, or removed)
  - [x] 36.7 Gate (`tsc` 0 errors, `npm test` green with nothing skipped, build); BUILD_LOG entry (tool = "agy, reviewed by Claude"); report in `docs/reports/agy-g1-ghostwriter-ui-report.md`
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

## Round-6 spec decisions and test-first oracles (task 40)
> Do not edit `screens/`, `flow/`, `App.tsx`, the tuned haptic values or `hitTest` (agy lanes are in them). Tests that wait on a lane are listed in `docs/reviews/kiro-round6.md`.

- [x] 40. Round-6 decisions, oracles and write-up (Kiro's part; the code the red tests wait for is listed in docs/reviews/kiro-round6.md)
  - [x] 40.1 Back from Correct: decision (a) in Requirement 24.1 and design.md (exact `leaveByBack` signature); P43 amended test-first (red until the lane implements `correctDirty`)
  - [x] 40.2 Write order over the cap: reproduce with generators and injected failures; Requirement 22.14; P83 for the memory store and the fallback; fix `MemoryDiagramStore.putWithEviction` order (drivers); the fallback fix in `flow/saved.ts` is for an agy lane
  - [x] 40.3 Lane a1 oracles: `reserved_*` parity cases checked structurally on both sides; P84 for the share validator (200+ runs); red cases recorded in `kiro-round6.md`
  - [x] 40.4 `docs/KIRO_WRITEUP.md` for tasks 34-40: real bugs caught by P66-P82 with counterexamples, the 19 mutation checks of task 39, honest Kiro/agy split; no test totals, no hardware claims
  - _Requirements: 22.14, 24.*_

- [x] 41. W3 audible buzz fallback: requirement and property (code merged by Antigravity in `5bf9b1e`)
  - [x] 41.1 Requirement 1.4-1.5 (EARS; the prompt said "Requirement 3.3", but the Vibration API fallback is Requirement 1.3) and P85 in design.md
  - [x] 41.2 P85 in `frontend/tests/haptics.buzz.prop.test.ts` against `patternToBuzzes` (200+ runs), with the corner pattern [50, 90, 50] as an example; a real bug is reported, not fixed (`drivers/haptics.ts` is agy's)
  - _Requirements: 1.3, 1.4, 1.5_


## P0: Explore canvas size is stable during interaction (Requirement 25; spec written before the code)
> Owner's video on a Galaxy S24+: the canvas grows for about 7 s after the first hold. PR #34 (5616cd5) took the canvas out of flow; this task verifies the other suspects and fixes the root cause. Do not touch `hapticEngine.ts`, the tuned haptic values or `core/`. Do not run Playwright (another agent adds the e2e test).

- [x] 42. Explore canvas size is stable during interaction
  - [x] 42.1 Requirement 25 and design section (P86, P87) before any code
  - [x] 42.2 Pure helper `flow/canvasSize.ts` (`measureBox`, `reconcileCanvasBox`) and P86 in `tests/canvasSize.prop.test.ts` (200+ runs), mutation-checked
  - [x] 42.3 `Explore.tsx`: size from the container, resize only when the container changed, observer on the container, no bitmap reset on pointer down
  - [x] 42.4 CSS in `global.css` and `explore.css`: fixed screen height, flex-basis 0 container, fixed status and debug height, touch-action and overscroll rules; layout test (P87) in `tests/explore.layout.test.tsx`
  - [x] 42.5 `docs/kiro-evidence/canvas-resize-bug.md`: root cause, changes, what jsdom cannot show, what to re-check on the S24+
  - [x] 42.6 Gate (`tsc --noEmit`, `vitest run`: 162 files, 2120 tests; `npm run build`); BUILD_LOG entry (tool = Kiro) as the last commit
  - _Requirements: 25.*_

## Know where the line goes (Requirement 26; spec written before the code)
> Core half only. Do not edit `hitTest.ts`, `hapticEngine.ts`, `frontend/src/guide/`, the tuned haptic values, `screens/` or `flow/`. The speech wiring is lanes A3 and A5 of `docs/reports/fable-blind-user-plan.md`.

- [x] 43. Compass helpers in `core/compass.ts`
  - [x] 43.1 Requirement 26, design section and properties P88-P95 written before any code
  - [x] 43.2 `frontend/src/core/compass.ts`: `Compass8`, `directionOf`, `vertexExits`, `lineEnds`, `nearestElement`; pure, named exports, no `any`
  - [x] 43.3 Properties P88-P95 in `frontend/tests/compass.prop.test.ts` (fast-check, 250 runs each, 1000 for the atan2 oracle, 500 for P95); mutation-checked with four mutants (wrong sector slope, no segment clamp, swapped line-end directions: all caught; dropping the self-loop guard is an equivalent mutant, because the coincident-point check already skips a self-loop). Correction (independent review, 2026-11-15, finding 2): two more mutants were NOT caught by P88-P95 as first written (dropping the last piece of every polyline; dropping one bar edge). Closed in task 53.2 with new property tests that put the finger beside those pieces; the "four mutants" above was not the whole claim "no element is nearer" needs
  - [x] 43.4 Gate (`tsc --noEmit` 0 errors, `vitest run` 182 files / 2247 tests); BUILD_LOG entry (tool = Kiro). No property found a bug in the new code on its first run
  - _Requirements: 26.*_

## A corner does not repeat on a shaky finger (Requirement 4.9; spec written before the code)
> Numbered 50 because the `kiro: T44` to `T49` commit messages are already used by the K4 audit fixes. Only `core/hapticEngine.ts` changes. Tuned haptic values untouched.

- [x] 50. Suppress a repeated corner inside its quiet window
  - [x] 50.1 Requirement 4.9, design section and property P96 written before any code
  - [x] 50.2 `core/hapticEngine.ts`: optional `lastCornerId`; re-entry of the last corner's vertex while `t < quietUntil` emits nothing and keeps `quietUntil`
  - [x] 50.3 P96 (a) to (c) in `tests/hapticEngine.reentry.prop.test.ts` (200+ runs), mutation-checked; P3 to P6 unchanged
  - [x] 50.4 Regression test in `tests/haptic.corner.regression.test.ts`: triangle, leave A along AC at 30 px/s, 60 Hz, seeded 2 px jitter
  - [x] 50.5 Gate (`tsc --noEmit` 0 errors, `vitest run` 183 files / 2262 tests); commit
  - _Requirements: 4.4, 4.5, 4.9_


## Find the line again (Requirement 27; spec written before the code)
> Core half only. Do not edit `hitTest.ts`, `hapticEngine.ts`, `compass.ts`, `frontend/src/guide/`, the tuned haptic values, `screens/` or `flow/`. The audio driver and wiring are lane A4 of `docs/reports/fable-blind-user-plan.md`. Every new number is proposed, pending owner approval.

- [x] 51. Near-line click cue machine in `core/proximity.ts`
  - [x] 51.1 Requirement 27, design section, properties P97-P103 and a separate "proposed" row in `tech.md` written before any code
  - [x] 51.2 `frontend/src/core/proximity.ts`: `ProximityConfig`, `DEFAULT_PROXIMITY`, `ProximityInput`, `ProximityEffect`, `proximityStep` (plus the pure helpers `clickIntervalMs`, `clickHz`, `clickGain`, `clickPan`); pure, named exports, no `any`
  - [x] 51.3 Properties P97-P103 in `frontend/tests/proximity.prop.test.ts` (fast-check, 250 runs each); mutation-checked with eight mutants (no gap guard, line outside the quiet window still clicks, pan sign flipped, radius boundary exclusive, pitch inverted, lift resets the click clock, interval swapped, gain constant: all caught)
  - [x] 51.4 Gate (`tsc --noEmit` 0 errors, `vitest run` 185 files / 2289 tests); BUILD_LOG entry (tool = Kiro)
  - _Requirements: 27.*_

## A curve beats an axis; curve height at x (Requirement 5.5, 5.6; spec written before the code)
> Core only. Do not edit hapticEngine.ts, compass.ts, proximity.ts, screens/, low/, or the tuned haptic values. The scan audio wiring is lane A6 of docs/reports/fable-blind-user-plan.md.

- [x] 52. Curve beats axis in hitTest, and core/curve.ts
  - [x] 52.1 Requirement 5.5 and 5.6, design section and properties P104-P108 written before any code
  - [x] 52.2 core/hitTest.ts indLine: drop axis candidates when a polyline is within the radius
  - [x] 52.3 core/curve.ts: curveYAtX
  - [x] 52.4 Properties P104-P108 (200+ runs), P52 restricted, any other changed test named; mutation-check
  - [x] 52.5 Gate (	sc --noEmit, itest run); BUILD_LOG entry (tool = Kiro)
  - _Requirements: 5.5, 5.6_

## Close the review of K1 and K2 (docs/reviews/kiro-review-k1-k2.md; spec written before the tests)
> Tests, spec text and one silent-safe engine effect. Tuned haptic values (`DEFAULT_HAPTICS`, tech.md table) untouched. No `screens/` or `flow/` change.

- [x] 53. Findings 1-6 of the K1/K2 review, and Requirement 13.1/13.3 from lane bu2
  - [x] 53.1 Finding 1 (MEDIUM): P96 clause (e) in `tests/hapticEngine.reentry.prop.test.ts` and in design.md; mutation-check against the mutant that sets `lastVertexId` only when the pulse fires
  - [x] 53.2 Finding 2 (MEDIUM): P92 gains properties with the finger beside the last piece of a polyline and beside each of the four bar edges; kills the two surviving mutants
  - [x] 53.3 Finding 3 (LOW): one example test for "first point with an id wins", one for "first candidate wins a tie"
  - [x] 53.4 Finding 4 (LOW): decision recorded: a suppressed re-entry emits `tone(null)` and nothing else. Requirement 4.9 and design.md amended first; P96(a) updated; P3-P6 and P96 pass
  - [x] 53.5 Finding 5 (LOW): Requirement 26.2 qualified to what P90 tests. Finding 6: no code action (history), recorded. Finding 7 (BOM) and 8 (A5 note): recorded
  - [x] 53.6 Requirement 13.1 amended (overview, then gesture hint and Back hint, one utterance, no "You start at the centre."); 13.3 reworded to match the code (absolute touch, centre tick inside 24 px); the open question is OD-1 in `docs/reviews/kiro-owner-decisions.md`, not decided here
  - [x] 53.7 Gate (`tsc --noEmit`, `vitest run`); BUILD_LOG entry (tool = Kiro); path-scoped commit
  - _Requirements: 4.9, 13.1, 13.3, 26.2_
## Flaky P106/P108: sample x rounds past the curve's last x (task 54)
> Test-generator bug, no product change. `core/curve.ts` and every tuned value untouched.

- [x] 54. P106 and P108 sample an x that can lie one ulp outside the curve
  - [x] 54.1 Reproduced with a 200000-run hunt: seed -1034279350, shrunk to five points with y = 0 ending at x = 0.35624768281849445 and t = 1. The test's `first + t * (last - first)` gives 0.3562476828184945, one ulp past the last x, so `curveYAtX` correctly answers `null` (Requirement 5.6: no answer outside the x range)
  - [x] 54.2 Spec: design.md P106 and P108 say the sampled x is clamped into [first x, last x]; Requirement 5.6 is unchanged
  - [x] 54.3 Tests: shared `xWithin(pts, t)` helper clamps to the curve's x range, used by P106 and P108; pinned example with the counterexample; both fail with the old formula and pass with the helper
  - [x] 54.4 Gate (`tsc --noEmit`, `vitest run`); BUILD_LOG entry (tool = Kiro)
  - _Requirements: 5.6_

## Corner speech, line names and where-am-I (Requirements 28 to 32; spec written before any code change)
> Spec text only in task 55. Do not edit `screens/`, `flow/`, `core/`, `tech.md` or any tuned value in this task. The code is an Antigravity lane in `Explore.tsx` and `flow/`. Source: `docs/reviews/kiro-review-bu3-bu5.md`, `docs/reports/fable-blind-user-plan.md`.

- [x] 55. Spec for review findings M1, M2, M4 and plan lanes A7, A8
  - [x] 55.1 Requirement 28 (corner speech incl. touch-down, review M1), Requirement 29 (line name only on rest, M2, L3), Requirement 30 (where-am-I dwell behind Directions, M4, L2, L7, L8)
  - [x] 55.2 Requirements 31 (A7 speech pacing) and 32 (A8 page edge cue and TalkBack labels), requirements only; neither was in the spec
  - [x] 55.3 design.md section and properties P109-P113, marked specified and not built
  - [x] 55.4 OD-2 (click cue "Finding sound" default-on while PROPOSED and phone-untested) and OD-3 (Directions default and the README demo steps) in `docs/reviews/kiro-owner-decisions.md`; no default changed; `tech.md` not edited
  - [x] 55.5 Path-scoped commit `kiro: T55 spec ...`; nothing pushed
  - _Requirements: 28.*, 29.*, 30.*, 31.*, 32.*_

- [ ] 56. Properties and Explore-wiring oracle for Requirements 28 to 30 (Kiro writes the properties; an agy lane writes the code)
  - [ ] 56.1 Agy lane: `cornerCompass` on touch-down, `lineDwell` with rest and speech-quiet guards, `whereAmIDwell` behind Directions, one speech-start record, fixed switch label, unused `commands.where*` keys removed or listed (review M1, M2, M4, L3, L7, L8)
  - [ ] 56.2 P109-P113 in `frontend/tests/*.prop.test.ts` (200+ runs), mutation-checked, written against the pure functions the lane exports
  - [ ] 56.3 The real-Explore test of design.md "Tests the lane writes (M3)", with each guard removed in turn to show it fails
  - [ ] 56.4 Requirements 31 and 32 get design sections and tasks when their lanes (A7, A8) are scheduled
  - _Requirements: 28.*, 29.*, 30.*_

## Adopt the tests of outside PR 36 (task 57; tests only)
> PR 36 by drv653 adds corner/edge transition and viewport tests to `frontend/tests/haptic.corner.regression.test.ts`. Tests only: `hapticEngine.ts`, `core/` and every tuned value are untouched. The PR head is read with `git show pr36-head:...`; nothing is merged or checked out.

- [x] 57. Adopt PR 36's tests and fix the review findings
  - [x] 57.1 Merge the PR's added tests into the T50 version of the file (the PR's first 4 describe blocks equal main's)
  - [x] 57.2 Viewport test now runs `step()` through `processPointerMove` with a trace per viewport and asserts the effects (corner [50, 90, 50] once, line vibrate(80) outside the quiet window), not only target kinds
  - [x] 57.3 BC to C to CA steps through the quiet window (t=1200 no buzz, 1549 none, 1550 buzz); vertex re-entry inside the window (Requirement 4.9 / P96) and after it
  - [x] 57.4 Each new test mutation-checked against a temporary mutant of `hapticEngine.ts`, reverted; `git diff` on `frontend/src` clean afterwards
  - [x] 57.5 Gate (`tsc --noEmit`, `vitest run`); path-scoped commit
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.9_

## Sticky line following (Requirement 33; spec written before the code; optional, off by default)
> Core half only. Do not edit `hitTest.ts`, `hapticEngine.ts`, `compass.ts`, `proximity.ts`, `screens/`, `flow/`, `DEFAULT_RADII` or the tuned haptic values. Owner approval: 2026-11-16, the owner delegated K5 to the orchestrator ("for K5 do what you think is best"); decision: a pure opt-in helper, OFF by default, nothing existing changed. The sticky radius (24 px) and hold time (200 ms) are proposed, pending owner approval and a phone test.

- [x] 58. Sticky line helper in `core/sticky.ts`
  - [x] 58.1 Requirement 33, design section, properties P114-P119 and a "PROPOSED" row in `tech.md` written before any code
  - [x] 58.2 `frontend/src/core/sticky.ts`: `STICKY_HOLD_MS`, `STICKY_RADIUS_PX`, `followTarget`; pure, named exports, no `any`
  - [x] 58.3 Properties P114-P119 in `frontend/tests/sticky.prop.test.ts` (fast-check, 250+ runs each); mutation-checked with at least four mutants, reverted
  - [x] 58.4 Gate (`tsc --noEmit`, `vitest run`); BUILD_LOG entry (tool = Kiro) with the approval text; path-scoped commit
  - _Requirements: 33.*_

- [ ] 58b. Sticky line wiring (agy lane, not Kiro; do not start before the owner turns the feature on)
  - [ ] 58b.1 Settings switch "Sticky lines", OFF by default, one fixed label, state in `aria-checked` only; strings in `en`, `hi`, `gu`
  - [ ] 58b.2 `Explore.tsx`: keep the followed target and the time it has been a line target (reset on lift, on any non-line target and on a new touch); pass it to `followTarget` before the engine step; with the switch off, call `hitTest` exactly as today
  - [ ] 58b.3 Real-Explore test: with the switch off the vibrate and tone calls of a fixed trace are identical to today; deleting the switch guard turns it red
  - [ ] 58b.4 Phone test of 24 px and 200 ms on the Nord CE6 and one budget phone; only then may `tech.md` lose the "PROPOSED" mark
  - _Requirements: 33.*_

## Resting on a corner has a heartbeat (Requirement 34; spec written before the code; optional, off by default)
> Core half only. Do not edit `hapticEngine.ts`, `hitTest.ts`, `DEFAULT_HAPTICS`, `DEFAULT_RADII`, `screens/`, `flow/`, `drivers/` or any existing `tech.md` row. Source: `docs/reports/fable-heartbeat-plan.md`. The beat pattern (the tuned corner pattern, reused) and the 900 ms period are proposed, pending owner approval and a phone test.

- [x] 59. Corner heartbeat helper in `core/heartbeat.ts`
  - [x] 59.1 Requirement 34, amended Requirement 4.4, design section, properties P120-P127 and a "PROPOSED" row in `tech.md` written before any code
  - [x] 59.2 `frontend/src/core/heartbeat.ts`: `HeartbeatConfig`, `DEFAULT_HEARTBEAT`, `HeartbeatState`, `initialHeartbeatState`, `HeartbeatInput`, `heartbeatStep`; pure, named exports, no `any`
  - [x] 59.3 Properties P120-P127 in `frontend/tests/heartbeat.prop.test.ts` (fast-check, 200+ runs each, driving the real `step()`), plus the triangle example; mutation-checked with at least five mutants, reverted
  - [x] 59.4 Gate (`tsc --noEmit`, `vitest run`); BUILD_LOG entry (tool = Kiro); path-scoped commit
  - _Requirements: 4.4, 34.*_

- [ ] 59b. Corner heartbeat wiring (agy lane hb2, not Kiro; do not start before the owner has felt the beat on a phone and turned the feature on)
  - [ ] 59b.1 Settings switch "Corner heartbeat", OFF by default, one fixed label, state in `aria-checked` only; strings in `en`, `hi`, `gu`
  - [ ] 59b.2 `flow/explore.ts` and `Explore.tsx`: keep the heartbeat state, pass the engine's effects through `heartbeatStep` only when the switch is on; reset on lift, new touch, pointer promotion and scene change; with the switch off call nothing new
  - [ ] 59b.3 Real-Explore test: with the switch off the vibrate, tone and speak calls of a fixed trace are identical to today; deleting the switch guard turns it red
  - [ ] 59b.4 Phone test of the pattern and period on the Nord CE6 and one budget phone; only then may `tech.md` lose the "PROPOSED" mark
  - _Requirements: 34.*_


## One structural guard at every scene ingress (Requirement 35; spec written before the code)
> Core half only. Do not edit `hitTest.ts`, `hapticEngine.ts`, `screens/`, `flow/`, `api/`, `App.tsx` or any tuned value. Numbered 61 because `kiro: T60` (flaky P117) is already in BUILD_LOG.

- [x] 61. `core/sceneGuard.ts` and its use in `deserialise`
  - [x] 61.1 Requirement 35, design section and properties P128-P131 written before any code
  - [x] 61.2 `frontend/src/core/sceneGuard.ts`: `SCENE_GUARD_LIMITS`, `isRenderableScene`; pure, named exports, no `any`
  - [x] 61.3 `core/savedDiagrams.ts` `deserialise` returns `undefined` when the guard rejects the scene; fix any existing test whose generated scene was not renderable only if the test, not the guard, is wrong
  - [x] 61.4 Properties P128-P131 in `frontend/tests/sceneGuard.prop.test.ts` (300 runs), limits-equal-backend test, mutation-checked; if P130 finds a throw in `core/`, stop, log it in BUILD_LOG and open a separate task
  - [x] 61.5 Gate (`tsc --noEmit`, `vitest run`); BUILD_LOG entry (tool = Kiro); path-scoped commit
  - [ ] 61b. Later lane (not Kiro, not started): call the guard where a network response and a bundled sample are loaded
  - _Requirements: 35.*_


## Remove luck from the frontend property suite (task 62; tests only)
> Test files only. Do not edit `frontend/src/` (so not `core/`), `DEFAULT_HAPTICS`, `DEFAULT_RADII` or any other tuned value. Rule (P117 pattern from task 60): a coverage or statistics check must not depend on the random draw. Coverage comes from deterministic, fixed-input cases that run every time; random cases (`fc.assert`) are for breadth and carry only per-case assertions. A counter over random draws compared with `toBeGreaterThan` is a luck gate. A product failure is reported with its seed, never hidden.

- [x] 62. Deterministic coverage, one run-count knob, and a five-run flake census
  - [x] 62.1 Spec (this entry). Search `frontend/tests/*.prop.test.ts` for counters compared with `toBeGreaterThan`, `fc.pre` filters that reject most cases, and wall-clock budgets; list each in BUILD_LOG with the action taken
  - [x] 62.2 Each luck gate: add deterministic seeded cases that reach the covered state by construction and assert coverage on those; keep the random property for breadth with per-case assertions only
  - [x] 62.3 `frontend/tests/support/runs.ts` exports `runs(n) = n * (Number(process.env.FC_RUNS_MULT) || 1)` (rounded up to an integer, at least 1); used for `numRuns` in the hitTest, geometry, hapticEngine, sticky, heartbeat, curve and compass property files. Default behaviour (no env var) is unchanged
  - [x] 62.4 Run the full suite five times; list every test that failed at least once with its seed in BUILD_LOG, classified as generator bug, test-environment load or product bug. Fix generator bugs; report the other two without touching `core/`
  - [x] 62.5 Gate (`tsc --noEmit`, `vitest run`); BUILD_LOG entry (tool = Kiro); path-scoped commit


## Can a share link be a decompression bomb? (task 63; test and measurement only, fix proposed and not built)
> `decodeShare` checks `raw.length <= LIMITS.maxHashChars` (12000), then LZString decompresses the whole string, and only then is `maxDecompressedChars` (200000) checked. Test only: `frontend/tests/share.decodeBound.test.ts`. No file under `frontend/src/` changed.

- [x] 63. Measure the worst input that fits `maxHashChars`
  - [x] 63.1 Result (repeated "a", "[" and `{"a":`; 1, 5 and 20 MB inputs): 1 MB compresses to 2322 chars (5807 for the `{"a":` pattern), 5 MB to 5803, 20 MB to more than 12000 (not usable). Bisection: 18.12 MB of "a" compresses to exactly 12000 chars and decompresses to 18,999,680 chars in about 10 ms. `decodeShare` threw `too-large` or `bad-format` in under 5 ms for every kept input, so the 250 ms bound holds with a wide margin.
  - [x] 63.2 Finding: the 2 MB expansion bound does NOT hold. A 12000-char link expands to about 19 million chars (about 38 MB of UTF-16, roughly 95 times the 200000 cap) before the cap rejects it. It is rejected correctly and fast, so this is a transient memory spike on the student's phone, not a hang or a crash on the measured machine. A budget phone was not measured.
  - [x] 63.3 The test pins today's ceiling (20 million chars), asserts the finding, and carries an `it.todo` for the 2 MB target. No existing share test was changed.
  - [ ] 63.4 Fix, smallest first (needs an owner decision, no code written):
    - (a) Lower `LIMITS.maxHashChars`. The sqrt-like growth means about 3300 chars is the ceiling for 2 MB. That would also refuse legitimate large scenes (300 points compress to well over 3300 chars), so it is not recommended.
    - (b) Compressed-length heuristic: the compressed form has no cheap distinct-symbol count, so a ratio check before decompressing is not reliable. Not recommended.
    - (c) Recommended: decompress through lz-string's internal `_decompress` with a `getNextValue` wrapper is not possible to cap, so instead vendor a small bounded decoder (stop after `maxDecompressedChars + 1` output chars) in `share/`, and keep LZString for encoding. Needs approval for the new module and a property test that it equals `LZString.decompressFromEncodedURIComponent` whenever the output is within the cap.
  - _Requirements: 16.4 spirit (bounded resource use); share contract SEC-01_



## Chaos property for the pure touch pipeline (Requirement 36; spec written before the test; tests only)
> Test file only. Do not edit `frontend/src/` (so not `core/`), `DEFAULT_HAPTICS`, `DEFAULT_RADII` or any tuned value. A failing seed is pinned as a regression example and reported, never hidden.

- [x] 64. Chaos property P132-P136 in `frontend/tests/touch.chaos.prop.test.ts`
  - [x] 64.1 Requirement 36, design section and properties P132-P136 written before any code
  - [x] 64.2 Harness (pointer model, sticky and heartbeat wrappers), scene and event generators including degenerate inputs
  - [x] 64.3 Properties at 200-300 runs through `runs()`; mutation-check at least three mutants of the harness-visible rules, reverted
  - [x] 64.4 Gate (`tsc --noEmit`, `vitest run`); BUILD_LOG entry (tool = Kiro); path-scoped commit
  - _Requirements: 36.*_

## Explore wiring guard tests (review M3 of `docs/reviews/kiro-review-bu3-bu5.md`; tests only)
> Test file only: `frontend/tests/explore.wiring.guards.test.tsx`. No file under `frontend/src/` changes (mutants are temporary and reverted; `git diff frontend/src` must be empty afterwards). Requirements 28.7-28.9, 29.6, 29.8, 30.2-30.4 and 34.7 are the oracle. An earlier unfinished version had a deliberate probe assertion and type errors; it was moved out of the repo and is rebuilt here without either.

- [x] 65. Mount the real `Explore` with fake drivers and prove each guard
  - [x] 65.1 Spec (this entry): the guards under test are Ask listening and Guide guiding (click, speech, line name, compass, where-am-I, scan tone), Finding sound off (no click), Directions off (no compass, line name or dwell; button still answers), Corner heartbeat off and Graph scan off (output identical to the engine's own)
  - [x] 65.2 `frontend/tests/explore.wiring.guards.test.tsx`: no probe assertions, `tsc` clean, every test has a control showing the cue exists when its guard is open
  - [x] 65.3 Mutation-check each guard in `Explore.tsx` by a temporary edit, reverted; record every mutant and whether the suite killed it here and in BUILD_LOG. Killed: finding sound (switch, Ask), graph scan (switch, Ask), compass (Directions), line name (Directions, Ask), heartbeat switch, where-am-I Directions (both sites together). Survived as equivalent (redundant or unreachable guards): Guide guard in finding-sound, graph-scan and line-name blocks; where-am-I Directions at one site only; where-am-I Ask and Guide flags on the tick path. Finding: finger promotion while Ask listens speaks the corner exits and plays the corner pattern (Requirement 28.7); pinned as `it.fails`, fix is for an agy lane in `Explore.tsx` `handlePointerUp`
  - [x] 65.4 Gate (`tsc --noEmit`, `vitest run --maxWorkers=6`); BUILD_LOG entry (tool = Kiro); path-scoped commit `kiro: T65 Explore wiring guard tests`
  - _Requirements: 28.7-28.9, 29.6, 29.8, 30.2-30.4, 34.7_
