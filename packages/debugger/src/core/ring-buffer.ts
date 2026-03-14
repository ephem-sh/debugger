/**
 * Fixed-capacity circular buffer that evicts oldest entries on overflow.
 *
 * @typeParam T - Type of items stored in the buffer
 *
 * @example
 * ```ts
 * const buf = new RingBuffer<string>(3)
 * buf.push('a')
 * buf.push('b')
 * buf.push('c')
 * buf.push('d') // evicts 'a'
 * buf.toArray()  // ['b', 'c', 'd']
 * ```
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0
  private size = 0
  private readonly capacity: number

  /**
   * Create a ring buffer with the given fixed capacity.
   *
   * @param capacity - Maximum number of items before eviction begins
   */
  constructor(capacity: number) {
    this.capacity = capacity
    this.buffer = new Array(capacity)
  }

  /**
   * Append an item, evicting the oldest entry if at capacity.
   *
   * @param item - Value to insert
   */
  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) this.size++
  }

  /**
   * Return all items in insertion order (oldest first).
   *
   * @returns Shallow copy of stored items
   */
  toArray(): T[] {
    if (this.size === 0) return []
    const start = this.size < this.capacity ? 0 : this.head
    const result: T[] = []
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(start + i) % this.capacity] as T)
    }
    return result
  }

  /**
   * Return items matching a predicate, in insertion order.
   *
   * @param fn - Predicate to test each item
   * @returns Items for which `fn` returned true
   */
  filter(fn: (item: T) => boolean): T[] {
    if (this.size === 0) return []
    const start = this.size < this.capacity ? 0 : this.head
    const result: T[] = []
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[(start + i) % this.capacity] as T
      if (fn(item)) result.push(item)
    }
    return result
  }

  /** Remove all items and reset internal state. */
  clear(): void {
    this.buffer = new Array(this.capacity)
    this.head = 0
    this.size = 0
  }

  /** Current number of items in the buffer. */
  get length(): number {
    return this.size
  }
}
