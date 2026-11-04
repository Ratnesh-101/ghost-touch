"""In-memory cache of VALIDATED AI scenes, keyed by image hash.

Purpose: a demo or a repeated upload must not burn free-tier quota twice. Only successful,
validated AI scenes are stored. Raw Mode results and every failure are never cached, so a
transient provider error cannot stick. Size and lifetime are bounded:
    SCENE_CACHE_SIZE         entries (default 64, 0 disables the cache)
    SCENE_CACHE_TTL_SECONDS  lifetime of an entry (default 21600 = 6 hours)
"""

from __future__ import annotations

import copy
import hashlib
import os
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

DEFAULT_MAX_ENTRIES = 64
DEFAULT_TTL_SECONDS = 6 * 60 * 60


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return value if value >= 0 else default


def image_key(image: bytes, prompt: str, version: int | str = 1) -> str:
    """Hash of the image bytes, extraction prompt, and version (invalidation on edit)."""
    digest = hashlib.sha256()
    digest.update(image)
    digest.update(b"\x00")
    digest.update(prompt.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(str(version).encode("utf-8"))
    return digest.hexdigest()


class SceneCache:
    """A small thread-safe LRU cache with a time-to-live, storing (payload, provider) pairs."""

    def __init__(
        self,
        max_entries: int | None = None,
        ttl_seconds: float | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_entries = (
            _int_env("SCENE_CACHE_SIZE", DEFAULT_MAX_ENTRIES)
            if (max_entries is None)
            else max_entries
        )
        self.ttl_seconds = float(
            _int_env("SCENE_CACHE_TTL_SECONDS", DEFAULT_TTL_SECONDS)
            if ttl_seconds is None
            else ttl_seconds
        )
        self._clock = clock
        self._lock = threading.Lock()
        self._items: OrderedDict[str, tuple[float, dict[str, Any], str]] = OrderedDict()

    @property
    def enabled(self) -> bool:
        return self.max_entries > 0

    def get(self, key: str) -> tuple[dict[str, Any], str] | None:
        """Return a private copy of the cached (payload, provider), or None."""
        if not self.enabled:
            return None
        with self._lock:
            entry = self._items.get(key)
            if entry is None:
                return None
            stored_at, payload, provider = entry
            if self._clock() - stored_at > self.ttl_seconds:
                del self._items[key]
                return None
            self._items.move_to_end(key)
            return copy.deepcopy(payload), provider

    def put(self, key: str, payload: dict[str, Any], provider: str) -> None:
        """Store a validated AI payload. Anything that is not mode 'ai' is refused."""
        if not self.enabled or payload.get("mode") != "ai":
            return
        with self._lock:
            self._items[key] = (self._clock(), copy.deepcopy(payload), provider)
            self._items.move_to_end(key)
            while len(self._items) > self.max_entries:
                self._items.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)


scene_cache = SceneCache()
