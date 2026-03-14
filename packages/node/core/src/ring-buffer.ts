export class RingBuffer<T> {
  private buffer: (T | undefined)[]
  private head = 0
  private size = 0
  private readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.buffer = new Array(capacity)
  }

  push(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) this.size++
  }

  toArray(): T[] {
    if (this.size === 0) return []
    const start = this.size < this.capacity ? 0 : this.head
    const result: T[] = []
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(start + i) % this.capacity] as T)
    }
    return result
  }

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

  clear(): void {
    this.buffer = new Array(this.capacity)
    this.head = 0
    this.size = 0
  }

  get length(): number {
    return this.size
  }
}
