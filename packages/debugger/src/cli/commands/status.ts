import { query } from '../../ipc/client.js'
import { formatSession, formatJson } from '../formatter.js'
import type { Flags } from '../index.js'

/**
 * Query and display session metadata from the active debugger session.
 * @param flags - CLI flags controlling output format
 */
export async function status(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'status',
  }, { cwd: flags.cwd, port: flags.port, session: flags.session })

  if (!response.ok) {
    console.error(response.error)
    process.exit(1)
  }

  if (flags.json) {
    console.log(formatJson(response.session))
  } else if (response.session) {
    console.log(formatSession(response.session))
  } else {
    console.error('No session info available.')
    process.exit(1)
  }
}
