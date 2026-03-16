use ephem_debugger::poem_middleware;
use poem::{get, handler, listener::TcpListener, web::Json, web::Query, EndpointExt, Route, Server};
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing_subscriber::prelude::*;

#[handler]
fn index() -> Json<Value> {
    tracing::info!("home page hit");
    Json(json!({"status": "ok", "framework": "poem"}))
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
