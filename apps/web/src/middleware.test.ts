import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware, buildCsp } from './middleware'

// Mock crypto.randomUUID for deterministic tests
const MOCK_UUID = '550e8400-e29b-41d4-a716-446655440000'
const EXPECTED_NONCE = Buffer.from(MOCK_UUID).toString('base64')

beforeEach(() => {
  vi.stubGlobal('crypto', {
    ...crypto,
    randomUUID: () => MOCK_UUID,
  })
})

function createRequest(url: string, cookies?: Record<string, string>): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'))
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value)
    }
  }
  return req
}

describe('buildCsp', () => {
  it('should include nonce in script-src', () => {
    const csp = buildCsp('test-nonce')
    expect(csp).toContain("'nonce-test-nonce'")
  })

  it('should include strict-dynamic in script-src', () => {
    const csp = buildCsp('n')
    expect(csp).toContain("'strict-dynamic'")
  })

  it('should NOT include unsafe-inline in script-src', () => {
    const csp = buildCsp('n')
    const scriptSrc = csp.match(/script-src\s+([^;]+)/)?.[1] ?? ''
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it('should allow unsafe-inline only in style-src', () => {
    const csp = buildCsp('n')
    const styleSrc = csp.match(/style-src\s+([^;]+)/)?.[1] ?? ''
    expect(styleSrc).toContain("'unsafe-inline'")
  })

  it('should include default-src self', () => {
    const csp = buildCsp('n')
    expect(csp).toContain("default-src 'self'")
  })

  it('should include frame-ancestors none', () => {
    const csp = buildCsp('n')
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('should include Vercel analytics and Sentry domains', () => {
    const csp = buildCsp('n')
    expect(csp).toContain('https://va.vercel-scripts.com')
    expect(csp).toContain('https://*.sentry.io')
  })

  it('should include connect-src with API URL, WebSocket, Sentry', () => {
    const csp = buildCsp('n')
    const connectSrc = csp.match(/connect-src\s+([^;]+)/)?.[1] ?? ''
    expect(connectSrc).toContain('ws:')
    expect(connectSrc).toContain('wss:')
    expect(connectSrc).toContain('https://*.sentry.io')
  })
})

describe('Middleware: nonce-based CSP', () => {
  it('should set Content-Security-Policy response header with nonce', () => {
    const response = middleware(createRequest('/'))
    const csp = response.headers.get('Content-Security-Policy')!

    expect(csp).toContain(`'nonce-${EXPECTED_NONCE}'`)
  })

  it('should pass nonce to server components via x-nonce request header', () => {
    // NextResponse.next({ request: { headers } }) merges headers into the
    // request that downstream handlers (server components) receive.
    // Next.js exposes these as 'x-middleware-request-*' headers on the response.
    const response = middleware(createRequest('/'))
    const middlewareNonce = response.headers.get('x-middleware-request-x-nonce')

    expect(middlewareNonce).toBe(EXPECTED_NONCE)
  })

  it('should use the same nonce in both CSP header and x-nonce', () => {
    const response = middleware(createRequest('/'))
    const csp = response.headers.get('Content-Security-Policy')!
    const nonceInCsp = csp.match(/nonce-([^']+)/)?.[1]
    const nonceInHeader = response.headers.get('x-middleware-request-x-nonce')

    expect(nonceInCsp).toBe(nonceInHeader)
  })

  it('should generate a unique nonce per request', () => {
    let callCount = 0
    vi.stubGlobal('crypto', {
      ...crypto,
      randomUUID: () => {
        callCount++
        return callCount === 1
          ? '11111111-1111-1111-1111-111111111111'
          : '22222222-2222-2222-2222-222222222222'
      },
    })

    const csp1 = middleware(createRequest('/')).headers.get('Content-Security-Policy')!
    const csp2 = middleware(createRequest('/')).headers.get('Content-Security-Policy')!

    const nonce1 = csp1.match(/nonce-([^']+)/)?.[1]
    const nonce2 = csp2.match(/nonce-([^']+)/)?.[1]

    expect(nonce1).not.toBe(nonce2)
  })
})

describe('Middleware: auth redirects', () => {
  it('should redirect unauthenticated users from /dashboard to /login', () => {
    const response = middleware(createRequest('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toContain('/login')
    expect(response.headers.get('Location')).toContain('callbackUrl=%2Fdashboard')
  })

  it('should redirect authenticated users from /login to /dashboard', () => {
    const response = middleware(createRequest('/login', {
      'agentgov.session_token': 'valid-session',
    }))

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toContain('/dashboard')
  })

  it('should allow unauthenticated users to access /login with CSP', () => {
    const response = middleware(createRequest('/login'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  it('should allow authenticated users to access /dashboard with CSP', () => {
    const response = middleware(createRequest('/dashboard', {
      'agentgov.session_token': 'valid-session',
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
  })
})
