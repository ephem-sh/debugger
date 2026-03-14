import { query } from '../client'
import { formatSession, formatJson } from '../formatter'
import type { Flags } from '../index'

export async function status(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'status',
  })

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
