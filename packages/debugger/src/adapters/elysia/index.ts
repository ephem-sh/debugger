import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LogStore } from '../../core/log-store.js'
import { createSession } from '../../core/session.js'
import { createBridge } from '../../ipc/server.js'
import { patchConsole } from '../../server/patch-console.js'
import type { LogEntry } from '../../core/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function findBrowserScript(): string | null {
  const fromDist = path.resolve(__dirname, '..', '..', 'browser', 'client.js')
  if (fs.existsSync(fromDist)) return fromDist
  const fromCwd = path.resolve(process.cwd(), 'node_modules', '@ephem-sh', 'debugger', 'dist', 'browser', 'client.js')
  if (fs.existsSync(fromCwd)) return fromCwd
  return null
}

let cachedScript: string | null | undefined

interface ElysiaApp {
  get: (path: string, handler: (ctx: ElysiaContext) => Response | string) => ElysiaApp
  post: (path: string, handler: (ctx: ElysiaContext) => Response | string) => ElysiaApp
  options: (path: string, handler: (ctx: ElysiaContext) => Response | string) => ElysiaApp
  onAfterHandle: (handler: (ctx: ElysiaAfterContext) => void) => ElysiaApp
}

interface ElysiaContext {
  body: unknown
  headers: Record<string, string | undefined>
  request: Request
}

interface ElysiaAfterContext {
  request: Request
  set: { status?: number }
}

/**
 * Elysia plugin for debugger instrumentation.
 *
 * Creates the full debugger stack (log store, IPC bridge, console patching)
 * and returns a plugin function that registers routes and lifecycle hooks.
 *
 * @example
 * ```ts
 * import { Elysia } from 'elysia'
 * import { debuggerPlugin } from '@ephem-sh/debugger/elysia'
 *
 * const app = new Elysia()
 *   .use(debuggerPlugin({ port: 3000 }))
 *   .listen(3000)
 * ```
 *
 * @param opts - Optional port override
 * @returns Elysia plugin function
 */
export function debuggerPlugin(opts: { port?: number } = {}) {
  if (process.env['NODE_ENV'] === 'production') {
    return (app: ElysiaApp) => app
  }

  const port = opts.port || Number(process.env['PORT']) || 3000
  const session = createSession({ framework: 'elysia', port })
  const logStore = new LogStore(session)
  ;(globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ = logStore

  patchConsole(logStore)
  createBridge(logStore, session).start().catch(() => {})

  process.stdout.write(`\x1b[32m>\x1b[0m \x1b[1m@ephem-sh/debugger\x1b[0m: session \x1b[36m${session.sessionId}\x1b[0m\n`)

  return (app: ElysiaApp) => {
    app.get('/_/d.js', () => {
      if (cachedScript === undefined) {
        const p = findBrowserScript()
        cachedScript = p ? fs.readFileSync(p, 'utf-8') : null
      }
      return new Response(cachedScript || '// not found', {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
      })
    })

    app.options('/_/d', ({ headers }: ElysiaContext) => {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    })

    app.post('/_/d', ({ body, headers }: ElysiaContext) => {
      try {
        if (Array.isArray(body)) {
          for (const entry of body) logStore.push(entry as LogEntry)
        }
      } catch {}
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    })

    app.onAfterHandle(({ request, set }: ElysiaAfterContext) => {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/_/d')) return
      logStore.push({
        type: 'network',
        url: url.pathname,
        method: request.method,
        status: set.status || 200,
        duration: 0,
        timestamp: Date.now(),
        failed: (set.status || 200) >= 500,
        source: 'browser',
      })
    })

    return app
  }
}
