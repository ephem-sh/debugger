# Debugger IPC Protocol

Internal protocol for communication between the CLI client and the dev server bridge.

## Transport

Messages are sent as **newline-delimited JSON (NDJSON)** over a local socket.

### Socket paths

| Platform | Path |
|----------|------|
| Unix/macOS | `<project-root>/.debugger/bridge.sock` |
| Windows | `\\.\pipe\debugger-<hash>` (hash derived from project root) |

## Message format

### Request

```json
{ "id": "abc123", "command": "errors", "filters": { "last": 60, "limit": 50 } }
```

- `id` — unique request identifier (UUID or similar)
- `command` — one of `errors`, `console`, `network`, `status`, `all`
- `filters` (optional) — `last` (seconds), `level`, `status` (HTTP code), `failed` (bool), `limit`

### Response

```json
{ "id": "abc123", "ok": true, "data": [...], "session": { ... } }
```

- `id` — matches the request
- `ok` — success flag
- `data` — array of log entries
- `session` (optional) — current session info

## Log entry types

| Type | Key fields |
|------|------------|
| `console` | level, args, timestamp, source |
| `error` | message, stack, timestamp, source, url?, component? |
| `network` | url, method, status, duration, timestamp, requestHeaders?, responseHeaders? |
| `context` | url, framework, sessionId, port, pid, startedAt |

`source` is always `"browser"` or `"server"`.

See `schema.json` for the full JSON Schema (draft-07) definition.
