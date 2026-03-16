//! Axum middleware for the debugger.
//!
//! Provides a Tower [`Layer`] that captures every HTTP request as a console
//! entry in the debugger store, and starts the IPC bridge so the `dbg` CLI
//! can connect.
//!
//! # Usage
//!
//! ```rust,ignore
//! use axum::{Router, routing::get};
//! use ephem_debugger::axum_middleware::DebuggerLayer;
//!
//! let app = Router::new()
//!     .route("/", get(|| async { "Hello" }))
//!     .layer(DebuggerLayer::new(3000));
//! ```

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Instant;

use axum::body::Body;
use axum::extract::Request;
use axum::response::Response;
use tower::{Layer, Service};

use crate::bridge::Bridge;
use crate::capture::CaptureLayer as TracingCaptureLayer;
use crate::protocol;
use crate::store::LogStore;

/// Tower [`Layer`] that instruments an Axum application with debugger
/// observability.
///
/// Creating this layer starts the IPC bridge in the background and sets
/// up a tracing subscriber layer for log capture.
#[derive(Clone)]
pub struct DebuggerLayer {
    store: Arc<LogStore>,
    // Bridge handle is kept alive via Arc so cloning the layer does not
    // drop the bridge.
    _bridge: Arc<tokio::sync::Mutex<Option<Bridge>>>,
}

impl DebuggerLayer {
    /// Create and start a new debugger layer.
    ///
    /// `port` is the HTTP port the application listens on (used for session
    /// metadata only).
    pub fn new(port: i32) -> Self {
        let session = protocol::create_session("axum", port);
        let session_id = session.session_id.clone();
        let store = Arc::new(LogStore::new(session));

        let bridge_store = store.clone();
        let bridge = Arc::new(tokio::sync::Mutex::new(None));
        let bridge_handle = bridge.clone();

        // Spawn bridge startup as a background task
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

        eprintln!("> @ephem-sh/debugger: session {session_id}");

        Self {
            store,
            _bridge: bridge,
        }
    }

    /// Get a reference to the underlying log store.
    ///
    /// Useful for pushing entries from custom middleware or handlers.
    pub fn store(&self) -> &Arc<LogStore> {
        &self.store
    }

    /// Get a tracing [`CaptureLayer`](TracingCaptureLayer) that writes to
    /// this debugger's store.
    pub fn tracing_layer(&self) -> TracingCaptureLayer {
        TracingCaptureLayer::new(self.store.clone())
    }
}

impl<S> Layer<S> for DebuggerLayer {
    type Service = DebuggerService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        DebuggerService {
            inner,
            store: self.store.clone(),
        }
    }
}

/// Tower [`Service`] wrapper that captures request/response metadata.
#[derive(Clone)]
pub struct DebuggerService<S> {
    inner: S,
    store: Arc<LogStore>,
}

impl<S> Service<Request<Body>> for DebuggerService<S>
where
    S: Service<Request<Body>, Response = Response> + Clone + Send + 'static,
    S::Future: Send + 'static,
    S::Error: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let store = self.store.clone();
        let method = req.method().to_string();
        let path = req.uri().path().to_string();
        let start = Instant::now();

        // Clone the inner service (Tower pattern for async services)
        let mut inner = self.inner.clone();
        // Swap so we use the ready clone
        std::mem::swap(&mut inner, &mut self.inner);

        Box::pin(async move {
            let response = inner.call(req).await?;
            let status = response.status().as_u16();
            let duration = start.elapsed().as_millis() as i64;

            store.push_console(
                "info",
                vec![serde_json::json!(format!(
                    "{method} {path} {status} {duration}ms"
                ))],
                "server",
            );

            Ok(response)
        })
    }
}

/// Convenience: create the debugger layer and return it along with the
/// tracing capture layer, so users can install both in one step.
///
/// ```rust,ignore
/// let (debugger_layer, tracing_layer) = ephem_debugger::axum_middleware::layers(3000);
///
/// tracing_subscriber::registry()
///     .with(tracing_layer)
///     .with(tracing_subscriber::fmt::layer())
///     .init();
///
/// let app = Router::new()
///     .route("/", get(handler))
///     .layer(debugger_layer);
/// ```
pub fn layers(port: i32) -> (DebuggerLayer, TracingCaptureLayer) {
    let layer = DebuggerLayer::new(port);
    let tracing = layer.tracing_layer();
    (layer, tracing)
}
