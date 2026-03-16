use actix_web::{middleware, web, App, HttpResponse, HttpServer};
use ephem_debugger::actix_middleware::{self, debugger_mw};
use serde_json::json;
use tracing_subscriber::prelude::*;

async fn index() -> HttpResponse {
    tracing::info!("home page hit");
    HttpResponse::Ok().json(json!({"status": "ok", "framework": "actix-web"}))
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
