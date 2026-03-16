//! NDJSON IPC protocol types matching `shared/protocol/schema.json`.
//!
//! All structs derive `Serialize` and `Deserialize` for NDJSON transport.
//! The [`LogEntry`] enum uses an internally-tagged representation keyed on
//! `"type"` so it round-trips with the Node.js / Go implementations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::{BuildHasher, Hasher, RandomState};
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// Log entries
// ---------------------------------------------------------------------------

/// Discriminated union of all log entry types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LogEntry {
    /// A captured console log message.
    #[serde(rename = "console")]
    Console(ConsoleEntry),
    /// A captured runtime error.
    #[serde(rename = "error")]
    Error(ErrorEntry),
    /// A captured network request.
    #[serde(rename = "network")]
    Network(NetworkEntry),
    /// A snapshot of browser application state.
    #[serde(rename = "app")]
    App(AppEntry),
}

impl LogEntry {
    /// Returns the entry's unique identifier, if set.
    pub fn id(&self) -> Option<&str> {
        match self {
            Self::Console(e) => e.id.as_deref(),
            Self::Error(e) => e.id.as_deref(),
            Self::Network(e) => e.id.as_deref(),
            Self::App(e) => e.id.as_deref(),
        }
    }

    /// Returns the entry timestamp (Unix epoch milliseconds).
    pub fn timestamp(&self) -> i64 {
        match self {
            Self::Console(e) => e.timestamp,
            Self::Error(e) => e.timestamp,
            Self::Network(e) => e.timestamp,
            Self::App(e) => e.timestamp,
        }
    }

    /// Sets the entry's unique identifier.
    pub fn set_id(&mut self, id: String) {
        match self {
            Self::Console(e) => e.id = Some(id),
            Self::Error(e) => e.id = Some(id),
            Self::Network(e) => e.id = Some(id),
            Self::App(e) => e.id = Some(id),
        }
    }

    /// Returns the source field value.
    pub fn source(&self) -> &str {
        match self {
            Self::Console(e) => &e.source,
            Self::Error(e) => &e.source,
            Self::Network(e) => &e.source,
            Self::App(e) => &e.source,
        }
    }
}

/// A captured console log message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleEntry {
    /// Unique entry identifier (6-char hex).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Log level: `"log"`, `"warn"`, `"error"`, `"debug"`, or `"info"`.
    pub level: String,
    /// Serialized console arguments.
    pub args: Vec<serde_json::Value>,
    /// Unix epoch milliseconds.
    pub timestamp: i64,
    /// `"browser"` or `"server"`.
    pub source: String,
}

/// A captured runtime error.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEntry {
    /// Unique entry identifier (6-char hex).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Error message.
    pub message: String,
    /// Stack trace, if available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    /// Unix epoch milliseconds.
    pub timestamp: i64,
    /// `"browser"` or `"server"`.
    pub source: String,
    /// URL where the error occurred.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    /// Component name where the error occurred.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component: Option<String>,
}

/// A captured network request (fetch, XHR, or WebSocket).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkEntry {
    /// Unique entry identifier (6-char hex).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Request URL.
    pub url: String,
    /// HTTP method.
    pub method: String,
    /// HTTP status code.
    pub status: i32,
    /// Duration in milliseconds.
    pub duration: f64,
    /// Unix epoch milliseconds.
    pub timestamp: i64,
    /// Whether the request failed.
    pub failed: bool,
    /// `"browser"` (network entries always come from the browser).
    pub source: String,
    /// Transport kind: `"fetch"`, `"xhr"`, or `"ws"`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    /// Request headers.
    #[serde(rename = "requestHeaders", skip_serializing_if = "Option::is_none")]
    pub request_headers: Option<HashMap<String, String>>,
    /// Response headers.
    #[serde(rename = "responseHeaders", skip_serializing_if = "Option::is_none")]
    pub response_headers: Option<HashMap<String, String>>,
    /// Response body (capped at 4KB, captured for failed requests only).
    #[serde(rename = "responseBody", skip_serializing_if = "Option::is_none")]
    pub response_body: Option<String>,
    /// WebSocket connection identifier.
    #[serde(rename = "connectionId", skip_serializing_if = "Option::is_none")]
    pub connection_id: Option<String>,
    /// Number of WebSocket messages exchanged.
    #[serde(rename = "messageCount", skip_serializing_if = "Option::is_none")]
    pub message_count: Option<i32>,
    /// WebSocket readyState at capture time.
    #[serde(rename = "wsReadyState", skip_serializing_if = "Option::is_none")]
    pub ws_ready_state: Option<i32>,
}

/// Cookie information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CookieInfo {
    /// Cookie name.
    pub name: String,
    /// Cookie value.
    pub value: String,
    /// Cookie domain.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    /// Cookie path.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Expiry timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires: Option<f64>,
    /// Secure flag.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secure: Option<bool>,
    /// SameSite attribute.
    #[serde(rename = "sameSite", skip_serializing_if = "Option::is_none")]
    pub same_site: Option<String>,
}

/// Service worker information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceWorkerInfo {
    /// Service worker scope.
    pub scope: String,
    /// Script URL.
    #[serde(rename = "scriptURL")]
    pub script_url: String,
    /// Service worker state.
    pub state: String,
}

/// Cache storage information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheInfo {
    /// Cache name.
    pub name: String,
    /// Number of entries in the cache.
    #[serde(rename = "entryCount")]
    pub entry_count: i32,
}

/// Browser permission state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionInfo {
    /// Permission name.
    pub name: String,
    /// Permission state: `"granted"`, `"denied"`, or `"prompt"`.
    pub state: String,
}

/// Browser storage quota and usage estimate.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageEstimate {
    /// Bytes used.
    pub usage: f64,
    /// Total quota in bytes.
    pub quota: f64,
}

/// A snapshot of browser application state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEntry {
    /// Unique entry identifier (6-char hex).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Unix epoch milliseconds.
    pub timestamp: i64,
    /// `"browser"` (app entries always come from the browser).
    pub source: String,
    /// Browser cookies.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cookies: Option<Vec<CookieInfo>>,
    /// Local storage key-value pairs.
    #[serde(rename = "localStorage", skip_serializing_if = "Option::is_none")]
    pub local_storage: Option<HashMap<String, String>>,
    /// Session storage key-value pairs.
    #[serde(rename = "sessionStorage", skip_serializing_if = "Option::is_none")]
    pub session_storage: Option<HashMap<String, String>>,
    /// Registered service workers.
    #[serde(rename = "serviceWorkers", skip_serializing_if = "Option::is_none")]
    pub service_workers: Option<Vec<ServiceWorkerInfo>>,
    /// Cache storage entries.
    #[serde(rename = "cacheStorage", skip_serializing_if = "Option::is_none")]
    pub cache_storage: Option<Vec<CacheInfo>>,
    /// Browser permissions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<PermissionInfo>>,
    /// Storage estimate.
    #[serde(rename = "storageEstimate", skip_serializing_if = "Option::is_none")]
    pub storage_estimate: Option<StorageEstimate>,
}

// ---------------------------------------------------------------------------
// Session & query types
// ---------------------------------------------------------------------------

/// Describes the running debugger session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    /// Unique session identifier.
    #[serde(rename = "sessionId")]
    pub session_id: String,
    /// Web framework name (e.g. `"axum"`, `"actix"`).
    pub framework: String,
    /// HTTP port the application listens on.
    pub port: i32,
    /// Process ID.
    pub pid: u32,
    /// Session start time (Unix epoch milliseconds).
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    /// IPC socket path or TCP address.
    #[serde(rename = "socketPath")]
    pub socket_path: String,
}

/// Query filters sent by the CLI client.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Filters {
    /// Look up a single entry by ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Look up multiple entries by ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ids: Option<Vec<String>>,
    /// Return entries from the last N milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<f64>,
    /// Filter by log level.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    /// Filter network entries by HTTP status.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<f64>,
    /// If true, return only failed network requests.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed: Option<bool>,
    /// Max number of entries to return.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
    /// Filter entries by source (`"browser"` or `"server"`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// Sub-command qualifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subcommand: Option<String>,
    /// Filter by name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Filter by key.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    /// Filter by storage type.
    #[serde(rename = "storageType", skip_serializing_if = "Option::is_none")]
    pub storage_type: Option<String>,
}

/// NDJSON request message sent from the CLI to the bridge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRequest {
    /// Request identifier for correlation.
    pub id: String,
    /// Command name: `"errors"`, `"console"`, `"network"`, `"status"`, `"all"`, `"app"`, `"push"`.
    pub command: String,
    /// Optional query filters.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<Filters>,
    /// Raw entry data for push commands.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// NDJSON response message sent from the bridge to the CLI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    /// Correlation identifier matching the request.
    pub id: String,
    /// Whether the command succeeded.
    pub ok: bool,
    /// Result entries.
    pub data: Vec<serde_json::Value>,
    /// Session metadata (included in most responses).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<SessionInfo>,
    /// Error message when `ok` is `false`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/// Generate a random 6-character hex identifier.
pub fn generate_id() -> String {
    let s = RandomState::new();
    let mut h = s.build_hasher();
    h.write_u128(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
    );
    format!("{:06x}", h.finish() & 0xFFFFFF)
}

/// Returns the current time as Unix epoch milliseconds.
pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Compute the IPC socket path for the given working directory.
///
/// On Windows this returns the path to `.debugger/bridge.addr` (TCP fallback).
/// On Unix this returns `<cwd>/.debugger/bridge.sock`.
pub fn compute_socket_path(cwd: &str) -> String {
    if cfg!(windows) {
        // On Windows we use TCP with a bridge.addr file, same as Go.
        // The "socket path" stored in session info is the named pipe path
        // for compatibility, but the bridge actually listens on TCP.
        use std::collections::hash_map::DefaultHasher;
        use std::hash::Hash;
        let mut hasher = DefaultHasher::new();
        cwd.to_lowercase().hash(&mut hasher);
        let hash = format!("{:016x}", hasher.finish());
        format!(r"\\.\pipe\debugger-{}", &hash[..8])
    } else {
        format!("{cwd}/.debugger/bridge.sock")
    }
}

/// Create a new [`SessionInfo`] for the given framework and port.
pub fn create_session(framework: &str, port: i32) -> SessionInfo {
    let cwd = std::env::current_dir()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    SessionInfo {
        session_id: generate_id(),
        framework: framework.to_string(),
        port,
        pid: std::process::id(),
        started_at: now_millis(),
        socket_path: compute_socket_path(&cwd),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_id_is_six_hex_chars() {
        let id = generate_id();
        assert_eq!(id.len(), 6);
        assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn console_entry_round_trip() {
        let entry = LogEntry::Console(ConsoleEntry {
            id: Some("abc123".to_string()),
            level: "info".to_string(),
            args: vec![serde_json::Value::String("hello".to_string())],
            timestamp: 1700000000000,
            source: "server".to_string(),
        });
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains(r#""type":"console"#));
        let parsed: LogEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id(), Some("abc123"));
    }

    #[test]
    fn query_request_round_trip() {
        let req = QueryRequest {
            id: "req1".to_string(),
            command: "console".to_string(),
            filters: Some(Filters {
                level: Some("error".to_string()),
                limit: Some(10),
                ..Default::default()
            }),
            data: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        let parsed: QueryRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.command, "console");
        assert_eq!(parsed.filters.as_ref().unwrap().level.as_deref(), Some("error"));
    }

    #[test]
    fn now_millis_is_reasonable() {
        let ms = now_millis();
        // Should be after 2020-01-01
        assert!(ms > 1_577_836_800_000);
    }
}
