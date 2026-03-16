use axum::{routing::get, routing::post, Json, Router};
use ephem_debugger::axum_middleware;
use serde_json::{json, Value};
use tracing_subscriber::prelude::*;

async fn index() -> Json<Value> {
    tracing::info!("home page hit");
    Json(json!({"status": "ok", "framework": "axum"}))
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
