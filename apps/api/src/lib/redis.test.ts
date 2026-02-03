import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'

// ============================================
// Mock ioredis at the module level
// ============================================

const mockStore = new Map<string, string>()

function createMockScanStream(keys: string[]): EventEmitter {
  const emitter = new EventEmitter()
  setTimeout(() => {
    if (keys.length > 0) {
      emitter.emit('data', keys)
    }
    emitter.emit('end')
  }, 0)
  ;(emitter as unknown as Record<string, unknown>).pause = vi.fn()
  ;(emitter as unknown as Record<string, unknown>).resume = vi.fn()
  return emitter
}

const mockRedisInstance = {
  get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => {
    mockStore.set(key, value)
    return 'OK'
  }),
  del: vi.fn(async (...keys: string[]) => {
    let count = 0
    for (const k of keys) {
      if (mockStore.delete(k)) count++
    }
    return count
  }),
  unlink: vi.fn(async (...keys: string[]) => {
    let count = 0
    for (const k of keys) {
      if (mockStore.delete(k)) count++
    }
    return count
  }),
  scanStream: vi.fn(({ match }: { match: string }) => {
    const regex = new RegExp('^' + match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$')
    const matchingKeys = Array.from(mockStore.keys()).filter(k => regex.test(k))
    return createMockScanStream(matchingKeys)
  }),
  ping: vi.fn(async () => 'PONG'),
  on: vi.fn(),
  quit: vi.fn(async () => 'OK'),
}

vi.mock('ioredis', () => {
  // Must use a regular function (not arrow) so it works with `new`
  function MockRedis() {
    return mockRedisInstance
  }
  return { Redis: MockRedis }
})

vi.mock('./metrics.js', () => ({
  recordCacheOperation: vi.fn(),
}))

// ============================================
// Import the real module AFTER mocks are set up
// ============================================

// We need to reset the module state between tests because getRedisClient
// uses lazy initialization with a module-level `redis` variable.
// Setting REDIS_URL enables the Redis client path.
const originalEnv = process.env.REDIS_URL

describe('redis cache utilities', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockStore.clear()
    process.env.REDIS_URL = 'redis://localhost:6379'
    // Reset module to clear the lazy `redis` singleton
    vi.resetModules()
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = originalEnv
    }
  })

  // ============================================
  // queryHash — pure function, no Redis dependency
  // ============================================

  describe('queryHash', () => {
    it('should produce deterministic hashes', async () => {
      const { queryHash } = await import('./redis.js')
      const hash1 = queryHash({ a: 1, b: 'test' })
      const hash2 = queryHash({ a: 1, b: 'test' })
      expect(hash1).toBe(hash2)
    })

    it('should produce same hash regardless of key order', async () => {
      const { queryHash } = await import('./redis.js')
      const hash1 = queryHash({ a: 1, b: 2, c: 3 })
      const hash2 = queryHash({ c: 3, a: 1, b: 2 })
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', async () => {
      const { queryHash } = await import('./redis.js')
      const hash1 = queryHash({ status: 'RUNNING' })
      const hash2 = queryHash({ status: 'FAILED' })
      expect(hash1).not.toBe(hash2)
    })

    it('should filter out undefined and null values', async () => {
      const { queryHash } = await import('./redis.js')
      const hash1 = queryHash({ a: 1 })
      const hash2 = queryHash({ a: 1, b: undefined, c: null })
      expect(hash1).toBe(hash2)
    })

    it('should return a 12-character hex string', async () => {
      const { queryHash } = await import('./redis.js')
      const hash = queryHash({ key: 'value' })
      expect(hash).toMatch(/^[0-9a-f]{12}$/)
    })

    it('should handle empty params', async () => {
      const { queryHash } = await import('./redis.js')
      const hash = queryHash({})
      expect(hash).toMatch(/^[0-9a-f]{12}$/)
    })
  })

  // ============================================
  // cached — cache-aside helper
  // ============================================

  describe('cached', () => {
    it('should return cached value on hit', async () => {
      const { cached } = await import('./redis.js')
      mockStore.set('test:key', JSON.stringify({ data: 'cached' }))
      const fn = vi.fn().mockResolvedValue({ data: 'fresh' })

      const result = await cached('test:key', 60, fn)

      expect(result).toEqual({ data: 'cached' })
      expect(fn).not.toHaveBeenCalled()
    })

    it('should call fn and cache result on miss', async () => {
      const { cached } = await import('./redis.js')
      const fn = vi.fn().mockResolvedValue({ data: 'fresh' })

      const result = await cached('test:miss', 60, fn)

      expect(result).toEqual({ data: 'fresh' })
      expect(fn).toHaveBeenCalledOnce()
      // Verify the result was stored
      const stored = mockStore.get('test:miss')
      expect(stored).toBe(JSON.stringify({ data: 'fresh' }))
    })

    it('should fall back to fn when Redis is unavailable', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const { cached } = await import('./redis.js')

      const fn = vi.fn().mockResolvedValue({ data: 'fallback' })
      const result = await cached('test:key', 60, fn)

      expect(result).toEqual({ data: 'fallback' })
      expect(fn).toHaveBeenCalledOnce()
    })

    it('should propagate fn errors (not swallow them)', async () => {
      const { cached } = await import('./redis.js')
      const fn = vi.fn().mockRejectedValue(new Error('DB error'))

      await expect(cached('test:key', 60, fn)).rejects.toThrow('DB error')
    })
  })

  // ============================================
  // cacheGet / cacheSet / cacheDelete
  // ============================================

  describe('cacheGet', () => {
    it('should return parsed JSON on hit', async () => {
      const { cacheGet } = await import('./redis.js')
      mockStore.set('key', JSON.stringify({ value: 42 }))
      const result = await cacheGet<{ value: number }>('key')
      expect(result).toEqual({ value: 42 })
    })

    it('should return null on miss', async () => {
      const { cacheGet } = await import('./redis.js')
      const result = await cacheGet('nonexistent')
      expect(result).toBeNull()
    })

    it('should return null when Redis is unavailable', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const { cacheGet } = await import('./redis.js')
      const result = await cacheGet('key')
      expect(result).toBeNull()
    })
  })

  describe('cacheSet', () => {
    it('should store JSON value', async () => {
      const { cacheSet } = await import('./redis.js')
      await cacheSet('key', { data: 'test' }, 60)
      expect(mockStore.get('key')).toBe(JSON.stringify({ data: 'test' }))
    })

    it('should be a no-op when Redis is unavailable', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const { cacheSet } = await import('./redis.js')
      await cacheSet('key', 'value', 60)
      expect(mockStore.size).toBe(0)
    })
  })

  describe('cacheDelete', () => {
    it('should remove key from cache', async () => {
      const { cacheDelete } = await import('./redis.js')
      mockStore.set('key', 'value')
      await cacheDelete('key')
      expect(mockStore.has('key')).toBe(false)
    })

    it('should be a no-op when Redis is unavailable', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const { cacheDelete } = await import('./redis.js')
      await cacheDelete('key')
      // No error thrown
    })
  })

  // ============================================
  // cacheDeletePattern (scanStream + unlink)
  // ============================================

  describe('cacheDeletePattern', () => {
    it('should delete all keys matching pattern', async () => {
      const { cacheDeletePattern } = await import('./redis.js')
      mockStore.set('prefix:a', 'value1')
      mockStore.set('prefix:b', 'value2')
      mockStore.set('other:c', 'value3')

      await cacheDeletePattern('prefix:*')

      expect(mockStore.has('prefix:a')).toBe(false)
      expect(mockStore.has('prefix:b')).toBe(false)
      expect(mockStore.has('other:c')).toBe(true)
    })

    it('should be a no-op when no keys match', async () => {
      const { cacheDeletePattern } = await import('./redis.js')
      mockStore.set('other:key', 'value')
      await cacheDeletePattern('nonexistent:*')
      expect(mockStore.size).toBe(1)
    })

    it('should be a no-op when Redis is unavailable', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const { cacheDeletePattern } = await import('./redis.js')
      await cacheDeletePattern('prefix:*')
      // No error thrown
    })

    it('should use scanStream for non-blocking iteration', async () => {
      const { cacheDeletePattern } = await import('./redis.js')
      mockStore.set('prefix:a', 'value1')
      await cacheDeletePattern('prefix:*')
      expect(mockRedisInstance.scanStream).toHaveBeenCalledWith(
        expect.objectContaining({ match: 'prefix:*' })
      )
    })

    it('should use unlink instead of del for async deletion', async () => {
      const { cacheDeletePattern } = await import('./redis.js')
      mockStore.set('prefix:a', 'value1')
      await cacheDeletePattern('prefix:*')
      expect(mockRedisInstance.unlink).toHaveBeenCalled()
    })
  })
})
