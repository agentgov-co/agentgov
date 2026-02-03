import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { SDK_BODY_LIMIT } from '../lib/constants.js'
import { logger } from '../lib/logger.js'
import { authenticateApiKey, authenticateDual } from '../middleware/auth.js'
import { checkApiKeyRateLimit } from '../middleware/rate-limit.js'
import { wsManager } from '../lib/websocket-manager.js'
import {
  CreateSpanSchema,
  UpdateSpanSchema,
  type CreateSpan,
  type UpdateSpan
} from '../schemas/index.js'

export async function spanRoutes(fastify: FastifyInstance): Promise<void> {
  // ============================================
  // Dashboard routes (dual auth: session or API key)
  // ============================================
  fastify.register(async (dashboard) => {
    dashboard.addHook('preHandler', authenticateDual)

    // GET /v1/spans/:id - Get single span
    dashboard.get('/:id', async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { projectId?: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params

      const span = await prisma.span.findUnique({
        where: { id },
        include: {
          children: {
            take: 100,
            orderBy: { startedAt: 'asc' },
          },
          trace: {
            select: {
              projectId: true,
              project: { select: { organizationId: true } }
            }
          }
        }
      })

      if (!span) {
        return reply.status(404).send({ error: 'Span not found' })
      }

      // Auth check: project-level or org-level
      if (request.project) {
        if (span.trace.projectId !== request.project.id) {
          return reply.status(403).send({ error: 'Access denied' })
        }
      } else if (request.organization) {
        if (span.trace.project?.organizationId !== request.organization.id) {
          return reply.status(403).send({ error: 'Access denied' })
        }
      } else {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { trace: _, ...spanData } = span
      return spanData
    })
  })

  // ============================================
  // SDK routes (API key only)
  // ============================================
  fastify.register(async (sdk) => {
    sdk.addHook('preHandler', authenticateApiKey)
    sdk.addHook('preHandler', checkApiKeyRateLimit)

    // POST /v1/spans - Create span
    sdk.post('/', { bodyLimit: SDK_BODY_LIMIT }, async (
      request: FastifyRequest<{ Body: CreateSpan }>,
      reply: FastifyReply
    ) => {
      const project = request.project!
      const parsed = CreateSpanSchema.safeParse(request.body)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten()
        })
      }

      const trace = await prisma.trace.findUnique({
        where: { id: parsed.data.traceId },
        select: { projectId: true }
      })

      if (!trace) {
        return reply.status(404).send({ error: 'Trace not found' })
      }

      if (trace.projectId !== project.id) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      try {
        const span = await prisma.span.create({
          data: {
            ...parsed.data,
            input: parsed.data.input as Prisma.InputJsonValue | undefined,
            metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
            toolInput: parsed.data.toolInput as Prisma.InputJsonValue | undefined
          }
        })

        wsManager.notifySpanCreated(
          {
            id: span.id,
            traceId: span.traceId,
            parentSpanId: span.parentId,
            name: span.name,
            type: span.type,
            status: span.status,
            startTime: span.startedAt.toISOString(),
            endTime: span.endedAt?.toISOString() ?? null,
            input: span.input,
            output: span.output,
            model: span.model,
            tokenUsage: span.promptTokens || span.outputTokens
              ? { prompt: span.promptTokens ?? 0, output: span.outputTokens ?? 0 }
              : null,
            cost: span.cost,
            metadata: span.metadata as Record<string, unknown> | null,
            createdAt: span.createdAt.toISOString()
          },
          trace.projectId
        )

        return reply.status(201).send(span)
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create span')
        return reply.status(500).send({
          error: 'Failed to create span',
          message: process.env.NODE_ENV === 'development' ? String(error) : undefined
        })
      }
    })

    // PATCH /v1/spans/:id - Update span
    sdk.patch('/:id', { bodyLimit: SDK_BODY_LIMIT }, async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateSpan }>,
      reply: FastifyReply
    ) => {
      const project = request.project!
      const { id } = request.params
      const parsed = UpdateSpanSchema.safeParse(request.body)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten()
        })
      }

      const currentSpan = await prisma.span.findUnique({
        where: { id },
        include: {
          trace: {
            select: { projectId: true }
          }
        }
      })

      if (!currentSpan) {
        return reply.status(404).send({ error: 'Span not found' })
      }

      if (currentSpan.trace.projectId !== project.id) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      const updateData: Record<string, unknown> = { ...parsed.data }

      // Only set endedAt if transitioning to terminal status and not already ended
      // This prevents race conditions from concurrent updates
      if (parsed.data.status && ['COMPLETED', 'FAILED'].includes(parsed.data.status) && !currentSpan.endedAt) {
        const endedAt = new Date()
        updateData.endedAt = endedAt
        updateData.duration = endedAt.getTime() - currentSpan.startedAt.getTime()
      }

      const span = await prisma.span.update({
        where: {
          id,
          // Optimistic concurrency: only update if endedAt hasn't been set by another request
          ...(updateData.endedAt ? { endedAt: null } : {})
        },
        data: updateData
      })

      if (parsed.data.cost || parsed.data.promptTokens || parsed.data.outputTokens) {
        await updateTraceTotals(currentSpan.traceId)
      }

      return span
    })
  })
}

async function updateTraceTotals(traceId: string): Promise<void> {
  try {
    const aggregates = await prisma.span.aggregate({
      where: { traceId },
      _sum: {
        cost: true,
        promptTokens: true,
        outputTokens: true,
        duration: true
      }
    })

    await prisma.trace.update({
      where: { id: traceId },
      data: {
        totalCost: aggregates._sum.cost || 0,
        totalTokens: (aggregates._sum.promptTokens || 0) + (aggregates._sum.outputTokens || 0),
        totalDuration: aggregates._sum.duration || 0
      }
    })
  } catch (error) {
    // Log but don't throw - partial failures in aggregate updates are acceptable
    logger.error({ err: error, traceId }, '[Spans] Failed to update trace totals')
  }
}
