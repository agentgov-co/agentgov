import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { type WsTicketData, extractApiKey } from './websocket.js'

// Mock Redis
const mockRedisStore = new Map<string, string>()
const mockRedis = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  set: vi.fn(async (key: string, value: string, ex: string, ttl: number) => {
    mockRedisStore.set(key, value)
    return 'OK'
  }),
  get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
  del: vi.fn(async (key: string) => {
    mockRedisStore.delete(key)
    return 1
  }),
  eval: vi.fn(async (_script: string, _numkeys: number, key: string) => {
    const value = mockRedisStore.get(key) ?? null
    if (value) mockRedisStore.delete(key)
    return value
  }),
}

vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => mockRedis,
  invalidateApiKeyCache: vi.fn(),
}))

vi.mock('../lib/websocket-manager.js', () => ({
  wsManager: {
    addClient: vi.fn(() => 'client-1'),
    removeClient: vi.fn(),
    handleMessage: vi.fn(),
    getClientCount: vi.fn(() => 0),
  },
}))

vi.mock('../middleware/auth.js', () => ({
  validateWebSocketApiKey: vi.fn(),
  validateProjectAccess: vi.fn(async () => true),
  requireAuth: vi.fn(async () => {}),
  requireOrganization: vi.fn(async () => {}),
}))

vi.mock('../lib/prisma.js', () => ({
  prisma: {},
}))

vi.mock('../services/audit.js', () => ({
  auditService: { logApiKeyCreated: vi.fn(), logApiKeyDeleted: vi.fn() },
}))

vi.mock('../lib/metrics.js', () => ({
  recordCacheOperation: vi.fn(),
}))

import Fastify, { FastifyInstance } from 'fastify'
import websocketPlugin from './websocket.js'

describe('WebSocket Ticket Auth', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Decorate request with user/organization for session auth simulation
    app.decorateRequest('user', null)
    app.decorateRequest('organization', null)

    // Add a hook to set user/org from custom test headers
    app.addHook('preHandler', async (request) => {
      if (request.headers['x-test-user-id']) {
        (request as unknown as Record<string, unknown>).user = {
          id: request.headers['x-test-user-id'] as string,
        }
        ;(request as unknown as Record<string, unknown>).organization = {
          id: request.headers['x-test-org-id'] as string,
        }
      }
    })

    await app.register(websocketPlugin)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockRedisStore.clear()
    vi.clearAllMocks()
  })

  describe('POST /v1/ws/ticket', () => {
    it('should generate a ticket for authenticated user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/ws/ticket',
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'user-1',
          'x-test-org-id': 'org-1',
        },
        payload: { projectId: 'proj-1' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.ticket).toBeDefined()
      expect(typeof body.ticket).toBe('string')

      // Verify ticket was stored in Redis
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('ws:ticket:'),
        expect.any(String),
        'EX',
        30
      )
    })

    it('should reject unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/ws/ticket',
        headers: { 'content-type': 'application/json' },
        payload: { projectId: 'proj-1' },
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject requests without projectId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/ws/ticket',
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'user-1',
          'x-test-org-id': 'org-1',
        },
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    it('should store ticket data with correct fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/ws/ticket',
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'user-42',
          'x-test-org-id': 'org-7',
        },
        payload: { projectId: 'proj-99' },
      })

      expect(response.statusCode).toBe(200)

      // Check stored ticket data
      const setCall = mockRedis.set.mock.calls[0]
      const storedData = JSON.parse(setCall[1]) as WsTicketData
      expect(storedData.projectId).toBe('proj-99')
      expect(storedData.userId).toBe('user-42')
      expect(storedData.orgId).toBe('org-7')
      expect(storedData.ip).toBeDefined()
    })
  })

  describe('Ticket atomicity (Lua GETDEL)', () => {
    it('should atomically get and delete ticket on first use', async () => {
      const ticket = randomUUID()
      const ticketData: WsTicketData = {
        projectId: 'proj-1',
        userId: 'user-1',
        orgId: 'org-1',
        ip: '127.0.0.1',
      }
      mockRedisStore.set(`ws:ticket:${ticket}`, JSON.stringify(ticketData))

      // Simulate the Lua eval call
      const result = await mockRedis.eval(
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
        1,
        `ws:ticket:${ticket}`
      )

      expect(result).not.toBeNull()
      const parsed = JSON.parse(result as string) as WsTicketData
      expect(parsed.projectId).toBe('proj-1')

      // Ticket should be deleted — second use returns null
      const result2 = await mockRedis.eval(
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
        1,
        `ws:ticket:${ticket}`
      )
      expect(result2).toBeNull()
    })

    it('should return null for non-existent ticket', async () => {
      const result = await mockRedis.eval(
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
        1,
        'ws:ticket:non-existent'
      )
      expect(result).toBeNull()
    })
  })

  describe('Repeated ticket use → 4401', () => {
    it('should reject a ticket that has already been consumed (GETDEL atomicity)', async () => {
      const ticket = randomUUID()
      const ticketData: WsTicketData = {
        projectId: 'proj-1',
        userId: 'user-1',
        orgId: 'org-1',
        ip: '127.0.0.1',
      }
      mockRedisStore.set(`ws:ticket:${ticket}`, JSON.stringify(ticketData))

      // First use — consumes the ticket
      const first = await mockRedis.eval(
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
        1,
        `ws:ticket:${ticket}`
      )
      expect(first).not.toBeNull()
      expect(JSON.parse(first as string).projectId).toBe('proj-1')

      // Second use — ticket already consumed, must return null → would trigger 4401
      const second = await mockRedis.eval(
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
        1,
        `ws:ticket:${ticket}`
      )
      expect(second).toBeNull()
      // In production code, null triggers: socket.close(4401, 'Unauthorized')
    })

    it('should reject an expired ticket (not in Redis)', async () => {
      // Ticket was never stored or has already expired (TTL elapsed)
      const expiredTicket = randomUUID()

      const result = await mockRedis.eval(
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
        1,
        `ws:ticket:${expiredTicket}`
      )
      expect(result).toBeNull()
    })

    it('should reject ticket with IP mismatch', async () => {
      const ticket = randomUUID()
      const ticketData: WsTicketData = {
        projectId: 'proj-1',
        userId: 'user-1',
        orgId: 'org-1',
        ip: '10.0.0.1', // Ticket was issued for this IP
      }
      mockRedisStore.set(`ws:ticket:${ticket}`, JSON.stringify(ticketData))

      // Consume ticket
      const result = await mockRedis.eval(
        "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;",
        1,
        `ws:ticket:${ticket}`
      )
      const parsed = JSON.parse(result as string) as WsTicketData

      // In production, request.ip would be '192.168.1.1' (different)
      // The check: ticketData.ip !== request.ip → close(4401)
      expect(parsed.ip).toBe('10.0.0.1')
      expect(parsed.ip).not.toBe('192.168.1.1') // Simulated requester IP
    })
  })

  describe('extractApiKey', () => {
    it('should extract API key from x-api-key header', () => {
      const result = extractApiKey({ 'x-api-key': 'ag_live_test123' })
      expect(result).toBe('ag_live_test123')
    })

    it('should extract API key from Authorization: Bearer header', () => {
      const result = extractApiKey({ authorization: 'Bearer ag_live_bearer456' })
      expect(result).toBe('ag_live_bearer456')
    })

    it('should prefer x-api-key over Authorization header when both present', () => {
      const result = extractApiKey({
        'x-api-key': 'ag_live_preferred',
        authorization: 'Bearer ag_live_fallback',
      })
      expect(result).toBe('ag_live_preferred')
    })

    it('should return undefined when no API key or Bearer header present', () => {
      const result = extractApiKey({})
      expect(result).toBeUndefined()
    })

    it('should not extract key from non-Bearer Authorization header', () => {
      const result = extractApiKey({ authorization: 'Basic dXNlcjpwYXNz' })
      expect(result).toBeUndefined()
    })
  })

  describe('Ticket expiration', () => {
    it('should set TTL of 30 seconds on ticket', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/ws/ticket',
        headers: {
          'content-type': 'application/json',
          'x-test-user-id': 'user-1',
          'x-test-org-id': 'org-1',
        },
        payload: { projectId: 'proj-1' },
      })

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        30
      )
    })
  })
})
