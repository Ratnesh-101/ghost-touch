# Audit Report: Lane r5-saved-api (Saved Diagrams & Scene API)

**Status: DONE**  
**Auditor:** Antigravity (agy)  
**Date:** 2026-11-09  
**Scope:** `frontend/src/App.tsx` (saveDiagram, saveDiagramWithEviction, speech vs status text),
`frontend/src/api/scene.ts` (504 no-retry, 502 cold-start retry, aborts),
`frontend/src/core/savedDiagrams.ts`, `frontend/src/drivers/diagramStore.ts`,
`frontend/src/flow/saved.ts`, teacher-correct persistence (M4-03) in `frontend/src/flow/correct.ts`
and `frontend/src/screens/Correct.tsx`, tests `n2.round4.test.ts` and `k6.pwa-offline.test.ts`.

---

## 1. Executive Summary

This read-only audit examined the saved diagram storage subsystem, eviction atomicity,
concurrency interactions between diagram capture and teacher corrections, speech vs status text
contract compliance, retry loop bounds in the scene API client, and related unit/integration tests.

Key findings:
1. **Silent storage error drop (`R5-01`, HIGH):** Storage errors are appended to `view.announced`
   in `App.tsx`, but `Explore.tsx` stores status message in state initialized once on mount and
   never syncs prop changes. Storage errors never appear in status text.
2. **Eviction order breaks under quota (`R5-02`, HIGH):** `IDBDiagramStore.putWithEviction` puts the
   new entry before deleting the victim, failing with `QuotaExceededError` when storage is at quota.
3. **SaveDiagram race condition (`R5-03`, HIGH):** Rapid navigation from capture to teacher
   correct creates concurrent uncoordinated `saveDiagram` calls that duplicate diagrams and evict
   innocent entries.
4. **Teacher edits lost on back/cancel (`R5-04`, MED):** Back navigation and cancel handlers in
   `App.tsx` discard unsaved edits without dirty checks, confirmation, or speech announcements.
5. **Fragile matching by JSON.stringify (`R5-05`, MED):** Comparing scene JSON strings to find
   existing entries fails when backend validation normalizes keys, converting updates into new saves.
6. **Cap exceeded on non-atomic delete failure (`R5-06`, MED):** When `store.delete` fails in
   fallback eviction, `saveDiagramWithEviction` returns success, violating the 20-diagram cap.
7. **Mock-under-test assertions in tests:** `n2.round4.test.ts` asserts on inline dummy calls
   rather than application code and tests the exact opposite of the GT-06 requirement.

---

## 2. CONFIRMED Findings

#### R5-01 · HIGH · frontend/src/App.tsx:422-426, 468-472; frontend/src/screens/Explore.tsx:245, 1278
- **Problem:** Storage errors are appended to `view.announced` in `App.tsx`, but `Explore.tsx`
  never updates its status text from prop changes, and errors are dropped if not on `explore`.
- **Code quotes:**
  `App.tsx:422-426`:
  ```typescript
  setView((prev) =>
    prev.screen === 'explore'
      ? { ...prev, announced: `${prev.announced} ${err}` }
      : prev,
  );
  ```
  `Explore.tsx:245`:
  ```typescript
  const [statusMessage, setStatusMessage] = useState(announced);
  ```
  `Explore.tsx:1278`:
  ```tsx
  <StatusText className="gt-explore__status" spoken={drivers.speech.canSpeak}>
    {statusMessage}
  </StatusText>
  ```
- **Concrete failure scenario:** The device runs out of IndexedDB quota or storage is blocked in
  private browsing mode. A student captures a diagram. The diagram fails to save in `diagramStore`.
  Because GT-06 mandates storage errors must never be spoken, TTS remains silent. `App.tsx` updates
  `view.announced`, but `Explore.tsx` never re-syncs `statusMessage` from `announced` after mount.
  The `<StatusText>` element continues displaying the initial diagram announcement. The user
  receives neither spoken nor visual notification that their diagram failed to save. If the user
  navigated to `correct` or back to `capture` before save finished, the error is dropped entirely.
- **Minimal fix:**
  1. In `frontend/src/screens/Explore.tsx`, add an effect to sync `statusMessage` when `announced`
     prop updates:
     ```typescript
     useEffect(() => {
       setStatusMessage(announced);
     }, [announced]);
     ```
  2. In `App.tsx:saveDiagram`, persist storage error status to a dedicated state or status banner
     independent of the active screen.

---

#### R5-02 · HIGH · frontend/src/drivers/diagramStore.ts:245-248
- **Problem:** `IDBDiagramStore.putWithEviction` puts the new entry before deleting the evicted
  entry, causing atomic saves to fail with `QuotaExceededError` when storage is at quota.
- **Code quotes:**
  `diagramStore.ts:245-248`:
  ```typescript
  await idbPromise(store.put(entry));
  if (evictedId !== undefined) {
    await idbPromise(store.delete(evictedId));
  }
  ```
- **Concrete failure scenario:** The browser or device has reached its quota limit (e.g. 20 saved
  diagrams with high-resolution canvas thumbnails). The user captures an unpinned 21st diagram.
  `applyAdd` correctly chooses `victim-1` to evict. `putWithEviction` opens a `readwrite`
  transaction. Line 245 calls `store.put(entry)`. Because quota is already exhausted, IndexedDB
  immediately throws `QuotaExceededError`. The catch block aborts the entire transaction.
  `store.delete(evictedId)` is never reached. Even though evicting `victim-1` would have freed the
  necessary space, the save fails unnecessarily.
- **Minimal fix:** In `IDBDiagramStore.putWithEviction`, delete the victim first within the same
  atomic `readwrite` transaction before putting the new entry:
  ```typescript
  if (evictedId !== undefined) {
    await idbPromise(store.delete(evictedId));
  }
  await idbPromise(store.put(entry));
  ```
  If `put` fails, the transaction aborts and rolls back automatically, preserving the victim.

---

#### R5-03 · HIGH · frontend/src/App.tsx:505, 548
- **Problem:** Uncoordinated async concurrency race between `saveDiagram(scene)` in `handleScene`
  and `saveDiagram(scene, previousScene)` in `handleSaveCorrect`.
- **Code quotes:**
  `App.tsx:505`:
  ```typescript
  if (source !== 'sample') {
    void saveDiagram(scene);
  }
  ```
  `App.tsx:548`:
  ```typescript
  void saveDiagram(scene, previousScene);
  ```
- **Concrete failure scenario:** A user captures a diagram. `handleScene` triggers `void saveDiagram(scene)`.
  Generating thumbnail and opening IndexedDB takes 150 ms. The user immediately taps "Correct",
  adjusts a point, and taps "Save" within 100 ms. `handleSaveCorrect` calls `void saveDiagram(scene,
  previousScene)`. When the second call executes `store.list()`, the first save has not finished
  writing to IndexedDB. `existing.find(...)` fails to find `previousScene`. The second save treats
  the corrected scene as a brand new diagram with a new ID. Both saves finish, leaving two duplicate
  entries in IndexedDB. If the store had 20 diagrams, both calls select an unpinned victim based on
  stale lists, evicting two diagrams instead of updating in place. If Call 1 finishes after Call 2,
  the uncorrected diagram becomes the latest entry in storage.
- **Minimal fix:** In `App.tsx`, introduce a promise queue or an active diagram ID tracker
  (`currentSavedId = useRef<string | null>(null)`) so `saveDiagram` chains sequentially and passes
  the known entry ID instead of relying on asynchronous scene lookups.

---

#### R5-04 · MED · frontend/src/App.tsx:397-403, 551-556; frontend/src/screens/Correct.tsx:546
- **Problem:** Corrections are lost without warning or confirmation on back or cancel navigation,
  and the transition back to Explore is completely silent (violating AGENTS.md rule 7).
- **Code quotes:**
  `App.tsx:397-403`:
  ```typescript
  if (view.screen === 'correct') {
    const scene = view.scene;
    return onCorrectBack(() => {
      const announced = exploreAnnouncement(scene, 'ai');
      setView({ screen: 'explore', scene, announced });
    });
  }
  ```
  `App.tsx:551-556`:
  ```typescript
  const handleCancelCorrect = (): void => {
    if (view.screen !== 'correct') return;
    leaveCorrectEntry();
    const announced = exploreAnnouncement(view.scene, 'ai');
    setView({ screen: 'explore', scene, announced });
  };
  ```
- **Concrete failure scenario:** A teacher opens Teacher Correct mode, repositions 5 points and
  renames labels. While working, the teacher accidentally brushes the Android back gesture or clicks
  Cancel. `onCorrectBack` or `handleCancelCorrect` executes immediately. Neither handler checks
  `canUndo(history)` or asks `window.confirm(t('teach.confirmLeave'))` (as `Teach.tsx` does). All
  edits are instantly destroyed. Furthermore, neither handler calls `drivers.speech.speak(announced)`,
  so the return to Explore occurs in dead silence.
- **Minimal fix:**
  1. Pass an `isDirty: () => boolean` callback from `Correct.tsx` to `App.tsx`.
  2. In `onCorrectBack` and `handleCancelCorrect`, if dirty, confirm before leaving.
  3. Speak the Explore announcement on exit:
     ```typescript
     drivers.speech.speak(announced, LANG_BCP47[currentLang]);
     ```

---

#### R5-05 · MED · frontend/src/App.tsx:431-436, 453
- **Problem:** Matching existing diagrams by `JSON.stringify(e.scene) === JSON.stringify(previousScene)`
  is brittle to object key ordering and backend schema normalization, losing pinned status and
  triggering false `all_pinned` errors.
- **Code quotes:**
  `App.tsx:431-436`:
  ```typescript
  const matchingEntry = previousScene
    ? existing.find(
        (e) =>
          e.scene === previousScene ||
          JSON.stringify(e.scene) === JSON.stringify(previousScene),
      )
    : undefined;
  ```
  `App.tsx:453`:
  ```typescript
  pinned: false,
  ```
- **Concrete failure scenario:** A teacher loads a saved, pinned diagram. The teacher corrects it
  and taps Save. `executeCorrectSave` sends the scene to `POST /api/v1/validate`. The backend
  re-serializes the scene with Python Pydantic, which changes JSON key ordering (e.g. putting
  `version` or `aspect` first) or includes default fields. In `saveDiagram`, `JSON.stringify(e.scene)`
  does not match `JSON.stringify(previousScene)`. `matchingEntry` is `undefined`. Line 453 assigns
  `pinned: false` and a new ID. Because the store is at cap with 20 pinned diagrams, `applyAdd`
  returns `all_pinned`. The teacher's corrections are refused with "All pinned diagrams" error,
  and the existing pinned diagram cannot be updated.
- **Minimal fix:** Track diagram ID directly (`lastSavedDiagramId.current = entry.id`) when opening
  or saving diagrams, and match by `e.id === targetId` rather than JSON string comparison.

---

#### R5-06 · MED · frontend/src/flow/saved.ts:111-116
- **Problem:** In non-atomic eviction fallback, if deleting the victim fails after a successful put,
  `saveDiagramWithEviction` returns `{ ok: true, evictedId: undefined }`, violating the capacity cap.
- **Code quotes:**
  `saved.ts:111-116`:
  ```typescript
  if (decision.evictedId !== undefined) {
    const deleteResult = await store.delete(decision.evictedId);
    if (!deleteResult.ok) {
      return { ok: true, evictedId: undefined };
    }
  }
  ```
- **Concrete failure scenario:** A non-atomic `DiagramStore` implementation executes line 106
  `store.put(newEntry)` successfully. The store now has 21 diagrams. Line 112 calls
  `store.delete(decision.evictedId)`. The delete fails (e.g. database locked or disk I/O error).
  Line 114 returns `{ ok: true, evictedId: undefined }`. The caller treats the save as completely
  successful. The store is permanently left at 21 entries, violating `SAVED_DIAGRAMS_CAP = 20`.
- **Minimal fix:** Roll back by deleting `newEntry.id` if victim deletion fails, or return `{ ok:
  false, error: deleteResult.error }` so caller is aware eviction failed.

---

#### R5-07 · LOW · frontend/src/screens/Correct.tsx:498; frontend/src/App.tsx:546
- **Problem:** Speech collision: `Correct.tsx` speaks `t(result.messageKey)` ("Corrections saved.")
  and immediately calls `onSave()`, which calls `speak(announced)` in `App.tsx`, instantly canceling
  the save announcement.
- **Code quotes:**
  `Correct.tsx:498-500`:
  ```typescript
  sayAndStatus(t(result.messageKey));
  drivers.audio.playEarcon?.('success');
  onSave(result.scene);
  ```
  `App.tsx:546`:
  ```typescript
  drivers.speech.speak(announced, LANG_BCP47[currentLang]);
  ```
  `speech.ts:250`:
  ```typescript
  synth.cancel();
  ```
- **Concrete failure scenario:** A teacher saves corrections. `Correct.tsx:498` speaks "Corrections
  saved." Synchronously, line 500 calls `onSave(result.scene)`. `handleSaveCorrect` in `App.tsx:546`
  calls `drivers.speech.speak(announced)`. In `WebSpeechDriver.speak`, `synth.cancel()` immediately
  aborts the previous utterance. The phrase "Corrections saved." is cancelled before audio output
  begins. The teacher only hears the generic Explore announcement.
- **Minimal fix:** Concatenate the saved notice with the explore announcement into a single spoken
  utterance:
  ```typescript
  const fullAnnouncement = `${t('correct.saved')} ${exploreAnnouncement(scene, 'ai')}`;
  drivers.speech.speak(fullAnnouncement, LANG_BCP47[currentLang]);
  ```

---

#### R5-08 · LOW · frontend/src/screens/Correct.tsx:490-495
- **Problem:** `handleSave` has no synchronous ref guard (`isSavingRef`), allowing rapid double-taps
  to initiate duplicate validate requests and double-save calls before React re-renders.
- **Code quotes:**
  `Correct.tsx:490-494`:
  ```typescript
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    sayAndStatus(t('correct.validating'));

    const result = await executeCorrectSave(history.present);
  ```
- **Concrete failure scenario:** On an Android phone with TalkBack or touch bounce, a teacher
  double-taps the Save button. Because `setIsSaving(true)` schedules a re-render asynchronously,
  the second tap executes `handleSave` before the button disabled attribute takes effect. Two
  concurrent `executeCorrectSave` calls and two `onSave` calls are dispatched.
- **Minimal fix:** Add a ref-based guard at the top of `handleSave`:
  ```typescript
  const isSavingRef = useRef(false);
  if (isSavingRef.current) return;
  isSavingRef.current = true;
  ```

---

#### R5-09 · LOW · frontend/src/drivers/diagramStore.ts:116-121
- **Problem:** `waitTx` checks `typeof txObj.addEventListener === 'function'` but clobbers property
  callbacks (`oncomplete`, `onerror`, `onabort`) instead of registering event listeners.
- **Code quotes:**
  `diagramStore.ts:116-121`:
  ```typescript
  if (txObj && typeof txObj.addEventListener === 'function') {
    return new Promise<void>((resolve, reject) => {
      txObj.oncomplete = () => resolve();
      txObj.onerror = () => reject(txObj.error ?? new Error('Transaction error'));
      txObj.onabort = () => reject(txObj.error ?? new Error('Transaction aborted'));
    });
  }
  ```
- **Concrete failure scenario:** If `txObj` has existing property handlers or an environment
  implements event target semantics without forwarding property assignments, `waitTx` overwrites
  them or resolves prematurely without waiting for transaction completion.
- **Minimal fix:** Use `txObj.addEventListener('complete', () => resolve())`,
  `txObj.addEventListener('error', () => reject())`, and `txObj.addEventListener('abort', () => reject())`.

---

## 3. Tests Asserting Nothing Meaningful

1. **`frontend/tests/n2.round4.test.ts:142-160` (`speaks exactly ONE utterance when storage is unavailable or put fails`)**:
   - **What is wrong:** The test does not exercise `App.tsx` or `saveDiagram`. Instead, it manually
     executes `if (!listResult.ok) { drivers.speech.speak(t('saved.errorStorageUnavailable'), 'en-IN'); }`
     inside the test function itself and asserts that `speak` was called. Furthermore, `App.tsx:421`
     explicitly obeys GT-06 by NEVER speaking storage errors (`storage errors must appear as status
     text and never be spoken`). The test asserts the exact opposite of the real application contract
     by mocking and invoking its own code.

2. **`frontend/tests/n2.round4.test.ts:175-277` (`updates existing saved entry in place with corrected scene` and `creates new entry through atomic path`)**:
   - **What is wrong:** Rather than testing `handleSaveCorrect` in `App.tsx`, these tests copy and
     paste the internal matching logic (`const matchingEntry = existing.find(...)`) directly into
     the test bodies. They test the test author's inline code rather than the application's actual
     component state transitions.

3. **`frontend/tests/k6.pwa-offline.test.ts:374-416` (`IDBDiagramStore supports atomic putWithEviction`)**:
   - **What is wrong:** The test constructs a dummy `IDBFactory` where both `put` and `delete`
     always fire `onsuccess`. It does not test transaction failure, transaction aborts, or rollback
     when `put` or `delete` fails.

---

## 4. Sound Areas (Checked and Verified)

- **HTTP 504 no-retry contract (`frontend/src/api/scene.ts:77, 219`):** HTTP 504 Gateway Timeout
  is excluded from `isGatewayStatus` and throws `SceneRequestError('timeout')` immediately on first
  attempt without retry.
- **HTTP 502 cold-start retry bound (`frontend/src/api/scene.ts:77, 180-216`):** Reverse proxy
  cold-starts (HTTP 502) announce `capture.wakingUp` and retry at most once; subsequent 502 throws
  `gateway` without looping.
- **HTTP 429/503 busy handling (`frontend/src/api/scene.ts:73, 180-216`):** Clamped to 1..10 s
  retry interval and retries at most once before throwing `busy`.
- **AbortSignal handling (`frontend/src/api/scene.ts:153-163, 191`):** Abort controller cancels
  in-flight fetch and sleep timers immediately, rejecting with `SceneRequestError('aborted')`.
- **Pinned entry immunity (`frontend/src/core/savedDiagrams.ts:104`):** `chooseEviction` strictly
  filters `!e.pinned` and never selects pinned diagrams for automatic eviction.
- **Offline teacher corrections (`frontend/src/screens/Correct.tsx:74-104`):** When offline or
  when backend `/validate` fails, `executeCorrectSave` falls back to `validateSceneInvariants` without
  blocking.
- **Saved diagrams offline launch (`frontend/src/App.tsx:572-582`):** Diagrams opened from the
  saved diagrams list go straight to Explore with zero network requests and no re-save.
