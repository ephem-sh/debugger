package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	dbg "github.com/ephem-sh/debugger/packages/ephem-debugger-go/middleware/chi"
)

const testPage = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Chi — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Chi — Debugger Test</h1>
<section style="margin-bottom:24px">
<h2 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#6b7280">Console & Errors</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px">
<button onclick="console.log('[debugger:test] log',{id:crypto.randomUUID().slice(0,8)})">console.log</button>
<button onclick="console.warn('[debugger:test] warn',{id:crypto.randomUUID().slice(0,8)})">console.warn</button>
<button onclick="console.error('[debugger:test] error',{id:crypto.randomUUID().slice(0,8)})">console.error</button>
<button onclick="setTimeout(()=>{throw new Error('unhandled '+crypto.randomUUID().slice(0,8))},0)">Throw Error</button>
<button onclick="Promise.reject(new Error('rejection '+crypto.randomUUID().slice(0,8)))">Rejection</button>
</div></section>
<section style="margin-bottom:24px">
<h2 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#6b7280">Network</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px">
<button onclick="fetch('/api/test?id='+crypto.randomUUID().slice(0,8))">Fetch OK</button>
<button onclick="fetch('/api/test?error=true&id='+crypto.randomUUID().slice(0,8))">Fetch Error</button>
</div></section>
<section>
<h2 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#6b7280">Storage</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px">
<button onclick="document.cookie='dbg_test_'+Date.now().toString(36)+'=val;path=/;max-age=3600'">Cookie</button>
<button onclick="localStorage.setItem('dbg_local_'+Date.now().toString(36),JSON.stringify({ts:new Date().toISOString()}))">localStorage</button>
<button onclick="sessionStorage.setItem('dbg_session_'+Date.now().toString(36),new Date().toISOString())">sessionStorage</button>
</div></section>
<script>window.__DEBUGGER_INGEST_URL__="/_/d";</script><script src="/_/d.js" defer></script>
</body>
</html>`

func main() {
	defer dbg.Close()
	log := dbg.Logger()

	r := chi.NewRouter()
	r.Use(dbg.Middleware(9878))
	dbg.Routes(r)

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		log.Info("home page hit")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(testPage))
	})

	r.Get("/api/test", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		log.Info("test endpoint", "id", id)
		if r.URL.Query().Get("error") == "true" {
			log.Error("test error triggered", "id", id)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": "test error", "id": id})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id})
	})

	r.Get("/api/users", func(w http.ResponseWriter, r *http.Request) {
		log.Info("fetching users")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"users": []string{"alice", "bob", "charlie"}})
	})

	http.ListenAndServe(":9878", r)
}
