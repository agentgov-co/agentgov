import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted — cannot reference variables declared in test scope
// Use vi.hoisted to create the mock function before hoisting
const mockDeleteMany = vi.hoisted(() => vi.fn())

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    session: {
      deleteMany: mockDeleteMany,
    },
  },
}))

vi.mock('../lib/redis.js', () => ({
  cacheDeletePattern: vi.fn(),
  CACHE_KEYS: { SESSION: 'cache:session:' },
}))

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { invalidateOtherSessions } from './session.service.js'

describe('session.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('invalidateOtherSessions', () => {
    it('should delete all sessions for user when no current token', async () => {
      mockDeleteMany.mockResolvedValue({ count: 3 })

      const count = await invalidateOtherSessions('user-123')

      expect(count).toBe(3)
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })
    })

    it('should exclude current session token from deletion', async () => {
      mockDeleteMany.mockResolvedValue({ count: 2 })

      const count = await invalidateOtherSessions('user-123', 'current-token')

      expect(count).toBe(2)
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          token: { not: 'current-token' },
        },
      })
    })

    it('should return 0 when no sessions to delete', async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 })

      const count = await invalidateOtherSessions('user-123', 'only-session')

      expect(count).toBe(0)
    })

    it('should return 0 on database error', async () => {
      mockDeleteMany.mockRejectedValue(new Error('DB connection failed'))

      const count = await invalidateOtherSessions('user-123')

      expect(count).toBe(0)
    })
  })
})
