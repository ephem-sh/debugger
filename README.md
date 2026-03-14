# debuger

Dev-only observability layer that lets AI agents inspect runtime
errors, console logs, and network requests during development.

> **Note:** This is a preview feature currently under active
> development.

Instead of manually copying stack traces and console output into an
AI chat, debuger captures runtime signals in-memory and exposes them
through a CLI that agents can call directly.

```
developer runs dev server
  → error occurs
  → developer asks agent: "check the error"
  → agent runs: debuger errors
  → agent receives the stack trace and diagnoses the problem
```

## Packages

debuger is a monorepo published under the `@ephem-sh` npm scope.

| Package | Description |
|---------|-------------|
| `@ephem-sh/debuger` | CLI tool (bin: `debuger`) |
| `@ephem-sh/debuger-core` | Ring buffer, log store, IPC bridge, session manager |
| `@ephem-sh/debuger-browser` | Browser instrumentation script (console, fetch, error hooks) |
| `@ephem-sh/debuger-next` | Next.js adapter |

## Quick start

Install the CLI globally:

```bash
npm install -g @ephem-sh/debuger
```

Add the framework adapter to your project as a dev dependency:

```bash
npm install -D @ephem-sh/debuger-next
```

Configure your framework. For Next.js, update `next.config.ts`:

```ts
import { withDebuger } from '@ephem-sh/debuger-next/config'

export default withDebuger({
  // your existing Next.js config
})
```

Start your dev server and use the CLI:

```bash
debuger errors              # runtime errors
debuger console             # console output
debuger network             # network requests
debuger status              # session info
```

## CLI usage

The CLI connects to the running dev server over a local socket,
queries in-memory logs, and prints the results.

```bash
debuger <command> [flags]
```

### Commands

- `errors` — runtime errors and unhandled rejections
- `console` — console.log, warn, error, debug, and info output
- `network` — fetch and XMLHttpRequest activity
- `status` — current dev session info
- `all` — all log types combined

### Flags

- `--last <duration>` — filter by time window (for example, `30s`,
  `5m`, `1h`)
- `--level <level>` — filter console logs by level (`log`, `warn`,
  `error`, `debug`, `info`)
- `--status <code>` — filter network requests by HTTP status code
- `--failed` — show only failed network requests
- `--limit <n>` — cap the number of results (default: 50)
- `--json` — output structured JSON for agent consumption

### Agent-friendly output

Use the `--json` flag for structured output that agents can parse
directly:

```bash
debuger errors --json --last 60s
```

## How it works

debuger captures three categories of runtime signals:

- **Browser signals** — console output, runtime errors, unhandled
  promise rejections, fetch requests, and XMLHttpRequest activity.
  A small script is auto-injected during development that intercepts
  these signals and sends them to the dev server via
  `navigator.sendBeacon`.

- **Server signals** — console output and stack traces from the
  Node.js process. Captured by patching `console` methods at server
  startup.

- **Network signals** — request URL, method, status code, duration,
  and failure state for all intercepted fetch and XHR calls.

All logs are stored in fixed-capacity ring buffers in the dev
server's memory. Nothing is written to disk. When the dev server
stops, logs disappear.

The CLI communicates with the dev server over a Unix domain socket
(macOS and Linux) or a Windows named pipe. The protocol is
newline-delimited JSON (NDJSON).

## Project structure

```
apps/cli/                  CLI tool
packages/node/core/        Core library (ring buffer, IPC, session)
packages/node/browser/     Browser instrumentation script
packages/node/next/        Next.js adapter
shared/protocol/           IPC protocol specification (internal)
examples/nextjs/           Example Next.js app
```

## Development

debuger uses [Bun](https://bun.sh) workspaces for development.

Install dependencies:

```bash
bun install
```

Run typechecks:

```bash
cd packages/node/core && bun run typecheck
cd packages/node/browser && bun run typecheck
cd packages/node/next && bun run typecheck
cd apps/cli && bun run typecheck
```

## License

MIT
