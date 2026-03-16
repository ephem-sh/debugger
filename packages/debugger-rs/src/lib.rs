//! Dev-only observability for AI agent debugging.
//!
//! `ephem-debugger` captures console logs, errors, and request metadata into
//! in-memory ring buffers and exposes them over an IPC bridge that the `dbg`
//! CLI connects to.
//!
//! # Quick Start (Axum)
//!
//! ```rust,ignore
//! use axum::{Router, routing::get};
//! use ephem_debugger::axum_middleware::DebuggerLayer;
//!
//! let app = Router::new()
//!     .route("/", get(|| async { "Hello" }))
//!     .layer(DebuggerLayer::new(3000));
//! ```
//!
//! # Tracing integration
//!
//! ```rust,ignore
//! use tracing_subscriber::prelude::*;
//!
//! let (debugger, tracing_layer) = ephem_debugger::axum_middleware::layers(3000);
//!
//! tracing_subscriber::registry()
//!     .with(tracing_layer)
//!     .with(tracing_subscriber::fmt::layer())
//!     .init();
//!
//! let app = Router::new()
//!     .route("/", get(handler))
//!     .layer(debugger);
//! ```

pub mod bridge;
pub mod browser;
pub mod capture;
pub mod protocol;
pub mod store;

#[cfg(feature = "axum")]
pub mod axum_middleware;

#[cfg(feature = "actix")]
pub mod actix_middleware;

#[cfg(feature = "rocket")]
pub mod rocket_middleware;

#[cfg(feature = "poem")]
pub mod poem_middleware;

// Re-export main types for convenience.
pub use bridge::Bridge;
pub use protocol::{ConsoleEntry, ErrorEntry, LogEntry, NetworkEntry, SessionInfo};
pub use store::LogStore;
