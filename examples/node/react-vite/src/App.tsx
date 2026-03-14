import type { CSSProperties } from 'react'

const btnStyle: CSSProperties = {
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 500,
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  background: 'none',
  cursor: 'pointer',
  color: 'inherit',
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const btnGroup: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
}

const headingStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
}

function App() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 32 }}>Debugger Test Page — React + Vite</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <section style={sectionStyle}>
          <h2 style={headingStyle}>Console & Errors</h2>
          <div style={btnGroup}>
            <button
              style={btnStyle}
              onClick={() =>
                console.log("[debugger:test] log", {
                  id: crypto.randomUUID().slice(0, 8),
                  ts: new Date().toISOString(),
                })
              }
            >
              Console log
            </button>
            <button
              style={btnStyle}
              onClick={() =>
                console.warn("[debugger:test] warn", {
                  id: crypto.randomUUID().slice(0, 8),
                  ts: new Date().toISOString(),
                })
              }
            >
              Console warn
            </button>
            <button
              style={btnStyle}
              onClick={() =>
                console.error("[debugger:test] error", {
                  id: crypto.randomUUID().slice(0, 8),
                  ts: new Date().toISOString(),
                  error: new Error("test error"),
                })
              }
            >
              Console error
            </button>
            <button
              style={btnStyle}
              onClick={() =>
                setTimeout(() => {
                  throw new Error("unhandled " + crypto.randomUUID().slice(0, 8));
                }, 0)
              }
            >
              Throw error
            </button>
            <button
              style={btnStyle}
              onClick={() =>
                Promise.reject(new Error("rejection " + crypto.randomUUID().slice(0, 8)))
              }
            >
              Unhandled rejection
            </button>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Network</h2>
          <div style={btnGroup}>
            <button
              style={btnStyle}
              onClick={() => fetch("/api/test?id=" + crypto.randomUUID().slice(0, 8))}
            >
              Fetch success
            </button>
            <button
              style={btnStyle}
              onClick={() => fetch("/api/test?error=true&id=" + crypto.randomUUID().slice(0, 8))}
            >
              Fetch error
            </button>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Application State</h2>
          <div style={btnGroup}>
            <button
              style={btnStyle}
              onClick={() => {
                document.cookie =
                  "debugger_test_" +
                  Date.now().toString(36) +
                  "=value_" +
                  Math.random().toString(36).slice(2, 6) +
                  "; path=/; max-age=3600; SameSite=Lax";
              }}
            >
              Set Cookie
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                document.cookie =
                  "dbg_secure_" +
                  Date.now().toString(36) +
                  "=secret_" +
                  Math.random().toString(36).slice(2, 6) +
                  "; path=/; max-age=3600; Secure; SameSite=Strict";
              }}
            >
              Set Secure Cookie
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                document.cookie
                  .split(";")
                  .map((c) => c.trim().split("=")[0])
                  .filter((name) => name.startsWith("dbg_") || name.startsWith("debugger_"))
                  .forEach((name) => {
                    document.cookie = name + "=; path=/; max-age=0";
                  });
              }}
            >
              Remove Cookies
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                const id = Date.now().toString(36);
                localStorage.setItem(
                  "dbg_local_" + id,
                  JSON.stringify({ created: new Date().toISOString(), random: Math.random() }),
                );
              }}
            >
              Set localStorage
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("dbg_") || k.startsWith("debugger_"))
                  .forEach((k) => localStorage.removeItem(k));
              }}
            >
              Clear localStorage
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                const id = Date.now().toString(36);
                sessionStorage.setItem("dbg_session_" + id, new Date().toISOString());
              }}
            >
              Set sessionStorage
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                Object.keys(sessionStorage)
                  .filter((k) => k.startsWith("dbg_") || k.startsWith("debugger_"))
                  .forEach((k) => sessionStorage.removeItem(k));
              }}
            >
              Clear sessionStorage
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                const id = Date.now().toString(36);
                document.cookie =
                  "debugger_test_" +
                  id +
                  "=value_" +
                  Math.random().toString(36).slice(2, 6) +
                  "; path=/; max-age=3600; SameSite=Lax";
                localStorage.setItem(
                  "dbg_local_" + id,
                  JSON.stringify({ created: new Date().toISOString(), random: Math.random() }),
                );
                sessionStorage.setItem("dbg_session_" + id, new Date().toISOString());
              }}
            >
              Fill All
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                document.cookie
                  .split(";")
                  .map((c) => c.trim().split("=")[0])
                  .filter((name) => name.startsWith("dbg_") || name.startsWith("debugger_"))
                  .forEach((name) => {
                    document.cookie = name + "=; path=/; max-age=0";
                  });
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("dbg_") || k.startsWith("debugger_"))
                  .forEach((k) => localStorage.removeItem(k));
                Object.keys(sessionStorage)
                  .filter((k) => k.startsWith("dbg_") || k.startsWith("debugger_"))
                  .forEach((k) => sessionStorage.removeItem(k));
              }}
            >
              Clear All
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                const id = crypto.randomUUID().slice(0, 8);
                fetch("/api/test?id=" + id);
                document.cookie =
                  "debugger_fetch_" + id + "=true; path=/; max-age=3600; SameSite=Lax";
              }}
            >
              Fetch + Cookie
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
