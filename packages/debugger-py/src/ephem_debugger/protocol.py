"""Protocol types matching shared/protocol/schema.json."""
from __future__ import annotations

import hashlib
import os
import random
import time
from dataclasses import asdict, dataclass, field
from typing import Any


def generate_id() -> str:
    """Generate a 6-char hex entry ID."""
    return f"{random.randint(0, 0xFFFFFF):06x}"


@dataclass
class ConsoleEntry:
    """A console log entry."""

    type: str = "console"
    level: str = "info"
    args: list[Any] = field(default_factory=list)
    timestamp: int = 0
    source: str = "server"
    id: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a protocol-compatible dict."""
        d = asdict(self)
        if not d["id"]:
            d["id"] = generate_id()
        return d


@dataclass
class ErrorEntry:
    """An error log entry."""

    type: str = "error"
    message: str = ""
    timestamp: int = 0
    source: str = "server"
    stack: str | None = None
    id: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a protocol-compatible dict."""
        d = asdict(self)
        if not d["id"]:
            d["id"] = generate_id()
        # Remove None values
        return {k: v for k, v in d.items() if v is not None}


@dataclass
class SessionInfo:
    """Session metadata sent with status responses."""

    session_id: str = ""
    framework: str = ""
    port: int = 0
    pid: int = 0
    started_at: int = 0
    socket_path: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to camelCase protocol format."""
        return {
            "sessionId": self.session_id,
            "framework": self.framework,
            "port": self.port,
            "pid": self.pid,
            "startedAt": self.started_at,
            "socketPath": self.socket_path,
        }


def compute_socket_path(cwd: str | None = None) -> str:
    """Compute the IPC socket path for the given directory.

    Args:
        cwd: Working directory. Defaults to os.getcwd().

    Returns:
        Socket path string (Unix socket or Windows named pipe path).
    """
    cwd = cwd or os.getcwd()
    if os.name == "nt":
        h = hashlib.md5(cwd.lower().encode()).hexdigest()[:8]
        return rf"\\.\pipe\debugger-{h}"
    return os.path.join(cwd, ".debugger", "bridge.sock")


def create_session(framework: str, port: int) -> SessionInfo:
    """Create a new session with a unique ID.

    Args:
        framework: Framework name (e.g. "fastapi", "django", "flask").
        port: Server port number.

    Returns:
        A new SessionInfo instance.
    """
    cwd = os.getcwd()
    return SessionInfo(
        session_id=generate_id(),
        framework=framework,
        port=port,
        pid=os.getpid(),
        started_at=int(time.time() * 1000),
        socket_path=compute_socket_path(cwd),
    )
