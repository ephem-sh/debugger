"""In-memory log storage with ring buffers."""
from __future__ import annotations

import threading
import time
from typing import Any

from .protocol import SessionInfo, generate_id


class RingBuffer:
    """Fixed-capacity circular buffer, thread-safe."""

    def __init__(self, capacity: int) -> None:
        self._buf: list[Any] = [None] * capacity
        self._head = 0
        self._size = 0
        self._capacity = capacity
        self._lock = threading.Lock()

    def push(self, item: Any) -> None:
        """Add an item to the buffer, overwriting the oldest if full."""
        with self._lock:
            self._buf[self._head] = item
            self._head = (self._head + 1) % self._capacity
            if self._size < self._capacity:
                self._size += 1

    def to_list(self) -> list[Any]:
        """Return all items in insertion order."""
        with self._lock:
            if self._size == 0:
                return []
            start = 0 if self._size < self._capacity else self._head
            result = []
            for i in range(self._size):
                result.append(self._buf[(start + i) % self._capacity])
            return result

    def clear(self) -> None:
        """Remove all items from the buffer."""
        with self._lock:
            self._buf = [None] * self._capacity
            self._head = 0
            self._size = 0


class LogStore:
    """Categorized log storage backed by ring buffers."""

    def __init__(self, session: SessionInfo) -> None:
        self.console = RingBuffer(500)
        self.errors = RingBuffer(100)
        self.network = RingBuffer(300)
        self.app = RingBuffer(50)
        self.session = session

    def push(self, entry: dict[str, Any]) -> None:
        """Route an entry to the appropriate buffer by type."""
        if "id" not in entry or not entry["id"]:
            entry["id"] = generate_id()

        entry_type = entry.get("type")
        if entry_type == "console":
            self.console.push(entry)
        elif entry_type == "error":
            self.errors.push(entry)
        elif entry_type == "network":
            self.network.push(entry)
        elif entry_type == "app":
            self.app.push(entry)

    def query(
        self, command: str, filters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Query entries by command with optional filters.

        Args:
            command: One of "console", "errors", "network", "app", "all", "status".
            filters: Optional dict of filter criteria.

        Returns:
            List of matching entry dicts.
        """
        filters = filters or {}

        if command == "console":
            entries = self.console.to_list()
            level = filters.get("level")
            if level:
                entries = [e for e in entries if e.get("level") == level]
        elif command == "errors":
            entries = self.errors.to_list()
        elif command == "network":
            entries = self.network.to_list()
            status = filters.get("status")
            if status is not None:
                entries = [e for e in entries if e.get("status") == status]
            if filters.get("failed"):
                entries = [e for e in entries if e.get("failed")]
        elif command == "app":
            entries = self.app.to_list()
        elif command in ("status", "push"):
            return []
        elif command == "all":
            entries = sorted(
                self.console.to_list()
                + self.errors.to_list()
                + self.network.to_list()
                + self.app.to_list(),
                key=lambda e: e.get("timestamp", 0),
            )
        else:
            return []

        # Source filter
        source = filters.get("source")
        if source:
            entries = [e for e in entries if e.get("source") == source]

        # ID filters
        entry_id = filters.get("id")
        if entry_id:
            entries = [e for e in entries if e.get("id") == entry_id]
        ids = filters.get("ids")
        if ids:
            id_set = set(ids)
            entries = [e for e in entries if e.get("id") in id_set]

        # Time filter
        last = filters.get("last")
        if last:
            cutoff = int(time.time() * 1000) - last
            entries = [e for e in entries if e.get("timestamp", 0) >= cutoff]

        # Limit
        limit = filters.get("limit")
        if limit and len(entries) > limit:
            entries = entries[-limit:]

        return entries
