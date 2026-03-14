import { createHash } from 'node:crypto'
import path from 'node:path'
import type { SessionInfo } from './types.js'

function generateId(): string {
  const hex = Math.random().toString(16).slice(2, 8)
  return `dev-${hex}`
}

function computeSocketPath(): string {
  if (process.platform === 'win32') {
    const hash = createHash('md5').update(process.cwd()).digest('hex').slice(0, 8)
    return `\\\\.\\pipe\\debuger-${hash}`
  }
  return path.join(process.cwd(), '.debuger', 'bridge.sock')
}

export function createSession(opts: {
  framework: string
  port: number
}): SessionInfo {
  return {
    sessionId: generateId(),
    framework: opts.framework,
    port: opts.port,
    pid: process.pid,
    startedAt: Date.now(),
    socketPath: computeSocketPath(),
  }
}
