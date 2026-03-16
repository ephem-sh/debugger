import logging
from django.http import JsonResponse, HttpResponse
from django.urls import path

log = logging.getLogger("debugger")

TEST_PAGE = """<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Django — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Django — Debugger Test</h1>
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


def index(request):
    log.info("home page hit")
    return HttpResponse(TEST_PAGE, content_type="text/html")


def test_view(request):
    id = request.GET.get("id", "")
    log.info("test endpoint id=%s", id)
    if request.GET.get("error") == "true":
        log.error("test error triggered id=%s", id)
        return JsonResponse({"error": "test error", "id": id}, status=500)
    return JsonResponse({"ok": True, "id": id})


def users_view(request):
    log.info("fetching users")
    return JsonResponse({"users": ["alice", "bob", "charlie"]})


urlpatterns = [
    path("", index),
    path("api/test", test_view),
    path("api/users", users_view),
]
