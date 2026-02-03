import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// Mock user and organization
const MOCK_USER = { id: 'user_123', email: 'test@example.com', name: 'Test User' }
const MOCK_ORG = { id: 'org_123', name: 'Test Org', role: 'OWNER' }
const MOCK_ORG_MEMBER = { id: 'org_123', name: 'Test Org', role: 'MEMBER' }

// Mock subscription data
const mockSubscription = {
  id: 'sub_123',
  organizationId: 'org_123',
  tier: 'FREE_BETA',
  status: 'ACTIVE',
  stripeCustomerId: null as string | null,
  stripeSubscriptionId: null as string | null,
  organization: { id: 'org_123', name: 'Test Org' },
}

const mockSubscriptionWithStripe = {
  ...mockSubscription,
  stripeCustomerId: 'cus_123' as string | null,
  stripeSubscriptionId: 'sub_stripe_123' as string | null,
}

// Mock plan limits
const mockPlanLimits = {
  STARTER: { tier: 'STARTER', stripePriceId: 'price_starter_123' },
  PRO: { tier: 'PRO', stripePriceId: 'price_pro_123' },
  ENTERPRISE: { tier: 'ENTERPRISE', stripePriceId: null },
}

// Track mock state
let billingEnabled = true
let currentSubscription = mockSubscription
let currentOrg = MOCK_ORG

// Mock config
vi.mock('../lib/config.js', () => ({
  config: {
    billing: {
      get enabled() { return billingEnabled },
    },
    stripe: {
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_123',
    },
  },
}))

// Mock Stripe
const mockStripe = {
  customers: {
    create: vi.fn(() => Promise.resolve({ id: 'cus_new_123' })),
  },
  checkout: {
    sessions: {
      create: vi.fn(() => Promise.resolve({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/session_123'
      })),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(() => Promise.resolve({
        url: 'https://billing.stripe.com/portal_123'
      })),
    },
  },
}

vi.mock('../lib/stripe.js', () => ({
  getStripe: () => mockStripe,
  isStripeConfigured: () => true,
}))

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    planLimit: {
      findUnique: vi.fn(({ where }) => {
        return Promise.resolve(mockPlanLimits[where.tier as keyof typeof mockPlanLimits] || null)
      }),
    },
    subscription: {
      findUnique: vi.fn(() => Promise.resolve(currentSubscription)),
      findFirst: vi.fn(() => Promise.resolve(currentSubscription)),
      update: vi.fn((args) => Promise.resolve({ ...currentSubscription, ...args.data })),
    },
  },
}))

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer session_')) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' })
    }
    (request as unknown as Record<string, unknown>).user = MOCK_USER
  },
  requireOrganization: async (request: FastifyRequest) => {
    (request as unknown as Record<string, unknown>).organization = currentOrg
  },
  requireRole: (...roles: string[]) => async (request: FastifyRequest, reply: FastifyReply) => {
    const org = (request as unknown as Record<string, { role: string }>).organization
    if (!roles.includes(org.role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' })
    }
  },
}))

// Import after mocks
import { billingRoutes } from './billing.js'

describe('Billing API', () => {
  let app: FastifyInstance
  const AUTH_HEADER = { authorization: 'Bearer session_valid_token' }

  beforeAll(async () => {
    app = Fastify()
    await app.register(billingRoutes, { prefix: '/v1/billing' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    billingEnabled = true
    currentSubscription = mockSubscription
    currentOrg = MOCK_ORG
  })

  describe('GET /v1/billing/status', () => {
    it('should return billing enabled status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/billing/status',
        headers: AUTH_HEADER,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.billingEnabled).toBe(true)
    })

    it('should return 503 when billing is disabled', async () => {
      billingEnabled = false

      const response = await app.inject({
        method: 'GET',
        url: '/v1/billing/status',
        headers: AUTH_HEADER,
      })

      expect(response.statusCode).toBe(503)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Billing is not enabled')
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/billing/status',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /v1/billing/checkout', () => {
    const validPayload = {
      tier: 'STARTER',
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
    }

    it('should create checkout session for valid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.checkoutUrl).toBe('https://checkout.stripe.com/session_123')
    })

    it('should create Stripe customer if not exists', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        name: 'Test Org',
        metadata: { organizationId: 'org_123' },
      })
    })

    it('should use existing Stripe customer', async () => {
      currentSubscription = mockSubscriptionWithStripe

      await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(mockStripe.customers.create).not.toHaveBeenCalled()
    })

    it('should reject invalid tier', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: { ...validPayload, tier: 'INVALID' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject invalid URLs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: { ...validPayload, successUrl: 'not-a-url' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject URLs with disallowed origins', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: { ...validPayload, successUrl: 'https://evil.com/success' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should accept checkout.stripe.com URLs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: { ...validPayload, successUrl: 'https://checkout.stripe.com/return' },
      })

      // Should pass URL validation (may fail on Stripe mock, but not 400)
      expect(response.statusCode).not.toBe(400)
    })

    it('should require owner or admin role', async () => {
      currentOrg = MOCK_ORG_MEMBER

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 503 when billing is disabled', async () => {
      billingEnabled = false

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(response.statusCode).toBe(503)
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        payload: validPayload,
      })

      expect(response.statusCode).toBe(401)
    })

    it('should handle PRO tier', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: { ...validPayload, tier: 'PRO' },
      })

      expect(response.statusCode).toBe(200)
    })

    it('should handle ENTERPRISE tier (requires price setup)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: AUTH_HEADER,
        payload: { ...validPayload, tier: 'ENTERPRISE' },
      })

      // ENTERPRISE has no stripePriceId in mock
      expect(response.statusCode).toBe(500)
    })
  })

  describe('POST /v1/billing/portal', () => {
    const validPayload = {
      returnUrl: 'http://localhost:3000/settings',
    }

    it('should create portal session for customer with Stripe ID', async () => {
      currentSubscription = mockSubscriptionWithStripe

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/portal',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.portalUrl).toBe('https://billing.stripe.com/portal_123')
    })

    it('should return 400 for customer without Stripe ID', async () => {
      currentSubscription = mockSubscription // no stripeCustomerId

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/portal',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('No billing account')
    })

    it('should reject invalid URL', async () => {
      currentSubscription = mockSubscriptionWithStripe

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/portal',
        headers: AUTH_HEADER,
        payload: { returnUrl: 'not-a-url' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject URLs with disallowed origins', async () => {
      currentSubscription = mockSubscriptionWithStripe

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/portal',
        headers: AUTH_HEADER,
        payload: { returnUrl: 'https://evil.com/settings' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should require owner or admin role', async () => {
      currentOrg = MOCK_ORG_MEMBER
      currentSubscription = mockSubscriptionWithStripe

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/portal',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 503 when billing is disabled', async () => {
      billingEnabled = false

      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/portal',
        headers: AUTH_HEADER,
        payload: validPayload,
      })

      expect(response.statusCode).toBe(503)
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/portal',
        payload: validPayload,
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
