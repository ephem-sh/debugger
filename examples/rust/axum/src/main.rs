use axum::{http::header, response::Html, routing::get, routing::post, Json, Router};
use ephem_debugger_rs::axum_middleware;
use serde_json::{json, Value};
use tracing_subscriber::prelude::*;

const TEST_PAGE: &str = r#"<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Axum — Debugger Test</title></head>
<body style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:system-ui,sans-serif">
<h1 style="font-size:20px;font-weight:600;margin:0 0 24px">Axum — Debugger Test</h1>
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

async fn index() -> Html<&'static str> {
    tracing::info!("home page hit");
    Html(TEST_PAGE)
}

async fn test_endpoint(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> (axum::http::StatusCode, Json<Value>) {
    let id = params.get("id").cloned().unwrap_or_default();
    tracing::info!(id = %id, "test endpoint");

    if params.get("error").map(|v| v == "true").unwrap_or(false) {
        tracing::error!(id = %id, "test error triggered");
        return (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "test error", "id": id})),
        );
    }

    (
        axum::http::StatusCode::OK,
        Json(json!({"ok": true, "id": id})),
    )
}

async fn users() -> Json<Value> {
    tracing::info!("fetching users");
    Json(json!({"users": ["alice", "bob", "charlie"]}))
}

async fn receive_data(Json(body): Json<Value>) -> Json<Value> {
    tracing::info!(?body, "received data");
    Json(json!({"received": body}))
}

#[tokio::main]
async fn main() {
    let (middleware_layer, capture_layer) = axum_middleware::layers(9879);

    tracing_subscriber::registry()
        .with(capture_layer)
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = Router::new()
        .route("/", get(index))
        .route("/api/test", get(test_endpoint))
        .route("/api/users", get(users))
        .route("/api/data", post(receive_data))
        .layer(middleware_layer);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:9879").await.unwrap();
    println!("> @ephem-sh/debugger: listening on http://localhost:9879");
    axum::serve(listener, app).await.unwrap();
}
