import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: App })

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "14px",
  fontWeight: 500,
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  background: "none",
  cursor: "pointer",
}

function removeCookies() {
  document.cookie.split(";").forEach(c => {
    const name = c.split("=")[0].trim()
    if (name.startsWith("debugger_") || name.startsWith("dbg_")) {
      document.cookie = name + "=; path=/; max-age=0"
    }
  })
}

function clearLocal() {
  Object.keys(localStorage).filter(k => k.startsWith("dbg_") || k.startsWith("debugger_")).forEach(k => localStorage.removeItem(k))
}

function clearSession() {
  Object.keys(sessionStorage).filter(k => k.startsWith("dbg_") || k.startsWith("debugger_")).forEach(k => sessionStorage.removeItem(k))
}

function App() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 24px" }}>TanStack Start — Debugger Test</h1>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "#6b7280" }}>Console & Errors</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={btnStyle} onClick={() => console.log("[debugger:test] log", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() })}>console.log</button>
          <button style={btnStyle} onClick={() => console.warn("[debugger:test] warn", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() })}>console.warn</button>
          <button style={btnStyle} onClick={() => console.error("[debugger:test] error", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() }, new Error("test error"))}>console.error</button>
          <button style={btnStyle} onClick={() => setTimeout(() => { throw new Error("unhandled " + crypto.randomUUID().slice(0, 8)) }, 0)}>Throw Error</button>
          <button style={btnStyle} onClick={() => Promise.reject(new Error("rejection " + crypto.randomUUID().slice(0, 8)))}>Unhandled Rejection</button>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "#6b7280" }}>Network</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={btnStyle} onClick={() => fetch("/api/test?id=" + crypto.randomUUID().slice(0, 8))}>Fetch Success</button>
          <button style={btnStyle} onClick={() => fetch("/api/test?error=true&id=" + crypto.randomUUID().slice(0, 8))}>Fetch Error</button>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "#6b7280" }}>Application State</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={btnStyle} onClick={() => { document.cookie = "debugger_test_" + Date.now().toString(36) + "=value_" + Math.random().toString(36).slice(2, 6) + "; path=/; max-age=3600; SameSite=Lax" }}>Set Cookie</button>
          <button style={btnStyle} onClick={removeCookies}>Remove Cookies</button>
          <button style={btnStyle} onClick={() => localStorage.setItem("dbg_local_" + Date.now().toString(36), JSON.stringify({ created: new Date().toISOString(), random: Math.random() }))}>Set localStorage</button>
          <button style={btnStyle} onClick={clearLocal}>Clear localStorage</button>
          <button style={btnStyle} onClick={() => sessionStorage.setItem("dbg_session_" + Date.now().toString(36), new Date().toISOString())}>Set sessionStorage</button>
          <button style={btnStyle} onClick={clearSession}>Clear sessionStorage</button>
          <button style={btnStyle} onClick={() => {
            const id = crypto.randomUUID().slice(0, 8)
            document.cookie = "debugger_test_" + id + "=fill_" + id + "; path=/; max-age=3600; SameSite=Lax"
            localStorage.setItem("dbg_local_" + id, JSON.stringify({ created: new Date().toISOString(), id }))
            sessionStorage.setItem("dbg_session_" + id, new Date().toISOString())
          }}>Fill All</button>
          <button style={btnStyle} onClick={() => { removeCookies(); clearLocal(); clearSession() }}>Clear All</button>
        </div>
      </section>
    </main>
  )
}
