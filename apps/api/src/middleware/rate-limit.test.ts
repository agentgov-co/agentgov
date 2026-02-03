import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// Mock Redis pipeline results
let pipelineResults: [Error | null, unknown][] = []
let pipelineError = false
let redisAvailable = true

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(async () => {
    if (pipelineError) throw new Error('Redis connection error')
    return pipelineResults
  }),
}

const mockRedis = {
  pipeline: vi.fn(() => mockPipeline),
}

vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => (redisAvailable ? mockRedis : null),
}))

vi.mock('../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { checkApiKeyRateLimit } from './rate-limit.js'

describe('Rate Limit Middleware', () => {
  let app: FastifyInstance

  function setPipelineCount(count: number): void {
    pipelineResults = [
      [null, 0],         // zremrangebyscore
      [null, 1],         // zadd
      [null, count],     // zcard
      [null, 1],         // expire
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    redisAvailable = true
    pipelineError = false
    setPipelineCount(1)
  })

  describe('checkApiKeyRateLimit', () => {
    beforeEach(async () => {
      app = Fastify()

      app.post('/test', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          (request as unknown as Record<string, unknown>).apiKey = {
            keyPrefix: 'ag_live_abc',
            rateLimit: 1000,
          }
          await checkApiKeyRateLimit(request, reply)
        },
      }, async () => {
        return { ok: true }
      })

      app.post('/test-low-limit', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          (request as unknown as Record<string, unknown>).apiKey = {
            keyPrefix: 'ag_live_low',
            rateLimit: 5,
          }
          await checkApiKeyRateLimit(request, reply)
        },
      }, async () => {
        return { ok: true }
      })

      app.post('/test-no-key', {
        preHandler: checkApiKeyRateLimit,
      }, async () => {
        return { ok: true }
      })

      await app.ready()
    })

    afterEach(async () => {
      await app.close()
    })

    it('should allow request when under limit', async () => {
      setPipelineCount(50)

      const response = await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should set X-RateLimit headers', async () => {
      setPipelineCount(50)

      const response = await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(response.headers['x-ratelimit-limit']).toBe('1000')
      expect(response.headers['x-ratelimit-remaining']).toBe('950')
      expect(response.headers['x-ratelimit-reset']).toBeDefined()
    })

    it('should return 429 when limit exceeded', async () => {
      setPipelineCount(1001)

      const response = await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(response.statusCode).toBe(429)
      expect(response.headers['retry-after']).toBe('3600')
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Too Many Requests')
      expect(body.message).toContain('1000')
    })

    it('should respect per-key rate limit', async () => {
      setPipelineCount(6)

      const response = await app.inject({
        method: 'POST',
        url: '/test-low-limit',
      })

      expect(response.statusCode).toBe(429)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('5')
    })

    it('should skip when no apiKey present', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test-no-key',
      })

      expect(response.statusCode).toBe(200)
      expect(mockRedis.pipeline).not.toHaveBeenCalled()
    })

    it('should fail-open when Redis is unavailable', async () => {
      redisAvailable = false

      const response = await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should fail-open when Redis throws an error', async () => {
      pipelineError = true

      const response = await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should set remaining to 0 when at limit', async () => {
      setPipelineCount(1000)

      const response = await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['x-ratelimit-remaining']).toBe('0')
    })

    it('should call Redis pipeline with correct operations', async () => {
      setPipelineCount(1)

      await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(mockRedis.pipeline).toHaveBeenCalled()
      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        'ratelimit:ag_live_abc',
        0,
        expect.any(Number)
      )
      expect(mockPipeline.zadd).toHaveBeenCalled()
      expect(mockPipeline.zcard).toHaveBeenCalledWith('ratelimit:ag_live_abc')
      expect(mockPipeline.expire).toHaveBeenCalledWith('ratelimit:ag_live_abc', 3600)
    })
  })
})
