# Kiro prompts (paste into Kiro chat, one at a time)

Written by Claude Code, 2026-11-04. Open the folder that contains `.kiro/` (this repo root) in Kiro first. Kiro should do these **spec-first**: extend `requirements.md`, `design.md` and `tasks.md`, then implement, then write the property tests. Claude Code does not implement these tasks; it reviews them afterwards.

Why Kiro and not agy: these are the spec-driven, property-tested pieces that carry the Kiroween entry. agy lanes G (accessibility and mascot, `agy/a11y`) and H (README and `svara` driver fix, `agy/readme`) run in parallel and avoid these files, so conflicts should be small.

Current state: `main` has 1049 frontend and 348 backend tests passing on 2026-11-06. New voice, language and storage code exists in `frontend/src/drivers/storage.ts`, `frontend/src/i18n/index.ts` (en, hi, gu tables; a test requires every key in all three languages).

---

## Prompt 1: Task 13, Saved diagrams and offline exploring (Requirement 11)

```
Read #product, #tech, #structure and #review. Then work spec-first on Task 13 (Requirement 11: saved diagrams).

1. Update requirements.md (acceptance criteria for: save on every successful scene load with a thumbnail and a spoken title; list saved diagrams by voice and by touch; open one while offline with no network call; delete one; a cap of 20 saved diagrams, oldest evicted first, never evicting one the user pinned), design.md (components, data model, error handling for storage-full and storage-unavailable) and tasks.md (sub-tasks 13.2 onward).
2. Keep the pure-core rule. Put ONLY pure logic in frontend/src/core/savedDiagrams.ts: serialise/deserialise a SavedDiagram {id, createdAt, title, thumbnailDataUrl, scene, pinned}, spoken-title generation from the scene (name, else kind plus the first labelled points, in the active language key), ordering, eviction choice, id generation from an injected clock/rng. No window, indexedDB or navigator in core.
3. Put IndexedDB in frontend/src/drivers/diagramStore.ts behind an interface (list, get, put, delete) with an in-memory fake for tests. Wrap every call in try/catch; if storage is unavailable the app must keep working and say so by voice.
4. Screen: a Saved list reachable from Capture ("Saved diagrams" button, 48x48 px, accessible name, spoken state changes). Every string through t() with en, hi and gu entries (the i18n parity test must pass).
5. Property tests (fast-check, in frontend/tests/savedDiagrams.prop.test.ts), add them to the P-list in design.md as P14 and P15: P14 serialise then deserialise returns an identical DiagramScene for any valid scene; P15 eviction never exceeds the cap, never removes a pinned entry, and always removes the oldest unpinned one.
6. Do not change the tuned haptic values. Do not touch the haptic engine. Run tsc, npm test and npm run build, tick tasks.md only for what is really done, and add a BUILD_LOG.md entry with tool = Kiro, including any real bug a property caught.
```

## Prompt 2: Task 11, Teacher Correct mode (Requirement 9)

```
Read #product, #tech, #structure and #review. Then work spec-first on Task 11 (Requirement 9: teacher correction).

1. Update requirements.md, design.md and tasks.md: Correct mode is for a SIGHTED teacher (so a visual overlay is fine, but every control still needs an accessible name and a 48x48 px target): show the detected scene on top of the original photo, drag points, edit labels, delete a point or segment, undo/redo, save. The original photo must be kept in memory (and in the saved diagram from Task 13 if present) so the overlay can be drawn.
2. Pure core: frontend/src/core/correct.ts with immutable edit functions on DiagramScene: movePoint (clamps to [0,1]), renameLabel (trims, rejects empty), deletePoint (also removes every segment and polyline reference to it), deleteSegment, plus an undo/redo history reducer. No browser APIs.
3. Saving: validate against the schema before use. The backend already has validate.py (do not weaken it); add a small POST /api/v1/validate endpoint if needed that runs the existing validator, or reuse the generated TypeScript types plus a client-side check, whichever the design justifies. A scene that fails validation must be refused with a spoken and visible reason, never silently saved.
4. Screen: frontend/src/screens/Correct.tsx, reached from Explore through a clearly labelled "Correct" button that is NOT part of the blind exploration gestures (do not change the Explore gesture handling or the haptic engine). All strings through t() with en, hi and gu entries.
5. Property tests (frontend/tests/correct.prop.test.ts), add as P16 and P17 in design.md: P16 any sequence of edit operations on a valid scene yields a scene that either passes the validator invariants (unique ids, no dangling segment references, all coordinates in [0,1]) or is explicitly rejected; P17 undo after any edit restores the previous scene exactly (and redo re-applies it).
6. Do not change the tuned haptic values. Run tsc, npm test and npm run build; tick tasks.md only for what is done; add a BUILD_LOG.md entry with tool = Kiro, including any real bug a property caught.
```

## Prompt 3: Housekeeping that only Kiro should do (short)

```
Read #review. (1) Tick the parent tasks in tasks.md that are truly complete (7, and any sub-tasks of 12 and 14 that the agy lanes finished; check the code, don't assume). (2) The P1 generator now enforces a minimum screen separation and passed 25 of 25 isolated runs: confirm, and add the outcome to docs/kiro-evidence/pbt-p1-flake.md. (3) Remove the "retry once" workaround in .github/workflows/ci.yml frontend test step once you agree P1 is stable. (4) Check the three hooks in .kiro/hooks appear in the hooks panel and fire; save a screenshot or log excerpt to docs/kiro-evidence/. Log it in BUILD_LOG.md with tool = Kiro.
```

---

## Prompt 4: Requirement for the Lab theme, spec-first, retroactive and honest (Requirement 14, Task 17, P18–P20)

```
Read #product, #tech, #structure and #review. Then work spec-first on the Frankenstein's Laboratory theme (Requirement 14).

Context: While your credits were paused, Antigravity built the Frankenstein Lab UI redesign across several lanes without a prior spec in .kiro/. To keep our Kiroween entry honest, spec-first, and fully compliant, you must now define the formal specification retroactively in .kiro/, explicitly mark the existing implementation as "implemented by Antigravity, verified by Kiro" rather than claiming it, and write the new correctness property tests (P18, P19, P20) which you will own.

1. Update requirements.md: Add Requirement 14 "Frankenstein's Laboratory theme and sensory aesthetics" with strict EARS acceptance criteria:
   - 14.1 Contrast: all body and title text SHALL meet WCAG AAA contrast of at least 7:1 against dark surfaces (--gt-text #eafff5 > 18:1, --gt-text-primary #f5fff8 > 18:1, --gt-bone #ded6c4 > 13:1, --gt-text-muted #a8c5b5 > 10:1), and UI boundaries/borders SHALL meet at least 4.5:1.
   - 14.2 Touch targets: every interactive control SHALL provide an accessible name and a minimum touch target of 48x48 CSS px (--gt-target: 48px).
   - 14.3 Typography: Atkinson Hyperlegible (400 and 700 weights) SHALL be self-hosted as woff2 files in frontend/src/assets/fonts/ with font-display: swap and precached by the service worker; Indian language fallbacks ('Nirmala UI', 'Noto Sans Devanagari', 'Noto Sans Gujarati') SHALL be maintained.
   - 14.4 Reduced motion: WHEN prefers-reduced-motion: reduce is active THEN the system SHALL disable all glowing animations, pulse transitions, and electric arcs, providing static non-animated visuals.
   - 14.5 Photosensitive safety & animation limits: WHEN a diagram scene finishes loading THEN the system SHALL show the "IT'S ALIVE" spark sequence for at most 1.2 s, flashing at most 3 times per second (WCAG 2.3.1 compliance, ~2.1 Hz), accompanied by the existing success earcon.
   - 14.6 Tactile canvas purity: WHILE exploring a diagram on the Explore canvas THEN the drawing area SHALL remain pure high-contrast glowing green lines on near-black background (#0b0e0c) with NO decorative textures, blueprint grids, stitches, or rivets inside the canvas that could interfere with touch exploration.
   - 14.7 Full internationalization: every user-facing string SHALL flow through t() with complete parity across en, hi, and gu in frontend/src/i18n/index.ts.
   - 14.8 Accessible brand assets: brand assets (logo-mark.svg, logo-full.svg, Mascot.tsx) SHALL respect the neck-bolt exclusion zone rule, enforce file size limits (<6 KB for brand icons, <10 KB for og-image), and mark all purely decorative graphics with aria-hidden="true".

2. Update design.md:
   - Add section "Frankenstein's Laboratory Visual System" detailing the design token architecture in frontend/src/styles/tokens.css, the decorative primitives in frontend/src/components/lab/ (Seam, Rivets, LabCard, Spark), the LabSettings modal bottom sheet, and the specimen table frame around Explore.
   - Add correctness properties P18, P19, and P20 to the Property table:
     - P18: Alive animation bound and flash frequency: for any keyframe or animation in frontend/src/styles/explore.css and Spark.tsx, declared duration is <= 1.2 s and pulse frequency is <= 3 flashes per second.
     - P19: CSS @import ordering and stylesheet integrity: in all stylesheets under frontend/src/styles/, every @import statement must precede all other CSS style rules, and every referenced stylesheet must exist on disk (prevents dropping Explore frame styles).
     - P20: Design token color conformance: every color declaration in component and screen stylesheets (excluding canvas 2D contexts and brand SVGs) must consume CSS custom properties (var(--gt-*)) or allowed token fallbacks, prohibiting unmanaged bare hex literals.

3. Update tasks.md:
   - Add Task 17 "Frankenstein's Laboratory theme, retroactive spec verification, and CSS correctness properties (Requirement 14, P18–P20)".
   - State clearly in Task 17 description: "UI components and stylesheets implemented by Antigravity, verified and property-tested by Kiro".
   - Add subtasks 17.1 (retroactive spec & design documentation), 17.2 (P18 property test), 17.3 (P19 property test), 17.4 (P20 property test), 17.5 (verification pass).

4. Write Property Tests (fast-check in frontend/tests/labTheme.prop.test.ts, owned by Kiro):
   - P18 test: parse explore.css and Spark component styling, asserting animation durations <= 1.2s and pulse count <= 3 flashes/s.
   - P19 test: inspect all files in frontend/src/styles/, asserting that every @import rule occurs before any style declaration and resolves to an existing file.
   - P20 test: parse screen stylesheets and verify all color properties use var(--gt-*) tokens or documented fallbacks.

5. Do not change the tuned haptic values. Do not touch the haptic engine. Run npm --prefix frontend exec -- tsc -p frontend --noEmit, npm --prefix frontend test, and npm --prefix frontend run build. Tick tasks.md only for what is really done, and add a BUILD_LOG.md entry with tool = Kiro, including any real bug or style regression a property test caught. Commit nothing unless asked.
```

## Prompt 5: Kiro reviews the agent-built redesign against the steering docs

```
Read #product, #tech, #structure and #review. Then conduct an independent, read-only architectural and safety review of the Lab redesign against the steering documents.

Context: While your credits were paused, Antigravity built the Frankenstein Lab UI redesign across several lanes. You are the authoritative reviewer and spec owner. You must audit the diffs (commits since f60b0f7) to verify that the core contracts and accessibility guarantees remain unbroken.

1. Review scope and safety checks against .kiro/steering/:
   - Check 1: Tuned haptic vocabulary in tech.md: Verify that line buzz (80 ms / 70 ms retrigger), corner vertex pulse ([50, 90, 50]), quiet window (450 ms), hit radii (22 px vertex, 14 px line), and pitch range (200–1000 Hz) are 100% untouched and have not been modified or redefined anywhere.
   - Check 2: TalkBack relative-cursor behavior (Requirement 13): Verify that Method A1 relative touch navigation, centre reference tick (25 ms), two-finger swipe down exit, Back button, and Android system Back gesture handling in frontend/src/drivers/navigation.ts remain fully operational.
   - Check 3: Pure-core rule (tech.md Rule 1): Verify that frontend/src/core/ contains only pure logic (geometry, hitTest, hapticEngine, pitch, scene, savedDiagrams, correct) with zero DOM, window, navigator, or browser API access, and that all browser APIs remain strictly quarantined in frontend/src/drivers/.
   - Check 4: Accessibility contracts (Requirement 12): Verify that all controls maintain minimum 48x48 CSS px touch targets, text tokens meet WCAG AAA (>= 7:1) contrast, decorative lab primitives (Seam, Rivets, Spark) carry aria-hidden="true", Atkinson Hyperlegible font is self-hosted with Indian script fallbacks, and prefers-reduced-motion disables all animations.

2. Document findings:
   - Output your findings to docs/kiro-evidence/review-lab-redesign.md following the review protocol in .kiro/steering/review.md (Verdict: SHIP or FIX FIRST, findings table with Severity, File:line, Problem, Fix, and DoD checks).
   - Update docs/kiro-evidence/ notes to record that the Lab redesign was independently audited by Kiro.
   - If you identify any core defects, list them under "Needs from Kiro" in your report.

3. Strict review constraint:
   - This is a read-only review. Do not make code edits or weaken existing tests without an approved spec change.

4. Standing instructions:
   - Do not change the tuned haptic values. Run npm --prefix frontend exec -- tsc -p frontend --noEmit, npm --prefix frontend test, npm --prefix frontend run build, and backend/.venv/Scripts/python -m pytest backend. Tick tasks.md only for what is really done, and add a BUILD_LOG.md entry with tool = Kiro. Commit nothing unless asked.
```

## Prompt 6: New hooks for style guards, accessibility, and build log audit

```
Read #product, #tech, #structure and #review. Then create three new Kiro hooks in .kiro/hooks/ in the exact JSON format of the existing hooks.

Context: Kiro hooks automate quality guards during development. We need three new hooks to safeguard CSS integrity, ensure screen accessibility standards, and enforce honest per-tool build logging.

1. Inspect existing hooks:
   Review .kiro/hooks/review-builder-handoff.json, .kiro/hooks/prop-tests-on-save.json, and .kiro/hooks/review-on-stop.json to mirror their structure (version "v1", trigger, action, description, matcher, enabled).

2. Create the three hooks in .kiro/hooks/:
   - Hook 1: .kiro/hooks/css-guard-on-save.json
     - Trigger: PostFileSave
     - Description: "Run CSS import ordering, token conformance, and alive animation property tests when styles change"
     - Matcher: "frontend[\\\\/]src[\\\\/]styles[\\\\/].*\\.css$"
     - Action: command executing Vitest on the CSS property and import test suites:
       npx vitest run tests/labTheme.prop.test.ts tests/css.imports.test.ts --reporter=dot
   - Hook 2: .kiro/hooks/a11y-on-save.json
     - Trigger: PostFileSave
     - Description: "Run accessibility contrast, touch target, and motion test suites when screens or components change"
     - Matcher: "frontend[\\\\/]src[\\\\/](screens|components)[\\\\/].*\\.(tsx|ts)$"
     - Action: command executing Vitest on accessibility suites:
       npx vitest run tests/a11y.contrast.test.ts tests/a11y.targets.test.ts tests/a11y.motion.test.ts tests/screens.render.test.ts --reporter=dot
   - Hook 3: .kiro/hooks/pre-commit-build-log.json
     - Trigger: PreCommit
     - Description: "Remind agent to record honest tool attribution in docs/BUILD_LOG.md before committing"
     - Action: agent hook prompting:
       "A commit is being prepared. Check docs/BUILD_LOG.md to ensure the latest changes are attributed honestly to the tool that built them (Kiro, Antigravity, or Claude Code). Verify that what was built, what broke, and all files touched are listed, and that agent work is never claimed as Kiro's."

3. Validate hook syntax and integration:
   - Ensure all three files are valid JSON with valid regex matchers.
   - Verify that the hooks appear in Kiro's hooks panel and fire when matching files are saved.
   - Record confirmation and a log excerpt or screenshot note in docs/kiro-evidence/hooks-installed.md.

4. Standing instructions:
   - Do not change the tuned haptic values. Run npm --prefix frontend exec -- tsc -p frontend --noEmit and npm --prefix frontend test. Tick tasks.md only for what is really done, and add a BUILD_LOG.md entry with tool = Kiro. Commit nothing unless asked.
```

## Prompt 7: Fix audit findings spec-first (TalkBack speech collision and secondary pointer dead-zone)

```
Read #product, #tech, #structure and #review. Then resolve the high-severity frontend audit findings spec-first.

Context: Independent audit docs/reports/audit-bugs.md identified two critical interaction flaws that impact blind students on Android Chrome: Finding 5 (simultaneous Web Speech synthesis and TalkBack focused canvas announcement producing double-speech cacophony) and Finding 14 (secondary pointer dead-zone when the primary finger lifts during multi-touch exploration). We address these spec-first.

1. Update requirements.md and tasks.md:
   - Extend Requirement 13 (Acceptance Criterion 13.7):
     "WHEN entering the Explore screen and the prompt is spoken via speech synthesis, the explore canvas SHALL NOT expose an identical verbose accessible label that triggers concurrent screen reader speech. StatusText SHALL serve as the polite screen reader fallback only when speech synthesis is unsupported."
   - Extend Requirement 4 (Acceptance Criterion 4.8):
     "WHEN multiple fingers touch the Explore canvas and the primary finger lifts while another finger remains in contact, the system SHALL immediately promote the oldest remaining active pointer to primary, update cursor tracking, and continue delivering haptic and tone effects without entering a dead-zone."
   - Check docs/reports/audit-backend.md (if it exists): If present, turn its highest-severity open findings into requirements and tasks. If absent, note that backend audit items are clear.
   - Add matching tasks in tasks.md under a dedicated audit resolution subtask (e.g. Task 14.x or Task 18).

2. Implement safe fixes:
   - Fix Finding 5 in frontend/src/screens/Explore.tsx: In the canvas props, conditionally suppress the redundant canvas aria-label when speech synthesis is active and has announced the prompt, avoiding double speech collisions while preserving StatusText for visual and fallback readers.
   - Fix Finding 14 in frontend/src/screens/Explore.tsx: In handlePointerLift and handleLostPointerCapture, when e.pointerId === primaryPointerId.current and activePointers.current.size > 0, promote the oldest surviving pointer in activePointers.current to primaryPointerId.current, recalculate coordinates, and resume haptic stepping seamlessly.
   - Add unit tests in frontend/tests/flow.explore.test.ts verifying pointer promotion and announcement coordination.

3. Isolate phone-dependent findings for manual testing:
   - Do NOT attempt to guess fixes for Finding 6 (AudioContext suspension during native camera app switch) or Finding 12 (vibration reporting on devices where navigator.vibrate returns false) without device validation.
   - Record these findings in docs/kiro-evidence/phone-test-checklist.md as explicit verification steps for the owner's Android hardware test.

4. Standing instructions:
   - Do not change the tuned haptic values. Run npm --prefix frontend exec -- tsc -p frontend --noEmit, npm --prefix frontend test, npm --prefix frontend run build, and backend/.venv/Scripts/python -m pytest backend. Tick tasks.md only for what is done; add a BUILD_LOG.md entry with tool = Kiro. Commit nothing unless asked.
```

---

## Order and value (credit-budgeted ranking for the owner)

Kiro credits are limited. The table below ranks all prompts by their return on investment (Kiroween judging credit earned per Kiro credit spent):

| Rank | Prompt | Category | Kiro Credit Cost | Kiroween Value & Rationale |
|---|---|---|---|---|
| **1** | **Prompt 4** (Lab theme spec-first + P18–P20) | Spec & Property Tests | Medium | **Highest ROI.** Closes the biggest vulnerability in the project: the entire Lab redesign was built by Antigravity with no `.kiro/` spec. Retroactively adding Requirement 14 in EARS format, design section, tasks in `tasks.md`, and 3 new fast-check property tests (P18–P20) owned by Kiro directly satisfies Kiroween's core criteria (spec-driven, property-tested development). |
| **2** | **Prompt 6** (New hooks) | Tooling & Automation | Very Low | **Maximum visibility per credit.** Hooks are Kiro's signature feature. Adding 3 functional JSON hooks (CSS guards, screen a11y, and build log tool attribution) provides concrete evidence of deep Kiro integration with minimal credit consumption. |
| **3** | **Prompt 5** (Review Lab redesign against steering) | Architectural Review | Low | **High judging credibility.** Generates formal review evidence in `docs/kiro-evidence/`, proving Kiro acts as the spec authority and reviewer over agent output. Read-only, so no credits wasted on test iteration. |
| **4** | **Prompt 3** (Housekeeping: P1 flake, CI cleanup, task ticks) | Spec Hygiene | Very Low | **Quick wins.** Validates P1 generator fix, cleans up CI workaround, and synchronizes `tasks.md` checkboxes. Fast and risk-free. |
| **5** | **Prompt 7** (Fix audit findings spec-first) | Bug Fixes & Correctness | Medium | **High UX impact.** Solves two real accessibility flaws (Finding 5 TalkBack double-announcement and Finding 14 secondary pointer dead-zone) spec-first with regression tests. |
| **6** | **Prompts 1 & 2** (Saved diagrams & Teacher Correct) | Core Features | High (if rewritten) | **Lowest incremental ROI now.** Both features were completed by Antigravity during the pause (with P14–P17 passing). Kiro should verify and own the property tests rather than reimplementing from scratch. |

**Recommended execution strategy:**
If credits are very tight, run **Prompt 4**, **Prompt 6**, and **Prompt 5** first. That combination provides the strongest evidence for the Kiroween submission (spec-first EARS criteria, 3 new property tests, 3 new hooks, and a formal architectural review) with minimal token spend.

---

## When Kiro finishes
Tell Claude Code "review Kiro T17" (or T14, T13, T11). It will read the diff against the spec and these prompts, run the full suites, check the haptic values and the ownership rules, and write `docs/reviews/`.
