import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../middleware/auth.js', () => ({
  extractApiKey: vi.fn(),
}))
vi.mock('../lib/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { extractApiKey } from '../middleware/auth.js'
import { logger } from '../lib/logger.js'
import type { FastifyPluginAsync } from 'fastify'

const mockedExtractApiKey = vi.mocked(extractApiKey)
const mockedLoggerWarn = vi.mocked(logger.warn)

type OnRequestHook = (request: MockRequest, reply: MockReply) => Promise<void>

let onRequestHook: OnRequestHook

interface MockRequest {
  method: string
  url: string
  user: { id: string } | null
  headers: Record<string, string | undefined>
}

interface MockReply {
  status: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method: 'POST',
    url: '/v1/projects',
    user: { id: 'user-1' },
    headers: {
      origin: 'http://localhost:3000',
      'x-csrf-token': '1',
    },
    ...overrides,
  }
}

function createMockReply(): MockReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }
}

async function registerHook(): Promise<OnRequestHook> {
  const mod = await import('./csrf.js')
  const plugin = mod.default as unknown as FastifyPluginAsync

  let hook!: OnRequestHook
  const mockFastify = {
    addHook: vi.fn((_name: string, handler: OnRequestHook) => {
      hook = handler
    }),
  }

  await (plugin as unknown as (fastify: typeof mockFastify, opts: Record<string, never>) => Promise<void>)(mockFastify, {})
  return hook
}

beforeEach(async () => {
  vi.resetAllMocks()
  mockedExtractApiKey.mockReturnValue(undefined)
  delete process.env.ALLOWED_ORIGINS

  onRequestHook = await registerHook()
})

describe('csrfPlugin', () => {
  // ========== BYPASS: safe methods ==========

  it.each(['GET', 'HEAD', 'OPTIONS'])('should bypass %s requests', async (method) => {
    const request = createMockRequest({ method })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  // ========== BYPASS: exempt paths ==========

  it.each([
    ['/api/auth/signin', '/api/auth'],
    ['/health', '/health'],
    ['/health/ready', '/health'],
    ['/docs/json', '/docs'],
    ['/metrics', '/metrics'],
    ['/webhooks/stripe', '/webhooks/'],
    ['/report-error', '/report-error'],
  ])('should bypass exempt path %s (prefix %s)', async (url) => {
    const request = createMockRequest({ url, headers: {} })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  // ========== BYPASS: non-session auth ==========

  it('should bypass API key requests', async () => {
    mockedExtractApiKey.mockReturnValue('ag_live_test123')
    const request = createMockRequest({ headers: {} })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should bypass unauthenticated requests', async () => {
    const request = createMockRequest({ user: null, headers: {} })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  // ========== BLOCK: origin validation ==========

  it('should block when both Origin and Referer are missing', async () => {
    const request = createMockRequest({ headers: { 'x-csrf-token': '1' } })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_ORIGIN_MISMATCH' })
    )
    expect(mockedLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.stringContaining('[CSRF]')
    )
  })

  it('should block untrusted origin', async () => {
    const request = createMockRequest({
      headers: { origin: 'https://evil.com', 'x-csrf-token': '1' },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_ORIGIN_MISMATCH' })
    )
    expect(mockedLoggerWarn).toHaveBeenCalled()
  })

  it('should block origin with different port', async () => {
    const request = createMockRequest({
      headers: { origin: 'http://localhost:9999', 'x-csrf-token': '1' },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_ORIGIN_MISMATCH' })
    )
  })

  it('should block malformed Referer', async () => {
    const request = createMockRequest({
      headers: { referer: 'not-a-url', 'x-csrf-token': '1' },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_ORIGIN_MISMATCH' })
    )
  })

  // ========== BLOCK: missing custom header ==========

  it('should block when X-CSRF-Token header is missing', async () => {
    const request = createMockRequest({
      headers: { origin: 'http://localhost:3000' },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_HEADER_MISSING' })
    )
    expect(mockedLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.stringContaining('[CSRF]')
    )
  })

  // ========== ALLOW: valid requests ==========

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'should allow %s with valid origin and X-CSRF-Token',
    async (method) => {
      const request = createMockRequest({ method })
      const reply = createMockReply()
      await onRequestHook(request, reply)
      expect(reply.status).not.toHaveBeenCalled()
      expect(mockedLoggerWarn).not.toHaveBeenCalled()
    }
  )

  // ========== EDGE: Referer fallback ==========

  it('should accept Referer as fallback when Origin is absent', async () => {
    const request = createMockRequest({
      headers: {
        referer: 'http://localhost:3000/dashboard/projects',
        'x-csrf-token': '1',
      },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should extract origin from Referer with path and query', async () => {
    const request = createMockRequest({
      headers: {
        referer: 'http://localhost:3000/deep/path?foo=bar#anchor',
        'x-csrf-token': '1',
      },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should prefer Origin over Referer when both are present', async () => {
    const request = createMockRequest({
      headers: {
        origin: 'http://localhost:3000',
        referer: 'https://evil.com/page',
        'x-csrf-token': '1',
      },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    // Origin is trusted — should pass even though Referer is not
    expect(reply.status).not.toHaveBeenCalled()
  })

  // ========== EDGE: ALLOWED_ORIGINS env ==========

  it('should respect ALLOWED_ORIGINS env var', async () => {
    process.env.ALLOWED_ORIGINS = 'https://app.agentgov.io, https://api.agentgov.io'

    // Re-import to re-cache origins from env
    vi.resetModules()
    vi.mock('../middleware/auth.js', () => ({
      extractApiKey: vi.fn().mockReturnValue(undefined),
    }))
    vi.mock('../lib/logger.js', () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    }))

    const hook = await registerHook()

    // Trusted production origin → allowed
    const request = createMockRequest({
      headers: { origin: 'https://app.agentgov.io', 'x-csrf-token': '1' },
    })
    const reply = createMockReply()
    await hook(request, reply)
    expect(reply.status).not.toHaveBeenCalled()

    // Default dev origin → blocked when overridden
    const request2 = createMockRequest({
      headers: { origin: 'http://localhost:3000', 'x-csrf-token': '1' },
    })
    const reply2 = createMockReply()
    await hook(request2, reply2)
    expect(reply2.status).toHaveBeenCalledWith(403)
  })

  // ========== ERROR MESSAGE QUALITY ==========

  it('should include actionable guidance in origin error', async () => {
    const request = createMockRequest({ headers: { 'x-csrf-token': '1' } })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { message: string }
    expect(body.message).toContain('API key')
  })

  it('should include actionable guidance in header error', async () => {
    const request = createMockRequest({
      headers: { origin: 'http://localhost:3000' },
    })
    const reply = createMockReply()
    await onRequestHook(request, reply)
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { message: string }
    expect(body.message).toContain('X-CSRF-Token')
  })
})
