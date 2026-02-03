import { describe, it, expect } from 'vitest'
import { validateEnv } from './env-validation.js'

describe('AC-1.6: Environment variable validation', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/agentgov',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
  }

  it('should pass with all required env vars present and valid', () => {
    const result = validateEnv(validEnv)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should fail when DATABASE_URL is missing', () => {
    const result = validateEnv({ ...validEnv, DATABASE_URL: undefined })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('DATABASE_URL')
  })

  it('should fail when BETTER_AUTH_SECRET is missing', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_SECRET: undefined })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('BETTER_AUTH_SECRET')
  })

  it('should fail when REDIS_URL is missing', () => {
    const result = validateEnv({ ...validEnv, REDIS_URL: undefined })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('REDIS_URL')
  })

  it('should fail when BETTER_AUTH_SECRET is shorter than 32 characters', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_SECRET: 'short-secret-only-20ch' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 32 characters')
  })

  it('should fail when BETTER_AUTH_SECRET is empty string', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_SECRET: '' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('BETTER_AUTH_SECRET')
  })

  it('should fail when REDIS_URL is empty string', () => {
    const result = validateEnv({ ...validEnv, REDIS_URL: '' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('REDIS_URL')
  })

  it('should pass when BETTER_AUTH_SECRET is exactly 32 characters', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_SECRET: 'x'.repeat(32) })
    expect(result.valid).toBe(true)
  })

  it('should pass when BETTER_AUTH_SECRET is longer than 32 characters', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_SECRET: 'x'.repeat(64) })
    expect(result.valid).toBe(true)
  })

  it('should fail on the first missing variable and report it', () => {
    const result = validateEnv({})
    expect(result.valid).toBe(false)
    expect(result.error).toContain('DATABASE_URL')
  })

  it('should fail with BETTER_AUTH_SECRET at 31 characters (boundary)', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_SECRET: 'x'.repeat(31) })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 32 characters')
  })
})
