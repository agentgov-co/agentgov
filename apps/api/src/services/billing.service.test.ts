import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock data
const mockPlanLimits = {
  STARTER: { tier: 'STARTER', stripePriceId: 'price_starter_123', tracesPerMonth: 50000 },
  PRO: { tier: 'PRO', stripePriceId: 'price_pro_123', tracesPerMonth: 500000 },
  ENTERPRISE: { tier: 'ENTERPRISE', stripePriceId: null, tracesPerMonth: -1 },
}

const mockSubscription = {
  id: 'sub_123',
  organizationId: 'org_123',
  tier: 'FREE_BETA',
  status: 'ACTIVE',
  stripeCustomerId: null as string | null,
  stripeSubscriptionId: null as string | null,
  organization: { id: 'org_123', name: 'Test Org' },
}

// Track state
let billingEnabled = true
let stripeConfigured = true
let currentSubscription = { ...mockSubscription }
let subscriptions: Record<string, typeof mockSubscription> = {}

// Mock config
vi.mock('../lib/config.js', () => ({
  config: {
    billing: {
      get enabled() { return billingEnabled },
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
        url: 'https://checkout.stripe.com/session_123',
      })),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(() => Promise.resolve({
        url: 'https://billing.stripe.com/portal_123',
      })),
    },
  },
}

vi.mock('../lib/stripe.js', () => ({
  getStripe: () => mockStripe,
  isStripeConfigured: () => stripeConfigured,
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
      findFirst: vi.fn(({ where }) => {
        if (where.stripeSubscriptionId) {
          return Promise.resolve(subscriptions[where.stripeSubscriptionId] || null)
        }
        return Promise.resolve(currentSubscription)
      }),
      update: vi.fn((args) => {
        const updated = { ...currentSubscription, ...args.data }
        if (args.where.id && subscriptions[currentSubscription.stripeSubscriptionId || '']) {
          subscriptions[currentSubscription.stripeSubscriptionId || ''] = updated
        }
        return Promise.resolve(updated)
      }),
    },
  },
}))

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import after mocks
import { billingService } from './billing.service.js'

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    billingEnabled = true
    stripeConfigured = true
    currentSubscription = { ...mockSubscription }
    subscriptions = {}
  })

  describe('createCheckoutSession', () => {
    const validParams = {
      organizationId: 'org_123',
      tier: 'STARTER' as const,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }

    it('should create checkout session successfully', async () => {
      const result = await billingService.createCheckoutSession(validParams)

      expect(result).not.toBeNull()
      expect(result?.url).toBe('https://checkout.stripe.com/session_123')
    })

    it('should create new Stripe customer if not exists', async () => {
      await billingService.createCheckoutSession(validParams)

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        name: 'Test Org',
        metadata: { organizationId: 'org_123' },
      })
    })

    it('should use existing Stripe customer', async () => {
      currentSubscription = { ...mockSubscription, stripeCustomerId: 'cus_existing' }

      await billingService.createCheckoutSession(validParams)

      expect(mockStripe.customers.create).not.toHaveBeenCalled()
    })

    it('should create checkout with correct line items', async () => {
      await billingService.createCheckoutSession(validParams)

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_new_123',
        mode: 'subscription',
        line_items: [{ price: 'price_starter_123', quantity: 1 }],
        success_url: validParams.successUrl,
        cancel_url: validParams.cancelUrl,
        metadata: { organizationId: 'org_123', tier: 'STARTER' },
      })
    })

    it('should return null when billing is disabled', async () => {
      billingEnabled = false

      const result = await billingService.createCheckoutSession(validParams)

      expect(result).toBeNull()
    })

    it('should return null when Stripe is not configured', async () => {
      stripeConfigured = false

      const result = await billingService.createCheckoutSession(validParams)

      expect(result).toBeNull()
    })

    it('should throw error for tier without Stripe price', async () => {
      await expect(
        billingService.createCheckoutSession({ ...validParams, tier: 'ENTERPRISE' as never })
      ).rejects.toThrow('No Stripe price configured for tier')
    })

    it('should throw error if subscription not found', async () => {
      currentSubscription = null as never

      await expect(
        billingService.createCheckoutSession(validParams)
      ).rejects.toThrow('Organization subscription not found')
    })

    it('should handle PRO tier', async () => {
      const result = await billingService.createCheckoutSession({
        ...validParams,
        tier: 'PRO' as const,
      })

      expect(result).not.toBeNull()
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_pro_123', quantity: 1 }],
        })
      )
    })
  })

  describe('createPortalSession', () => {
    const validParams = {
      organizationId: 'org_123',
      returnUrl: 'https://example.com/settings',
    }

    it('should create portal session for customer with Stripe ID', async () => {
      currentSubscription = { ...mockSubscription, stripeCustomerId: 'cus_123' }

      const result = await billingService.createPortalSession(validParams)

      expect(result).not.toBeNull()
      expect(result?.url).toBe('https://billing.stripe.com/portal_123')
    })

    it('should call Stripe with correct parameters', async () => {
      currentSubscription = { ...mockSubscription, stripeCustomerId: 'cus_123' }

      await billingService.createPortalSession(validParams)

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: validParams.returnUrl,
      })
    })

    it('should return null when billing is disabled', async () => {
      billingEnabled = false
      currentSubscription = { ...mockSubscription, stripeCustomerId: 'cus_123' }

      const result = await billingService.createPortalSession(validParams)

      expect(result).toBeNull()
    })

    it('should return null when Stripe is not configured', async () => {
      stripeConfigured = false
      currentSubscription = { ...mockSubscription, stripeCustomerId: 'cus_123' }

      const result = await billingService.createPortalSession(validParams)

      expect(result).toBeNull()
    })

    it('should throw error if no Stripe customer ID', async () => {
      currentSubscription = { ...mockSubscription, stripeCustomerId: null }

      await expect(
        billingService.createPortalSession(validParams)
      ).rejects.toThrow('No billing account found')
    })
  })

  describe('handleWebhookEvent', () => {
    describe('checkout.session.completed', () => {
      it('should update subscription on successful checkout', async () => {
        const { prisma } = await import('../lib/prisma.js')

        await billingService.handleWebhookEvent({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { organizationId: 'org_123', tier: 'STARTER' },
              subscription: 'sub_stripe_123',
              customer: 'cus_123',
            },
          },
        })

        expect(prisma.subscription.update).toHaveBeenCalledWith({
          where: { organizationId: 'org_123' },
          data: {
            tier: 'STARTER',
            status: 'ACTIVE',
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_stripe_123',
          },
        })
      })
    })

    describe('customer.subscription.updated', () => {
      beforeEach(() => {
        currentSubscription = {
          ...mockSubscription,
          stripeSubscriptionId: 'sub_stripe_123',
        }
        subscriptions['sub_stripe_123'] = currentSubscription
      })

      it('should update subscription status to active', async () => {
        const { prisma } = await import('../lib/prisma.js')

        await billingService.handleWebhookEvent({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_stripe_123',
              status: 'active',
              cancel_at_period_end: false,
              current_period_start: 1700000000,
              current_period_end: 1702592000,
              canceled_at: null,
            },
          },
        })

        expect(prisma.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'ACTIVE',
              cancelAtPeriodEnd: false,
            }),
          })
        )
      })

      it('should update subscription status to past_due', async () => {
        const { prisma } = await import('../lib/prisma.js')

        await billingService.handleWebhookEvent({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_stripe_123',
              status: 'past_due',
              cancel_at_period_end: false,
              current_period_start: 1700000000,
              current_period_end: 1702592000,
              canceled_at: null,
            },
          },
        })

        expect(prisma.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'PAST_DUE',
            }),
          })
        )
      })

      it('should handle cancel_at_period_end', async () => {
        const { prisma } = await import('../lib/prisma.js')

        await billingService.handleWebhookEvent({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_stripe_123',
              status: 'active',
              cancel_at_period_end: true,
              current_period_start: 1700000000,
              current_period_end: 1702592000,
              canceled_at: 1701000000,
            },
          },
        })

        expect(prisma.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              cancelAtPeriodEnd: true,
              canceledAt: expect.any(Date),
            }),
          })
        )
      })

      it('should ignore unknown subscription', async () => {
        const { prisma } = await import('../lib/prisma.js')
        subscriptions = {}

        await billingService.handleWebhookEvent({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_unknown',
              status: 'active',
              cancel_at_period_end: false,
              current_period_start: 1700000000,
              current_period_end: 1702592000,
              canceled_at: null,
            },
          },
        })

        expect(prisma.subscription.update).not.toHaveBeenCalled()
      })
    })

    describe('customer.subscription.deleted', () => {
      beforeEach(() => {
        currentSubscription = {
          ...mockSubscription,
          tier: 'PRO',
          stripeSubscriptionId: 'sub_stripe_123',
        }
        subscriptions['sub_stripe_123'] = currentSubscription
      })

      it('should downgrade to FREE tier', async () => {
        const { prisma } = await import('../lib/prisma.js')

        await billingService.handleWebhookEvent({
          type: 'customer.subscription.deleted',
          data: {
            object: { id: 'sub_stripe_123' },
          },
        })

        expect(prisma.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              tier: 'FREE',
              status: 'CANCELED',
              stripeSubscriptionId: null,
            },
          })
        )
      })

      it('should ignore unknown subscription', async () => {
        const { prisma } = await import('../lib/prisma.js')
        subscriptions = {}

        await billingService.handleWebhookEvent({
          type: 'customer.subscription.deleted',
          data: {
            object: { id: 'sub_unknown' },
          },
        })

        expect(prisma.subscription.update).not.toHaveBeenCalled()
      })
    })

    describe('invoice.payment_failed', () => {
      beforeEach(() => {
        currentSubscription = {
          ...mockSubscription,
          stripeSubscriptionId: 'sub_stripe_123',
        }
        subscriptions['sub_stripe_123'] = currentSubscription
      })

      it('should set status to PAST_DUE', async () => {
        const { prisma } = await import('../lib/prisma.js')

        await billingService.handleWebhookEvent({
          type: 'invoice.payment_failed',
          data: {
            object: {
              subscription: 'sub_stripe_123',
              customer: 'cus_123',
            },
          },
        })

        expect(prisma.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: 'PAST_DUE' },
          })
        )
      })

      it('should ignore unknown subscription', async () => {
        const { prisma } = await import('../lib/prisma.js')
        subscriptions = {}

        await billingService.handleWebhookEvent({
          type: 'invoice.payment_failed',
          data: {
            object: {
              subscription: 'sub_unknown',
              customer: 'cus_123',
            },
          },
        })

        expect(prisma.subscription.update).not.toHaveBeenCalled()
      })
    })

    describe('unhandled events', () => {
      it('should handle unknown event types gracefully', async () => {
        // Should not throw
        await billingService.handleWebhookEvent({
          type: 'some.unknown.event',
          data: { object: {} },
        })
      })
    })
  })
})
