"""Dev-only observability for AI agent debugging.

Usage with FastAPI::

    from ephem_debugger_py.middleware.fastapi import Middleware, logger, close
    app.add_middleware(Middleware, port=8000)

Usage with Django (settings.py)::

    MIDDLEWARE = ["ephem_debugger_py.middleware.django.DebuggerMiddleware", ...]

Usage with Flask::

    from ephem_debugger_py.middleware.flask import init_debugger
    init_debugger(app, port=5000)
"""
from __future__ import annotations

from .bridge import Bridge
from .capture import DebuggerHandler
from .protocol import SessionInfo, compute_socket_path, create_session
from .store import LogStore


class Debugger:
    """Main debugger instance. Creates store, bridge, and logging handler."""

    def __init__(self, framework: str, port: int) -> None:
        self.session = create_session(framework, port)
        self.store = LogStore(self.session)
        self.bridge = Bridge(self.store, self.session.socket_path)
        self.handler = DebuggerHandler(self.store)
        self.bridge.start()

    def close(self) -> None:
        """Stop the bridge and clean up resources."""
        self.bridge.stop()


__all__ = [
    "Debugger",
    "LogStore",
    "Bridge",
    "DebuggerHandler",
    "SessionInfo",
    "create_session",
    "compute_socket_path",
]
