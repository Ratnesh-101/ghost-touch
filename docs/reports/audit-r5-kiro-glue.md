# Audit Report: Lane r5-kiro-glue

**Status: DONE**  
**Auditor:** Antigravity (agy)  
**Date:** 2026-11-09  
**Scope:** Integration and glue audit of Kiro's last two tasks:
- **T35 (disputed-angle wording per language):** `frontend/src/core/verify.ts`,
  `frontend/src/flow/ask.ts`, `frontend/src/flow/navigation.ts`, `frontend/src/i18n/index.ts`
  (angle strings in en, hi, gu), `frontend/tests/n2.round4.test.ts`,
  `frontend/tests/verify.review.test.ts`, and `frontend/tests/verify.angleName.test.ts`.
- **T34 (Ghostwriter core: addPoint, addSegment):** `frontend/src/core/correct.ts` and
  `frontend/tests/correct.ghostwriter.prop.test.ts`.

---

## 1. Executive Summary

This read-only audit examined the glue, edge cases, cross-language behavior, and property test
integrity for Kiro's completed tasks T34 (`addPoint`, `addSegment` in `frontend/src/core/correct.ts`)
and T35 (`disputed-angle wording per language` in `frontend/src/core/verify.ts`,
`frontend/src/flow/navigation.ts`, `frontend/src/flow/ask.ts`, and `frontend/src/i18n/index.ts`).

Key discoveries include:
1. **Mid-session language switch leaves stale English text in Explore status & speech (HIGH):**
   `Explore.tsx` initializes `statusMessage` state and `lastSpokenRef` once on mount from
   `announced`. When language is switched mid-session via `SettingsLauncher`, `statusMessage` and
   `lastSpokenRef` remain in English, causing visual status text and voice repeat to speak English
   phrases with the Hindi/Gujarati TTS voice.
2. **`caveatForQuestion` ignores caller's language and forces global UI language (HIGH):**
   `AskManager.submitTextAsk` and `startVoiceAsk` accept an explicit `deps.lang` (e.g. `'hi-IN'`)
   for backend AI queries, but `caveatForQuestion` ignores it and calls `tf` using global
   `currentLang`, prepending an English caveat to a Hindi/Gujarati answer.
3. **Reserved ID `'title'` in `addPoint` hijacks `renameLabel` and breaks share exports (HIGH):**
   `addPoint` accepts arbitrary requested IDs without reserving `'title'`. A point with `id: 'title'`
   causes `renameLabel` to rename `scene.title` instead of the point, while `validateShareScene`
   renames the point to `'el_title'` without updating referencing segments, dropping them as
   dangling lines upon link export.
4. **Unchecked 500-point backend cap causes offline/online save divergence and `/ask` 422 (MED):**
   Neither `addPoint` nor `validateSceneInvariants` bounds point counts. Scenes exceeding 500 points
   save cleanly offline, but fail online validation and crash `POST /api/v1/ask` with HTTP 422.
5. **Vacuous property tests and generator blind spots in test suites (MED/LOW):**
   `tests/verify.review.test.ts:222-243` nests finding assertions inside a loop over `findings`; if
   no findings are produced, zero assertions execute and the test passes vacuously. Similarly,
   `tests/verify.angleName.test.ts:63-82` manually injects `angleVertex` and asserts that hardcoded
   `'कोण'` contains no English letters, testing nothing about verifier leakage resistance.

---

## 2. Findings (Highest Severity First)

#### HIGH · frontend/src/screens/Explore.tsx:231,245,1277-1279 · Language switch mid-session leaves stale English announcement in status text and repeat speech
- **Code quote:**
  `frontend/src/screens/Explore.tsx:231,245`:
  ```typescript
  const lastSpokenRef = useRef<string>(announced);
  ...
  const [statusMessage, setStatusMessage] = useState(announced);
  ```
  `frontend/src/screens/Explore.tsx:1277-1279`:
  ```tsx
  <StatusText className="gt-explore__status" spoken={drivers.speech.canSpeak}>
    {statusMessage}
  </StatusText>
  ```
- **Problem:** `announced` is passed into `Explore` as a fixed prop evaluated at entry in the
  previous language. `useState(announced)` and `useRef(announced)` never re-sync when `currentLang`
  changes. When a user or teacher opens `SettingsLauncher` and changes language (e.g. from English
  to Hindi or Gujarati), the status card and repeat speech buffer retain the old English
  announcement (including any Spec Ghost dispute caveat).
- **Concrete failure scenario:** A user opens a diagram with a disputed angle in English. The
  screen announces `"Facts and drawing disagree on angle C. I can't tell which is right."`.
  The user taps Settings and switches language to Hindi (`'hi'`). The confirmation announces
  `"भाषा हिंदी में सेट की गई।"`. The user returns to Explore. The status card still displays
  the full English announcement and caveat. The user speaks or triggers "Repeat" ("पुनः दोहराएं");
  `executeExploreCommand` speaks `lastSpokenRef.current`, causing the Hindi TTS voice
  (`LANG_BCP47['hi']`) to pronounce the raw English caveat sentence.
- **Minimal fix:** In `Explore.tsx`, re-derive the announcement or update `statusMessage` and
  `lastSpokenRef` in a `useEffect` on `currentLang`:
  ```typescript
  useEffect(() => {
    const updated = exploreAnnouncement(sceneRef.current, isRawScene ? 'raw' : 'ai');
    setStatusMessage(updated);
    lastSpokenRef.current = updated;
  }, [currentLang, isRawScene]);
  ```

---

#### HIGH · frontend/src/flow/ask.ts:158-163,279,383 · `caveatForQuestion` ignores `deps.lang` and prepends English caveat to Hindi/Gujarati answer
- **Code quote:**
  `frontend/src/flow/ask.ts:158-163`:
  ```typescript
  const spoken = localizedFindingTarget(finding, (vertex) =>
    tf('verify.angleName', { vertex }),
  );
  const displayTarget = spoken || finding.segmentId || cand;
  return tf('verify.disagree', { name: displayTarget });
  ```
  `frontend/src/flow/ask.ts:364,383-385`:
  ```typescript
  const activeLang = deps.lang ?? LANG_BCP47[getLang()] ?? 'en-IN';
  ...
  const caveat = caveatForQuestion(findings, question);
  const finalAnswer = caveat ? joinAnnouncements([caveat, baseAnswer]) : baseAnswer;
  deps.say(finalAnswer);
  ```
- **Problem:** `AskManager.submitTextAsk` and `startVoiceAsk` accept `deps.lang` and correctly pass
  `activeLang` to the backend `/api/v1/ask` service. However, `caveatForQuestion` takes only
  `(findings, question)` and calls `tf` without specifying language. `tf` falls back to the
  global `currentLang`. If the global UI language is `'en'` while the question is being processed
  in Hindi (`deps.lang = 'hi-IN'`), `caveatForQuestion` formats the caveat in English.
- **Concrete failure scenario:** A student uses voice Ask with Hindi speech recognition active
  (`deps.lang = 'hi-IN'`) while the application UI shell remains on default English. The student
  asks about disputed angle C. The backend returns a localized Hindi explanation for angle C.
  `caveatForQuestion` generates `"Facts and drawing disagree on angle C. I can't tell which is right."`
  in English. Line 384 joins them into `"Facts and drawing disagree on angle C... [Hindi answer]"`.
  The synthesized speech speaks English into the Hindi utterance.
- **Minimal fix:** Pass `lang?: string` into `caveatForQuestion`, or resolve translations using
  `deps.lang`'s base language tag:
  ```typescript
  export function caveatForQuestion(
    findings: readonly VerifyFinding[] | undefined | null,
    question: string,
    lang?: string,
  ): string | null {
    const baseLang = (lang?.split('-')[0]?.toLowerCase() as Lang) || getLang();
    // use translation table for baseLang when resolving verify.angleName and verify.disagree
  ```

---

#### HIGH · frontend/src/core/correct.ts:75,172-174,198 · `addPoint` accepts reserved `'title'` id, corrupting `renameLabel` and dropping segments on share export
- **Code quote:**
  `frontend/src/core/correct.ts:75-77`:
  ```typescript
  // Check scene title
  if (elementId === 'title' || elementId === 'scene:title') {
    return { ...scene, title: trimmed };
  }
  ```
  `frontend/src/core/correct.ts:172-174`:
  ```typescript
  function freeRequestedId(id: string | undefined, used: Set<string>): string | undefined {
    const trimmed = id?.trim();
    return trimmed && !used.has(trimmed) ? trimmed : undefined;
  }
  ```
- **Problem:** `freeRequestedId` checks only that `trimmed` is not in `usedIds(scene)`. It does not
  check reserved identifiers (`'title'`, `'scene:title'`, or prototype names like `'constructor'`,
  `'__proto__'`). If a caller adds a point with requested `id: 'title'`, the point is assigned ID
  `'title'`. When the teacher later renames this point's label, `renameLabel` matches line 75 and
  modifies `scene.title` instead of the point. Furthermore, upon sharing via `validateShareScene`
  (`frontend/src/share/validate.ts:93`), `'title'` is in `RESERVED_IDS` and is sanitized to
  `'el_title'`, but segment endpoints referencing `'title'` remain unsanitized and are dropped as
  dangling segments.
- **Concrete failure scenario:** A teacher adds a missed apex point with ID `'title'`:
  `addPoint(scene, 0.5, 0.2, 'Apex', 'title')` and adds segment `addSegment(scene, 'title', 'B')`.
  The teacher edits the label to `'Top'`. `renameLabel(scene, 'title', 'Top')` changes the diagram
  title to `'Top'`, leaving the point label as `'Apex'`. The teacher opens `#/teach` and exports a
  share link. `validateShareScene` renames the point to `'el_title'` while segment `title-B` still
  looks for `'title'`. Line 380 filters out the segment because `'title'` is not in `pointIds`. The
  connecting line is silently deleted from the student's shared diagram.
- **Minimal fix:** In `freeRequestedId` (`frontend/src/core/correct.ts:172`), disallow reserved IDs:
  ```typescript
  const RESERVED_CORRECT_IDS = new Set(['title', 'scene:title', '__proto__', 'constructor']);
  function freeRequestedId(id: string | undefined, used: Set<string>): string | undefined {
    const trimmed = id?.trim();
    return trimmed && !used.has(trimmed) && !RESERVED_CORRECT_IDS.has(trimmed.toLowerCase())
      ? trimmed
      : undefined;
  }
  ```

---

#### MED · frontend/src/core/correct.ts:193-209,338-360 · `addPoint` lacks upper-bound point limit; scenes >500 points save offline but crash online save and `/ask`
- **Code quote:**
  `frontend/src/core/correct.ts:193-209`:
  ```typescript
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
    ...
    return { ...scene, points: [...(scene.points ?? []), point] };
  }
  ```
  `backend/app/validate.py:41,473`:
  ```python
  MAX_SCENE_POINTS = 500
  ...
  if actual > limit:
      errors.append(f"scene has too many {name} ({actual} > {limit})")
  ```
- **Problem:** `addPoint` and `validateSceneInvariants` enforce no upper bound on point count.
  `backend/app/validate.py:41` and `backend/app/ask.py:55` strictly enforce `MAX_SCENE_POINTS = 500`.
  When a diagram reaches 501 points:
  1. Offline save (`executeCorrectSave` with `isOnline: false`) runs `validateSceneInvariants`,
     which succeeds with `saved-offline`.
  2. Online save calls `requestValidate` (`POST /api/v1/validate`), which fails with
     `"scene has too many points (501 > 500)"`.
  3. Subsequent questions to `POST /api/v1/ask` fail with `ValueError: scene has too many points`
     and HTTP 422.
- **Concrete failure scenario:** A teacher corrects a dense scatter plot or polyline diagram,
  adding points until the point count reaches 501 while offline. The application confirms
  `"Saved without server check"`. When network returns and the student opens the diagram to Ask a
  question, the server returns HTTP 422 and the app speaks `"Server error. You can type your question"`.
  If the teacher tries to save online, save is rejected with `"scene has too many points"`.
- **Minimal fix:** In `validateSceneInvariants` (`frontend/src/core/correct.ts:345`) and `addPoint`,
  cap points at 500 (matching backend `MAX_SCENE_POINTS`):
  ```typescript
  if ((scene.points ?? []).length >= 500) {
    errors.push(`Points count ${(scene.points ?? []).length} exceeds maximum 500`);
  }
  ```

---

#### MED · frontend/src/flow/ask.ts:143-156 · `caveatForQuestion` matches only 3-letter vertex codes ("ADC") and misses questions naming the vertex point ("D")
- **Code quote:**
  `frontend/src/flow/ask.ts:143-146`:
  ```typescript
  if (/^angle\s+([a-zA-Z0-9]+)$/i.test(tVal)) {
    const vertex = tVal.replace(/^angle\s+/i, '').trim();
    if (vertex) candidates.add(vertex);
  }
  ```
- **Problem:** When an angle fact specifies a 3-letter angle such as `"angle ADC = 90 degrees"`,
  `core/verify.ts:666` sets `angleVertex = "ADC"`. `addCandidate` extracts only `"ADC"`. If the
  student asks about vertex `"D"` (which is the middle vertex and geometric corner in `scene.points`),
  the word-boundary regex matches neither `"ADC"` nor `"angle ADC"` against `"D"`.
- **Concrete failure scenario:** A textbook triangle has facts `angle ADC = 45 degrees`, but the
  drawing shows an acute angle of 20°. Spec Ghost flags angle ADC on Explore entry. During exploration,
  the student touches point D, hears `"Point D"`, and asks: `"What is the angle at D?"` or
  `"Is angle D 45 degrees?"`. Because `candidates` only contains `"ADC"`, `caveatForQuestion`
  returns `null`. The student receives an answer without the dispute caveat warning them of the
  drawing discrepancy.
- **Minimal fix:** When `vertex` has length 3, also add the middle vertex character
  (`vertex.charAt(1)`) to `candidates` in `caveatForQuestion`:
  ```typescript
  if (tVal.length === 3 && /^[a-zA-Z0-9]{3}$/.test(tVal)) {
    candidates.add(tVal.charAt(1));
  }
  ```

---

#### MED · backend/app/ask.py:412-420,548-568 · `_is_point_id` requires `isalpha()`, causing numeric-suffix point IDs (`P1`, `P2`, ...) to bypass unknown-point detection in `facts_lookup`
- **Code quote:**
  `backend/app/ask.py:412-420`:
  ```python
  def _is_point_id(word: str) -> bool:
      """True for 1-3 uppercase letters such as 'A', 'AB', 'ABC' (not a unit or 'I'/'A')."""
      return (
          1 <= len(word) <= 3
          and word.isalpha()
          and word.isupper()
          and word not in NON_ID_UPPERCASE
          and word.lower() not in UNIT_TOKENS
      )
  ```
  `backend/app/ask.py:556-568`:
  ```python
  if _is_point_id(w) or (w.isupper() and wl in known_ids):
      (q_ids if wl in known_ids else unknown_ids).add(wl)
  ...
  if unknown_ids:
      return None
  ```
- **Problem:** `nextPointId` in `frontend/src/core/correct.ts:184` generates IDs `P1`, `P2`, `P3`,
  etc., once letters A–Z are exhausted. In `backend/app/ask.py:416`, `_is_point_id` requires
  `word.isalpha()`, which evaluates to `False` for `"P1"` or `"P2"`. If a student asks a question
  mentioning a non-existent point like `"What is at P99?"`, `_is_point_id("P99")` is `False`, so
  `"p99"` is never added to `unknown_ids`. Line 567 (`if unknown_ids: return None`) is bypassed,
  causing `facts_lookup` to attempt matching rather than safely returning `None`.
- **Concrete failure scenario:** A diagram contains points A–Z and P1–P5. The user asks:
  `"What is the length of P99?"`. For an alphabetic point `"Z9"`, `_is_point_id` would fail, but for
  a point like `"Q"`, it would enter `unknown_ids` and return `None`. For `"P99"`, it is treated as
  a regular content word, potentially matching unrelated facts containing the word "length".
- **Minimal fix:** Update `_is_point_id` in `backend/app/ask.py:412` to accept `P` followed by digits:
  ```python
  def _is_point_id(word: str) -> bool:
      if re.fullmatch(r"P\d{1,3}", word):
          return True
      return (
          1 <= len(word) <= 3
          and word.isalpha()
          and word.isupper()
          and word not in NON_ID_UPPERCASE
          and word.lower() not in UNIT_TOKENS
      )
  ```

---

#### MED · frontend/src/core/verify.ts:36-43 · `localizedFindingTarget` falls back to raw English `"angle C"` when `finding.angleVertex` is omitted
- **Code quote:**
  `frontend/src/core/verify.ts:36-43`:
  ```typescript
  export function localizedFindingTarget(
    finding: VerifyFinding,
    angleName: (vertex: string) => string,
  ): string {
    return finding.angleVertex !== undefined
      ? angleName(finding.angleVertex)
      : getFindingTarget(finding);
  }
  ```
- **Problem:** `VerifyFinding.angleVertex` is an optional property (`angleVertex?: string;`). If a
  finding is constructed without `angleVertex` (e.g. from an external tool, serialized finding, or
  custom verifier), `localizedFindingTarget` falls back to `getFindingTarget(finding)`.
  `getFindingTarget` regex-extracts `"angle C"` from `finding.message` and returns it directly,
  leaking the English word `"angle"` into Hindi and Gujarati caveats.
- **Concrete failure scenario:** An angle finding without `angleVertex` is evaluated in Hindi.
  `localizedFindingTarget` returns `"angle C"`. `verifyCaveatForScene` calls `tf('verify.disagree',
  { name: 'angle C' })`, producing `"तथ्य और चित्र angle C पर असहमत हैं। मैं नहीं बता सकता कि कौन सा सही है।"`.
- **Minimal fix:** In `localizedFindingTarget`, if `angleVertex` is undefined, inspect
  `getFindingTarget(finding)` and strip any leading `"angle "` before falling back:
  ```typescript
  export function localizedFindingTarget(
    finding: VerifyFinding,
    angleName: (vertex: string) => string,
  ): string {
    if (finding.angleVertex !== undefined) {
      return angleName(finding.angleVertex);
    }
    const target = getFindingTarget(finding);
    const angleMatch = target.match(/^angle\s+(.+)$/i);
    return angleMatch ? angleName(angleMatch[1]!) : target;
  }
  ```

---

#### MED · frontend/src/core/verify.ts:133-188 · `parseFacts` only matches English regex keywords, silently ignoring Hindi and Gujarati diagram facts
- **Code quote:**
  `frontend/src/core/verify.ts:143-145`:
  ```typescript
  const rightAngleMatch = trimmed.match(
    /(?:(?:angle\s+(?:at\s+(?:vertex\s+)?)?|m∠|∠)\s*([A-Za-z0-9]+)|([A-Za-z0-9]+))\s+is\s+a\s+right\s+angle/i,
  );
  ```
  `frontend/src/core/verify.ts:187-189`:
  ```typescript
  const lengthOfMatch = trimmed.match(
    /^(?:the\s+)?length\s+of\s+(?:(?:the\s+)?(?:side|hypotenuse)\s+)?([A-Za-z0-9_]+)\s*(?:is|=|:)\s*(\d+(?:\.\d+)?)(?:\s*([a-zA-Z]+))?\.?$/i,
  );
  ```
- **Problem:** All fact-parsing regular expressions in `frontend/src/core/verify.ts` are hardcoded
  to English phrases (`"angle"`, `"is a right angle"`, `"length of"`, `"not to scale"`). If a scene
  contains facts generated in Hindi (e.g. `"कोण C = 90°"` or `"चित्र पैमाने पर नहीं है"`) or Gujarati
  (e.g. `"ખૂણો C = 90°"`), `parseFacts` parses zero facts and returns empty results.
- **Concrete failure scenario:** A teacher loads a Gujarati or Hindi textbook worksheet. The facts
  read `"ખૂણો C = 45°"` and `"AC = 4 સેમી"`. Drawn angle C is 90°. Because `parseFacts` does not
  recognize `"ખૂણો"`, `parsed.angles` is empty. Spec Ghost stays silent instead of warning the
  student of the disputed angle.
- **Minimal fix:** Support localized keywords `"कोण"` and `"ખૂણો"` / `"ખૂણા"` in `parseFacts`
  angle regexes.

---

#### LOW · frontend/tests/verify.review.test.ts:233-237 · Requirement 18.2 property test asserts nothing meaningful if `findings` is empty; passes vacuously on broken verifier
- **Code quote:**
  `frontend/tests/verify.review.test.ts:230-237`:
  ```typescript
  (x, y, z, mode) => {
    const result = verifyScene(triangle345([`AB = ${x} cm`, `BC = ${y} cm`, `CA = ${z} cm`, `angle B = ${(x * 7) % 180} degrees`]), { mode });
    for (const f of result.findings) {
      expect(f.message).toMatch(/^Facts and drawing disagree on (AB|BC|CA|angle B)\. I can't tell which is right\.$/);
      expect(f.message).not.toMatch(/verified|correct|trust|checked/i);
    }
    if (result.status !== 'disagree') expect(result.findings).toEqual([]);
  }
  ```
- **Problem:** If `verifyScene` returns `{ status: 'consistent', findings: [] }`, the `for` loop
  runs zero times and `expect(result.findings).toEqual([])` evaluates `expect([]).toEqual([])`.
  The test contains no assertion that `result.status === 'disagree'` or that `findings.length > 0`.
  If a regression in `verifyScene` caused it to never report disagreements, this property test
  would pass with 250 runs without executing a single finding assertion.
- **Concrete failure scenario:** A bug in `verifyScene` causes all mode checks to return `'consistent'`.
  `pnpm test` runs 250 iterations of this test and reports green, masking the verifier outage.
- **Minimal fix:** Assert that at least one disagreement finding is generated when forged values
  exceed tolerance:
  ```typescript
  if (Math.abs(90 - ((x * 7) % 180)) > 15) {
    expect(result.status).toBe('disagree');
    expect(result.findings.length).toBeGreaterThan(0);
  }
  ```

---

#### LOW · frontend/tests/verify.angleName.test.ts:63-82 · Property test artificially forces `angleVertex` and asserts that hardcoded `'कोण'` doesn't match `'angle'`
- **Code quote:**
  `frontend/tests/verify.angleName.test.ts:70-77`:
  ```typescript
  const finding: VerifyFinding = {
    message: `Facts and drawing disagree on angle ${vertex}. I can't tell which is right.`,
    angleVertex: vertex,
  };
  const name = localizedFindingTarget(finding, spokenAngleName);
  expect(name.endsWith(` ${vertex}`)).toBe(true);
  if (lang === 'en') expect(name).toBe(`angle ${vertex}`);
  else expect(name.slice(0, -vertex.length - 1)).not.toMatch(/angle/i);
  ```
- **Problem:** The test claims to verify that English does not leak across 200 arbitrary vertex
  names. However, it manually injects `angleVertex: vertex`. `localizedFindingTarget` simply calls
  `spokenAngleName(vertex)`, returning `'कोण ' + vertex` for Hindi and `'ખૂણા ' + vertex` for
  Gujarati. Line 77 tests only that the static string `'कोण'` or `'ખૂણા'` does not contain the
  English substring `'angle'`. It does not test `verifyScene`, omitted `angleVertex`, or full
  caveat sentences.
- **Concrete failure scenario:** The test gives a false sense of comprehensive property coverage
  for localization leaks while failing to test actual finding extraction from scenes.
- **Minimal fix:** Test scenes through `verifyScene` and `verifyCaveatForScene` across languages
  rather than testing a static string slice.

---

#### LOW · frontend/tests/correct.ghostwriter.prop.test.ts:271-278 · P56 property test generator skips undo assertions when indices collide and omits redo verification for `addSegment`
- **Code quote:**
  `frontend/tests/correct.ghostwriter.prop.test.ts:271-278`:
  ```typescript
  const ids = (withPoint.points ?? []).map((p) => p.id);
  const withSeg = addSegment(withPoint, ids[i % ids.length]!, ids[j % ids.length]!);
  const h2 = historyReducer(h1, { type: 'apply', scene: withSeg });
  if (withSeg === withPoint) {
    expect(h2).toBe(h1); // a no-op adds nothing to undo
  } else {
    const u2 = historyReducer(h2, { type: 'undo' });
    expect(u2.present).toBe(withPoint);
    expect(historyReducer(u2, { type: 'undo' }).present).toBe(scene);
  }
  ```
- **Problem:** When `i % ids.length === j % ids.length` (or the points are already joined),
  `addSegment` returns `withPoint`. The test enters `if (withSeg === withPoint)`, asserting only
  `expect(h2).toBe(h1)`. On these iterations, `undo` for `addSegment` is never tested. Furthermore,
  while `u1` tests `redo`, `u2` never tests `historyReducer(u2, { type: 'redo' })` to verify that
  redoing restores `withSeg`.
- **Concrete failure scenario:** A regression in `redo` handling for segment additions goes
  undetected because `P56` tests redo only on point additions.
- **Minimal fix:** Filter generator inputs so `i % ids.length !== j % ids.length` and assert redo on
  `u2`:
  ```typescript
  expect(historyReducer(u2, { type: 'redo' }).present).toBe(withSeg);
  ```

---

## 3. Meaningless / Weak Test & Property Generator Audit

As mandated by the lane brief, all scoped test suites were audited for tautological assertions,
unreachable failure conditions, and weak mocking:

1. **`tests/verify.review.test.ts:233-237` (Tautological assertion on empty findings):**
   - The loop `for (const f of result.findings)` executes conditionally.
   - If `result.status` is `'consistent'`, `findings` is empty, loop body is skipped, and
     `expect(result.findings).toEqual([])` passes trivially.
2. **`tests/verify.angleName.test.ts:77` (Tautological translation assertion):**
   - Asserts `expect(name.slice(0, -vertex.length - 1)).not.toMatch(/angle/i)` where the slice is
     literally the constant string `'कोण'` or `'ખૂણા'`.
3. **`tests/correct.ghostwriter.prop.test.ts:44-52` (Generator bounds ceiling):**
   - `validSceneArb()` caps point pool size at $26 + 16 = 42$ elements.
   - Maximum point count tested in any property run is 54 points ($42 + 12$).
   - The generator cannot reach the 500-point backend cap or 300-point share cap it claims to guard.
4. **`tests/n2.round4.test.ts:411-467` (Omission of question caveat checks):**
   - Tests assert `verifyCaveatForScene` entry caveats, but omit assertions on `caveatForQuestion`,
     allowing `caveatForQuestion`'s language decoupling bug to pass unnoticed.

---

## 4. Sound Areas (Checked and Verified)

- **Spec Ghost never claims verification or correctness:**  
  `frontend/src/core/verify.ts:677` and `frontend/src/flow/navigation.ts:27-37` return `null` and
  produce zero findings on consistent diagrams. Spec Ghost is completely silent when geometry
  matches facts, never speaking words like "verified", "correct", or "trust the text".
- **Pure immutability in Ghostwriter core (`core/correct.ts`):**  
  `addPoint` and `addSegment` in `frontend/src/core/correct.ts:193-239` never mutate input scenes.
  Invalid coordinates (NaN, inf) and redundant additions (same endpoints, duplicate joins) return
  the identical object reference (`scene === next`), preventing spurious history entries.
- **Cross-element ID collision protection:**  
  `usedIds` in `frontend/src/core/correct.ts:161-168` collects IDs from points, segments, polylines,
  and bars into a unified Set, ensuring auto-generated point IDs (`nextPointId`) and segment IDs
  never collide with existing elements in the scene.
- **Coordinate clamping safety:**  
  `clamp01` in `frontend/src/core/correct.ts:11-15` safely clamps out-of-bounds coordinates to `[0, 1]`
  while rejecting NaN and non-finite floats without throwing or creating corrupt scenes.
- **Angle dispute calculation accuracy:**  
  `computeDrawnAngle` in `frontend/src/core/verify.ts:685-753` scales horizontal differences by
  diagram `aspect`, clamps dot-product ratios to `[-1, 1]` before `math.acos`, handles 1-letter and
  3-letter vertices, and applies an honest 8-degree threshold.
- **Share honesty and unverified badge protection:**  
  `frontend/src/flow/share.ts:15-131` strips leading checkmarks and badge words from teacher names and
  titles, forces the fixed `"Title: "` prefix, words shared links as `"Shared by <name>, not checked"`,
  and includes the mandatory `"not cryptographic proof"` disclaimer in one spoken utterance.

---

## 5. Top Fix Recommendations

1. **Fix Explore mid-session language switch (`Explore.tsx:231,245`):**  
   Add a `useEffect` on `currentLang` in `Explore.tsx` to re-derive `statusMessage` and `lastSpokenRef`
   so visual cards and voice repeat immediately speak the active language.
2. **Wire `deps.lang` into `caveatForQuestion` (`flow/ask.ts:158,383`):**  
   Pass the active query language into `caveatForQuestion` so caveats match the spoken answer
   language instead of falling back to global UI language.
3. **Disallow reserved IDs in `freeRequestedId` (`core/correct.ts:172`):**  
   Reject `'title'`, `'scene:title'`, and prototype names in `freeRequestedId` to prevent
   `renameLabel` corruption and dangling segment drops in `validateShareScene`.
4. **Enforce 500-point cap in `validateSceneInvariants` (`core/correct.ts:345`):**  
   Align frontend validation with backend `MAX_SCENE_POINTS = 500` to prevent saving scenes offline
   that crash online save and `/ask`.
5. **Support middle vertex in 3-letter angle questions (`flow/ask.ts:143`):**  
   Add the middle vertex letter of 3-letter angle facts to `candidates` in `caveatForQuestion` so
   students asking about `"angle D"` receive the caveat for disputed angle `"ADC"`.
