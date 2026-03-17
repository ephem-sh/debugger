import { definePlugin } from "nitro"

export default definePlugin((nitroApp) => {
  if (!import.meta.dev) return

  const getStore = () =>
    (globalThis as Record<string, unknown>).__DEBUGGER_LOG_STORE__ as
      | { push: (entry: unknown) => void }
      | undefined

  nitroApp.hooks.hook("request", (event) => {
    event.context._debuggerStart = Date.now()
  })

  nitroApp.hooks.hook("response", (_res, event) => {
    const store = getStore()
    if (!store) return

    const url = event.path
    if (url.startsWith("/_/d")) return

    const start = (event.context._debuggerStart as number) || Date.now()
    store.push({
      type: "network",
      url,
      method: event.method,
      status: _res.status,
      duration: Date.now() - start,
      timestamp: start,
      failed: _res.status >= 500,
      source: "browser",
    })
  })
})
