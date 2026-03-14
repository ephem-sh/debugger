/**
 * Astro middleware for debugger HTML injection.
 *
 * Astro does SSR and bypasses Vite's `transformIndexHtml`, so this
 * middleware intercepts HTML responses and injects the browser client.
 *
 * Add to your `src/middleware.ts`:
 * ```ts
 * export { onRequest } from '@ephem-sh/debugger/vite/astro'
 * ```
 *
 * If you have existing middleware, compose with `sequence`:
 * ```ts
 * import { sequence } from 'astro:middleware'
 * import { onRequest as debuggerMiddleware } from '@ephem-sh/debugger/vite/astro'
 * export const onRequest = sequence(debuggerMiddleware, yourMiddleware)
 * ```
 */
export async function onRequest(context: { request: Request }, next: () => Promise<Response>): Promise<Response> {
  const response = await next()

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  const html = await response.text()
  if (!html.includes('</body>') || html.includes('__DEBUGGER_INGEST_URL__')) return response

  const snippet = `<script>window.__DEBUGGER_INGEST_URL__="/_/d";</script><script src="/_/d.js" defer></script>`
  const modified = html.replace('</body>', `${snippet}</body>`)

  return new Response(modified, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
