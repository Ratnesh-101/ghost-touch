# Lane A2 Handoff Report: Overview on Entry

**Author:** Antigravity (agy, builder)  
**Lane:** A2 — Overview on entry  
**Planner / Reviewer:** Claude Code  
**Date:** 2026-11-15  

---

## 1. Summary of Work

Implemented the diagram overview feature for Ghost Touch:
1. **Pure Overview Generator (`frontend/src/flow/overview.ts`)**:
   - `buildOverview(scene: DiagramScene, titleOverride?: string): string`
   - Pure function (no React, no browser APIs).
   - Generates concise diagram summaries under 40 words through i18n keys across `en`, `hi`, and `gu`.
   - Never outputs raw numeric coordinates.
   - Per scene kind:
     - **`geometry`**: Title; count of corners and sides ("N corners, M sides"); up to 6 labelled corners with coarse position from `getCoarsePosition` (e.g., "A top left, B bottom right, C bottom left").
     - **`function_graph`**: Title; count of curves; coarse position of axes (e.g., "x-axis at centre, y-axis at left").
     - **`bar_chart`**: Title; count of bars and sorted left-to-right bar labels up to 8 items ("N bars, left to right: Q1, Q2, Q3, Q4").
     - **`unknown` / Raw Mode**: Returns empty string `""` so Raw Mode announcement prefix and fallback remain unaltered.
2. **Explore Entry Announcement & StatusText Alignment**:
   - Updated `exploreAnnouncement` in `frontend/src/flow/navigation.ts` to precede the gesture hint with `buildOverview(scene)`.
   - Joined as a single spoken utterance via `joinAnnouncements` (speech driver cancels previous speech on each speak).
   - Updated `handleSavedOpen` in `frontend/src/App.tsx` to include `buildOverview(scene)` when opening saved diagrams offline.
   - StatusText receives the exact same combined utterance, remaining aria-hidden when speech synthesis is active (satisfies Requirements 13.7 and 13.8: no duplicate reading).
3. **`explore.gestureHint` Text Revision**:
   - Removed "You start at the centre." and its translations in `en`, `hi`, and `gu`:
     - **`en`**: `"Double-tap and hold, then drag to feel the diagram."`
     - **`hi`**: `"डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें।"`
     - **`gu`**: `"ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો."`
   - Updated existing test assertions in `frontend/tests/flow.explore.test.ts` and `frontend/tests/screens.render.test.ts`.
4. **'describe' Voice Command Integration**:
   - Updated `case 'describe':` in `frontend/src/flow/commands.ts` to speak `buildOverview(scene)` followed by the diagram facts via `joinAnnouncements([overview, factsText])`.
5. **New Unit & Integration Tests (`frontend/tests/overview.test.ts`)**:
   - Tests on the three sample diagrams: `triangle.json`, `sine.json`, `barchart.json` in `en`, `hi`, and `gu`.
   - Verifies all new i18n keys exist and are non-blank in all 3 languages.
   - Asserts word counts stay <= 40 words even for dense scenes with 60 points / 60 bars.
   - Verifies raw coordinates are never read as numbers.
   - Verifies 'describe' command and Explore entry announcements.

---

## 2. Follow-Up Pass 1: Gate Failure Resolutions & Shared-Link Architecture

### 1. `tsc` Clean Compilation in `frontend/tests/overview.test.ts`
- **Issue:** `overview.test.ts` imported `node:fs` and `node:path` and referenced `__dirname`. Because the frontend `tsconfig.json` targets the browser and Vitest environment without Node typings, `tsc` reported `TS2591` and `TS2304`.
- **Fix:** Removed all Node API imports and `__dirname`. Loaded bundled samples using static typed JSON imports (`import triangleJson from '../public/samples/triangle.json'`, `sineJson`, `barchartJson`) alongside Vite's `import.meta.glob<DiagramScene>('../public/samples/*.json', { eager: true, import: 'default' })`.
- **Bar sample note:** In `frontend/public/samples/`, the bundled file is `barchart.json` (as declared in `SAMPLE_IDS` in `frontend/src/api/scene.ts`). Bar sample resolution was defined as `(sampleModules['../public/samples/bars.json'] ?? sampleModules['../public/samples/barchart.json'] ?? barchartJson) as unknown as DiagramScene` to seamlessly support both names without causing `TS2307` missing module errors.

### 2. Vitest Assertions in `frontend/tests/k1.verifyWiring.test.ts`
- **Issue:** 5 tests failed because they made exact-string assertions expecting the old entry format (which included `"You start at the centre."` and did not include `buildOverview(scene)`).
- **Fix:** Updated the 5 test assertions in `frontend/tests/k1.verifyWiring.test.ts`:
  1. `does NOT append caveat for honest sample triangle`: Asserts `exploreAnnouncement` equals `joinAnnouncements([buildOverview(honestTriangleScene), hint])` and does not contain `"Facts and drawing disagree"`.
  2. `appends caveat for forged triangle fact ("AC = 7 cm")`: Asserts `exploreAnnouncement` equals `joinAnnouncements([buildOverview(forgedTriangleScene), hint, caveat])` and contains the caveat.
  3. `stays silent and adds NOTHING extra when facts state "not to scale"`: Asserts `exploreAnnouncement` equals `joinAnnouncements([buildOverview(notToScaleScene), hint])` without caveat.
  4. `honest shared scene has NO caveat in route resolution or speech`: Asserts `resolution.sceneAnnouncement` equals `joinAnnouncements([expectedOverview, hint])` and `resolution.spokenAnnouncement` joins honesty badge line, spoken in 1 single utterance.
  5. `forged shared scene ("AC = 7 cm") gets the caveat joined with verified line in ONE utterance`: Asserts `resolution.sceneAnnouncement` equals `joinAnnouncements([expectedOverview, hint, caveat])` and `resolution.spokenAnnouncement` joins honesty badge line, spoken in 1 single utterance.
- **Invariant preservation:** The assertions have NOT been weakened: removing caveat logic causes tests 2 and 5 to fail, falsely adding caveat causes tests 1, 3, and 4 to fail, omitting the overview causes all 5 to fail, and speaking multiple utterances causes tests 4 and 5 to fail.

### 3. Architecture Decision: Shared-Link Entry Path (`resolveShareRoute` / `speakShareAnnouncements`)
- **Decision:** The diagram overview belongs in the shared-link entry path.
- **Rationale:**
  1. **User Experience Parity:** A student opening a shared diagram from a teacher needs the exact same overview of corners/sides/curves/bars to orient themselves before feeling the canvas (Requirement 13.1).
  2. **Honesty Enforcement (R1/R3):** `resolveShareRoute` in `frontend/src/App.tsx` calls `exploreAnnouncement(decoded.scene, 'shared', 'shared', { honestTitle: true })`. This sanitizes the title and passes the prefixed title (`"Title: Right Triangle ABC"`) into `buildOverview(scene, name)`, which incorporates it cleanly into the overview.
  3. **One Utterance Guarantee:** `buildHonestShareAnnouncement` joins the overview, gesture hint, optional caveat, author banner, and honesty disclaimer into a single spoken utterance, eliminating speech driver cancellation.

---

## 3. Files Touched

| File | Status | Description |
|---|---|---|
| `frontend/src/flow/overview.ts` | **New** | Pure overview generator `buildOverview` for geometry, function graphs, and bar charts |
| `frontend/src/flow/navigation.ts` | Modified | Updated `exploreAnnouncement` to join overview before gesture hint |
| `frontend/src/flow/commands.ts` | Modified | Updated `describe` command to speak `buildOverview(scene)` and facts |
| `frontend/src/App.tsx` | Modified | Updated `handleSavedOpen` to include overview on offline entry |
| `frontend/src/i18n/index.ts` | Modified | Updated `explore.gestureHint` in en/hi/gu; added 17 new overview keys across en/hi/gu |
| `frontend/tests/flow.explore.test.ts` | Modified | Updated test assertions to match revised `explore.gestureHint` |
| `frontend/tests/screens.render.test.ts` | Modified | Updated test assertions to match revised `explore.gestureHint` |
| `frontend/tests/overview.test.ts` | Modified | Pure browser/Vite sample loading (no Node APIs); comprehensive tests for `buildOverview` |
| `frontend/tests/k1.verifyWiring.test.ts` | Modified | Updated 5 explore announcement & shared-link tests to verify overview + caveat invariants |
| `docs/reports/agy-bu2-report.md` | Modified | Lane A2 report, gate failure resolutions, and spec amendment register for Kiro |

---

## 4. Spec Lines Kiro Must Amend (Do Not Edit Directly)

Per `AGENTS.md` Rule 1, Antigravity does not modify `.kiro/**`. The orchestrator / Kiro must amend the following spec lines in `.kiro/specs/ghost-touch/requirements.md`:

### 1. Requirement 13.1 (lines 142–143)
- **Current text:**
  > 1. WHEN the Explore screen opens THEN the system SHALL speak the explore gesture: "Double-tap and hold, then drag to feel the diagram. You start at the centre.", and SHALL move focus to the explore canvas.
- **Required amendment:**
  > 1. WHEN the Explore screen opens THEN the system SHALL speak the diagram overview (`buildOverview(scene)`) followed by the explore gesture: "Double-tap and hold, then drag to feel the diagram.", as a single spoken utterance, and SHALL move focus to the explore canvas. For Raw Mode scenes, the overview is omitted and the Raw Mode announcement prefix (Requirement 8.1) is spoken instead.

### 2. Requirement 13.3 (lines 145–146)
- **Current text:**
  > 3. WHEN a new hold starts THEN the system SHALL start the cursor at the centre of the diagram and SHALL play a single centre reference tick (a short pulse distinct from the line and corner patterns).
- **Required amendment:**
  > 3. WHEN a new hold starts THEN the system SHALL start the cursor at the centre of the diagram and SHALL play a single centre reference tick (a short pulse distinct from the line and corner patterns). The initial entry prompt SHALL NOT include the spoken sentence "You start at the centre.", keeping the spoken gesture prompt concise.
