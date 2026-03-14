/**
 * No-op register for Edge Runtime. Debugger only runs in Node.js.
 */
export async function register(): Promise<void> {}

/**
 * No-op DebuggerScript for Edge Runtime.
 */
export function DebuggerScript(): null {
  return null
}

/**
 * No-op onRequestError for Edge Runtime.
 */
export function onRequestError(): void {}
