# Agys Lane Report: hx2

## Summary
Implemented per-client paid model call budget and circuit breaker protection to prevent a single client from exhausting the daily AI budget.

## Files Changed
1. `backend/app/paid_budget.py`
   - Added `contextvars.ContextVar[str | None]` named `"budget_client"` (default `None`).
   - Added `set_budget_client(key)` returning the ContextVar token, along with `reset_budget_client` and `get_budget_client` helpers.
   - Added `CLIENT_LEDGER_CAP = 20_000` capping the per-client ledger dict. When the ledger is full at 20,000 keys, calls from new client keys are refused rather than evicting existing keys.
   - Added `get_client_daily_limit()` reading `PAID_CALLS_PER_CLIENT_PER_DAY` (int >= 0; unset, invalid, or 0 disables the per-client cap).
   - Updated `try_consume(n)`: under thread lock, checks date rollover (clearing daily count, client ledger, and warning logs). If a client is set and a per-client cap is on, rejects calls exceeding the cap, logging a warning once per client per day without leaking the client key. If ledger is full at 20,000 keys, refuses calls for new client keys without evicting. Charges both client and global ledgers when allowed.
   - Updated `is_budget_exhausted()`: returns `True` if the global daily budget is exhausted, or if the current context's client has reached its per-client cap, or if the client ledger is full for a new client key.
   - Updated `reset_budget()` to clear the client ledger and per-client logging states.
   - Added `get_client_consumed(client)` helper for introspection and testing.

2. `backend/app/main.py`
   - In `process_scene` (POST `/api/v1/scene`), right after `client_key_val = request_client_key(request)`, calls `set_budget_client(client_key_val)` before any `asyncio.create_task`. The ContextVar is retained for the lifetime of the request so background tasks (such as the improve pass) inherit and charge the same client.
   - In `ask_question_route` (POST `/api/v1/ask`), right after `client_key_val = request_client_key(raw_request)`, calls `set_budget_client(client_key_val)` before `asyncio.create_task(answer_question(...))`.

3. `render.yaml`
   - Added `PAID_CALLS_PER_DAY` with value `"2000"` and `PAID_CALLS_PER_CLIENT_PER_DAY` with value `"500"` with a comment documenting both as owner decisions.

4. `backend/README.md`
   - Added documentation for `PAID_CALLS_PER_DAY` (including the `PAID_CALLS_PER_DAY=0` kill switch) and `PAID_CALLS_PER_CLIENT_PER_DAY`.

5. `backend/tests/test_hx2_client_budget.py` (new)
   - Added comprehensive pytest and Hypothesis test suite covering all lane requirements.

## Tests Added
In `backend/tests/test_hx2_client_budget.py`:
- `test_hypothesis_interleaving_clients_within_caps`: Hypothesis property-based test generating random interleavings of consume requests across up to 5 clients. Verifies that every client's count remains `<= its cap` and the total remains `<= the global cap`, and the sum of client counts matches total consumed.
- `test_client_a_exhausted_does_not_block_client_b`: Unit test verifying that when Client A consumes up to its cap, Client B can continue consuming normally and is not blocked.
- `test_date_rollover_resets_client_and_global_budgets`: Unit test using injected test clock verifying that crossing UTC midnight resets both the global consumed count and all per-client ledger counts.
- `test_cap_zero_or_unset_equals_old_behaviour`: Unit test verifying that when `PAID_CALLS_PER_CLIENT_PER_DAY` is unset, "0", invalid ("invalid"), or negative ("-5"), per-client capping is disabled and clients can consume up to the global limit.
- `test_table_cap_holds_refuses_new_keys_without_eviction`: Unit test verifying that when the client ledger reaches 20,000 entries, a new 20,001st client key is refused (`is_budget_exhausted() == True` and `try_consume() == False`), table size does not exceed 20,000, no existing keys are evicted, and existing keys can still consume.
- `test_endpoint_scene_capped_client_raw_other_client_ai`: End-to-end endpoint test using FastAPI `TestClient` and `FakeVisionProvider` for POST `/api/v1/scene`. Proves that Client A on its second request (when capped) receives mode `"raw"` with reason `"budget_exhausted"`, while Client B on its first request receives mode `"ai"`.
- `test_logging_once_per_client_per_day_without_key`: Unit test verifying that when a client hits its cap, a warning log is emitted exactly once per day, and the client key itself is not leaked in the log message.

## What Could Not Be Verified
- Per the headless run rules, no shell commands (`pytest`, `ruff`, etc.) were executed during this run. All verification gates will be run by the orchestrator.
