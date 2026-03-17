use actix_web::{middleware, web, App, HttpResponse, HttpServer};
use ephem_debugger_rs::actix_middleware::{self, debugger_mw};
use serde_json::json;
use tracing_subscriber::prelude::*;

const TEST_PAGE: &str = r#"<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Actix — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Actix — Debugger Test</h1>
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

async fn index() -> HttpResponse {
    tracing::info!("home page hit");
    HttpResponse::Ok()
        .content_type("text/html")
        .body(TEST_PAGE)
}

async fn test_endpoint(query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let id = query.get("id").cloned().unwrap_or_default();
    tracing::info!(id = %id, "test endpoint");

    if query.get("error").map(|v| v == "true").unwrap_or(false) {
        tracing::error!(id = %id, "test error triggered");
        return HttpResponse::InternalServerError()
            .json(json!({"error": "test error", "id": id}));
    }

    HttpResponse::Ok().json(json!({"ok": true, "id": id}))
}

async fn users() -> HttpResponse {
    tracing::info!("fetching users");
    HttpResponse::Ok().json(json!({"users": ["alice", "bob", "charlie"]}))
}

async fn receive_data(body: web::Json<serde_json::Value>) -> HttpResponse {
    tracing::info!(?body, "received data");
    HttpResponse::Ok().json(json!({"received": body.into_inner()}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let capture_layer = actix_middleware::init(9879);

    tracing_subscriber::registry()
        .with(capture_layer)
        .with(tracing_subscriber::fmt::layer())
        .init();

    println!("> @ephem-sh/debugger: listening on http://localhost:9879");

    HttpServer::new(move || {
        App::new()
            .configure(actix_middleware::browser_config)
            .wrap(middleware::from_fn(debugger_mw))
            .route("/", web::get().to(index))
            .route("/api/test", web::get().to(test_endpoint))
            .route("/api/users", web::get().to(users))
            .route("/api/data", web::post().to(receive_data))
    })
    .bind("0.0.0.0:9879")?
    .run()
    .await
}
