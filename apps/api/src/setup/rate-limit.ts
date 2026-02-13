import type { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { createHash } from 'crypto'
import { getRedisClient } from '../lib/redis.js'

export async function setupRateLimit(fastify: FastifyInstance): Promise<void> {
  const redis = getRedisClient()
  await fastify.register(rateLimit, {
    max: 100, // 100 requests per minute
    timeWindow: '1 minute',
    // Use Redis for distributed rate limiting if available
    redis: redis || undefined,
    // When Redis is down, allow requests through instead of crashing
    skipOnError: true,
    keyGenerator: (request) => {
      // Use hashed API key prefix if present, otherwise IP
      const authHeader = request.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        // Hash the API key to prevent timing attacks and log exposure
        const apiKey = authHeader.slice(7)
        const hash = createHash('sha256').update(apiKey).digest('hex')
        return hash.slice(0, 16) // Use first 16 chars of hash as rate limit key
      }
      const xApiKey = request.headers['x-api-key']
      if (typeof xApiKey === 'string') {
        const hash = createHash('sha256').update(xApiKey).digest('hex')
        return hash.slice(0, 16)
      }
      return request.ip
    },
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please retry after some time.'
    })
  })
}
