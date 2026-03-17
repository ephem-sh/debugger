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

interface NodeRequest {
  url: string
  method: string
  headers: Record<string, string | undefined>
  on: (event: string, handler: (chunk: Buffer) => void) => void
}

interface NodeResponse {
  writeHead: (status: number, headers?: Record<string, string>) => void
  end: (body?: string) => void
  statusCode: number
}

/**
 * Initialize the debugger for NestJS.
 *
 * Call once before creating the NestJS application. Sets up the log store,
 * IPC bridge, and console patching. Use {@link DebuggerMiddleware} in your
 * AppModule to handle HTTP instrumentation.
 *
 * @example
 * ```ts
 * import { initDebugger } from '@ephem-sh/debugger/nest'
 * initDebugger({ port: 3000 })
 * ```
 *
 * @param opts - Optional port override
 */
export function initDebugger(opts: { port?: number } = {}): void {
  if (process.env['NODE_ENV'] === 'production') return

  const port = opts.port || Number(process.env['PORT']) || 3000
  const session = createSession({ framework: 'nest', port })
  _logStore = new LogStore(session)
  ;(globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ = _logStore

  patchConsole(_logStore)
  createBridge(_logStore, session).start().catch(() => {})

  process.stdout.write(`\x1b[32m>\x1b[0m \x1b[1m@ephem-sh/debugger\x1b[0m: session \x1b[36m${session.sessionId}\x1b[0m\n`)
}

/**
 * NestJS-compatible Express middleware class for debugger instrumentation.
 *
 * Handles browser script serving, ingest endpoint, CORS preflight,
 * and HTTP request timing. Must be applied via `MiddlewareConsumer`
 * after calling {@link initDebugger}.
 *
 * @example
 * ```ts
 * import { DebuggerMiddleware } from '@ephem-sh/debugger/nest'
 *
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(DebuggerMiddleware).forRoutes('*')
 *   }
 * }
 * ```
 */
export class DebuggerMiddleware {
  /** Handle an incoming request through the debugger middleware. */
  use(req: NodeRequest, res: NodeResponse, next: () => void): void {
    if (!_logStore) return next()

    const store = _logStore

    if (req.url === '/_/d.js' && req.method === 'GET') {
      if (cachedScript === undefined) {
        const p = findBrowserScript()
        cachedScript = p ? fs.readFileSync(p, 'utf-8') : null
      }
      if (cachedScript) {
        res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' })
        res.end(cachedScript)
      } else {
        res.writeHead(500)
        res.end('// debugger browser script not found')
      }
      return
    }

    if (req.url === '/_/d' && req.method === 'OPTIONS') {
      const origin = req.headers.origin || '*'
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    if (req.url === '/_/d' && req.method === 'POST') {
      const origin = req.headers.origin || '*'
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', (() => {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        })
        res.end()
        try {
          const entries: LogEntry[] = JSON.parse(Buffer.concat(chunks).toString())
          if (Array.isArray(entries)) {
            for (const entry of entries) store.push(entry)
          }
        } catch {}
      }) as (chunk: Buffer) => void)
      return
    }

    const start = Date.now()
    const origEnd = res.end.bind(res)
    res.end = ((body?: string) => {
      if (!req.url.startsWith('/_/d')) {
        store.push({
          type: 'network',
          url: req.url,
          method: req.method,
          status: res.statusCode,
          duration: Date.now() - start,
          timestamp: start,
          failed: res.statusCode >= 500,
          source: 'browser',
        })
      }
      return origEnd(body)
    }) as NodeResponse['end']

    next()
  }
}
