"""Daily paid API call budget and circuit breaker (C1).

Tracks paid vision/language model calls in memory, keyed by UTC date with a thread lock.
When the daily budget (PAID_CALLS_PER_DAY, default 2000, 0 = off) is exhausted,
calls to paid providers are rejected before touching external APIs, allowing
the application to fall back gracefully to deterministic facts and Raw Mode.
"""

from __future__ import annotations

import logging
import os
import threading
from collections.abc import Callable
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

DEFAULT_PAID_CALLS_PER_DAY = 2000

_lock = threading.Lock()
_current_date: str | None = None
_consumed_count: int = 0
_logged_exhausted: bool = False
_injected_clock: Callable[[], datetime] | None = None


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


def reset_budget() -> None:
    """Reset the daily consumption counter (for testing)."""
    global _current_date, _consumed_count, _logged_exhausted, _injected_clock
    with _lock:
        _current_date = None
        _consumed_count = 0
        _logged_exhausted = False
        _injected_clock = None


def get_consumed(clock: Callable[[], datetime] | None = None) -> int:
    """Get count of consumed calls for current UTC day."""
    global _current_date, _consumed_count, _logged_exhausted
    with _lock:
        today = _get_utc_date_str(clock)
        if _current_date != today:
            _current_date = today
            _consumed_count = 0
            _logged_exhausted = False
        return _consumed_count


def is_budget_exhausted(clock: Callable[[], datetime] | None = None) -> bool:
    """Check if the daily budget is exhausted without consuming quota."""
    global _current_date, _consumed_count, _logged_exhausted
    limit = get_daily_limit()
    if limit <= 0:
        return True
    with _lock:
        today = _get_utc_date_str(clock)
        if _current_date != today:
            _current_date = today
            _consumed_count = 0
            _logged_exhausted = False
        return _consumed_count >= limit


def try_consume(n: int = 1, clock: Callable[[], datetime] | None = None) -> bool:
    """Attempt to consume n calls from the daily budget.

    Returns True if allowed and quota was consumed.
    Returns False if budget is exhausted (0 or reached), and logs a warning once per day.
    """
    global _current_date, _consumed_count, _logged_exhausted
    if n <= 0:
        return True

    limit = get_daily_limit()
    with _lock:
        today = _get_utc_date_str(clock)
        if _current_date != today:
            _current_date = today
            _consumed_count = 0
            _logged_exhausted = False

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

        _consumed_count += n
        return True
