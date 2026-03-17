"""FastAPI/Starlette middleware for debugger.

Usage::

    from ephem_debugger_py.middleware.fastapi import instrument, logger, close

    app = FastAPI()
    instrument(app, port=8000)
    log = logger()
"""
from __future__ import annotations

import logging
import time
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .. import Debugger
from ..browser import CLIENT_SCRIPT, inject_scripts
from ..capture import DebuggerHandler

_instance: Debugger | None = None


def instrument(app: Any, port: int = 8000) -> None:
    """Instrument a FastAPI/Starlette app with debugger.

    Creates the debugger session, starts the IPC bridge, and adds
    HTTP request capture middleware. Call this once at app creation.
    """
    global _instance  # noqa: PLW0603
    dbg = Debugger("fastapi", port)
    _instance = dbg
    app.add_middleware(_DebuggerMiddleware)
    print(f"> @ephem-sh/debugger: session {dbg.session.session_id}")


class _DebuggerMiddleware(BaseHTTPMiddleware):
    """Internal ASGI middleware — added by instrument()."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        path = request.url.path

        # Browser script
        if path == "/_/d.js" and request.method == "GET":
            return Response(
                content=CLIENT_SCRIPT,
                media_type="application/javascript",
                headers={"Cache-Control": "no-store"},
            )

        # CORS preflight
        if path == "/_/d" and request.method == "OPTIONS":
            origin = request.headers.get("origin", "*")
            return Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            )

        # Browser ingest
        if path == "/_/d" and request.method == "POST":
            origin = request.headers.get("origin", "*")
            try:
                body = await request.json()
                if isinstance(body, list) and _instance:
                    for entry in body:
                        _instance.store.push(entry)
            except Exception:
                pass
            return Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                },
            )

        # Normal request — capture timing
        start = time.time()
        response = await call_next(request)
        duration = int((time.time() - start) * 1000)

        if _instance:
            _instance.store.push(
                {
                    "type": "console",
                    "level": "info",
                    "args": [
                        request.method,
                        str(request.url.path),
                        response.status_code,
                        duration,
                    ],
                    "timestamp": int(start * 1000),
                    "source": "server",
                }
            )

            # Inject browser scripts into HTML responses
            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type:
                body_bytes = b""
                async for chunk in response.body_iterator:
                    if isinstance(chunk, bytes):
                        body_bytes += chunk
                    else:
                        body_bytes += chunk.encode("utf-8")
                html = body_bytes.decode("utf-8", errors="replace")
                html = inject_scripts(html)
                headers = dict(response.headers)
                headers.pop("content-length", None)
                return Response(
                    content=html,
                    status_code=response.status_code,
                    headers=headers,
                    media_type="text/html",
                )

        return response


class _LazyDebuggerHandler(logging.Handler):
    """Handler that defers to the debugger store once available."""

    def emit(self, record: logging.LogRecord) -> None:
        if _instance:
            _instance.handler.emit(record)


def logger() -> logging.Logger:
    """Get a logger that writes to both stderr and the debugger store.

    Safe to call before or after instrument() — the handler resolves
    lazily on each log call.
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
