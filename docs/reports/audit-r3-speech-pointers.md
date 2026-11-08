# Round-3 re-audit: speech joins, SavedDiagrams, pointers (Claude Sonnet subagent, read-only, 2026-11-08)
Scope: commit 8f60415 (`flow/explore.ts`, `flow/saved.ts`, `Explore.tsx`, `SavedDiagrams.tsx`, `speech.ts`, `core/hitTest.ts`). Code read only; nothing run. **No high-severity defects.** Not re-verified by the supervisor; verify before fixing.

| ID | Sev | Finding | Fix | Test |
|---|---|---|---|---|
| R3-01 | MED CONFIRMED | `Explore.tsx` ~L934-962 (`handlePointerDown`): the centre announcement calls `speech.speak(explore.centre)` directly, then `runEffects` speaks again for a vertex/bar hit on the same touch; the driver cancels on every speak, so "centre" is lost (same bug class CORE-02 fixed). | Put the centre message into the merge: `mergeAnnouncements([centreMsg, ...axisCrossings], effects)`; set `lastSpokenRef` from the merged text. | pointer-down at canvas centre on a vertex: exactly one `speak` containing both |
| R3-02 | LOW-MED CONFIRMED (partly pre-existing) | `lastSpokenRef` only updates when an axis crossing happened (~L958-961, 1027-1030, 1088-1091); vertex-only or bar-only speech leaves it stale, so "repeat" (`commands.ts:625`) says an old message. | update unconditionally from the speak effect | `lastSpokenRef` equals the vertex label after a vertex-only move |
| R3-03 | LOW CONFIRMED | Three copy-pasted move paths in Explore.tsx (pointer-down, move, promotion) invite divergence (R3-01/02). | extract `applyMoveResult(moveResult, lang)` | |
| R3-04 | LOW CONFIRMED | `handleConfirmDelete` (SavedDiagrams.tsx ~L87-99) has no mounted guard after `await`: leaving during a pending delete still speaks over the new screen; `entries` read from the closure after the await. | `activeRef` set false on unmount; early return; functional `setEntries` | unmount during pending delete: `speak` not called |
| R3-05 | LOW CONFIRMED | `loadSavedList` joins titles with ". " even when a title ends in "." or danda ("..", "।."). | use `joinAnnouncements` | |
| R3-06 | LOW CONFIRMED | `joinAnnouncements` (explore.ts L115-128) uses an ASCII ". " separator in every language; acceptable for TTS pause; danda check present. | optional per-language separator | |
| R3-07 | LOW SUSPECTED | `hitTest.findBar` does not filter a bar with `value: NaN`; spoken "label, NaN". Backend validation probably blocks it. | skip bars where `!Number.isFinite(bar.value)` | |
| R3-08 | INFO | Focus after delete (`headingRef.focus()` right after `say`) may make TalkBack read the heading over the delete message; needs a device check. | UNVERIFIED | |

Sound: `mergeAnnouncements` loses no text, keeps order (axis crossings then engine speech), keeps vibrate/tone order, skips blanks, does not dedupe deliberately; `loadSavedList` under StrictMode (first mount's result dropped, second loads; dev-only duplicate `list()`); `deletedAnnouncement` single utterance with `{title}` placeholders in en/hi/gu; `speech.noVoiceNotice` in en/hi/gu with `{lang}`; the pointer-capture catch wraps only `setPointerCapture`; hitTest NaN guarded for vertices and every line type (segments, polylines, axes, bar edges), `findBar` comparisons false for NaN, `distToSegment` safe for zero-length; merge helpers already covered by `round2.announce.prop.test.ts` / `round2.sources.test.ts`.

Priority: R3-01, R3-02, R3-04 (small, Explore/Saved). Fix lane: `h7-explore-fixes`.
