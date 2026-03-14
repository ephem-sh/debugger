/**
 * SvelteKit HTML injection hook.
 *
 * SvelteKit bypasses Vite's `transformIndexHtml`, so this hook
 * injects the debugger script tags via `transformPageChunk`.
 *
 * Add to your `src/hooks.server.ts`:
 * ```ts
 * export { handle } from '@ephem-sh/debugger/vite/sveltekit'
 * ```
 *
 * If you have existing hooks, compose with `sequence`:
 * ```ts
 * import { sequence } from '@sveltejs/kit/hooks'
 * import { handle as debuggerHandle } from '@ephem-sh/debugger/vite/sveltekit'
 * export const handle = sequence(debuggerHandle, yourHandle)
 * ```
 */
export function handle({ event, resolve }: { event: unknown; resolve: (event: unknown, opts?: unknown) => Promise<Response> }): Promise<Response> {
  return resolve(event, {
    transformPageChunk: ({ html }: { html: string }) => {
      if (html.includes('</body>') && !html.includes('__DEBUGGER_INGEST_URL__')) {
        const snippet = `<script>window.__DEBUGGER_INGEST_URL__="/_/d";</script><script src="/_/d.js" defer></script>`
        return html.replace('</body>', `${snippet}</body>`)
      }
      return html
    },
  })
}
