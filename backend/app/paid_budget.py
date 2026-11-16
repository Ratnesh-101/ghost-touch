"""Daily paid API call budget and circuit breaker (C1, HX2).

Tracks paid vision/language model calls in memory, keyed by UTC date with a thread lock.
When the daily global budget (PAID_CALLS_PER_DAY, default 2000, 0 = off) or the per-client
daily budget (PAID_CALLS_PER_CLIENT_PER_DAY, unset/0 = off) is exhausted, calls to paid
providers are rejected before touching external APIs, allowing the application to fall back
gracefully to deterministic facts and Raw Mode.
"""

from __future__ import annotations

import contextvars
import logging
import os
import threading
from collections.abc import Callable
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

DEFAULT_PAID_CALLS_PER_DAY = 2000
CLIENT_LEDGER_CAP = 20_000

budget_client: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "budget_client", default=None
)

_lock = threading.Lock()
_current_date: str | None = None
_consumed_count: int = 0
_logged_exhausted: bool = False
_client_ledger: dict[str, int] = {}
_logged_clients: set[str] = set()
_injected_clock: Callable[[], datetime] | None = None


def set_budget_client(key: str | None) -> contextvars.Token[str | None]:
    """Set the budget client for the current context and return the token."""
    return budget_client.set(key)


def reset_budget_client(token: contextvars.Token[str | None]) -> None:
    """Reset the budget client context variable using the given Token."""
    budget_client.reset(token)


def get_budget_client() -> str | None:
    """Get the budget client key for the current context."""
    return budget_client.get()


def set_clock_for_testing(clock: Callable[[], datetime] | None) -> None:
    """Inject a custom clock function returning UTC datetime (for testing)."""
    global _injected_clock
    with _lock:
        _injected_clock = clock


def _get_utc_date_str(clock: Callable[[], datetime] | None = None) -> str:
    active_clock = clock or _injected_clock
    now = active_clock() if active_clock is not None else datetime.now(UTC)
    return now.strftime("%Y-%m-%d")


def get_daily_limit() -> int:
    """Read PAID_CALLS_PER_DAY env var (default 2000, 0 = paid calls disabled)."""
    raw = os.environ.get("PAID_CALLS_PER_DAY")
    if raw is None:
        return DEFAULT_PAID_CALLS_PER_DAY
    try:
        val = int(raw)
        return max(0, val)
    except (ValueError, TypeError):
        logger.warning(
            "Invalid PAID_CALLS_PER_DAY '%s'; using default %d",
            raw,
            DEFAULT_PAID_CALLS_PER_DAY,
        )
        return DEFAULT_PAID_CALLS_PER_DAY


def get_client_daily_limit() -> int:
    """Read PAID_CALLS_PER_CLIENT_PER_DAY env var (int >= 0; unset, invalid or 0 = no cap)."""
    raw = os.environ.get("PAID_CALLS_PER_CLIENT_PER_DAY")
    if raw is None:
        return 0
    raw_str = raw.strip()
    if not raw_str:
        return 0
    try:
        val = int(raw_str)
        return max(0, val)
    except (ValueError, TypeError):
        logger.warning(
            "Invalid PAID_CALLS_PER_CLIENT_PER_DAY '%s'; using 0 (no per-client cap)",
            raw,
        )
        return 0


def _check_date_rollover_locked(today: str) -> None:
    global _current_date, _consumed_count, _logged_exhausted
    if _current_date is None:
        _current_date = today
    elif _current_date != today:
        _current_date = today
        _consumed_count = 0
        _logged_exhausted = False
        _client_ledger.clear()
        _logged_clients.clear()


def reset_budget() -> None:
    """Reset the daily consumption counter and client ledger (for testing)."""
    global _current_date, _consumed_count, _logged_exhausted, _injected_clock
    with _lock:
        _current_date = None
        _consumed_count = 0
        _logged_exhausted = False
        _client_ledger.clear()
        _logged_clients.clear()
        _injected_clock = None


def get_consumed(clock: Callable[[], datetime] | None = None) -> int:
    """Get count of consumed calls for current UTC day."""
    global _current_date, _consumed_count, _logged_exhausted
    with _lock:
        today = _get_utc_date_str(clock)
        _check_date_rollover_locked(today)
        return _consumed_count


def get_client_consumed(
    client: str | None = None,
    clock: Callable[[], datetime] | None = None,
) -> int:
    """Get count of consumed calls for a client for current UTC day."""
    key = client if client is not None else budget_client.get()
    if key is None:
        return 0
    with _lock:
        today = _get_utc_date_str(clock)
        _check_date_rollover_locked(today)
        return _client_ledger.get(key, 0)


def is_budget_exhausted(clock: Callable[[], datetime] | None = None) -> bool:
    """Check if the daily budget is exhausted without consuming quota.

    Returns True if the global budget is exhausted, or if the current
    context's client is at its cap, or if the client ledger is full
    for a new client key.
    """
    global _current_date, _consumed_count, _logged_exhausted
    limit = get_daily_limit()
    if limit <= 0:
        return True

    client_limit = get_client_daily_limit()
    client = budget_client.get()

    with _lock:
        today = _get_utc_date_str(clock)
        _check_date_rollover_locked(today)

        if _consumed_count >= limit:
            return True

        if client is not None:
            if client_limit > 0:
                client_count = _client_ledger.get(client, 0)
                if client_count >= client_limit:
                    return True
            if client not in _client_ledger and len(_client_ledger) >= CLIENT_LEDGER_CAP:
                return True

        return False


def try_consume(n: int = 1, clock: Callable[[], datetime] | None = None) -> bool:
    """Attempt to consume n calls from the daily budget.

    Returns True if allowed and quota was consumed.
    Returns False if budget is exhausted (global or per-client cap reached, or
    client ledger table full for new client), logging a warning once per day.
    """
    global _current_date, _consumed_count, _logged_exhausted
    if n <= 0:
        return True

    limit = get_daily_limit()
    client_limit = get_client_daily_limit()
    client = budget_client.get()

    with _lock:
        today = _get_utc_date_str(clock)
        _check_date_rollover_locked(today)

        if limit <= 0 or _consumed_count + n > limit:
            if not _logged_exhausted:
                logger.warning(
                    "Paid call budget exhausted for UTC date %s: consumed=%d, limit=%d",
                    today,
                    _consumed_count,
                    limit,
                )
                _logged_exhausted = True
            return False

        if client is not None:
            if client not in _client_ledger and len(_client_ledger) >= CLIENT_LEDGER_CAP:
                return False

            if client_limit > 0:
                client_count = _client_ledger.get(client, 0)
                if client_count + n > client_limit:
                    if client not in _logged_clients:
                        _logged_clients.add(client)
                        logger.warning(
                            "Per-client paid call budget exhausted for a client on "
                            "UTC date %s: limit=%d",
                            today,
                            client_limit,
                        )
                    return False

            _client_ledger[client] = _client_ledger.get(client, 0) + n

        _consumed_count += n
        return True
