# debugger

Dev-only observability for AI agent debugging. 4 languages, 21
frameworks, zero production footprint.

Agents when don't run the own servers don't have terminal context, to get information from browsers we often need MCP servers, and pasting information back to agents is a time consuming process. Debugger is aimed for you who don't want to run mcp servers and usually preferer running servers in separated terminals instead of bloating agent context with outputs, now agents can do all that and filter what they need to debug using proper filters.

> **Note:** This is a preview feature currently under active development.

```bash
npm install -D @ephem-sh/debugger
```

debugger captures browser and server-side logs, errors, network
requests, and application state from your running dev server. AI
agents query this data through the `dbg` CLI.

```
dbg browser console           # browser console logs
dbg server console            # server console logs
dbg browser network           # fetch, xhr, websocket
dbg browser cookies           # document cookies
dbg browser storage           # localStorage + sessionStorage
dbg status                    # session info
dbg all --json                # everything as JSON
```

## Supported frameworks

### Node.js — `@ephem-sh/debugger`

| Framework | Setup | Adapter |
|-----------|-------|---------|
| Next.js | 2 files | `@ephem-sh/debugger/nextjs` |
| React + Vite | 1 file | `@ephem-sh/debugger/vite` |
| Vue + Vite | 1 file | `@ephem-sh/debugger/vite` |
| SvelteKit | 2 files | `@ephem-sh/debugger/vite` + `/vite/sveltekit` |
| React Router v7 | 2 files | `@ephem-sh/debugger/vite` + `/vite/react-router` |
| Astro | 2 files | `@ephem-sh/debugger/vite` + `/vite/astro` |
| Nuxt | 2 files | `@ephem-sh/debugger/vite` + `/nitro` |
| Qwik | 2 files | `@ephem-sh/debugger/vite` |
| TanStack Start | 3 files | `@ephem-sh/debugger/vite` + `/vite/tanstack-start` |
| Waku | 1 file | `@ephem-sh/debugger/vite` |
| Angular | 2 files | `@ephem-sh/debugger/angular` |

### Go — `debugger-go`

| Framework | Setup | Middleware |
|-----------|-------|-----------|
| Gin | 3 lines | `middleware/gin` |
| Echo | 3 lines | `middleware/echo` |
| Chi | 3 lines | `middleware/chi` |

### Python — `ephem-debugger`

| Framework | Setup | Middleware |
|-----------|-------|-----------|
| FastAPI | 2 lines | `ephem_debugger.middleware.fastapi` |
| Flask | 2 lines | `ephem_debugger.middleware.flask` |
| Django | 1 line | `ephem_debugger.middleware.django` |

### Rust — `ephem-debugger`

| Framework | Setup | Feature |
|-----------|-------|---------|
| Axum | 3 lines | `axum` |
| Actix-web | 3 lines | `actix` |
| Rocket | 3 lines | `rocket` |
| Poem | 3 lines | `poem` |

## Quick start (Vite + React)

Add the plugin to your Vite config:

```ts
// vite.config.ts
import { debuggerPlugin } from '@ephem-sh/debugger/vite'

export default defineConfig({
  plugins: [react(), debuggerPlugin()],
})
```

Start your dev server, then query:

```bash
npx dbg status
npx dbg browser console
```

## How it works

1. **Server instrumentation** patches `console.*` and starts an IPC
   bridge when your dev server boots.
2. **Browser client** (auto-injected IIFE) captures console, errors,
   network, cookies, storage, permissions, and quota.
3. **CLI (`dbg`)** queries the session over IPC and returns structured
   output.

All data lives in memory (ring buffers). Nothing is written to disk.
Zero production footprint — all adapters no-op outside development.

## Development

```bash
bun install                     # install deps
bun run build                   # build package
bun run typecheck               # typecheck
bun run examples                # list example apps
bun run install:example nextjs  # install example deps
bun run dev:example nextjs      # run example dev server
```

## Documentation

- [Getting started](docs/introduction/getting-started.mdx)
- [CLI reference](docs/api/reference.mdx)
- Framework guides in [docs/examples/](docs/examples/)

## License

MIT
