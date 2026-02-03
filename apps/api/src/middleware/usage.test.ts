import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// Track state
let canCreateTrace = true
let canCreateProject = true
let canAddMember = true
let limitReason = 'Limit reached'

// Mock usage service
vi.mock('../services/usage.service.js', () => ({
  usageService: {
    canPerformAction: vi.fn(async (_orgId: string, action: string) => {
      switch (action) {
        case 'create_trace':
          return canCreateTrace
            ? { allowed: true }
            : { allowed: false, reason: limitReason }
        case 'create_project':
          return canCreateProject
            ? { allowed: true }
            : { allowed: false, reason: limitReason }
        case 'add_member':
          return canAddMember
            ? { allowed: true }
            : { allowed: false, reason: limitReason }
        default:
          return { allowed: true }
      }
    }),
  },
}))

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Import after mocks
import { checkTraceLimit, checkProjectLimit, checkMemberLimit } from './usage.js'

describe('Usage Middleware', () => {
  let app: FastifyInstance

  beforeEach(() => {
    vi.clearAllMocks()
    canCreateTrace = true
    canCreateProject = true
    canAddMember = true
    limitReason = 'Limit reached'
  })

  describe('checkTraceLimit', () => {
    beforeEach(async () => {
      app = Fastify()

      // Test route with trace limit check
      app.post('/traces', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          // Set organization context
          (request as unknown as Record<string, unknown>).organization = { id: 'org_123' }
          await checkTraceLimit(request, reply)
        },
      }, async () => {
        return { created: true }
      })

      // Route without org context
      app.post('/traces-no-org', {
        preHandler: checkTraceLimit,
      }, async () => {
        return { created: true }
      })

      await app.ready()
    })

    afterEach(async () => {
      await app.close()
    })

    it('should allow request when under limit', async () => {
      canCreateTrace = true

      const response = await app.inject({
        method: 'POST',
        url: '/traces',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return 402 when at limit', async () => {
      canCreateTrace = false
      limitReason = 'Monthly trace limit reached (20,000 traces)'

      const response = await app.inject({
        method: 'POST',
        url: '/traces',
      })

      expect(response.statusCode).toBe(402)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Payment Required')
      expect(body.code).toBe('TRACE_LIMIT_EXCEEDED')
      expect(body.message).toContain('trace limit')
    })

    it('should skip check when no org context', async () => {
      canCreateTrace = false

      const response = await app.inject({
        method: 'POST',
        url: '/traces-no-org',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should fail-open on service error', async () => {
      const { usageService } = await import('../services/usage.service.js')
      vi.mocked(usageService.canPerformAction).mockRejectedValueOnce(new Error('DB error'))

      const response = await app.inject({
        method: 'POST',
        url: '/traces',
      })

      expect(response.statusCode).toBe(200) // Should allow request
    })
  })

  describe('checkProjectLimit', () => {
    beforeEach(async () => {
      app = Fastify()

      app.post('/projects', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          (request as unknown as Record<string, unknown>).organization = { id: 'org_123' }
          await checkProjectLimit(request, reply)
        },
      }, async () => {
        return { created: true }
      })

      await app.ready()
    })

    afterEach(async () => {
      await app.close()
    })

    it('should allow request when under limit', async () => {
      canCreateProject = true

      const response = await app.inject({
        method: 'POST',
        url: '/projects',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return 402 when at limit', async () => {
      canCreateProject = false
      limitReason = 'Project limit reached (3 projects)'

      const response = await app.inject({
        method: 'POST',
        url: '/projects',
      })

      expect(response.statusCode).toBe(402)
      const body = JSON.parse(response.body)
      expect(body.code).toBe('PROJECT_LIMIT_EXCEEDED')
    })

    it('should fail-open on service error', async () => {
      const { usageService } = await import('../services/usage.service.js')
      vi.mocked(usageService.canPerformAction).mockRejectedValueOnce(new Error('DB error'))

      const response = await app.inject({
        method: 'POST',
        url: '/projects',
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('checkMemberLimit', () => {
    beforeEach(async () => {
      app = Fastify()

      app.post('/members', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          (request as unknown as Record<string, unknown>).organization = { id: 'org_123' }
          await checkMemberLimit(request, reply)
        },
      }, async () => {
        return { created: true }
      })

      await app.ready()
    })

    afterEach(async () => {
      await app.close()
    })

    it('should allow request when under limit', async () => {
      canAddMember = true

      const response = await app.inject({
        method: 'POST',
        url: '/members',
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return 402 when at limit', async () => {
      canAddMember = false
      limitReason = 'Team member limit reached (5 members)'

      const response = await app.inject({
        method: 'POST',
        url: '/members',
      })

      expect(response.statusCode).toBe(402)
      const body = JSON.parse(response.body)
      expect(body.code).toBe('MEMBER_LIMIT_EXCEEDED')
    })

    it('should fail-open on service error', async () => {
      const { usageService } = await import('../services/usage.service.js')
      vi.mocked(usageService.canPerformAction).mockRejectedValueOnce(new Error('DB error'))

      const response = await app.inject({
        method: 'POST',
        url: '/members',
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('getOrgId helper', () => {
    beforeEach(async () => {
      app = Fastify()

      // Test various auth contexts
      app.post('/api-key-org', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          (request as unknown as Record<string, unknown>).apiKey = { organizationId: 'org_from_apikey' }
          await checkTraceLimit(request, reply)
        },
      }, async () => ({ created: true }))

      app.post('/project-org', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          (request as unknown as Record<string, unknown>).project = { organizationId: 'org_from_project' }
          await checkTraceLimit(request, reply)
        },
      }, async () => ({ created: true }))

      await app.ready()
    })

    afterEach(async () => {
      await app.close()
    })

    it('should get orgId from apiKey', async () => {
      canCreateTrace = false

      const response = await app.inject({
        method: 'POST',
        url: '/api-key-org',
      })

      expect(response.statusCode).toBe(402)
    })

    it('should get orgId from project', async () => {
      canCreateTrace = false

      const response = await app.inject({
        method: 'POST',
        url: '/project-org',
      })

      expect(response.statusCode).toBe(402)
    })
  })
})
