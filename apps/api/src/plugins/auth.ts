import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { auth } from '../lib/auth.js'

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Handle all /api/auth/* routes with Better Auth
  // Following official documentation: https://www.better-auth.com/docs/integrations/fastify
  // Note: Fastify requires separate routes for base path and wildcard
  const authHandler = async (request: FastifyRequest, reply: import('fastify').FastifyReply): Promise<void> => {
    try {
      // Convert Fastify request to Web Request
      const url = new URL(request.url, `http://${request.headers.host}`)
      const headers = new Headers()
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, Array.isArray(value) ? value.join(', ') : value)
      })

      const webRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      })

      // Process with Better Auth
      const response = await auth.handler(webRequest)

      // Send response back through Fastify
      reply.status(response.status)
      response.headers.forEach((value, key) => reply.header(key, value))

      const body = await response.text()
      return reply.send(body || null)
    } catch (err) {
      fastify.log.error({ err }, 'Authentication Error')
      return reply.status(500).send({
        error: 'Internal authentication error',
        code: 'AUTH_FAILURE',
      })
    }
  }

  const authRateLimitConfig = {
    rateLimit: {
      max: process.env.NODE_ENV === 'production' ? 30 : 200,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => request.ip,
    },
  }

  // Register route for wildcard paths
  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: authRateLimitConfig,
    handler: authHandler,
  })

  // Also register for exact /api/auth path (no trailing anything)
  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth',
    config: authRateLimitConfig,
    handler: authHandler,
  })

  // Decorate request with user/session/organization (null by default)
  fastify.decorateRequest('user', null)
  fastify.decorateRequest('session', null)
  fastify.decorateRequest('organization', null)

  // Hook to populate auth context on each request
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Skip for auth routes (they handle their own auth)
    if (request.url.startsWith('/api/auth')) {
      return
    }

    try {
      // Convert headers for Better Auth
      const headers: Record<string, string> = {}
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) {
          headers[key] = Array.isArray(value) ? value.join(', ') : value
        }
      })

      // Get session from Better Auth
      const session = await auth.api.getSession({ headers })

      if (session?.user && session?.session) {
        // twoFactorEnabled is already included by the twoFactor plugin on session.user
        const user = session.user as typeof session.user & { twoFactorEnabled?: boolean }

        // Map Better Auth types to our types
        request.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image ?? null,
          twoFactorEnabled: user.twoFactorEnabled ?? false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
        request.session = {
          id: session.session.id,
          userId: session.session.userId,
          expiresAt: session.session.expiresAt,
          activeOrganizationId: session.session.activeOrganizationId ?? null,
        }

        // Get active organization if set
        const activeOrgId = request.session.activeOrganizationId
        if (activeOrgId) {
          try {
            const org = await auth.api.getFullOrganization({
              headers,
              query: { organizationId: activeOrgId },
            })

            if (org) {
              const member = org.members?.find((m: { userId: string }) => m.userId === session.user.id)
              request.organization = {
                id: org.id,
                name: org.name,
                slug: org.slug,
                role: member?.role || 'MEMBER',
              }
            }
          } catch {
            // Organization not found or access denied - ignore
          }
        }
      }
    } catch {
      // Session not found or invalid - continue without auth
    }
  })

  // Decorate fastify with auth instance for direct access
  fastify.decorate('auth', auth)
}

export default fp(authPlugin, {
  name: 'auth-plugin',
})

// TypeScript declarations using Better Auth's inferred types
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string
      name: string
      email: string
      emailVerified: boolean
      image: string | null
      twoFactorEnabled: boolean
      createdAt: Date
      updatedAt: Date
    } | null
    session: {
      id: string
      userId: string
      expiresAt: Date
      activeOrganizationId: string | null
    } | null
    organization: {
      id: string
      name: string
      slug: string
      role: string
    } | null
  }

  interface FastifyInstance {
    auth: typeof auth
  }
}
