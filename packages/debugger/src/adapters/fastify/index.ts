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

interface FastifyRequest {
  method: string
  url: string
  headers: Record<string, string | undefined>
  body: unknown
  _debuggerStart?: number
}

interface FastifyReply {
  type: (contentType: string) => FastifyReply
  header: (name: string, value: string) => FastifyReply
  headers: (hdrs: Record<string, string>) => FastifyReply
  status: (code: number) => FastifyReply
  statusCode: number
  send: (payload?: string | null) => void
}

interface FastifyInstance {
  get: (path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>) => void
  post: (path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>) => void
  options: (path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>) => void
  addHook: (name: string, handler: (...args: unknown[]) => Promise<void>) => void
}

/**
 * Fastify plugin for debugger instrumentation.
 *
 * Creates the full debugger stack (log store, IPC bridge, console patching)
 * and registers routes and hooks for browser script serving, ingest, CORS,
 * and HTTP request timing.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify'
 * import { debuggerPlugin } from '@ephem-sh/debugger/fastify'
 *
 * const app = Fastify()
 * app.register(debuggerPlugin, { port: 3000 })
 * app.listen({ port: 3000 })
 * ```
 *
 * @param fastify - Fastify instance
 * @param opts - Optional port override
 */
export async function debuggerPlugin(fastify: FastifyInstance, opts: { port?: number } = {}): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') return

  const port = opts.port || Number(process.env['PORT']) || 3000
  const session = createSession({ framework: 'fastify', port })
  const logStore = new LogStore(session)
  ;(globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ = logStore

  patchConsole(logStore)
  createBridge(logStore, session).start().catch(() => {})

  process.stdout.write(`\x1b[32m>\x1b[0m \x1b[1m@ephem-sh/debugger\x1b[0m: session \x1b[36m${session.sessionId}\x1b[0m\n`)

  fastify.get('/_/d.js', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (cachedScript === undefined) {
      const p = findBrowserScript()
      cachedScript = p ? fs.readFileSync(p, 'utf-8') : null
    }
    reply.type('application/javascript').header('cache-control', 'no-store').send(cachedScript || '// not found')
  })

  fastify.options('/_/d', async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin || '*'
    reply.status(204).headers({
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    }).send()
  })

  fastify.post('/_/d', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const entries = request.body
      if (Array.isArray(entries)) {
        for (const entry of entries) logStore.push(entry as LogEntry)
      }
    } catch {}
    const origin = request.headers.origin || '*'
    reply.status(204).headers({
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
    }).send()
  })

  fastify.addHook('onRequest', async (request: unknown) => {
    (request as FastifyRequest)._debuggerStart = Date.now()
  })

  fastify.addHook('onResponse', async (request: unknown, reply: unknown) => {
    const req = request as FastifyRequest
    const rep = reply as FastifyReply
    const start = req._debuggerStart || Date.now()
    if (req.url.startsWith('/_/d')) return
    logStore.push({
      type: 'network',
      url: req.url,
      method: req.method,
      status: rep.statusCode,
      duration: Date.now() - start,
      timestamp: start,
      failed: rep.statusCode >= 500,
      source: 'browser',
    })
  })
}
