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

interface HonoContext {
  req: {
    url: string
    method: string
    header: (name: string) => string | undefined
    json: () => Promise<unknown>
  }
  res: { status: number }
  text: (body: string, status: number, headers: Record<string, string>) => Response
}

/**
 * Hono middleware for debugger instrumentation.
 *
 * Creates the full debugger stack (log store, IPC bridge, console patching)
 * and returns a middleware function that handles browser script serving,
 * ingest, CORS, and HTTP request timing.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { debuggerMiddleware } from '@ephem-sh/debugger/hono'
 *
 * const app = new Hono()
 * app.use(debuggerMiddleware({ port: 3000 }))
 * ```
 *
 * @param opts - Optional framework name and port override
 * @returns Hono middleware function
 */
export function debuggerMiddleware(opts: { port?: number; framework?: string } = {}) {
  if (process.env['NODE_ENV'] === 'production') {
    return async (_c: HonoContext, next: () => Promise<void>) => { await next() }
  }

  const port = opts.port || Number(process.env['PORT']) || 3000
  const framework = opts.framework || 'hono'
  const session = createSession({ framework, port })
  const logStore = new LogStore(session)
  ;(globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ = logStore

  patchConsole(logStore)
  createBridge(logStore, session).start().catch(() => {})

  process.stdout.write(`\x1b[32m>\x1b[0m \x1b[1m@ephem-sh/debugger\x1b[0m: session \x1b[36m${session.sessionId}\x1b[0m\n`)

  return async (c: HonoContext, next: () => Promise<void>) => {
    const url = new URL(c.req.url)

    if (url.pathname === '/_/d.js' && c.req.method === 'GET') {
      if (cachedScript === undefined) {
        const p = findBrowserScript()
        cachedScript = p ? fs.readFileSync(p, 'utf-8') : null
      }
      return c.text(cachedScript || '// not found', 200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-store',
      })
    }

    if (url.pathname === '/_/d' && c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': c.req.header('origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (url.pathname === '/_/d' && c.req.method === 'POST') {
      try {
        const entries = await c.req.json() as unknown[]
        if (Array.isArray(entries)) {
          for (const entry of entries) logStore.push(entry as LogEntry)
        }
      } catch {}
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': c.req.header('origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }

    const start = Date.now()
    await next()

    if (!url.pathname.startsWith('/_/d')) {
      logStore.push({
        type: 'network',
        url: url.pathname,
        method: c.req.method,
        status: c.res.status,
        duration: Date.now() - start,
        timestamp: start,
        failed: c.res.status >= 500,
        source: 'browser',
      })
    }
  }
}
