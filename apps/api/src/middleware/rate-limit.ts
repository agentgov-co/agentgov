import { FastifyRequest, FastifyReply } from 'fastify'
import { getRedisClient } from '../lib/redis.js'
import { logger } from '../lib/logger.js'

const WINDOW_SIZE_MS = 60 * 60 * 1000 // 1 hour sliding window

/**
 * Per-API-key rate limiting using Redis ZSET sliding window.
 * Uses the `rateLimit` field from the API key (default 1000 req/hour).
 *
 * On error: Allows request (fail-open) and logs the error.
 */
export async function checkApiKeyRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.apiKey) {
    return
  }

  const redis = getRedisClient()
  if (!redis) {
    // No Redis available — fail-open
    return
  }

  const limit = request.apiKey.rateLimit
  const key = `ratelimit:${request.apiKey.keyPrefix}`
  const now = Date.now()
  const windowStart = now - WINDOW_SIZE_MS

  try {
    // Atomic pipeline: prune old entries, add current, count
    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(key, 0, windowStart)
    pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`)
    pipeline.zcard(key)
    pipeline.expire(key, Math.ceil(WINDOW_SIZE_MS / 1000))

    const results = await pipeline.exec()

    // results[2] is the ZCARD result: [error, count]
    const countResult = results?.[2]
    if (!countResult || countResult[0]) {
      // Error in pipeline — fail-open
      logger.error(
        { err: countResult?.[0], keyPrefix: request.apiKey.keyPrefix },
        '[RateLimit] Redis pipeline error, allowing request'
      )
      return
    }

    const count = countResult[1] as number

    // Set rate limit headers on every response
    const remaining = Math.max(0, limit - count)
    const resetAt = Math.ceil((now + WINDOW_SIZE_MS) / 1000)

    reply.header('X-RateLimit-Limit', limit)
    reply.header('X-RateLimit-Remaining', remaining)
    reply.header('X-RateLimit-Reset', resetAt)

    if (count > limit) {
      const retryAfter = Math.ceil(WINDOW_SIZE_MS / 1000)
      reply.header('Retry-After', retryAfter)
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `API key rate limit exceeded. Limit: ${limit} requests per hour.`,
        retryAfter,
      })
    }
  } catch (error) {
    // Fail-open: don't block user requests if rate limit check fails
    logger.error(
      { err: error, keyPrefix: request.apiKey.keyPrefix },
      '[RateLimit] Failed to check rate limit, allowing request'
    )
  }
}
