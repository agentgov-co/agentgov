import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth, requireOrganization } from '../middleware/auth.js'
import { usageService } from '../services/usage.service.js'

export async function usageRoutes(fastify: FastifyInstance): Promise<void> {
  // Require session auth and organization context
  fastify.addHook('preHandler', requireAuth)
  fastify.addHook('preHandler', requireOrganization)

  /**
   * GET /v1/usage - Get current usage and limits for the organization
   */
  fastify.get('/', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const org = request.organization!

    try {
      const usage = await usageService.getUsageWithLimits(org.id)
      return usage
    } catch (error) {
      request.log.error({ err: error }, 'Failed to get usage')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve usage data',
      })
    }
  })
}
