import type { LogStore } from '../../core/log-store.js'

declare global {
  var __DEBUGGER_LOG_STORE__: LogStore | undefined
}

/**
 * Next.js `onRequestError` handler for SSR error capture.
 *
 * Export this from your `instrumentation.ts`:
 * ```ts
 * export { onRequestError } from '@ephem-sh/debugger/nextjs'
 * ```
 *
 * Captures server-side rendering errors into the debugger log store.
 */
export function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
): void {
  const logStore = globalThis.__DEBUGGER_LOG_STORE__
  if (!logStore) return

  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined

  logStore.push({
    type: 'error',
    message,
    stack,
    timestamp: Date.now(),
    source: 'server',
    url: request.path,
    component: `${context.routerKind}:${context.routePath} (${context.routeType}/${context.renderSource})`,
  })
}
