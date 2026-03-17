import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import type { QueryRequest, QueryResponse } from '../core/types.js'

/** A session discovered by scanning for `.debugger/session.json` files. */
export interface DiscoveredSession {
  sessionId: string
  framework: string
  port: number
  pid: number
  startedAt: number
  socketPath: string
  /** The directory containing the `.debugger/` folder. */
  dir: string
}

/** Directories to skip when scanning for sessions. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target',
  '.venv', '__pycache__', '.next', '.nuxt', '.svelte-kit',
])

/**
 * Recursively scan for `.debugger/session.json` files and return live sessions.
 * Scans up to 3 levels deep, skipping common non-project directories.
 * @param startDir - Root directory to start scanning from (defaults to cwd)
 * @returns Array of sessions whose sockets are currently reachable
 */
export async function discoverSessions(startDir?: string): Promise<DiscoveredSession[]> {
  const start = path.resolve(startDir || process.cwd())
  const sessions: DiscoveredSession[] = []

  scanDir(start, sessions, 0)

  const alive: DiscoveredSession[] = []
  for (const s of sessions) {
    const ok = await probeSocket(s.socketPath)
    if (ok) alive.push(s)
  }

  return alive
}

/**
 * Synchronously scan a directory for session files, recursing into subdirs.
 * @param dir - Current directory to scan
 * @param sessions - Accumulator for discovered sessions
 * @param depth - Current recursion depth
 */
function scanDir(dir: string, sessions: DiscoveredSession[], depth: number): void {
  if (depth > 3) return

  const sessionFile = path.join(dir, '.debugger', 'session.json')
  if (fs.existsSync(sessionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as Omit<DiscoveredSession, 'dir'>
      sessions.push({ ...data, dir })
    } catch { /* corrupt session file — skip */ }
  }

  if (depth >= 3) return

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    scanDir(path.join(dir, entry.name), sessions, depth + 1)
  }
}

/**
 * Resolve a socket path by matching a running session on a given port.
 * @param port - The port number to match
 * @param startDir - Root directory for session discovery
 * @returns Socket path for the matched session
 */
export async function resolveByPort(port: number, startDir?: string): Promise<string> {
  const sessions = await discoverSessions(startDir)
  const match = sessions.find(s => s.port === port)
  if (!match) throw new Error(`No active session on port ${port}`)
  return match.socketPath
}

/**
 * Resolve a socket path by matching a running session with a given session ID.
 * @param sessionId - The session ID to match
 * @param startDir - Root directory for session discovery
 * @returns Socket path for the matched session
 */
export async function resolveBySessionId(sessionId: string, startDir?: string): Promise<string> {
  const sessions = await discoverSessions(startDir)
  const match = sessions.find(s => s.sessionId === sessionId)
  if (!match) throw new Error(`No active session with id "${sessionId}"`)
  return match.socketPath
}

/**
 * Send a query to the debugger bridge over IPC and return the response.
 * Automatically discovers the socket by walking parent directories,
 * or targets a specific session via port or session ID.
 * @param request - NDJSON query to send to the bridge socket
 * @param opts - Working directory override, or object with cwd/port/session targeting
 * @returns Parsed query response from the bridge
 */
export async function query(
  request: QueryRequest,
  opts?: string | { cwd?: string; port?: number; session?: string },
): Promise<QueryResponse> {
  const resolvedOpts = typeof opts === 'string' ? { cwd: opts } : opts

  let socketPath: string
  if (resolvedOpts?.port) {
    socketPath = await resolveByPort(resolvedOpts.port, resolvedOpts.cwd)
  } else if (resolvedOpts?.session) {
    socketPath = await resolveBySessionId(resolvedOpts.session, resolvedOpts.cwd)
  } else {
    socketPath = await resolveSocketPath(resolvedOpts?.cwd)
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(parseSocketTarget(socketPath), () => {
      socket.write(JSON.stringify(request) + '\n')
    })

    let data = ''
    socket.on('data', chunk => {
      data += chunk.toString()
      const newlineIdx = data.indexOf('\n')
      if (newlineIdx !== -1) {
        const line = data.slice(0, newlineIdx)
        socket.end()
        resolve(JSON.parse(line))
      }
    })

    socket.on('error', err => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT' || (err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        reject(new Error('No active debugger session found. Is your dev server running?'))
      } else {
        reject(err)
      }
    })
  })
}

/**
 * Probe whether a socket/pipe path has an active listener.
 * @param socketPath - Unix socket or Windows named pipe path to probe
 * @returns True if a listener accepted the connection
 */
function probeSocket(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 500)

    const socket = net.createConnection(parseSocketTarget(socketPath), () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

/**
 * Parse a socket target string into net.createConnection options.
 * Handles both Unix socket paths and TCP "host:port" addresses.
 */
function parseSocketTarget(target: string): net.NetConnectOpts {
  const tcpMatch = target.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)$/)
  if (tcpMatch) {
    return { host: tcpMatch[1], port: parseInt(tcpMatch[2], 10) }
  }
  return { path: target }
}

/**
 * Resolve the IPC socket path by walking parent directories.
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Unix socket path or Windows named pipe path
 */
async function resolveSocketPath(startDir?: string): Promise<string> {
  const start = path.resolve(startDir || process.cwd())

  if (process.platform === 'win32') {
    return resolveWindowsPipe(start)
  }

  return resolveUnixSocket(start)
}

/**
 * Walk parent directories looking for a `.debugger/bridge.sock` file.
 * @param startDir - Directory to start searching from
 * @returns Path to the discovered Unix socket
 */
function resolveUnixSocket(startDir: string): string {
  let dir = startDir
  while (true) {
    const sockPath = path.join(dir, '.debugger', 'bridge.sock')
    if (fs.existsSync(sockPath)) return sockPath

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  throw new Error('No active debugger session found. Is your dev server running?')
}

/**
 * Walk parent directories probing Windows named pipes for an active listener.
 * @param startDir - Directory to start searching from
 * @returns Path to the discovered Windows named pipe
 */
async function resolveWindowsPipe(startDir: string): Promise<string> {
  let dir = startDir
  while (true) {
    // Try named pipe first (Node.js bridge)
    const hash = createHash('md5').update(dir).digest('hex').slice(0, 8)
    const pipePath = `\\\\.\\pipe\\debugger-${hash}`

    const alive = await probeSocket(pipePath)
    if (alive) return pipePath

    // Try TCP addr file fallback (Go bridge)
    const addrFile = path.join(dir, '.debugger', 'bridge.addr')
    if (fs.existsSync(addrFile)) {
      const addr = fs.readFileSync(addrFile, 'utf-8').trim()
      if (addr) {
        const tcpAlive = await probeSocket(addr)
        if (tcpAlive) return addr
      }
    }

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  const hash = createHash('md5').update(startDir).digest('hex').slice(0, 8)
  return `\\\\.\\pipe\\debugger-${hash}`
}
