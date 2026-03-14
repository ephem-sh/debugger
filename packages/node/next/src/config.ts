import type { NextConfig } from 'next'
import {
  LogStore,
  createSession,
  createBridge,
  patchConsole,
} from '@ephem-sh/debuger-core'
import { createIngestServer } from './ingest-server.js'

let initialized = false
let ingestPort: number | null = null

export function withDebuger(nextConfig: NextConfig = {}): NextConfig {
  if (process.env.NODE_ENV === 'production') return nextConfig

  return {
    ...nextConfig,

    async rewrites() {
      const existing = await nextConfig.rewrites?.()

      const debugerRewrites = ingestPort
        ? [
            {
              source: '/__debuger/ingest',
              destination: `http://127.0.0.1:${ingestPort}/ingest`,
            },
            {
              source: '/__debuger/client.js',
              destination: `http://127.0.0.1:${ingestPort}/client.js`,
            },
          ]
        : []

      // Next.js rewrites can be an array or an object with
      // beforeFiles / afterFiles / fallback
      if (!existing || Array.isArray(existing)) {
        return [...(existing ?? []), ...debugerRewrites]
      }

      return {
        ...existing,
        beforeFiles: [...(existing.beforeFiles ?? []), ...debugerRewrites],
      }
    },

    webpack(config, options) {
      // Call user's webpack config first
      if (typeof nextConfig.webpack === 'function') {
        config = nextConfig.webpack(config, options)
      }

      // Start server instrumentation once (first webpack compilation = dev start)
      if (options.isServer && !initialized) {
        initialized = true
        initServer()
      }

      // Inject browser entry into client builds only
      if (!options.isServer) {
        const originalEntry = config.entry
        config.entry = async () => {
          const entries =
            typeof originalEntry === 'function'
              ? await originalEntry()
              : originalEntry

          // Inject our browser entry into the main-app bundle.
          // Next.js names the main client entry "main-app" (app router)
          // or "main" (pages router). We try both.
          const browserEntryPath = require.resolve(
            '@ephem-sh/debuger-browser/src/client'
          )

          for (const key of ['main-app', 'main']) {
            const entry = entries[key]
            if (!entry) continue

            const imports: string[] = entry.import ?? entry
            if (Array.isArray(imports) && !imports.includes(browserEntryPath)) {
              if (entry.import) {
                entry.import = [browserEntryPath, ...entry.import]
              } else {
                entries[key] = [browserEntryPath, ...imports]
              }
            }
          }

          return entries
        }
      }

      return config
    },
  }
}

async function initServer(): Promise<void> {
  const devPort = parseInt(process.env.PORT || '3000', 10)

  const session = createSession({ framework: 'next', port: devPort })
  const logStore = new LogStore(session)

  const unpatchConsole = patchConsole(logStore)

  const bridge = createBridge(logStore, session)
  await bridge.start()

  const ingestServer = createIngestServer(logStore)
  const port = await ingestServer.start()
  ingestPort = port

  const cleanup = async () => {
    unpatchConsole()
    await bridge.stop()
    await ingestServer.stop()
  }

  process.on('SIGINT', () => cleanup().then(() => process.exit(0)))
  process.on('SIGTERM', () => cleanup().then(() => process.exit(0)))
}
