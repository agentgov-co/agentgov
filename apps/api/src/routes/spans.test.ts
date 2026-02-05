import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import { createHash, randomBytes } from 'crypto'
import { spanRoutes } from './spans.js'

// Mock WebSocket manager
vi.mock('../lib/websocket-manager.js', () => ({
  wsManager: {
    notifySpanCreated: vi.fn(),
    notifyBatchSpansCreated: vi.fn()
  }
}))

// Mock auth middleware so we can control session auth behavior
vi.mock('../middleware/auth.js', () => ({
  authenticateApiKey: async (request: FastifyRequest) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ag_')) {
      throw { statusCode: 401, message: 'Unauthorized' }
    }
    // Set request.project for API key auth
    ;(request as unknown as Record<string, unknown>).project = {
      id: 'proj_test123',
      name: 'Test Project',
    }
  },
  authenticateDual: async (request: FastifyRequest) => {
    const auth = request.headers.authorization
    if (auth?.startsWith('Bearer ag_')) {
      // API key path
      ;(request as unknown as Record<string, unknown>).project = {
        id: 'proj_test123',
        name: 'Test Project',
      }
    } else if (auth?.startsWith('Bearer session_org_')) {
      // Session auth with org only (no project)
      const orgId = auth.replace('Bearer session_org_', '')
      ;(request as unknown as Record<string, unknown>).organization = {
        id: orgId,
        name: 'Test Org',
        role: 'owner',
      }
      // No request.project — this is the org-level auth path
    } else if (auth?.startsWith('Bearer session_none_')) {
      // Session auth with no org and no project — should get 401
      // Don't set anything
    } else {
      throw { statusCode: 401, message: 'Unauthorized' }
    }
  },
  checkApiKeyRateLimit: async () => { /* noop */ },
}))

// Mock data stores
const mockSpans: Map<string, Record<string, unknown>> = new Map()
const mockTraces: Map<string, Record<string, unknown>> = new Map()

// Test API key
const TEST_API_KEY = 'ag_test123456789'
const TEST_API_KEY_HASH = createHash('sha256').update(TEST_API_KEY).digest('hex')
const TEST_PROJECT_ID = 'proj_test123'
const TEST_ORG_ID = 'org_test123'
const TEST_TRACE_ID = 'trace_test123'

// Initialize test trace
mockTraces.set(TEST_TRACE_ID, {
  id: TEST_TRACE_ID,
  projectId: TEST_PROJECT_ID,
  project: { organizationId: TEST_ORG_ID },
  name: 'Test Trace',
  status: 'RUNNING'
})

// Mock prisma module
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(({ where }) => {
        if (where.apiKeyHash === TEST_API_KEY_HASH) {
          return Promise.resolve({
            id: TEST_PROJECT_ID,
            name: 'Test Project',
            description: null,
            organizationId: null,
            apiKeyHash: TEST_API_KEY_HASH,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
        return Promise.resolve(null)
      })
    },
    apiKey: {
      findUnique: vi.fn(() => Promise.resolve(null)) // No new-style API keys in tests
    },
    trace: {
      findUnique: vi.fn(({ where }) => {
        const trace = mockTraces.get(where.id)
        return Promise.resolve(trace || null)
      }),
      findMany: vi.fn(({ where }) => {
        const ids = where.id?.in || []
        return Promise.resolve(
          ids.map((id: string) => mockTraces.get(id)).filter(Boolean)
        )
      }),
      update: vi.fn(({ where, data }) => {
        const trace = mockTraces.get(where.id)
        if (!trace) return Promise.reject(new Error('Not found'))
        const updated = { ...trace, ...data }
        mockTraces.set(where.id, updated)
        return Promise.resolve(updated)
      })
    },
    span: {
      findUnique: vi.fn(({ where, include }) => {
        const span = mockSpans.get(where.id)
        if (!span) return Promise.resolve(null)
        if (include?.trace || include?.children) {
          const trace = mockTraces.get(span.traceId as string)
          return Promise.resolve({
            ...span,
            trace: trace ? { projectId: trace.projectId, project: (trace as Record<string, unknown>).project } : undefined,
            children: []
          })
        }
        return Promise.resolve(span)
      }),
      create: vi.fn(({ data }) => {
        const span = {
          id: `span_${randomBytes(8).toString('hex')}`,
          ...data,
          status: 'RUNNING',
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
        mockSpans.set(span.id, span)
        return Promise.resolve(span)
      }),
      createMany: vi.fn(({ data }) => {
        const spans = Array.isArray(data) ? data : [data]
        for (const spanData of spans) {
          const span = {
            id: `span_${randomBytes(8).toString('hex')}`,
            ...spanData,
            status: 'RUNNING',
            startedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
          mockSpans.set(span.id, span)
        }
        return Promise.resolve({ count: spans.length })
      }),
      update: vi.fn(({ where, data }) => {
        const span = mockSpans.get(where.id)
        if (!span) return Promise.reject(new Error('Not found'))
        const updated = { ...span, ...data, updatedAt: new Date() }
        mockSpans.set(where.id, updated)
        return Promise.resolve(updated)
      }),
      aggregate: vi.fn(() => Promise.resolve({
        _sum: { cost: 0, promptTokens: 0, outputTokens: 0, duration: 0 }
      }))
    }
  }
}))

describe('Spans API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    await app.register(spanRoutes, { prefix: '/v1/spans' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockSpans.clear()
  })

  describe('POST /v1/spans', () => {
    it('should create a span with valid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans',
        headers: {
          authorization: `Bearer ${TEST_API_KEY}`
        },
        payload: {
          traceId: TEST_TRACE_ID,
          name: 'LLM Call',
          type: 'LLM_CALL',
          model: 'gpt-4o'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.id).toBeDefined()
      expect(body.name).toBe('LLM Call')
      expect(body.type).toBe('LLM_CALL')
      expect(body.status).toBe('RUNNING')
    })

    it('should reject without API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans',
        payload: {
          traceId: TEST_TRACE_ID,
          name: 'Test',
          type: 'CUSTOM'
        }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject invalid span type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          traceId: TEST_TRACE_ID,
          name: 'Test',
          type: 'INVALID_TYPE'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject non-existent trace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          traceId: 'nonexistent',
          name: 'Test',
          type: 'CUSTOM'
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /v1/spans/:id', () => {
    it('should get a span by ID', async () => {
      // Create a span first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/spans',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          traceId: TEST_TRACE_ID,
          name: 'Test Span',
          type: 'CUSTOM'
        }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'GET',
        url: `/v1/spans/${created.id}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.id).toBe(created.id)
    })

    it('should return 404 for non-existent span', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/spans/nonexistent',
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 when span belongs to different project (API key auth)', async () => {
      // Create a trace that belongs to a different project
      const otherTraceId = 'trace_other'
      mockTraces.set(otherTraceId, {
        id: otherTraceId,
        projectId: 'proj_other',
        project: { organizationId: 'org_other' },
        name: 'Other Trace',
        status: 'RUNNING'
      })

      // Manually add a span for the other trace
      const otherSpanId = 'span_other'
      mockSpans.set(otherSpanId, {
        id: otherSpanId,
        traceId: otherTraceId,
        name: 'Other Span',
        type: 'CUSTOM',
        status: 'RUNNING',
        startedAt: new Date(),
        createdAt: new Date()
      })

      const response = await app.inject({
        method: 'GET',
        url: `/v1/spans/${otherSpanId}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(403)
    })

    it('should allow org-level session auth when span belongs to org', async () => {
      // Create a span directly in mock store (already exists via trace)
      const spanId = 'span_org_test'
      mockSpans.set(spanId, {
        id: spanId,
        traceId: TEST_TRACE_ID,
        name: 'Org Auth Span',
        type: 'CUSTOM',
        status: 'RUNNING',
        startedAt: new Date(),
        createdAt: new Date()
      })

      // Use session auth with correct org ID (matches TEST_ORG_ID from trace)
      const response = await app.inject({
        method: 'GET',
        url: `/v1/spans/${spanId}`,
        headers: { authorization: `Bearer session_org_${TEST_ORG_ID}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.id).toBe(spanId)
    })

    it('should return 403 for org-level session auth when span belongs to different org', async () => {
      // Span's trace belongs to TEST_ORG_ID, but we auth with a different org
      const spanId = 'span_wrong_org'
      mockSpans.set(spanId, {
        id: spanId,
        traceId: TEST_TRACE_ID,
        name: 'Wrong Org Span',
        type: 'CUSTOM',
        status: 'RUNNING',
        startedAt: new Date(),
        createdAt: new Date()
      })

      const response = await app.inject({
        method: 'GET',
        url: `/v1/spans/${spanId}`,
        headers: { authorization: 'Bearer session_org_org_wrong' }
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 401 for session auth with no org and no project', async () => {
      const spanId = 'span_no_auth'
      mockSpans.set(spanId, {
        id: spanId,
        traceId: TEST_TRACE_ID,
        name: 'No Auth Span',
        type: 'CUSTOM',
        status: 'RUNNING',
        startedAt: new Date(),
        createdAt: new Date()
      })

      const response = await app.inject({
        method: 'GET',
        url: `/v1/spans/${spanId}`,
        headers: { authorization: 'Bearer session_none_test' }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /v1/spans/batch', () => {
    it('should create multiple spans in batch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans/batch',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          spans: [
            { traceId: TEST_TRACE_ID, name: 'Span 1', type: 'LLM_CALL' },
            { traceId: TEST_TRACE_ID, name: 'Span 2', type: 'TOOL_CALL' },
            { traceId: TEST_TRACE_ID, name: 'Span 3', type: 'AGENT_STEP' }
          ]
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.created).toBe(3)
      expect(body.total).toBe(3)
    })

    it('should reject batch with non-existent trace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans/batch',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          spans: [
            { traceId: 'nonexistent', name: 'Span 1', type: 'CUSTOM' }
          ]
        }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should reject batch with trace from different project', async () => {
      // Create a trace for a different project
      mockTraces.set('trace_other_project', {
        id: 'trace_other_project',
        projectId: 'proj_other',
        name: 'Other Trace',
        status: 'RUNNING'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans/batch',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          spans: [
            { traceId: 'trace_other_project', name: 'Span 1', type: 'CUSTOM' }
          ]
        }
      })

      expect(response.statusCode).toBe(403)
    })

    it('should reject empty batch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans/batch',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          spans: []
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject batch exceeding max size', async () => {
      const spans = Array.from({ length: 101 }, (_, i) => ({
        traceId: TEST_TRACE_ID,
        name: `Span ${i}`,
        type: 'CUSTOM'
      }))

      const response = await app.inject({
        method: 'POST',
        url: '/v1/spans/batch',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { spans }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('PATCH /v1/spans/:id', () => {
    it('should update span with metrics', async () => {
      // Create a span first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/spans',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          traceId: TEST_TRACE_ID,
          name: 'LLM Call',
          type: 'LLM_CALL'
        }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/spans/${created.id}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          status: 'COMPLETED',
          promptTokens: 100,
          outputTokens: 50,
          cost: 0.002
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('COMPLETED')
      expect(body.promptTokens).toBe(100)
      expect(body.outputTokens).toBe(50)
    })

    it('should update span with error', async () => {
      // Create a span first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/spans',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          traceId: TEST_TRACE_ID,
          name: 'Failed Span',
          type: 'LLM_CALL'
        }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/spans/${created.id}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          status: 'FAILED',
          error: 'API rate limit exceeded'
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('FAILED')
      expect(body.error).toBe('API rate limit exceeded')
    })
  })
})
