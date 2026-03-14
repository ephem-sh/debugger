# debugger

Dev-only observability for AI agent debugging. One package, 11
frameworks, zero production footprint.

> **Note:** This is a preview feature currently under active
> development.

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
