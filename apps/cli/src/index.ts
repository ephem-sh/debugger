#!/usr/bin/env bun

import { errors } from './commands/errors'
import { console_ } from './commands/console'
import { network } from './commands/network'
import { status } from './commands/status'
import { all } from './commands/all'

export interface Flags {
  last?: number
  level?: string
  status?: number
  failed?: boolean
  limit: number
  json: boolean
}

const HELP = `
debuger — query dev session logs

Usage:
  debuger <command> [flags]

Commands:
  errors     Show runtime errors
  console    Show console logs
  network    Show network requests
  status     Show session info
  all        Show all logs (default)

Flags:
  --last <duration>   Filter by time (e.g., 30s, 5m, 1h)
  --level <level>     Filter console by level (log, warn, error, debug, info)
  --status <code>     Filter network by status code
  --failed            Show only failed network requests
  --limit <n>         Limit number of results (default: 50)
  --json              Output as JSON (for agent consumption)
  --help              Show this help message
`.trim()

const COMMANDS = ['errors', 'console', 'network', 'status', 'all'] as const
type Command = (typeof COMMANDS)[number]

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

function parseArgs(argv: string[]): { command: Command; flags: Flags } {
  const flags: Flags = { limit: 50, json: false }
  let command: Command = 'all'
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]

    if (arg === '--help' || arg === '-h') {
      console.log(HELP)
      process.exit(0)
    }

    if (arg === '--json') {
      flags.json = true
      i++
      continue
    }

    if (arg === '--failed') {
      flags.failed = true
      i++
      continue
    }

    if (arg === '--last') {
      const val = argv[++i]
      if (!val) { console.error('--last requires a duration value.'); process.exit(1) }
      flags.last = parseDuration(val)
      i++
      continue
    }

    if (arg === '--level') {
      const val = argv[++i]
      if (!val) { console.error('--level requires a value (log, warn, error, debug, info).'); process.exit(1) }
      flags.level = val
      i++
      continue
    }

    if (arg === '--status') {
      const val = argv[++i]
      if (!val) { console.error('--status requires a status code.'); process.exit(1) }
      flags.status = parseInt(val, 10)
      if (isNaN(flags.status)) { console.error(`Invalid status code: "${val}".`); process.exit(1) }
      i++
      continue
    }

    if (arg === '--limit') {
      const val = argv[++i]
      if (!val) { console.error('--limit requires a number.'); process.exit(1) }
      flags.limit = parseInt(val, 10)
      if (isNaN(flags.limit) || flags.limit <= 0) { console.error(`Invalid limit: "${val}".`); process.exit(1) }
      i++
      continue
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown flag: ${arg}. Run "debuger --help" for usage.`)
      process.exit(1)
    }

    // Positional: command
    if (COMMANDS.includes(arg as Command)) {
      command = arg as Command
    } else {
      console.error(`Unknown command: "${arg}". Run "debuger --help" for usage.`)
      process.exit(1)
    }

    i++
  }

  return { command, flags }
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2))

  switch (command) {
    case 'errors':  return errors(flags)
    case 'console': return console_(flags)
    case 'network': return network(flags)
    case 'status':  return status(flags)
    case 'all':     return all(flags)
  }
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
