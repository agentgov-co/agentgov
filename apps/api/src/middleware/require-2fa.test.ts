import { describe, it, expect, vi } from 'vitest'

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { require2FAForPrivilegedRoles } from './require-2fa.js'

type MockRequest = Parameters<typeof require2FAForPrivilegedRoles>[0]
type MockReply = Parameters<typeof require2FAForPrivilegedRoles>[1]

function createMockRequest(overrides: {
  user?: { id: string; twoFactorEnabled: boolean } | null
  organization?: { role: string } | null
} = {}): MockRequest {
  return {
    user: overrides.user ?? null,
    organization: overrides.organization ?? null,
  } as MockRequest
}

function createMockReply(): MockReply {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }
  return reply as unknown as MockReply
}

describe('require2FAForPrivilegedRoles', () => {
  it('should skip when no user is present', async () => {
    const request = createMockRequest({ user: null })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should skip when no organization context', async () => {
    const request = createMockRequest({
      user: { id: '1', twoFactorEnabled: false },
      organization: null,
    })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should skip for member role without 2FA', async () => {
    const request = createMockRequest({
      user: { id: '1', twoFactorEnabled: false },
      organization: { role: 'member' },
    })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should block owner without 2FA', async () => {
    const request = createMockRequest({
      user: { id: '1', twoFactorEnabled: false },
      organization: { role: 'owner' },
    })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: '2FA_REQUIRED' })
    )
  })

  it('should block admin without 2FA', async () => {
    const request = createMockRequest({
      user: { id: '1', twoFactorEnabled: false },
      organization: { role: 'admin' },
    })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: '2FA_REQUIRED' })
    )
  })

  it('should allow owner with 2FA enabled', async () => {
    const request = createMockRequest({
      user: { id: '1', twoFactorEnabled: true },
      organization: { role: 'owner' },
    })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should allow admin with 2FA enabled', async () => {
    const request = createMockRequest({
      user: { id: '1', twoFactorEnabled: true },
      organization: { role: 'admin' },
    })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('should skip for unknown roles', async () => {
    const request = createMockRequest({
      user: { id: '1', twoFactorEnabled: false },
      organization: { role: 'viewer' },
    })
    const reply = createMockReply()
    await require2FAForPrivilegedRoles(request, reply)
    expect(reply.status).not.toHaveBeenCalled()
  })
})
