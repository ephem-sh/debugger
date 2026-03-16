//! Poem middleware for the debugger.
//!
//! Provides a [`Middleware`](poem::Middleware) implementation that captures
//! every HTTP request as a console entry in the debugger store, and starts
//! the IPC bridge so the `dbg` CLI can connect.
//!
//! # Usage
//!
//! ```rust,ignore
//! use poem::{Route, get, handler, listener::TcpListener, Server};
//! use ephem_debugger::poem_middleware;
//!
//! let (middleware, capture_layer) = poem_middleware::layers(3000);
//!
//! tracing_subscriber::registry()
//!     .with(capture_layer)
//!     .with(tracing_subscriber::fmt::layer())
//!     .init();
//!
//! let app = Route::new()
//!     .at("/", get(index))
//!     .with(middleware);
//!
//! Server::new(TcpListener::bind("0.0.0.0:3000"))
//!     .run(app)
//!     .await?;
//! ```

use std::sync::Arc;
use std::time::Instant;

use poem::{Endpoint, IntoResponse, Middleware, Request, Response, Result};

use crate::bridge::Bridge;
use crate::capture::CaptureLayer as TracingCaptureLayer;
use crate::protocol;
use crate::store::LogStore;

/// Poem [`Middleware`] that instruments an application with debugger
/// observability.
///
/// Creating this middleware starts the IPC bridge in the background so the
/// `dbg` CLI can connect and query captured request data.
#[derive(Clone)]
pub struct DebuggerMiddleware {
    store: Arc<LogStore>,
    _bridge: Arc<tokio::sync::Mutex<Option<Bridge>>>,
}

impl DebuggerMiddleware {
    /// Create and start a new debugger middleware.
    ///
    /// `port` is the HTTP port the application listens on (used for session
    /// metadata only).
    pub fn new(port: i32) -> Self {
        let session = protocol::create_session("poem", port);
        let session_id = session.session_id.clone();
        let store = Arc::new(LogStore::new(session));

        let bridge_store = store.clone();
        let bridge = Arc::new(tokio::sync::Mutex::new(None));
        let bridge_handle = bridge.clone();

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
    pub fn store(&self) -> &Arc<LogStore> {
        &self.store
    }

    /// Get a tracing [`CaptureLayer`](TracingCaptureLayer) that writes to
    /// this debugger's store.
    pub fn tracing_layer(&self) -> TracingCaptureLayer {
        TracingCaptureLayer::new(self.store.clone())
    }
}

impl<E: Endpoint> Middleware<E> for DebuggerMiddleware {
    type Output = DebuggerEndpoint<E>;

    fn transform(&self, ep: E) -> Self::Output {
        DebuggerEndpoint {
            inner: ep,
            store: self.store.clone(),
        }
    }
}

/// The endpoint wrapper created by [`DebuggerMiddleware`].
pub struct DebuggerEndpoint<E> {
    inner: E,
    store: Arc<LogStore>,
}

impl<E: Endpoint> Endpoint for DebuggerEndpoint<E> {
    type Output = Response;

    async fn call(&self, req: Request) -> Result<Self::Output> {
        let start = Instant::now();
        let method = req.method().to_string();
        let path = req.uri().path().to_string();

        let res = self.inner.call(req).await?.into_response();

        let duration = start.elapsed().as_millis() as i64;
        let status = res.status().as_u16();

        self.store.push_console(
            "info",
            vec![serde_json::json!(format!(
                "{method} {path} {status} {duration}ms"
            ))],
            "server",
        );

        Ok(res)
    }
}

/// Convenience: create the debugger middleware and return it along with the
/// tracing capture layer, so users can install both in one step.
///
/// ```rust,ignore
/// let (middleware, capture_layer) = ephem_debugger::poem_middleware::layers(3000);
///
/// tracing_subscriber::registry()
///     .with(capture_layer)
///     .with(tracing_subscriber::fmt::layer())
///     .init();
///
/// let app = Route::new()
///     .at("/", get(index))
///     .with(middleware);
/// ```
pub fn layers(port: i32) -> (DebuggerMiddleware, TracingCaptureLayer) {
    let middleware = DebuggerMiddleware::new(port);
    let tracing = middleware.tracing_layer();
    (middleware, tracing)
}
