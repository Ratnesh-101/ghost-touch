# Antigravity Lane Report: hi6 — Fix Review Findings for hi3 and hi4

**Lane:** hi6 (EX)  
**Tool:** Antigravity (agy)  
**Date:** 2026-11-21  
**References:** `docs/reviews/kiro-review-hi3-hi4.md`, Requirements 38, 49 & 50  

---

## 1. Overview of Fixes

### Issue 1: Help button uses `isRawScene` instead of `isRaw === true`
- **Problem:** `Explore.tsx` previously evaluated `raw: isRaw === true` when constructing sentences for `helpSentences`. When `App.tsx` opens a Raw Mode scene, it renders `<Explore>` without the `isRaw` prop (it is `undefined`). Thus, `help.raw` was never spoken in the live app for raw scenes.
- **Fix:** In `frontend/src/screens/Explore.tsx`, `handleHelpClick` now passes `raw: isRawScene`, matching the screen's own internal Raw Mode detection (`isRaw ?? (scene.kind === 'unknown' || announced.includes(t('raw.announce')))`).
- **Verification:** Added tests in `frontend/tests/explore.helpFixes.test.tsx` verifying:
  1. A Raw Mode scene (`kind: 'unknown'`) rendered without the `isRaw` prop speaks `help.raw`.
  2. A normal scene (`kind: 'geometry'`) rendered without the `isRaw` prop does not speak `help.raw`.

### Issue 2: Accurate Voice Command Phrases in `help.guide`
- **Problem:** `help.guide` in Hindi and Gujarati previously promised phrases that the voice command parser rejected (`"ले चलो बी"` and `"લઈ જાઓ બી"` placed the verb first, causing `unknown` command parse, and `"चोटी ढूंढो"` sought a label named "चोटी" rather than the peak target).
- **Fix:**
  - Hindi `help.guide` in `frontend/src/i18n/index.ts`:
    `'मार्गदर्शन पाने के लिए बोलें कोने का नाम और फिर पर ले चलो, या बोलें शिखर ढूंढो।'`
    (Promising `<label> पर ले चलो` and `शिखर ढूंढो`).
  - Gujarati `help.guide` in `frontend/src/i18n/index.ts`:
    `'માર્ગદર્શન મેળવવા માટે બોલો ખૂણાનું નામ અને પછી પર લઈ જાઓ, અથવા બોલો શિખર શોધો.'`
    (Promising `<label> પર લઈ જાઓ` and `શિખર શોધો`).
  - English `help.guide` checked and verified: promises `'take me to'` and `'find the peak'`, which are already accepted by `commands.ts` and `semantic.ts`.
- **Verification:** Added tests in `frontend/tests/explore.helpFixes.test.tsx` ensuring `parseExploreCommand(phrase, true)` parses the exact promised phrases in en, hi, and gu to their expected command types (`guide_to` and `guide_semantic`).

### Issue 4: Highlight Cleared on Guide Start and Lift, Suppressed While Guiding
- **Problem:** When a finger was touching an element (vertex, segment, etc.) and Guide was started (e.g. via voice command), `applyHighlight` was bypassed while guiding and the guide lift branch returned early without calling `clearHighlight()`. As a result, the highlight remained frozen on that element for the entire guide session and persisted after lifting.
- **Fix in `frontend/src/screens/Explore.tsx`:**
  1. Centralized guide startup logic into `startGuide(target: ResolvedTarget)`:
     - Resets state, stops haptics/tones.
     - Calls `clearHighlight()`.
     - Starts `guideController.current.start(target)`.
     - Schedules redraw with `scheduleDraw(viewportRef.current, pendingCursor.current)`.
  2. Handled both offer acceptance (`handleStartGuideFromOffer`) and voice command execution (`handleVoiceAsk`) through `startGuide`.
  3. In `handlePointerLift`: when `guideController.current?.isGuiding()`, added `clearHighlight()` in the guide lift branch so finger lifts ensure `clearHighlight()`.
  4. In `applyHighlight`: added guard `if (guideController.current?.isGuiding() || isGuiding) { clearHighlight(); return; }` to prevent applying highlights while guiding is active.
  5. In `handlePointerDown` and `handlePointerMove`: added `clearHighlight()` when guiding is active.
- **Follow-up 2 (Requirement 38 — Hold Services Survive Guide):**
  - An earlier edit to `handlePointerMove` unconditionally returned from the guide branch (`return;`), which prevented the fallthrough on Guide arrival and broke hold keep-alive timer restarting for fingers resting on curves (`tests/explore.holdLifecycle.test.tsx` and `tests/explore.ux.bugs.test.tsx`).
  - Reverted the premature `keepAliveTimer.current?.stop()` before `move()` and restored the original post-move check:
    ```ts
    if (guideController.current.isGuiding()) {
      keepAliveTimer.current?.stop();
      return;
    }
    ```
    This ensures that when `guideController.current.move()` reaches arrival, execution continues into the regular move pipeline, updating the hold keep-alive timer, seeding axis/page-edge states, and executing haptic steps. The highlight ref and `data-highlight` remain properly cleared and suppressed via `clearHighlight()` and `applyHighlight`.

### Issue 5: Back Button Names in `help.back`
- **Problem:** `help.back` in Hindi and Gujarati used transliterated `"बैक"` and `"બેક"`, but the actual UI Back button is named `"वापस"` (`common.back` in hi) and `"પાછા"` (`common.back` in gu).
- **Fix in `frontend/src/i18n/index.ts`:**
  - Hindi: `'बाहर निकलने के लिए दो उंगलियों से नीचे स्वाइप करें, या वापस दबाएं।'`
  - Gujarati: `'બહાર નીકળવા માટે બે આંગળીઓથી નીચે સ્વાઇપ કરો, અથવા પાછા દબાવો.'`
- **Verification:** Tested in `frontend/tests/explore.helpFixes.test.tsx` that `help.back` contains the exact `common.back` string and does not contain `"बैक"` / `"બેક"`.

### Translation Review Tables Updated
- Updated `docs/user-test/translation-review.csv`: rows for `help.back (spoken)` and `help.guide (spoken)`.
- Updated `docs/user-test/translation-review.md`: section 29 table rows for `help.back (spoken)` and `help.guide (spoken)`.

---

## 2. Files Changed

1. `frontend/src/screens/Explore.tsx`:
   - Imported `type ResolvedTarget` from `'../guide'`.
   - Updated `applyHighlight` to clear and bail when guiding is active (`guideController.current?.isGuiding() || isGuiding`).
   - Introduced `startGuide(target)` which clears highlight, starts guide controller, sets state, and redraws.
   - Routed voice command and offer guide starts through `startGuide(target)`.
   - Added `clearHighlight()` in guide branch of `handlePointerDown`, `handlePointerMove`, and `handlePointerLift`.
   - Preserved `if (guideController.current.isGuiding()) { keepAliveTimer.current?.stop(); return; }` in `handlePointerMove` so arrival falls through to hold keep-alive timer updating (Requirement 38).
   - In `draw()`, evaluated `isGuidingNow` via `guideController.current?.isGuiding() || isGuiding` so the guide ring draws without stale React state delay.
   - Updated `handleHelpClick` to pass `raw: isRawScene` instead of `raw: isRaw === true`.
2. `frontend/src/i18n/index.ts`:
   - Updated `help.back` in Hindi to use `"वापस"`.
   - Updated `help.back` in Gujarati to use `"પાછા"`.
   - Updated `help.guide` in Hindi to promise `"<कोना> पर ले चलो"` and `"शिखर ढूंढो"`.
   - Updated `help.guide` in Gujarati to promise `"<કોણ> પર લઈ જાઓ"` and `"શિખર શોધો"`.
3. `docs/user-test/translation-review.csv`:
   - Updated rows 390 and 392 for `help.back (spoken)` and `help.guide (spoken)`.
4. `docs/user-test/translation-review.md`:
   - Updated table rows for `help.back (spoken)` and `help.guide (spoken)` in section 29.
5. `frontend/tests/explore.helpFixes.test.tsx`:
   - Tests covering Issues 1, 2, and 5.
6. `frontend/tests/explore.highlightGuide.test.tsx`:
   - Tests covering Issue 4.

---

## 3. Tests Added & Updated

1. `frontend/tests/explore.helpFixes.test.tsx`:
   - `Issue 1: isRawScene detection without isRaw prop`:
     - Verifies `help.raw` is spoken for raw scene (`kind: 'unknown'`) without `isRaw` prop.
     - Verifies `help.raw` is NOT spoken for normal scene (`kind: 'geometry'`) without `isRaw` prop.
     - Verifies `help.raw` is spoken when announced text contains `raw.announce` even without `isRaw` prop.
   - `Issue 2: help.guide promises phrases accepted by parseExploreCommand`:
     - Verifies English phrases: `"take me to B"` -> `guide_to`, `"find the peak"` -> `guide_semantic` (target `peak`).
     - Verifies Hindi phrases: `"बी पर ले चलो"` -> `guide_to`, `"शिखर ढूंढो"` -> `guide_semantic` (target `peak`).
     - Verifies Gujarati phrases: `"બી પર લઈ જાઓ"` -> `guide_to`, `"શિખર શોધો"` -> `guide_semantic` (target `peak`).
   - `Issue 5: help.back uses actual back button names`:
     - Verifies Hindi `help.back` matches `common.back` (`वापस`) and does not use `बैक`.
     - Verifies Gujarati `help.back` matches `common.back` (`પાછા`) and does not use `બેક`.
     - Verifies spoken output in Hindi and Gujarati when Help button is pressed.

2. `frontend/tests/explore.highlightGuide.test.tsx`:
   - Verifies finger on a line (`segment:AB`), guide starts via voice command ("take me to B"), `data-highlight` becomes `"none"` immediately upon guide start.
   - Verifies lifting finger while guiding maintains `data-highlight="none"`.
   - Verifies touching a vertex before guide start clears highlight to `"none"` on guide start.
   - Verifies touching down and moving while guiding suppresses highlights (`data-highlight="none"`), including on arrival at target corner B.
   - Verifies lift in guide branch clears highlight.

---

## 4. Verification Proof

- `npm --prefix frontend test`: **242 test files passed, 3073 tests passed, 1 todo (0 failed)**.
  - Specifically verified that `tests/explore.holdLifecycle.test.tsx` ("guide arrival then 1 s still gives a line buzz") and `tests/explore.ux.bugs.test.tsx` ("after Guide arrives, a finger still on the curve gets vibrate(80) within 1 s") pass.
  - Verified that all Issue 4 tests in `frontend/tests/explore.highlightGuide.test.tsx` continue to pass.
- `npm --prefix frontend exec -- tsc -p frontend --noEmit`: Clean typecheck (0 errors).
- `npm --prefix frontend run build`: Vite production build passed successfully.
- What could not be verified: Native speaker auditory naturalness review of updated Hindi and Gujarati strings, and hardware haptic feel on a physical Android device.
