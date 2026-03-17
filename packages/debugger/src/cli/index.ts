#!/usr/bin/env node

import { browser } from './commands/browser.js'
import { server } from './commands/server.js'
import { status } from './commands/status.js'
import { all } from './commands/all.js'
import { sessions } from './commands/sessions.js'

/** Parsed CLI flags controlling query filters and output format. */
export interface Flags {
  /** Time window in milliseconds to filter entries by */
  last?: number
  /** Console log level to filter by (log, warn, error, dbg, info) */
  level?: string
  /** HTTP status code to filter network entries by */
  status?: number
  /** When true, show only failed network requests */
  failed?: boolean
  /** Maximum number of entries to return */
  limit: number
  /** When true, output raw JSON instead of formatted text */
  json: boolean
  /** Override working directory for socket discovery */
  cwd?: string
  /** Target session by port */
  port?: number
  /** Target session by session ID */
  session?: string
  /** Single entry ID for detail view */
  id?: string
  /** Multiple entry IDs for detail view */
  ids?: string[]
  /** Show headers in detail view */
  headers: boolean
  /** Show response body in detail view */
  body: boolean
  /** Cookie name filter */
  name?: string
  /** Storage key filter */
  key?: string
  /** Storage type filter (local or session) */
  storageType?: 'local' | 'session'
}

const HELP = `
dbg — query dev session logs

Usage:
  dbg <scope> <command> [flags]
  dbg <command> [flags]

Scopes:
  browser    Browser-side data (console, network, errors, cookies, storage, etc.)
  server     Server-side data (console, errors)

Commands:
  status     Show session info
  all        Show all logs (default)
  sessions   List active debugger sessions

Browser Commands:
  dbg browser console       Console logs
  dbg browser errors        Runtime errors
  dbg browser network       Network requests (fetch, xhr, ws)
  dbg browser cookies       Cookies
  dbg browser storage       localStorage + sessionStorage
  dbg browser workers       Service workers
  dbg browser cache         Cache storage
  dbg browser permissions   Permission states
  dbg browser quota         Storage usage/quota

Server Commands:
  dbg server console        Console logs
  dbg server errors         Runtime errors (SSR, unhandled)

Flags:
  --json              Output as JSON
  --last <duration>   Filter by time (30s, 5m, 1h)
  --limit <n>         Max results (default 50)
  --level <level>     Filter by log level
  --status <code>     Filter by HTTP status
  --failed            Show only failed requests
  --id <id>           Detail view for entry
  --ids <id1> <id2>   Detail view for multiple entries
  --headers           Include headers in detail view
  --body              Include response body in detail view
  --name <name>       Filter cookies by name
  --key <key>         Filter storage by key
  --type <type>       Filter storage by type (local, session)
  --cwd <path>        Override working directory
  --port <port>       Target session by port
  --session <id>      Target session by ID
  --help              Show help
`.trim()

const SCOPES = ['browser', 'server'] as const
const TOP_COMMANDS = ['status', 'all', 'sessions'] as const
type Scope = (typeof SCOPES)[number]
type TopCommand = (typeof TOP_COMMANDS)[number]

/**
 * Parse a human-readable duration string into milliseconds.
 * @param raw - Duration string like "30s", "5m", "1h", or "500ms"
 * @returns Duration in milliseconds
 */
function parseDuration(raw: string): number {
  const match = raw.match(/^(\d+)(ms|s|m|h)$/)
  if (!match) {
    console.error(`Invalid duration: "${raw}". Use format like 30s, 5m, or 1h.`)
    process.exit(1)
  }
  const value = parseInt(match[1], 10)
  switch (match[2]) {
    case 'ms': return value
    case 's': return value * 1000
    case 'm': return value * 60_000
    case 'h': return value * 3_600_000
    default: return value * 1000
  }
}

interface ParseResult {
  scope?: Scope
  subcommand?: string
  topCommand?: TopCommand
  flags: Flags
}

/**
 * Parse CLI arguments into scope/subcommand or top-level command and flags.
 * @param argv - Raw argument array (without node/bun and script path)
 * @returns Parsed command routing and flags
 */
function parseArgs(argv: string[]): ParseResult {
  const flags: Flags = { limit: 50, json: false, headers: false, body: false }
  const result: ParseResult = { flags }
  let i = 0
  const positionals: string[] = []

  while (i < argv.length) {
    const arg = argv[i]

    if (arg === '--help' || arg === '-h') {
      console.log(HELP)
      process.exit(0)
    }

    if (arg === '--json') { flags.json = true; i++; continue }
    if (arg === '--failed') { flags.failed = true; i++; continue }
    if (arg === '--headers') { flags.headers = true; i++; continue }
    if (arg === '--body') { flags.body = true; i++; continue }

    if (arg === '--last') {
      const val = argv[++i]
      if (!val) { console.error('--last requires a duration value.'); process.exit(1) }
      flags.last = parseDuration(val)
      i++; continue
    }

    if (arg === '--level') {
      const val = argv[++i]
      if (!val) { console.error('--level requires a value (log, warn, error, dbg, info).'); process.exit(1) }
      flags.level = val
      i++; continue
    }

    if (arg === '--status') {
      const val = argv[++i]
      if (!val) { console.error('--status requires a status code.'); process.exit(1) }
      flags.status = parseInt(val, 10)
      if (isNaN(flags.status)) { console.error(`Invalid status code: "${val}".`); process.exit(1) }
      i++; continue
    }

    if (arg === '--cwd') {
      const val = argv[++i]
      if (!val) { console.error('--cwd requires a path.'); process.exit(1) }
      flags.cwd = val
      i++; continue
    }

    if (arg === '--port') {
      const val = argv[++i]
      if (!val) { console.error('--port requires a port number.'); process.exit(1) }
      flags.port = parseInt(val, 10)
      if (isNaN(flags.port)) { console.error(`Invalid port: "${val}".`); process.exit(1) }
      i++; continue
    }

    if (arg === '--session') {
      const val = argv[++i]
      if (!val) { console.error('--session requires a session ID.'); process.exit(1) }
      flags.session = val
      i++; continue
    }

    if (arg === '--limit') {
      const val = argv[++i]
      if (!val) { console.error('--limit requires a number.'); process.exit(1) }
      flags.limit = parseInt(val, 10)
      if (isNaN(flags.limit) || flags.limit <= 0) { console.error(`Invalid limit: "${val}".`); process.exit(1) }
      i++; continue
    }

    if (arg === '--id') {
      const val = argv[++i]
      if (!val) { console.error('--id requires an entry ID.'); process.exit(1) }
      flags.id = val
      i++; continue
    }

    if (arg === '--ids') {
      flags.ids = []
      i++
      while (i < argv.length && !argv[i].startsWith('-')) {
        flags.ids.push(argv[i])
        i++
      }
      if (flags.ids.length === 0) { console.error('--ids requires at least one ID.'); process.exit(1) }
      continue
    }

    if (arg === '--name') {
      const val = argv[++i]
      if (!val) { console.error('--name requires a cookie name.'); process.exit(1) }
      flags.name = val
      i++; continue
    }

    if (arg === '--key') {
      const val = argv[++i]
      if (!val) { console.error('--key requires a storage key.'); process.exit(1) }
      flags.key = val
      i++; continue
    }

    if (arg === '--type') {
      const val = argv[++i]
      if (!val || (val !== 'local' && val !== 'session')) {
        console.error('--type requires "local" or "session".')
        process.exit(1)
      }
      flags.storageType = val as 'local' | 'session'
      i++; continue
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown flag: ${arg}. Run "dbg --help" for usage.`)
      process.exit(1)
    }

    positionals.push(arg)
    i++
  }

  if (positionals.length === 0) {
    result.topCommand = 'all'
  } else if ((SCOPES as readonly string[]).includes(positionals[0])) {
    result.scope = positionals[0] as Scope
    result.subcommand = positionals[1]
    if (!result.subcommand) {
      console.error(`"dbg ${result.scope}" requires a subcommand. Run "dbg --help" for usage.`)
      process.exit(1)
    }
  } else if ((TOP_COMMANDS as readonly string[]).includes(positionals[0])) {
    result.topCommand = positionals[0] as TopCommand
  } else {
    console.error(`Unknown command: "${positionals[0]}". Run "dbg --help" for usage.`)
    process.exit(1)
  }

  return result
}

/** Run the CLI by parsing arguments and dispatching to the matched command handler. */
async function main() {
  const { scope, subcommand, topCommand, flags } = parseArgs(process.argv.slice(2))

  if (scope === 'browser' && subcommand) {
    return browser(subcommand, flags)
  }

  if (scope === 'server' && subcommand) {
    return server(subcommand, flags)
  }

  switch (topCommand) {
    case 'status': return status(flags)
    case 'all': return all(flags)
    case 'sessions': return sessions(flags)
  }
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
