/**
 * CSRF protection plugin for session-authenticated mutating requests.
 *
 * Session cookies use `sameSite: 'none'` + `secure: true` in production
 * (required for cross-origin API). This means the browser attaches cookies
 * to requests from *any* site. While CORS blocks reading responses, the
 * mutating request itself (POST/PUT/PATCH/DELETE) is still executed —
 * a classic CSRF vector.
 *
 * Defense layers:
 *  1. **Origin / Referer validation** — reject requests whose origin is
 *     not in the ALLOWED_ORIGINS list.
 *  2. **Custom header (`X-CSRF-Token`)** — any non-empty value is accepted.
 *     The header's purpose is to force a CORS preflight; browsers never send
 *     custom headers on simple cross-origin requests without a preflight
 *     OPTIONS check, which only whitelisted origins pass.
 *
 * Requests that bypass the check:
 *  - Safe methods (GET / HEAD / OPTIONS)
 *  - Exempt paths (auth, health, docs, metrics, webhooks, error reporting)
 *  - API key–authenticated requests (not cookie-based, immune to CSRF)
 *  - Unauthenticated requests (no session to abuse)
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { extractApiKey } from '../middleware/auth.js'
import { logger } from '../lib/logger.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const EXEMPT_PREFIXES = [
  '/api/auth',
  '/health',
  '/docs',
  '/metrics',
  '/webhooks/',
  '/report-error',
]

function parseOrigins(env: string | undefined): string[] {
  return env
    ? env.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:3001']
}

function extractOriginFromReferer(referer: string): string | null {
  try {
    const url = new URL(referer)
    return url.origin
  } catch {
    return null
  }
}

const csrfPlugin: FastifyPluginAsync = async (fastify) => {
  // Cache trusted origins once at registration — avoids re-parsing
  // process.env on every request.
  const trustedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS)

  fastify.addHook('onRequest', async (request, reply) => {
    // Skip safe (non-mutating) methods
    if (SAFE_METHODS.has(request.method)) {
      return
    }

    // Skip exempt paths
    if (EXEMPT_PREFIXES.some(p => request.url.startsWith(p))) {
      return
    }

    // Skip API key requests (not cookie-based, immune to CSRF)
    if (extractApiKey(request)) {
      return
    }

    // Skip unauthenticated requests (no session to abuse)
    if (!request.user) {
      return
    }

    // --- Layer 1: Origin / Referer validation ---
    const origin = request.headers.origin as string | undefined
    const referer = request.headers.referer as string | undefined

    const requestOrigin = origin || (referer ? extractOriginFromReferer(referer) : null)

    if (!requestOrigin || !trustedOrigins.includes(requestOrigin)) {
      logger.warn(
        { userId: request.user.id, method: request.method, url: request.url, origin: requestOrigin },
        '[CSRF] Blocked: origin missing or untrusted'
      )

      return reply.status(403).send({
        error: 'Forbidden',
        code: 'CSRF_ORIGIN_MISMATCH',
        message: 'Missing or untrusted Origin header. If you are building an integration, use API key authentication instead of session cookies.',
      })
    }

    // --- Layer 2: Custom header requirement ---
    if (!request.headers['x-csrf-token']) {
      logger.warn(
        { userId: request.user.id, method: request.method, url: request.url, origin: requestOrigin },
        '[CSRF] Blocked: missing X-CSRF-Token header'
      )

      return reply.status(403).send({
        error: 'Forbidden',
        code: 'CSRF_HEADER_MISSING',
        message: 'Missing X-CSRF-Token header. Include `X-CSRF-Token: 1` with session-authenticated requests.',
      })
    }
  })
}

export default fp(csrfPlugin, {
  name: 'csrf-plugin',
  dependencies: ['auth-plugin'],
})
