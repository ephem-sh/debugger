"""Django middleware for debugger.

Usage in settings.py::

    MIDDLEWARE = [
        "ephem_debugger_py.middleware.django.DebuggerMiddleware",
        ...
    ]

    # Optional: set port in settings
    DEBUGGER_PORT = 8000
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from django.conf import settings
from django.http import HttpResponse

from .. import Debugger
from ..browser import CLIENT_SCRIPT, inject_scripts

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
        # Browser script
        if request.path == "/_/d.js" and request.method == "GET":
            return HttpResponse(
                CLIENT_SCRIPT,
                content_type="application/javascript",
                headers={"Cache-Control": "no-store"},
            )

        # CORS preflight
        if request.path == "/_/d" and request.method == "OPTIONS":
            origin = request.headers.get("Origin", "*")
            resp = HttpResponse(status=204)
            resp["Access-Control-Allow-Origin"] = origin
            resp["Access-Control-Allow-Credentials"] = "true"
            resp["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
            resp["Access-Control-Allow-Headers"] = "Content-Type"
            return resp

        # Browser ingest
        if request.path == "/_/d" and request.method == "POST":
            origin = request.headers.get("Origin", "*")
            try:
                entries = json.loads(request.body)
                if isinstance(entries, list) and _instance:
                    for entry in entries:
                        _instance.store.push(entry)
            except Exception:
                pass
            resp = HttpResponse(status=204)
            resp["Access-Control-Allow-Origin"] = origin
            resp["Access-Control-Allow-Credentials"] = "true"
            return resp

        # Normal request — capture timing
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

            # Inject browser scripts into HTML responses
            content_type = response.get("Content-Type", "")
            if "text/html" in content_type:
                html = response.content.decode("utf-8", errors="replace")
                injected = inject_scripts(html)
                if injected is not html:
                    encoded = injected.encode("utf-8")
                    response.content = encoded
                    response["Content-Length"] = len(encoded)

        return response


def close() -> None:
    """Stop the debugger."""
    if _instance:
        _instance.close()
