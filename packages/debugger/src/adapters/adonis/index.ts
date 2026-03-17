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
let _logStore: LogStore | null = null

interface AdonisRequest {
  url: () => string
  method: () => string
  header: (name: string) => string | undefined
  body: () => unknown
}

interface AdonisResponse {
  header: (name: string, value: string) => void
  status: (code: number) => void
  getStatus: () => number
  send: (body: string) => void
}

interface AdonisContext {
  request: AdonisRequest
  response: AdonisResponse
}

/**
 * Initialize the debugger for AdonisJS.
 *
 * Call once during application boot (e.g., in a provider or `start/kernel.ts`).
 * Sets up the log store, IPC bridge, and console patching. Use
 * {@link DebuggerMiddleware} as a global middleware for HTTP instrumentation.
 *
 * @example
 * ```ts
 * import { initDebugger } from '@ephem-sh/debugger/adonis'
 * initDebugger({ port: 3333 })
 * ```
 *
 * @param opts - Optional port override (defaults to 3333)
 */
export function initDebugger(opts: { port?: number } = {}): void {
  if (process.env['NODE_ENV'] === 'production') return

  const port = opts.port || Number(process.env['PORT']) || 3333
  const session = createSession({ framework: 'adonis', port })
  _logStore = new LogStore(session)
  ;(globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ = _logStore

  patchConsole(_logStore)
  createBridge(_logStore, session).start().catch(() => {})

  process.stdout.write(`\x1b[32m>\x1b[0m \x1b[1m@ephem-sh/debugger\x1b[0m: session \x1b[36m${session.sessionId}\x1b[0m\n`)
}

/**
 * AdonisJS middleware class for debugger instrumentation.
 *
 * Handles browser script serving, ingest endpoint, CORS preflight,
 * and HTTP request timing. Register as a global middleware after
 * calling {@link initDebugger}.
 *
 * @example
 * ```ts
 * // start/kernel.ts
 * import { DebuggerMiddleware } from '@ephem-sh/debugger/adonis'
 * server.use([() => import('#middleware/debugger_middleware')])
 * ```
 */
export class DebuggerMiddleware {
  /** Handle an incoming request through the debugger middleware. */
  async handle(ctx: AdonisContext, next: () => Promise<void>): Promise<void> {
    if (!_logStore) return next()

    const store = _logStore
    const req = ctx.request
    const res = ctx.response

    if (req.url() === '/_/d.js' && req.method() === 'GET') {
      if (cachedScript === undefined) {
        const p = findBrowserScript()
        cachedScript = p ? fs.readFileSync(p, 'utf-8') : null
      }
      res.header('content-type', 'application/javascript')
      res.header('cache-control', 'no-store')
      return res.send(cachedScript || '// not found')
    }

    if (req.url() === '/_/d' && req.method() === 'OPTIONS') {
      const origin = req.header('origin') || '*'
      res.status(204)
      res.header('access-control-allow-origin', origin)
      res.header('access-control-allow-credentials', 'true')
      res.header('access-control-allow-methods', 'POST, GET, OPTIONS')
      res.header('access-control-allow-headers', 'Content-Type')
      return res.send('')
    }

    if (req.url() === '/_/d' && req.method() === 'POST') {
      const origin = req.header('origin') || '*'
      try {
        // Parse body manually — AdonisJS body parser may not have run yet
        let entries = req.body()
        if (!entries || (typeof entries === 'object' && !Array.isArray(entries) && Object.keys(entries as object).length === 0)) {
          // Body parser hasn't run — read raw body from the underlying Node request
          const raw = await new Promise<string>((resolve) => {
            const chunks: Buffer[] = []
            const nodeReq = (req as unknown as { request?: { on: Function } }).request
            if (nodeReq && typeof nodeReq.on === 'function') {
              nodeReq.on('data', (c: Buffer) => chunks.push(c))
              nodeReq.on('end', () => resolve(Buffer.concat(chunks).toString()))
            } else {
              resolve('[]')
            }
          })
          entries = JSON.parse(raw)
        }
        if (Array.isArray(entries)) {
          for (const entry of entries) store.push(entry as LogEntry)
        }
      } catch {}
      res.status(204)
      res.header('access-control-allow-origin', origin)
      res.header('access-control-allow-credentials', 'true')
      return res.send('')
    }

    const start = Date.now()
    await next()

    const url = req.url()
    if (!url.startsWith('/_/d')) {
      store.push({
        type: 'network',
        url,
        method: req.method(),
        status: res.getStatus(),
        duration: Date.now() - start,
        timestamp: start,
        failed: res.getStatus() >= 500,
        source: 'browser',
      })
    }
  }
}
