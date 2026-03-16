use ephem_debugger::rocket_middleware;
use rocket::serde::json::Json;
use serde_json::{json, Value};
use tracing_subscriber::prelude::*;

#[rocket::get("/")]
fn index() -> Json<Value> {
    tracing::info!("home page hit");
    Json(json!({"status": "ok", "framework": "rocket"}))
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
}
