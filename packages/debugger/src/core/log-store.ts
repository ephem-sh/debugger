import { RingBuffer } from './ring-buffer.js'
import { generateEntryId } from './id.js'
import type {
  LogEntry,
  ConsoleEntry,
  ErrorEntry,
  NetworkEntry,
  AppEntry,
  SessionInfo,
  QueryRequest,
} from './types.js'

/**
 * Categorized log storage backed by ring buffers.
 *
 * Maintains separate ring buffers for console (500), error (100),
 * network (300), and app (50) entries. Supports filtered queries across all buffers.
 */
export class LogStore {
  private console = new RingBuffer<ConsoleEntry>(500)
  private errors = new RingBuffer<ErrorEntry>(100)
  private network = new RingBuffer<NetworkEntry>(300)
  private app = new RingBuffer<AppEntry>(50)
  private session: SessionInfo

  /**
   * Create a log store bound to a session.
   * @param session - Session metadata attached to query responses
   */
  constructor(session: SessionInfo) {
    this.session = session
  }

  /**
   * Route a log entry to the appropriate ring buffer by type.
   * @param entry - Log entry to store
   */
  push(entry: LogEntry): void {
    if (!entry.id) {
      (entry as { id: string }).id = generateEntryId()
    }

    switch (entry.type) {
      case 'console':
        this.console.push(entry)
        break
      case 'error':
        this.errors.push(entry)
        break
      case 'network':
        this.network.push(entry)
        break
      case 'app':
        this.app.push(entry)
        break
    }
  }

  /**
   * Query log entries by command with optional filters.
   * @param command - Which buffer(s) to query
   * @param filters - Optional filters to narrow results
   * @returns Matching log entries sorted by timestamp
   */
  query(
    command: QueryRequest['command'],
    filters?: QueryRequest['filters']
  ): LogEntry[] {
    let entries: LogEntry[]

    switch (command) {
      case 'console':
        entries = this.applyConsoleFilters(this.console.toArray(), filters)
        break
      case 'errors':
        entries = this.errors.toArray()
        break
      case 'network':
        entries = this.applyNetworkFilters(this.network.toArray(), filters)
        break
      case 'app':
        entries = this.app.toArray()
        break
      case 'status':
        return []
      case 'all':
        entries = [
          ...this.console.toArray(),
          ...this.errors.toArray(),
          ...this.network.toArray(),
          ...this.app.toArray(),
        ].sort((a, b) => a.timestamp - b.timestamp)
        break
    }

    if (filters?.source) {
      entries = entries.filter(e => 'source' in e && e.source === filters.source)
    }

    if (filters?.id) {
      entries = entries.filter(e => e.id === filters.id)
    }
    if (filters?.ids) {
      const idSet = new Set(filters.ids)
      entries = entries.filter(e => e.id !== undefined && idSet.has(e.id))
    }

    if (filters?.last) {
      const cutoff = Date.now() - filters.last
      entries = entries.filter((e) => e.timestamp >= cutoff)
    }

    if (filters?.limit && entries.length > filters.limit) {
      entries = entries.slice(-filters.limit)
    }

    return entries
  }

  /**
   * Return the session metadata for this store.
   * @returns Session info passed at construction
   */
  getSession(): SessionInfo {
    return this.session
  }

  /**
   * Search all buffers for an entry with the given ID.
   * @param id - Entry ID to search for
   * @returns Matching entry or undefined
   */
  getById(id: string): LogEntry | undefined {
    const allEntries = [
      ...this.console.toArray(),
      ...this.errors.toArray(),
      ...this.network.toArray(),
      ...this.app.toArray(),
    ]
    return allEntries.find(e => e.id === id)
  }

  /** Clear all ring buffers. */
  clear(): void {
    this.console.clear()
    this.errors.clear()
    this.network.clear()
    this.app.clear()
  }

  private applyConsoleFilters(
    entries: ConsoleEntry[],
    filters?: QueryRequest['filters']
  ): ConsoleEntry[] {
    if (!filters?.level) return entries
    return entries.filter((e) => e.level === filters.level)
  }

  private applyNetworkFilters(
    entries: NetworkEntry[],
    filters?: QueryRequest['filters']
  ): NetworkEntry[] {
    let result = entries
    if (filters?.status !== undefined) {
      result = result.filter((e) => e.status === filters.status)
    }
    if (filters?.failed !== undefined) {
      result = result.filter((e) => e.failed === filters.failed)
    }
    return result
  }
}
