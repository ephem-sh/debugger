import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import type { QueryRequest, QueryResponse } from '../core/types.js'

/**
 * Send a query to the debugger bridge over IPC and return the response.
 * Automatically discovers the socket by walking parent directories.
 * @param request - NDJSON query to send to the bridge socket
 * @param cwd - Override working directory for socket discovery
 * @returns Parsed query response from the bridge
 */
export async function query(request: QueryRequest, cwd?: string): Promise<QueryResponse> {
  const socketPath = await resolveSocketPath(cwd)

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
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

    const socket = net.createConnection(socketPath, () => {
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
    const hash = createHash('md5').update(dir).digest('hex').slice(0, 8)
    const pipePath = `\\\\.\\pipe\\debugger-${hash}`

    const alive = await probeSocket(pipePath)
    if (alive) return pipePath

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  const hash = createHash('md5').update(startDir).digest('hex').slice(0, 8)
  return `\\\\.\\pipe\\debugger-${hash}`
}
