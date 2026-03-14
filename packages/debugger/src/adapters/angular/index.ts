import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LogStore } from '../../core/log-store.js'
import { createSession } from '../../core/session.js'
import { createBridge } from '../../ipc/server.js'
import { patchConsole } from '../../server/patch-console.js'
import type { LogEntry } from '../../core/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Instrument an Express app with debugger observability.
 *
 * Sets up the full debugger stack: log store, IPC bridge, console
 * patching, and HTTP middleware for browser log ingestion. Dev-only —
 * no-ops if `NODE_ENV` is `production`.
 *
 * Usage in Angular's `src/server.ts`:
 * ```ts
 * import { instrumentExpress } from '@ephem-sh/debugger/angular'
 * const app = express()
 * instrumentExpress(app)
 * ```
 *
 * @param app - Express application instance
 * @param opts - Optional framework name and port override
 */
export function instrumentExpress(
  app: {
    options: (path: string, handler: (...args: unknown[]) => void) => void
    post: (path: string, handler: (...args: unknown[]) => void) => void
    get: (path: string, handler: (...args: unknown[]) => void) => void
  },
  opts?: { framework?: string; port?: number }
): void {
  if (process.env['NODE_ENV'] === 'production') return

  const framework = opts?.framework || 'angular'
  const port = opts?.port || Number(process.env['PORT']) || 4200
  const session = createSession({ framework, port })
  const logStore = new LogStore(session)
  ;(globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ = logStore

  patchConsole(logStore)

  createBridge(logStore, session).start().catch(() => {})

  let cachedScript: string | null | undefined

  function findScript(): string | null {
    const fromDist = path.resolve(__dirname, '..', '..', 'browser', 'client.js')
    if (fs.existsSync(fromDist)) return fromDist
    const fromCwd = path.resolve(process.cwd(), 'node_modules', '@ephem-sh', 'debugger', 'dist', 'browser', 'client.js')
    if (fs.existsSync(fromCwd)) return fromCwd
    return null
  }

  // CORS preflight
  app.options('/_/d', ((_req: unknown, _res: unknown) => {
    const req = _req as { headers?: Record<string, string | undefined> }
    const res = _res as { writeHead: (status: number, headers: Record<string, string>) => void; end: () => void }
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers?.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
  }) as (...args: unknown[]) => void)

  // Ingest
  app.post('/_/d', ((_req: unknown, _res: unknown) => {
    const req = _req as { headers?: Record<string, string | undefined>; on: (event: string, handler: (chunk: Buffer) => void) => void }
    const res = _res as { writeHead: (status: number, headers: Record<string, string>) => void; end: () => void }
    const origin = req.headers?.origin || '*'
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
          for (const entry of entries) logStore.push(entry)
        }
      } catch {}
    }) as (chunk: Buffer) => void)
  }) as (...args: unknown[]) => void)

  // Client script
  app.get('/_/d.js', ((_req: unknown, _res: unknown) => {
    const res = _res as { writeHead: (status: number, headers?: Record<string, string>) => void; end: (body?: string) => void }
    if (cachedScript === undefined) {
      const p = findScript()
      cachedScript = p ? fs.readFileSync(p, 'utf-8') : null
    }
    if (cachedScript) {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' })
      res.end(cachedScript)
    } else {
      res.writeHead(500)
      res.end('// debugger browser script not found')
    }
  }) as (...args: unknown[]) => void)

  process.stdout.write(`\x1b[32m>\x1b[0m \x1b[1m@ephem-sh/debugger\x1b[0m: session \x1b[36m${session.sessionId}\x1b[0m\n`)
}
