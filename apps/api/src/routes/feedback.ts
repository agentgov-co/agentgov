import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { z } from 'zod'
import { notifyFeedback } from '../lib/telegram.js'

const CreateFeedbackSchema = z.object({
  type: z.enum(['BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER']).default('OTHER'),
  message: z.string().min(1).max(5000),
  page: z.string().optional(),
})

export async function feedbackRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth)

  /**
   * POST /v1/feedback - Submit feedback
   */
  fastify.post('/', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const user = request.user!

    const parsed = CreateFeedbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.issues.map(i => i.message).join(', '),
      })
    }

    try {
      const feedback = await prisma.feedback.create({
        data: {
          userId: user.id,
          type: parsed.data.type,
          message: parsed.data.message,
          page: parsed.data.page,
        },
      })

      notifyFeedback({
        type: parsed.data.type,
        message: parsed.data.message,
        page: parsed.data.page,
        user: { name: user.name, email: user.email },
      })

      return reply.status(201).send(feedback)
    } catch (error) {
      request.log.error({ err: error }, 'Failed to create feedback')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to submit feedback',
      })
    }
  })

  /**
   * GET /v1/feedback - List feedback (for admin)
   */
  fastify.get('/', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const feedback = await prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      return feedback
    } catch (error) {
      request.log.error({ err: error }, 'Failed to list feedback')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve feedback',
      })
    }
  })
}
