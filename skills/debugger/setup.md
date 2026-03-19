---
title: debugger setup
description: How to install and instrument debugger in a project. Covers all languages and frameworks.
---

# Setup

## Check if debugger is already installed

```bash
npx dbg status
```

If this prints session info, debugger is already running. Skip to
`./cli.md`.

If it fails with "No active debugger session found," continue below.

## Install

### Node.js

```bash
npm install -D @ephem-sh/debugger
```

Then instrument your framework. Each adapter is a one-line setup:

| Framework | Setup |
|-----------|-------|
| Next.js | Export `register` and `onRequestError` from `@ephem-sh/debugger/nextjs` in `instrumentation.ts`, add `<DebuggerScript />` from `@ephem-sh/debugger/nextjs/script` to layout |
| Vite (React, Vue) | Add `debuggerPlugin()` from `@ephem-sh/debugger/vite` to `vite.config.ts` plugins |
| SvelteKit | Vite plugin + `handleDebugger()` from `@ephem-sh/debugger/vite/sveltekit` in `hooks.server.ts` |
| React Router | Vite plugin + `<DebuggerScript />` from `@ephem-sh/debugger/vite/react-router` in `root.tsx` |
| Astro | Vite plugin + `debuggerMiddleware()` from `@ephem-sh/debugger/vite/astro` in `middleware.ts` |
| Nuxt | Vite plugin in `nuxt.config.ts` + Nitro plugin from `@ephem-sh/debugger/nitro` |
| Express | `instrumentExpress(app)` from `@ephem-sh/debugger/express` |
| Hono | `app.use(debuggerMiddleware({ port }))` from `@ephem-sh/debugger/hono` |
| Elysia | `app.use(debuggerPlugin({ port }))` from `@ephem-sh/debugger/elysia` |
| Fastify | `fastify.register(debuggerPlugin, { port })` from `@ephem-sh/debugger/fastify` |
| NestJS | `initDebugger()` + `app.use(DebuggerMiddleware)` from `@ephem-sh/debugger/nest` |

For detailed setup instructions per framework, fetch the docs:
`https://debugger.ephem.sh/examples/node/{framework}.md`

### Go

```bash
go get github.com/ephem-sh/debugger/packages/ephem-debugger-go
```

Frameworks: Gin, Echo, Chi. Setup is three lines: `debugger.New()`,
`defer dbg.Close()`, `r.Use(dbg.Middleware(port))`.

Full guides: `https://debugger.ephem.sh/examples/go/{framework}.md`

### Python

```bash
pip install ephem-debugger-py
```

Frameworks: FastAPI (`[fastapi]`), Flask (`[flask]`), Django
(`[django]`). Install with the extras for your framework.

Full guides:
`https://debugger.ephem.sh/examples/python/{framework}.md`

### Rust

```toml
[dependencies]
ephem-debugger-rs = { version = "0.3", features = ["axum"] }
```

Frameworks: Axum, Actix, Rocket, Poem. Enable the feature flag for
your framework.

Full guides: `https://debugger.ephem.sh/examples/rust/{framework}.md`

## Verify

After instrumenting, start the dev server and run:

```bash
npx dbg status
```

Expected output:

```
Session:   dev-a1b2c3
Framework: vite
Port:      5173
PID:       12345
Uptime:    5s
```

If this works, debugger is ready. Read `./cli.md` for usage.

## Notes

- debugger no-ops in production. Node.js adapters check `NODE_ENV`.
  Go, Python, and Rust require a manual environment guard.
- The `dbg` CLI comes from the `@ephem-sh/debugger` npm package. For
  Go, Python, and Rust projects, install the npm package alongside
  your language-specific package to get the CLI.
- debugger stores data in memory only. No files are written except a
  temporary `.debugger/session.json` for session discovery.
