//! Tracing layer that captures log events into the [`LogStore`].
//!
//! # Usage
//!
//! ```rust,ignore
//! use tracing_subscriber::prelude::*;
//! use ephem_debugger::capture::CaptureLayer;
//!
//! tracing_subscriber::registry()
//!     .with(CaptureLayer::new(store.clone()))
//!     .with(tracing_subscriber::fmt::layer())
//!     .init();
//! ```

use std::sync::Arc;

use tracing::field::{Field, Visit};
use tracing::Event;
use tracing_subscriber::layer::Context;
use tracing_subscriber::Layer;

use crate::store::LogStore;

/// A [`tracing_subscriber::Layer`] that captures events into the debugger
/// [`LogStore`] as console entries.
pub struct CaptureLayer {
    store: Arc<LogStore>,
}

impl CaptureLayer {
    /// Create a new capture layer writing to the given store.
    pub fn new(store: Arc<LogStore>) -> Self {
        Self { store }
    }
}

impl<S> Layer<S> for CaptureLayer
where
    S: tracing::Subscriber,
{
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let mut visitor = FieldVisitor::default();
        event.record(&mut visitor);

        let level = match *event.metadata().level() {
            tracing::Level::ERROR => "error",
            tracing::Level::WARN => "warn",
            tracing::Level::INFO => "info",
            tracing::Level::DEBUG => "debug",
            tracing::Level::TRACE => "debug",
        };

        let mut args: Vec<serde_json::Value> = Vec::new();
        if let Some(msg) = visitor.message {
            args.push(serde_json::Value::String(msg));
        }
        for (key, value) in visitor.fields {
            args.push(serde_json::json!({ key: value }));
        }

        self.store.push_console(level, args, "server");
    }
}

/// Visitor that extracts the message and structured fields from a tracing event.
#[derive(Default)]
struct FieldVisitor {
    message: Option<String>,
    fields: Vec<(String, String)>,
}

impl Visit for FieldVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        let val = format!("{value:?}");
        if field.name() == "message" {
            self.message = Some(val);
        } else {
            self.fields.push((field.name().to_string(), val));
        }
    }

    fn record_str(&mut self, field: &Field, value: &str) {
        if field.name() == "message" {
            self.message = Some(value.to_string());
        } else {
            self.fields
                .push((field.name().to_string(), value.to_string()));
        }
    }

    fn record_i64(&mut self, field: &Field, value: i64) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }

    fn record_u64(&mut self, field: &Field, value: u64) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }

    fn record_bool(&mut self, field: &Field, value: bool) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }

    fn record_f64(&mut self, field: &Field, value: f64) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }
}
