import type { LogEntry, ConsoleEntry, ErrorEntry, NetworkEntry, SessionInfo } from '@ephem-sh/debuger-core'

// ANSI color helpers
const esc = (code: string) => `\x1b[${code}m`
const reset = esc('0')
const bold = (s: string) => `${esc('1')}${s}${reset}`
const dim = (s: string) => `${esc('2')}${s}${reset}`
const red = (s: string) => `${esc('31')}${s}${reset}`
const yellow = (s: string) => `${esc('33')}${s}${reset}`
const green = (s: string) => `${esc('32')}${s}${reset}`
const gray = (s: string) => `${esc('90')}${s}${reset}`

export function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

function formatConsole(entry: ConsoleEntry): string {
  const ts = gray(formatTimestamp(entry.timestamp))
  const args = entry.args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  const src = dim(`[${entry.source}]`)

  switch (entry.level) {
    case 'error':
      return `${ts} ${red(entry.level.toUpperCase().padEnd(5))} ${src} ${args}`
    case 'warn':
      return `${ts} ${yellow(entry.level.toUpperCase().padEnd(5))} ${src} ${args}`
    default:
      return `${ts} ${dim(entry.level.toUpperCase().padEnd(5))} ${src} ${dim(args)}`
  }
}

function formatError(entry: ErrorEntry): string {
  const ts = gray(formatTimestamp(entry.timestamp))
  const src = dim(`[${entry.source}]`)
  const component = entry.component ? dim(` <${entry.component}>`) : ''
  let line = `${ts} ${red('ERROR')} ${src}${component} ${red(entry.message)}`
  if (entry.stack) {
    const stackLines = entry.stack
      .split('\n')
      .slice(0, 5)
      .map(l => `  ${dim(l.trim())}`)
      .join('\n')
    line += `\n${stackLines}`
  }
  return line
}

function formatNetwork(entry: NetworkEntry): string {
  const ts = gray(formatTimestamp(entry.timestamp))
  const method = bold(entry.method.padEnd(6))
  const dur = dim(`(${entry.duration}ms)`)

  if (entry.failed || entry.status >= 400) {
    const status = red(String(entry.status))
    return `${ts} ${status} ${method} ${red(entry.url)} ${dur}`
  }
  const status = green(String(entry.status))
  return `${ts} ${status} ${method} ${entry.url} ${dur}`
}

export function formatEntry(entry: LogEntry): string {
  switch (entry.type) {
    case 'console': return formatConsole(entry)
    case 'error': return formatError(entry)
    case 'network': return formatNetwork(entry)
  }
}

export function formatEntries(entries: LogEntry[]): string {
  if (entries.length === 0) return dim('No entries found.')
  return entries.map(formatEntry).join('\n')
}

export function formatSession(session: SessionInfo): string {
  const uptime = formatDuration(Date.now() - session.startedAt)
  return [
    `${bold('Session:')}  ${session.sessionId}`,
    `${bold('Framework:')} ${session.framework}`,
    `${bold('Port:')}     ${session.port}`,
    `${bold('PID:')}      ${session.pid}`,
    `${bold('Uptime:')}   ${uptime}`,
  ].join('\n')
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}
