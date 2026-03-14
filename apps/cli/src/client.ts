import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'
import type { QueryRequest, QueryResponse } from '@ephem-sh/debuger-core'

export async function query(request: QueryRequest): Promise<QueryResponse> {
  const socketPath = resolveSocketPath()

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
      if ((err as any).code === 'ENOENT' || (err as any).code === 'ECONNREFUSED') {
        reject(new Error('No active debuger session found. Is your dev server running?'))
      } else {
        reject(err)
      }
    })
  })
}

function resolveSocketPath(): string {
  if (process.platform === 'win32') {
    // Windows named pipe
    const crypto = require('node:crypto')
    const hash = crypto.createHash('md5').update(process.cwd()).digest('hex').slice(0, 8)
    return `\\\\.\\pipe\\debuger-${hash}`
  }

  // Unix socket
  const sockPath = path.join(process.cwd(), '.debuger', 'bridge.sock')
  if (!fs.existsSync(sockPath)) {
    throw new Error('No active debuger session found. Is your dev server running?')
  }
  return sockPath
}
