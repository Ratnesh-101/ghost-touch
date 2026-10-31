# T09b report — Voice questions and text fallback (frontend Ask flow)

Builder: **Antigravity (agy)**, 2026-11-01. Followed `AGENTS.md` and user instructions exactly:
- **FRONTEND ONLY**: owned `frontend/**`, never touched `backend/`, `research/`, or deploy files.
- **No Kiro-owned file edited**: untouched `frontend/src/core/**`, `*.prop.test.ts`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, `.kiro/**`.
- **No git state changes**: no add, commit, push, stash, checkout, or branch.
- **No .env access**: no environment variable file opened, read, or modified.
- **Zero new dependencies**: used existing packages in `frontend/node_modules`.
- **All T07 behaviours and tests preserved**.

---

## 1. What was built

### A. Backend API Client (`frontend/src/api/ask.ts`)
- Client for `POST /api/v1/ask` adhering to the same error conventions as `api/scene.ts`.
- `requestAsk(scene, question, lang, options)`: sends JSON payload `{ scene, question: question.trim(), lang }` with header `Content-Type: application/json`.
- Enforces a 12-second client-side timeout (`ASK_TIMEOUT_MS = 12_000`) and supports cancellation via `AbortSignal`.
- Strongly typed `AskResponse` (`answer: string`, `source: "ai" | "facts" | "unknown"`).
- `parseAskResponse` validates response structure; rejects invalid formats with `AskRequestError('bad-response')`.

### B. Pure Flow Logic & Single-Flight Controller (`frontend/src/flow/ask.ts`)
- Pure, unit-tested logic without DOM dependencies.
- Sequence strictly follows the specification:
  1. Listening cue: `audio.beep(LISTENING_BEEP_HZ, LISTENING_BEEP_MS)` (660 Hz, 150 ms)
  2. `speech.listen(lang)`
  3. `POST /api/v1/ask` (`requestAsk`)
  4. `speech.speak(answer, lang)`
- **Failure lines offering text fallback**:
  - `no-speech` → `ask.errorNoSpeech`: *"No speech heard. You can type your question instead."*
  - `denied` → `ask.errorDenied`: *"Microphone permission denied. You can type your question instead."*
  - `timeout` → `ask.errorTimeout`: *"Request timed out. You can type your question instead."*
  - `server error` (HTTP / bad response) → `ask.errorServer`: *"Server error. You can type your question instead."*
  - `offline / network error` → `ask.errorOffline`: *"Network error. Check your connection or type your question."*
  - `unsupported` → `ask.errorUnsupported`: *"Speech recognition is not supported. You can type your question."*
  - Never silence: every failure line is spoken aloud, displayed in status text, and automatically reveals the text box.
- **Concurrency & Resource Management (`AskManager`)**:
  - Single-flight: ignores subsequent triggers while busy and speaks `ask.busy`: *"Still answering the last question. Please wait."*
  - Timers and abort controllers cleared on every exit path.
  - Screen unmount aborts in-flight network requests immediately (`abort()`) without speaking dangling answers.
- **Text fallback (`submitTextAsk`)**:
  - Validates trimmed non-empty question (speaks `ask.errorEmpty` if blank).
  - Sends request, speaks answer, and updates status text.

### C. Two-Finger Long-Press Detector (`frontend/src/flow/explore.ts`)
- `checkTwoFingerLongPress(p1, p2, now, minDurationMs, maxMovePx)`:
  - Fires when two pointers are held for $\ge$ 600 ms (`TWO_FINGER_LONG_PRESS_MS = 600`) without either pointer moving more than 20 px (`TWO_FINGER_MAX_MOVE_PX = 20`).
  - Pure function with unit test suite in `frontend/tests/flow.explore.test.ts`.
  - Zero interference with single-finger hold (timer only arms when exactly 2 pointers are active; cancelled if movement exceeds 20 px, or on pointer lift/cancel).
  - Preserves T07 two-finger swipe down exit gesture (downward swipe cancels long-press and exits to Capture).

### D. Explore Screen UI & Accessibility (`frontend/src/screens/Explore.tsx`)
- **Ask Button**:
  - `AccessibleButton` outside the touch canvas, reachable by TalkBack swipe navigation.
  - Sized to $\ge 48\times 48$ CSS px (`min-height: 52px; flex: 1`).
  - Calls `handleVoiceAsk` on activation.
  - Disabled while busy (`isBusy`).
- **Text Fallback Form**:
  - Displayed if speech recognition is unsupported (`drivers.speech.canListen === false`) or upon any listen failure.
  - Features an accessible text input (`<label htmlFor="gt-ask-input" className="gt-visually-hidden">`) and `AccessibleButton` Send button ($\ge 48$ px tall).
- **TalkBack & Focus Management**:
  - Answer spoken via `drivers.speech.speak(answer)` and shown visibly via `StatusText`.
  - When speech is supported, `StatusText` renders without live region to eliminate TalkBack double reading (Requirement 13.7).
  - Focus returns to the Ask button (`askButtonRef.current?.focus()`) after speaking finishes.
  - On unmount, clears long-press timer and aborts pending Ask request.

### E. Translations & Styles
- Added keys to `frontend/src/i18n/index.ts`:
  - `ask.send`, `ask.listening`, `ask.thinking`, `ask.busy`, `ask.errorNoSpeech`, `ask.errorDenied`, `ask.errorTimeout`, `ask.errorServer`, `ask.errorOffline`, `ask.errorFailed`, `ask.errorUnsupported`, `ask.errorEmpty`.
- Added CSS classes in `frontend/src/styles/global.css`:
  - `.gt-explore__actions`, `.gt-explore__ask`, `.gt-explore__ask-form`, `.gt-explore__ask-input`, `.gt-explore__send`.

---

## 2. Verification and Proof

All commands executed from `frontend/`:

### A. TypeScript Typecheck
```powershell
powershell -Command "Set-Location frontend; npx tsc --noEmit"
```
**Result**: Clean (0 errors, exit code 0).

### B. Unit & Component Test Suite
```powershell
powershell -Command "Set-Location frontend; npm test"
```
**Result**:
- **19 test files passed** (194 tests passed, 0 failed).
- New test suites:
  - `tests/api.ask.test.ts` (9 tests passed): success with each source kind, 422 HTTP failure, timeout abort, external signal abort, network error, malformed JSON, ASK_TIMEOUT_MS constant.
  - `tests/flow.ask.test.ts` (15 tests passed): happy path order (beep -> listen -> request -> say), failure lines (no-speech, denied, timeout, server, offline, unsupported), double trigger while busy, abort during listen, abort during backend request, text fallback valid and empty.
  - `tests/flow.explore.test.ts` (27 tests passed): two-finger long-press firing $\ge 600$ ms, rejecting $< 600$ ms, rejecting drift $> 20$ px for pointer 1 or pointer 2.
  - `tests/screens.render.test.ts` (11 tests passed): Ask button rendered in DOM outside canvas, text fallback input + Send button rendered when `canListen` is false, $\ge 48$ px touch targets for ask and send buttons.

### C. Production Build
```powershell
powershell -Command "Set-Location frontend; npm run build"
```
**Result**:
- Clean build in 1.25s.
- Main JS bundle: 180.98 kB (58.79 kB gzip).
- CSS bundle: 4.07 kB (1.23 kB gzip).
- PWA manifest + precache (12 entries, 204.76 KiB) generated.

---

## 3. Files Touched

### Created:
- `frontend/src/api/ask.ts`
- `frontend/src/flow/ask.ts`
- `frontend/tests/api.ask.test.ts`
- `frontend/tests/flow.ask.test.ts`
- `docs/handoffs/T09b-report.md`

### Modified:
- `frontend/src/flow/explore.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/src/i18n/index.ts`
- `frontend/src/styles/global.css`
- `frontend/tests/flow.explore.test.ts`
- `frontend/tests/screens.render.test.ts`

### Untouched (Kiro-Owned):
- `frontend/src/core/**`
- `*.prop.test.ts`
- `backend/app/schema.py`
- `backend/app/validate.py`
- `frontend/src/types/scene.gen.ts`
- `.kiro/**`

---

## 4. BUILD_LOG Text to Append

```markdown
### 2026-11-01 — Task 9.2: Frontend Ask flow (voice questions and text fallback)
- **Tool**: Antigravity
- **Scope**: `frontend/**` only (Part B of Task 9).
- **Built**:
  - `frontend/src/api/ask.ts`: `requestAsk` client for `POST /api/v1/ask` with 12 s timeout, AbortSignal support, and error mapping.
  - `frontend/src/flow/ask.ts`: Pure Ask sequence (cue beep -> listen -> request -> speak), failure lines offering text fallback, single-flight AskManager, abort on unmount, and text fallback submit.
  - `frontend/src/flow/explore.ts`: `checkTwoFingerLongPress` (600 ms, $\le 20$ px move) without single-finger interference.
  - `frontend/src/screens/Explore.tsx`: Added Ask button and text fallback input/Send button; wired two-finger long-press; return focus to Ask button after speaking; no TalkBack double reading.
  - `frontend/src/i18n/index.ts`: Added strings for Ask cues, status, errors, and fallbacks.
  - `frontend/src/styles/global.css`: Accessible styles with $\ge 48$ px touch targets.
  - Unit tests in `frontend/tests/api.ask.test.ts`, `frontend/tests/flow.ask.test.ts`, `frontend/tests/flow.explore.test.ts`, and `frontend/tests/screens.render.test.ts`.
- **Broke**: None; all 163 preexisting tests pass, and 31 new tests pass (194 tests total across 19 files).
- **Files touched**:
  - Created: `frontend/src/api/ask.ts`, `frontend/src/flow/ask.ts`, `frontend/tests/api.ask.test.ts`, `frontend/tests/flow.ask.test.ts`, `docs/handoffs/T09b-report.md`.
  - Modified: `frontend/src/flow/explore.ts`, `frontend/src/screens/Explore.tsx`, `frontend/src/i18n/index.ts`, `frontend/src/styles/global.css`, `frontend/tests/flow.explore.test.ts`, `frontend/tests/screens.render.test.ts`.
```
