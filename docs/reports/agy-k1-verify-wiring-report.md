# Lane k1-verify-wiring Report

**Tool**: agy (reviewed by Claude)  
**Lane**: k1-verify-wiring (frontend wiring)  
**Status**: DONE  
**Date**: 2026-11-09  

---

## 1. Executive Summary

Wired **SPEC GHOST** (`frontend/src/verify/verify.ts`) into the application:
- Consistency check between printed facts and drawn geometry, **NOT** forgery protection.
- **NEVER** says "verified" and **NEVER** advises "trust the text".
- On entering Explore with a scene (AI, raw, sample, and shared-link scenes), runs `verifyScene(scene, {mode})` once.
- If status is `'disagree'`, appends **ONE** extra sentence to the entry announcement joined into the same utterance via `joinAnnouncements`: wording from `VERIFY_WORDING` localised in `en`, `hi`, `gu` with the `{name}` placeholder kept ("Facts and drawing disagree on {name}. I can't tell which is right." and Hindi/Gujarati equivalents, marked for native review).
- If `'consistent'` or `'silent'`, says **NOTHING extra** (no "all good" claim).
- Visible status line text for the same finding in the Explore status area through the existing `announced` prop path (no new UI controls).
- Ask flow: when the user's question names a segment or side that appears in a `'disagree'` finding (match by segment id or reversed ids), prepends the caveat sentence to the spoken answer in ONE utterance. Questions about other sides or undisputed scenes are completely unchanged. Added unit-tested pure helper `caveatForQuestion(findings, question)` in `flow/ask.ts`.
- Settings: no new setting. The check is on for every scene, silent when unsure.
- All constraints from `AGENTS.md` and `docs/briefs/agy-k1-verify-wiring.md` have been strictly met: zero edits to Kiro-owned files (`frontend/src/core/**` untouched), zero edits to forbidden screen files (`Explore.tsx`, `Correct.tsx`, `Capture.tsx` untouched).

---

## 2. Done List

1. **Explore Entry Announcement & Status Line**:
   - `frontend/src/flow/navigation.ts`:
     - Added `verifyCaveatForScene(scene: DiagramScene, mode: VerifyMode = 'ai'): string | null`.
     - Updated `exploreAnnouncement(scene, mode, verifyMode)` to run `verifyScene` once per entry, appending the localized caveat to the entry announcement via `joinAnnouncements` when `status === 'disagree'`.
   - `frontend/src/App.tsx`:
     - Wired `handleScene` with appropriate verify mode (`'sample'` for sample diagrams, `'raw'` for raw mode, `'ai'` for camera/upload diagrams).
     - Wired `resolveShareRoute` with mode `'shared'`; joins scene announcement, caveat, and verified banner line into ONE single spoken utterance via `joinShareAnnouncements`.
     - Wired `handleSavedOpen` to evaluate `verifyCaveatForScene` and join caveat into the entry announcement.
     - Flowed the resulting announcement string directly through the existing `announced` prop on `<Explore announced={...} />`, updating the visible status area (`.gt-explore__status`) without new UI controls.

2. **Ask Caveat Integration**:
   - `frontend/src/flow/ask.ts`:
     - Implemented and exported pure helper `caveatForQuestion(findings, question)`: matches by target, name, or segment ID (case-insensitive, whole-word boundaries, reversed 2-character segment IDs supported); returns localized caveat or `null`.
     - Added `findings?: readonly VerifyFinding[]` to `AskDeps`.
     - In `startVoiceAsk` and `submitTextAsk`: checks `findings` against `question`, and prepends the caveat to `baseAnswer` via `joinAnnouncements([caveat, baseAnswer])` before calling `deps.say`. This guarantees both spoken audio and the visible status text receive the caveat in a single utterance.

3. **Core Verification Types Extension**:
   - `frontend/src/verify/verify.ts`:
     - Extended `VerifyFinding` with `target?: string; name?: string;`.
     - Populated `target` and `name` in `verifyScene` for segment length ratios, bar height ratios, and angles.

4. **Localization (i18n)**:
   - `frontend/src/i18n/index.ts`:
     - Added `'verify.disagree'` to `en`, `hi`, and `gu` tables with `{name}` placeholder.
     - Verified no key contains "verified", "trust the text", or Indic equivalents.
   - `docs/user-test/translation-review.md`:
     - Appended Section 23 with reviewer instructions, English, Hindi, and Gujarati strings, and native review notes.
   - `docs/user-test/translation-review.csv`:
     - Appended CSV row for `verify.disagree (spoken)`.

5. **Test Suite**:
   - `frontend/tests/k1.verifyWiring.test.ts`:
     - 6 test suites with 18 comprehensive tests covering:
       - SPEC GHOST constraints & i18n keys across `en`, `hi`, `gu`.
       - Explore announcement caveat inclusion on forged `triangle.json` ("AC = 7 cm") and absence on honest `triangle.json`.
       - Single joined utterance verification (no back-to-back `speak()` calls).
       - Shared link caveat inclusion and single-utterance speech with teacher verification banner.
       - Pure `caveatForQuestion` helper tests: segment matching, reversed ID matching, case-insensitivity, non-matching sides, substring boundary safety, angle and bar targets, Hindi/Gujarati localization.
       - `AskManager.submitTextAsk` & `startVoiceAsk` integration: caveat prepending for disputed segment, unchanged answers for undisputed/honest queries.
       - Visible status line propagation via `announced` prop path.

---

## 3. Files Touched

- `frontend/src/i18n/index.ts`
- `frontend/src/verify/verify.ts`
- `frontend/src/flow/navigation.ts`
- `frontend/src/flow/ask.ts`
- `frontend/src/App.tsx`
- `docs/user-test/translation-review.md`
- `docs/user-test/translation-review.csv`
- `frontend/tests/k1.verifyWiring.test.ts` (new)
- `docs/reports/agy-k1-verify-wiring-report.md`
- `docs/BUILD_LOG.md`

---

## 4. New i18n Keys

- `verify.disagree`:
  - **English (`en`)**: `"Facts and drawing disagree on {name}. I can't tell which is right."`
  - **Hindi (`hi`)**: `'तथ्य और चित्र {name} पर असहमत हैं। मैं नहीं बता सकता कि कौन सा सही है।'`
  - **Gujarati (`gu`)**: `'તથ્યો અને આકૃતિ {name} પર અસંમત છે. હું કહી શકતો નથી કે કયું સાચું છે.'`

---

## 5. Follow-Up 3: Shared-Link Test Hash Encoding Fix

- **Issue**:
  - In `frontend/tests/k1.verifyWiring.test.ts`, section 3 ('Shared-Link Scenes (resolveShareRoute & speakShareAnnouncements)'), two unit tests ('honest shared scene has NO caveat' and 'forged shared scene ("AC = 7 cm")') previously failed with `expected 'ignored' to be 'explore'`.
  - Cause: The test mock constructed the share hash with an incorrect prefix `#/share/${encodeShare(payload)}` instead of the application standard `#s=${encodeShare(payload)}` (`SHARE_HASH_PREFIX = '#s='` from `drivers/hashRoute.ts`). Because `parseShareHash` rejects routes lacking `#s=`, `resolveShareRoute` returned `{ kind: 'ignored' }`.
- **Resolution**:
  - Corrected hash construction in `frontend/tests/k1.verifyWiring.test.ts` to `${SHARE_HASH_PREFIX}${encodeShare(payload)}` using the real `encodeShare` encoder (`share/codec.ts`) and `SHARE_HASH_PREFIX` (`drivers/hashRoute.ts`).
  - Evaluated `validateShareScene`: verified that `honestTriangleScene` (matching `frontend/public/samples/triangle.json`) and `forgedTriangleScene` (with fact `'AC = 7 cm'`) both cleanly pass client-side scene validation and invariant checks.
  - Verified assertions:
    - Honest shared scene resolves to `kind: 'explore'` with no caveat in `sceneAnnouncement` or `spokenAnnouncement`, and dispatches exactly one spoken utterance with the teacher verification line.
    - Forged shared scene resolves to `kind: 'explore'` with caveat `"Facts and drawing disagree on AC. I can't tell which is right."` joined with the teacher verification line in ONE single utterance, dispatched via exactly one `speech.speak` call.
- **App Code**:
  - No app code bugs found; `resolveShareRoute`, `parseShareHash`, `decodeShare`, and `exploreAnnouncement` function as intended. Zero app code changes needed.

---

## 6. Needs from Planner

1. **Native Reviewer Validation**:
   - Have a native Hindi and Gujarati speaker review the newly added `verify.disagree` strings in `docs/user-test/translation-review.md` / `.csv`.
2. **Prompts Alignment (Backend)**:
   - As noted in feature tournament findings, ensure `backend/app/prompts.py` encourages fact outputs in `"XY = n unit"` and `"label: n"` format to sustain high parse rates.
