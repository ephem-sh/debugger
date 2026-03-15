"""IPC bridge -- NDJSON server for the dbg CLI."""
from __future__ import annotations

import json
import os
import socket
import threading
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .store import LogStore


class Bridge:
    """NDJSON IPC server that the dbg CLI connects to.

    On Windows, uses TCP on localhost with a .debugger/bridge.addr discovery
    file. On Unix, uses a Unix domain socket.
    """

    def __init__(self, store: LogStore, socket_path: str) -> None:
        self._store = store
        self._socket_path = socket_path
        self._server: socket.socket | None = None
        self._thread: threading.Thread | None = None
        self._running = False

    def start(self) -> None:
        """Start listening for CLI connections."""
        if os.name == "nt":
            self._start_tcp()
        else:
            self._start_unix()

    def _start_unix(self) -> None:
        sock_dir = os.path.dirname(self._socket_path)
        os.makedirs(sock_dir, exist_ok=True)
        try:
            os.unlink(self._socket_path)
        except OSError:
            pass

        self._server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self._server.bind(self._socket_path)
        self._server.listen(5)
        self._server.settimeout(1.0)
        self._running = True
        self._thread = threading.Thread(target=self._accept_loop, daemon=True)
        self._thread.start()

    def _start_tcp(self) -> None:
        self._server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._server.bind(("127.0.0.1", 0))
        self._server.listen(5)
        self._server.settimeout(1.0)

        addr = self._server.getsockname()
        addr_str = f"{addr[0]}:{addr[1]}"

        # Write addr file so CLI can discover us
        addr_dir = os.path.join(os.getcwd(), ".debugger")
        os.makedirs(addr_dir, exist_ok=True)
        addr_file = os.path.join(addr_dir, "bridge.addr")
        with open(addr_file, "w") as f:
            f.write(addr_str)

        self._running = True
        self._thread = threading.Thread(target=self._accept_loop, daemon=True)
        self._thread.start()

    def _accept_loop(self) -> None:
        while self._running:
            try:
                if self._server is None:
                    break
                conn, _ = self._server.accept()
                threading.Thread(
                    target=self._handle_conn, args=(conn,), daemon=True
                ).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def _handle_conn(self, conn: socket.socket) -> None:
        try:
            data = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
                while b"\n" in data:
                    line, data = data.split(b"\n", 1)
                    if not line.strip():
                        continue
                    self._handle_request(conn, line)
        except OSError:
            pass
        finally:
            conn.close()

    def _handle_request(self, conn: socket.socket, line: bytes) -> None:
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            return

        req_id = req.get("id", "")
        command = req.get("command", "")

        if command == "push":
            # Push entries from external sources
            entries = req.get("entries", [])
            if isinstance(entries, list):
                for entry in entries:
                    self._store.push(entry)
            resp = {"id": req_id, "ok": True, "data": []}
        elif command == "status":
            resp = {
                "id": req_id,
                "ok": True,
                "data": [],
                "session": self._store.session.to_dict(),
            }
        else:
            filters = req.get("filters")
            data = self._store.query(command, filters)
            resp = {"id": req_id, "ok": True, "data": data}

        try:
            conn.sendall(json.dumps(resp).encode() + b"\n")
        except OSError:
            pass

    def stop(self) -> None:
        """Stop the bridge and clean up socket/addr files."""
        self._running = False
        if self._server:
            self._server.close()
        if self._thread:
            self._thread.join(timeout=2)

        # Cleanup
        if os.name != "nt":
            try:
                os.unlink(self._socket_path)
            except OSError:
                pass
        else:
            try:
                addr_file = os.path.join(os.getcwd(), ".debugger", "bridge.addr")
                os.unlink(addr_file)
            except OSError:
                pass
