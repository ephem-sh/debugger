import React from 'react'

/**
 * Inject the debugger browser instrumentation script for React Router v7.
 *
 * Add to your `app/root.tsx` Layout, after `<Scripts />`:
 * ```tsx
 * import { DebuggerScript } from '@ephem-sh/debugger/vite/react-router'
 *
 * export function Layout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html lang="en">
 *       <body>
 *         {children}
 *         <Scripts />
 *         <DebuggerScript />
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 *
 * Dev-only. Returns null in production.
 */
export function DebuggerScript(): React.ReactElement | null {
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) return null

  return React.createElement(React.Fragment, null,
    React.createElement('script', {
      dangerouslySetInnerHTML: {
        __html: `window.__DEBUGGER_INGEST_URL__="/_/d";`,
      },
    }),
    React.createElement('script', {
      src: '/_/d.js',
      defer: true,
    }),
  )
}
