//! Rocket fairing for the debugger.
//!
//! Provides a [`Fairing`](rocket::fairing::Fairing) implementation that
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

use std::sync::Arc;
use std::time::Instant;

use rocket::fairing::{Fairing, Info, Kind};
use rocket::{Data, Request, Response};

use crate::bridge::Bridge;
use crate::capture::CaptureLayer as TracingCaptureLayer;
use crate::protocol;
use crate::store::LogStore;

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
///     .mount("/", routes![index])
/// ```
pub fn layers(port: i32) -> (DebuggerFairing, TracingCaptureLayer) {
    let fairing = DebuggerFairing::new(port);
    let tracing = fairing.tracing_layer();
    (fairing, tracing)
}
