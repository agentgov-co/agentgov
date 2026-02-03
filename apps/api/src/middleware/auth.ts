import { FastifyRequest, FastifyReply } from 'fastify'
import { createHash, timingSafeEqual } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { getCachedApiKey, setCachedApiKey } from '../lib/redis.js'
import { isIpAllowed } from '../lib/ip-utils.js'

// ===========================================
// SESSION AUTH GUARDS (for dashboard/UI)
// ===========================================

/**
 * Require authenticated user session
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }
}

/**
 * Require organization context
 */
export async function requireOrganization(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.organization) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Organization context required. Select an organization first.',
    })
  }
}

/**
 * Require specific organization role
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.organization) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Organization context required',
      })
    }

    if (!roles.includes(request.organization.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      })
    }
  }
}

// ===========================================
// API KEY AUTH GUARDS (for SDK)
// ===========================================

interface ApiKeyContext {
  id: string
  name: string
  keyPrefix: string
  userId: string
  organizationId: string | null
  projectId: string | null
  permissions: string[]
  allowedIps: string[]
  rateLimit: number
  expiresAt: Date | null
  lastUsedAt: Date | null
  organization: {
    id: string
    name: string
    slug: string
  } | null
  project: {
    id: string
    name: string
  } | null
}

/**
 * Authenticate API key for SDK requests
 */
export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = extractApiKey(request)

  if (!apiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key required. Pass via x-api-key header or Authorization: Bearer.',
    })
  }

  if (!apiKey.startsWith('ag_')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key format. Expected ag_live_* or ag_test_*',
    })
  }

  // Hash the key for lookup
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  // Try to get from cache first
  type CachedKey = Awaited<ReturnType<typeof prisma.apiKey.findUnique>> & {
    organization: { id: string; name: string; slug: string } | null
    project: { id: string; name: string } | null
  }

  let key = await getCachedApiKey<CachedKey>(keyHash)

  if (!key) {
    // Cache miss - fetch from database
    key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        organization: true,
        project: true,
      },
    })

    // Cache the result (even null to prevent repeated DB lookups)
    if (key) {
      await setCachedApiKey(keyHash, key)
    }
  }

  if (!key) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    })
  }

  // Check expiration
  if (key.expiresAt && key.expiresAt < new Date()) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key expired',
    })
  }

  // Check IP whitelist
  if (key.allowedIps && key.allowedIps.length > 0) {
    if (!isIpAllowed(request.ip, key.allowedIps)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'IP address not allowed for this API key',
        code: 'IP_NOT_ALLOWED',
      })
    }
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  })

  // Attach API key context to request
  request.apiKey = {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    userId: key.userId,
    organizationId: key.organizationId,
    projectId: key.projectId,
    permissions: key.permissions,
    allowedIps: key.allowedIps ?? [],
    rateLimit: key.rateLimit,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    organization: key.organization ? {
      id: key.organization.id,
      name: key.organization.name,
      slug: key.organization.slug,
    } : null,
    project: key.project ? {
      id: key.project.id,
      name: key.project.name,
    } : null,
  }
}

/**
 * Check if API key has specific permission
 */
export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key required',
      })
    }

    const hasPermission = permissions.some(p => request.apiKey!.permissions.includes(p))

    if (!hasPermission) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Required permission: ${permissions.join(' or ')}`,
      })
    }
  }
}

// ===========================================
// LEGACY ADMIN KEY (for backwards compatibility)
// ===========================================

/**
 * Authenticate admin key for project management
 * @deprecated Use session auth or API key auth instead
 */
export async function authenticateAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing admin key' })
  }

  const adminKey = authHeader.slice(7)

  const adminKeyFromEnv = process.env.AGENTGOV_ADMIN_KEY
  if (!adminKeyFromEnv) {
    return reply.status(503).send({
      error: 'Admin API not configured. Set AGENTGOV_ADMIN_KEY environment variable.',
    })
  }

  // Use timing-safe comparison to prevent timing attacks
  const adminKeyBuffer = Buffer.from(adminKey)
  const envKeyBuffer = Buffer.from(adminKeyFromEnv)

  if (adminKeyBuffer.length !== envKeyBuffer.length ||
      !timingSafeEqual(adminKeyBuffer, envKeyBuffer)) {
    return reply.status(401).send({ error: 'Invalid admin key' })
  }

  request.isAdmin = true
}

// ===========================================
// LEGACY PROJECT AUTH (for backwards compatibility)
// ===========================================

/**
 * Authenticate API key and attach project (legacy)
 * @deprecated Use requireApiKey instead
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = extractApiKey(request)

  if (!apiKey) {
    return reply.status(401).send({ error: 'Missing API key' })
  }

  if (!apiKey.startsWith('ag_')) {
    return reply.status(401).send({ error: 'Invalid API key format' })
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  // Try new ApiKey model first
  const newApiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { project: true },
  })

  if (newApiKey?.project) {
    request.project = newApiKey.project
    return
  }

  // Fall back to legacy project.apiKeyHash
  const project = await prisma.project.findUnique({
    where: { apiKeyHash: keyHash },
  })

  if (!project) {
    return reply.status(401).send({ error: 'Invalid API key' })
  }

  request.project = project
}

/**
 * Optional API key auth - doesn't fail if no auth provided
 */
export async function optionalApiKeyAuth(request: FastifyRequest): Promise<void> {
  const apiKey = extractApiKey(request)

  if (!apiKey || !apiKey.startsWith('ag_')) {
    return
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  // Try new ApiKey model first
  const newApiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { project: true },
  })

  if (newApiKey?.project) {
    request.project = newApiKey.project
    return
  }

  // Fall back to legacy project.apiKeyHash
  const project = await prisma.project.findUnique({
    where: { apiKeyHash: keyHash },
  })

  if (project) {
    request.project = project
  }
}

// ===========================================
// DUAL AUTH (Session OR API Key)
// ===========================================

/**
 * Authenticate via session cookie OR API key
 * - Dashboard uses session + optional projectId query param
 * - SDK uses API key
 */
export async function authenticateDual(
  request: FastifyRequest<{ Querystring: { projectId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const apiKey = extractApiKey(request)

  // Try API key auth first (for SDK)
  if (apiKey && apiKey.startsWith('ag_')) {
    return authenticateApiKey(request, reply)
  }

  // Try session auth (for dashboard)
  if (request.user && request.organization) {
    const { projectId } = request.query

    // projectId is optional - some endpoints can work with just organization context
    if (projectId) {
      // Verify project belongs to user's organization
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          organizationId: request.organization.id,
        },
      })

      if (!project) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found or access denied',
        })
      }

      request.project = project
    }
    // If no projectId, request.project will be undefined
    // Route handlers should check for this and handle accordingly
    return
  }

  // No valid auth
  return reply.status(401).send({
    error: 'Unauthorized',
    message: 'Authentication required. Use API key or session cookie.',
  })
}

// ===========================================
// HELPERS
// ===========================================

export function extractApiKey(request: FastifyRequest): string | undefined {
  // Check x-api-key header first
  const xApiKey = request.headers['x-api-key']
  if (typeof xApiKey === 'string') {
    return xApiKey
  }

  // Check Authorization header
  const authHeader = request.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return undefined
}

// ===========================================
// WEBSOCKET AUTH
// ===========================================

export interface WSAuthResult {
  authenticated: boolean
  projectId: string | null
  organizationId: string | null
  userId?: string | null
  authType: 'api_key' | 'session' | 'none'
  error?: string
}

/**
 * Validate API key for WebSocket connections
 * Returns project info if authenticated, error otherwise
 */
export async function validateWebSocketApiKey(
  apiKey: string | undefined
): Promise<WSAuthResult> {
  if (!apiKey) {
    return { authenticated: false, projectId: null, organizationId: null, authType: 'none', error: 'API key required' }
  }

  if (!apiKey.startsWith('ag_')) {
    return { authenticated: false, projectId: null, organizationId: null, authType: 'none', error: 'Invalid API key format' }
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  // Try new ApiKey model first
  const newApiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { project: true, organization: true },
  })

  if (newApiKey) {
    // Check expiration
    if (newApiKey.expiresAt && newApiKey.expiresAt < new Date()) {
      return { authenticated: false, projectId: null, organizationId: null, authType: 'api_key', error: 'API key expired' }
    }

    return {
      authenticated: true,
      projectId: newApiKey.projectId,
      organizationId: newApiKey.organizationId,
      userId: newApiKey.userId,
      authType: 'api_key',
    }
  }

  // Fall back to legacy project.apiKeyHash
  const project = await prisma.project.findUnique({
    where: { apiKeyHash: keyHash },
  })

  if (project) {
    return {
      authenticated: true,
      projectId: project.id,
      organizationId: project.organizationId,
      authType: 'api_key',
    }
  }

  return { authenticated: false, projectId: null, organizationId: null, authType: 'api_key', error: 'Invalid API key' }
}

/**
 * Validate project access for session-authenticated user
 */
export async function validateProjectAccess(
  projectId: string,
  organizationId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId,
    },
  })
  return !!project
}

// ===========================================
// TYPE EXTENSIONS
// ===========================================

declare module 'fastify' {
  interface FastifyRequest {
    project?: {
      id: string
      name: string
      description: string | null
      organizationId: string | null
      apiKeyHash: string | null
      createdAt: Date
      updatedAt: Date
    }
    apiKey?: ApiKeyContext
    isAdmin?: boolean
  }
}
