import http from 'node:http'
import type { LogStore } from '@ephem-sh/debuger-core'
import type { LogEntry } from '@ephem-sh/debuger-core'

/**
 * A tiny HTTP server that receives browser beacons and serves the client
 * script. The Next.js rewrite rules proxy /__debuger/* to this server so
 * the browser never has to know the actual port.
 */
export function createIngestServer(logStore: LogStore) {
  let server: http.Server | null = null

  async function start(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      server = http.createServer((req, res) => {
        // CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          res.end()
          return
        }

        if (req.url === '/ingest' && req.method === 'POST') {
          return handleIngest(req, res)
        }

        if (req.url === '/client.js' && req.method === 'GET') {
          return handleClientScript(res)
        }

        res.writeHead(404)
        res.end('Not found')
      })

      server.listen(0, '127.0.0.1', () => {
        const addr = server!.address()
        if (typeof addr === 'object' && addr) {
          resolve(addr.port)
        } else {
          reject(new Error('Failed to bind ingest server'))
        }
      })

      server.on('error', reject)
    })
  }

  function handleIngest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
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
    // Serve a minimal redirect notice — the actual browser client is
    // injected as a webpack entry via the config wrapper, so this
    // endpoint exists only as a fallback for manual <script> inclusion.
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store',
    })
    res.end(
      '// @ephem-sh/debuger-browser client\n' +
        '// This script is normally injected via webpack entry.\n' +
        '// If you see this, the webpack injection is active and\n' +
        '// you do not need this <script> tag.\n'
    )
  }

  async function stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!server) return resolve()
      server.close(() => resolve())
    })
  }

  return { start, stop }
}
