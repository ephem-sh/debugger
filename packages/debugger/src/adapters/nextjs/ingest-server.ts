import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LogStore } from '../../core/log-store.js'
import type { LogEntry } from '../../core/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Locate the browser client script using multiple fallback strategies.
 * Returns the absolute path if found, or `null` if all strategies fail.
 */
function findBrowserScript(): string | null {
  const fromDist = path.resolve(__dirname, '..', '..', 'browser', 'client.js')
  if (fs.existsSync(fromDist)) return fromDist

  const fromCwd = path.resolve(process.cwd(), 'node_modules', '@ephem-sh', 'debugger', 'dist', 'browser', 'client.js')
  if (fs.existsSync(fromCwd)) return fromCwd

  return null
}

let cachedScriptPath: string | null | undefined

/**
 * Intercept HTTP requests on all servers in the process to handle
 * the debugger ingest endpoint and client script on the same origin.
 *
 * Patches `http.Server.prototype.emit` to intercept `request` events
 * for `/_/d` (POST, ingest) and `/_/d.js` (GET, client script) before
 * the framework's request handler runs.
 *
 * @param logStore - The log store to push incoming browser entries into
 * @returns Restore function that removes the intercept
 */
export function installHttpIntercept(logStore: LogStore): () => void {
  const origEmit = http.Server.prototype.emit

  const patched = function (
    this: http.Server,
    event: string,
    ...args: unknown[]
  ): boolean {
    if (event === 'request') {
      const req = args[0] as http.IncomingMessage
      const res = args[1] as http.ServerResponse

      if (req.url === '/_/d' && req.method === 'POST') {
        handleIngest(req, res, logStore)
        return true
      }

      if (req.url === '/_/d.js' && req.method === 'GET') {
        handleClientScript(res)
        return true
      }
    }

    return Reflect.apply(origEmit, this, [event, ...args]) as boolean
  }

  http.Server.prototype.emit = patched as typeof origEmit

  return () => {
    http.Server.prototype.emit = origEmit
  }
}

function handleIngest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  logStore: LogStore
): void {
  const origin = req.headers.origin || '*'
  const chunks: Buffer[] = []

  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    })
    res.end()

    try {
      const body = Buffer.concat(chunks).toString()
      const entries: LogEntry[] = JSON.parse(body)

      if (Array.isArray(entries)) {
        for (const entry of entries) {
          logStore.push(entry)
        }
      }
    } catch {
      // Malformed payload — silently drop
    }
  })
}

function handleClientScript(res: http.ServerResponse): void {
  if (cachedScriptPath === undefined) {
    cachedScriptPath = findBrowserScript()
  }

  if (!cachedScriptPath) {
    res.writeHead(500)
    res.end('// debugger browser script not found — run bun run build:browser')
    return
  }

  try {
    const script = fs.readFileSync(cachedScriptPath, 'utf-8')
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store',
    })
    res.end(script)
  } catch {
    res.writeHead(500)
    res.end('// debugger browser script read failed at ' + cachedScriptPath)
  }
}
