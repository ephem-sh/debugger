/**
 * Nuxt render hook for debugger HTML injection.
 *
 * Nuxt uses Nitro for SSR and bypasses Vite's `transformIndexHtml`.
 * This hook injects the browser client via Nuxt's `render:html` hook.
 *
 * Add to your `nuxt.config.ts`:
 * ```ts
 * import { debuggerPlugin } from '@ephem-sh/debugger/vite'
 * import { debuggerNuxtHook } from '@ephem-sh/debugger/vite/nuxt'
 *
 * export default defineNuxtConfig({
 *   vite: {
 *     plugins: [debuggerPlugin()],
 *   },
 *   hooks: {
 *     'render:html': debuggerNuxtHook,
 *   },
 * })
 * ```
 */

/** Shape of the context passed to Nuxt's `render:html` hook. */
interface NuxtRenderHtmlContext {
  body: string[]
  bodyAppend: string[]
  bodyPrepend: string[]
  head: string[]
  htmlAttrs: string[]
  bodyAttrs: string[]
}

/**
 * Nuxt `render:html` hook that appends debugger script tags to the body.
 *
 * Injects the ingest URL global and the browser client script as the last
 * elements before `</body>`, matching the pattern used by other adapters.
 */
export function debuggerNuxtHook(html: NuxtRenderHtmlContext): void {
  const snippet = `<script>window.__DEBUGGER_INGEST_URL__="/_/d";</script><script src="/_/d.js" defer></script>`
  html.bodyAppend.push(snippet)
}
