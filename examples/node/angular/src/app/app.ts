import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  onConsoleLog() {
    console.log("[debugger:test] log", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() });
  }
  onConsoleWarn() {
    console.warn("[debugger:test] warn", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() });
  }
  onConsoleError() {
    console.error("[debugger:test] error", { id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString() }, new Error("test error"));
  }
  onThrowError() {
    setTimeout(() => { throw new Error("unhandled " + crypto.randomUUID().slice(0, 8)); }, 0);
  }
  onUnhandledRejection() {
    Promise.reject(new Error("rejection " + crypto.randomUUID().slice(0, 8)));
  }
  onFetchSuccess() {
    fetch("/api/test?id=" + crypto.randomUUID().slice(0, 8));
  }
  onFetchError() {
    fetch("/api/test?error=true&id=" + crypto.randomUUID().slice(0, 8));
  }
  onSetCookie() {
    document.cookie = "debugger_test_" + Date.now().toString(36) + "=value_" + Math.random().toString(36).slice(2, 6) + "; path=/; max-age=3600; SameSite=Lax";
  }
  onRemoveCookies() {
    document.cookie.split(";").forEach(c => {
      const name = c.split("=")[0].trim();
      if (name.startsWith("debugger_") || name.startsWith("dbg_")) {
        document.cookie = name + "=; path=/; max-age=0";
      }
    });
  }
  onSetLocalStorage() {
    localStorage.setItem("dbg_local_" + Date.now().toString(36), JSON.stringify({ created: new Date().toISOString(), random: Math.random() }));
  }
  onClearLocalStorage() {
    Object.keys(localStorage).filter(k => k.startsWith("dbg_") || k.startsWith("debugger_")).forEach(k => localStorage.removeItem(k));
  }
  onSetSessionStorage() {
    sessionStorage.setItem("dbg_session_" + Date.now().toString(36), new Date().toISOString());
  }
  onClearSessionStorage() {
    Object.keys(sessionStorage).filter(k => k.startsWith("dbg_") || k.startsWith("debugger_")).forEach(k => sessionStorage.removeItem(k));
  }
  onFillAll() {
    const id = crypto.randomUUID().slice(0, 8);
    document.cookie = "debugger_test_" + id + "=fill_" + id + "; path=/; max-age=3600; SameSite=Lax";
    localStorage.setItem("dbg_local_" + id, JSON.stringify({ created: new Date().toISOString(), id }));
    sessionStorage.setItem("dbg_session_" + id, new Date().toISOString());
  }
  onClearAll() {
    this.onRemoveCookies();
    this.onClearLocalStorage();
    this.onClearSessionStorage();
  }
}
