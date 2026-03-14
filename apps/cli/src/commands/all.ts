import { query } from '../client'
import { formatEntries, formatJson } from '../formatter'
import type { Flags } from '../index'

export async function all(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'all',
    filters: {
      last: flags.last,
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
