import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { PlanTier } from '../generated/prisma/client.js'
import { requireAuth, requireOrganization, requireRole } from '../middleware/auth.js'
import { config } from '../lib/config.js'
import { billingService } from '../services/billing.service.js'

// Allowed redirect origins for billing URLs
const ALLOWED_REDIRECT_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'https://checkout.stripe.com',
].filter(Boolean)

function validateRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_REDIRECT_ORIGINS.includes(parsed.origin)
  } catch {
    return false
  }
}

// Schemas
const CreateCheckoutSchema = z.object({
  tier: z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
  successUrl: z.string().url().refine(validateRedirectUrl, {
    message: 'URL origin not allowed',
  }),
  cancelUrl: z.string().url().refine(validateRedirectUrl, {
    message: 'URL origin not allowed',
  }),
})

const CreatePortalSchema = z.object({
  returnUrl: z.string().url().refine(validateRedirectUrl, {
    message: 'URL origin not allowed',
  }),
})

type CreateCheckoutBody = z.infer<typeof CreateCheckoutSchema>
type CreatePortalBody = z.infer<typeof CreatePortalSchema>

/**
 * Billing routes - all guarded by BILLING_ENABLED flag
 */
export async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  // Check if billing is enabled for all routes
  fastify.addHook('preHandler', async (_request, reply) => {
    if (!config.billing.enabled) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Billing is not enabled',
      })
    }
  })

  // Require session auth and organization context
  fastify.addHook('preHandler', requireAuth)
  fastify.addHook('preHandler', requireOrganization)

  /**
   * POST /v1/billing/checkout - Create checkout session for plan upgrade
   * Requires owner or admin role
   */
  fastify.route({
    method: 'POST',
    url: '/checkout',
    preHandler: [requireRole('OWNER', 'ADMIN')],
    handler: async (
      request: FastifyRequest<{ Body: CreateCheckoutBody }>,
      reply: FastifyReply
    ) => {
      const parsed = CreateCheckoutSchema.safeParse(request.body)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        })
      }

      const org = request.organization!

      try {
        const result = await billingService.createCheckoutSession({
          organizationId: org.id,
          tier: parsed.data.tier as PlanTier,
          successUrl: parsed.data.successUrl,
          cancelUrl: parsed.data.cancelUrl,
        })

        if (!result) {
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'Billing service not available',
          })
        }

        return { checkoutUrl: result.url }
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create checkout session')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create checkout session',
        })
      }
    },
  })

  /**
   * POST /v1/billing/portal - Create billing portal session
   * Requires owner or admin role
   */
  fastify.route({
    method: 'POST',
    url: '/portal',
    preHandler: [requireRole('OWNER', 'ADMIN')],
    handler: async (
      request: FastifyRequest<{ Body: CreatePortalBody }>,
      reply: FastifyReply
    ) => {
      const parsed = CreatePortalSchema.safeParse(request.body)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        })
      }

      const org = request.organization!

      try {
        const result = await billingService.createPortalSession({
          organizationId: org.id,
          returnUrl: parsed.data.returnUrl,
        })

        if (!result) {
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'Billing service not available',
          })
        }

        return { portalUrl: result.url }
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create portal session')

        if (error instanceof Error && error.message.includes('No billing account')) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.message,
          })
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create portal session',
        })
      }
    },
  })

  /**
   * GET /v1/billing/status - Get billing status
   */
  fastify.get('/status', async () => {
    return {
      billingEnabled: config.billing.enabled,
    }
  })
}
