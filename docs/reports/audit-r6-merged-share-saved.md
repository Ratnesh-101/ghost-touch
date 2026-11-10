# Audit Report: Lane r6-merged-share-saved (Merged Lanes p2, p3, q1, g1)

Status: DONE
Lane: r6-merged-share-saved
Auditor: Antigravity (agy)
Date: 2026-11-10
Scope: Merged result of lanes p2, p3, q1, and g1 on main:
- `frontend/src/flow/saved.ts` (saveDiagramWithEviction)
- `frontend/src/drivers/diagramStore.ts`
- `frontend/src/flow/share.ts` (sanitiseShareName/Title, resolveShareRoute)
- `frontend/src/flow/navigation.ts`
- `frontend/src/components/ShareGate.tsx`
- `frontend/src/components/VerifiedBanner.tsx`
- `frontend/src/screens/ShareError.tsx`
- `frontend/src/screens/Correct.tsx` (leave-confirm)
- `frontend/src/screens/Teach.tsx`
- `frontend/src/flow/ghostwriter.ts`
- `frontend/src/i18n/index.ts` (`share.*`, `correct.*`, `ghostwriter.*` / `teach.*` in en/hi/gu)

---

## 1. Sound Invariants (One-Line Verifications)

- **Sanitization prefix loop (`flow/share.ts:56-129`):** `stripLeadingBadge` prefix scanner loop
  is deterministic, strips zero-width/bidi invisibles, emojis (`✅`, `🗹`), and badge words in
  en/hi/gu while leaving non-badge words starting with connector letters intact.
- **Cold shared link activation gate (`components/ShareGate.tsx:24-66`):** Gating strictly prevents
  unprompted speech and audio playback on cold links (GT-05), focuses a >=48x48px button, and
  wraps text in `<bdi>`.
- **Share error speech collision guard (`screens/ShareError.tsx:41-71`):** Adopts `StatusText`
  pattern and conditionally drops `role="alert"` when speech synthesis is active, eliminating
  TalkBack collision.
- **Ghostwriter pure flow engine (`flow/ghostwriter.ts:1-418`):** Pure TypeScript logic without
  DOM/React dependencies; caps are strictly bounded by `Math.min(LIMITS.max*, ...)`; all 17
  `GHOSTWRITER_KEYS` exist across en/hi/gu with matching placeholders.
- **Teach toolbar accessibility (`screens/Teach.tsx:642-692`):** Add point and Add edge controls
  satisfy >=48x48px touch targets, have accessible names, and avoid duplicate `onFocus` speech.
- **Correct screen interaction (`screens/Correct.tsx:1-712`):** Pointer drag, letterbox viewport
  conversion, undo/redo history, and validation via `executeCorrectSave` operate soundly.
- **Saved diagrams display ordering (`flow/saved.ts:39, 45`):** `orderForDisplay` preserves
  newest-first ordering, and announcements use `joinAnnouncements` preventing speech cutoff.

---

## 2. Findings (Highest Severity First)

- **HIGH · frontend/src/App.tsx:655-671; screens/Teach.tsx:280-291; App.tsx:367-408**
  - **Problem:** Double speech and duplicate confirmation modal when clicking in-app Exit button
    in Teacher Editor. When leaving `#/teach` via the in-app Back button, `handleTeachBack` in
    `App.tsx` calls `clearHash()`, speaks `exploreAnnouncement`, and sets view to `explore`. But
    `clearHash()` (`drivers/hashRoute.ts:70`) dispatches a synthetic `hashchange` event. The hash
    change listener in `App.tsx` wakes up with `lastProcessedHash.current === '#/teach'`, evaluates
    `leaving = 'teach'`, and because `teachDirty.current` was true, speaks `t('teach.confirmLeave')`
    and opens `window.confirm` a SECOND time. If not dirty, it speaks `exploreAnnouncement` twice.
  - **Code quotes:**
    `App.tsx:655-661`:
    ```typescript
    const handleTeachBack = (): void => {
      clearHash();
      if (lastExploreScene.current) {
        const scene = lastExploreScene.current;
        const baseAnnounced = exploreAnnouncement(scene, 'ai');
        drivers.speech.speak(baseAnnounced, LANG_BCP47[currentLang]);
        setView({ screen: 'explore', scene, announced: makeExploreAnnounced(baseAnnounced) });
    ```
    `App.tsx:383-389`:
    ```typescript
    const step = leaveByBack(leaving, { dirty: teachDirty.current, fromShare, hasScene });
    if (step.needsConfirm) {
      drivers.speech.speak(t('teach.confirmLeave'), LANG_BCP47[currentLang]);
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(t('teach.confirmLeave')) : true;
    ```
  - **Concrete failure scenario:** A teacher edits a diagram in `#/teach` and clicks the in-app
    "Back" button. `Teach.tsx` asks "You have unsaved changes. Are you sure you want to leave?".
    The teacher confirms. `handleTeachBack` begins speaking Explore entry, but `clearHash()`
    immediately fires the `hashchange` listener in `App.tsx`, which prompts the exact same
    confirmation dialog and speech a second time.
  - **Minimal fix:** In `handleTeachBack`, update `lastProcessedHash.current = ''` before calling
    `clearHash()`, and clear `teachDirty.current = false` so the hash listener does not re-process
    the exit transition.

- **HIGH · frontend/src/core/correct.ts:75-77, 191-194, 251-256; flow/teach.ts:102-105**
  - **Problem:** Element IDs can collide with reserved keywords (`title`, `scene:title`,
    `__proto__`). `renameLabel` intercepts `elementId === 'title' || elementId === 'scene:title'`
    to rename `scene.title`. However, `freeRequestedId`, `addSegment`, and `addVertex` do not check
    reserved IDs (unlike `frontend/src/share/validate.ts:48-60` which enforces `RESERVED_IDS`).
  - **Code quotes:**
    `core/correct.ts:75-77`:
    ```typescript
    // Check scene title
    if (elementId === 'title' || elementId === 'scene:title') {
      return { ...scene, title: trimmed };
    }
    ```
    `core/correct.ts:253-255`:
    ```typescript
    const base = `${a}${b}`;
    segmentId = base;
    for (let n = 2; used.has(segmentId); n++) segmentId = `${base}${n}`;
    ```
  - **Concrete failure scenario:** A scene contains points with IDs `'tit'` and `'le'`. Adding a
    segment between them creates a segment with ID `'title'`. Later, when the user renames this
    segment, `renameLabel(scene, 'title', 'Hypotenuse')` matches `elementId === 'title'` and
    silently overwrites `scene.title` instead of the segment's label. Similarly, a point or segment
    with ID `'__proto__'` can cause prototype pollution in plain object dictionaries.
  - **Minimal fix:** In `core/correct.ts` and `flow/teach.ts`, disallow or prefix reserved IDs
    (`title`, `scene:title`, `__proto__`, `constructor`) using `RESERVED_IDS` from
    `share/validate.ts`. In `renameLabel`, check point/segment/polyline/bar IDs before falling
    back to `scene.title`.

- **HIGH · frontend/src/App.tsx:266-273, 342-351, 381-403; flow/navigation.ts:154-157**
  - **Problem:** A shared link diagram can bypass the user-activation `ShareGate` and reach Explore
    without the tap gate. When a shared link is opened cold, `App.tsx` populates
    `lastExploreScene.current = resolution.scene` and shows `ShareGate`. Audio is locked. If the
    user navigates to `#/teach` (or opens settings) and then clicks Back, `leaveByBack('teach', ...)`
    sees `hasScene: true` and returns `next: 'explore'`. `App.tsx` transitions directly to Explore
    with `lastExploreScene.current`.
  - **Code quotes:**
    `App.tsx:267-272`:
    ```typescript
    const resolution = resolveShareRoute(currentHash, isShareEnvOn(), { honest: true });
    if (resolution.kind === 'explore') {
      lastExploreScene.current = resolution.scene;
      return { screen: 'shareGate', resolution };
    }
    ```
    `App.tsx:398-402`:
    ```typescript
    if (step.next === 'explore' && lastExploreScene.current) {
      const scene = lastExploreScene.current;
      const announced = exploreAnnouncement(scene, 'ai');
      drivers.speech.speak(announced, LANG_BCP47[currentLang]);
      setView({ screen: 'explore', scene, announced });
    ```
  - **Concrete failure scenario:** A student opens `https://host/#s=...` in a new tab. Before
    tapping "Open the shared diagram", they click a link to `#/teach`. In Teach mode, they press
    Back. The app navigates straight to Explore showing the shared diagram without the tap gate,
    leaving Web Audio locked, speech muted, and omitting the honest student banner.
  - **Minimal fix:** Do not assign `lastExploreScene.current` on cold shared links until
    `openSharedDiagram` executes upon gate tap, or check `fromShare` when leaving Teach so it
    returns to `shareGate` if the gate was never passed.

- **HIGH · frontend/src/i18n/index.ts:278-279, 621-622, 966-967; App.tsx:126, 145-165**
  - **Problem:** "Verified" and "सत्यापित" / "પ્રમાણિત" claim words remain in active user-facing
    strings and default `resolveShareRoute` fallback. `resolveShareRoute` in `App.tsx` defaults
    `options?.honest` to `false` (`const useHonest = options?.honest ?? false;`). When false, it
    uses legacy keys `share.verified` ("Verified" / "सत्यापित" / "પ્રમાણિત") and `share.verifiedBy`
    ("Verified by {name}" / "{name} द्वारा सत्यापित" / "{name} દ્વારા પ્રમાણિત"). Furthermore,
    Teach strings still use verified as a claim: `teach.verifiedSuccess` ("Diagram verified and share
    link ready"), `teach.markVerified` ("Mark verified"), and `teach.qrCodeAlt` ("QR code to open
    this verified diagram").
  - **Code quotes:**
    `App.tsx:126, 147-148`:
    ```typescript
    const useHonest = options?.honest ?? false;
    ...
    const legacyVerifiedName =
      decoded.verifiedBy.trim() !== '' ? decoded.verifiedBy : t('share.verified');
    const legacyVerifiedAnnouncement = t('share.verifiedBy').replace('{name}', legacyVerifiedName);
    ```
    `i18n/index.ts:278-279`:
    ```typescript
    'share.verified': 'Verified',
    'share.verifiedBy': 'Verified by {name}',
    ```
  - **Concrete failure scenario:** Any caller or test calling `resolveShareRoute(hash)` without
    explicitly passing `{ honest: true }` generates spoken announcements claiming "Verified by Mrs
    Sharma", violating Requirement R1. In Teach mode, hearing `teach.verifiedSuccess` misleads
    teachers into believing Ghost Touch verified the diagram's mathematical correctness.
  - **Minimal fix:** Change `App.tsx:126` to default `useHonest = options?.honest ?? true;`, remove
    or deprecate `share.verifiedBy` in favor of `share.sharedBy`, and rephrase Teach strings to
    "Ready to share" / "Diagram prepared for sharing".

- **MED · frontend/src/screens/Teach.tsx:335-348; components/teach/TeachCanvas.tsx:344-375**
  - **Problem:** Missing focus transfer to canvas after placing a point via "Add point" second press,
    disabling arrow key nudging for keyboard/switch/TalkBack users. Requirement 20.2.3 specifies
    that activating "Add point" twice places the point at centre (0.5, 0.5) so non-touch users can
    add points and move them via nudge controls. However, after `planAddPoint` succeeds, focus
    remains on the "Add point" button. Nudge controls (`ArrowUp`, `ArrowDown`, etc.) are handled
    strictly by `<canvas onKeyDown={handleKeyDown}>`.
  - **Code quotes:**
    `screens/Teach.tsx:336-348`:
    ```typescript
    if (res.action.kind === 'addPoint') {
      const outcome = planAddPoint(history.present, res.action.x, res.action.y);
      if (outcome.kind === 'added') {
        applySceneEdit(outcome.scene);
        setSelection({ kind: 'point', id: outcome.id });
        sayAndStatus(ghostwriterSpeech(outcome));
      }
    ```
  - **Concrete failure scenario:** A keyboard-only teacher activates "Add point" twice via Spacebar.
    The point is placed at (0.5, 0.5) and selected. When the teacher immediately presses arrow keys
    to nudge the point into position, nothing happens because keyboard focus is trapped on the
    toolbar button rather than the canvas.
  - **Minimal fix:** In `Teach.tsx`, after `planAddPoint` completes from a button activation,
    call `canvasRef.current?.focus()` so arrow key nudging is immediately operable.

- **MED · frontend/src/components/VerifiedBanner.tsx:33-35**
  - **Problem:** `VerifiedBanner` fails to sanitize modern checkmark emojis (`✅`, `🗹`), invisible
    Unicode marks, and badge words in teacher guidance notes. `VerifiedBanner.tsx` uses an obsolete
    regex: `const cleanNote = rawNote.replace(/^[✓✔☑√\s]+/u, '');`.
  - **Code quotes:**
    `components/VerifiedBanner.tsx:33-34`:
    ```typescript
    const rawNote = typeof note === 'string' ? note.trim() : '';
    const cleanNote = rawNote.replace(/^[✓✔☑√\s]+/u, '');
    ```
  - **Concrete failure scenario:** A shared link includes a note beginning with `✅ Verified exam
    solution`. When the student clicks "Read note" in Explore, `cleanNote` retains the emoji and
    badge word, rendering and speaking "✅ Verified exam solution", bypassing honesty enforcement.
  - **Minimal fix:** In `VerifiedBanner.tsx`, sanitize `note` with `sanitizeShareTitle(rawNote)` or
    `stripLeadingBadge(rawNote)` instead of the outdated checkmark regex.

- **MED · frontend/src/flow/saved.ts:52-55**
  - **Problem:** Template injection corruption via special replacement patterns (`$1`, `$&`, `$'`)
    in `deletedAnnouncement`. `deletedAnnouncement` in `flow/saved.ts` replaces `{title}` with raw
    string interpolation rather than a function replacer.
  - **Code quotes:**
    `flow/saved.ts:52-54`:
    ```typescript
    export function deletedAnnouncement(title: string, remaining: number): string {
      const deleted = t('saved.deleted').replace('{title}', title);
      return remaining > 0 ? deleted : joinAnnouncements([deleted, t('saved.empty')]);
    }
    ```
  - **Concrete failure scenario:** A user deletes a saved diagram titled "Quarterly Revenue: $100M".
    `t('saved.deleted').replace('{title}', title)` interprets `$1` as a backreference, corrupting
    the spoken and visible announcement to "Deleted Quarterly Revenue: 00M.".
  - **Minimal fix:** Change `flow/saved.ts:53` to:
    `const deleted = t('saved.deleted').replace('{title}', () => title);`.

- **LOW · frontend/src/flow/navigation.ts:169-171**
  - **Problem:** `leaveByBack` in `navigation.ts` hardcodes `needsConfirm: false` for `correct`
    screen, ignoring `ctx.dirty`.
  - **Code quotes:**
    `flow/navigation.ts:169-171`:
    ```typescript
    case 'correct':
      return { next: 'explore', announceKey: 'explore.gestureHint', needsConfirm: false };
    ```
  - **Concrete failure scenario:** Any automated flow or navigation test evaluating
    `leaveByBack('correct', { dirty: true, ... })` is told that unsaved corrections do not need
    user confirmation before leaving.
  - **Minimal fix:** Update `navigation.ts:170` to:
    `return { next: 'explore', announceKey: 'explore.gestureHint', needsConfirm: ctx.dirty };`.

- **LOW · frontend/src/drivers/diagramStore.ts:76-83, frontend/src/flow/saved.ts:105-118**
  - **Problem:** `MemoryDiagramStore.putWithEviction` and fallback eviction reverse put/delete
    ordering under quota and delete the new entry if `entry.id === evictedId`.
  - **Code quotes:**
    `drivers/diagramStore.ts:78-81`:
    ```typescript
    this.store.set(entry.id, entry);
    if (evictedId !== undefined) {
      this.store.delete(evictedId);
    }
    ```
  - **Concrete failure scenario:** If `putWithEviction` is called where `entry.id === evictedId`,
    `MemoryDiagramStore` stores the entry and immediately deletes it, losing the diagram. In
    `saved.ts`, putting before deleting victim fails prematurely if storage is strictly at quota.
  - **Minimal fix:** In `MemoryDiagramStore.putWithEviction` and `saved.ts`, delete `evictedId`
    before setting `entry`, matching `IDBDiagramStore`.
