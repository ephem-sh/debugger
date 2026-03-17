//! IPC bridge — NDJSON server over TCP (Windows) or Unix socket.
//!
//! The bridge listens for connections from the `dbg` CLI and responds to
//! query commands by reading from the [`LogStore`].

use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::Notify;

use crate::protocol::{LogEntry, QueryRequest, QueryResponse};
use crate::store::LogStore;

/// IPC bridge that the `dbg` CLI connects to.
///
/// On Windows the bridge listens on TCP `127.0.0.1:0` and writes the
/// address to `.debugger/bridge.addr`. On Unix it listens on a Unix
/// domain socket.
pub struct Bridge {
    shutdown: Arc<Notify>,
    task: Option<tokio::task::JoinHandle<()>>,
}

impl Bridge {
    /// Start the IPC bridge.
    ///
    /// This spawns a background Tokio task that accepts connections and
    /// processes NDJSON requests.
    pub async fn start(store: Arc<LogStore>) -> Result<Self, BridgeError> {
        let shutdown = Arc::new(Notify::new());

        if cfg!(windows) {
            Self::start_tcp(store, shutdown.clone()).await
        } else {
            Self::start_unix(store, shutdown.clone()).await
        }
    }

    #[cfg(not(windows))]
    async fn start_unix(
        store: Arc<LogStore>,
        shutdown: Arc<Notify>,
    ) -> Result<Self, BridgeError> {
        use std::path::Path;
        use tokio::net::UnixListener;

        let socket_path = store.session().socket_path.clone();
        let dir = Path::new(&socket_path)
            .parent()
            .ok_or_else(|| BridgeError::Io("invalid socket path".to_string()))?;

        tokio::fs::create_dir_all(dir)
            .await
            .map_err(|e| BridgeError::Io(format!("create socket dir: {e}")))?;

        // Remove stale socket file
        let _ = tokio::fs::remove_file(&socket_path).await;

        let listener = UnixListener::bind(&socket_path)
            .map_err(|e| BridgeError::Io(format!("bind unix socket: {e}")))?;

        write_session_file(&store, None).await;

        let cwd = std::env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let session_file = format!("{cwd}/.debugger/session.json");

        let sd = shutdown.clone();
        let task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = sd.notified() => break,
                    result = listener.accept() => {
                        match result {
                            Ok((stream, _)) => {
                                let store = store.clone();
                                tokio::spawn(async move {
                                    let (reader, writer) = stream.into_split();
                                    handle_connection(BufReader::new(reader), writer, store).await;
                                });
                            }
                            Err(_) => continue,
                        }
                    }
                }
            }
            let _ = tokio::fs::remove_file(&socket_path).await;
            let _ = tokio::fs::remove_file(&session_file).await;
        });

        Ok(Self {
            shutdown,
            task: Some(task),
        })
    }

    #[cfg(windows)]
    async fn start_unix(
        store: Arc<LogStore>,
        shutdown: Arc<Notify>,
    ) -> Result<Self, BridgeError> {
        // Unix sockets not available on Windows — fall through to TCP
        Self::start_tcp(store, shutdown).await
    }

    async fn start_tcp(
        store: Arc<LogStore>,
        shutdown: Arc<Notify>,
    ) -> Result<Self, BridgeError> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| BridgeError::Io(format!("bind tcp: {e}")))?;

        let addr = listener
            .local_addr()
            .map_err(|e| BridgeError::Io(format!("get local addr: {e}")))?;

        // Write the TCP address to .debugger/bridge.addr
        let cwd = std::env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let addr_dir = format!("{cwd}/.debugger");
        tokio::fs::create_dir_all(&addr_dir)
            .await
            .map_err(|e| BridgeError::Io(format!("create addr dir: {e}")))?;

        let addr_file = format!("{addr_dir}/bridge.addr");
        tokio::fs::write(&addr_file, addr.to_string())
            .await
            .map_err(|e| BridgeError::Io(format!("write addr file: {e}")))?;

        eprintln!("> @ephem-sh/debugger: bridge listening on {addr}");

        write_session_file(&store, Some(&addr.to_string())).await;

        let session_file = format!("{addr_dir}/session.json");

        let sd = shutdown.clone();
        let task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = sd.notified() => break,
                    result = listener.accept() => {
                        match result {
                            Ok((stream, _)) => {
                                let store = store.clone();
                                tokio::spawn(async move {
                                    let (reader, writer) = stream.into_split();
                                    handle_connection(BufReader::new(reader), writer, store).await;
                                });
                            }
                            Err(_) => continue,
                        }
                    }
                }
            }
            // Clean up bridge.addr and session.json
            let _ = tokio::fs::remove_file(&addr_file).await;
            let _ = tokio::fs::remove_file(&session_file).await;
        });

        Ok(Self {
            shutdown,
            task: Some(task),
        })
    }

    /// Gracefully stop the bridge.
    pub async fn stop(&mut self) {
        self.shutdown.notify_one();
        if let Some(task) = self.task.take() {
            let _ = task.await;
        }
    }
}

/// Handle a single client connection — reads NDJSON lines and writes responses.
async fn handle_connection<R, W>(reader: BufReader<R>, mut writer: W, store: Arc<LogStore>)
where
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin,
{
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.is_empty() {
            continue;
        }

        let req: QueryRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                let _ = write_error(&mut writer, "", &format!("invalid request: {e}")).await;
                continue;
            }
        };

        if req.command == "push" {
            handle_push(&mut writer, &req, &store).await;
            continue;
        }

        let filters = req.filters.as_ref().cloned().unwrap_or_default();
        let mut resp = store.query(&req.command, &filters);
        resp.id = req.id;

        let _ = write_response(&mut writer, &resp).await;
    }
}

/// Handle a push command — parse the data field and push to store.
async fn handle_push<W: tokio::io::AsyncWrite + Unpin>(
    writer: &mut W,
    req: &QueryRequest,
    store: &LogStore,
) {
    if let Some(ref data) = req.data {
        match serde_json::from_value::<LogEntry>(data.clone()) {
            Ok(entry) => store.push(entry),
            Err(e) => {
                let _ = write_error(writer, &req.id, &format!("unmarshal push data: {e}")).await;
                return;
            }
        }
    }
    let _ = write_ok(writer, &req.id).await;
}

async fn write_response<W: tokio::io::AsyncWrite + Unpin>(
    writer: &mut W,
    resp: &QueryResponse,
) -> Result<(), std::io::Error> {
    let mut json = serde_json::to_vec(resp).unwrap_or_default();
    json.push(b'\n');
    writer.write_all(&json).await?;
    writer.flush().await
}

async fn write_ok<W: tokio::io::AsyncWrite + Unpin>(
    writer: &mut W,
    id: &str,
) -> Result<(), std::io::Error> {
    let resp = QueryResponse {
        id: id.to_string(),
        ok: true,
        data: Vec::new(),
        session: None,
        error: None,
    };
    write_response(writer, &resp).await
}

async fn write_error<W: tokio::io::AsyncWrite + Unpin>(
    writer: &mut W,
    id: &str,
    msg: &str,
) -> Result<(), std::io::Error> {
    let resp = QueryResponse {
        id: id.to_string(),
        ok: false,
        data: Vec::new(),
        session: None,
        error: Some(msg.to_string()),
    };
    write_response(writer, &resp).await
}

/// Write session.json to `.debugger/` so the CLI can discover the session.
async fn write_session_file(store: &LogStore, socket_override: Option<&str>) {
    let cwd = std::env::current_dir()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let session_dir = format!("{cwd}/.debugger");
    let _ = tokio::fs::create_dir_all(&session_dir).await;
    let session_file = format!("{session_dir}/session.json");
    let mut session = store.session().clone();
    if let Some(addr) = socket_override {
        session.socket_path = addr.to_string();
    }
    if let Ok(json) = serde_json::to_string(&session) {
        let _ = tokio::fs::write(&session_file, format!("{json}\n")).await;
    }
}

/// Errors that can occur when starting or running the bridge.
#[derive(Debug)]
pub enum BridgeError {
    /// An I/O error occurred.
    Io(String),
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(msg) => write!(f, "bridge I/O error: {msg}"),
        }
    }
}

impl std::error::Error for BridgeError {}
