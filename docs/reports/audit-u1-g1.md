# Audit Report: Ghostwriter UI (Lane u1-g1-audit)
Status: DONE
Lane: u1-g1-audit
Scope: Requirement 20 (20.1-20.8), Lane g1 / Task 36 merge
Files: `frontend/src/flow/ghostwriter.ts`, `frontend/src/screens/Teach.tsx`,
       `frontend/src/components/teach/TeachCanvas.tsx`, `frontend/src/i18n/index.ts`,
       `frontend/tests/ghostwriter.prop.test.ts`,
       `frontend/tests/ghostwriter.teach.test.tsx`,
       `frontend/tests/teach.editor.test.tsx`, `frontend/src/core/correct.ts`

---

## 1. Sound Invariants (One-Line Verifications)

- **Requirement 20.1 (Teach-only):** Add point/edge controls appear strictly in
  `Teach.tsx`; `Explore.tsx` is completely unchanged and contains no add controls
  (`Explore.tsx#L1-L50`).
- **Requirement 20.2.1 & 20.3.1 (Touch targets & accessible names):** Every control
  uses `AccessibleButton` with `.gt-control` (min 48×48 px) and accessible names
  (`Teach.tsx#L644-L667`).
- **Requirement 20.2.2 & 20.2.3 (Coordinate conversion):** Tap-to-add uses letterboxed
  DPR viewport conversion (`correctCanvas.ts#L42-L118`, `TeachCanvas.tsx#L271-L282`);
  secondary button press places point at centre (0.5, 0.5) (`ghostwriter.ts#L335-L340`).
- **Requirement 20.2.4 & 20.2.5 (Blank labels & naming):** Blank labels are trimmed to
  undefined and spoken via `vertex.unlabelled` ("Point D" / "बिंदु D" / "બિંદુ D")
  (`ghostwriter.ts#L76-L81`, `L124-L125`, `L272-L274`).
- **Requirement 20.2.6 (One way to add):** "Add vertex" is replaced by "Add point" using
  `addPoint` with sequential uppercase IDs (`A`..`Z`, `P1`..) (`correct.ts#L197-L228`,
  `Teach.tsx#L645-L655`).
- **Requirement 20.3.2 - 20.3.5 (Two-step edge pick & cancellation):** Two-step state
  machine tracks `addEdgeFirst` and `addEdgeSecond`; no-op reasons are announced;
  Escape or toolbar clicks cleanly cancel the pick and announce `teach.addCancelled`
  (`ghostwriter.ts#L356-L417`).
- **Requirement 20.4 (History & undo announcements):** Add operations apply via
  `applyEdit`; no-ops create no history; undo announces specific added ID or endpoints
  (`Teach.tsx#L452-L467`, `ghostwriter.ts#L197-L255`).
- **Requirement 20.5 (Caps):** Caps `GHOSTWRITER_POINT_CAP` (300) and
  `GHOSTWRITER_SEGMENT_CAP` (300) correctly match the minimum of sharing limits and
  backend bounds (`ghostwriter.ts#L24-L25`).
- **Requirement 20.6 (Spec Ghost integrity & honesty):** Add flow does not invoke,
  soften, or alter `verifyScene`; Spec Ghost correctly detects mismatches when missing
  geometry is added (`ghostwriter.teach.test.tsx#L331-L375`). No forbidden words
  ("verified", "correct", "checked", "approved") exist in any language table for
  Ghostwriter keys (`ghostwriter.prop.test.ts#L265-L304`).
- **Requirement 20.7 (i18n parity):** Complete parity across `en`, `hi`, and `gu` in
  `i18n/index.ts` with identical placeholders; all 17 keys documented in
  `translation-review.csv` and `.md`.
- **Requirement 20.8 (Pure flow isolation):** Decision logic is pure in
  `flow/ghostwriter.ts` with no React or browser dependencies; property tests
  P58-P61 run 250 cases (`ghostwriter.prop.test.ts`).
- **Reserved ID safety:** Reserved ID `title` is unreachable from the UI because
  `planAddPoint` and `planAddSegment` do not accept or pass explicit IDs
  (`ghostwriter.ts#L118`, `L162`).
- **Orientation change:** Responsive canvas resize and DPR scaling are handled
  automatically via `ResizeObserver` and `updateDimensions` (`TeachCanvas.tsx#L65-L108`).
- **Touch action:** Canvas container enforces `touch-action: none` to disallow unwanted
  browser pan or pinch-zoom during drawing interactions (`teach.css#L122`).

---

## 2. Audit Findings (Highest Severity First)

### Finding 1: HIGH · `frontend/src/screens/Teach.tsx:441-450`
- **Problem:** Focus management after element deletion cancels and silences deletion speech.
- **Code Quote:**
  ```tsx
  // Teach.tsx lines 441-450
  if (selection.kind === 'point') {
    ...
    sayAndStatus(`${t('teach.delete')}: ${id}`);
  } else if (selection.kind === 'segment') {
    ...
    sayAndStatus(`${t('teach.delete')}: ${id}`);
  }
  addPointBtnRef.current?.focus();
  ```
  and line 649:
  ```tsx
  // Teach.tsx line 649
  <AccessibleButton
    ref={addPointBtnRef}
    ...
    onFocus={() => speak(t('teach.addPoint'))}
  ```
- **Concrete Failure Scenario:** A blind teacher navigates to a selected vertex and
  activates Delete. `sayAndStatus` queues the deletion confirmation ("Delete: A").
  Immediately on the next line, `addPointBtnRef.current?.focus()` synchronously
  triggers the `focus` event on the "Add point" button. Its `onFocus` handler calls
  `speak(t('teach.addPoint'))`. In `WebSpeechDriver.speak`, `synth.cancel()` cancels
  the pending deletion utterance before audio can play. The teacher hears "Add point"
  instead of confirming that vertex A was removed.
- **Minimal Fix:** In `handleDeleteSelected`, remove `onFocus` speech triggering or
  avoid focusing an unrelated control synchronously with speech, or pass a flag to
  `addPointBtnRef` suppressing spoken label when focus is restored programmatically.

---

### Finding 2: MED · `frontend/src/screens/Teach.tsx:648-667`
- **Problem:** Double speech and speech clipping on activating toolbar add controls.
- **Code Quote:**
  ```tsx
  // Teach.tsx lines 648-653
  <AccessibleButton
    ref={addPointBtnRef}
    type="button"
    className="gt-control gt-btn gt-btn--secondary"
    onClick={handleAddPoint}
    onFocus={() => speak(t('teach.addPoint'))}
    aria-pressed={gwMode.kind === 'addPoint'}
    aria-label={t('teach.addPoint')}
  >
    {t('teach.addPoint')}
  </AccessibleButton>
  ```
- **Concrete Failure Scenario:** When a user taps "Add point" on a mobile device or
  clicks with a mouse, the browser fires `focus` followed immediately by `click`.
  `onFocus` invokes `speak(t('teach.addPoint'))` ("Add point"). A few milliseconds
  later, `onClick` invokes `handleAddPoint` -> `sayAndStatus(res.speech)` ("Tap the
  drawing where the new point goes..."). `synth.cancel()` aborts the first utterance
  mid-word. On Android Chrome, TTS stutters ("Add p— Tap the drawing...").
- **Minimal Fix:** Remove `onFocus={() => speak(...)}` from the buttons. In
  screen-reader modes (TalkBack), `aria-label` is already spoken by the screen reader
  upon focus. For sighted/keyboard users, relying on activation speech in `onClick`
  avoids dual invocation.

---

### Finding 3: MED · `frontend/tests/teach.editor.test.tsx:141-165`
- **Problem:** Test asserts nothing meaningful; mocks handlers and checks only static tags.
- **Code Quote:**
  ```tsx
  // teach.editor.test.tsx lines 141-145, 163-164
  it(
    'TeachCanvas handles keyboard events (ArrowUp/Down/Left/Right, ...)',
    () => {
      ...
      expect(htmlWithSelection).toContain('<canvas');
      expect(htmlWithSelection).toContain('role="img"');
    },
  );
  ```
- **Concrete Failure Scenario:** If keyboard event handling in `TeachCanvas.handleKeyDown`
  is completely broken or deleted, this test still passes because it only renders
  static markup and checks for `<canvas` and `role="img"`. Not a single `keydown`
  event is dispatched, and none of the mock functions (`onNudgePoint`,
  `onDeleteSelected`, `onUndo`, `onRedo`) are ever asserted.
- **Minimal Fix:** Rewrite the test using a jsdom container: dispatch
  `new KeyboardEvent('keydown', { key: 'ArrowUp' })` on the canvas, and assert
  `expect(onNudgePoint).toHaveBeenCalledWith('pA', 0, -0.02)`.

---

### Finding 4: MED · `frontend/tests/teach.editor.test.tsx:195-208`
- **Problem:** Test title contradicts test assertion; does not test form on selection.
- **Code Quote:**
  ```tsx
  // teach.editor.test.tsx lines 195-208
  it('renders label edit form when element is selected', () => {
    const drivers = createMockDrivers();
    const html = renderToStaticMarkup(
      createElement(Teach, {
        initialScene: sampleTriangle,
        drivers,
        onBack: vi.fn(),
      }),
    );

    // Initial state has no selection
    expect(html).not.toContain('gt-teach__label-form');
  });
  ```
- **Concrete Failure Scenario:** The test claims to verify that the label edit form
  renders when an element is selected, but it actually renders `Teach` without
  selection and asserts `not.toContain`. If the selection panel completely fails to
  render when an element is selected, this test passes.
- **Minimal Fix:** Update the test to simulate selection or test both negative and
  positive states: mount `Teach`, select a vertex, and assert
  `expect(html).toContain('gt-teach__label-form')`.

---

### Finding 5: LOW · `frontend/tests/ghostwriter.prop.test.ts:166-185`
- **Problem:** Property test P59 copies application logic into test assertion body.
- **Code Quote:**
  ```ts
  // ghostwriter.prop.test.ts lines 166-185
  const hasA = points.some((p) => p.id === a);
  const hasB = points.some((p) => p.id === b);
  const joined = segments.some(
    (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a),
  );

  if (a === b) {
    expect(outcome.kind).toBe('samePoint');
  } else if (!hasA || !hasB) {
    expect(outcome.kind).toBe('unknownPoint');
  } else if (joined) {
    expect(outcome.kind).toBe('alreadyJoined');
  } else if (segments.length >= GHOSTWRITER_SEGMENT_CAP) {
    expect(outcome.kind).toBe('limit');
  } else {
    expect(outcome.kind).toBe('added');
  }
  ```
- **Concrete Failure Scenario:** The test duplicates the exact conditional branching of
  `planAddSegment` (`ghostwriter.ts#L143-L161`). If an architectural requirement change
  alters edge decision order, copy-pasted test logic masks contract bugs.
- **Minimal Fix:** Structure property tests to assert invariant properties directly
  (such as idempotency, monotonicity of segment count, graph connectivity) rather than
  re-evaluating the if-else cascade.

---

### Finding 6: LOW · `frontend/tests/ghostwriter.teach.test.tsx:241-250`
- **Problem:** Component test bypasses UI under test and directly calls pure flow functions.
- **Code Quote:**
  ```tsx
  // ghostwriter.teach.test.tsx lines 241-250
  // 3. Unknown point (pure flow contract)
  const scene = createTestScene();
  const unknownRes = planAddSegment(scene, 'A', 'Z');
  expect(unknownRes.kind).toBe('unknownPoint');
  expect(ghostwriterSpeech(unknownRes)).toBe(t('teach.edgeUnknownPoint'));

  // 4. Bad coordinates (pure flow contract)
  const badCoordsRes = planAddPoint(scene, NaN, 0.5);
  expect(badCoordsRes.kind).toBe('badCoords');
  expect(ghostwriterSpeech(badCoordsRes)).toBe(t('teach.pointBadCoords'));
  ```
- **Concrete Failure Scenario:** These cases test `planAddSegment` and `planAddPoint`,
  which are already covered in `ghostwriter.prop.test.ts`. They do not test how
  `Teach.tsx` handles these outcomes in practice. (In the UI, canvas taps are clamped
  to [0, 1] so `badCoords` cannot be triggered via direct pointer events).
- **Minimal Fix:** Document in test comments that UI entry for `badCoords` and
  `unknownPoint` is inaccessible by design through direct canvas taps, or simulate them
  through component props.

---

### Finding 7: LOW · `frontend/src/core/correct.ts:220` & `frontend/src/flow/ghostwriter.ts:104`
- **Problem:** Point addition permits duplicate positions (coincident vertices).
- **Code Quote:**
  ```ts
  // correct.ts lines 220-229
  export function addPoint(
    scene: DiagramScene,
    x: number,
    y: number,
    label?: string,
    id?: string,
  ): DiagramScene {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return scene;
    const used = usedIds(scene);
    const pointId = freeRequestedId(id, used) ?? nextPointId(used);
    const point: Point = { id: pointId, x: clamp01(x), y: clamp01(y) };
    return { ...scene, points: [...(scene.points ?? []), point] };
  }
  ```
- **Concrete Failure Scenario:** If a teacher presses "Add point" twice at the centre
  (0.5, 0.5), two points (`D` and `E`) are created at the exact same location. In
  `hitTestPoint` (`correct.ts#L41`), the last point in the array shadows earlier
  coincident points. The earlier point becomes unselectable and unmovable via canvas
  taps unless the top point is moved away via keyboard nudge.
- **Minimal Fix:** Add a slight offset or reject duplicate vertex creation if a vertex
  already exists within `HIT_POINT_RADIUS_PX` during centre addition, or document that
  coincident points require keyboard nudge navigation.

---

### Finding 8: LOW · `frontend/src/flow/ghostwriter.ts:281-283`
- **Problem:** Point cap speech text misreports point count when imported scene exceeds cap.
- **Code Quote:**
  ```ts
  // ghostwriter.ts lines 281-283
  return tf('teach.pointLimit', {
    max: String(GHOSTWRITER_POINT_CAP),
  });
  ```
- **Concrete Failure Scenario:** A backend AI scene with 400 points (valid in backend
  where `MAX_SCENE_POINTS = 500`) is opened in Teacher mode. When the user taps
  "Add point", the add is refused. The spoken message says: "This diagram already has
  300 points, the most that can be shared." The diagram actually has 400 points,
  causing user confusion.
- **Minimal Fix:** Update `teach.pointLimit` message template or params to indicate
  "has {count} points, exceeding the sharing limit of {max}".

---

### Finding 9: LOW · `docs/user-test/translation-review.md:693-733`
- **Problem:** Section 25 (Ghostwriter in Teach Mode) is duplicated verbatim in review docs.
- **Code Quote:** Lines 693-712 and lines 714-733 in `translation-review.md` contain
  identical tables.
- **Concrete Failure Scenario:** Native translators review and sign off on duplicated strings.
- **Minimal Fix:** Remove the duplicated section from `docs/user-test/translation-review.md`.

---

## 3. Detailed Verification of Technical Invariants

### 3.1 Pointer Capture and Touch-Action on Mobile
- `TeachCanvas.tsx#L122`: `.gt-teach-canvas` has `touch-action: none` declared in CSS
  (`teach.css#L122`), preventing browser viewport scrolling and gesture interception.
- In `handlePointerDown` (`TeachCanvas.tsx#L280-L283`), when `ghostwriterMode.kind !== 'idle'`,
  `onCanvasTap` is dispatched immediately and returns. Pointer capture is **not** set
  during add mode, which correctly prevents dragging mid-tap.

### 3.2 Mid-Gesture Mode Switch
- If a user has a finger dragging a point in idle mode and simultaneously activates
  "Add point" on the toolbar, `nextMode` enters `addPoint` and clears selection
  (`Teach.tsx#L327-L329`). When the drag pointer releases, `isDraggingRef.current`
  completes the final position commit safely without corrupting the armed `addPoint` state.
- In `addPoint` mode, pressing "Add edge" immediately cancels add point
  (`ghostwriter.ts#L347-L352`) and speaks `teach.addCancelled`. In `addEdgeFirst` or
  `addEdgeSecond`, activating either add button cancels the pick and speaks
  `teach.addCancelled` (`ghostwriter.ts#L357-L366`, `L386-L395`), strictly satisfying
  Requirement 20.3.5.

### 3.3 Rapid Double Taps
- In `addPoint` mode, `handlePointerDown` triggers `onCanvasTap` on the first
  `pointerdown`, adding the point and transitioning mode to `idle`.
- If the user rapidly double-taps: the second tap lands in `idle` mode directly over
  the newly added point, triggering `onSelect` and initiating a point drag. This
  behavior is safe, responsive, and does not create unwanted ghost points.

### 3.4 Behavior at 499 and 500 Points
- `GHOSTWRITER_POINT_CAP = Math.min(LIMITS.maxPoints, 500) = 300` today (governed by share limit).
- At 299 points: `planAddPoint` allows adding point #300.
- At 300 points: `planAddPoint` returns `{ kind: 'limit', scene }`.
- In a hypothetical environment where share limit is relaxed to match the backend cap of 500:
  - At 499 points: `points.length < 500` -> add succeeds, yielding exactly 500 points.
  - At 500 points: `points.length >= 500` -> add refused with `{ kind: 'limit' }`,
    preventing the scene from reaching 501 points (which would be rejected by backend
    `MAX_SCENE_POINTS`).

---

## 4. Summary of Test Health

| Test File | Status | Notes |
| :--- | :--- | :--- |
| `frontend/tests/ghostwriter.prop.test.ts` | Sound | P58-P61 run 250 cases; P59 copies app logic |
| `frontend/tests/ghostwriter.teach.test.tsx` | Minor gaps | Covers 20.1-20.7; cases 3-4 call pure functions |
| `frontend/tests/teach.editor.test.tsx` | Flawed | Lines 141-165 & 195-208 assert hollow checks |

---
*Report completed by Antigravity (agy). Supervisor may run linter and test suite.*
