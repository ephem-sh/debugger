"""Django middleware for debugger.

Usage in settings.py::

    MIDDLEWARE = [
        "debugger_py.middleware.django.DebuggerMiddleware",
        ...
    ]

    # Optional: set port in settings
    DEBUGGER_PORT = 8000
"""
from __future__ import annotations

import logging
import time
from typing import Any

from django.conf import settings

from .. import Debugger

_instance: Debugger | None = None


class DebuggerMiddleware:
    """Django middleware that instruments the app with debugger."""

    def __init__(self, get_response: Any) -> None:
        self.get_response = get_response
        global _instance  # noqa: PLW0603
        if _instance is None:
            port = getattr(settings, "DEBUGGER_PORT", 8000)
            dbg = Debugger("django", port)
            _instance = dbg

            # Add handler to root logger
            root = logging.getLogger()
            root.addHandler(dbg.handler)

            print(f"> @ephem-sh/debugger: session {dbg.session.session_id}")

    def __call__(self, request: Any) -> Any:
        """Process a request and capture timing."""
        start = time.time()
        response = self.get_response(request)
        duration = int((time.time() - start) * 1000)

        if _instance:
            _instance.store.push(
                {
                    "type": "console",
                    "level": "info",
                    "args": [
                        request.method,
                        request.path,
                        response.status_code,
                        duration,
                    ],
                    "timestamp": int(start * 1000),
                    "source": "server",
                }
            )

        return response


def close() -> None:
    """Stop the debugger."""
    if _instance:
        _instance.close()
