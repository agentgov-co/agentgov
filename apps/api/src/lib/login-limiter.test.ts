import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to create mock functions that can be referenced in vi.mock factories
const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
  ttl: vi.fn(),
}))

vi.mock('./redis.js', () => ({
  getRedisClient: () => mockRedis,
}))

vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { checkLoginAllowed, recordFailedAttempt, clearFailedAttempts } from './login-limiter.js'

describe('login-limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkLoginAllowed', () => {
    it('should allow login when no attempts recorded', async () => {
      mockRedis.get.mockResolvedValue(null)
      const result = await checkLoginAllowed('test@example.com')
      expect(result.allowed).toBe(true)
    })

    it('should allow login when attempts below threshold', async () => {
      mockRedis.get.mockResolvedValue('3')
      const result = await checkLoginAllowed('test@example.com')
      expect(result.allowed).toBe(true)
    })

    it('should allow login when attempts at threshold minus 1', async () => {
      mockRedis.get.mockResolvedValue('4')
      const result = await checkLoginAllowed('test@example.com')
      expect(result.allowed).toBe(true)
    })

    it('should block login when attempts reach threshold', async () => {
      mockRedis.get.mockResolvedValue('5')
      mockRedis.ttl.mockResolvedValue(600)
      const result = await checkLoginAllowed('test@example.com')
      expect(result.allowed).toBe(false)
      expect(result.retryAfterSeconds).toBe(600)
    })

    it('should block login when attempts exceed threshold', async () => {
      mockRedis.get.mockResolvedValue('10')
      mockRedis.ttl.mockResolvedValue(300)
      const result = await checkLoginAllowed('test@example.com')
      expect(result.allowed).toBe(false)
      expect(result.retryAfterSeconds).toBe(300)
    })

    it('should use default lockout when TTL is not positive', async () => {
      mockRedis.get.mockResolvedValue('5')
      mockRedis.ttl.mockResolvedValue(-1)
      const result = await checkLoginAllowed('test@example.com')
      expect(result.allowed).toBe(false)
      expect(result.retryAfterSeconds).toBe(900)
    })

    it('should hash email consistently (case insensitive)', async () => {
      mockRedis.get.mockResolvedValue(null)
      await checkLoginAllowed('Test@Example.com')
      const key1 = mockRedis.get.mock.calls[0][0] as string
      await checkLoginAllowed('test@example.com')
      const key2 = mockRedis.get.mock.calls[1][0] as string
      expect(key1).toBe(key2)
    })

    it('should fail open on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'))
      const result = await checkLoginAllowed('test@example.com')
      expect(result.allowed).toBe(true)
    })
  })

  describe('recordFailedAttempt', () => {
    it('should increment counter', async () => {
      mockRedis.incr.mockResolvedValue(1)
      const count = await recordFailedAttempt('test@example.com')
      expect(count).toBe(1)
      expect(mockRedis.incr).toHaveBeenCalledOnce()
    })

    it('should set TTL on first attempt', async () => {
      mockRedis.incr.mockResolvedValue(1)
      await recordFailedAttempt('test@example.com')
      expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 900)
    })

    it('should not set TTL on subsequent attempts', async () => {
      mockRedis.incr.mockResolvedValue(2)
      await recordFailedAttempt('test@example.com')
      expect(mockRedis.expire).not.toHaveBeenCalled()
    })

    it('should return 0 on Redis error', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis down'))
      const count = await recordFailedAttempt('test@example.com')
      expect(count).toBe(0)
    })
  })

  describe('clearFailedAttempts', () => {
    it('should delete the counter key', async () => {
      mockRedis.del.mockResolvedValue(1)
      await clearFailedAttempts('test@example.com')
      expect(mockRedis.del).toHaveBeenCalledOnce()
    })

    it('should not throw on Redis error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis down'))
      await expect(clearFailedAttempts('test@example.com')).resolves.not.toThrow()
    })
  })
})
