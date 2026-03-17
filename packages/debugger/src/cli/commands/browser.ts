import { query } from '../../ipc/client.js'
import {
  formatEntries,
  formatJson,
  formatNetworkDetail,
  formatCookies,
  formatStorage,
  formatWorkers,
  formatCache,
  formatPermissions,
  formatQuota,
} from '../formatter.js'
import type { Flags } from '../index.js'
import type { QueryRequest } from '../../core/types.js'

/** Route a browser subcommand to the appropriate query + formatter. */
export async function browser(subcommand: string, flags: Flags) {
  switch (subcommand) {
    case 'console': return browserConsole(flags)
    case 'errors': return browserErrors(flags)
    case 'network': return browserNetwork(flags)
    case 'cookies': return browserApp('cookies', flags)
    case 'storage': return browserApp('storage', flags)
    case 'workers': return browserApp('workers', flags)
    case 'cache': return browserApp('cache', flags)
    case 'permissions': return browserApp('permissions', flags)
    case 'quota': return browserApp('quota', flags)
    default:
      console.error(`Unknown browser command: "${subcommand}". Run "dbg --help" for usage.`)
      process.exit(1)
  }
}

async function browserConsole(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'console',
    filters: {
      last: flags.last,
      level: flags.level,
      limit: flags.limit,
      id: flags.id,
      ids: flags.ids,
      source: 'browser',
    },
  }, { cwd: flags.cwd, port: flags.port, session: flags.session })

  if (!response.ok) { console.error(response.error); process.exit(1) }
  console.log(flags.json ? formatJson(response.data) : formatEntries(response.data))
}

async function browserErrors(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'errors',
    filters: {
      last: flags.last,
      limit: flags.limit,
      id: flags.id,
      ids: flags.ids,
      source: 'browser',
    },
  }, { cwd: flags.cwd, port: flags.port, session: flags.session })

  if (!response.ok) { console.error(response.error); process.exit(1) }
  console.log(flags.json ? formatJson(response.data) : formatEntries(response.data))
}

async function browserNetwork(flags: Flags) {
  const response = await query({
    id: crypto.randomUUID(),
    command: 'network',
    filters: {
      last: flags.last,
      status: flags.status,
      failed: flags.failed,
      limit: flags.limit,
      id: flags.id,
      ids: flags.ids,
    },
  }, { cwd: flags.cwd, port: flags.port, session: flags.session })

  if (!response.ok) { console.error(response.error); process.exit(1) }

  if (flags.json) {
    console.log(formatJson(response.data))
  } else if (flags.id || flags.ids) {
    for (const entry of response.data) {
      if (entry.type === 'network') {
        console.log(formatNetworkDetail(entry, flags.headers, flags.body))
      }
    }
    if (response.data.length === 0) {
      console.log('No entries found for the given ID(s).')
    }
  } else {
    console.log(formatEntries(response.data))
  }
}

async function browserApp(subcommand: string, flags: Flags) {
  const request: QueryRequest = {
    id: crypto.randomUUID(),
    command: 'app',
    filters: {
      limit: flags.limit,
      last: flags.last,
      subcommand,
      name: flags.name,
      key: flags.key,
      storageType: flags.storageType,
    },
  }

  const response = await query(request, { cwd: flags.cwd, port: flags.port, session: flags.session })
  if (!response.ok) { console.error(response.error); process.exit(1) }

  const appEntries = response.data.filter(e => e.type === 'app')
  const latest = appEntries[appEntries.length - 1]
  if (!latest || latest.type !== 'app') {
    if (flags.json) {
      console.log(formatJson(null))
    } else {
      console.log('No application data captured yet.')
    }
    return
  }

  if (flags.json) {
    let data: unknown
    switch (subcommand) {
      case 'cookies': {
        let cookies = latest.cookies || []
        if (flags.name) cookies = cookies.filter(c => c.name === flags.name)
        data = cookies
        break
      }
      case 'storage': {
        const result: Record<string, unknown> = {}
        if (!flags.storageType || flags.storageType === 'local') {
          let entries = Object.entries(latest.localStorage || {})
          if (flags.key) entries = entries.filter(([k]) => k === flags.key)
          result.localStorage = Object.fromEntries(entries)
        }
        if (!flags.storageType || flags.storageType === 'session') {
          let entries = Object.entries(latest.sessionStorage || {})
          if (flags.key) entries = entries.filter(([k]) => k === flags.key)
          result.sessionStorage = Object.fromEntries(entries)
        }
        data = result
        break
      }
      case 'workers': data = latest.serviceWorkers || []; break
      case 'cache': data = latest.cacheStorage || []; break
      case 'permissions': data = latest.permissions || []; break
      case 'quota': data = latest.storageEstimate || null; break
    }
    console.log(formatJson(data))
    return
  }

  switch (subcommand) {
    case 'cookies': console.log(formatCookies(latest.cookies, flags.name)); break
    case 'storage': console.log(formatStorage(latest.localStorage, latest.sessionStorage, flags.storageType, flags.key)); break
    case 'workers': console.log(formatWorkers(latest.serviceWorkers)); break
    case 'cache': console.log(formatCache(latest.cacheStorage)); break
    case 'permissions': console.log(formatPermissions(latest.permissions)); break
    case 'quota': console.log(formatQuota(latest.storageEstimate)); break
  }
}
