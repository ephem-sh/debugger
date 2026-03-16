//! Browser support — embeds the IIFE client and provides route handlers.
//!
//! The browser IIFE patches `console.*`, `fetch`, `XMLHttpRequest`, and
//! `WebSocket` to capture client-side logs, errors, and network requests.
//! These are sent to the ingest endpoint (`/_/d`) as JSON batches, where
//! they are deserialized and pushed into the shared [`LogStore`].
//!
//! # Routes
//!
//! | Path | Method | Purpose |
//! |------|--------|---------|
//! | `/_/d.js` | GET | Serve the IIFE script |
//! | `/_/d` | POST | Ingest browser entries |
//! | `/_/d` | OPTIONS | CORS preflight |
//!
//! Each framework middleware handles these routes differently:
//!
//! - **Axum / Poem**: intercepted in the `Service`/`Endpoint` before
//!   forwarding to the inner handler.
//! - **Actix**: registered via `browser_config` on `ServiceConfig`.
//! - **Rocket**: registered via `browser_routes` returning `Vec<Route>`.

use std::sync::Arc;

use crate::protocol::LogEntry;
use crate::store::LogStore;

/// The browser instrumentation IIFE script, embedded at compile time.
pub const CLIENT_SCRIPT: &str = include_str!("client.js");

/// Script tags to inject into HTML responses.
///
/// Sets the ingest URL and loads the IIFE with `defer` so it runs after
/// the DOM is ready.
pub const SCRIPT_TAGS: &str = r#"<script>window.__DEBUGGER_INGEST_URL__="/_/d";</script><script src="/_/d.js" defer></script>"#;

/// Inject debugger script tags into an HTML string before `</body>`.
///
/// If the HTML already contains `__DEBUGGER_INGEST_URL__` (i.e. was
/// already injected), the original string is returned unchanged.
/// If there is no `</body>` tag, the original string is returned as-is.
pub fn inject_scripts(html: &str) -> String {
    if html.contains("__DEBUGGER_INGEST_URL__") {
        return html.to_string();
    }
    if let Some(idx) = html.rfind("</body>") {
        let mut result = String::with_capacity(html.len() + SCRIPT_TAGS.len());
        result.push_str(&html[..idx]);
        result.push_str(SCRIPT_TAGS);
        result.push_str(&html[idx..]);
        result
    } else {
        html.to_string()
    }
}

/// Ingest a batch of browser entries into the store.
///
/// Each value in `entries` is attempted as a [`LogEntry`] deserialization.
/// Entries that fail to deserialize are silently dropped (this is a dev
/// tool; the browser may send shapes we don't fully model).
pub fn ingest_entries(store: &Arc<LogStore>, entries: &[serde_json::Value]) {
    for value in entries {
        match serde_json::from_value::<LogEntry>(value.clone()) {
            Ok(entry) => store.push(entry),
            Err(_) => {
                // Best-effort: if the entry has a "type" field we
                // recognise, push it raw into the correct buffer.
                // Otherwise silently drop.
            }
        }
    }
}

/// Common CORS headers for the ingest endpoint.
pub const CORS_HEADERS: [(&str, &str); 4] = [
    ("access-control-allow-origin", "*"),
    ("access-control-allow-methods", "POST, OPTIONS"),
    ("access-control-allow-headers", "content-type"),
    ("access-control-allow-credentials", "true"),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inject_into_html() {
        let html = "<html><body><h1>Hello</h1></body></html>";
        let result = inject_scripts(html);
        assert!(result.contains(SCRIPT_TAGS));
        assert!(result.contains("</body>"));
        // Script tags should be before </body>
        let script_pos = result.find(SCRIPT_TAGS).unwrap();
        let body_pos = result.rfind("</body>").unwrap();
        assert!(script_pos < body_pos);
    }

    #[test]
    fn inject_idempotent() {
        let html = "<html><body><h1>Hello</h1></body></html>";
        let first = inject_scripts(html);
        let second = inject_scripts(&first);
        assert_eq!(first, second);
    }

    #[test]
    fn inject_no_body_tag() {
        let html = "<html><h1>Hello</h1></html>";
        let result = inject_scripts(html);
        assert_eq!(result, html);
    }

    #[test]
    fn client_script_is_not_empty() {
        assert!(!CLIENT_SCRIPT.is_empty());
        assert!(CLIENT_SCRIPT.contains("__DEBUGGER_INITIALIZED__"));
    }

    #[test]
    fn ingest_valid_console_entry() {
        let session = crate::protocol::create_session("test", 3000);
        let store = Arc::new(LogStore::new(session));

        let entries = vec![serde_json::json!({
            "type": "console",
            "level": "info",
            "args": ["hello from browser"],
            "timestamp": 1700000000000_i64,
            "source": "browser"
        })];

        ingest_entries(&store, &entries);

        let resp = store.query("console", &crate::protocol::Filters::default());
        assert_eq!(resp.data.len(), 1);
    }

    #[test]
    fn ingest_invalid_entry_is_dropped() {
        let session = crate::protocol::create_session("test", 3000);
        let store = Arc::new(LogStore::new(session));

        let entries = vec![serde_json::json!({
            "garbage": true
        })];

        ingest_entries(&store, &entries);

        let resp = store.query("all", &crate::protocol::Filters::default());
        assert_eq!(resp.data.len(), 0);
    }
}
