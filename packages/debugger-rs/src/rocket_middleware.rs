//! Rocket fairing for the debugger.
//!
//! Provides a [`Fairing`] implementation that
//! captures every HTTP request as a console entry in the debugger store, and
//! starts the IPC bridge so the `dbg` CLI can connect.
//!
//! # Usage
//!
//! ```rust,ignore
//! use ephem_debugger::rocket_middleware;
//!
//! let (fairing, capture_layer) = rocket_middleware::layers(8000);
//!
//! tracing_subscriber::registry()
//!     .with(capture_layer)
//!     .with(tracing_subscriber::fmt::layer())
//!     .init();
//!
//! rocket::build()
//!     .attach(fairing)
//!     .mount("/", routes![index])
//!     .launch()
//!     .await?;
//! ```

use std::sync::{Arc, OnceLock};
use std::time::Instant;

use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::{ContentType, Status};
use rocket::{Data, Request, Response, Route};

use crate::bridge::Bridge;
use crate::browser;
use crate::capture::CaptureLayer as TracingCaptureLayer;
use crate::protocol;
use crate::store::LogStore;

/// Module-level store so the browser route handlers can access it.
static ROCKET_STORE: OnceLock<Arc<LogStore>> = OnceLock::new();

/// Rocket [`Fairing`] that instruments an application with debugger
/// observability.
///
/// The bridge is started during the `on_liftoff` phase, after Rocket has
/// bound its port. Request timing is captured via request-local state.
pub struct DebuggerFairing {
    store: Arc<LogStore>,
    _bridge: Arc<tokio::sync::Mutex<Option<Bridge>>>,
}

impl DebuggerFairing {
    /// Create a new debugger fairing.
    ///
    /// `port` is the HTTP port the application listens on (used for session
    /// metadata only).
    pub fn new(port: i32) -> Self {
        let session = protocol::create_session("rocket", port);
        let session_id = session.session_id.clone();
        let store = Arc::new(LogStore::new(session));

        eprintln!("> @ephem-sh/debugger: session {session_id}");

        let _ = ROCKET_STORE.set(store.clone());

        Self {
            store,
            _bridge: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    /// Get a reference to the underlying log store.
    pub fn store(&self) -> &Arc<LogStore> {
        &self.store
    }

    /// Get a tracing [`CaptureLayer`](TracingCaptureLayer) that writes to
    /// this debugger's store.
    pub fn tracing_layer(&self) -> TracingCaptureLayer {
        TracingCaptureLayer::new(self.store.clone())
    }
}

#[rocket::async_trait]
impl Fairing for DebuggerFairing {
    fn info(&self) -> Info {
        Info {
            name: "@ephem-sh/debugger",
            kind: Kind::Liftoff | Kind::Request | Kind::Response,
        }
    }

    async fn on_liftoff(&self, _rocket: &rocket::Rocket<rocket::Orbit>) {
        let bridge_store = self.store.clone();
        let bridge_handle = self._bridge.clone();

        tokio::spawn(async move {
            match Bridge::start(bridge_store).await {
                Ok(b) => {
                    *bridge_handle.lock().await = Some(b);
                }
                Err(e) => {
                    eprintln!("@ephem-sh/debugger: bridge start failed: {e}");
                }
            }
        });
    }

    async fn on_request(&self, req: &mut Request<'_>, _data: &mut Data<'_>) {
        req.local_cache(Instant::now);
    }

    async fn on_response<'r>(&self, req: &'r Request<'_>, res: &mut Response<'r>) {
        let start = req.local_cache(Instant::now);
        let duration = start.elapsed().as_millis() as i64;
        let status = res.status().code;

        self.store.push_console(
            "info",
            vec![serde_json::json!(format!(
                "{} {} {status} {duration}ms",
                req.method().as_str(),
                req.uri().path(),
            ))],
            "server",
        );
    }
}

/// Convenience: create the debugger fairing and return it along with the
/// tracing capture layer, so users can install both in one step.
///
/// ```rust,ignore
/// let (fairing, capture_layer) = ephem_debugger::rocket_middleware::layers(8000);
///
/// tracing_subscriber::registry()
///     .with(capture_layer)
///     .with(tracing_subscriber::fmt::layer())
///     .init();
///
/// rocket::build()
///     .attach(fairing)
///     .mount("/", rocket_middleware::browser_routes())
///     .mount("/", routes![index])
/// ```
pub fn layers(port: i32) -> (DebuggerFairing, TracingCaptureLayer) {
    let fairing = DebuggerFairing::new(port);
    let tracing = fairing.tracing_layer();
    (fairing, tracing)
}

/// Return Rocket routes for browser support.
///
/// Mount these on `"/"` to enable the browser IIFE script and ingest
/// endpoint:
///
/// ```rust,ignore
/// use ephem_debugger::rocket_middleware;
///
/// rocket::build()
///     .mount("/", rocket_middleware::browser_routes())
/// ```
pub fn browser_routes() -> Vec<Route> {
    rocket::routes![browser_script, browser_ingest, browser_cors]
}

/// Serve the browser IIFE script at `GET /_/d.js`.
#[rocket::get("/_/d.js")]
fn browser_script() -> (ContentType, &'static str) {
    (ContentType::JavaScript, browser::CLIENT_SCRIPT)
}

/// Ingest browser entries at `POST /_/d`.
#[rocket::post("/_/d", data = "<body>")]
fn browser_ingest(body: &[u8]) -> Status {
    if let Some(store) = ROCKET_STORE.get()
        && let Ok(entries) = serde_json::from_slice::<Vec<serde_json::Value>>(body)
    {
        browser::ingest_entries(store, &entries);
    }
    Status::NoContent
}

/// CORS preflight at `OPTIONS /_/d`.
#[rocket::options("/_/d")]
fn browser_cors() -> Status {
    Status::NoContent
}
