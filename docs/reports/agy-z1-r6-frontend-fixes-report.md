# Report: Lane z1-r6-frontend-fixes

Status: DONE
Lane: z1-r6-frontend-fixes
Tool: agy, reviewed by Claude
Date: 2026-11-10

## Pass 2 Follow-Up Note

Per supervisor gating in follow-up pass 2, two changes that contradicted decisions and property
tests already merged on `main` have been cleanly reverted and deferred:
- **Item 4 reverted:** `leaveByBack` in `frontend/src/flow/navigation.ts` restored to `main`
  (`needsConfirm: false` for `correct`). Kiro's property P43 in `round2.navigation.prop.test.ts`
  pins that only Teacher edits ask for confirmation. Listed under **DEFERRED FOR KIRO** below
  (a spec change to P43 is required first).
- **Item 5 reverted:** `MemoryDiagramStore` and `IDBDiagramStore.putWithEviction` in
  `frontend/src/drivers/diagramStore.ts` restored to `main` (delete-victim-then-put in one
  transaction per R5-02). Pinned by `tests/drivers.diagramStore.test.ts`,
  `tests/k6.pwa-offline.test.ts`, and `tests/saved.eviction.prop.test.ts` (P72-P76). Listed under
  **DEFERRED** below (conflicts with R5-02 single-transaction design; audit LOW finding needs a
  design decision).
- **Items 1, 2, 3, and 6 kept and re-verified:** Teach canvas focus transfer, VerifiedBanner
  sanitisation, `saved.ts` replacer function, and Teach reserved ID prevention remain active and
  thoroughly tested in `frontend/tests/z1.frontend.fixes.test.tsx`.

---

## Summary of Active Completed Work

### 1. Teach Focus Transfer on Add Point & Add Edge (MED)
- **Files:** `frontend/src/components/teach/TeachCanvas.tsx`, `frontend/src/screens/Teach.tsx`
- **Fix:** In `TeachCanvas.tsx`, accepted `canvasRef` prop forwarding to the `<canvas>` DOM element.
  In `Teach.tsx`, called `canvasRef.current?.focus()` whenever `planAddPoint` or `planAddSegment`
  succeeds from user action, accompanied by `sayAndStatus(ghostwriterSpeech(outcome))`.
- **Impact:** Screen reader (TalkBack) and keyboard/switch users are not trapped on the toolbar
  buttons after creating a point or edge and can immediately use arrow keys to nudge the selected
  element or interact with the diagram canvas.
- **Tests:** `frontend/tests/z1.frontend.fixes.test.tsx`:
  - `moves focus to canvas when second press of Add point places centre point`
  - `moves focus to canvas and announces when Add edge completes`

### 2. Teacher Note and Name Sanitization in VerifiedBanner (MED)
- **Files:** `frontend/src/components/VerifiedBanner.tsx`
- **Fix:** Replaced obsolete regex with `sanitizeShareTitle(note)` and `sanitizeShareName(by)` from
  `flow/share.ts`. Leading checkmark emojis (including U+2705 `✅`, U+1F5F9 `🗹`), invisible marks,
  and badge words ("verified", "certified", "सत्यापित", "પ્રમાણિત") are stripped before rendering
  and speaking the author name and note. If a note consists solely of badge marks, no note button
  is rendered.
- **Tests:** `frontend/tests/z1.frontend.fixes.test.tsx`:
  - `strips check-mark emoji, invisible marks and badge words from note and name`
  - `does not render note button if note is only checkmark and badge words`

### 3. Replacer Function for Deleted Announcement String Interpolation (MED)
- **Files:** `frontend/src/flow/saved.ts`
- **Fix:** Changed `deletedAnnouncement` string replacement from `.replace('{title}', title)` to
  `.replace('{title}', () => title)`.
- **Impact:** Prevents special replacement patterns (`$1`, `$&`, `$'`, `$\``) in user-controlled
  diagram titles from triggering unintended backreferences or pattern substitution in
  `t('saved.deleted')`.
- **Tests:** `frontend/tests/z1.frontend.fixes.test.tsx`:
  - `preserves $1 pattern without backreference corruption`
  - `preserves $& match pattern verbatim`
  - `preserves $' and $\` patterns verbatim`
  - `joins empty message when remaining is 0`

### 6. Reserved ID Prevention in Teach ID Generator (HIGH, Frontend Half)
- **Files:** `frontend/src/flow/teach.ts`
- **Fix:** Defined `RESERVED_IDS` set and `isReservedId` helper in `flow/teach.ts` disallowing
  prototype properties and system IDs (`title`, `scene:title`, `__proto__`, `constructor`,
  `prototype`, `toString`, `valueOf`, etc.) case-insensitively. Updated `generateUniquePointId` and
  `addVertex` to never generate or accept reserved IDs, falling back to a safe generated ID.
- **Tests:** `frontend/tests/z1.frontend.fixes.test.tsx`:
  - `isReservedId recognizes reserved keywords case-insensitively`
  - `generateUniquePointId never produces a reserved id`
  - `addVertex rejects reserved IDs and generates a safe replacement ID`

---

## DEFERRED FOR KIRO

1. **`leaveByBack` Confirmation for Correct Screen (Brief Item 4 / Audit LOW):**
   - **Reason:** Kiro's property P43 in `frontend/tests/round2.navigation.prop.test.ts` pins that
     only Teacher edits ask for confirmation ("asks before discarding unsaved Teacher edits, and
     only then"), with counterexample `["correct", true, false]`. Setting `needsConfirm: true`
     for `screen === 'correct'` directly violates property P43. A spec change to P43 (and
     corresponding requirement update) is needed first before this behavior can be altered.

---

## DEFERRED

1. **Diagram Store Put/Delete Order (Brief Item 5 / Audit LOW):**
   - **Reason:** Lane p2 deliberately merged R5-02 (evict the victim and write the new entry in
     ONE transaction), and existing test suites pin this contract:
     `tests/drivers.diagramStore.test.ts` (eviction failure leaves earlier entries intact),
     `tests/k6.pwa-offline.test.ts` (`putWithEviction deletes victim before put (R5-02, R5-09)` and
     `returns ok:false when put fails`), and Kiro's `tests/saved.eviction.prop.test.ts` (P72–P76).
     Reversing order conflicts with the single-transaction design; this audit LOW finding requires
     a formal architectural design decision from the lead.
2. **`App.tsx` Call-Site for `leaveByBack('correct')`:**
   - In `App.tsx`, pass the active dirty flag of `Correct` once the spec change for P43 lands.
3. **`App.tsx` Exit Button Double Speech & Hash Synchronization:**
   - `App.tsx:655-671`: Clear `teachDirty.current = false` and synchronize
     `lastProcessedHash.current` in `handleTeachBack` to avoid duplicate confirmation modals on
     synthetic hash change events.
4. **`App.tsx` Cold Shared Link User-Activation Gate Bypass:**
   - `App.tsx:266-273`: Prevent populating `lastExploreScene.current` on cold links until the
     `ShareGate` tap action has completed.
5. **`App.tsx` `honest: true` Default in Route Resolution:**
   - `App.tsx:126`: Default `options?.honest ?? true` in `resolveShareRoute` fallback to eliminate
     legacy "verified" announcements when no explicit honest option is passed.
6. **Core Reserved IDs Export and `renameLabel` Check (Kiro Task T39):**
   - Export shared `RESERVED_IDS` from `frontend/src/core/` (or `frontend/src/share/validate.ts`).
   - In `frontend/src/core/correct.ts:75-77`, check point/segment/polyline/bar IDs before falling
     back to `scene.title` so an element ID named `title` cannot overwrite diagram title.
