from flask import Flask, request, jsonify, make_response
from ephem_debugger.middleware.flask import init_debugger, logger, close

app = Flask(__name__)
init_debugger(app, port=5000)
log = logger()

TEST_PAGE = """<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Flask — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Flask — Debugger Test</h1>
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
</body>
</html>"""


@app.get("/")
def index():
    log.info("home page hit")
    resp = make_response(TEST_PAGE)
    resp.content_type = "text/html"
    return resp


@app.get("/api/test")
def test():
    id = request.args.get("id", "")
    log.info("test endpoint id=%s", id)
    if request.args.get("error") == "true":
        log.error("test error triggered id=%s", id)
        return jsonify(error="test error", id=id), 500
    return jsonify(ok=True, id=id)


@app.get("/api/users")
def users():
    log.info("fetching users")
    return jsonify(users=["alice", "bob", "charlie"])


if __name__ == "__main__":
    try:
        app.run(port=5000)
    finally:
        close()
