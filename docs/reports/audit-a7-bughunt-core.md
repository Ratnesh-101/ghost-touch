# Audit Report: a7-bughunt-core (Full-App Bug Hunt & Functional Review)

- **Lane:** `a7-bughunt-core`
- **Auditor:** Antigravity (`agy`, headless audit)
- **Date:** 2026-11-06
- **Status:** COMPLETE (Audit Only — zero source code, test, or config files modified)
- **Scope:**
  - `frontend/src/App.tsx` (screen transitions, share routing, history management, `saveDiagram`)
  - `frontend/src/screens/` (`Capture.tsx`, `Explore.tsx`, `Correct.tsx`, `SavedDiagrams.tsx`, `Teach.tsx`, `Start.tsx`)
  - `frontend/src/flow/` (`explore.ts`, `capture.ts`, `ask.ts`, `teach.ts`, `correctCanvas.ts`, `navigation.ts`)
  - `frontend/src/drivers/` (`audio.ts`, `speech.ts`, `haptics.ts`, `diagramStore.ts`, `hashRoute.ts`)
  - `frontend/src/components/` (`TeachCanvas.tsx`, `SettingsLauncher.tsx`, `LabSettings.tsx`, `AccessibleButton.tsx`)
  - `backend/app/` (`main.py`, `ask.py`, `limits.py`, `semantic.py`, `scene_cache.py`, `raw_mode.py`)
  - Kiro-owned boundary verification: `frontend/src/core/hitTest.ts`, `frontend/src/core/hapticEngine.ts`

---

## 1. Verification Baseline

All standard verification commands were executed from the repository root:

- `npm --prefix frontend exec -- tsc -p frontend --noEmit`: Clean (Exit code 0, 0 type errors).
- `npm --prefix frontend test`: 110 passed test files (1518 tests passed, 0 failed). Duration: 18.7s.
- `npm --prefix frontend run build`: Clean build in 181 ms (PWA precache 22 entries, 659.42 KiB).
- `backend/.venv/Scripts/python -m pytest backend`: 474 passed, 1 skipped in 43.15s.
- `backend/.venv/Scripts/python -m ruff check backend`: Clean (All checks passed).
- `backend/.venv/Scripts/python -m ruff format --check backend`: Clean (63 files already formatted).

---

## 2. Sound Areas

The following subsystems were inspected and verified to be functionally sound:

1. **Scene Cache (`backend/app/scene_cache.py`):** Thread-safe LRU cache with monotonic clock TTL, proper locking via `threading.Lock()`, defensive deep-copying of cached scenes, and correct exclusion of Raw Mode and error results.
2. **Deterministic Semantic Ask Engine (`backend/app/semantic.py`):** Robust Indic text normalization (`normalize_semantic_text` handling Unicode combining matras, nuktas, and danda), geometry tie-breaking in document order, and strict `source="facts"` isolation before provider invocation.
3. **Explore Relative Cursor & Center Re-anchoring (`frontend/src/flow/explore.ts`):** Touch offset normalization, center tick re-arming with 1.5x hysteresis dead-band, and quiet window suppression around corner vibration patterns.
4. **Explore Audio & Earcon Restoration (`frontend/src/drivers/audio.ts`):** `setTone` properly cancels scheduled gain ramps with `cancelScheduledValues()`, avoiding stuck theremin tones after earcon ducking.
5. **Teacher Share Codec (`frontend/src/share/codec.ts`):** Strict version validation (`v: 1`), URL length limits (`qrMaxUrlChars: 2000`), LZ-string decompression caps, and defensive string sanitization.

---

## 3. Confirmed Findings (Ranked by Severity)

### High Severity

#### CORE-01 · HIGH · `frontend/src/App.tsx:249-261`
- **What is wrong:** Hardware / browser Back button from Teacher (`#/teach`), Student Share (`#/share/...`), or Share Error resets screen to `{ screen: 'start' }` completely silently without any spoken announcement (violating Rule 7: every state change is spoken), and discards unsaved teacher changes without triggering the `teach.confirmLeave` confirmation dialog.
- **Concrete failure scenario:**
  1. A visually impaired teacher or user is editing vertices and labels on `#/teach`. They have made unsaved modifications (`isDirty === true`).
  2. The teacher presses the Android hardware Back button (or browser back button).
  3. The browser URL hash transitions from `#/teach` to empty `""`.
  4. In `App.tsx:249-254`, the `hashchange` listener executes:
     ```ts
     const next = parseHash(window.location.hash);
     if (!next) {
       setScreen({ screen: 'start' });
       return;
     }
     ```
  5. The screen drops back to Start. No `say(t('start.prompt'))` is called. The teacher hears absolute silence, and their unsaved edits are permanently discarded without warning.
- **Proposed minimal fix:**
  In `App.tsx`, check whether leaving `#/teach` with unsaved changes should be confirmed, and invoke `say(t('start.prompt'))` when transitioning to the Start screen:
  ```ts
  if (!next) {
    say(t('start.prompt'));
    setScreen({ screen: 'start' });
    return;
  }
  ```
- **Proposed test:**
  ```ts
  it('speaks start prompt when popping hash to empty string from a secondary route', () => {
    const saySpy = vi.fn();
    window.location.hash = '#/teach';
    // dispatch hashchange to ''
    // expect saySpy to have been called with start.prompt
  });
  ```

---

#### CORE-02 · HIGH · `frontend/src/screens/Explore.tsx:950-955, 1017-1022` and `frontend/src/drivers/speech.ts:167-175`
- **What is wrong:** Back-to-back `drivers.speech.speak()` calls during pointer moves cancel preceding utterances synchronously in the same frame, causing crossed axes and landmark announcements to be silenced.
- **Concrete failure scenario:**
  1. User moves finger across the coordinate axes at the origin `(0, 0)` diagonally where `scene.axes` has both `x_axis_y` and `y_axis_x`.
  2. `moveResult.axisCrossings` contains `['y-axis', 'x-axis']`.
  3. Line 1017 loops over `axisCrossings`: calls `drivers.speech.speak('y-axis', lang)` and immediately on the next iteration calls `drivers.speech.speak('x-axis', lang)`.
  4. In `frontend/src/drivers/speech.ts:167-175`, `WebSpeechDriver.speak()` immediately executes `this.synth.cancel()`, cancelling `'y-axis'` before it produces any sound.
  5. If this crossing also coincides with entering a vertex (e.g. vertex at origin), line 1021 immediately calls `runEffects()` which executes `drivers.speech.speak('Point O')`, instantly cancelling `'x-axis'` as well.
  6. The student never hears the axis crossings.
- **Proposed minimal fix:**
  Concatenate simultaneous crossed axis labels into a single phrase (`moveResult.axisCrossings.join('. ')`) before calling `speak`, and queue or combine with landmark speech rather than cancelling in-frame.
- **Proposed test:**
  ```ts
  it('combines multiple crossed axis announcements into a single utterance during diagonal move', () => {
    const speakSpy = vi.fn();
    // simulate move crossing both axes
    // expect speakSpy called once with combined "y-axis. x-axis"
  });
  ```

---

#### CORE-03 · HIGH · `frontend/src/screens/SavedDiagrams.tsx:54-72`
- **What is wrong:** Asynchronous `diagramStore.list()` resolution executes on unmounted component without a cancellation guard, announcing diagram titles or empty status over other screens.
- **Concrete failure scenario:**
  1. User navigates from Capture to Saved Diagrams.
  2. `SavedDiagrams` mounts and begins `await diagramStore.list()`.
  3. The user immediately taps "Back" (or presses Android hardware Back) to return to Capture.
  4. `SavedDiagrams` unmounts.
  5. `diagramStore.list()` finishes reading IndexedDB in the background.
  6. In lines 57-69, `setLoading(false)`, `setEntries(ordered)`, and `say(titles)` or `say(t('saved.empty'))` are called on the unmounted component.
  7. The speech driver announces the diagram titles over the Capture UI, speaking over TalkBack announcements and confusing the user.
- **Proposed minimal fix:**
  Add a cancellation flag in the `useEffect` cleanup in `SavedDiagrams.tsx`:
  ```ts
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await diagramStore.list();
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        say(t('saved.errorLoad'));
        return;
      }
      const ordered = orderForDisplay(result.value);
      setEntries(ordered);
      if (ordered.length === 0) {
        say(t('saved.empty'));
      } else {
        const titles = ordered.map((e) => e.title).join('. ');
        say(titles);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  ```
- **Proposed test:**
  ```ts
  it('does not speak or update state when unmounted before diagramStore.list completes', async () => {
    // mount SavedDiagrams, unmount before promise resolves, resolve promise, verify say was not called
  });
  ```

---

#### CORE-04 · HIGH · `backend/app/ask.py:140-160`
- **What is wrong:** `is_dont_know()` only strips ASCII period (`.`) and does not strip Devanagari danda (`।`, `\u0964`) or double danda (`॥`, `\u0965`), causing Hindi "don't know" answers with standard or model-generated punctuation to fail matching and keep hallucinated targets.
- **Concrete failure scenario:**
  1. Student asks a question in Hindi (`lang="hi-IN"`).
  2. The vision/language model returns a don't-know response ending with an ASCII period: `"मुझे इस आरेख से यह ज्ञात नहीं है."` (common in LLM JSON output).
  3. `is_dont_know()` cleans the text with `text.strip().lower().rstrip(".")` -> `"मुझे इस आरेख से यह ज्ञात नहीं है"`.
  4. In line 158: `if phrase.lower().rstrip(".") in cleaned: return True`. The reference phrase `DONT_KNOW_RESPONSES["hi"]` is `"मुझे इस आरेख से यह ज्ञात नहीं है।"`.
  5. Calling `.rstrip(".")` on the reference phrase does NOT strip `।`.
  6. `"मुझे इस आरेख से यह ज्ञात नहीं है।"` is NOT a substring of `"मुझे इस आरेख से यह ज्ञात नहीं है"`.
  7. `is_dont_know()` returns `False`.
  8. If the model returned a target (e.g. `{"target": {"x": 0.5, "y": 0.5}}`), line 640 preserves the hallucinated target.
  9. The API returns an answer saying it doesn't know alongside an active target, violating the contract requirement that "don't know" answers must have `target: null`.
- **Proposed minimal fix:**
  In `backend/app/ask.py:140-160`, strip Indic punctuation (`.।॥`) in `is_dont_know`:
  ```python
  def is_dont_know(text: str) -> bool:
      cleaned = text.strip().lower().replace("’", "'").replace("‘", "'").rstrip(".।॥")
      ...
      for phrase in DONT_KNOW_RESPONSES.values():
          if phrase.lower().rstrip(".।॥") in cleaned:
              return True
      return False
  ```
- **Proposed test:**
  ```python
  def test_is_dont_know_matches_hindi_with_ascii_period():
      assert is_dont_know("मुझे इस आरेख से यह ज्ञात नहीं है.") is True
      assert is_dont_know("मुझे इस आरेख से यह ज्ञात नहीं है।") is True
  ```

---

#### CORE-05 · HIGH · `backend/app/ask.py:783` (and lines 396-398)
- **What is wrong:** `facts_lookup` answers completely bypass `clamp_answer()`. Combining up to 3 matched facts can produce an answer of 900+ characters and multiple sentences delivered directly to TTS.
- **Concrete failure scenario:**
  1. A diagram scene contains 3 facts, each with up to 300 characters of descriptive text (`MAX_TEXT_CHARS = 300`).
  2. Student asks a query matching the diagram.
  3. Line 396 selects the top 3 winners: `winners = [c.text.strip() for score, c in scored if score == best_score][:3]`.
  4. Line 397 joins them: `answer = " ".join(w if w.endswith((".", "!", "?")) else w + "." for w in winners)`. The answer can reach 900+ characters across 6+ sentences.
  5. Line 783 returns: `return AskResponse(answer=fact_answer, source="facts", target=None)`.
  6. `clamp_answer(fact_answer)` is NEVER called on this return path.
  7. The response is spoken aloud by TTS, locking the student into a minute-long speech monologue.
- **Proposed minimal fix:**
  Wrap `fact_answer` in `clamp_answer()`:
  ```python
  return AskResponse(answer=clamp_answer(fact_answer), source="facts", target=None)
  ```
- **Proposed test:**
  ```python
  def test_facts_lookup_clamps_answer_to_two_sentences_and_max_chars():
      scene = DiagramScene(
          title="Test",
          points=[],
          facts=["Fact 1: " + "a" * 150 + ".", "Fact 2: " + "b" * 150 + "."],
      )
      # verify answer length <= 300 chars and <= 2 sentences
  ```

---

#### CORE-06 · HIGH · `backend/app/ask.py:55` and `backend/app/main.py:643`
- **What is wrong:** `MAX_POLYLINE_POINTS = 1000` in `backend/app/ask.py` contradicts the Teacher Share contract (`frontend/src/share/limits.ts:18` allows `maxPolylinePoints: 2000`).
- **Concrete failure scenario:**
  1. A teacher exports a shared diagram containing a high-resolution curve with 1400 points (fully valid under `validateShareScene`, which permits up to 2000 points).
  2. A student opens the shared diagram and asks a question using the Ask button.
  3. Frontend sends the scene to `POST /api/v1/ask`.
  4. `_check_scene_size` in `backend/app/ask.py:439` checks `p > MAX_POLYLINE_POINTS` (1400 > 1000) and throws `ValueError("polyline has too many points (1400 > 1000)")`.
  5. The endpoint rejects the valid diagram with HTTP 422 Unprocessable Entity.
  6. Similarly, `POST /api/v1/validate` rejects the diagram with HTTP 422.
- **Proposed minimal fix:**
  Increase `MAX_POLYLINE_POINTS = 2000` in `backend/app/ask.py:55` to match `frontend/src/share/limits.ts`.
- **Proposed test:**
  ```python
  def test_check_scene_size_allows_up_to_2000_polyline_points():
      scene = {"points": [], "polylines": [{"id": "pl1", "points": [[0.1, 0.2]] * 1500}]}
      _check_scene_size(scene)  # should not raise ValueError
  ```

---

### Medium Severity

#### CORE-07 · MEDIUM · `frontend/src/screens/SavedDiagrams.tsx:98-106`
- **What is wrong:** Deleting the last saved diagram triggers two consecutive `say()` calls that instantly cancel each other, muting deletion confirmation. In addition, the confirmed delete button is removed from the DOM, dropping focus to `document.body`.
- **Concrete failure scenario:**
  1. User has 1 saved diagram. They tap "Delete", then "Confirm delete".
  2. Line 99 calls `say(msg)` ("Deleted Triangle").
  3. Inside `setEntries`, line 103 calls `say(t('saved.empty'))` ("No saved diagrams yet").
  4. `WebSpeechDriver.speak()` cancels in-flight speech (`this.synth.cancel()`), immediately cutting off "Deleted Triangle" before it is heard.
  5. The confirmed delete button is unmounted from the DOM, dropping keyboard and screen reader focus to `document.body`.
- **Proposed minimal fix:**
  Combine the announcement and explicitly return focus to the heading:
  ```ts
  const msg = t('saved.deleted').replace('{title}', entry.title);
  setEntries((prev) => {
    const next = prev.filter((e) => e.id !== entry.id);
    const fullMsg = next.length === 0 ? `${msg} ${t('saved.empty')}` : msg;
    say(fullMsg);
    return orderForDisplay(next);
  });
  headingRef.current?.focus();
  ```
- **Proposed test:**
  ```ts
  it('announces single combined message and focuses heading when deleting the last saved diagram', async () => {
    // delete last diagram; assert speech driver received single combined message and heading is focused
  });
  ```

---

#### CORE-08 · MEDIUM · `frontend/src/screens/Explore.tsx:847`
- **What is wrong:** `e.currentTarget.setPointerCapture(e.pointerId)` is not wrapped in `try/catch`. On synthesized pointer events, TalkBack double-tap pass-through, or released pointers, browsers throw `DOMException: InvalidPointerId`.
- **Concrete failure scenario:**
  1. A TalkBack user performs a double-tap-and-hold gesture.
  2. Depending on browser event scheduling, the synthesized pointer event triggers `handlePointerDown` with an inactive or released pointer ID.
  3. `setPointerCapture(e.pointerId)` throws `DOMException: Failed to execute 'setPointerCapture' on 'Element': InvalidPointerId`.
  4. The unhandled exception aborts `handlePointerDown` before `activePointers.current.set()` and `processPointerMove()`.
  5. Exploration is rendered completely non-functional.
- **Proposed minimal fix:**
  Wrap in `try/catch` (consistent with `TeachCanvas.tsx:273`):
  ```ts
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // Safe pointer capture fallback
  }
  ```
- **Proposed test:**
  ```ts
  it('does not throw when setPointerCapture fails with InvalidPointerId', () => {
    // mock setPointerCapture to throw DOMException, fire pointerdown, expect handler to complete
  });
  ```

---

#### CORE-09 · MEDIUM · `frontend/src/components/teach/TeachCanvas.tsx:356-370`
- **What is wrong:** Missing `onLostPointerCapture` handler on `<canvas>` in Teacher editor.
- **Concrete failure scenario:**
  1. Teacher starts dragging a point on the canvas (`isDraggingRef.current = true`).
  2. An Android notification or system gesture causes the browser to revoke pointer capture (`lostpointercapture` event).
  3. `<canvas>` only listens to `onPointerUp` and `onPointerCancel`; it does not listen to `onLostPointerCapture`.
  4. `isDraggingRef.current` remains `true`.
  5. When the teacher taps back on the canvas to select a different point or tool, the canvas assumes a drag is still active, jumping points across the screen.
- **Proposed minimal fix:**
  Add `onLostPointerCapture={handlePointerUp}` to `<canvas>` in `TeachCanvas.tsx`.
- **Proposed test:**
  ```ts
  it('clears dragging state when lostpointercapture fires on TeachCanvas', () => {
    // fire pointerdown on point, fire lostpointercapture, verify isDraggingRef is false
  });
  ```

---

#### CORE-10 · MEDIUM · `frontend/src/drivers/speech.ts:264`
- **What is wrong:** Hardcoded English string `"No system voice found for ${langDisplay}. Using default voice."` violates Rule 7 ("Every user-facing string through `t()`").
- **Concrete failure scenario:**
  1. Student selects Hindi (`hi-IN`) or Gujarati (`gu-IN`) in settings on an Android phone that lacks Indic TTS voice packs.
  2. When speech begins, line 264 speaks `"No system voice found for HI. Using default voice."` in English.
  3. A student who only understands Hindi/Gujarati receives an unexpected English message.
- **Proposed minimal fix:**
  Localize the notice via `t('speech.noVoiceNotice', { lang: langDisplay })` or pass localized strings into the driver.
- **Proposed test:**
  ```ts
  it('uses localized string when warning about missing voice pack', () => {
    // trigger speak with missing voice pack, verify utterance text uses localized translation
  });
  ```

---

#### CORE-11 · MEDIUM · `backend/app/ask.py:368-369`
- **What is wrong:** Point "A" is discarded unconditionally in `facts_lookup` because `"A"` is included in `NON_ID_UPPERCASE`.
- **Concrete failure scenario:**
  1. Diagram has vertices A, B, and C (`scene.points` contains `id: "A", label: "A"`).
  2. Student asks "Where is A?" or "What is at A?".
  3. Line 368 checks `if wl in UNIT_TOKENS or w in NON_ID_UPPERCASE: continue`.
  4. Because `"A"` is in `NON_ID_UPPERCASE`, it is skipped. `q_ids` never contains `"a"`.
  5. Line 380: `if not q_content and not q_ids: return None`.
  6. `facts_lookup` returns `None`. The student receives "I don't know from this diagram." even though point A is present and labeled.
- **Proposed minimal fix:**
  Only treat "A" as a non-identifier article if `"a"` is not among `known_ids`:
  ```python
  if w in NON_ID_UPPERCASE and wl not in known_ids:
      continue
  ```
- **Proposed test:**
  ```python
  def test_facts_lookup_matches_point_a():
      scene = DiagramScene(title="Test", points=[Point(id="A", x=0.5, y=0.5, label="A")])
      answer = facts_lookup(scene, "Where is A?", "en")
      assert answer is not None
  ```

---

#### CORE-12 · MEDIUM · `backend/app/ask.py:605`
- **What is wrong:** `str(parsed["answer"])` converts non-string JSON values into raw Python string representations like `"{'en': ...}"` or `"None"`.
- **Concrete failure scenario:**
  1. LLM provider returns structured JSON where `"answer"` is an object or dictionary: `{"answer": {"summary": "Triangle ABC"}, "target": null}`.
  2. Line 605 executes `ans = str(parsed["answer"])`, yielding `"{'summary': 'Triangle ABC'}"`.
  3. This raw string is returned as `answer` and read verbatim by TTS ("Opening curly brace quote summary...").
- **Proposed minimal fix:**
  Validate that `parsed["answer"]` is a string (`if not isinstance(parsed["answer"], str): continue`).
- **Proposed test:**
  ```python
  def test_parse_ai_reply_rejects_dict_answer():
      reply = '{"answer": {"en": "Triangle"}, "target": null}'
      ans, target = parse_ai_reply(reply)
      assert ans == reply  # falls back to raw text rather than "{'en': 'Triangle'}"
  ```

---

#### CORE-13 · MEDIUM · `backend/app/limits.py:118-135`
- **What is wrong:** Blindly trusts `X-Forwarded-For` header for client identification; `_HITS` dictionary never evicts empty deque entries, causing unbounded memory growth.
- **Concrete failure scenario:**
  1. An attacker sends arbitrary `X-Forwarded-For` headers with each request to bypass rate limiting.
  2. Over a long-running session with rotating IP addresses, `_HITS[(client, path)]` creates thousands of keys in the `defaultdict`.
  3. Even after rate windows expire, keys are never pruned from `_HITS`. The dictionary grows without bound in server memory.
- **Proposed minimal fix:**
  Only trust `X-Forwarded-For` from configured trusted proxies, and prune empty keys when cleaning expired timestamps in `_allow`:
  ```python
  while window and now - window[0] > RATE_WINDOW_SECONDS:
      window.popleft()
  if not window:
      del _HITS[(client, path)]
  ```
- **Proposed test:**
  ```python
  def test_rate_limiter_prunes_empty_client_windows():
      limiter = RequestGuardMiddleware(None, rate_limits={"/test": (5, 60)})
      # simulate expired hits and verify _HITS key is deleted
  ```

---

### Low Severity

#### CORE-14 · LOW · `frontend/src/screens/Capture.tsx:92-101` and `frontend/src/components/SettingsLauncher.tsx:47-55`
- **What is wrong:** Multiple components monkey-patch `drivers.speech.setRate` directly on the shared `drivers.speech` singleton; unmounting restores stale closures and clobbers active listeners.
- **Concrete failure scenario:**
  1. `Capture.tsx` mounts and wraps `drivers.speech.setRate`.
  2. `SettingsLauncher` inside `Capture` also mounts and wraps `drivers.speech.setRate`.
  3. When `SettingsLauncher` unmounts, its cleanup restores its captured `originalSetRate`, wiping out `Capture`'s rate change listener.
- **Proposed minimal fix:**
  Implement a subscriber pattern on `SpeechDriver` (`subscribeRate(cb)`) similar to `subscribeLang` rather than mutating method properties on the driver instance.
- **Proposed test:**
  ```ts
  it('supports multiple rate change subscribers without method monkey-patching', () => {
    // subscribe multiple listeners and verify all are notified on setRate
  });
  ```

---

#### CORE-15 · LOW · `frontend/src/screens/Capture.tsx:139-144`
- **What is wrong:** Dismissing the camera or file picker calls `handleCancel()` which resets busy state and focus but speaks nothing, leaving blind users in silence.
- **Concrete failure scenario:**
  1. Blind user activates "Take photo". The system camera application or picker opens.
  2. User hits Back to cancel.
  3. The input's `cancel` event fires `handleCancel()`.
  4. `handleCancel()` sets `setBusy(false)` and focuses `takeButton`, but produces zero audio or speech.
  5. The blind user has no feedback confirming that the camera was dismissed and they are back on Capture.
- **Proposed minimal fix:**
  Announce `say(t('capture.prompt'))` in `handleCancel()`.
- **Proposed test:**
  ```ts
  it('speaks prompt when camera picker is cancelled', () => {
    // trigger cancel event on file input; verify speech driver receives prompt
  });
  ```

---

#### CORE-16 · LOW · `frontend/src/screens/Capture.tsx:172-180` and `frontend/src/screens/Correct.tsx:93-102`
- **What is wrong:** For PDF uploads, `Capture.tsx` passes the raw PDF file blob to `onScene` as `photoUrl`; `Correct.tsx` cannot render PDF blobs in `<img>`, breaking the photo overlay feature for PDFs.
- **Concrete failure scenario:**
  1. User uploads a PDF diagram.
  2. `processImageFile` renders page 1 to an image canvas/blob for sending to backend.
  3. In line 175, `Capture.tsx` creates `photoUrl` from the raw `file` (`application/pdf`).
  4. Teacher enters Correct mode. `Correct.tsx` sets `photoImg.current.src = photoUrl`.
  5. The browser image element triggers `onError` because `<img>` cannot decode PDF files.
  6. Teacher Correct mode displays a blank background without the source diagram overlay.
- **Proposed minimal fix:**
  In `Capture.tsx`, store the rendered raster image JPEG/PNG blob (from `renderFirstPage`) and use that for `photoUrl`.
- **Proposed test:**
  ```ts
  it('creates photoUrl from rendered raster image rather than raw PDF blob', () => {
    // upload PDF; verify photoUrl is an image blob URL
  });
  ```

---

## 4. Needs from Kiro (Kiro-Owned Modules)

Per Rule 1 of `AGENTS.md`, the following issues reside in Kiro-owned files (`frontend/src/core/**`) and are recorded for Kiro:

### NEEDS-KIRO-01 · HIGH · `frontend/src/core/hitTest.ts:85-111`
- **What is wrong:** In `closerVertex` and `closerLine`:
  ```ts
  function closerVertex(
    prev: VertexHit | null,
    id: string,
    label: string | undefined,
    dist: number,
    radius: number,
  ): VertexHit | null {
    if (dist > radius) return prev;
    if (prev === null || dist < prev.dist) return { id, label, dist };
    return prev;
  }
  ```
  If `dist` evaluates to `NaN` (due to a NaN coordinate from a model or a 0-dimension canvas division), `dist > radius` evaluates to `false`. Then `prev === null || dist < prev.dist` evaluates `prev === null` as `true` on the first iteration. The candidate with distance `NaN` wins. Subsequent iterations compare `dist < NaN` (false), retaining `{ id, label, dist: NaN }`. Consequently, `hitTest` returns a persistent hit across the entire canvas, locking vibration and tones on every touch.
- **Minimal fix for Kiro:** Guard against non-finite distance:
  ```ts
  if (!Number.isFinite(dist) || dist > radius) return prev;
  ```

### NEEDS-KIRO-02 · MEDIUM · `frontend/src/core/hapticEngine.ts:132`
- **What is wrong:** Hardcoded English string `'Point ' + target.id` is spoken when entering an unlabelled vertex during Hindi or Gujarati exploration sessions:
  ```ts
  const labelText =
    target.label !== undefined && target.label.trim() !== ''
      ? target.label
      : 'Point ' + target.id;
  effects.push({ kind: 'speak', text: labelText });
  ```
- **Minimal fix for Kiro:** Emit a tokenized effect or localized prefix for unlabelled vertices.

---

## 5. Top 10 Missing Tests

The 10 most valuable missing tests across the application user journeys:

1. **Back Navigation Speech Announcement (`frontend/tests/app.navigation.test.tsx`):**
   Verify that popping the browser hash from `#/teach` or `#/share/...` to empty string triggers `say(t('start.prompt'))` and does not silently abandon state.
2. **Saved Diagrams Async Unmount Speech Suppression (`frontend/tests/savedDiagrams.unmount.test.tsx`):**
   Verify that resolving `diagramStore.list()` after `SavedDiagrams` has unmounted does not call `say()`.
3. **Saved Diagrams Delete Confirmation & Focus Retention (`frontend/tests/savedDiagrams.delete.test.tsx`):**
   Verify that deleting the final saved diagram emits a single combined announcement without speech truncation and moves focus to the screen heading.
4. **Explore Simultaneous Axis Crossing Speech Queue (`frontend/tests/explore.axis.speech.test.tsx`):**
   Verify that passing diagonally through `(0, 0)` produces an announcement for both axes rather than cancelling the first axis utterance.
5. **Explore Pointer Capture Exception Tolerance (`frontend/tests/explore.pointer.test.tsx`):**
   Verify that `handlePointerDown` completes successfully when `setPointerCapture` throws `DOMException: InvalidPointerId`.
6. **Teacher Canvas Pointer Revocation Cleanup (`frontend/tests/teach.canvas.pointer.test.tsx`):**
   Verify that dispatching `lostpointercapture` on `<canvas>` resets `isDraggingRef.current` to `false`.
7. **Backend Indic Punctuation in Don't Know Detection (`backend/tests/test_ask_indic_danda.py`):**
   Verify that `is_dont_know()` returns `True` for Hindi responses ending with either ASCII `.` or Devanagari `।`.
8. **Backend Facts Lookup Length and Sentence Clamping (`backend/tests/test_ask_facts_clamp.py`):**
   Verify that `facts_lookup` answers with multiple matching facts never exceed 300 characters or 2 sentences.
9. **Backend Polyline Point Cap Compatibility (`backend/tests/test_ask_polyline_cap.py`):**
   Verify that `_check_scene_size` in `backend/app/ask.py` accepts scenes with up to 2000 points per polyline per the Teacher Share contract.
10. **Backend Rate Limiter Monotonic Cache Eviction (`backend/tests/test_limits_leak.py`):**
    Verify that `_HITS` entries are deleted when their sliding window of timestamps expires.

---

## 6. Top 5 to Fix First

1. **CORE-01 (`frontend/src/App.tsx:249-261`): Silent Start Navigation and Unsaved Work Discard on Hardware Back**
   - *Why fix first:* A blind user or teacher pressing Back from `#/teach` receives zero audio feedback and loses all unsaved diagram work without confirmation.
2. **CORE-02 (`frontend/src/screens/Explore.tsx:950-955, 1017-1022`): Axis Crossing Speech Cancellation Collision**
   - *Why fix first:* Fundamental accessibility flaw during tactile exploration. Crossing the origin or entering a vertex simultaneously silences axis announcements.
3. **CORE-03 (`frontend/src/screens/SavedDiagrams.tsx:54-72`): Speech Leak and Unmounted State Mutation on Saved Diagrams Exit**
   - *Why fix first:* Navigating quickly back from Saved Diagrams causes the diagram list to speak over the Capture screen, corrupting speech flow for blind users.
4. **CORE-04 (`backend/app/ask.py:140-160`): Hindi "Don't Know" Danda Matching Failure Keeps Hallucinated Targets**
   - *Why fix first:* Direct violation of the Ask contract. Hallucinated targets survive when the model replies in Hindi with ASCII period, guiding blind users to non-existent features.
5. **CORE-06 (`backend/app/ask.py:55` / `backend/app/main.py:643`): Polyline Point Cap Mismatch Rejects Teacher Shared Diagrams**
   - *Why fix first:* Contract divergence between frontend share limits (2000 points) and backend ask limits (1000 points) results in HTTP 422 errors when asking questions about valid teacher-shared diagrams.
