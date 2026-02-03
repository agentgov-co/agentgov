import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomBytes, createHash } from 'crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireOrganization } from '../middleware/auth.js'
import { auditService } from '../services/audit.js'
import { invalidateApiKeyCache } from '../lib/redis.js'

// Schemas
const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
})

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rateLimit: z.number().min(100).max(100000).optional(),
})

// Generate API key with prefix
function generateApiKey(type: 'live' | 'test' = 'live'): { key: string; hash: string; prefix: string } {
  const prefix = `ag_${type}_`
  const randomPart = randomBytes(24).toString('hex')
  const key = `${prefix}${randomPart}`
  const hash = createHash('sha256').update(key).digest('hex')
  return { key, hash, prefix }
}

export async function apiKeyRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)
  fastify.addHook('preHandler', requireOrganization)

  // GET /v1/api-keys - List API keys for organization
  fastify.get('/', async (request: FastifyRequest) => {
    const org = request.organization!
    const user = request.user!

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        organizationId: org.id,
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        projectId: true,
        permissions: true,
        rateLimit: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { data: apiKeys }
  })

  // POST /v1/api-keys - Create new API key
  fastify.post('/', async (
    request: FastifyRequest<{ Body: z.infer<typeof CreateApiKeySchema> }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const user = request.user!

    const parsed = CreateApiKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    const { name, projectId, expiresInDays } = parsed.data

    // Verify project belongs to organization if specified
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      })

      if (!project || project.organizationId !== org.id) {
        return reply.status(404).send({ error: 'Project not found' })
      }
    }

    // Generate key
    const { key, hash, prefix } = generateApiKey('live')

    // Calculate expiration
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash: hash,
        keyPrefix: prefix,
        userId: user.id,
        organizationId: org.id,
        projectId: projectId || null,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        projectId: true,
        permissions: true,
        rateLimit: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Log audit event
    await auditService.logApiKeyCreated({
      userId: user.id,
      apiKeyId: apiKey.id,
      organizationId: org.id,
      keyName: name,
    })

    // Return key only once - it won't be shown again!
    return reply.status(201).send({
      ...apiKey,
      key, // Only time this is returned!
      message: 'Save this key - it will not be shown again',
    })
  })

  // GET /v1/api-keys/:id - Get API key details
  fastify.get('/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        projectId: true,
        permissions: true,
        rateLimit: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        organizationId: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!apiKey) {
      return reply.status(404).send({ error: 'API key not found' })
    }

    if (apiKey.organizationId !== org.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    // Strip organizationId from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizationId: _orgId, ...apiKeyData } = apiKey
    return apiKeyData
  })

  // PATCH /v1/api-keys/:id - Update API key
  fastify.patch('/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof UpdateApiKeySchema> }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    const parsed = UpdateApiKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      })
    }

    // Verify ownership
    const existing = await prisma.apiKey.findUnique({
      where: { id },
      select: { organizationId: true, keyHash: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'API key not found' })
    }

    if (existing.organizationId !== org.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        projectId: true,
        permissions: true,
        rateLimit: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Invalidate cached API key so changes take effect immediately
    await invalidateApiKeyCache(existing.keyHash)

    return apiKey
  })

  // DELETE /v1/api-keys/:id - Revoke API key
  fastify.delete('/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const user = request.user!
    const { id } = request.params

    // Verify ownership and get name for audit
    const existing = await prisma.apiKey.findUnique({
      where: { id },
      select: { organizationId: true, name: true, keyHash: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'API key not found' })
    }

    if (existing.organizationId !== org.id) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    await prisma.apiKey.delete({ where: { id } })

    // Invalidate cached API key so deleted key is rejected immediately
    await invalidateApiKeyCache(existing.keyHash)

    // Log audit event
    await auditService.logApiKeyDeleted({
      userId: user.id,
      apiKeyId: id,
      organizationId: org.id,
      keyName: existing.name,
    })

    return reply.status(204).send()
  })
}
