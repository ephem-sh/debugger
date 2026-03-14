import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import type { LogStore } from './log-store.js'
import type { SessionInfo, QueryRequest, QueryResponse } from './types.js'

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

  async function start(): Promise<void> {
    if (process.platform !== 'win32') {
      const dir = path.dirname(session.socketPath)
      fs.mkdirSync(dir, { recursive: true })
      try {
        fs.unlinkSync(session.socketPath)
      } catch {}
    }

    server = net.createServer((socket) => {
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

    return new Promise<void>((resolve, reject) => {
      server!.on('error', reject)
      server!.listen(session.socketPath, () => {
        process.on('SIGINT', onSignal)
        process.on('SIGTERM', onSignal)
        resolve()
      })
    })
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
      if (request.command === 'status') {
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
