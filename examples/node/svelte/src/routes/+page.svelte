<script lang="ts">
  const btnStyle = 'padding: 8px 16px; font-size: 14px; font-weight: 500; border: 1px solid #e5e7eb; border-radius: 8px; background: none; cursor: pointer; color: inherit;'

  function consoleLog() {
    console.log("[debugger:test] log", {
      id: crypto.randomUUID().slice(0, 8),
      ts: new Date().toISOString(),
    })
  }

  function consoleWarn() {
    console.warn("[debugger:test] warn", {
      id: crypto.randomUUID().slice(0, 8),
      ts: new Date().toISOString(),
    })
  }

  function consoleError() {
    console.error("[debugger:test] error", {
      id: crypto.randomUUID().slice(0, 8),
      ts: new Date().toISOString(),
      error: new Error("test error"),
    })
  }

  function throwError() {
    setTimeout(() => {
      throw new Error("unhandled " + crypto.randomUUID().slice(0, 8))
    }, 0)
  }

  function unhandledRejection() {
    Promise.reject(new Error("rejection " + crypto.randomUUID().slice(0, 8)))
  }

  function fetchSuccess() {
    fetch("/api/test?id=" + crypto.randomUUID().slice(0, 8))
  }

  function fetchError() {
    fetch("/api/test?error=true&id=" + crypto.randomUUID().slice(0, 8))
  }

  function setCookie() {
    document.cookie =
      "debugger_test_" +
      Date.now().toString(36) +
      "=value_" +
      Math.random().toString(36).slice(2, 6) +
      "; path=/; max-age=3600; SameSite=Lax"
  }

  function setSecureCookie() {
    document.cookie =
      "dbg_secure_" +
      Date.now().toString(36) +
      "=secret_" +
      Math.random().toString(36).slice(2, 6) +
      "; path=/; max-age=3600; Secure; SameSite=Strict"
  }

  function removeCookies() {
    document.cookie
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter((name) => name.startsWith("dbg_") || name.startsWith("debugger_"))
      .forEach((name) => {
        document.cookie = name + "=; path=/; max-age=0"
      })
  }

  function setLocalStorage() {
    const id = Date.now().toString(36)
    localStorage.setItem(
      "dbg_local_" + id,
      JSON.stringify({ created: new Date().toISOString(), random: Math.random() }),
    )
  }

  function clearLocalStorage() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("dbg_") || k.startsWith("debugger_"))
      .forEach((k) => localStorage.removeItem(k))
  }

  function setSessionStorage() {
    const id = Date.now().toString(36)
    sessionStorage.setItem("dbg_session_" + id, new Date().toISOString())
  }

  function clearSessionStorage() {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("dbg_") || k.startsWith("debugger_"))
      .forEach((k) => sessionStorage.removeItem(k))
  }

  function fillAll() {
    const id = Date.now().toString(36)
    document.cookie =
      "debugger_test_" +
      id +
      "=value_" +
      Math.random().toString(36).slice(2, 6) +
      "; path=/; max-age=3600; SameSite=Lax"
    localStorage.setItem(
      "dbg_local_" + id,
      JSON.stringify({ created: new Date().toISOString(), random: Math.random() }),
    )
    sessionStorage.setItem("dbg_session_" + id, new Date().toISOString())
  }

  function clearAll() {
    removeCookies()
    clearLocalStorage()
    clearSessionStorage()
  }

  function fetchPlusCookie() {
    const id = crypto.randomUUID().slice(0, 8)
    fetch("/api/test?id=" + id)
    document.cookie = "debugger_fetch_" + id + "=true; path=/; max-age=3600; SameSite=Lax"
  }
</script>

<div style="max-width: 800px; margin: 0 auto; padding: 32px 16px; font-family: system-ui, sans-serif;">
  <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 32px;">Debugger Test Page — Svelte + Vite</h1>

  <div style="display: flex; flex-direction: column; gap: 48px;">
    <section style="display: flex; flex-direction: column; gap: 12px;">
      <h2 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Console & Errors</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <button style={btnStyle} on:click={consoleLog}>Console log</button>
        <button style={btnStyle} on:click={consoleWarn}>Console warn</button>
        <button style={btnStyle} on:click={consoleError}>Console error</button>
        <button style={btnStyle} on:click={throwError}>Throw error</button>
        <button style={btnStyle} on:click={unhandledRejection}>Unhandled rejection</button>
      </div>
    </section>

    <section style="display: flex; flex-direction: column; gap: 12px;">
      <h2 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Network</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <button style={btnStyle} on:click={fetchSuccess}>Fetch success</button>
        <button style={btnStyle} on:click={fetchError}>Fetch error</button>
      </div>
    </section>

    <section style="display: flex; flex-direction: column; gap: 12px;">
      <h2 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Application State</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <button style={btnStyle} on:click={setCookie}>Set Cookie</button>
        <button style={btnStyle} on:click={setSecureCookie}>Set Secure Cookie</button>
        <button style={btnStyle} on:click={removeCookies}>Remove Cookies</button>
        <button style={btnStyle} on:click={setLocalStorage}>Set localStorage</button>
        <button style={btnStyle} on:click={clearLocalStorage}>Clear localStorage</button>
        <button style={btnStyle} on:click={setSessionStorage}>Set sessionStorage</button>
        <button style={btnStyle} on:click={clearSessionStorage}>Clear sessionStorage</button>
        <button style={btnStyle} on:click={fillAll}>Fill All</button>
        <button style={btnStyle} on:click={clearAll}>Clear All</button>
        <button style={btnStyle} on:click={fetchPlusCookie}>Fetch + Cookie</button>
      </div>
    </section>
  </div>
</div>
