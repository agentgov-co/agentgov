import { describe, it, expect } from 'vitest'
import { filterHeaders, ALLOWED_HEADERS } from '@/lib/auth-proxy'

/**
 * AC-2.4: Auth proxy header whitelist
 *
 * Tests the real filterHeaders() and ALLOWED_HEADERS from @/lib/auth-proxy.
 * If the production whitelist or filtering logic changes, these tests catch it.
 */

/** Helper: create a Headers-like object from a Map (same .get() interface) */
function makeHeaders(entries: [string, string][]): { get(name: string): string | null } {
  const map = new Map(entries)
  return { get: (name: string) => map.get(name) ?? null }
}

describe('AC-2.4: Auth proxy header whitelist', () => {
  it('should only forward whitelisted headers', () => {
    const incoming = makeHeaders([
      ['content-type', 'application/json'],
      ['cookie', 'session=abc'],
      ['accept', 'application/json'],
      ['x-custom-header', 'malicious'],
      ['x-admin', 'true'],
      ['authorization', 'Bearer stolen-token'],
      ['x-api-key', 'ag_live_secret'],
    ])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('content-type')).toBe('application/json')
    expect(filtered.get('cookie')).toBe('session=abc')
    expect(filtered.get('accept')).toBe('application/json')
    expect(filtered.get('x-custom-header')).toBeNull()
    expect(filtered.get('x-admin')).toBeNull()
    expect(filtered.get('authorization')).toBeNull()
    expect(filtered.get('x-api-key')).toBeNull()
  })

  it('should prevent X-Forwarded-For spoofing — only first IP is used', () => {
    const incoming = makeHeaders([
      ['x-forwarded-for', '192.168.1.100, 10.0.0.1, 172.16.0.1'],
    ])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('X-Forwarded-For')).toBe('192.168.1.100')
  })

  it('should default to 127.0.0.1 when X-Forwarded-For is missing', () => {
    const incoming = makeHeaders([])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('X-Forwarded-For')).toBe('127.0.0.1')
  })

  it('should trim whitespace from X-Forwarded-For IP', () => {
    const incoming = makeHeaders([
      ['x-forwarded-for', '  10.0.0.5  , 192.168.1.1'],
    ])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('X-Forwarded-For')).toBe('10.0.0.5')
  })

  it('should not forward internal headers that could bypass auth', () => {
    const dangerousHeaders = [
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-real-ip',
      'x-internal-token',
      'proxy-authorization',
      'host',
    ]

    const incoming = makeHeaders(dangerousHeaders.map(h => [h, 'spoofed-value'] as [string, string]))

    const filtered = filterHeaders(incoming)

    for (const header of dangerousHeaders) {
      expect(filtered.get(header)).toBeNull()
    }
  })

  it('should forward all specified ALLOWED_HEADERS when present', () => {
    const values: Record<string, string> = {
      'content-type': 'text/html',
      'cookie': 'token=xyz',
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0',
      'origin': 'https://agentgov.io',
      'referer': 'https://agentgov.io/dashboard',
    }

    const incoming = makeHeaders(ALLOWED_HEADERS.map(h => [h, values[h]] as [string, string]))

    const filtered = filterHeaders(incoming)

    for (const header of ALLOWED_HEADERS) {
      expect(filtered.get(header)).toBe(values[header])
    }
  })

  it('should handle single IP in X-Forwarded-For (no spoofing attempt)', () => {
    const incoming = makeHeaders([['x-forwarded-for', '203.0.113.50']])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('X-Forwarded-For')).toBe('203.0.113.50')
  })

  it('should handle IPv6 addresses in X-Forwarded-For', () => {
    const incoming = makeHeaders([['x-forwarded-for', '2001:db8::1, 10.0.0.1']])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('X-Forwarded-For')).toBe('2001:db8::1')
  })

  it('should strip X-Forwarded-For from forwarded headers (not in whitelist)', () => {
    const incoming = makeHeaders([
      ['x-forwarded-for', '10.0.0.1, 192.168.1.1, 172.16.0.1'],
      ['content-type', 'application/json'],
    ])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('X-Forwarded-For')).toBe('10.0.0.1')
    expect(filtered.get('content-type')).toBe('application/json')
  })

  it('should not forward SSRF-enabling headers', () => {
    const ssrfHeaders = ['x-original-url', 'x-rewrite-url', 'x-forwarded-server', 'x-host']

    const incoming = makeHeaders(ssrfHeaders.map(h => [h, 'internal.service:8080'] as [string, string]))

    const filtered = filterHeaders(incoming)

    for (const header of ssrfHeaders) {
      expect(filtered.get(header)).toBeNull()
    }
  })

  it('should skip empty header values in whitelist (no empty forwarding)', () => {
    const incoming = makeHeaders([
      ['content-type', 'application/json'],
      ['cookie', ''],
    ])

    const filtered = filterHeaders(incoming)

    expect(filtered.get('content-type')).toBe('application/json')
    expect(filtered.get('cookie')).toBeNull()
  })
})
