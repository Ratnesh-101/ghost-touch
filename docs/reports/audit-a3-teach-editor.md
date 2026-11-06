# Audit Report: a3-teach-editor

**Lane**: a3-teach-editor  
**Auditor**: agy (Antigravity)  
**Date**: 2026-11-06  
**Status**: Complete  
**Scope**: Teacher Editor (`#/teach`), including `frontend/src/screens/Teach.tsx`, `frontend/src/components/teach/**`, `frontend/src/flow/teach.ts`, `frontend/src/drivers/clipboard.ts`, `frontend/src/styles/teach.css`, interaction with `frontend/src/core/correct.ts`, and entry points in `frontend/src/App.tsx` and `frontend/src/components/LabSettings.tsx`.

---

## Executive Summary

The Teacher Editor (`#/teach`) provides a comprehensive environment for sighted teachers and educators to create, edit, verify, and share accessible STEM diagrams. It successfully establishes core requirements: 48×48 px minimum touch targets, high-contrast palette compliance, LZ-string URL compression with QR code rendering, and strict scene validation before sharing.

However, a thorough audit of failure paths, race conditions, keyboard navigation, and accessibility flows revealed **17 confirmed findings** (7 High, 5 Medium, 5 Low) and **1 suspected finding**. Critical issues include stale share links remaining visible after modifying teacher names or notes, race conditions during asynchronous QR generation allowing out-of-sync scene sharing, missing modal focus trapping in `LoadModal`, loss of keyboard focus upon control disabling/modal dismissal, and untranslated English strings in Hindi and Gujarati locales.

---

## CONFIRMED Findings (Ranked by Severity)

### FINDING-01 · high · `frontend/src/screens/Teach.tsx:486-503`, `frontend/src/components/teach/VerifyForm.tsx:71,91`
- **What is wrong**:
  `applySceneEdit` clears `shareData` (`setShareData(null)`) when the diagram scene changes, but modifying `teacherName` or `teacherNote` via `onNameChange` and `onNoteChange` in `VerifyForm` only updates local React state without clearing `shareData`. Consequently, after verifying and generating a share link, if the teacher alters their name or note, the displayed share link and QR code remain visible and stale. The teacher can copy or share this link believing it reflects their updated name/guidance.
- **Concrete failure scenario**:
  1. Open `#/teach`. Enter name "Alice", note "Homework 1".
  2. Click "Mark verified".
  3. `SharePanel` displays the generated share link and QR code containing `verifiedBy: "Alice"` and `note: "Homework 1"`.
  4. Now edit the note in the textarea to "Homework 2 - Due Friday".
  5. The SharePanel remains visible beneath the form with the previous URL and QR code.
  6. Click "Copy link". The copied link decompresses to `note: "Homework 1"`.
- **Proposed minimal fix**:
  In `Teach.tsx`, clear `shareData` whenever `teacherName` or `teacherNote` is edited:
  ```ts
  const handleNameChange = (name: string): void => {
    setTeacherName(name);
    setShareData(null);
  };
  const handleNoteChange = (note: string): void => {
    setTeacherNote(note);
    setShareData(null);
  };
  ```
- **Proposed test**:
  ```ts
  it('clears shareData when teacher name or note is edited after verification', () => {
    // Render Teach, verify with name "Alice", assert SharePanel is present.
    // Fire change event on teacher note textarea with "Updated note".
    // Assert SharePanel is unmounted / cleared from DOM.
  });
  ```

---

### FINDING-02 · high · `frontend/src/screens/Teach.tsx:273-292,486-493`, `frontend/src/components/teach/VerifyForm.tsx:39,102`
- **What is wrong**:
  `handleVerify` is an `async` function that awaits `qrDataUrl(url)`. However, `VerifyForm` is not passed a loading/disabled state (`isVerifying`). Consequently, the teacher can click "Mark verified" multiple times triggering concurrent execution, or edit the diagram (move/add/delete vertices) while `qrDataUrl` is in-flight. When the promise resolves, it executes `setShareData({ url, qrUrl })`, overriding any intervening scene edits and presenting a share link for the previous scene state while the canvas displays the new scene state.
- **Concrete failure scenario**:
  1. Open `#/teach`. Enter teacher name "Teacher".
  2. Click "Mark verified". While QR code generation is in-flight:
  3. Immediately click "Add vertex" or delete a segment on the canvas.
  4. `applySceneEdit` runs, modifying the scene and resetting `shareData` to `null`.
  5. `handleVerify` promise finishes and executes `setShareData({ url, qrUrl })` with the old scene's payload.
  6. The share panel now displays a link and QR code for the old 3-vertex diagram, while the editor canvas displays 4 vertices.
- **Proposed minimal fix**:
  Track `isVerifying` state in `Teach.tsx`. Pass `disabled={isVerifying}` to `VerifyForm`. Validate that the scene did not mutate during generation:
  ```ts
  const [isVerifying, setIsVerifying] = useState(false);
  const handleVerify = async (): Promise<void> => {
    if (isVerifying) return;
    setIsVerifying(true);
    const sceneSnapshot = history.present;
    try {
      const payload = createSharePayload(sceneSnapshot, teacherName, teacherNote, new Date().toISOString());
      const encoded = encodeShare(payload);
      const url = shareUrl(getShareOrigin(), encoded);
      const qrUrl = await qrDataUrl(url);
      if (history.present === sceneSnapshot) {
        setShareData({ url, qrUrl });
        sayAndStatus(t('teach.verifiedSuccess'));
      }
    } finally {
      setIsVerifying(false);
    }
  };
  ```
- **Proposed test**:
  ```ts
  it('disables verification button while in-flight and discards result if scene edited during verification', async () => {
    // Mock qrDataUrl with deferred promise.
    // Trigger handleVerify, assert submit button is disabled.
    // Mutate scene via handleAddVertex.
    // Resolve qrDataUrl promise. Assert shareData remains null.
  });
  ```

---

### FINDING-03 · high · `frontend/src/components/teach/LoadModal.tsx:95-103,110-116`
- **What is wrong**:
  `LoadModal` declares `role="dialog"` and `aria-modal="true"`, but does not implement a Tab key focus trap. Pressing `Tab` from the last focusable element in the modal (e.g. a saved diagram item or load button) moves focus completely out of the modal into the underlying page (the canvas, toolbar, and verify form). Users can interact with background controls while the modal is open, violating WAI-ARIA 1.2 modal requirements.
- **Concrete failure scenario**:
  1. Open `#/teach`. Click "Load diagram".
  2. The Load modal opens; close button receives focus.
  3. Press `Tab` repeatedly until the last item in the modal is focused.
  4. Press `Tab` once more.
  5. Focus escapes the modal and moves to the "Back" button, Canvas, or Toolbar behind the backdrop.
  6. Pressing `Space` or `Enter` activates the background button while the modal is still open.
- **Proposed minimal fix**:
  Implement the standard Tab cycle in `handleKeyDown` in `LoadModal.tsx`, matching `LabSettings.tsx:166-193`:
  ```ts
  if (e.key === 'Tab') {
    if (!dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
      e.preventDefault();
      first?.focus();
    }
  }
  ```
- **Proposed test**:
  ```ts
  it('traps focus within LoadModal when Tab and Shift+Tab are pressed', () => {
    // Open LoadModal, focus first element, press Shift+Tab, assert last element focused.
    // Focus last element, press Tab, assert first element focused.
  });
  ```

---

### FINDING-04 · high · `frontend/src/screens/Teach.tsx:310-316,380-386`, `frontend/src/components/teach/LoadModal.tsx:48-56`
- **What is wrong**:
  1. When `LoadModal` opens, focus moves to the Close button, but `Teach.tsx` does not maintain a ref to the trigger button (`t('teach.load')`). When the modal closes (via Escape, Close button, or backdrop click), focus drops to `document.body`.
  2. When an element is selected and the user clicks the "Delete" button, `handleDeleteSelected` deletes the element and sets `selection` to `null`. This causes the Delete button to become `disabled={!selection}`, and unmounts the label edit panel. In browsers, disabling a focused control drops focus to `document.body`.
  3. Similarly, clicking Undo on the only past state disables the Undo button, dropping focus to `document.body`.
- **Concrete failure scenario**:
  1. Open `#/teach`. Tab to "Load diagram" button and press Enter.
  2. The Load dialog opens. Press Escape or click Close.
  3. The dialog closes. Focus is lost to `document.body` instead of returning to the "Load diagram" button.
  4. Select a vertex on canvas. Tab to "Delete" button and press Enter.
  5. The vertex is deleted. `selection` becomes `null`. The Delete button becomes disabled.
  6. Focus is lost to `document.body`. Screen reader announces body, losing position in the toolbar.
- **Proposed minimal fix**:
  1. In `Teach.tsx`, store `loadButtonRef = useRef<HTMLButtonElement>(null)` and focus `loadButtonRef.current?.focus()` when modal closes.
  2. In `Teach.tsx`, after deleting an element, shift focus to the "Add vertex" button or canvas instead of letting it drop from the disabled "Delete" button.
- **Proposed test**:
  ```ts
  it('restores focus to Load button when LoadModal closes', () => {
    // Open LoadModal from button, close it, expect document.activeElement === loadButton.
  });
  it('moves focus safely to Add vertex or canvas when Delete is activated', () => {
    // Select vertex, click Delete, expect document.activeElement !== document.body.
  });
  ```

---

### FINDING-05 · high · `frontend/src/screens/Teach.tsx:164-165,259-271`, `frontend/src/components/teach/VerifyForm.tsx:39`
- **What is wrong**:
  In a `function_graph` scene, when the user inputs an invalid axis coordinate (e.g. `1.5`, `-0.2`, or invalid text), `handleAxisChange` detects the error, displays `axisError`, and returns early without updating `history.present`. Because `isValidDiagram` is computed solely via `validateShareScene(history.present).ok`, `isValidDiagram` remains `true`! The `VerifyForm` is not passed `axisError`, so the "Mark verified" button remains ENABLED. The teacher can verify and generate a share link with the old axis coordinates while an invalid coordinate error is actively shown on screen.
- **Concrete failure scenario**:
  1. Load a `function_graph` diagram.
  2. In the "X-axis vertical position" input, enter `1.5`.
  3. Red error appears: "Axis coordinate must be between 0 and 1, or empty."
  4. Enter teacher name "Teacher".
  5. The "Mark verified" button is ENABLED!
  6. Click "Mark verified". The diagram is successfully verified with the OLD axis coordinate (e.g. 0.5), ignoring the user's intended value and the validation error.
- **Proposed minimal fix**:
  In `Teach.tsx`:
  ```ts
  const isValidDiagram = validationResult.ok && !axisError;
  ```
  Pass `isValidDiagram={isValidDiagram}` to `VerifyForm`.
- **Proposed test**:
  ```ts
  it('disables Mark verified when function_graph axis coordinate has validation error', () => {
    // Render Teach with function_graph scene.
    // Enter "1.5" into axisY input.
    // Assert "Mark verified" submit button is disabled.
  });
  ```

---

### FINDING-06 · high · `frontend/src/screens/Teach.tsx:317-324`, `frontend/src/App.tsx:422-434`
- **What is wrong**:
  When a teacher has made diagram modifications (e.g. added vertices, moved points, renamed labels, entered name/notes), clicking the "Back" button immediately calls `handleTeachBack`, clearing the hash and switching to Explore or Start without checking if edits are unsaved. All unverified history, name, and notes are permanently lost without warning. Furthermore, no `beforeunload` listener is registered to prevent accidental browser tab closure.
- **Concrete failure scenario**:
  1. Open `#/teach`. Add 3 vertices, move them, rename labels, type a detailed 200-char student note.
  2. Accidentally click the "Back" button in the header.
  3. `handleTeachBack` runs instantly. The view navigates to Explore/Start.
  4. All edits, custom vertices, and notes are lost. Returning to `#/teach` resets to the default triangle scene.
- **Proposed minimal fix**:
  Check if `canUndo(history)` or `teacherName.trim() !== ''` before navigating back. If unsaved edits exist, show a confirmation prompt or speak a warning. Add a `beforeunload` event listener while dirty:
  ```ts
  useEffect(() => {
    const isDirty = canUndo(history) || teacherName.trim().length > 0;
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [history, teacherName]);
  ```
- **Proposed test**:
  ```ts
  it('prompts before leaving teach editor when unsaved edits are present', () => {
    // Make edit, click Back, assert confirmation requested rather than immediate transition.
  });
  ```

---

### FINDING-07 · high · `frontend/src/i18n/index.ts:615,905`
- **What is wrong**:
  In the Hindi (`hi`) translation table line 615, `'teach.qrTooLong'` is untranslated:
  `'teach.qrTooLong': 'Link too long for a QR code; use Copy link'`
  In the Gujarati (`gu`) translation table line 905, `'teach.qrTooLong'` is untranslated:
  `'teach.qrTooLong': 'Link too long for a QR code; use Copy link'`
  When a shared diagram URL exceeds 2000 characters (e.g. for complex diagrams), Hindi and Gujarati teachers are presented with raw English instructions in violation of AGENTS.md rule 7 ("All strings via t() in en, hi, gu").
- **Concrete failure scenario**:
  1. Switch language to Hindi or Gujarati.
  2. Open `#/teach`.
  3. Load a diagram whose URL exceeds 2000 chars and verify.
  4. Notice the message under the QR container displays:
     "Link too long for a QR code; use Copy link" (raw English text).
- **Proposed minimal fix**:
  Update `frontend/src/i18n/index.ts`:
  In `hi` (line 615):
  `'teach.qrTooLong': 'क्यूआर कोड के लिए लिंक बहुत लंबा है; लिंक कॉपी करें का उपयोग करें',`
  In `gu` (line 905):
  `'teach.qrTooLong': 'ક્યુઆર કોડ માટે લિંક ખૂબ લાંબી છે; લિંક કોપી કરો વાપરો',`
- **Proposed test**:
  ```ts
  it('provides localized qrTooLong message in hi and gu', () => {
    expect(tables.hi['teach.qrTooLong']).not.toContain('Link too long');
    expect(tables.gu['teach.qrTooLong']).not.toContain('Link too long');
  });
  ```

---

### FINDING-08 · med · `frontend/src/flow/teach.ts:67-74,86-88`
- **What is wrong**:
  `generateUniquePointId(existingPoints: Point[] = [])` only checks for conflicts against `existingPoints` (`point.id`). It does not inspect `scene.segments`, `scene.polylines`, or `scene.bars`. If a diagram already contains a segment, polyline, or bar with an ID matching the generated pattern (e.g. `p4`, `p5`), `addVertex` generates that duplicate ID. This causes a duplicate ID invariant violation (`validateSceneInvariants` error: `Duplicate ID: 'p4'`).
- **Concrete failure scenario**:
  1. Load a diagram containing points `[A, B, C]` and a segment with `id: 'p4', a: 'A', b: 'B'`.
  2. Click "Add vertex".
  3. `generateUniquePointId` checks existing points `[A, B, C]`. Length is 3, so it generates `p4`.
  4. The scene now contains both a point with `id: 'p4'` and a segment with `id: 'p4'`.
  5. `validateSceneInvariants` fails with duplicate ID error.
- **Proposed minimal fix**:
  Change `generateUniquePointId` to accept the entire scene or a set of all element IDs:
  ```ts
  export function generateUniquePointId(sceneOrPoints: DiagramScene | Point[]): string {
    const ids = new Set<string>();
    if (Array.isArray(sceneOrPoints)) {
      for (const p of sceneOrPoints) ids.add(p.id);
    } else {
      for (const p of sceneOrPoints.points ?? []) ids.add(p.id);
      for (const s of sceneOrPoints.segments ?? []) ids.add(s.id);
      for (const poly of sceneOrPoints.polylines ?? []) ids.add(poly.id);
      for (const b of sceneOrPoints.bars ?? []) ids.add(b.id);
    }
    let counter = ids.size + 1;
    while (ids.has(`p${counter}`) || ids.has(`p_${counter}`)) {
      counter++;
    }
    return `p${counter}`;
  }
  ```
- **Proposed test**:
  ```ts
  it('does not generate an ID that collides with an existing segment, polyline, or bar ID', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [{ id: 'A', x: 0.1, y: 0.1 }],
      segments: [{ id: 'p2', a: 'A', b: 'A' }],
    };
    const { newPointId } = addVertex(scene);
    expect(newPointId).not.toBe('p2');
  });
  ```

---

### FINDING-09 · med · `frontend/src/components/teach/TeachCanvas.tsx:302-350`
- **What is wrong**:
  During pointer drag, `handlePointerMove` calls `renderCanvasWithScene(tempScene, view)`. `renderCanvasWithScene` is a copy-paste of rendering logic that completely omits drawing axes (`scene.axes`), bar charts (`scene.bars`), polylines (`scene.polylines`), and segment labels. As soon as the user begins dragging any point, all axes, bars, and polylines vanish from the screen, and pop back in only on pointer release.
- **Concrete failure scenario**:
  1. Load a `function_graph` diagram (which displays dashed x and y axes) or a bar chart.
  2. Tap and drag any point on the canvas.
  3. Notice the axes or bars instantly vanish from the canvas.
  4. Release pointer: the axes/bars pop back into view.
- **Proposed minimal fix**:
  Merge `renderCanvasWithScene` into `renderCanvas(view, overrideScene = scene)` so all elements (axes, bars, polylines, segments, points) are rendered uniformly during drag.
- **Proposed test**:
  ```ts
  it('renders axes, bars, and polylines during point drag operations', () => {
    // Render TeachCanvas with function_graph scene.
    // Trigger pointerDown and pointerMove on a point.
    // Verify canvas context strokes dashed axis lines during drag.
  });
  ```

---

### FINDING-10 · med · `frontend/src/flow/teach.ts:111-120`, `frontend/src/screens/Teach.tsx:186-190`
- **What is wrong**:
  When a point is nudged with arrow keys at the boundary (e.g. `x = 1.0` and `ArrowRight` is pressed), `movePoint` in `core/correct.ts` clamps coordinates to `1.0`, but returns a newly allocated scene object. `handleNudgePoint` in `Teach.tsx` calls `applySceneEdit(updated)`, which treats the new reference as a new edit and pushes an identical scene into undo history. Furthermore, it speaks `sayAndStatus("Moved vertex A")` even though the point did not move.
- **Concrete failure scenario**:
  1. Select a point near the right boundary and nudge it to `x = 1.0`.
  2. Press `ArrowRight` 5 more times.
  3. Each time, speech announces "Moved vertex A".
  4. Undo history now has 5 duplicate states. The user must press Undo 5 times before the point moves left again.
- **Proposed minimal fix**:
  In `nudgeVertex` or `handleNudgePoint`, check if coordinates actually changed before applying edit:
  ```ts
  const pt = (history.present.points ?? []).find(p => p.id === pointId);
  if (pt && clamp01(pt.x + dx) === pt.x && clamp01(pt.y + dy) === pt.y) {
    return;
  }
  ```
- **Proposed test**:
  ```ts
  it('does not push history or announce move when nudging past boundaries [0, 1]', () => {
    // Position point at x=1, nudge right, assert history length is unchanged.
  });
  ```

---

### FINDING-11 · med · `frontend/src/components/teach/LoadModal.tsx:85-90`, `frontend/src/screens/Teach.tsx:294-300`
- **What is wrong**:
  When loading a diagram from a share link or hash (`#s=...`), `loadSceneFromShareInput` decodes the full `SharePayload` containing `verifiedBy`, `note`, and `verifiedAt`. However, `LoadModal.handleShareSubmit` only passes `res.scene` to `onLoadScene(res.scene, title)`. `Teach.tsx` only updates `history`, leaving `teacherName` and `teacherNote` blank (or keeping whatever was typed before). If a teacher loads another teacher's verified diagram to review, edit, or extend it, the original verifier name, note, and verification date are completely dropped without display or warning.
- **Concrete failure scenario**:
  1. Teacher B opens `#/teach`, clicks "Load diagram".
  2. Pastes a share link created by Teacher A with `verifiedBy: "Dr. Rao"` and `note: "Solve problem 3"`.
  3. Diagram loads onto canvas.
  4. Teacher B looks at the Verify section: `Teacher name` is empty, `Note` is empty. There is no indication who verified it or what the guidance note was.
- **Proposed minimal fix**:
  Extend `onLoadScene` to pass the optional payload `(scene: DiagramScene, sourceTitle: string, payload?: SharePayload) => void`. In `handleLoadScene`:
  ```ts
  if (payload) {
    setTeacherName(payload.verifiedBy);
    setTeacherNote(payload.note);
  }
  ```
- **Proposed test**:
  ```ts
  it('populates teacher name and note when loading an existing share link payload', () => {
    // Load share link containing verifiedBy="Dr. Rao" and note="Study this".
    // Assert teacherName input has "Dr. Rao" and teacherNote has "Study this".
  });
  ```

---

### FINDING-12 · med · `frontend/src/components/LabSettings.tsx:318-323,103-107`, `frontend/src/screens/Teach.tsx:133-136`
- **What is wrong**:
  When the teacher clicks "Open Teacher Editor" in `LabSettings.tsx`:
  1. `handleClose()` calls `doSpeak(t('lab.settings.closed'))` ("Lab settings closed").
  2. In the same click event, `window.location.hash = TEACH_HASH` routes to `Teach.tsx`.
  3. `Teach.tsx` mount effect calls `speak(t('teach.intro'))` ("Teacher editor. Edit diagrams...").
  Because the speech driver cancels any active utterance on every speak (`speechSynthesis.cancel()`), the "Lab settings closed" announcement is instantly cut off or cancels `teach.intro`.
- **Concrete failure scenario**:
  1. Open Lab Settings with speech enabled.
  2. Turn on Teacher tools.
  3. Click "Open Teacher Editor".
  4. "Lab settings closed" starts speaking and is instantly chopped off mid-syllable by "Teacher editor...".
- **Proposed minimal fix**:
  In `LabSettings.tsx`, when navigating directly to `TEACH_HASH`, omit the `lab.settings.closed` announcement since the destination screen has its own entrance announcement.
- **Proposed test**:
  ```ts
  it('does not speak lab.settings.closed when navigating to Teacher Editor', () => {
    // Trigger Open Teacher Editor, verify only teach.intro is queued/spoken.
  });
  ```

---

### FINDING-13 · low · `frontend/src/screens/Teach.tsx:289,370`, `frontend/src/components/teach/TeachCanvas.tsx:163,176`
- **What is wrong**:
  Several user-facing strings are hardcoded in English instead of using `t()`:
  1. `Teach.tsx:289`: `err instanceof Error ? err.message : 'Verification failed'` fallback string `'Verification failed'`.
  2. `Teach.tsx:370`: `aria-label="Editing toolbar"` on `.gt-teach__toolbar`.
  3. `TeachCanvas.tsx:163,176`: `drawLabelPill(ctx, 'X-axis', ...)` and `drawLabelPill(ctx, 'Y-axis', ...)`.
- **Concrete failure scenario**:
  In Hindi or Gujarati mode, a screen reader inspecting the toolbar hears "Editing toolbar" in English, and the canvas axis label pills display English text "X-axis" and "Y-axis".
- **Proposed minimal fix**:
  Use `t('teach.toolbar')`, `t('explore.xAxis')`, `t('explore.yAxis')`, and `t('teach.verifyError')`.
- **Proposed test**:
  ```ts
  it('uses localized strings for toolbar and axis label pills', () => {
    // Switch to Hindi, render TeachCanvas and Teach toolbar, verify translated text.
  });
  ```

---

### FINDING-14 · low · `frontend/src/components/teach/SharePanel.tsx:40`
- **What is wrong**:
  In `SharePanel.tsx`, `handleCopy` sets a 2500ms timeout: `setTimeout(() => setCopied(false), 2500);`. The timer handle is not retained or cleared on unmount. If the user copies the link and immediately navigates away or modifies the scene (causing SharePanel to unmount), the timer fires and calls `setCopied(false)` on an unmounted component.
- **Concrete failure scenario**:
  1. Click "Copy link".
  2. Immediately click "Add vertex" or "Back".
  3. After 2.5 seconds, `setCopied(false)` executes against the unmounted `SharePanel` instance.
- **Proposed minimal fix**:
  Store timer in a ref and clear it in a `useEffect` cleanup hook.
- **Proposed test**:
  ```ts
  it('clears copy confirmation timeout on unmount', () => {
    // Trigger copy, unmount component, advance timers, verify no console warning or error.
  });
  ```

---

### FINDING-15 · low · `frontend/src/screens/Teach.tsx:171-173`, `frontend/src/i18n/index.ts:298-299,310`
- **What is wrong**:
  The translation tables in `en`, `hi`, and `gu` define `teach.selectedVertex`, `teach.selectedSegment`, and `teach.validationTitle`. However, `Teach.tsx` ignores `teach.selectedVertex` and `teach.selectedSegment`, instead calling `getSelectionAnnouncement` from `core/correct.ts` (which uses `correct.selectedPoint`). Furthermore, `teach.validationTitle` is never referenced in `Teach.tsx`.
- **Concrete failure scenario**:
  Translations specifically crafted for the Teacher Editor ("Selected vertex: {label}") are never spoken or displayed; the editor falls back to the generic student correction phrase ("Selected point: ...").
- **Proposed minimal fix**:
  In `Teach.tsx`, format selection announcements using `t('teach.selectedVertex')` and `t('teach.selectedSegment')`, or remove the unused keys.
- **Proposed test**:
  ```ts
  it('uses teach.selectedVertex when a vertex is selected in Teach screen', () => {
    // Select point A in Teach screen, verify spoken text uses teach.selectedVertex.
  });
  ```

---

### FINDING-16 · low · `frontend/src/App.tsx:249-260`
- **What is wrong**:
  When the user is on `#/teach` and hits the browser's Back button, `hash` changes to `""` or `"#"`. The `useEffect` in `App.tsx` sets `view` to `{ screen: 'start' }`. However, it does not call `drivers.speech.speak`, leaving the transition completely silent for TalkBack / screen reader users. Rule 7: "Every state change is spoken."
- **Concrete failure scenario**:
  1. Teacher is on `#/teach`.
  2. Teacher presses browser Back.
  3. App transitions to Start screen. No speech announcement is made.
- **Proposed minimal fix**:
  In `App.tsx` lines 249-260:
  ```ts
  if (prev.screen === 'teach') {
    drivers.speech.speak(t('start.intro'), LANG_BCP47[currentLang]);
  }
  ```
- **Proposed test**:
  ```ts
  it('speaks start.intro when navigating back from teach via browser back', () => {
    // Simulate hash change to empty from teach view, assert speech driver spoken start.intro.
  });
  ```

---

### FINDING-17 · low · `frontend/src/drivers/clipboard.ts:36-53`
- **What is wrong**:
  In `copyToClipboard`, the fallback implementation creates a `textarea` element and appends it to `document.body`. If an exception occurs during `textarea.select()` or `document.execCommand('copy')`, `document.body.removeChild(textarea)` is bypassed because it is inside the try block without a finally block.
- **Concrete failure scenario**:
  In an environment where `execCommand` throws a security or DOM exception, the detached textarea remains in `document.body` permanently.
- **Proposed minimal fix**:
  Use `try ... finally { if (textarea.parentNode) document.body.removeChild(textarea); }`.
- **Proposed test**:
  ```ts
  it('cleans up textarea fallback in clipboard even if execCommand throws', async () => {
    // Mock execCommand to throw Error, verify document.body has no leftover textarea.
  });
  ```

---

## SUSPECTED Findings

### SUSPECTED-01 · low · `frontend/src/components/teach/TeachCanvas.tsx:404-417`
- **What is wrong**:
  The diagram canvas (`role="img"`, `tabIndex={0}`) provides no internal DOM structure or virtual nodes for its vertices or segments. While sighted keyboard users can select an element via pointer and then nudge it with Arrow keys or delete with Delete key, a blind keyboard-only or screen reader user cannot discover or cycle selection among elements without tapping pixel coordinates on the screen.
- **Proposed minimal fix**:
  Add `Tab` / `Shift+Tab` or `[` / `]` cycling among vertices/segments when the canvas is focused, announcing the currently selected element with `getSelectionAnnouncement`.
- **Proposed test**:
  ```ts
  it('allows keyboard-only cycling of vertices on canvas via keyboard', () => { ... });
  ```

---

## Areas Audited and Confirmed Sound

1. **Web Share API Integration**: Checked `SharePanel.tsx:15,32,44-50`; verified `canWebShare()` properly gates the Share button and gracefully handles user cancellation (`AbortError`).
2. **QR Code Length Threshold**: Checked `qrDataUrl` in `share/qr.ts`; strictly enforces `LIMITS.qrMaxUrlChars` (2000 chars), cleanly returning `null` when exceeded.
3. **Touch Targets (48×48 CSS px)**: Checked all toolbar buttons, inputs, modal items, and canvas hit radius (`HIT_POINT_RADIUS_PX = 24`, 48 px diameter) against Requirement 12.1; all meet >= 48×48 px.
4. **Responsive Layout (390 px and 1440 px)**: Checked `teach.css`; verified clean transition from vertical flex column on mobile to 3:2 two-column layout on desktop without horizontal scrolling.
5. **Canvas Letterboxing and Coordinate Transforms**: Checked `pointerToHitTestCoords` and `pointerToScene` in `correctCanvas.ts`; DPR and letterbox offsets are accurately handled.
6. **No `any`, No `console.log`**: Checked all editor and share files; 100% adherence to strict TypeScript and clean production logging.
7. **No `dangerouslySetInnerHTML`**: Verified labels, notes, teacher names, and titles are rendered strictly as text nodes.

---

## Top 5 to Fix First

1. **FINDING-01 (Stale Share Link / QR After Editing Name/Note)**: Prevents teachers from accidentally sharing diagrams with outdated notes or credentials.
2. **FINDING-02 (Race Condition in Async Verification Flow)**: Guarantees that the generated share link and QR code always match the visible canvas diagram.
3. **FINDING-03 (Missing Focus Trap in `LoadModal`)**: Critical accessibility bug ensuring keyboard/screen reader users cannot leak focus to background controls.
4. **FINDING-05 (Invalid Axis Fields Do Not Block Verification)**: Ensures `function_graph` diagrams with invalid axis ranges cannot be verified or shared.
5. **FINDING-07 (Missing `teach.qrTooLong` Translations in Hindi & Gujarati)**: Fixes untranslated English strings appearing in localized Indian language versions.

---

## Verification Proof (DoD Commands)

- **Frontend Tests**:
  `npm --prefix frontend test`
  Passed: 105 test files passed (105), 1420 tests passed (1420), 0 failures. Duration: 4.26s.
- **Frontend Type Check**:
  `npm --prefix frontend exec -- tsc -p frontend --noEmit`
  Passed: 0 errors.
- **Frontend Build**:
  `npm --prefix frontend run build`
  Passed: 127 modules transformed, clean PWA service worker with 22 precache entries (639.79 KiB).
- **Backend Tests**:
  `backend/.venv/Scripts/python -m pytest backend`
  Passed: 454 passed, 1 skipped, 1 warning in 38.08s.
- **Backend Ruff**:
  `backend/.venv/Scripts/python -m ruff check backend`
  Passed: All checks passed.
  `backend/.venv/Scripts/python -m ruff format --check backend`
  Passed: 60 files already formatted.
