/**
 * Simple LRU Cache with TTL support
 *
 * Used for caching trace/span ID mappings to prevent duplicate API calls.
 */

interface CacheEntry<T> {
  value: T
  createdAt: number
}

export class LRUCache<T = string> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly maxSize: number
  private readonly ttl: number

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now()
    })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  get size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
  }
}
