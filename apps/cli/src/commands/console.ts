import { query } from '../client'
import { formatEntries, formatJson } from '../formatter'
import type { Flags } from '../index'

export async function console_(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'console',
    filters: {
      last: flags.last,
      level: flags.level,
      limit: flags.limit,
    },
  })

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
