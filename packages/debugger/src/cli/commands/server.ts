import { query } from '../../ipc/client.js'
import { formatEntries, formatJson } from '../formatter.js'
import type { Flags } from '../index.js'

/** Route a server subcommand to the appropriate query + formatter. */
export async function server(subcommand: string, flags: Flags) {
  switch (subcommand) {
    case 'console': return serverConsole(flags)
    case 'errors': return serverErrors(flags)
    default:
      console.error(`Unknown server command: "${subcommand}". Run "dbg --help" for usage.`)
      process.exit(1)
  }
}

async function serverConsole(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'console',
    filters: {
      last: flags.last,
      level: flags.level,
      limit: flags.limit,
      id: flags.id,
      ids: flags.ids,
      source: 'server',
    },
  }, { cwd: flags.cwd, port: flags.port, session: flags.session })

  if (!response.ok) { console.error(response.error); process.exit(1) }
  console.log(flags.json ? formatJson(response.data) : formatEntries(response.data))
}

async function serverErrors(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'errors',
    filters: {
      last: flags.last,
      limit: flags.limit,
      id: flags.id,
      ids: flags.ids,
      source: 'server',
    },
  }, { cwd: flags.cwd, port: flags.port, session: flags.session })

  if (!response.ok) { console.error(response.error); process.exit(1) }
  console.log(flags.json ? formatJson(response.data) : formatEntries(response.data))
}
