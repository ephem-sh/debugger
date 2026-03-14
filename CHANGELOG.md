# Changelog

## [Unreleased]

### @ephem-sh/debuger

#### Added
- CLI entry point with command routing and argument parsing
- Socket client with Unix domain socket and Windows named pipe support
- Commands: `errors`, `console`, `network`, `status`, `all`
- Flags: `--last`, `--level`, `--status`, `--failed`, `--limit`, `--json`
- ANSI-colored human-readable output and JSON output mode

### @ephem-sh/debuger-core

#### Added
- Generic ring buffer with configurable capacity
- Log store managing categorized ring buffers (console, errors, network)
- IPC server over Unix domain sockets and Windows named pipes
- Session manager with framework and port metadata
- Server-side console patching (log, warn, error, debug, info)
- Shared TypeScript types for log entries and IPC messages

### @ephem-sh/debuger-browser

#### Added
- Browser instrumentation script (IIFE) for dev injection
- Console interception (log, warn, error, debug, info)
- Fetch and XMLHttpRequest interception with duration tracking
- Error and unhandled rejection listeners
- Batched beacon sends with flush-on-unload
- Safe serialization with circular reference detection

### @ephem-sh/debuger-next

#### Added
- `withDebuger()` config wrapper for `next.config.ts`
- Webpack client entry injection for browser script
- Internal ingest HTTP server for browser log beacons
- Next.js rewrite rules proxying `/__debuger/*` to ingest server
- Dev-only guard that passes through production builds untouched
