import React from 'react'

declare global {
  var __DEBUGGER_ACTIVE__: boolean | undefined
}

/**
 * Inject the debugger browser instrumentation script.
 *
 * Add this to your root layout:
 * ```tsx
 * import { DebuggerScript } from '@ephem-sh/debugger/nextjs/script'
 * // inside <body>:
 * <DebuggerScript />
 * ```
 */
export function DebuggerScript(): React.ReactElement | null {
  if (process.env.NODE_ENV !== 'development') return null
  if (!globalThis.__DEBUGGER_ACTIVE__) return null

  return React.createElement(React.Fragment, null,
    React.createElement('script', {
      dangerouslySetInnerHTML: {
        __html: `window.__DEBUGGER_INGEST_URL__="/_/d";`
      },
    }),
    React.createElement('script', {
      src: '/_/d.js',
      defer: true,
    }),
  )
}
