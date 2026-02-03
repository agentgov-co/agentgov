import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { SDK_BODY_LIMIT } from '../lib/constants.js'
import { authenticateApiKey, authenticateDual } from '../middleware/auth.js'
import { checkTraceLimit } from '../middleware/usage.js'
import { checkApiKeyRateLimit } from '../middleware/rate-limit.js'
import { wsManager } from '../lib/websocket-manager.js'
import { usageService } from '../services/usage.service.js'
import { cached, queryHash, cacheDeletePattern, CACHE_TTL, CACHE_KEYS } from '../lib/redis.js'
import {
  CreateTraceSchema,
  UpdateTraceSchema,
  TraceQuerySchema,
  type CreateTrace,
  type UpdateTrace,
  type TraceQuery
} from '../schemas/index.js'

export async function traceRoutes(fastify: FastifyInstance): Promise<void> {
  // ============================================
  // Dashboard routes (dual auth: session or API key)
  // ============================================
  fastify.register(async (dashboard) => {
    dashboard.addHook('preHandler', authenticateDual)

    // GET /v1/traces - List traces
    dashboard.get('/', async (
      request: FastifyRequest<{ Querystring: TraceQuery & { projectId?: string } }>
    ) => {
      const project = request.project!
      const { status, search, limit, offset } = TraceQuerySchema.parse(request.query)

      const where = {
        projectId: project.id,
        ...(status && { status }),
        ...(search && { name: { contains: search, mode: 'insensitive' as const } })
      }

      const cacheKey = `${CACHE_KEYS.TRACES_LIST}${project.id}:${queryHash({ status, search, limit, offset })}`

      return cached(cacheKey, CACHE_TTL.TRACES_LIST, async () => {
        const [traces, total] = await Promise.all([
          prisma.trace.findMany({
            where,
            omit: {
              input: true,
              output: true,
              metadata: true,
            },
            include: {
              _count: {
                select: { spans: true }
              }
            },
            orderBy: { startedAt: 'desc' },
            take: limit,
            skip: offset
          }),
          prisma.trace.count({ where }),
        ])

        return {
          data: traces,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + traces.length < total
          }
        }
      })
    })

    // GET /v1/traces/:id - Get single trace with spans
    // Note: projectId is optional - if not provided, we verify access via organization
    dashboard.get('/:id', async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { projectId?: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params

      const trace = await prisma.trace.findUnique({
        where: { id },
        include: {
          spans: {
            orderBy: { startedAt: 'asc' }
          },
          project: {
            select: { organizationId: true }
          }
        }
      })

      if (!trace) {
        return reply.status(404).send({ error: 'Trace not found' })
      }

      // If project context is available (from projectId query param), use it
      if (request.project) {
        if (trace.projectId !== request.project.id) {
          return reply.status(403).send({ error: 'Access denied' })
        }
      } else if (request.organization) {
        // Verify trace's project belongs to user's organization
        if (trace.project?.organizationId !== request.organization.id) {
          return reply.status(403).send({ error: 'Access denied' })
        }
      } else {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      // Remove project relation from response
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { project: _, ...traceData } = trace
      return traceData
    })

    // DELETE /v1/traces/:id - Delete trace
    // Note: projectId is required for delete operations for safety
    dashboard.delete('/:id', async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { projectId?: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params

      if (!request.project) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId query parameter required for delete operations'
        })
      }

      const existingTrace = await prisma.trace.findUnique({
        where: { id },
        select: { projectId: true }
      })

      if (!existingTrace) {
        return reply.status(404).send({ error: 'Trace not found' })
      }

      if (existingTrace.projectId !== request.project.id) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      await prisma.trace.delete({ where: { id } })
      return reply.status(204).send()
    })
  })

  // ============================================
  // SDK routes (API key only)
  // ============================================
  fastify.register(async (sdk) => {
    sdk.addHook('preHandler', authenticateApiKey)
    sdk.addHook('preHandler', checkApiKeyRateLimit)
    sdk.addHook('preHandler', checkTraceLimit)

    // POST /v1/traces - Create trace
    sdk.post('/', { bodyLimit: SDK_BODY_LIMIT }, async (
      request: FastifyRequest<{ Body: CreateTrace & { projectId?: string } }>,
      reply: FastifyReply
    ) => {
      const project = request.project!
      const parsed = CreateTraceSchema.safeParse(request.body)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten()
        })
      }

      try {
        const trace = await prisma.trace.create({
          data: {
            projectId: project.id,
            name: parsed.data.name,
            input: parsed.data.input as Prisma.InputJsonValue | undefined,
            metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined
          }
        })

        // Invalidate trace list cache for this project (non-blocking)
        cacheDeletePattern(`${CACHE_KEYS.TRACES_LIST}${project.id}:*`).catch((err) => {
          request.log.warn({ err, projectId: project.id }, 'Failed to invalidate trace list cache')
        })

        wsManager.notifyTraceCreated({
          id: trace.id,
          projectId: trace.projectId,
          name: trace.name,
          status: trace.status,
          startTime: trace.startedAt.toISOString(),
          endTime: trace.endedAt?.toISOString() ?? null,
          metadata: trace.metadata as Record<string, unknown> | null,
          createdAt: trace.createdAt.toISOString()
        })

        // Increment usage counter (non-blocking)
        if (project.organizationId) {
          usageService.incrementTraces(project.organizationId).catch((err) => {
            // Log but don't fail trace creation - usage tracking is best-effort
            request.log.warn(
              { err, orgId: project.organizationId, traceId: trace.id },
              'Failed to increment usage counter'
            )
          })
        }

        return reply.status(201).send(trace)
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create trace')
        return reply.status(500).send({
          error: 'Failed to create trace',
          message: process.env.NODE_ENV === 'development' ? String(error) : undefined
        })
      }
    })

    // PATCH /v1/traces/:id - Update trace
    sdk.patch('/:id', { bodyLimit: SDK_BODY_LIMIT }, async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateTrace }>,
      reply: FastifyReply
    ) => {
      const project = request.project!
      const { id } = request.params
      const parsed = UpdateTraceSchema.safeParse(request.body)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten()
        })
      }

      const existingTrace = await prisma.trace.findUnique({
        where: { id },
        select: { projectId: true, endedAt: true }
      })

      if (!existingTrace) {
        return reply.status(404).send({ error: 'Trace not found' })
      }

      if (existingTrace.projectId !== project.id) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      const updateData: Record<string, unknown> = { ...parsed.data }

      // Only set endedAt if transitioning to terminal status and not already ended
      // This prevents race conditions from concurrent updates
      const isTerminalStatus = parsed.data.status && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(parsed.data.status)
      const shouldSetEndTime = isTerminalStatus && !existingTrace.endedAt

      if (shouldSetEndTime) {
        updateData.endedAt = new Date()
      }

      const trace = await prisma.trace.update({
        where: {
          id,
          // Optimistic concurrency: only update if endedAt hasn't been set by another request
          ...(shouldSetEndTime ? { endedAt: null } : {})
        },
        data: updateData
      })

      // Invalidate trace list cache for this project (non-blocking)
      cacheDeletePattern(`${CACHE_KEYS.TRACES_LIST}${project.id}:*`).catch((err) => {
        request.log.warn({ err, projectId: project.id }, 'Failed to invalidate trace list cache')
      })

      wsManager.notifyTraceUpdated({
        id: trace.id,
        projectId: trace.projectId,
        status: trace.status,
        endTime: trace.endedAt?.toISOString() ?? null
      })

      return trace
    })
  })
}
