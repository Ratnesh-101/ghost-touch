# Kiro review: agy lane hx2 (per-client share of the daily AI budget)

Reviewed: worktree `gt-lane-hx2` (uncommitted changes on top of 3a6fc78): `backend/app/paid_budget.py`, `backend/app/main.py`, `render.yaml`, `backend/README.md`, `backend/tests/test_hx2_client_budget.py`, `docs/reports/agy-hx2-report.md`. Plan reference: `docs/reports/fable-hardening-plan.md` S1 (line 165) and S2 (line 179). No `.env` file was opened. I ran only `pytest` on the new test file and `ruff check` on the two changed Python files. No source was edited.

## Verdict: FIX FIRST

The implementation in `paid_budget.py` is sound. The lane's own test file has one failing test (a test bug), and two of the guards the lane adds have no test that would fail if they were removed. Both are cheap to fix.

## Findings

| # | Severity | Location | Problem | Fix |
|---|---|---|---|---|
| 1 | High (gate) | `backend/tests/test_hx2_client_budget.py:309-335` (`test_table_cap_holds_refuses_new_keys_without_eviction`) | Fails: `assert is_budget_exhausted() is True` gets `False` (line 321). The test fills `pb._client_ledger` directly, but `reset_budget()` left `_current_date = None`. The first `is_budget_exhausted()` call sees a "new day" and `_check_date_rollover_locked` (`paid_budget.py:~104`) clears the ledger and the counter. The code is correct; the test never reaches the full-table state. The agy report says no tests were run, which explains it. | Set `pb._current_date = pb._get_utc_date_str()` inside the `with pb._lock:` block (or call `get_consumed()` once before filling). Also assert `pb._consumed_count == CLIENT_LEDGER_CAP` survives. |
| 2 | Medium | `backend/app/main.py` `ask_question_route` (the added `set_budget_client(client_key_val)`, about line 915) | No test covers the `/ask` wiring. If that line is deleted, the context variable is `None` on `/ask`, so per-client charging silently stops for Ask and every test still passes. The only endpoint test posts to `/api/v1/scene`. The same goes for the claim that the background improve task inherits the client (it does, since `create_task` copies the context, but nothing asserts it). | Add an endpoint test: with `PAID_CALLS_PER_CLIENT_PER_DAY=1` and a fake chain whose `complete` calls `try_consume`, client A's second `/ask` returns the facts answer and client B's first gets the model answer. Add one test that `get_client_consumed(key)` rises after an improve pass. |
| 3 | Medium | `backend/app/paid_budget.py` `get_client_daily_limit` (line ~82-99) | Fails open. Unset, empty, non-numeric (`"5OO"`) or negative values all mean "no per-client cap", so a typo in the Render dashboard silently removes the S1 protection, with one warning line. The code default is also "off", while the plan treats the cap as the fix for a High risk. Production is safe only because `render.yaml` sets `500`. | On an invalid value fall back to a built-in default (for example 500), as `get_daily_limit` already does for the global limit. Keep `0` as the explicit off switch. Update the README sentence "unset, invalid, or 0 disables". |
| 4 | Medium (needs owner) | `backend/app/main.py:581, ~915` via `limits.py:403-411`, `render.yaml` | The per-client key is only as good as `request_client_key`. It reads `X-Forwarded-For` the safe way (n-th entry from the right, fewer entries than hops falls back to the peer, IPv6 grouped by /64, duplicate header lines joined, key capped at 64 chars), so a client cannot mint a new identity by writing the header. That is correct only if `TRUSTED_PROXY_HOPS` matches Render's real header shape, which `docs/PRIVACY.md:225` still lists as UNVERIFIED. If Render appends two entries, every user maps to the same proxy address and the whole school shares one 500-call allowance (fails closed, not open). The lane did not touch this, correctly. | Not a blocker. Owner confirms the header shape on the live service and pins `TRUSTED_PROXY_HOPS` in `render.yaml`. Note it in the lane report. |
| 5 | Low-Medium | `paid_budget.py` interaction, `render.yaml:71-74` | One client cannot exhaust the day, but only down to a quarter of it: 500 of 2000 means four clients (or four /64 networks, or four school gateways) still drain the global cap and everyone else gets Raw Mode. A fresh client does still get AI while the global cap has room (verified by reading `try_consume`: a per-client rejection returns before `_consumed_count` is touched, so a refused call does not charge the global budget). | Owner decision, as the plan says. Consider 300 or fewer if abuse is a concern, and state the "four clients drain it" arithmetic in the README. |
| 6 | Low | `paid_budget.py:~155-162, ~211-213` | When the ledger is full (20,000 keys) new clients are refused with no log line, unlike the global and per-client cases. With the defaults this cannot happen: an entry is created only by a successful charge and the global cap is 2000, so the table holds at most 2000 keys a day. It becomes reachable only if `PAID_CALLS_PER_DAY` is raised above 20,000, and then an attacker rotating /64 networks could lock out new students. | Log once per day when the table is full. Document the coupling (`CLIENT_LEDGER_CAP` should stay above `PAID_CALLS_PER_DAY`), or derive the cap from it. |
| 7 | Low | `backend/.env.example:79` | Mentions `PAID_CALLS_PER_DAY` only. The new name `PAID_CALLS_PER_CLIENT_PER_DAY` is not listed (names only, no values, would be fine). | Add the variable name with an empty or commented value. |
| 8 | Low | `render.yaml:70-74` | Good: both variables are set explicitly, which closes S2's "set `PAID_CALLS_PER_DAY` in `render.yaml`". No secret is added. Remaining S2 work (provider-side spend caps, restart resets the counters) is owner and hx10 and is correctly out of scope. | None. |

## Checks you asked for

- **Spoofing.** Not spoofable by client headers beyond what `limits.client_key` already guarantees (see finding 4). `paid_budget` only receives the string from `request_client_key`. Key length is capped by `MAX_CLIENT_KEY_CHARS`.
- **Memory.** Ledger is capped at 20,000 keys, refuses new keys instead of evicting (no way to evict an abuser to make room), and is cleared at the UTC date change. `_logged_clients` is a subset of the ledger keys, so it is bounded and cleared with it. Memory is bounded.
- **Global versus per-client.** Order in `try_consume` is global check, ledger-full check, per-client check, then charge both. A client refused by its own cap does not consume global budget. `is_budget_exhausted` mirrors the same three conditions without charging. Correct.
- **Raw Mode response shape.** `main.py` still calls `run_raw_mode("budget_exhausted", "none")`, so the body is `{scene, mode: "raw", reason}` and `X-Vision-Provider: raw`, unchanged. The endpoint test asserts this for the capped client.
- **Logging.** The per-client warning prints the date and the limit only. The test asserts the key is absent from the message. No IP is logged by the new code.
- **Concurrency.** All mutations happen under one `threading.Lock` with no `await` inside, so they are atomic with respect to the event loop and to `asyncio.to_thread` workers. The check in `is_budget_exhausted` followed by the charge in `try_consume` is a benign race: `try_consume` is the authority. The `ContextVar` is set in the route coroutine without a reset; each request runs in its own task context under uvicorn, so there is no cross-request leak. `create_task` copies the context, so the improve pass charges the same client.
- **UTC midnight.** The date string comes from `datetime.now(UTC)`. The rollover resets the global count, the ledger and both log flags in one locked step. Covered by `test_date_rollover_resets_client_and_global_budgets` (the ledger clear is covered; the `_logged_clients.clear()` line is not).
- **Config.** Env-only, `0` disables per client, no secret in `render.yaml` or the README. See finding 3 for the unsafe default.

## Test strength (mutations I would expect to survive)

- Delete `set_budget_client` in `/ask`: survives (finding 2).
- Delete `_logged_clients.clear()` on rollover: survives. Only matters for log noise.
- Remove the multi-thread safety (drop the lock): survives. No threaded test exists. Optional: 8 threads each calling `try_consume(1)` 1000 times against caps of 500 and 2000, asserting exact totals.
- Replace `client_count + n > client_limit` with `>=`: killed by the Hypothesis test and the A/B test.
- Skip the client ledger clear at rollover: killed.
- Remove the ledger-full branch: would be killed once finding 1 is fixed (it currently fails before reaching it).
- No endpoint test sends a forged leftmost `X-Forwarded-For` entry (`"1.1.1.1, 198.51.100.1"`) and checks it still lands in the same per-client bucket. `test_n*`/`x1` tests cover the key function, so this is Low priority.

## Results of the runs

- `pytest backend/tests/test_hx2_client_budget.py`: 1 failed (`test_table_cap_holds_refuses_new_keys_without_eviction`, finding 1). The failure summary lists no other failing test. I did not run the full backend suite.
- `ruff check` on `paid_budget.py` and the new test file: clean.

## To merge

Fix finding 1 (test), add the `/ask` wiring test (finding 2), and decide finding 3 (safe default). Findings 4 to 7 can follow as owner or small follow-up items. Re-run `pytest backend` and `ruff format --check backend` after the fixes.
