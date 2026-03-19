---
title: debugger CLI reference
description: Complete CLI reference for the dbg command — scopes, commands, flags, output format, and JSON parsing.
---

# CLI

The CLI is `dbg`, installed via `@ephem-sh/debugger`. Run with
`npx dbg` (or `pnpm exec dbg`, `bunx dbg`).

## Scopes and commands

### Server scope

| Command | What it shows |
|---------|---------------|
| `npx dbg server console` | Server-side console output (log, warn, error, debug, info) |
| `npx dbg server errors` | Server-side unhandled errors with stack traces |

### Browser scope

| Command | What it shows |
|---------|---------------|
| `npx dbg browser console` | Browser console output |
| `npx dbg browser errors` | Browser JS errors and unhandled rejections |
| `npx dbg browser network` | Fetch, XHR, and WebSocket requests |
| `npx dbg browser cookies` | Cookie names, values, flags |
| `npx dbg browser storage` | localStorage and sessionStorage |
| `npx dbg browser permissions` | Permission states (camera, geo, etc.) |
| `npx dbg browser quota` | Storage usage and quota |

### Top-level commands

| Command | What it shows |
|---------|---------------|
| `npx dbg status` | Session info (framework, port, PID, uptime) |
| `npx dbg all` | All entries merged chronologically (default command) |
| `npx dbg sessions` | All active debugger sessions |

## Flags

| Flag | Applies to | Effect |
|------|-----------|--------|
| `--json` | all | Output raw JSON instead of formatted text |
| `--limit N` | all | Max entries returned (default 50) |
| `--last 30s` | all | Only entries within time window (units: ms, s, m, h) |
| `--level error` | console | Filter by log level |
| `--status 404` | network | Filter by HTTP status code |
| `--failed` | network | Show only failed requests |
| `--id abc123` | network | Show single entry detail view |
| `--ids a1 b2 c3` | network | Show multiple entries in detail |
| `--headers` | network (with --id) | Include request/response headers |
| `--body` | network (with --id) | Include response body |
| `--name session` | cookies | Filter by cookie name |
| `--key theme` | storage | Filter by storage key |
| `--type local` | storage | Filter by storage type (local or session) |
| `--port 3000` | all | Target session by port |
| `--session dev-a1b2c3` | all | Target session by ID |
| `--cwd /path` | all | Override working directory for session discovery |

## Output format (text)

### Console entries

```
HH:MM:SS ID     LEVEL [source] message
15:03:11 9c9047 LOG   [browser] [debugger:test] log {"id":"d6d9aff7"}
15:03:11 8eae90 WARN  [browser] [debugger:test] warn {"id":"e6b8e8e1"}
15:03:12 f76480 ERROR [browser] [debugger:test] error {"id":"20d8e9f5"}
```

### Error entries

```
HH:MM:SS ID     ERROR [source] message
  stack line 1
  stack line 2 (max 5 lines)

15:03:12 265521 ERROR [browser] Uncaught Error: unhandled 8e58bfab
  Error: unhandled 8e58bfab
  at http://localhost:5173/src/App.tsx:108:16
```

### Network entries

```
HH:MM:SS ID     STATUS METHOD URL (duration)
15:03:14 cc636e 200    GET    https://jsonplaceholder.typicode.com/posts/1 (125ms)
15:03:15 b92adf 201    POST   https://jsonplaceholder.typicode.com/posts (320ms)
15:03:16 2fa6c7 1005   WS     wss://echo.websocket.org (3044ms)
```

### Network detail (with --id --headers)

```
ID:       b92adf
URL:      https://jsonplaceholder.typicode.com/posts
Method:   POST
Status:   201
Duration: 320ms
Failed:   false
Kind:     fetch
Time:     15:03:15

Request Headers:
  Content-Type: application/json
  X-Debug-Id: 56b98420

Response Headers:
  content-type: application/json; charset=utf-8
  content-length: 97
```

### Status

```
Session:   dev-9183f9
Framework: vite
Port:      5173
PID:       280288
Uptime:    3m 32s
```

### Sessions

```
  ID             Framework    Port    PID      Dir
  ────────────── ──────────── ─────── ──────── ──────────────
  dev-9183f9     vite         5173    280288   /path/to/project
```

### Cookies

```
Cookies (3)
  debugger_fetch_f3442ea0=true
  session_id=abc123 Secure, SameSite=Strict, Expires=2026-03-20T...
```

### Storage

```
localStorage (2)
  theme = dark
  user_prefs = {"lang":"en","notifications":true}

sessionStorage (1)
  form_draft = {"title":"..."}
```

### Permissions

```
Permissions
  geolocation          denied
  notifications        prompt
  camera               prompt
  clipboard-read       granted
  clipboard-write      granted
```

### Quota

```
Storage Quota
  Usage: 482.8 KB
  Quota: 10.0 GB
  Used:  0.0%
```

### Empty result

```
No entries found.
```

## JSON output

Add `--json` to any command. The output is a JSON array of entries
(or a single object for `status`).

### Console entry

```json
{
  "type": "console",
  "level": "warn",
  "args": ["[debugger:test] warn", {"id": "e6b8e8e1"}],
  "timestamp": 1773943391828,
  "source": "browser",
  "browser": "Chrome",
  "id": "8eae90"
}
```

### Error entry

```json
{
  "type": "error",
  "message": "Uncaught Error: unhandled 8e58bfab",
  "stack": "Error: unhandled 8e58bfab\n  at App.tsx:108:16",
  "timestamp": 1773943392000,
  "source": "browser",
  "id": "265521"
}
```

### Network entry

```json
{
  "type": "network",
  "url": "https://jsonplaceholder.typicode.com/posts",
  "method": "POST",
  "status": 201,
  "duration": 320,
  "timestamp": 1773943395000,
  "failed": false,
  "source": "browser",
  "kind": "fetch",
  "id": "b92adf",
  "requestHeaders": {"Content-Type": "application/json"},
  "responseHeaders": {"content-type": "application/json; charset=utf-8"}
}
```

### Status (--json)

```json
{
  "sessionId": "dev-9183f9",
  "framework": "vite",
  "port": 5173,
  "pid": 280288,
  "startedAt": 1773943205709,
  "socketPath": "\\\\.\\pipe\\debugger-4d372f60"
}
```

## Parsing tips

Use `--json` and pipe to `jq` for targeted queries:

```bash
# Get the last error message
npx dbg browser errors --json --limit 1 | jq -r '.[0].message'

# List all failed network URLs
npx dbg browser network --json --failed | jq -r '.[].url'

# Get server warnings from last 5 minutes
npx dbg server console --json --level warn --last 5m | jq '.[].args'

# Check if a specific cookie exists
npx dbg browser cookies --json --name session_id | jq 'length > 0'

# Get the response headers for a request
npx dbg browser network --json --id b92adf | jq '.[0].responseHeaders'
```

## Multiple sessions

When multiple dev servers run simultaneously, `dbg` discovers all
sessions automatically. Target a specific one:

```bash
npx dbg server console --port 3000
npx dbg browser errors --session dev-a1b2c3
```

List all active sessions:

```bash
npx dbg sessions
```
