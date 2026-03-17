import { query } from '../../ipc/client.js'
import { formatEntries, formatJson } from '../formatter.js'
import type { Flags } from '../index.js'

/**
 * Query and display all log entries merged from every ring buffer.
 * @param flags - CLI flags controlling time window, limit, and output format
 */
export async function all(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'all',
    filters: {
      last: flags.last,
      limit: flags.limit,
    },
  }, { cwd: flags.cwd, port: flags.port, session: flags.session })

  if (!response.ok) {
    console.error(response.error)
    process.exit(1)
  }

  if (flags.json) {
    console.log(formatJson(response.data))
  } else {
    console.log(formatEntries(response.data))
  }
}
