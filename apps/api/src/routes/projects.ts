import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireOrganization } from '../middleware/auth.js'
import { checkProjectLimit } from '../middleware/usage.js'
import { CreateProjectSchema, type CreateProject } from '../schemas/index.js'

// Generate API key and hash
function generateApiKey(): { apiKey: string; hash: string } {
  const apiKey = `ag_live_${randomBytes(24).toString('hex')}`
  const hash = createHash('sha256').update(apiKey).digest('hex')
  return { apiKey, hash }
}

export async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  // Require session auth and organization context
  fastify.addHook('preHandler', requireAuth)
  fastify.addHook('preHandler', requireOrganization)

  // GET /v1/projects - List projects for current organization
  fastify.get('/', async (request: FastifyRequest) => {
    const org = request.organization!

    const projects = await prisma.project.findMany({
      where: {
        organizationId: org.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { traces: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return projects
  })

  // POST /v1/projects - Create project
  fastify.route({
    method: 'POST',
    url: '/',
    preHandler: [checkProjectLimit],
    handler: async (
      request: FastifyRequest<{ Body: CreateProject }>,
      reply: FastifyReply
    ) => {
      const parsed = CreateProjectSchema.safeParse(request.body)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten()
        })
      }

      const org = request.organization!
      const { apiKey, hash } = generateApiKey()

      const project = await prisma.project.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          apiKeyHash: hash,
          organizationId: org.id
        }
      })

      // Return API key only on creation (never stored in plain text)
      return reply.status(201).send({
        id: project.id,
        name: project.name,
        description: project.description,
        apiKey, // Only time this is returned!
        createdAt: project.createdAt.toISOString()
      })
    },
  })

  // GET /v1/projects/:id - Get single project
  fastify.get('/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params
    const org = request.organization!

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: { traces: true }
        }
      }
    })

    // Check ownership - return 404 to not leak project existence
    if (!project || project.organizationId !== org.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    return project
  })

  // DELETE /v1/projects/:id - Delete project
  fastify.delete('/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params
    const org = request.organization!

    // Verify ownership before deletion
    const project = await prisma.project.findUnique({
      where: { id },
      select: { organizationId: true }
    })

    if (!project || project.organizationId !== org.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    await prisma.project.delete({ where: { id } })
    return reply.status(204).send()
  })
}
