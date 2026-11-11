# Audit: navigation / flow / API / drivers (Kiro)

Scope read: App.tsx, screens/{Start,Capture,SavedDiagrams,Correct,Teach,ShareError}.tsx, flow/*, api/*, drivers/{diagramStore,navigation,camera,pdf,haptics,audio,hashRoute,index}.ts, share/codec.ts, i18n/index.ts, core/savedDiagrams.ts (titles).
Checks run: vitest on flow.capture, saved.flow, correct.back, z3.appMergedFixes, share.open.routing (69 passed). Nothing was run in a real browser; findings that depend on browser history/hashchange order are reasoned from code and marked as such in "confidence".

Checked and found clean (no finding):
- i18n: en/hi/gu each have 339 keys, no missing keys, no placeholder mismatches between languages, and every literal `t('...')`/`tf('...')` key in `frontend/src` exists in the English table.
- requestScene retry/timeout paths (502/503/429, 504, abort, offline) each end in a spoken message; the progress tone is stopped in `finally`.
- Saved-diagram atomic path (`putWithEviction`) rolls back the eviction if the put fails with a request error.
- Canvas sizing (`flow/canvasSize.ts`), fallback haptic driver and buzz sink, TalkBack feature list (`flow/a11yFeatures.ts`): no defect found.

---

## FLOW-01
- Severity: Medium
- File: frontend/src/screens/Correct.tsx:589 (`handleSave`) with frontend/src/App.tsx:611 (`handleSaveCorrect`)
- Problem: A save that is still validating when the user leaves Correct with the system Back still calls `onSave` after Correct is gone, and App applies it without checking which screen is showing.
- Failing scenario: Teacher edits a point, taps Save (the validate call can take up to 10 s, VALIDATE_TIMEOUT_MS, on a cold Render backend). While "Validating diagram…" is showing they press Android Back. The Cancel button is disabled while saving, but Back is not. They confirm "discard unsaved changes", and Explore appears with the original scene. When the validate call resolves, `onSave` fires: App speaks "Corrections saved…", forces the view to Explore with the edited scene, and writes the edited scene into the saved list. The edits the user just discarded are saved. If the user had moved on to Capture, they are pulled back to Explore.
- Suggested failing test: `correct.lateSave.test.tsx` — render App on the Correct screen with a deferred `requestValidate`, press Save, fire popstate and confirm the leave, then resolve the validate promise. Assert that `onSave` is not called, the view is not changed, and `diagramStore.put` is not called.
- Fix: agy (screens/Correct.tsx and App.tsx). Add an "active/unmounted" ref in Correct, or have handleSaveCorrect ignore calls when `viewRef.current.screen !== 'correct'`. Pass an AbortSignal to `requestValidate`.
- Confidence: high

## FLOW-02
- Severity: Medium
- File: frontend/src/screens/Explore.tsx:437 (`handleExit`: `leaveExploreEntry(); onBack();`) with frontend/src/App.tsx:582 (`handleBack`) and frontend/src/drivers/hashRoute.ts:57 (`clearHash`)
- Problem: On a shared diagram, the on-screen Back button (and the two-finger swipe down) queues `history.back()` and then runs `clearHash()`, which uses `replaceState` on the current entry; the queued back then lands on the first history entry, which still has `#s=…`, so a real `hashchange` reopens the share gate.
- Failing scenario: A student opens `/#s=PAYLOAD`, taps "Open the shared diagram", then taps Back in Explore. History is entry0 (`#s=…`), entry1 (the Explore entry, which `pushExploreEntry` pushed with the same URL). `clearHash` rewrites only entry1's URL, and the queued `history.back()` then moves to entry0. The fragment changes from empty to `#s=PAYLOAD`, `hashchange` fires, and App's hash effect sets the view to `shareGate`. The student hears nothing about Start. The gate has no Back control, and the system Back then closes the app. System Back is fine because it lands on entry0 and then `clearHash` rewrites that entry. Only the UI Back and the swipe are affected.
- Suggested failing test: `share.backFromExplore.test.tsx` — with a fake history stack that models `back()` as asynchronous and fires `hashchange` when the fragment differs, open a shared link, tap the Explore Back button, flush timers, and assert that the view is `start` and `location.hash === ''`. Not run in a real browser.
- Fix: agy. For the fromShare case, wait for the popstate before clearing the hash. Alternatively, call `clearHash` only after the suppressed popstate has arrived, or call `history.replaceState` on entry0 by using `history.go(-1)` first.
- Confidence: medium (history and hashchange ordering is reasoned from the code, not observed)

## FLOW-03
- Severity: Medium
- File: frontend/src/App.tsx:263 (initial `useState<View>`), frontend/src/screens/ShareError.tsx:41
- Problem: When a broken share link is the first page load, nothing is spoken and no element is focused, and the message is in a plain `<p>` with no live region.
- Failing scenario: A student taps a corrupted or too-long share link. The initial view is `shareError`, but `speakShareAnnouncements` is only called from the later hashchange effect, so nothing is spoken on a cold load. Chrome would also block speech without a user activation. `ShareError` passes `spoken={canSpeak}` (true on Chrome) to `StatusText`, so it renders without `role="status"`. `ShareGate` handles the same cold-open problem by focusing its button. `ShareError` focuses nothing, and its only focusable control is "Go to start". With TalkBack the student hears the heading or the button, but never why the link failed.
- Suggested failing test: `shareError.coldOpen.test.tsx` — render App with `location.hash = '#s=garbage'` and the share flag on. Assert that either an element with `role` status/alert contains the error message, or `document.activeElement` is the heading or the message element with `tabIndex=-1` and the message as its text.
- Fix: agy. Focus the title or message on mount, or render `role="alert"` when the initial view is `shareError`.
- Confidence: medium

## FLOW-04
- Severity: Medium
- File: frontend/src/App.tsx:551 (`handleOpenSharedDiagram`)
- Problem: Opening a shared diagram does not reset `lastSavedDiagramId` or `photoUrl`, unlike `handleScene` and `handleSavedOpen`.
- Failing scenario: With the app running, the user photographs diagram A. It is saved and `lastSavedDiagramId = A`. A share link then arrives as a hash change in the same page (App has a hash-change route to `shareGate`). They open it, tap Correct on the shared diagram, and Save. `saveDiagram(scene)` has no explicit target, so it reads `lastSavedDiagramId` and overwrites saved entry A (title, scene and thumbnail) with the shared diagram. The Correct overlay also still shows A's photo under the shared scene, because `photoUrl` was never cleared.
- Suggested failing test: `app.shareOpen.resets.test.tsx` — save a captured scene, drive a hash change to a valid share link, open it, press Correct and Save. Assert that the original saved entry is unchanged and a new entry was created. Also assert the Correct canvas receives `photoUrl === null`.
- Fix: agy. In `handleOpenSharedDiagram` call `updatePhotoUrl(null)` and set `lastSavedDiagramId.current = null`.
- Confidence: medium (needs a hash change inside a running app; a cold open starts with null refs)

## FLOW-05
- Severity: Medium
- File: frontend/src/screens/Teach.tsx:556 (`handleLoadScene`), components/teach/LoadModal.tsx:89, 168, 229
- Problem: Loading a scene in the Teacher editor replaces the history and the name/note with no confirmation, even when there are unsaved edits.
- Failing scenario: A teacher adds three points and edits labels (dirty). They tap Load and choose a saved diagram or paste a link. `setHistory(createHistory(newScene))` discards the edits and the undo stack, and `cleanBaseline` is reset so the editor reports clean. Back and Exit ask for confirmation in this state, but Load does not.
- Suggested failing test: `teach.loadDirty.test.tsx` — make an edit, trigger `onLoadScene`, and assert `window.confirm` (with `teach.confirmLeave`-style text) was called and that declining keeps `history.present`.
- Fix: agy.
- Confidence: high

## FLOW-06
- Severity: Low
- File: frontend/src/screens/SavedDiagrams.tsx:94 and :100/:105 (`handleDeleteRequest`, `handleCancelDelete`)
- Problem: The focused Delete or Cancel button is unmounted when the confirm state toggles, so focus drops to the page body.
- Failing scenario: With 15 saved diagrams a TalkBack user double-taps "Delete X". The Delete button is replaced by Confirm/Cancel in a different element tree, so focus is lost and the user has to swipe from the top of the list to reach Confirm. The same happens after Cancel. After a confirmed delete the code does move focus to the heading, so only the request and cancel steps are missing.
- Suggested failing test: In `saved.focus.test.tsx`, click Delete, then assert `document.activeElement` is the Confirm or Cancel button of that entry. Click Cancel and assert that focus is on that entry's Delete button.
- Fix: agy.
- Confidence: medium

## FLOW-07
- Severity: Low
- File: frontend/src/drivers/pdf.ts:143
- Problem: When the 30 s PDF timeout fires while pdf.js is still parsing or rendering, the catch block rethrows the raw pdf.js error instead of `PdfError('timeout')`.
- Failing scenario: A heavy PDF is chosen. The timer calls `loadingTask.destroy()` and `renderTask.cancel()`, which reject the pending promise with a pdf.js error. The catch does `if (timedOut || err instanceof PdfError) throw err;`, so `captureErrorMessage` does not recognise it and the user hears the generic "Something went wrong…" rather than `capture.errorPdfTimeout` ("took too long, try a screenshot"). The timeout message can only appear if an await happens to resolve after the timer.
- Suggested failing test: In the PDF driver tests, use a fake loader whose `getDocument().promise` never resolves, with `timeoutMs: 10`; `loadingTask.destroy()` rejects it. Assert `renderFirstPage` rejects with `PdfError` and `reason === 'timeout'`.
- Fix: agy (change the line to `if (timedOut) throw new PdfError('timeout')`).
- Confidence: high

## FLOW-08
- Severity: Low
- File: frontend/src/core/savedDiagrams.ts:87 (`savedTitle`)
- Problem: For English (and any language without KIND_NAMES) an untitled scene is spoken and shown on the Saved screen as its raw slug, e.g. `bar_chart` or `function_graph: A, B`, while Explore uses the localized names from `t('kind.*')`.
- Failing scenario: The user saves an untitled bar chart in English. The Saved list reads "bar underscore chart" (TalkBack reads underscores variably), and opening it announces "bar_chart. Double-tap and hold…" instead of "Bar chart…". The list also differs from Explore's own announcement for the same diagram.
- Suggested failing test: `savedTitle({kind:'bar_chart'}, 'en')` should not contain `_`, and should equal `sceneName(scene)` from `flow/navigation.ts`.
- Fix: Kiro (core/savedDiagrams.ts; it can take a kind-name lookup like `sceneName` does).
- Confidence: high

## FLOW-09
- Severity: Low
- File: frontend/src/screens/SavedDiagrams.tsx:88, 95, 133, 134
- Problem: Title substitution uses `String.replace('{title}', title)` with a string replacement, so `$&`, `$'`, `` $` `` and `$$` in a title are interpreted as replacement patterns.
- Failing scenario: A diagram titled "Revenue ($$)" is announced as "Opening Revenue ($)." The rest of the code base (`flow/saved.ts`, `flow/share.ts`) already uses the function-replacer form `() => title`; this screen was missed. The same pattern with `{label}` exists in Teach.tsx and Explore.tsx (lines 414, 947).
- Suggested failing test: Render Saved with an entry titled `a$&b`, click Open, and assert the spoken text equals `Opening a$&b.`
- Fix: agy.
- Confidence: high (the behaviour of `String.replace` is certain; real titles with these sequences are rare)

---

SUMMARY: 0 high, 5 medium, 4 low
AUDIT-DONE
