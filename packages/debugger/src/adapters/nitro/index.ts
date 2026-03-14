import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Locate the browser client script.
 */
function findBrowserScript(): string | null {
  const fromDist = path.resolve(__dirname, '..', '..', 'browser', 'client.js')
  if (fs.existsSync(fromDist)) return fromDist

  const fromCwd = path.resolve(process.cwd(), 'node_modules', '@ephem-sh', 'debugger', 'dist', 'browser', 'client.js')
  if (fs.existsSync(fromCwd)) return fromCwd

  return null
}

let cachedScript: string | null | undefined

/**
 * Nitro plugin for debugger ingest and client script serving.
 *
 * Hooks into Nitro's `request` lifecycle and uses `event.respondWith()`
 * to handle `/_/d` and `/_/d.js` before route matching. Works with any
 * Nitro-based framework (Nuxt, TanStack Start, Analog, etc.).
 *
 * Create `server/plugins/debugger.ts`:
 * ```ts
 * export { default } from '@ephem-sh/debugger/nitro'
 * ```
 *
 * The Vite plugin (`@ephem-sh/debugger/vite`) must also be added
 * to your Vite config for server-side instrumentation (console
 * patching, IPC bridge).
 */
export default function debuggerNitroPlugin(nitroApp: {
  hooks: {
    hook: (event: string, handler: (...args: unknown[]) => void | Promise<void>) => void
  }
}): void {
  nitroApp.hooks.hook('request', (_event: unknown) => {
    const event = _event as {
      path: string
      method: string
      respondWith: (response: Response) => void
      node: {
        req: import('node:http').IncomingMessage
        res: import('node:http').ServerResponse
      }
    }
    const url = event.path

    // CORS preflight
    if (url === '/_/d' && event.method === 'OPTIONS') {
      event.respondWith(new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': event.node.req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }))
      return
    }

    // Ingest endpoint
    if (url === '/_/d' && event.method === 'POST') {
      const origin = event.node.req.headers.origin || '*'
      const chunks: Buffer[] = []

      event.node.req.on('data', (chunk: Buffer) => chunks.push(chunk))
      event.node.req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString()
          const entries: unknown[] = JSON.parse(body)
          const store = (globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ as
            | { push: (entry: unknown) => void }
            | undefined

          if (store && Array.isArray(entries)) {
            for (const entry of entries) {
              store.push(entry)
            }
          }
        } catch {}
      })

      event.respondWith(new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      }))
      return
    }

    // Browser client script
    if (url === '/_/d.js' && event.method === 'GET') {
      if (cachedScript === undefined) {
        const scriptPath = findBrowserScript()
        cachedScript = scriptPath ? fs.readFileSync(scriptPath, 'utf-8') : null
      }

      if (!cachedScript) {
        event.respondWith(new Response('// debugger browser script not found', { status: 500 }))
      } else {
        event.respondWith(new Response(cachedScript, {
          status: 200,
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-store',
          },
        }))
      }
      return
    }
  })

  // HTML injection for SSR frameworks (Nuxt) that support render:html
  nitroApp.hooks.hook('render:html', (_html: unknown) => {
    const html = _html as { bodyAppend?: string[] }
    if (html.bodyAppend) {
      html.bodyAppend.push(
        `<script>window.__DEBUGGER_INGEST_URL__="/_/d";</script><script src="/_/d.js" defer></script>`
      )
    }
  })
}
