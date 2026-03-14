import type { LogEntry, ConsoleEntry, ErrorEntry, NetworkEntry, AppEntry, SessionInfo, CookieInfo, ServiceWorkerInfo, CacheInfo, PermissionInfo } from '../core/types.js'

/** Wrap a string with an ANSI escape sequence. */
const esc = (code: string) => `\x1b[${code}m`
const reset = esc('0')
/** Wrap text in bold ANSI formatting. */
const bold = (s: string) => `${esc('1')}${s}${reset}`
/** Wrap text in dim ANSI formatting. */
const dim = (s: string) => `${esc('2')}${s}${reset}`
/** Wrap text in red ANSI formatting. */
const red = (s: string) => `${esc('31')}${s}${reset}`
/** Wrap text in yellow ANSI formatting. */
const yellow = (s: string) => `${esc('33')}${s}${reset}`
/** Wrap text in green ANSI formatting. */
const green = (s: string) => `${esc('32')}${s}${reset}`
/** Wrap text in gray ANSI formatting. */
const gray = (s: string) => `${esc('90')}${s}${reset}`

/**
 * Format an epoch timestamp as HH:MM:SS local time.
 * @param ts - Epoch timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/**
 * Format a duration in milliseconds as a human-readable string.
 * @param ms - Duration in milliseconds
 * @returns Compact string like "500ms", "2m 30s", or "1h 5m"
 */
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

/**
 * Format a console log entry with colored level badge and source tag.
 * @param entry - Console log entry to format
 * @returns ANSI-colored single-line string
 */
function formatConsole(entry: ConsoleEntry): string {
  const ts = gray(formatTimestamp(entry.timestamp))
  const id = entry.id ? dim(entry.id.padEnd(7)) : ''
  const args = entry.args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  const src = dim(`[${entry.source}]`)

  switch (entry.level) {
    case 'error':
      return `${ts} ${id} ${red(entry.level.toUpperCase().padEnd(5))} ${src} ${args}`
    case 'warn':
      return `${ts} ${id} ${yellow(entry.level.toUpperCase().padEnd(5))} ${src} ${args}`
    default:
      return `${ts} ${id} ${dim(entry.level.toUpperCase().padEnd(5))} ${src} ${dim(args)}`
  }
}

/**
 * Format a runtime error entry with message and truncated stack trace.
 * @param entry - Error entry to format
 * @returns ANSI-colored string, potentially multi-line if stack is present
 */
function formatError(entry: ErrorEntry): string {
  const ts = gray(formatTimestamp(entry.timestamp))
  const id = entry.id ? dim(entry.id.padEnd(7)) : ''
  const src = dim(`[${entry.source}]`)
  const component = entry.component ? dim(` <${entry.component}>`) : ''
  let line = `${ts} ${id} ${red('ERROR')} ${src}${component} ${red(entry.message)}`
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

/**
 * Format a network request entry with status, method, URL, and duration.
 * @param entry - Network entry to format
 * @returns ANSI-colored single-line string, red for failures/4xx+
 */
function formatNetwork(entry: NetworkEntry): string {
  const ts = gray(formatTimestamp(entry.timestamp))
  const id = entry.id ? dim(entry.id.padEnd(7)) : dim('?'.padEnd(7))
  const method = bold(entry.method.padEnd(6))
  const dur = dim(`(${entry.duration}ms)`)

  if (entry.failed || entry.status >= 400) {
    const status = red(String(entry.status))
    return `${ts} ${id} ${status} ${method} ${red(entry.url)} ${dur}`
  }
  const status = green(String(entry.status))
  return `${ts} ${id} ${status} ${method} ${entry.url} ${dur}`
}

/**
 * Format a single log entry by dispatching to the appropriate type formatter.
 * @param entry - Any log entry (console, error, or network)
 * @returns ANSI-colored formatted string
 */
export function formatEntry(entry: LogEntry): string {
  switch (entry.type) {
    case 'console': return formatConsole(entry)
    case 'error': return formatError(entry)
    case 'network': return formatNetwork(entry)
    case 'app': return formatAppSummary(entry)
  }
}

/**
 * Format an array of log entries as newline-separated text.
 * @param entries - Log entries to format
 * @returns Formatted output, or a "no entries" message if empty
 */
export function formatEntries(entries: LogEntry[]): string {
  if (entries.length === 0) return dim('No entries found.')
  return entries.map(formatEntry).join('\n')
}

/**
 * Format session metadata as a multi-line summary.
 * @param session - Active debugger session info
 * @returns Formatted session details with computed uptime
 */
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

/**
 * Serialize data as pretty-printed JSON.
 * @param data - Value to serialize
 * @returns Indented JSON string
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Format a network entry as a multi-line detail view with optional headers and body.
 * @param entry - Network entry to display in detail
 * @param showHeaders - Whether to include request/response headers
 * @param showBody - Whether to include the response body
 * @returns Multi-line ANSI-formatted string
 */
export function formatNetworkDetail(entry: NetworkEntry, showHeaders: boolean, showBody: boolean): string {
  const lines: string[] = []
  lines.push(`${bold('ID:')}       ${entry.id || '?'}`)
  lines.push(`${bold('URL:')}      ${entry.url}`)
  lines.push(`${bold('Method:')}   ${entry.method}`)
  lines.push(`${bold('Status:')}   ${entry.status}`)
  lines.push(`${bold('Duration:')} ${entry.duration}ms`)
  lines.push(`${bold('Failed:')}   ${entry.failed}`)
  if (entry.kind) lines.push(`${bold('Kind:')}     ${entry.kind}`)
  lines.push(`${bold('Time:')}     ${formatTimestamp(entry.timestamp)}`)

  if (showHeaders) {
    if (entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0) {
      lines.push('')
      lines.push(bold('Request Headers:'))
      for (const [key, value] of Object.entries(entry.requestHeaders)) {
        lines.push(`  ${dim(key)}: ${value}`)
      }
    }
    if (entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0) {
      lines.push('')
      lines.push(bold('Response Headers:'))
      for (const [key, value] of Object.entries(entry.responseHeaders)) {
        lines.push(`  ${dim(key)}: ${value}`)
      }
    }
  }

  if (showBody && entry.responseBody) {
    lines.push('')
    lines.push(bold('Response Body:'))
    lines.push(dim(entry.responseBody))
  }

  return lines.join('\n')
}

function formatAppSummary(entry: AppEntry): string {
  const ts = gray(formatTimestamp(entry.timestamp))
  const id = entry.id ? dim(entry.id.padEnd(7)) : ''
  const parts: string[] = []
  if (entry.cookies) parts.push(`${entry.cookies.length} cookies`)
  if (entry.localStorage) parts.push(`${Object.keys(entry.localStorage).length} local`)
  if (entry.sessionStorage) parts.push(`${Object.keys(entry.sessionStorage).length} session`)
  if (entry.serviceWorkers) parts.push(`${entry.serviceWorkers.length} workers`)
  return `${ts} ${id} ${dim('APP')}   ${dim(`[browser]`)} ${dim(parts.join(', '))}`
}

/**
 * Format cookie entries for display.
 * @param cookies - Cookie list from AppEntry
 * @param nameFilter - Optional name to filter by
 * @returns Formatted cookie table
 */
export function formatCookies(cookies?: CookieInfo[], nameFilter?: string): string {
  if (!cookies || cookies.length === 0) return dim('No cookies found.')
  let filtered = cookies
  if (nameFilter) {
    filtered = cookies.filter(c => c.name === nameFilter)
    if (filtered.length === 0) return dim(`No cookie named "${nameFilter}".`)
  }
  const lines = filtered.map(c => {
    const flags: string[] = []
    if (c.secure) flags.push('Secure')
    if (c.sameSite) flags.push(`SameSite=${c.sameSite}`)
    if (c.expires) flags.push(`Expires=${new Date(c.expires).toISOString()}`)
    const meta = flags.length > 0 ? ` ${dim(flags.join(', '))}` : ''
    return `  ${bold(c.name)}=${c.value}${meta}`
  })
  return `${bold('Cookies')} ${dim(`(${filtered.length})`)}\n${lines.join('\n')}`
}

/**
 * Format localStorage and sessionStorage entries.
 * @param local - localStorage snapshot
 * @param session - sessionStorage snapshot
 * @param typeFilter - Only show 'local' or 'session'
 * @param keyFilter - Only show specific key
 * @returns Formatted storage view
 */
export function formatStorage(
  local?: Record<string, string>,
  session?: Record<string, string>,
  typeFilter?: 'local' | 'session',
  keyFilter?: string
): string {
  const parts: string[] = []

  if (!typeFilter || typeFilter === 'local') {
    const entries = local ? Object.entries(local) : []
    const filtered = keyFilter ? entries.filter(([k]) => k === keyFilter) : entries
    parts.push(`${bold('localStorage')} ${dim(`(${filtered.length})`)}`)
    if (filtered.length === 0) parts.push(`  ${dim('(empty)')}`)
    else for (const [k, v] of filtered) {
      const val = v.length > 80 ? v.slice(0, 80) + '\u2026' : v
      parts.push(`  ${bold(k)} = ${val}`)
    }
  }

  if (!typeFilter || typeFilter === 'session') {
    const entries = session ? Object.entries(session) : []
    const filtered = keyFilter ? entries.filter(([k]) => k === keyFilter) : entries
    if (parts.length > 0) parts.push('')
    parts.push(`${bold('sessionStorage')} ${dim(`(${filtered.length})`)}`)
    if (filtered.length === 0) parts.push(`  ${dim('(empty)')}`)
    else for (const [k, v] of filtered) {
      const val = v.length > 80 ? v.slice(0, 80) + '\u2026' : v
      parts.push(`  ${bold(k)} = ${val}`)
    }
  }

  return parts.join('\n')
}

/**
 * Format service worker registrations.
 * @param workers - Service worker list from AppEntry
 * @returns Formatted worker list
 */
export function formatWorkers(workers?: ServiceWorkerInfo[]): string {
  if (!workers || workers.length === 0) return dim('No service workers registered.')
  const lines = workers.map(w => `  ${bold(w.state.padEnd(10))} ${w.scope}\n    ${dim(w.scriptURL)}`)
  return `${bold('Service Workers')} ${dim(`(${workers.length})`)}\n${lines.join('\n')}`
}

/**
 * Format cache storage names and counts.
 * @param caches - Cache info list from AppEntry
 * @returns Formatted cache list
 */
export function formatCache(caches?: CacheInfo[]): string {
  if (!caches || caches.length === 0) return dim('No cache storage entries.')
  const lines = caches.map(c => `  ${bold(c.name)} ${dim(`(${c.entryCount} entries)`)}`)
  return `${bold('Cache Storage')} ${dim(`(${caches.length})`)}\n${lines.join('\n')}`
}

/**
 * Format permission states.
 * @param permissions - Permission list from AppEntry
 * @returns Formatted permission table
 */
export function formatPermissions(permissions?: PermissionInfo[]): string {
  if (!permissions || permissions.length === 0) return dim('No permission data.')
  const lines = permissions.map(p => {
    const color = p.state === 'granted' ? green : p.state === 'denied' ? red : yellow
    return `  ${p.name.padEnd(20)} ${color(p.state)}`
  })
  return `${bold('Permissions')}\n${lines.join('\n')}`
}

/**
 * Format storage usage and quota.
 * @param estimate - Storage estimate from AppEntry
 * @returns Formatted quota display
 */
export function formatQuota(estimate?: { usage: number; quota: number }): string {
  if (!estimate) return dim('No storage quota data.')
  const pct = estimate.quota > 0 ? ((estimate.usage / estimate.quota) * 100).toFixed(1) : '0.0'
  return [
    `${bold('Storage Quota')}`,
    `  ${bold('Usage:')} ${formatBytes(estimate.usage)}`,
    `  ${bold('Quota:')} ${formatBytes(estimate.quota)}`,
    `  ${bold('Used:')}  ${pct}%`,
  ].join('\n')
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
