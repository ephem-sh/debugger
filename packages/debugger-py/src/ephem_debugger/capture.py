"""Logging integrations for the debugger store."""
from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .store import LogStore

_LEVEL_MAP = {
    "DEBUG": "debug",
    "INFO": "info",
    "WARNING": "warn",
    "ERROR": "error",
    "CRITICAL": "error",
}


class DebuggerHandler(logging.Handler):
    """logging.Handler that captures log records into the debugger store."""

    def __init__(self, store: LogStore) -> None:
        super().__init__()
        self._store = store

    def emit(self, record: logging.LogRecord) -> None:
        """Emit a log record to the debugger store."""
        self._store.push(
            {
                "type": "console",
                "level": _LEVEL_MAP.get(record.levelname, "info"),
                "args": [self.format(record)],
                "timestamp": int(record.created * 1000),
                "source": "server",
            }
        )
