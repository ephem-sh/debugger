# @ephem-sh/debugger

Dev-only observability for AI agent debugging. Captures browser and server-side logs, errors, network requests, and application state from your dev server. AI agents query this data through the `dbg` CLI.

> **Preview** — under active development.

## Install

```bash
npm install -D @ephem-sh/debugger
```

## Quick start (Vite + React)

```ts
// vite.config.ts
import { debuggerPlugin } from '@ephem-sh/debugger/vite'

export default defineConfig({
  plugins: [react(), debuggerPlugin()],
})
```

```bash
npx dbg status
npx dbg browser console
npx dbg browser network
```

## Supported frameworks

| Framework | Adapter |
|-----------|---------|
| Next.js | `@ephem-sh/debugger/nextjs` |
| React + Vite | `@ephem-sh/debugger/vite` |
| Vue + Vite | `@ephem-sh/debugger/vite` |
| SvelteKit | `@ephem-sh/debugger/vite` + `/vite/sveltekit` |
| React Router v7 | `@ephem-sh/debugger/vite` + `/vite/react-router` |
| Astro | `@ephem-sh/debugger/vite` + `/vite/astro` |
| Nuxt | `@ephem-sh/debugger/vite` + `/nitro` |
| Qwik | `@ephem-sh/debugger/vite` |
| TanStack Start | `@ephem-sh/debugger/vite` + `/vite/tanstack-start` |
| Waku | `@ephem-sh/debugger/vite` |
| Angular | `@ephem-sh/debugger/angular` |
| Express | `@ephem-sh/debugger/express` |
| Hono | `@ephem-sh/debugger/hono` |
| Elysia | `@ephem-sh/debugger/elysia` |
| Fastify | `@ephem-sh/debugger/fastify` |
| NestJS | `@ephem-sh/debugger/nest` |
| AdonisJS | `@ephem-sh/debugger/adonis` |
| Nitro | `@ephem-sh/debugger/nitro` |

## CLI

```
dbg browser console          # browser console logs
dbg browser errors           # browser errors
dbg browser network          # fetch, xhr, websocket
dbg browser cookies          # document cookies
dbg browser storage          # localStorage + sessionStorage
dbg server console           # server console logs
dbg server errors            # server errors
dbg status                   # session info
dbg all --json               # everything as JSON
```

## How it works

1. Server instrumentation patches `console.*` and starts an IPC bridge
2. Browser client (auto-injected) captures console, errors, network, cookies, storage
3. CLI queries the session over IPC and returns structured output

All data in memory (ring buffers). Zero production footprint.

## Other languages

- **Go** — [`ephem-debugger-go`](https://github.com/ephem-sh/debugger/tree/main/packages/debugger-go) (Gin, Echo, Chi)
- **Python** — [`ephem-debugger-py`](https://pypi.org/project/ephem-debugger-py/) (FastAPI, Flask, Django)
- **Rust** — [`ephem-debugger-rs`](https://crates.io/crates/ephem-debugger-rs) (Axum, Actix, Rocket, Poem)

## License

MIT
