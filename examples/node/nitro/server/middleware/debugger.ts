import { defineHandler } from 'nitro'
import { createConnection } from 'node:net'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

function pushViaIPC(entries: unknown[]): void {
  const cwd = process.cwd()
  // Try TCP addr file first (Windows), then named pipe
  const addrFile = join(cwd, '.debugger', 'bridge.addr')
  let target: string

  if (existsSync(addrFile)) {
    target = readFileSync(addrFile, 'utf-8').trim()
  } else if (process.platform === 'win32') {
    const hash = createHash('md5').update(cwd).digest('hex').slice(0, 8)
    target = `\\\\.\\pipe\\debugger-${hash}`
  } else {
    target = join(cwd, '.debugger', 'bridge.sock')
  }

  try {
    const tcpMatch = target.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)$/)
    const opts = tcpMatch
      ? { host: tcpMatch[1], port: parseInt(tcpMatch[2], 10) }
      : { path: target }

    const socket = createConnection(opts, () => {
      socket.write(JSON.stringify({ id: 'push', command: 'push', entries }) + '\n')
      socket.end()
    })
    socket.on('error', () => {})
  } catch {}
}

export default defineHandler(async (event) => {
  const path = event.url.pathname

  // Browser ingest — push via IPC since Nitro worker doesn't share globalThis
  if (path === '/_/d' && event.req.method === 'POST') {
    try {
      const entries = await event.req.json()
      if (Array.isArray(entries)) pushViaIPC(entries)
    } catch {}
    const origin = event.req.headers.get('origin') || '*'
    event.res.headers.set('access-control-allow-origin', origin)
    event.res.headers.set('access-control-allow-credentials', 'true')
    event.res.status = 204
    return ''
  }

  // CORS preflight
  if (path === '/_/d' && event.req.method === 'OPTIONS') {
    const origin = event.req.headers.get('origin') || '*'
    event.res.headers.set('access-control-allow-origin', origin)
    event.res.headers.set('access-control-allow-credentials', 'true')
    event.res.headers.set('access-control-allow-methods', 'POST, GET, OPTIONS')
    event.res.headers.set('access-control-allow-headers', 'Content-Type')
    event.res.status = 204
    return ''
  }
})
