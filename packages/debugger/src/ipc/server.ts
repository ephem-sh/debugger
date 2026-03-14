import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import type { LogStore } from '../core/log-store.js'
import type { SessionInfo, QueryRequest, QueryResponse } from '../core/types.js'

/**
 * Create an NDJSON IPC bridge that serves log queries over a Unix socket or Windows named pipe.
 *
 * Accepts one NDJSON request per connection, writes one response, then the client disconnects.
 * Automatically cleans up the socket file on stop and process signals.
 *
 * @param logStore - Log store to query against
 * @param session - Session metadata (provides the socket path)
 * @returns Object with `start` and `stop` methods to control the bridge lifecycle
 */
export function createBridge(logStore: LogStore, session: SessionInfo) {
  let server: net.Server | null = null
  const sockets = new Set<net.Socket>()

  const cleanup = () => {
    if (process.platform !== 'win32') {
      try {
        fs.unlinkSync(session.socketPath)
      } catch {}
      try {
        fs.rmdirSync(path.dirname(session.socketPath))
      } catch {}
    }
  }

  const onSignal = () => {
    stop().then(() => process.exit(0))
  }

  function createNetServer(): net.Server {
    return net.createServer((socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))

      let buffer = ''

      socket.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          handleRequest(line, socket)
        }
      })

      socket.on('error', () => {})
    })
  }

  function listenServer(srv: net.Server): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      srv.on('error', reject)
      srv.listen(session.socketPath, () => {
        process.on('SIGINT', onSignal)
        process.on('SIGTERM', onSignal)
        resolve()
      })
    })
  }

  /**
   * Check whether something is already listening on the socket/pipe path.
   * Resolves `true` if a server responds, `false` if the address is stale.
   */
  function probeExisting(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        probe.destroy()
        resolve(false)
      }, 2000)

      const probe = net.createConnection(session.socketPath, () => {
        probe.write(JSON.stringify({ id: 'probe', command: 'status' }) + '\n')
      })

      probe.on('data', () => {
        clearTimeout(timeout)
        probe.destroy()
        resolve(true)
      })

      probe.on('error', () => {
        clearTimeout(timeout)
        resolve(false)
      })
    })
  }

  async function start(): Promise<void> {
    if (process.platform !== 'win32') {
      const dir = path.dirname(session.socketPath)
      fs.mkdirSync(dir, { recursive: true })
      try {
        fs.unlinkSync(session.socketPath)
      } catch {}
    }

    server = createNetServer()

    try {
      await listenServer(server)
    } catch (err: unknown) {
      if (!isErrnoException(err) || err.code !== 'EADDRINUSE') throw err

      const alive = await probeExisting()
      if (alive) {
        server = null
        return
      }

      if (process.platform !== 'win32') {
        try {
          fs.unlinkSync(session.socketPath)
        } catch {}
        server = createNetServer()
        try {
          await listenServer(server)
        } catch {
          console.warn(
            '[debugger] Could not start IPC bridge after removing stale socket. CLI queries will not work.'
          )
          server = null
        }
      } else {
        let retrySuccess = false
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise<void>((r) => setTimeout(r, 200))
          server = createNetServer()
          try {
            await listenServer(server)
            retrySuccess = true
            break
          } catch {
            server = null
          }
        }
        if (!retrySuccess) {
          console.warn(
            '[debugger] Could not start IPC bridge after retrying stale pipe. CLI queries will not work.'
          )
        }
      }
    }
  }

  /**
   * Type guard for Node.js system errors with an `errno` code.
   */
  function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
    return err instanceof Error && 'code' in err
  }

  function handleRequest(line: string, socket: net.Socket): void {
    let request: QueryRequest
    try {
      request = JSON.parse(line)
    } catch {
      return
    }

    const response: QueryResponse = {
      id: request.id,
      ok: true,
      data: [],
    }

    try {
      if (request.command === 'push') {
        // Push entries from external processes (Nitro workers, etc.)
        const entries = (request as unknown as { entries: unknown[] }).entries
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            logStore.push(entry as import('../core/types.js').LogEntry)
          }
        }
        response.ok = true
      } else if (request.command === 'status') {
        response.data = []
        response.session = logStore.getSession()
      } else {
        response.data = logStore.query(request.command, request.filters)
      }
    } catch (err) {
      response.ok = false
      response.error = err instanceof Error ? err.message : String(err)
    }

    try {
      socket.write(JSON.stringify(response) + '\n')
    } catch {}
  }

  async function stop(): Promise<void> {
    process.removeListener('SIGINT', onSignal)
    process.removeListener('SIGTERM', onSignal)

    return new Promise<void>((resolve) => {
      if (!server) {
        cleanup()
        return resolve()
      }
      server.close(() => {
        cleanup()
        resolve()
      })
      for (const socket of sockets) {
        socket.destroy()
      }
    })
  }

  return { start, stop }
}
