import { RingBuffer } from './ring-buffer.js'
import type {
  LogEntry,
  ConsoleEntry,
  ErrorEntry,
  NetworkEntry,
  SessionInfo,
  QueryRequest,
} from './types.js'

export class LogStore {
  private console = new RingBuffer<ConsoleEntry>(500)
  private errors = new RingBuffer<ErrorEntry>(100)
  private network = new RingBuffer<NetworkEntry>(300)
  private session: SessionInfo

  constructor(session: SessionInfo) {
    this.session = session
  }

  push(entry: LogEntry): void {
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
    }
  }

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
      case 'status':
        return []
      case 'all':
        entries = [
          ...this.console.toArray(),
          ...this.errors.toArray(),
          ...this.network.toArray(),
        ].sort((a, b) => a.timestamp - b.timestamp)
        break
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

  getSession(): SessionInfo {
    return this.session
  }

  clear(): void {
    this.console.clear()
    this.errors.clear()
    this.network.clear()
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
