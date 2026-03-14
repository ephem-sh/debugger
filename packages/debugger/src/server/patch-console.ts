import type { LogStore } from '../core/log-store.js'
import type { LogLevel } from '../core/types.js'

function safeSerialize(value: unknown): unknown {
  const seen = new WeakSet()

  function walk(v: unknown): unknown {
    if (v === null || v === undefined) return v
    if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`
    if (typeof v === 'symbol') return v.toString()
    if (typeof v === 'bigint') return v.toString()
    if (v instanceof Error) {
      return { message: v.message, stack: v.stack, name: v.name }
    }
    if (typeof v !== 'object') return v

    if (seen.has(v as object)) return '[Circular]'
    seen.add(v as object)

    if (Array.isArray(v)) return v.map(walk)

    const result: Record<string, unknown> = {}
    for (const key of Object.keys(v as Record<string, unknown>)) {
      try {
        result[key] = walk((v as Record<string, unknown>)[key])
      } catch {
        result[key] = '[Unserializable]'
      }
    }
    return result
  }

  return walk(value)
}

const LEVELS: LogLevel[] = ['log', 'warn', 'error', 'debug', 'info']

/**
 * Monkey-patch `console.*` methods to capture server-side logs into the log store.
 *
 * Wraps all console levels (log, warn, error, debug, info). Each call is
 * safely serialized to handle circular references, functions, and symbols
 * before being stored. The original console methods are still invoked.
 *
 * @param logStore - Log store to push captured console entries into
 * @returns Restore function that reverts console to its original methods
 */
export function patchConsole(logStore: LogStore): () => void {
  const originals = new Map<LogLevel, (...args: unknown[]) => void>()

  for (const level of LEVELS) {
    const original = console[level].bind(console)
    originals.set(level, original)

    console[level] = (...args: unknown[]) => {
      logStore.push({
        type: 'console',
        level,
        args: args.map(safeSerialize),
        timestamp: Date.now(),
        source: 'server',
      })
      original(...args)
    }
  }

  return () => {
    for (const [level, original] of originals) {
      console[level] = original
    }
  }
}
