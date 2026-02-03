import { describe, it, expect } from 'vitest'
import { sanitizeForLog, LOGGER_REDACT_PATHS } from './logger.js'

describe('sanitizeForLog', () => {
  it('should redact password fields', () => {
    const result = sanitizeForLog({ password: 'secret123', name: 'test' })
    expect(result).toEqual({ password: '[REDACTED]', name: 'test' })
  })

  it('should redact all sensitive keys', () => {
    const input = {
      password: 'pass',
      apiKey: 'ag_123',
      secret: 'shh',
      token: 'tok',
      authorization: 'Bearer xyz',
      cookie: 'session=abc',
      resetToken: 'reset123',
      newPassword: 'newpass',
      confirmPassword: 'newpass',
      name: 'visible',
    }
    const result = sanitizeForLog(input) as Record<string, unknown>

    expect(result.password).toBe('[REDACTED]')
    expect(result.apiKey).toBe('[REDACTED]')
    expect(result.secret).toBe('[REDACTED]')
    expect(result.token).toBe('[REDACTED]')
    expect(result.authorization).toBe('[REDACTED]')
    expect(result.cookie).toBe('[REDACTED]')
    expect(result.resetToken).toBe('[REDACTED]')
    expect(result.newPassword).toBe('[REDACTED]')
    expect(result.confirmPassword).toBe('[REDACTED]')
    expect(result.name).toBe('visible')
  })

  it('should handle nested objects', () => {
    const result = sanitizeForLog({
      user: { password: 'secret', name: 'john' },
    }) as Record<string, unknown>

    expect(result.user).toEqual({ password: '[REDACTED]', name: 'john' })
  })

  it('should handle non-object inputs', () => {
    expect(sanitizeForLog('string')).toBe('string')
    expect(sanitizeForLog(42)).toBe(42)
    expect(sanitizeForLog(null)).toBe(null)
  })

  it('should match keys case-insensitively', () => {
    const result = sanitizeForLog({
      Password: 'secret',
      myApiKey: 'key123',
    }) as Record<string, unknown>

    expect(result.Password).toBe('[REDACTED]')
    expect(result.myApiKey).toBe('[REDACTED]')
  })

  it('should redact deeply nested sensitive fields', () => {
    const result = sanitizeForLog({
      level1: {
        level2: {
          level3: {
            apiKey: 'ag_live_deep_nested',
            safeField: 'visible',
          },
        },
      },
    }) as Record<string, unknown>

    const level3 = (
      (result.level1 as Record<string, unknown>).level2 as Record<string, unknown>
    ).level3 as Record<string, unknown>
    expect(level3.apiKey).toBe('[REDACTED]')
    expect(level3.safeField).toBe('visible')
  })

  it('should redact partial key matches (e.g. stripeSecretKey, authToken)', () => {
    const result = sanitizeForLog({
      stripeSecretKey: 'sk_test_xxx',
      authToken: 'jwt.token.here',
      resetTokenExpiry: '2026-01-01',
      sessionCookie: 'abc123',
    }) as Record<string, unknown>

    expect(result.stripeSecretKey).toBe('[REDACTED]')
    expect(result.authToken).toBe('[REDACTED]')
    expect(result.resetTokenExpiry).toBe('[REDACTED]')
    expect(result.sessionCookie).toBe('[REDACTED]')
  })

  it('should NOT redact safe fields that partially resemble sensitive ones', () => {
    const result = sanitizeForLog({
      username: 'john',
      email: 'john@example.com',
      role: 'admin',
      createdAt: '2026-01-01',
    }) as Record<string, unknown>

    expect(result.username).toBe('john')
    expect(result.email).toBe('john@example.com')
    expect(result.role).toBe('admin')
    expect(result.createdAt).toBe('2026-01-01')
  })

  it('should handle arrays inside objects gracefully', () => {
    const result = sanitizeForLog({
      users: [1, 2, 3],
      password: 'secret',
    }) as Record<string, unknown>

    expect(result.password).toBe('[REDACTED]')
    // Arrays are objects, sanitizeForLog processes them
    expect(result.users).toBeDefined()
  })

  it('should not mutate the original object', () => {
    const original = { password: 'secret', name: 'test' }
    sanitizeForLog(original)

    expect(original.password).toBe('secret')
    expect(original.name).toBe('test')
  })
})

describe('Pino redact configuration', () => {
  it('should include authorization header in redact paths', () => {
    expect(LOGGER_REDACT_PATHS).toContain('req.headers.authorization')
  })

  it('should include cookie header in redact paths', () => {
    expect(LOGGER_REDACT_PATHS).toContain('req.headers.cookie')
  })

  it('should include x-api-key header in redact paths', () => {
    expect(LOGGER_REDACT_PATHS).toContain('req.headers["x-api-key"]')
  })

  it('should only contain req.headers paths', () => {
    for (const path of LOGGER_REDACT_PATHS) {
      expect(path).toMatch(/^req\.headers/)
    }
  })
})
