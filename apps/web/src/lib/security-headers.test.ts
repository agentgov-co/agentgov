import { describe, it, expect } from 'vitest'
import { buildSecurityHeaders } from './security-headers'

/**
 * AC-2.2: Security headers
 *
 * Tests the real buildSecurityHeaders() from production.
 * CSP is now set dynamically in middleware.ts with per-request nonce.
 */

const headers = buildSecurityHeaders()

function getHeader(name: string): string | undefined {
  return headers.find(h => h.key === name)?.value
}

describe('AC-2.2: Security headers configuration', () => {
  it('should define X-Content-Type-Options as nosniff', () => {
    expect(getHeader('X-Content-Type-Options')).toBe('nosniff')
  })

  it('should define X-Frame-Options as DENY', () => {
    expect(getHeader('X-Frame-Options')).toBe('DENY')
  })

  it('should define HSTS with max-age ≥ 2 years, includeSubDomains, preload', () => {
    const hsts = getHeader('Strict-Transport-Security')!
    expect(hsts).toContain('includeSubDomains')
    expect(hsts).toContain('preload')

    const maxAge = parseInt(hsts.match(/max-age=(\d+)/)![1], 10)
    expect(maxAge).toBeGreaterThanOrEqual(63072000)
  })

  it('should define Referrer-Policy as strict-origin-when-cross-origin', () => {
    expect(getHeader('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('should define Permissions-Policy restricting sensitive APIs', () => {
    const pp = getHeader('Permissions-Policy')!
    expect(pp).toContain('camera=()')
    expect(pp).toContain('microphone=()')
    expect(pp).toContain('geolocation=()')
  })

  it('should NOT include CSP in static headers (CSP is in middleware)', () => {
    expect(getHeader('Content-Security-Policy')).toBeUndefined()
  })
})
