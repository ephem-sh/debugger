/** Severity level for console log entries. */
export type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info'

/** Origin environment of a log entry. */
export type LogSource = 'browser' | 'server'

/** Captured console output from browser or server. */
export interface ConsoleEntry {
  type: 'console'
  /** Unique entry identifier (6-char hex). Assigned by LogStore on push if not provided. */
  id?: string
  level: LogLevel
  args: unknown[]
  timestamp: number
  source: LogSource
}

/** Captured runtime error with optional stack trace. */
export interface ErrorEntry {
  type: 'error'
  /** Unique entry identifier (6-char hex). Assigned by LogStore on push if not provided. */
  id?: string
  message: string
  stack?: string
  timestamp: number
  source: LogSource
  /** URL where the error occurred (browser only). */
  url?: string
  /** Component name where the error originated (framework-specific). */
  component?: string
}

/** Captured HTTP network request with timing. */
export interface NetworkEntry {
  type: 'network'
  /** Unique entry identifier (6-char hex). Assigned by LogStore on push if not provided. */
  id?: string
  url: string
  method: string
  status: number
  /** Round-trip duration in milliseconds. */
  duration: number
  timestamp: number
  failed: boolean
  /** Network entries always originate from the browser. */
  source: 'browser'
  /** Transport kind that originated this request. */
  kind?: 'fetch' | 'xhr' | 'ws'
  /** Request headers sent with the request. */
  requestHeaders?: Record<string, string>
  /** Response headers received. */
  responseHeaders?: Record<string, string>
  /** Response body (capped at 4KB, captured for failed requests only). */
  responseBody?: string
  /** WebSocket connection identifier (WS only). */
  connectionId?: string
  /** Number of WebSocket messages exchanged (WS only). */
  messageCount?: number
  /** WebSocket readyState at capture time (WS only). */
  wsReadyState?: number
}

/** Cookie information from document.cookie or Cookie Store API. */
export interface CookieInfo {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: number
  secure?: boolean
  sameSite?: string
}

/** Service worker registration info. */
export interface ServiceWorkerInfo {
  scope: string
  scriptURL: string
  state: string
}

/** Cache storage name and entry count. */
export interface CacheInfo {
  name: string
  entryCount: number
}

/** Permission state for a browser API. */
export interface PermissionInfo {
  name: string
  state: 'granted' | 'denied' | 'prompt'
}

/** Captured browser application state (cookies, storage, workers, etc.). */
export interface AppEntry {
  type: 'app'
  /** Unique entry identifier (6-char hex). Assigned by LogStore on push if not provided. */
  id?: string
  timestamp: number
  source: 'browser'
  cookies?: CookieInfo[]
  localStorage?: Record<string, string>
  sessionStorage?: Record<string, string>
  serviceWorkers?: ServiceWorkerInfo[]
  cacheStorage?: CacheInfo[]
  permissions?: PermissionInfo[]
  storageEstimate?: { usage: number; quota: number }
}

/** Discriminated union of all log entry types, keyed by `type`. */
export type LogEntry = ConsoleEntry | ErrorEntry | NetworkEntry | AppEntry

/** Metadata for an active debugger session. */
export interface SessionInfo {
  sessionId: string
  framework: string
  port: number
  pid: number
  /** Epoch milliseconds when the session started. */
  startedAt: number
  /** Unix socket path or Windows named pipe path for IPC. */
  socketPath: string
}

/** NDJSON request sent by the CLI over IPC. */
export interface QueryRequest {
  id: string
  command: 'errors' | 'console' | 'network' | 'app' | 'status' | 'all' | 'push'
  filters?: {
    /** Look up a single entry by ID. */
    id?: string
    /** Look up multiple entries by ID. */
    ids?: string[]
    /** Only include entries within the last N milliseconds. */
    last?: number
    /** Match console level exactly. */
    level?: string
    /** Match HTTP status code exactly. */
    status?: number
    /** Only include failed network requests. */
    failed?: boolean
    /** Maximum number of entries to return (default 50). */
    limit?: number
    /** Filter by origin environment (browser or server). */
    source?: LogSource
    /** App subcommand (cookies, storage, workers, cache, permissions, quota). */
    subcommand?: string
    /** Cookie name filter. */
    name?: string
    /** Storage key filter. */
    key?: string
    /** Storage type filter (local or session). */
    storageType?: 'local' | 'session'
  }
}

/** NDJSON response sent back to the CLI over IPC. */
export interface QueryResponse {
  id: string
  ok: boolean
  data: LogEntry[]
  session?: SessionInfo
  error?: string
}
