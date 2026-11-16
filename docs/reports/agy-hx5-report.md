# Lane HX5 Report — Ask must survive a sleeping server

**Builder:** Antigravity (agy)  
**Lane:** `hx5`  
**Date:** 2026-11-16  

---

## 1. Summary of Changes

Lane `hx5` ensures that diagram questions (Ask flow) survive a sleeping or cold-starting backend without failing prematurely or leaving the user in silence:

1. **`frontend/src/api/health.ts`**:
   - Replaced once-per-load boolean guard with a timestamp-based cooldown (`lastWarmAttemptAt`).
   - `warmBackend()` runs when it has never run or when the last attempt is older than 10 minutes (`WARM_INTERVAL_MS = 600_000`).
   - Supported injectable clock (`now` / `clock` options in `WarmBackendOptions`).
   - Preserved `resetWarmGuardForTesting()` and `isBackendWarmed(now?)`.

2. **`frontend/src/api/ask.ts`**:
   - Updated client request timeout: `ASK_TIMEOUT_MS = 17_000` (up from 12_000 ms).
   - Added `'busy'` to `AskFailure` union.
   - Enhanced `AskRequestError` constructor to accept optional `retryAfterSeconds?: number`.
   - Reused `parseRetryAfter` imported from `./scene` to parse `Retry-After` header on HTTP 429 and 503 responses, throwing `new AskRequestError('busy', retryAfterSeconds)`.

3. **`frontend/src/flow/ask.ts`**:
   - Called `warmBackend()` fire-and-forget when an Ask starts in both `startVoiceAsk` and `submitTextAsk`.
   - On `'busy'`, waits the given seconds once (`sleep(retryAfterSeconds * 1000, signal)`) and retries.
   - On `'timeout'` or `'network'` (when `navigator.onLine` is not `false`), speaks `t('ask.wakingUp')` once and retries once.
   - Enforced total budget of 45 seconds (`ASK_TOTAL_BUDGET_MS = 45_000`) via `AbortController`.
   - Preserved `askErrorMessage` mapping for final failures (mapping `'busy'` to `t('ask.errorServer')`).
   - If aborted externally during a wait or retry, resolves as `{ kind: 'cancelled' }` with no speech or error earcon.

4. **`frontend/src/i18n/index.ts`**:
   - Added `ask.wakingUp` in all three supported languages:
     - English (`en`): `"The server is waking up. One moment."`
     - Hindi (`hi`): `"सर्वर चालू हो रहा है। एक क्षण।"`
     - Gujarati (`gu`): `"સર્વર શરૂ થઈ રહ્યું છે. એક ક્ષણ."`

---

## 2. Files Changed

- `frontend/src/api/health.ts` (modified)
- `frontend/src/api/ask.ts` (modified)
- `frontend/src/flow/ask.ts` (modified)
- `frontend/src/i18n/index.ts` (modified)
- `frontend/tests/hx5.askResilience.test.ts` (new)
- `docs/reports/agy-hx5-report.md` (new)

No forbidden files (`Explore.tsx`, `explore.ts`, `core/**`, `.kiro/**`, `.env*`) were touched.

---

## 3. Tests Added (`frontend/tests/hx5.askResilience.test.ts`)

Added Vitest test suite with fake fetch and fake timers covering all required scenarios:

1. **`timeout then success speaks wakingUp once and returns the answer`**:
   - First call hangs until 17 s timeout.
   - System speaks `t('ask.wakingUp')` once and retries.
   - Second call succeeds and speaks the diagram answer.
   - Outcome is `{ kind: 'success', answer: ... }`.

2. **`two timeouts give the normal error`**:
   - Both initial request and retry hang until 17 s timeout.
   - `t('ask.wakingUp')` is spoken once on the first timeout.
   - Second timeout yields standard error message `t('ask.errorTimeout')` and plays error earcon.
   - Outcome is `{ kind: 'failed', message: t('ask.errorTimeout') }`.

3. **`503 with Retry-After: 2 waits 2 s then retries`**:
   - First call returns 503 with `Retry-After: 2`.
   - At t = 1 s, retry has not been fired yet.
   - At t = 2 s, retry fires, succeeds, and returns answer.
   - `wakingUp` is not spoken on 503 busy.

4. **`abort during the wait resolves as cancelled with no further speech`**:
   - First call returns 503 with `Retry-After: 2`.
   - `manager.abort()` is called during the wait (at 500 ms).
   - Resolves as `{ kind: 'cancelled' }`.
   - No speech or earcons emitted after abort.

5. **`offline does not retry`**:
   - `navigator.onLine = false` set.
   - Network failure occurs.
   - Request is made only once (no retry).
   - `t('ask.wakingUp')` is not spoken.
   - Returns `{ kind: 'failed', message: t('ask.errorOffline') }`.

6. **`voice ask also retries on timeout, speaks wakingUp once, and succeeds`**:
   - Verifies the full audio/speech lifecycle in `startVoiceAsk`.

7. **`calls warmBackend when an Ask starts (fire and forget)`**:
   - Verifies background health ping fires when Ask starts.

8. **`enforces total budget of 45 seconds`**:
   - Requests exceeding 45 s budget are cancelled and fail with timeout error.

9. **`health.ts timestamp guard and clock injection`**:
   - Tests initial run, 10-minute throttling, rerun after 10 minutes, injectable clock, offline suppression, and `resetWarmGuardForTesting()`.

10. **`api/ask.ts 17s timeout and busy parsing`**:
    - Tests `ASK_TIMEOUT_MS === 17_000`, 429 and 503 parsing of `Retry-After`, and default 3-second fallback.

---

## 4. What Could Not Be Verified / Needs Attention

1. **Headless shell command execution:**
   - Per HX headless rules, no shell commands (`npm`, `vitest`, `git`, etc.) were executed by this agent. All test executions and type checks must be run by the orchestrator gate.
2. **Note on `frontend/tests/api.ask.test.ts:190`:**
   - `frontend/tests/api.ask.test.ts:190` contains the assertion `expect(ASK_TIMEOUT_MS).toBe(12_000);` written during Task 9.2.
   - Since `frontend/tests/api.ask.test.ts` was outside the ALLOWED list for lane `hx5`, it was left unmodified per lane rules.
   - When running the full test suite, that assertion should be updated from `12_000` to `17_000` to reflect the new `ASK_TIMEOUT_MS = 17_000` requirement.
