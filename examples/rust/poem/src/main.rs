use ephem_debugger_rs::poem_middleware;
use poem::{get, handler, listener::TcpListener, web::Html, web::Json, web::Query, EndpointExt, Route, Server};
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing_subscriber::prelude::*;

const TEST_PAGE: &str = r#"<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Poem — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Poem — Debugger Test</h1>
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

#[handler]
fn index() -> Html<&'static str> {
    tracing::info!("home page hit");
    Html(TEST_PAGE)
}

#[handler]
fn test_endpoint(Query(params): Query<HashMap<String, String>>) -> Json<Value> {
    let id = params.get("id").cloned().unwrap_or_default();
    tracing::info!(id = %id, "test endpoint");

    if params.get("error").map(|v| v == "true").unwrap_or(false) {
        tracing::error!(id = %id, "test error triggered");
        return Json(json!({"error": "test error", "id": id}));
    }

    Json(json!({"ok": true, "id": id}))
}

#[handler]
fn users() -> Json<Value> {
    tracing::info!("fetching users");
    Json(json!({"users": ["alice", "bob", "charlie"]}))
}

#[handler]
fn receive_data(Json(body): Json<Value>) -> Json<Value> {
    tracing::info!("received data");
    Json(json!({"received": body}))
}

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
    let (middleware, capture_layer) = poem_middleware::layers(9880);

    tracing_subscriber::registry()
        .with(capture_layer)
        .with(tracing_subscriber::fmt::layer())
        .init();

    println!("> @ephem-sh/debugger: listening on http://localhost:9880");

    let app = Route::new()
        .at("/", get(index))
        .at("/api/test", get(test_endpoint))
        .at("/api/users", get(users))
        .at("/api/data", poem::post(receive_data))
        .with(middleware);

    Server::new(TcpListener::bind("0.0.0.0:9880"))
        .run(app)
        .await
}
