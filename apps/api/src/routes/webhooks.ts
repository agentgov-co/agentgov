import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../lib/config.js'
import { constructWebhookEvent } from '../lib/stripe.js'
import { billingService } from '../services/billing.service.js'
import { logger } from '../lib/logger.js'

// Type augmentation for fastify-raw-body plugin is handled by the plugin itself

/**
 * Webhook routes for external services (Stripe)
 */
export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /webhooks/stripe - Handle Stripe webhook events
   *
   * This endpoint uses the rawBody provided by fastify-raw-body plugin
   * for Stripe signature verification.
   */
  fastify.post('/stripe', {
    config: {
      rawBody: true, // Enable rawBody for this route
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    // Check if billing is enabled
    if (!config.billing.enabled) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Billing is not enabled',
      })
    }

    // Get Stripe signature from header
    const signature = request.headers['stripe-signature']

    if (typeof signature !== 'string') {
      logger.warn('[Webhook] Missing Stripe signature header')
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing Stripe signature',
      })
    }

    // Verify we have raw body for signature verification
    if (!request.rawBody) {
      logger.error('[Webhook] Raw body not available for signature verification')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Unable to verify webhook signature',
      })
    }

    try {
      // Verify webhook signature and construct event
      const event = constructWebhookEvent(request.rawBody, signature)

      logger.info({ eventType: event.type, eventId: event.id }, '[Webhook] Processing Stripe event')

      // Handle the event
      await billingService.handleWebhookEvent({
        type: event.type,
        data: event.data,
      })

      logger.info({ eventType: event.type, eventId: event.id }, '[Webhook] Successfully processed Stripe event')

      // Return 200 to acknowledge receipt
      return { received: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage.includes('signature')) {
        logger.warn({ error: errorMessage }, '[Webhook] Stripe signature verification failed')
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid webhook signature',
        })
      }

      logger.error({ err: error }, '[Webhook] Failed to process Stripe event')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process webhook',
      })
    }
  })
}
