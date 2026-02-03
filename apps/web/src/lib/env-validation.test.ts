import { describe, it, expect } from 'vitest'
import { validateEnv } from './env-validation'

describe('Environment variable validation (web)', () => {
  const validEnv = {
    NEXT_PUBLIC_API_URL: 'http://localhost:3001',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }

  it('should pass with all required env vars present and valid', () => {
    const result = validateEnv(validEnv)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail when NEXT_PUBLIC_API_URL is missing', () => {
    const result = validateEnv({ ...validEnv, NEXT_PUBLIC_API_URL: undefined })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required environment variable: NEXT_PUBLIC_API_URL')
  })

  it('should fail when BETTER_AUTH_URL is missing', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_URL: undefined })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required environment variable: BETTER_AUTH_URL')
  })

  it('should fail when NEXT_PUBLIC_API_URL is empty string', () => {
    const result = validateEnv({ ...validEnv, NEXT_PUBLIC_API_URL: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required environment variable: NEXT_PUBLIC_API_URL')
  })

  it('should fail when NEXT_PUBLIC_API_URL is not a valid URL', () => {
    const result = validateEnv({ ...validEnv, NEXT_PUBLIC_API_URL: 'not-a-url' })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('NEXT_PUBLIC_API_URL must be a valid URL')
  })

  it('should fail when BETTER_AUTH_URL is not a valid URL', () => {
    const result = validateEnv({ ...validEnv, BETTER_AUTH_URL: 'ftp://wrong-protocol' })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('BETTER_AUTH_URL must be a valid URL')
  })

  it('should collect all errors at once', () => {
    const result = validateEnv({})
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain('NEXT_PUBLIC_API_URL')
    expect(result.errors[1]).toContain('BETTER_AUTH_URL')
  })

  it('should accept https URLs', () => {
    const result = validateEnv({
      NEXT_PUBLIC_API_URL: 'https://api.agentgov.co',
      BETTER_AUTH_URL: 'https://agentgov.co',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should accept URLs with ports', () => {
    const result = validateEnv({
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      BETTER_AUTH_URL: 'http://localhost:3000',
    })
    expect(result.valid).toBe(true)
  })

  it('should accept URLs with paths', () => {
    const result = validateEnv({
      NEXT_PUBLIC_API_URL: 'https://api.agentgov.co/v1',
      BETTER_AUTH_URL: 'https://agentgov.co/auth',
    })
    expect(result.valid).toBe(true)
  })
})
