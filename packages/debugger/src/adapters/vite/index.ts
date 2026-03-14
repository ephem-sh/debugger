import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LogStore } from '../../core/log-store.js'
import { createSession } from '../../core/session.js'
import { createBridge } from '../../ipc/server.js'
import { patchConsole } from '../../server/patch-console.js'
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

/**
 * Vite plugin for debugger instrumentation.
 *
 * Add to your `vite.config.ts`:
 * ```ts
 * import { debuggerPlugin } from '@ephem-sh/debugger/vite'
 *
 * export default defineConfig({
 *   plugins: [debuggerPlugin()],
 * })
 * ```
 *
 * Dev-only. Automatically excluded from production builds via `apply: 'serve'`.
 */
export function debuggerPlugin(): Plugin {
  let cachedScriptPath: string | null | undefined

  return {
    name: '@ephem-sh/debugger',
    apply: 'serve',

    configureServer(server) {
      const port = typeof server.config.server.port === 'number'
        ? server.config.server.port
        : 5173
      const session = createSession({ framework: 'vite', port })
      const logStore = new LogStore(session)
      ;(globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ = logStore

      const unpatchConsole = patchConsole(logStore)

      createBridge(logStore, session).start().catch(() => {
        // IPC bridge is optional
      })

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
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
          return
        }

        if (req.url === '/_/d.js' && req.method === 'GET') {
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
            res.end('// debugger browser script read failed')
          }
          return
        }

        next()
      })

      server.httpServer?.on('close', () => {
        unpatchConsole()
      })

      // Return post-hook: runs after Vite's internal server setup
      // Override printUrls to append our message after Vite's banner
      return () => {
        const origPrintUrls = server.printUrls
        server.printUrls = () => {
          origPrintUrls()
          server.config.logger.info(`  \x1b[32m➜\x1b[0m  \x1b[1m@ephem-sh/debugger\x1b[0m: session \x1b[36m${session.sessionId}\x1b[0m`)
        }
      }
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: 'window.__DEBUGGER_INGEST_URL__="/_/d";',
          injectTo: 'body' as const,
        },
        {
          tag: 'script',
          attrs: { src: '/_/d.js', defer: true },
          injectTo: 'body' as const,
        },
      ]
    },
  }
}

export default debuggerPlugin
