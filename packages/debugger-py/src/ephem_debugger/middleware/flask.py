"""Flask middleware for debugger.

Usage::

    from debugger_py.middleware.flask import init_debugger, logger, close

    app = Flask(__name__)
    init_debugger(app, port=5000)
    log = logger()
"""
from __future__ import annotations

import logging
import time
import traceback
from typing import Any

from flask import Flask, g, request as flask_request

from .. import Debugger
from ..capture import DebuggerHandler

_instance: Debugger | None = None


def init_debugger(app: Flask, port: int = 5000) -> None:
    """Initialize debugger on a Flask app.

    Args:
        app: The Flask application instance.
        port: Server port number for session metadata.
    """
    global _instance  # noqa: PLW0603
    dbg = Debugger("flask", port)
    _instance = dbg

    print(f"> @ephem-sh/debugger: session {dbg.session.session_id}")

    @app.before_request
    def _before() -> None:
        g._debugger_start = time.time()

    @app.after_request
    def _after(response: Any) -> Any:
        start = getattr(g, "_debugger_start", time.time())
        duration = int((time.time() - start) * 1000)
        dbg.store.push(
            {
                "type": "console",
                "level": "info",
                "args": [
                    flask_request.method,
                    flask_request.path,
                    response.status_code,
                    duration,
                ],
                "timestamp": int(start * 1000),
                "source": "server",
            }
        )
        return response

    @app.teardown_request
    def _teardown(exc: BaseException | None) -> None:
        if exc:
            dbg.store.push(
                {
                    "type": "error",
                    "message": str(exc),
                    "stack": traceback.format_exc(),
                    "timestamp": int(time.time() * 1000),
                    "source": "server",
                }
            )


class _LazyDebuggerHandler(logging.Handler):
    """Handler that defers to the debugger store once available."""

    _attached = False

    def emit(self, record: logging.LogRecord) -> None:
        if not self._attached and _instance:
            self._attached = True
        if self._attached and _instance:
            _instance.handler.emit(record)


def logger() -> logging.Logger:
    """Get a logger that writes to both stderr and the debugger store.

    Safe to call before or after init_debugger — the handler resolves
    lazily on first log call.
    """
    log = logging.getLogger("debugger")
    log.setLevel(logging.DEBUG)
    if not log.handlers:
        ch = logging.StreamHandler()
        ch.setLevel(logging.DEBUG)
        ch.setFormatter(logging.Formatter("%(message)s"))
        log.addHandler(ch)
        log.addHandler(_LazyDebuggerHandler())
    return log


def close() -> None:
    """Stop the debugger."""
    if _instance:
        _instance.close()
