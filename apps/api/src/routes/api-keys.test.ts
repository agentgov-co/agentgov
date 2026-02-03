import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { createHash } from 'crypto'

// In-memory cache simulating Redis
const mockCache = new Map<string, string>()

vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => null,
  invalidateApiKeyCache: vi.fn(async (keyHash: string) => {
    mockCache.delete(`cache:apikey:${keyHash}`)
  }),
  getCachedApiKey: vi.fn(async (keyHash: string) => {
    const val = mockCache.get(`cache:apikey:${keyHash}`)
    return val ? JSON.parse(val) : null
  }),
  setCachedApiKey: vi.fn(async (keyHash: string, data: unknown) => {
    mockCache.set(`cache:apikey:${keyHash}`, JSON.stringify(data))
  }),
}))

// Track deleted keys
const deletedKeys = new Set<string>()

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async ({ where }: { where: Record<string, string> }) => {
        if (where.keyHash && deletedKeys.has(where.keyHash)) {
          return null
        }
        if (where.keyHash === testKeyHash) {
          return {
            id: 'apikey-1',
            name: 'Test Key',
            keyHash: testKeyHash,
            keyPrefix: 'ag_live_',
            userId: 'user-1',
            organizationId: 'org-1',
            projectId: 'proj-1',
            permissions: ['traces:write'],
            rateLimit: 1000,
            expiresAt: null,
            lastUsedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
            project: { id: 'proj-1', name: 'Test Project' },
          }
        }
        if (where.id === 'apikey-1') {
          if (deletedKeys.has(testKeyHash)) return null
          return {
            id: 'apikey-1',
            name: 'Test Key',
            keyHash: testKeyHash,
            organizationId: 'org-1',
          }
        }
        if (where.id === 'apikey-other-org') {
          return {
            id: 'apikey-other-org',
            name: 'Other Org Key',
            keyHash: 'other-hash',
            organizationId: 'org-999',
          }
        }
        return null
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'apikey-new',
        name: data.name,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        projectId: data.projectId,
        permissions: [],
        rateLimit: 1000,
        expiresAt: data.expiresAt ?? null,
        createdAt: new Date(),
      })),
      update: vi.fn(async ({ where, data }: { where: Record<string, string>; data: Record<string, unknown> }) => ({
        id: where.id,
        name: data.name ?? 'Test Key',
        keyPrefix: 'ag_live_',
        projectId: 'proj-1',
        permissions: ['traces:write'],
        rateLimit: data.rateLimit ?? 1000,
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      })),
      delete: vi.fn(async ({ where }: { where: Record<string, string> }) => {
        deletedKeys.add(testKeyHash)
        return { id: where.id }
      }),
    },
    project: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, string> }) => {
        if (where.id === 'proj-1') {
          return { id: 'proj-1', organizationId: 'org-1' }
        }
        return null
      }),
      findFirst: vi.fn(async () => null),
    },
  },
}))

vi.mock('../services/audit.js', () => ({
  auditService: {
    logApiKeyCreated: vi.fn(),
    logApiKeyDeleted: vi.fn(),
  },
}))

vi.mock('../lib/metrics.js', () => ({
  recordCacheOperation: vi.fn(),
}))

import { apiKeyRoutes } from './api-keys.js'
import { invalidateApiKeyCache, getCachedApiKey, setCachedApiKey } from '../lib/redis.js'
import { auditService } from '../services/audit.js'

const testApiKey = 'ag_live_abcdef1234567890abcdef1234567890abcdef12345678'
const testKeyHash = createHash('sha256').update(testApiKey).digest('hex')

describe('AC-1.2: API Key Cache Invalidation', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    app.decorateRequest('user', null)
    app.decorateRequest('organization', null)
    app.addHook('preHandler', async (request) => {
      ;(request as unknown as Record<string, unknown>).user = { id: 'user-1' }
      ;(request as unknown as Record<string, unknown>).organization = { id: 'org-1', role: 'owner' }
    })

    await app.register(apiKeyRoutes, { prefix: '/v1/api-keys' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockCache.clear()
    deletedKeys.clear()
    vi.clearAllMocks()
  })

  // ── Core flow: Create → cache → delete → cache miss ──────────────

  it('should invalidate cache when API key is deleted: create → cache → delete → lookup returns null', async () => {
    // Step 1: Simulate that the API key exists and is cached
    await setCachedApiKey(testKeyHash, {
      id: 'apikey-1',
      name: 'Test Key',
      keyHash: testKeyHash,
      organizationId: 'org-1',
      projectId: 'proj-1',
      permissions: ['traces:write'],
      rateLimit: 1000,
    })

    // Verify cache is populated
    const cached = await getCachedApiKey(testKeyHash)
    expect(cached).not.toBeNull()
    expect((cached as Record<string, unknown>).id).toBe('apikey-1')

    // Step 2: Delete the API key via API
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/v1/api-keys/apikey-1',
    })

    expect(deleteResponse.statusCode).toBe(204)

    // Step 3: Verify invalidateApiKeyCache was called with the correct hash
    expect(invalidateApiKeyCache).toHaveBeenCalledWith(testKeyHash)

    // Step 4: Verify cache is now empty — next auth request would hit DB and get null → 401
    const cachedAfterDelete = await getCachedApiKey(testKeyHash)
    expect(cachedAfterDelete).toBeNull()
  })

  it('should invalidate cache when API key is updated (PATCH)', async () => {
    await setCachedApiKey(testKeyHash, {
      id: 'apikey-1',
      name: 'Old Name',
      rateLimit: 1000,
    })

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: '/v1/api-keys/apikey-1',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'New Name' },
    })

    expect(updateResponse.statusCode).toBe(200)
    expect(invalidateApiKeyCache).toHaveBeenCalledWith(testKeyHash)
    const cachedAfterUpdate = await getCachedApiKey(testKeyHash)
    expect(cachedAfterUpdate).toBeNull()
  })

  it('should invalidate cache on rateLimit update so new limit takes effect', async () => {
    await setCachedApiKey(testKeyHash, {
      id: 'apikey-1',
      rateLimit: 1000,
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/api-keys/apikey-1',
      headers: { 'content-type': 'application/json' },
      payload: { rateLimit: 5000 },
    })

    expect(response.statusCode).toBe(200)
    expect(invalidateApiKeyCache).toHaveBeenCalledWith(testKeyHash)

    // Stale cached rateLimit must be gone
    const cachedAfter = await getCachedApiKey(testKeyHash)
    expect(cachedAfter).toBeNull()
  })

  // ── Negative paths ────────────────────────────────────────────────

  it('should return 404 when deleting non-existent key', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/api-keys/nonexistent-id',
    })

    expect(response.statusCode).toBe(404)
    expect(invalidateApiKeyCache).not.toHaveBeenCalled()
  })

  it('should return 404 when updating non-existent key', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/api-keys/nonexistent-id',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Updated' },
    })

    expect(response.statusCode).toBe(404)
    expect(invalidateApiKeyCache).not.toHaveBeenCalled()
  })

  it('should return 403 when deleting key of another organization', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/api-keys/apikey-other-org',
    })

    expect(response.statusCode).toBe(403)
    expect(invalidateApiKeyCache).not.toHaveBeenCalled()
  })

  // ── Create flow ───────────────────────────────────────────────────

  it('should create API key and return raw key only once', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'My New Key', projectId: 'proj-1' },
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.key).toBeDefined()
    expect(body.key).toMatch(/^ag_live_/)
    expect(body.name).toBe('My New Key')
    expect(body.message).toContain('not be shown again')
  })

  it('should log audit event on key creation', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Audit Test Key' },
    })

    expect(auditService.logApiKeyCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        keyName: 'Audit Test Key',
      })
    )
  })

  it('should log audit event on key deletion', async () => {
    await app.inject({
      method: 'DELETE',
      url: '/v1/api-keys/apikey-1',
    })

    expect(auditService.logApiKeyDeleted).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        keyName: 'Test Key',
      })
    )
  })

  it('should return 400 on invalid body for create (empty name)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: { name: '' },
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error).toContain('Validation')
  })

  it('should return 404 when creating key with non-existent project', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Bad Project Key', projectId: 'proj-nonexistent' },
    })

    expect(response.statusCode).toBe(404)
  })
})
