//! Actix-web middleware for the debugger.
//!
//! Uses [`actix_web::middleware::from_fn`] to create a lightweight middleware
//! that captures every HTTP request as a console entry in the debugger store,
//! and starts the IPC bridge so the `dbg` CLI can connect.
//!
//! # Usage
//!
//! ```rust,ignore
//! use actix_web::{App, HttpServer, web, middleware};
//! use ephem_debugger::actix_middleware::{self, debugger_mw};
//!
//! let capture_layer = actix_middleware::init(8080);
//!
//! // Set up tracing with the capture layer
//! tracing_subscriber::registry()
//!     .with(capture_layer)
//!     .with(tracing_subscriber::fmt::layer())
//!     .init();
//!
//! HttpServer::new(move || {
//!     App::new()
//!         .wrap(middleware::from_fn(debugger_mw))
//!         .route("/", web::get().to(|| async { "Hello" }))
//! })
//! .bind("0.0.0.0:8080")?
//! .run()
//! .await?;
//! ```

use std::sync::{Arc, OnceLock};
use std::time::Instant;

use actix_web::body::MessageBody;
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::middleware::Next;
use actix_web::Error;

use crate::bridge::Bridge;
use crate::capture::CaptureLayer as TracingCaptureLayer;
use crate::protocol;
use crate::store::LogStore;

/// Module-level store shared between [`init`] and [`debugger_mw`].
static STORE: OnceLock<Arc<LogStore>> = OnceLock::new();

/// Initialise the debugger for Actix-web.
///
/// This sets up the log store and starts the IPC bridge in the background.
/// Returns a tracing [`CaptureLayer`](TracingCaptureLayer) for capturing
/// `tracing` events.
///
/// After calling `init`, use [`debugger_mw`] with
/// [`actix_web::middleware::from_fn`] to capture HTTP request metadata.
///
/// # Example
///
/// ```rust,ignore
/// use actix_web::{App, middleware};
/// use ephem_debugger::actix_middleware::{self, debugger_mw};
///
/// let capture_layer = actix_middleware::init(8080);
///
/// // ... set up tracing ...
///
/// HttpServer::new(|| {
///     App::new().wrap(middleware::from_fn(debugger_mw))
/// })
/// ```
pub fn init(port: i32) -> TracingCaptureLayer {
    let session = protocol::create_session("actix", port);
    let session_id = session.session_id.clone();
    let store = Arc::new(LogStore::new(session));

    let capture = TracingCaptureLayer::new(store.clone());

    // Set the module-level store for the from_fn middleware.
    let _ = STORE.set(store.clone());

    let bridge_store = store.clone();
    tokio::spawn(async move {
        if let Err(e) = Bridge::start(bridge_store).await {
            eprintln!("@ephem-sh/debugger: bridge error: {e}");
        }
    });

    eprintln!("> @ephem-sh/debugger: session {session_id}");
    capture
}

/// Middleware function for use with [`actix_web::middleware::from_fn`].
///
/// Must be called after [`init`] — otherwise request entries are silently
/// dropped (the store has not been created yet).
///
/// # Example
///
/// ```rust,ignore
/// use actix_web::{App, middleware};
/// use ephem_debugger::actix_middleware::debugger_mw;
///
/// App::new().wrap(middleware::from_fn(debugger_mw))
/// ```
pub async fn debugger_mw(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let start = Instant::now();
    let method = req.method().to_string();
    let path = req.path().to_string();

    let res = next.call(req).await?;

    let duration = start.elapsed().as_millis() as i64;
    let status = res.status().as_u16();

    if let Some(store) = STORE.get() {
        store.push_console(
            "info",
            vec![serde_json::json!(format!(
                "{method} {path} {status} {duration}ms"
            ))],
            "server",
        );
    }

    Ok(res)
}
