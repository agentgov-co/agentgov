import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Cookie names - check both secure (production) and regular (development)
const SESSION_COOKIE_NAMES = [
  '__Secure-agentgov.session_token', // Production (secure cookies)
  'agentgov.session_token',           // Development
]

// Routes that require authentication
const protectedRoutes = ['/dashboard']

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register']

// SSR routes that need nonce-based CSP (HTML is rendered per-request with nonce).
// All other routes use the default static CSP set in next.config.ts headers().
const ssrRoutes = ['/dashboard']

export function buildCsp(nonce: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  // 'self' and URL allowlists are CSP2 fallbacks for older browsers.
  // In CSP3 browsers, 'strict-dynamic' ignores them and trusts only
  // nonced scripts + scripts they dynamically load (e.g. Vercel Analytics).
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com https://vercel.live https://*.sentry.io`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${apiUrl} ws: wss: https://*.sentry.io https://va.vercel-scripts.com https://vercel.live`,
    "font-src 'self'",
    "frame-src 'self' https://vercel.live",
    "frame-ancestors 'none'",
  ]

  return directives.join('; ')
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const sessionCookie = SESSION_COOKIE_NAMES
    .map(name => request.cookies.get(name)?.value)
    .find(value => value)

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to dashboard if accessing auth routes with session
  if (isAuthRoute && sessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Only SSR routes get nonce-based CSP (overwrites the default static CSP
  // from next.config.ts). Static pages keep the config-level CSP as-is.
  const needsNonce = ssrRoutes.some(route => pathname.startsWith(route))

  if (needsNonce) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })

    response.headers.set('Content-Security-Policy', buildCsp(nonce))
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
}
