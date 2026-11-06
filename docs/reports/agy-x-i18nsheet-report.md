# Report: Lane x-i18nsheet — Native-speaker review sheet for Hindi and Gujarati strings

**Lane:** x-i18nsheet
**Date:** 2026-11-06
**Agent:** Antigravity (agy)
**Status:** Completed

---

## 1. Executive Summary

A comprehensive native-speaker review package was produced for the Hindi (`hi`) and Gujarati (`gu`) machine-translated UI strings in `frontend/src/i18n/index.ts`:
- **Markdown Review Sheet:** `docs/user-test/translation-review.md` (structured by screen/group with instructions, tables, spoken indicators, and suspicious string hints).
- **Spreadsheet Review File:** `docs/user-test/translation-review.csv` (UTF-8, header row, quoted fields, matching rows).

No source code strings or tuning values were changed.

---

## 2. Key Count Verification & Language Parity

Every string table in `frontend/src/i18n/index.ts` was analyzed key-by-key:

| Language | Total Key Count | Parity with English (`en`) |
| :--- | :---: | :---: |
| **English (`en`)** | **183** | Baseline |
| **Hindi (`hi`)** | **183** | **Equal (183 / 183)** |
| **Gujarati (`gu`)** | **183** | **Equal (183 / 183)** |

**Confirmation:** Key counts for Hindi (`hi`) and Gujarati (`gu`) exactly equal English (`en`). All 183 keys exist across all three languages with identical names and group ordering.

---

## 3. Screen / Prefix Grouping Breakdown

The 183 keys are organized into 17 logical screen/component groups derived from key prefixes:

1. `app.*` (2 keys): Application name & core tagline
2. `start.*` (4 keys): Start screen prompt, gestures, vibration status
3. `capture.*` (22 keys): Photo/image upload, sample diagrams, PDF & error notifications
4. `ask.*` (15 keys): AI voice & text queries, error fallbacks, status announcements
5. `raw.*` (1 key): Raw mode diagram failure announcement
6. `common.*` (2 keys): Shared cross-screen buttons & browser compatibility warnings
7. `explore.*` (8 keys): Relative exploration gestures, axis crossing announcements, canvas hints
8. `correct.*` (21 keys): Teacher correction mode, selections, edits, validation notices
9. `saved.*` (21 keys): Saved diagram management, pin/unpin, deletion confirmations
10. `rate.*` (7 keys): Speech rate options (slow, normal, fast) & spoken confirmations
11. `lang.*` (7 keys): Language selector labels & spoken confirmations
12. `speech.*` (1 key): Missing system voice fallback notice
13. `commands.*` (11 keys): Voice command triggers & spoken response templates
14. `pos.*` (9 keys): Coarse spatial positions interpolated into voice command announcements
15. `svara.*` (1 key): Creature voice tap-to-skip button label
16. `debug.*` (27 keys): Diagnostic panel strings and spoken test utterance
17. `lab.*` (24 keys): Frankenstein laboratory theme headings, organ tiles, and specimen jar labels

---

## 4. Spoken String Identification (`(spoken)`)

Every call site of `drivers.speech.speak(...)`, `deps.say(...)`, and `speak(...)` across `frontend/src` was traced to distinguish spoken strings from visual-only controls:

- **Spoken Keys:**
  - `app.name`: Spoken dynamically as fallback diagram title in `commands.describe` (`commands.ts`).
  - `start.intro`: Spoken on mount in `Start.tsx` via `speakIntro`.
  - `start.noVibration`: Spoken on initial tap in `handleStartTap` when vibration is unsupported.
  - `capture.prompt`: Spoken on arrival in Capture screen and when returning from Explore/Saved.
  - `capture.reading`: Spoken during diagram upload and image processing.
  - `capture.error`, `capture.errorSample`, `capture.errorType`, `capture.errorSize`, `capture.errorSizeCamera`, `capture.busy`, `capture.errorEmpty`, `capture.firstPagePdf`, `capture.errorPdfPassword`, `capture.errorPdfInvalid`, `capture.errorPdfEmpty`, `capture.errorPdfTimeout`, `capture.errorPdf`: All spoken as error/status feedback in `flow/capture.ts` and `Capture.tsx`.
  - `ask.thinking`, `ask.busy`, `ask.errorNoSpeech`, `ask.errorDenied`, `ask.errorTimeout`, `ask.errorListenTimeout`, `ask.errorServer`, `ask.errorOffline`, `ask.errorFailed`, `ask.errorUnsupported`, `ask.errorEmpty`: All spoken aloud in `flow/ask.ts` and `Explore.tsx`.
  - `raw.announce`: Spoken when opening an unparsed diagram in Raw Mode (`flow/navigation.ts`).
  - `explore.gestureHint`, `explore.backHint`: Spoken upon entering Explore screen.
  - `explore.centre`: Spoken when cursor crosses centre tick on first hold.
  - `explore.xAxis`, `explore.yAxis`: Spoken when crossing coordinate axes.
  - `correct.intro`: Spoken upon entering Teacher Correction mode.
  - `correct.undo`, `correct.redo`, `correct.pointMoved`, `correct.pointDeleted`, `correct.segmentDeleted`, `correct.labelUpdated`, `correct.labelEmpty`, `correct.validating`, `correct.saved`, `correct.validationFailed`, `correct.noSelection`, `correct.selectedPoint`, `correct.selectedSegment`: All spoken aloud to announce editing states in `Correct.tsx`.
  - `saved.heading`, `saved.empty`, `saved.opened`, `saved.deleted`, `saved.pinned.announced`, `saved.unpinned.announced`, `saved.errorSave`, `saved.errorStorageUnavailable`, `saved.errorAllPinned`, `saved.errorLoad`, `saved.errorDelete`, `saved.deleteConfirm`, `saved.cancelled`: All spoken aloud in `SavedDiagrams.tsx` and `App.tsx`.
  - `rate.slow`, `rate.normal`, `rate.fast`: Spoken aloud upon focus in `RateSelector.tsx`.
  - `rate.setSlow`, `rate.setNormal`, `rate.setFast`: Spoken aloud upon selection in `RateSelector.tsx` and via voice commands.
  - `lang.changedEn`, `lang.changedHi`, `lang.changedGu`: Spoken confirmation in the selected language upon switching.
  - `commands.help`, `commands.noSpoken`, `commands.noPoints`, `commands.cornerAnnounce`, `commands.whereNearVertex`, `commands.whereEmpty`, `commands.describe`, `commands.noFacts`, `commands.unrecognized`: Spoken responses for voice commands in `commands.ts`.
  - `pos.centre`, `pos.topLeft`, `pos.topRight`, `pos.bottomLeft`, `pos.bottomRight`, `pos.top`, `pos.bottom`, `pos.left`, `pos.right`: Coarse location tokens interpolated into spoken voice command responses.
  - `debug.sample`: Spoken when pressing "Speak sample" on the debug screen.
  - `lab.settings.opened`, `lab.settings.closed`: Spoken when modal Lab Settings sheet opens/closes.

- **Unmarked / Visual-only Keys:**
  Keys that only appear as visible button labels, static headings, or input placeholders (e.g. `capture.takePhoto`, `explore.correct`, `correct.delete`, `svara.skip`, `lab.organ.nerves.title`) are left unmarked. Screen readers (TalkBack) read them when navigated to, but they are not triggered through the app's speech synthesis engine.

---

## 5. Review Hints & Suspicious Strings

A dedicated section was included in `docs/user-test/translation-review.md` flagging the following patterns for native reviewers:
1. **Identical English String in Indic Tables:** `lang.changedEn` is `"Language set to English."` in both Hindi and Gujarati tables.
2. **Mixed Script Usage:**
   - "Android" and "Chrome" appear in Devanagari script in Hindi (`एंड्रॉइड पर क्रोम`) but in Latin script in Gujarati (`Android પર Chrome`).
   - "API" appears in Devanagari in Hindi (`एपीआई`) but in Latin script in Gujarati (`API`).
   - "AI" appears in Devanagari in Hindi (`एआई`) but in Latin script in Gujarati (`AI`).
3. **Inconsistent Vocabulary:**
   - Hindi alternates between `चित्र` (general picture/image) and `आरेख` (technical diagram).
   - Gujarati uses pure Gujarati `સાચવો` for saving edits, but transliterated `સેવ` for saved diagram files.
   - Gujarati uses `કાઢી નાખો` for deleting elements, but `ભૂંસો` (literally "erase/wipe") for deleting saved files.
   - Creature is translated as `जीव` in Hindi and `પ્રાણી` (animal) in Gujarati.
4. **Number / Fraction Phrasing:**
   - In `commands.cornerAnnounce`, English says `"Corner {index} of {total}:"`, whereas Hindi/Gujarati use slash notation `"{index}/{total}"`, which speech engines often pronounce awkwardly as "slash" or "divided by".
5. **Lengthy Spoken Sentences:**
   - Strings such as `start.noVibration`, `explore.gestureHint`, and `correct.intro` exceed 80-100 characters and may strain auditory working memory for blind students.

---

## 6. Files Created and Modified

- `docs/reports/agy-x-i18nsheet-report.md` (Created - this report)
- `docs/user-test/translation-review.md` (Created - native speaker review guide and markdown tables)
- `docs/user-test/translation-review.csv` (Created - spreadsheet-ready CSV with all 183 rows)
- `docs/BUILD_LOG.md` (Updated - log entry added)

No source code files were edited.

---

## 7. Definition of Done & Verification

- [x] `docs/reports/agy-x-i18nsheet-report.md` created first.
- [x] No tests executed, per brief instructions ("Run no tests").
- [x] Total key count per language verified: en = 183, hi = 183, gu = 183.
- [x] `docs/user-test/translation-review.md` created with reviewer instructions, tables by screen/group, placeholder preservation notes, spoken markers, and suspicious strings.
- [x] `docs/user-test/translation-review.csv` created with matching UTF-8 quoted fields.
- [x] `docs/BUILD_LOG.md` updated.

---

## Commit groups

One commit:
- `docs: add Hindi and Gujarati translation review sheet`
