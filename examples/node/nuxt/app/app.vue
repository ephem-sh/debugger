<script setup lang="ts">
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

function onConsoleLog() {
  console.log("[debugger:test] log", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() })
}
function onConsoleWarn() {
  console.warn("[debugger:test] warn", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() })
}
function onConsoleError() {
  console.error("[debugger:test] error", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() }, new Error("test error"))
}
function onThrowError() {
  setTimeout(() => { throw new Error("unhandled " + crypto.randomUUID().slice(0, 8)) }, 0)
}
function onUnhandledRejection() {
  Promise.reject(new Error("rejection " + crypto.randomUUID().slice(0, 8)))
}
function onFetchSuccess() {
  fetch("/api/test?id=" + crypto.randomUUID().slice(0, 8))
}
function onFetchError() {
  fetch("/api/test?error=true&id=" + crypto.randomUUID().slice(0, 8))
}
function onSetCookie() {
  document.cookie = "debugger_test_" + Date.now().toString(36) + "=value_" + Math.random().toString(36).slice(2, 6) + "; path=/; max-age=3600; SameSite=Lax"
}
function onSetLocalStorage() {
  localStorage.setItem("dbg_local_" + Date.now().toString(36), JSON.stringify({ created: new Date().toISOString(), random: Math.random() }))
}
function onSetSessionStorage() {
  sessionStorage.setItem("dbg_session_" + Date.now().toString(36), new Date().toISOString())
}
function onFillAll() {
  const id = crypto.randomUUID().slice(0, 8)
  document.cookie = "debugger_test_" + id + "=fill_" + id + "; path=/; max-age=3600; SameSite=Lax"
  localStorage.setItem("dbg_local_" + id, JSON.stringify({ created: new Date().toISOString(), id }))
  sessionStorage.setItem("dbg_session_" + id, new Date().toISOString())
}
function onClearAll() {
  removeCookies()
  clearLocal()
  clearSession()
}

const btnStyle = "padding: 8px 16px; font-size: 14px; font-weight: 500; border: 1px solid #e5e7eb; border-radius: 8px; background: none; cursor: pointer;"
</script>

<template>
  <main style="max-width: 640px; margin: 0 auto; padding: 32px 16px; font-family: system-ui, -apple-system, sans-serif;">
    <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 24px;">Nuxt — Debugger Test</h1>

    <section style="margin-bottom: 24px;">
      <h2 style="font-size: 14px; font-weight: 600; margin: 0 0 8px; color: #6b7280;">Console & Errors</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        <button :style="btnStyle" @click="onConsoleLog">console.log</button>
        <button :style="btnStyle" @click="onConsoleWarn">console.warn</button>
        <button :style="btnStyle" @click="onConsoleError">console.error</button>
        <button :style="btnStyle" @click="onThrowError">Throw Error</button>
        <button :style="btnStyle" @click="onUnhandledRejection">Unhandled Rejection</button>
      </div>
    </section>

    <section style="margin-bottom: 24px;">
      <h2 style="font-size: 14px; font-weight: 600; margin: 0 0 8px; color: #6b7280;">Network</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        <button :style="btnStyle" @click="onFetchSuccess">Fetch Success</button>
        <button :style="btnStyle" @click="onFetchError">Fetch Error</button>
      </div>
    </section>

    <section>
      <h2 style="font-size: 14px; font-weight: 600; margin: 0 0 8px; color: #6b7280;">Application State</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        <button :style="btnStyle" @click="onSetCookie">Set Cookie</button>
        <button :style="btnStyle" @click="removeCookies">Remove Cookies</button>
        <button :style="btnStyle" @click="onSetLocalStorage">Set localStorage</button>
        <button :style="btnStyle" @click="clearLocal">Clear localStorage</button>
        <button :style="btnStyle" @click="onSetSessionStorage">Set sessionStorage</button>
        <button :style="btnStyle" @click="clearSession">Clear sessionStorage</button>
        <button :style="btnStyle" @click="onFillAll">Fill All</button>
        <button :style="btnStyle" @click="onClearAll">Clear All</button>
      </div>
    </section>
  </main>
</template>
