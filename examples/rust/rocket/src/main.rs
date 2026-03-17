use ephem_debugger_rs::rocket_middleware;
use rocket::response::content::RawHtml;
use rocket::serde::json::Json;
use serde_json::{json, Value};
use tracing_subscriber::prelude::*;

const TEST_PAGE: &str = r#"<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Rocket — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Rocket — Debugger Test</h1>
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
</html>"#;

#[rocket::get("/")]
fn index() -> RawHtml<&'static str> {
    tracing::info!("home page hit");
    RawHtml(TEST_PAGE)
}

#[rocket::get("/api/test?<id>&<error>")]
fn test_endpoint(id: Option<String>, error: Option<bool>) -> Json<Value> {
    let id = id.unwrap_or_default();
    tracing::info!(id = %id, "test endpoint");

    if error.unwrap_or(false) {
        tracing::error!(id = %id, "test error triggered");
        return Json(json!({"error": "test error", "id": id}));
    }

    Json(json!({"ok": true, "id": id}))
}

#[rocket::get("/api/users")]
fn users() -> Json<Value> {
    tracing::info!("fetching users");
    Json(json!({"users": ["alice", "bob", "charlie"]}))
}

#[rocket::post("/api/data", format = "json", data = "<body>")]
fn receive_data(body: Json<Value>) -> Json<Value> {
    tracing::info!("received data");
    Json(json!({"received": body.into_inner()}))
}

#[rocket::launch]
fn rocket() -> _ {
    let (fairing, capture_layer) = rocket_middleware::layers(8000);

    tracing_subscriber::registry()
        .with(capture_layer)
        .with(tracing_subscriber::fmt::layer())
        .init();

    rocket::build()
        .attach(fairing)
        .mount("/", rocket::routes![index, test_endpoint, users, receive_data])
        .mount("/", rocket_middleware::browser_routes())
}
