import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type { LogEntry } from '../../core/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Server entry shape returned by TanStack Start's `createServerEntry`. */
interface ServerEntry {
  fetch: (request: Request) => Response | Promise<Response>
}

/** Options accepted by TanStack Start's `createServerEntry`. */
interface CreateServerEntryOptions {
  fetch: (request: Request) => Response | Promise<Response>
}

/**
 * Locate the browser client script using multiple fallback strategies.
 * Returns the script content if found, or `null` if all strategies fail.
 */
function findBrowserScript(): string | null {
  const fromDist = path.resolve(__dirname, '..', '..', 'browser', 'client.js')
  if (fs.existsSync(fromDist)) return fs.readFileSync(fromDist, 'utf-8')

  const fromCwd = path.resolve(process.cwd(), 'node_modules', '@ephem-sh', 'debugger', 'dist', 'browser', 'client.js')
  if (fs.existsSync(fromCwd)) return fs.readFileSync(fromCwd, 'utf-8')

  return null
}

/**
 * Push log entries to the debugger bridge via IPC or the in-process log store.
 *
 * Tries the in-process `globalThis.__DEBUGGER_LOG_STORE__` first (when the
 * Vite plugin runs in the same process), then falls back to an IPC socket
 * connection for out-of-process scenarios.
 */
function pushEntries(entries: unknown[]): void {
  const store = (globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ as
    | { push: (entry: LogEntry) => void }
    | undefined

  if (store) {
    for (const entry of entries) {
      store.push(entry as LogEntry)
    }
    return
  }

  const hash = createHash('md5').update(process.cwd()).digest('hex').slice(0, 8)
  const pipePath = process.platform === 'win32'
    ? `\\\\.\\pipe\\debugger-${hash}`
    : path.join(process.cwd(), '.debugger', 'bridge.sock')

  try {
    const socket = net.createConnection(pipePath, () => {
      socket.write(JSON.stringify({ id: 'push', command: 'push', entries }) + '\n')
      socket.end()
    })
    socket.on('error', () => {})
  } catch {}
}

/**
 * Wrap a TanStack Start server entry with debugger instrumentation.
 *
 * Intercepts `/_/d` (POST ingest), `/_/d.js` (GET client script),
 * and CORS preflight before passing requests to the app handler.
 * Browser log entries are pushed to the debugger log store via the
 * in-process store or IPC bridge.
 *
 * Usage in `src/server.ts`:
 * ```ts
 * import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
 * import { withDebugger } from '@ephem-sh/debugger/vite/tanstack-start'
 *
 * export default withDebugger(createServerEntry, handler)
 * ```
 */
export function withDebugger(
  createServerEntry: (opts: CreateServerEntryOptions) => ServerEntry,
  handler: ServerEntry,
): ServerEntry {
  let cachedScript: string | null | undefined

  return createServerEntry({
    async fetch(request: Request) {
      const url = new URL(request.url)

      if (url.pathname === '/_/d' && request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })
      }

      if (url.pathname === '/_/d' && request.method === 'POST') {
        try {
          const entries: unknown = await request.json()
          if (Array.isArray(entries)) pushEntries(entries)
        } catch {}
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
            'Access-Control-Allow-Credentials': 'true',
          },
        })
      }

      if (url.pathname === '/_/d.js' && request.method === 'GET') {
        if (cachedScript === undefined) cachedScript = findBrowserScript()
        if (cachedScript) {
          return new Response(cachedScript, {
            headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
          })
        }
      }

      return handler.fetch(request)
    },
  })
}
