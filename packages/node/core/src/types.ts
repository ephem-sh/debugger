export type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info'
export type LogSource = 'browser' | 'server'

export interface ConsoleEntry {
  type: 'console'
  level: LogLevel
  args: unknown[]
  timestamp: number
  source: LogSource
}

export interface ErrorEntry {
  type: 'error'
  message: string
  stack?: string
  timestamp: number
  source: LogSource
  url?: string
  component?: string
}

export interface NetworkEntry {
  type: 'network'
  url: string
  method: string
  status: number
  duration: number
  timestamp: number
  failed: boolean
}

export type LogEntry = ConsoleEntry | ErrorEntry | NetworkEntry

export interface SessionInfo {
  sessionId: string
  framework: string
  port: number
  pid: number
  startedAt: number
  socketPath: string
}

export interface QueryRequest {
  id: string
  command: 'errors' | 'console' | 'network' | 'status' | 'all'
  filters?: {
    last?: number
    level?: string
    status?: number
    failed?: boolean
    limit?: number
  }
}

export interface QueryResponse {
  id: string
  ok: boolean
  data: LogEntry[]
  session?: SessionInfo
  error?: string
}
