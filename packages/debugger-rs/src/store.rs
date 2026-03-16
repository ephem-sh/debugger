//! Ring buffer log store.
//!
//! Provides a generic [`RingBuffer`] and a higher-level [`LogStore`] that
//! manages separate buffers for each entry type with query/filter support.
//! Thread-safe via `std::sync::Mutex`.

use std::sync::Mutex;

use crate::protocol::{
    ConsoleEntry, ErrorEntry, Filters, LogEntry, NetworkEntry, QueryResponse, SessionInfo,
    generate_id, now_millis,
};

/// Default ring buffer capacities.
pub const CONSOLE_CAPACITY: usize = 500;
/// Default error buffer capacity.
pub const ERROR_CAPACITY: usize = 100;
/// Default network buffer capacity.
pub const NETWORK_CAPACITY: usize = 300;
/// Default app buffer capacity.
pub const APP_CAPACITY: usize = 50;

/// A fixed-capacity circular buffer. When full, the oldest element is
/// overwritten.
pub struct RingBuffer<T> {
    buf: Vec<Option<T>>,
    head: usize,
    size: usize,
    capacity: usize,
}

impl<T: Clone> RingBuffer<T> {
    /// Create a new ring buffer with the given capacity.
    pub fn new(capacity: usize) -> Self {
        let mut buf = Vec::with_capacity(capacity);
        buf.resize_with(capacity, || None);
        Self {
            buf,
            head: 0,
            size: 0,
            capacity,
        }
    }

    /// Push an item into the buffer. If full, the oldest item is overwritten.
    pub fn push(&mut self, item: T) {
        if self.size == self.capacity {
            self.buf[self.head] = Some(item);
            self.head = (self.head + 1) % self.capacity;
        } else {
            let idx = (self.head + self.size) % self.capacity;
            self.buf[idx] = Some(item);
            self.size += 1;
        }
    }

    /// Return all items in insertion order (oldest first).
    pub fn to_vec(&self) -> Vec<T> {
        let mut result = Vec::with_capacity(self.size);
        for i in 0..self.size {
            if let Some(item) = &self.buf[(self.head + i) % self.capacity] {
                result.push(item.clone());
            }
        }
        result
    }

    /// Return items matching a predicate, in insertion order.
    pub fn filter<F: Fn(&T) -> bool>(&self, pred: F) -> Vec<T> {
        let mut result = Vec::new();
        for i in 0..self.size {
            if let Some(item) = &self.buf[(self.head + i) % self.capacity]
                && pred(item)
            {
                result.push(item.clone());
            }
        }
        result
    }

    /// Clear all items from the buffer.
    pub fn clear(&mut self) {
        self.head = 0;
        self.size = 0;
        for slot in &mut self.buf {
            *slot = None;
        }
    }

    /// Return the current number of items.
    pub fn len(&self) -> usize {
        self.size
    }

    /// Whether the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.size == 0
    }
}

/// Thread-safe log store managing separate ring buffers for each entry type.
///
/// Used by the bridge to respond to CLI queries and by middleware/capture
/// layers to push new entries.
pub struct LogStore {
    console: Mutex<RingBuffer<serde_json::Value>>,
    errors: Mutex<RingBuffer<serde_json::Value>>,
    network: Mutex<RingBuffer<serde_json::Value>>,
    app: Mutex<RingBuffer<serde_json::Value>>,
    session: SessionInfo,
}

impl LogStore {
    /// Create a new store with default buffer capacities.
    pub fn new(session: SessionInfo) -> Self {
        Self {
            console: Mutex::new(RingBuffer::new(CONSOLE_CAPACITY)),
            errors: Mutex::new(RingBuffer::new(ERROR_CAPACITY)),
            network: Mutex::new(RingBuffer::new(NETWORK_CAPACITY)),
            app: Mutex::new(RingBuffer::new(APP_CAPACITY)),
            session,
        }
    }

    /// Push a log entry into the appropriate buffer.
    ///
    /// Assigns an ID if the entry does not already have one.
    pub fn push(&self, mut entry: LogEntry) {
        if entry.id().is_none() {
            entry.set_id(generate_id());
        }

        // Serialize to Value for storage. If serialization fails, silently
        // drop the entry (this is a dev tool, not a critical path).
        let value = match serde_json::to_value(&entry) {
            Ok(v) => v,
            Err(_) => return,
        };

        match entry {
            LogEntry::Console(_) => {
                if let Ok(mut buf) = self.console.lock() {
                    buf.push(value);
                }
            }
            LogEntry::Error(_) => {
                if let Ok(mut buf) = self.errors.lock() {
                    buf.push(value);
                }
            }
            LogEntry::Network(_) => {
                if let Ok(mut buf) = self.network.lock() {
                    buf.push(value);
                }
            }
            LogEntry::App(_) => {
                if let Ok(mut buf) = self.app.lock() {
                    buf.push(value);
                }
            }
        }
    }

    /// Push a console entry directly (convenience for middleware/capture).
    pub fn push_console(&self, level: &str, args: Vec<serde_json::Value>, source: &str) {
        self.push(LogEntry::Console(ConsoleEntry {
            id: None,
            level: level.to_string(),
            args,
            timestamp: now_millis(),
            source: source.to_string(),
        }));
    }

    /// Push an error entry directly (convenience for middleware/capture).
    pub fn push_error(&self, message: &str, stack: Option<String>, source: &str) {
        self.push(LogEntry::Error(ErrorEntry {
            id: None,
            message: message.to_string(),
            stack,
            timestamp: now_millis(),
            source: source.to_string(),
            url: None,
            component: None,
        }));
    }

    /// Push a network entry directly (convenience for middleware).
    pub fn push_network(&self, entry: NetworkEntry) {
        self.push(LogEntry::Network(entry));
    }

    /// Return the session info.
    pub fn session(&self) -> &SessionInfo {
        &self.session
    }

    /// Execute a query command with optional filters and return a response.
    pub fn query(&self, command: &str, filters: &Filters) -> QueryResponse {
        let data = match command {
            "console" => self.query_console(filters),
            "errors" => self.query_errors(filters),
            "network" => self.query_network(filters),
            "app" => self.query_app(),
            "all" => self.query_all(filters),
            "status" | "push" => Vec::new(),
            _ => Vec::new(),
        };

        let data = apply_common_filters(data, filters);

        QueryResponse {
            id: String::new(),
            ok: true,
            data,
            session: Some(self.session.clone()),
            error: None,
        }
    }

    fn query_console(&self, filters: &Filters) -> Vec<serde_json::Value> {
        let buf = match self.console.lock() {
            Ok(b) => b,
            Err(_) => return Vec::new(),
        };
        buf.filter(|v| {
            if let Some(ref level) = filters.level
                && v.get("level").and_then(|l| l.as_str()) != Some(level.as_str())
            {
                return false;
            }
            if let Some(ref source) = filters.source
                && v.get("source").and_then(|s| s.as_str()) != Some(source.as_str())
            {
                return false;
            }
            true
        })
    }

    fn query_errors(&self, filters: &Filters) -> Vec<serde_json::Value> {
        let buf = match self.errors.lock() {
            Ok(b) => b,
            Err(_) => return Vec::new(),
        };
        buf.filter(|v| {
            if let Some(ref source) = filters.source
                && v.get("source").and_then(|s| s.as_str()) != Some(source.as_str())
            {
                return false;
            }
            true
        })
    }

    fn query_network(&self, filters: &Filters) -> Vec<serde_json::Value> {
        let buf = match self.network.lock() {
            Ok(b) => b,
            Err(_) => return Vec::new(),
        };
        buf.filter(|v| {
            if let Some(status) = filters.status
                && v.get("status").and_then(|s| s.as_f64()) != Some(status)
            {
                return false;
            }
            if let Some(failed) = filters.failed
                && v.get("failed").and_then(|f| f.as_bool()) != Some(failed)
            {
                return false;
            }
            true
        })
    }

    fn query_app(&self) -> Vec<serde_json::Value> {
        match self.app.lock() {
            Ok(buf) => buf.to_vec(),
            Err(_) => Vec::new(),
        }
    }

    fn query_all(&self, filters: &Filters) -> Vec<serde_json::Value> {
        let mut all = Vec::new();
        all.extend(self.query_console(filters));
        all.extend(self.query_errors(filters));
        all.extend(self.query_network(filters));
        all.extend(self.query_app());

        all.sort_by(|a, b| {
            let ta = a.get("timestamp").and_then(|t| t.as_i64()).unwrap_or(0);
            let tb = b.get("timestamp").and_then(|t| t.as_i64()).unwrap_or(0);
            ta.cmp(&tb)
        });
        all
    }
}

/// Apply id, ids, last, and limit filters shared across all query commands.
fn apply_common_filters(
    mut entries: Vec<serde_json::Value>,
    filters: &Filters,
) -> Vec<serde_json::Value> {
    // Filter by single ID
    if let Some(ref id) = filters.id {
        for entry in &entries {
            if entry.get("id").and_then(|i| i.as_str()) == Some(id.as_str()) {
                return vec![entry.clone()];
            }
        }
        return Vec::new();
    }

    // Filter by multiple IDs
    if let Some(ref ids) = filters.ids {
        let id_set: std::collections::HashSet<&str> = ids.iter().map(|s| s.as_str()).collect();
        entries.retain(|e| {
            e.get("id")
                .and_then(|i| i.as_str())
                .is_some_and(|id| id_set.contains(id))
        });
    }

    // Filter by time window
    if let Some(last) = filters.last {
        let cutoff = now_millis() - last as i64;
        entries.retain(|e| {
            e.get("timestamp")
                .and_then(|t| t.as_i64())
                .is_some_and(|ts| ts >= cutoff)
        });
    }

    // Apply limit (take last N)
    if let Some(limit) = filters.limit
        && limit < entries.len()
    {
        entries = entries.split_off(entries.len() - limit);
    }

    entries
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::create_session;

    #[test]
    fn ring_buffer_basic() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(3);
        assert!(rb.is_empty());
        rb.push(1);
        rb.push(2);
        rb.push(3);
        assert_eq!(rb.len(), 3);
        assert_eq!(rb.to_vec(), vec![1, 2, 3]);
    }

    #[test]
    fn ring_buffer_overflow() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(3);
        rb.push(1);
        rb.push(2);
        rb.push(3);
        rb.push(4);
        assert_eq!(rb.len(), 3);
        assert_eq!(rb.to_vec(), vec![2, 3, 4]);
    }

    #[test]
    fn ring_buffer_filter() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(5);
        rb.push(1);
        rb.push(2);
        rb.push(3);
        rb.push(4);
        assert_eq!(rb.filter(|x| x % 2 == 0), vec![2, 4]);
    }

    #[test]
    fn ring_buffer_clear() {
        let mut rb: RingBuffer<i32> = RingBuffer::new(3);
        rb.push(1);
        rb.push(2);
        rb.clear();
        assert!(rb.is_empty());
        assert_eq!(rb.to_vec(), Vec::<i32>::new());
    }

    #[test]
    fn store_push_and_query_console() {
        let session = create_session("test", 3000);
        let store = LogStore::new(session);

        store.push_console("info", vec![serde_json::json!("hello")], "server");
        store.push_console("error", vec![serde_json::json!("bad")], "server");

        let resp = store.query("console", &Filters::default());
        assert!(resp.ok);
        assert_eq!(resp.data.len(), 2);

        let resp = store.query(
            "console",
            &Filters {
                level: Some("error".to_string()),
                ..Default::default()
            },
        );
        assert_eq!(resp.data.len(), 1);
    }

    #[test]
    fn store_query_all() {
        let session = create_session("test", 3000);
        let store = LogStore::new(session);

        store.push_console("info", vec![serde_json::json!("hello")], "server");
        store.push_error("oops", None, "server");

        let resp = store.query("all", &Filters::default());
        assert!(resp.ok);
        assert_eq!(resp.data.len(), 2);
    }

    #[test]
    fn store_query_with_limit() {
        let session = create_session("test", 3000);
        let store = LogStore::new(session);

        for i in 0..10 {
            store.push_console(
                "info",
                vec![serde_json::json!(format!("msg {i}"))],
                "server",
            );
        }

        let resp = store.query(
            "console",
            &Filters {
                limit: Some(3),
                ..Default::default()
            },
        );
        assert_eq!(resp.data.len(), 3);
    }
}
