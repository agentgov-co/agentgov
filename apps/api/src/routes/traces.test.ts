import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { createHash, randomBytes } from 'crypto'
import { traceRoutes } from './traces.js'

// Mock Prisma
const mockTraces: Map<string, Record<string, unknown>> = new Map()

// Test API key
const TEST_API_KEY = 'ag_test123456789'
const TEST_API_KEY_HASH = createHash('sha256').update(TEST_API_KEY).digest('hex')
const TEST_PROJECT_ID = 'proj_test123'

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
      findMany: vi.fn(() => Promise.resolve(Array.from(mockTraces.values()))),
      findUnique: vi.fn(({ where }) => Promise.resolve(mockTraces.get(where.id) || null)),
      create: vi.fn(({ data }) => {
        const trace = {
          id: `trace_${randomBytes(8).toString('hex')}`,
          ...data,
          status: 'RUNNING',
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
        mockTraces.set(trace.id, trace)
        return Promise.resolve(trace)
      }),
      update: vi.fn(({ where, data }) => {
        const trace = mockTraces.get(where.id)
        if (!trace) return Promise.reject(new Error('Not found'))
        const updated = { ...trace, ...data, updatedAt: new Date() }
        mockTraces.set(where.id, updated)
        return Promise.resolve(updated)
      }),
      delete: vi.fn(({ where }) => {
        const trace = mockTraces.get(where.id)
        if (!trace) return Promise.reject(new Error('Not found'))
        mockTraces.delete(where.id)
        return Promise.resolve(trace)
      }),
      count: vi.fn(() => Promise.resolve(mockTraces.size))
    }
  }
}))

// Mock cache functions
const mockCached = vi.fn(async <T>(_key: string, _ttl: number, fn: () => Promise<T>) => fn())
const mockCacheDeletePattern = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/redis.js', () => ({
  cached: <T>(...args: [string, number, () => Promise<T>]) => mockCached(...args),
  queryHash: (params: Record<string, unknown>) => {
    return Object.keys(params).sort().filter(k => params[k] != null).map(k => `${k}=${params[k]}`).join('&')
  },
  cacheDeletePattern: (...args: unknown[]) => mockCacheDeletePattern(...args),
  CACHE_TTL: { TRACES_LIST: 30 },
  CACHE_KEYS: { TRACES_LIST: 'traces:list:' },
}))

import { vi } from 'vitest'

describe('Traces API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    await app.register(traceRoutes, { prefix: '/v1/traces' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockTraces.clear()
    mockCached.mockClear()
    mockCacheDeletePattern.mockClear()
    mockCached.mockImplementation(async <T>(_key: string, _ttl: number, fn: () => Promise<T>) => fn())
  })

  describe('POST /v1/traces', () => {
    it('should create a trace with valid API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: {
          authorization: `Bearer ${TEST_API_KEY}`
        },
        payload: {
          name: 'Test Trace',
          metadata: { test: true }
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.id).toBeDefined()
      expect(body.name).toBe('Test Trace')
      expect(body.status).toBe('RUNNING')
      expect(body.projectId).toBe(TEST_PROJECT_ID)
    })

    it('should reject without API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        payload: { name: 'Test' }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject with invalid API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: {
          authorization: 'Bearer ag_invalid'
        },
        payload: { name: 'Test' }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /v1/traces', () => {
    it('should list traces for authenticated project', async () => {
      // Create a trace first
      await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { name: 'Trace 1' }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toBeDefined()
      expect(body.pagination).toBeDefined()
    })
  })

  describe('GET /v1/traces/:id', () => {
    it('should get a trace by ID', async () => {
      // Create a trace first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { name: 'Test Trace' }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'GET',
        url: `/v1/traces/${created.id}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.id).toBe(created.id)
    })

    it('should return 404 for non-existent trace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces/nonexistent',
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PATCH /v1/traces/:id', () => {
    it('should update trace status', async () => {
      // Create a trace first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { name: 'Test Trace' }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/traces/${created.id}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          status: 'COMPLETED',
          output: { result: 'success' }
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('COMPLETED')
    })
  })

  describe('DELETE /v1/traces/:id', () => {
    it('should delete a trace', async () => {
      // Create a trace first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { name: 'Test Trace' }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'DELETE',
        url: `/v1/traces/${created.id}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(204)
    })
  })

  describe('Cache Behavior', () => {
    it('should use cached() for GET /traces list', async () => {
      await app.inject({
        method: 'GET',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(mockCached).toHaveBeenCalledWith(
        expect.stringContaining('traces:list:'),
        30,
        expect.any(Function)
      )
    })

    it('should invalidate trace list cache on POST /traces', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { name: 'Cache Invalidation Test' }
      })

      expect(mockCacheDeletePattern).toHaveBeenCalledWith(
        expect.stringContaining(`traces:list:${TEST_PROJECT_ID}:`)
      )
    })

    it('should invalidate trace list cache on PATCH /traces/:id', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { name: 'Cache PATCH Test' }
      })
      const created = JSON.parse(createResponse.body)
      mockCacheDeletePattern.mockClear()

      await app.inject({
        method: 'PATCH',
        url: `/v1/traces/${created.id}`,
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: { status: 'COMPLETED' }
      })

      expect(mockCacheDeletePattern).toHaveBeenCalledWith(
        expect.stringContaining(`traces:list:${TEST_PROJECT_ID}:`)
      )
    })

    it('should return cached data when cached() resolves from cache', async () => {
      const cachedData = {
        data: [{ id: 'cached_trace', name: 'Cached Trace' }],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
      }
      mockCached.mockResolvedValueOnce(cachedData)

      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces',
        headers: { authorization: `Bearer ${TEST_API_KEY}` }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data[0].id).toBe('cached_trace')
    })
  })
})
