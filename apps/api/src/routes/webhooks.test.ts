import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Track state
let billingEnabled = true
let webhookEventHandled = false
let lastHandledEvent: { type: string; data: unknown } | null = null

// Mock config
vi.mock('../lib/config.js', () => ({
  config: {
    billing: {
      get enabled() { return billingEnabled },
    },
    stripe: {
      webhookSecret: 'whsec_test_secret',
    },
  },
}))

// Mock Stripe webhook verification
vi.mock('../lib/stripe.js', () => ({
  constructWebhookEvent: vi.fn((rawBody: Buffer | string, signature: string) => {
    if (signature === 'invalid_signature') {
      throw new Error('Invalid signature')
    }
    if (signature === 'sig_valid') {
      const body = JSON.parse(rawBody.toString())
      return {
        id: 'evt_123',
        type: body.type || 'checkout.session.completed',
        data: body.data || { object: {} },
      }
    }
    throw new Error('Webhook signature verification failed')
  }),
}))

// Mock billing service
vi.mock('../services/billing.service.js', () => ({
  billingService: {
    handleWebhookEvent: vi.fn(async (event) => {
      webhookEventHandled = true
      lastHandledEvent = event
    }),
  },
}))

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Import after mocks
import { webhookRoutes } from './webhooks.js'

describe('Webhook Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()

    // Add rawBody support (simplified mock)
    app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      const bufferBody = Buffer.isBuffer(body) ? body : Buffer.from(body)
      ;(req as unknown as { rawBody: Buffer }).rawBody = bufferBody
      try {
        done(null, JSON.parse(bufferBody.toString()))
      } catch {
        done(null, {})
      }
    })

    await app.register(webhookRoutes, { prefix: '/webhooks' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    billingEnabled = true
    webhookEventHandled = false
    lastHandledEvent = null
  })

  describe('POST /webhooks/stripe', () => {
    const validPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: { organizationId: 'org_123', tier: 'STARTER' },
        },
      },
    }

    it('should process valid webhook event', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'sig_valid',
          'content-type': 'application/json',
        },
        payload: validPayload,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.received).toBe(true)
      expect(webhookEventHandled).toBe(true)
    })

    it('should pass event to billing service', async () => {
      await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'sig_valid',
          'content-type': 'application/json',
        },
        payload: validPayload,
      })

      expect(lastHandledEvent).not.toBeNull()
      expect(lastHandledEvent?.type).toBe('checkout.session.completed')
    })

    it('should return 400 for missing signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'content-type': 'application/json',
        },
        payload: validPayload,
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Missing Stripe signature')
    })

    it('should return 400 for invalid signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'invalid_signature',
          'content-type': 'application/json',
        },
        payload: validPayload,
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invalid webhook signature')
    })

    it('should return 503 when billing is disabled', async () => {
      billingEnabled = false

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'sig_valid',
          'content-type': 'application/json',
        },
        payload: validPayload,
      })

      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Billing is not enabled')
    })

    it('should handle subscription.updated event', async () => {
      const payload = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
          },
        },
      }

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'sig_valid',
          'content-type': 'application/json',
        },
        payload,
      })

      expect(response.statusCode).toBe(200)
      expect(lastHandledEvent?.type).toBe('customer.subscription.updated')
    })

    it('should handle subscription.deleted event', async () => {
      const payload = {
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_123' },
        },
      }

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'sig_valid',
          'content-type': 'application/json',
        },
        payload,
      })

      expect(response.statusCode).toBe(200)
      expect(lastHandledEvent?.type).toBe('customer.subscription.deleted')
    })

    it('should handle invoice.payment_failed event', async () => {
      const payload = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            subscription: 'sub_123',
            customer: 'cus_123',
          },
        },
      }

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'sig_valid',
          'content-type': 'application/json',
        },
        payload,
      })

      expect(response.statusCode).toBe(200)
      expect(lastHandledEvent?.type).toBe('invoice.payment_failed')
    })
  })
})
