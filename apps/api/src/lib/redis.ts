import { createHash } from 'crypto'
import { Redis } from 'ioredis'
import { recordCacheOperation } from './metrics.js'

// Redis client - lazy initialization
let redis: Redis | null = null

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null
  }

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false, // fail-fast: commands error immediately when disconnected
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 30_000) // cap 30s to reduce log spam on prolonged outages
        return delay
      },
      lazyConnect: true,
    })

    let lastErrorLog = 0
    redis.on('error', (err: Error) => {
      const now = Date.now()
      if (now - lastErrorLog > 30_000) { // debounce: log at most once per 30s
        console.error('Redis connection error:', err.message)
        lastErrorLog = now
      }
    })

    redis.on('connect', () => {
      console.warn('Redis connected')
    })
  }

  return redis
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  API_KEY: 5 * 60, // 5 minutes
  PROJECT: 5 * 60, // 5 minutes
  SESSION: 60, // 1 minute
  COMPLIANCE_STATS: 60, // 1 minute — dashboard stats (5 parallel queries)
  COMPLIANCE_SYSTEMS: 60, // 1 minute — systems list
  COMPLIANCE_SYSTEM: 120, // 2 minutes — system detail (heavy includes)
  TRACES_LIST: 30, // 30 seconds — trace listings (change frequently)
} as const

// Cache key prefixes
export const CACHE_KEYS = {
  API_KEY: 'cache:apikey:',
  PROJECT: 'cache:project:',
  SESSION: 'cache:session:',
  COMPLIANCE_STATS: 'compliance:stats:',
  COMPLIANCE_SYSTEMS: 'compliance:systems:',
  COMPLIANCE_SYSTEM: 'compliance:system:',
  TRACES_LIST: 'traces:list:',
} as const

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient()
  if (!client) {
    return null
  }

  try {
    const value = await client.get(key)
    if (value) {
      recordCacheOperation('get', true)
      return JSON.parse(value) as T
    }
    recordCacheOperation('get', false)
    return null
  } catch (err) {
    console.error('Cache get error:', err)
    recordCacheOperation('get', false)
    return null
  }
}

/**
 * Set a value in cache with TTL
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = CACHE_TTL.API_KEY
): Promise<void> {
  const client = getRedisClient()
  if (!client) {
    return
  }

  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    recordCacheOperation('set', true)
  } catch (err) {
    console.error('Cache set error:', err)
  }
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient()
  if (!client) {
    return
  }

  try {
    await client.del(key)
    recordCacheOperation('delete', true)
  } catch (err) {
    console.error('Cache delete error:', err)
  }
}

/**
 * Delete all keys matching a pattern using SCAN (non-blocking) + UNLINK (async deletion).
 * Unlike KEYS which blocks Redis for the entire keyspace scan, scanStream iterates
 * in batches and UNLINK frees memory asynchronously in a background thread.
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getRedisClient()
  if (!client) {
    return
  }

  try {
    const stream = client.scanStream({ match: pattern, count: 100 })

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          stream.pause()
          client.unlink(...keys)
            .then(() => stream.resume())
            .catch((err) => {
              console.error('Cache unlink error:', err)
              stream.resume()
            })
        }
      })
      stream.on('end', resolve)
      stream.on('error', reject)
    })
  } catch (err) {
    console.error('Cache delete pattern error:', err)
  }
}

/**
 * Cache-aside helper: returns cached value if available, otherwise executes fn and caches result.
 * Falls back to fn() directly if Redis is unavailable.
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const existing = await cacheGet<T>(key)
  if (existing !== null) {
    return existing
  }

  const result = await fn()
  await cacheSet(key, result, ttlSeconds)
  return result
}

/**
 * Create a stable hash from query parameters for use in cache keys.
 * Uses SHA-256 truncated to 12 hex chars — collision-resistant and deterministic.
 */
export function queryHash(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .filter(k => params[k] !== undefined && params[k] !== null)
    .map(k => `${k}=${String(params[k])}`)
    .join('&')
  return createHash('sha256').update(sorted).digest('hex').slice(0, 12)
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
  status: 'ok' | 'error' | 'disabled'
  latencyMs: number
}> {
  const client = getRedisClient()

  if (!client) {
    return { status: 'disabled', latencyMs: 0 }
  }

  const start = Date.now()
  try {
    await client.ping()
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch {
    return { status: 'error', latencyMs: Date.now() - start }
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

// API Key caching helpers
export async function getCachedApiKey<T>(keyHash: string): Promise<T | null> {
  return cacheGet<T>(`${CACHE_KEYS.API_KEY}${keyHash}`)
}

export async function setCachedApiKey(keyHash: string, data: unknown): Promise<void> {
  await cacheSet(`${CACHE_KEYS.API_KEY}${keyHash}`, data, CACHE_TTL.API_KEY)
}

export async function invalidateApiKeyCache(keyHash: string): Promise<void> {
  await cacheDelete(`${CACHE_KEYS.API_KEY}${keyHash}`)
}

// Project caching helpers
export async function getCachedProject<T>(projectId: string): Promise<T | null> {
  return cacheGet<T>(`${CACHE_KEYS.PROJECT}${projectId}`)
}

export async function setCachedProject(projectId: string, data: unknown): Promise<void> {
  await cacheSet(`${CACHE_KEYS.PROJECT}${projectId}`, data, CACHE_TTL.PROJECT)
}

export async function invalidateProjectCache(projectId: string): Promise<void> {
  await cacheDelete(`${CACHE_KEYS.PROJECT}${projectId}`)
}
