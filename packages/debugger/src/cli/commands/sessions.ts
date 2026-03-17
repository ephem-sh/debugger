import { discoverSessions } from '../../ipc/client.js'
import { formatJson } from '../formatter.js'
import type { Flags } from '../index.js'

/**
 * List all active debugger sessions discovered by scanning for session.json files.
 * @param flags - CLI flags controlling output format
 */
export async function sessions(flags: Flags) {
  const found = await discoverSessions(flags.cwd)

  if (found.length === 0) {
    console.log('No active sessions found.')
    return
  }

  if (flags.json) {
    console.log(formatJson(found))
    return
  }

  console.log(`  ${'ID'.padEnd(14)} ${'Framework'.padEnd(12)} ${'Port'.padEnd(7)} ${'PID'.padEnd(8)} Dir`)
  console.log(`  ${'─'.repeat(14)} ${'─'.repeat(12)} ${'─'.repeat(7)} ${'─'.repeat(8)} ${'─'.repeat(20)}`)

  for (const s of found) {
    console.log(`  ${s.sessionId.padEnd(14)} ${s.framework.padEnd(12)} ${String(s.port).padEnd(7)} ${String(s.pid).padEnd(8)} ${s.dir}`)
  }
}
