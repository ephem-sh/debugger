package main

import (
	"net/http"

	"github.com/gin-gonic/gin"

	dbg "github.com/ephem-sh/debugger/packages/ephem-debugger-go/middleware/gin"
)

const testPage = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Gin — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Gin — Debugger Test</h1>

<section style="margin-bottom:24px">
<h2 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#6b7280">Console & Errors</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px">
<button onclick="console.log('[debugger:test] log',{id:crypto.randomUUID().slice(0,8),ts:new Date().toISOString()})">console.log</button>
<button onclick="console.warn('[debugger:test] warn',{id:crypto.randomUUID().slice(0,8)})">console.warn</button>
<button onclick="console.error('[debugger:test] error',{id:crypto.randomUUID().slice(0,8),error:new Error('test')})">console.error</button>
<button onclick="setTimeout(()=>{throw new Error('unhandled '+crypto.randomUUID().slice(0,8))},0)">Throw Error</button>
<button onclick="Promise.reject(new Error('rejection '+crypto.randomUUID().slice(0,8)))">Unhandled Rejection</button>
</div>
</section>

<section style="margin-bottom:24px">
<h2 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#6b7280">Network</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px">
<button onclick="fetch('/api/test?id='+crypto.randomUUID().slice(0,8))">Fetch Success</button>
<button onclick="fetch('/api/test?error=true&id='+crypto.randomUUID().slice(0,8))">Fetch Error</button>
</div>
</section>

<section>
<h2 style="font-size:14px;font-weight:600;margin:0 0 8px;color:#6b7280">Application State</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px">
<button onclick="document.cookie='dbg_test_'+Date.now().toString(36)+'=val;path=/;max-age=3600'">Set Cookie</button>
<button onclick="localStorage.setItem('dbg_local_'+Date.now().toString(36),JSON.stringify({ts:new Date().toISOString()}))">Set localStorage</button>
<button onclick="sessionStorage.setItem('dbg_session_'+Date.now().toString(36),new Date().toISOString())">Set sessionStorage</button>
<button onclick="document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(n=>n.startsWith('dbg_')).forEach(n=>{document.cookie=n+'=;path=/;max-age=0'});Object.keys(localStorage).filter(k=>k.startsWith('dbg_')).forEach(k=>localStorage.removeItem(k));Object.keys(sessionStorage).filter(k=>k.startsWith('dbg_')).forEach(k=>sessionStorage.removeItem(k))">Clear All</button>
</div>
</section>
</body>
</html>`

func main() {
	defer dbg.Close()
	log := dbg.Logger()

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(dbg.Middleware(9876))
	dbg.Routes(r)

	// HTML test page — middleware auto-injects browser scripts
	r.GET("/", func(c *gin.Context) {
		log.Info("home page hit")
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(testPage))
	})

	r.GET("/api/test", func(c *gin.Context) {
		id := c.Query("id")
		log.Info("test endpoint", "id", id)
		if c.Query("error") == "true" {
			log.Error("test error triggered", "id", id)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "test error", "id": id})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "id": id})
	})

	r.GET("/api/users", func(c *gin.Context) {
		log.Info("fetching users")
		c.JSON(http.StatusOK, gin.H{"users": []string{"alice", "bob", "charlie"}})
	})

	r.Run(":9876")
}
