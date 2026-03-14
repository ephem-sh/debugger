import { LogStore } from '../../core/log-store.js'
import { createSession } from '../../core/session.js'
import { createBridge } from '../../ipc/server.js'
import { patchConsole } from '../../server/patch-console.js'
import { installHttpIntercept } from './ingest-server.js'

declare global {
  var __DEBUGGER_ACTIVE__: boolean | undefined
  var __DEBUGGER_LOG_STORE__: LogStore | undefined
}

/**
 * Register debugger instrumentation for Next.js.
 *
 * Call this from your `instrumentation.ts` file:
 * ```ts
 * export { register } from '@ephem-sh/debugger/nextjs'
 * ```
 *
 * Starts the IPC bridge, patches server console, and intercepts
 * HTTP requests for browser log ingestion. No-ops in production
 * and in background workers.
 */
export async function register(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return
  if (globalThis.__DEBUGGER_ACTIVE__) return

  if (process.argv?.some(
    (arg: string) => arg.includes('detached-flush') || arg.includes('telemetry')
  )) return

  const devPort = parseInt(process.env.PORT || '3000', 10)
  const session = createSession({ framework: 'next', port: devPort })
  const logStore = new LogStore(session)
  globalThis.__DEBUGGER_LOG_STORE__ = logStore
  globalThis.__DEBUGGER_ACTIVE__ = true

  const unpatchConsole = patchConsole(logStore)
  const uninstallIntercept = installHttpIntercept(logStore)

  try {
    const bridge = createBridge(logStore, session)
    await bridge.start()
  } catch {
    // IPC bridge is optional — warn handled inside createBridge
  }

  console.log(`\x1b[32m✓\x1b[0m @ephem-sh/debugger injected at session: ${session.sessionId}`)

  const cleanup = async () => {
    unpatchConsole()
    uninstallIntercept()
  }

  process.on('SIGINT', () => cleanup().then(() => process.exit(0)))
  process.on('SIGTERM', () => cleanup().then(() => process.exit(0)))
}
