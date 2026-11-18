# Antigravity Lane Report: ux12

**Lane:** `ux12` — One slow provider must not be everyone's outage  
**Tool:** Antigravity (`agy`)  
**Date:** 2026-11-17  
**Status:** Complete  

---

## 1. Summary of Changes

This lane prevents cascading latency and availability outages when one vision/completion provider slows down or fails repeatedly.

1. **Per-Call Timeout Capping in `/ask` (`backend/app/ask.py`):**
   - Updated model invocation near line 1037 to pass `timeout=min(chain.call_timeout, total_budget * 0.55)` to `chain.complete`.
   - On a default 10.0s total budget with an 8.0s provider timeout, the first provider is capped at 5.5s (55% of the total budget). If the first provider hangs or fails, at least 4.5s remains for the next provider in the chain to answer, preventing slow providers from starving downstream fallbacks.

2. **Per-Provider Circuit Breaker (`backend/app/vision/chain.py`):**
   - Implemented `ProviderBreaker` held directly on `ProviderChain.breakers[provider_name]`.
   - Attributes tracked per provider:
     - `consecutive_failures`: integer count of consecutive qualifying failures.
     - `open_until`: monotonic float timestamp until which calls are skipped.
     - `state`: dynamic property returning `"closed"`, `"open"`, or `"half-open"`.
   - **Injectable Monotonic Clock:** `ProviderChain` accepts `clock: Callable[[], float] = time.monotonic` (defaulting to monotonic clock, injectable for deterministic test suites). All chain deadline and timeout calculations use `self.clock()`.
   - **Counting Failures (`is_breaker_failure`):**
     - Counts toward breaker opening: timeouts (`TimeoutError`, `asyncio.TimeoutError`, `httpx.TimeoutException`, timeout text), HTTP 5xx (`500..599`), HTTP 429 rate limits, and network connect errors (`ConnectionError`, `ConnectionResetError`, `ConnectionRefusedError`, connect error text).
     - Non-counting failures: HTTP 400 Bad Request, HTTP 401 Unauthorized, HTTP 403 Forbidden, HTTP 404 Not Found, budget exhaustion, prompt validation, and schema errors do not count.
   - **State Machine Transitions:**
     - **Closed -> Open:** Opens after 2 consecutive qualifying failures for 60.0s (`open_until = now + 60.0`).
     - **Open -> Half-Open:** When `now >= open_until`, breaker transitions to half-open, allowing exactly one probe call (`allow_call() == True` once).
     - **Half-Open -> Closed:** Success closes the breaker, resetting consecutive failures to 0 and `open_until` to 0.0s.
     - **Half-Open -> Open:** Failure during probe immediately reopens the breaker for another 60.0s.
     - **Interleaved Successes:** Any success resets `consecutive_failures` to 0, ensuring intermittent issues do not prematurely trip the breaker.
     - **All-Open Fallback:** When every configured provider is open, `_select_providers()` selects the provider with the earliest `open_until` timestamp (`min(self.providers, key=lambda p: self.get_breaker(p.name).open_until)`), ensuring the chain never returns "no providers configured" due to circuit breaker state alone.
     - **Privacy-Preserving Logging:** State transitions are logged at `INFO` level using the format `logger.info("circuit breaker %s: %s", new_state, self.provider_name)` containing the provider name only, with zero request prompts, secrets, or error bodies.

---

## 2. Files Changed

| File | Change |
|---|---|
| `backend/app/ask.py` | Passed `timeout=min(chain.call_timeout, total_budget * 0.55)` to `chain.complete` |
| `backend/app/vision/chain.py` | Added `ProviderBreaker`, `is_breaker_failure`, injectable `clock`, provider selection logic, and breaker lifecycle handling |
| `backend/tests/test_ux12_ask_timeout.py` | New test suite verifying per-call cap formula and slow-first healthy-second budget answering |
| `backend/tests/test_ux12_breaker.py` | New test suite verifying breaker opening, 60s skipping, half-open probing, closing on success, reopening on failure, interleaved successes, all-open earliest fallback, counting error classification, and INFO logging |

---

## 3. Tests Added

### `backend/tests/test_ux12_ask_timeout.py`
- `test_ask_slow_first_healthy_second_answers_within_budget`: verifies slow first provider times out within 5.5s per-call cap and healthy second provider answers within 10.0s budget.
- `test_ask_per_call_timeout_cap_formula`: verifies timeout calculation across varying `call_timeout` and `total_budget` inputs.
- `test_ask_route_slow_provider_fallback_to_second`: end-to-end FastAPI TestClient test on `POST /api/v1/ask` with slow provider fallback.

### `backend/tests/test_ux12_breaker.py`
- `test_breaker_opens_after_2_failures_skips_60s_probes_once_closes_on_success`: verifies 2 failures open breaker for 60s, provider is skipped during open window, probes once in half-open, and closes on success.
- `test_breaker_half_open_failure_reopens_for_60s`: verifies failed probe in half-open state reopens the breaker for another 60s.
- `test_breaker_interleaved_successes_never_open`: verifies alternating failures and successes keep consecutive failures <= 1 and breaker closed.
- `test_breaker_all_open_still_tries_one`: verifies that when all providers are open, the one with earliest `open_until` is tried.
- `test_breaker_all_open_fails_gracefully_never_no_providers`: verifies failure when all are open never reports "no providers configured".
- `test_breaker_counting_failures_classification`: verifies qualifying (timeout, 5xx, 429, connect error) vs non-qualifying (400, 401, 403, 404, schema, budget) exceptions.
- `test_breaker_logs_state_changes_at_info_with_provider_name_only`: verifies `open`, `half-open`, and `closed` transitions log at `INFO` with provider name only.
- `test_breaker_extract_method_works_with_breaker`: verifies identical breaker protection on `chain.extract`.

---

## 4. Follow-Up Pass 1 Gate Fixes

1. **Ruff UP041 (`asyncio.TimeoutError` -> `TimeoutError`):**
   - In `backend/app/vision/chain.py` (`is_breaker_failure`): replaced `isinstance(exc, (TimeoutError, asyncio.TimeoutError))` with `isinstance(exc, TimeoutError)`.
   - In `backend/tests/test_ux12_breaker.py` (`test_breaker_counting_failures_classification`): replaced `assert is_breaker_failure(asyncio.TimeoutError()) is True` with `assert is_breaker_failure(TimeoutError()) is True`.

2. **Pytest Collection ImportError (`AskRequest`):**
   - In `backend/tests/test_ux12_ask_timeout.py`: corrected import source of `AskRequest` from `app.schema` to `app.ask` (`from app.ask import AskRequest, answer_question` and `from app.schema import DiagramScene`).

Zero tests weakened; all breaker and timeout assertions preserved in full.

---

## 5. What Could Not Be Verified

- **Headless shell command execution:** Per UX rules (`"Do NOT run any shell command. No npm, npx, node, python, pytest, ruff, git, curl. The orchestrator runs all gates."`), pytest and ruff gates are executed directly by the orchestrator. All code and tests strictly follow Python 3.10+ typing, standard isort formatting, and zero-secret privacy guardrails.
