import { PlanTier, SubscriptionStatus } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { config } from '../lib/config.js'
import { getStripe, isStripeConfigured } from '../lib/stripe.js'
import { logger } from '../lib/logger.js'

/**
 * Billing service for Stripe integration
 * All methods check billing.enabled flag and gracefully handle disabled state
 */
export const billingService = {
  /**
   * Create a Stripe checkout session for plan upgrade
   */
  async createCheckoutSession(params: {
    organizationId: string
    tier: PlanTier
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string } | null> {
    if (!config.billing.enabled || !isStripeConfigured()) {
      logger.warn('[Billing] Checkout requested but billing is disabled')
      return null
    }

    const stripe = getStripe()

    // Get plan limit to find Stripe price ID
    const planLimit = await prisma.planLimit.findUnique({
      where: { tier: params.tier },
    })

    if (!planLimit?.stripePriceId) {
      throw new Error(`No Stripe price configured for tier: ${params.tier}`)
    }

    // Get or create customer
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: params.organizationId },
      include: { organization: true },
    })

    if (!subscription) {
      throw new Error('Organization subscription not found')
    }

    let customerId = subscription.stripeCustomerId

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        name: subscription.organization.name,
        metadata: {
          organizationId: params.organizationId,
        },
      })

      customerId = customer.id

      // Save customer ID
      await prisma.subscription.update({
        where: { organizationId: params.organizationId },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: planLimit.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        organizationId: params.organizationId,
        tier: params.tier,
      },
    })

    return { url: session.url! }
  },

  /**
   * Create a Stripe billing portal session for subscription management
   */
  async createPortalSession(params: {
    organizationId: string
    returnUrl: string
  }): Promise<{ url: string } | null> {
    if (!config.billing.enabled || !isStripeConfigured()) {
      logger.warn('[Billing] Portal requested but billing is disabled')
      return null
    }

    const stripe = getStripe()

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: params.organizationId },
    })

    if (!subscription?.stripeCustomerId) {
      throw new Error('No billing account found for this organization')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: params.returnUrl,
    })

    return { url: session.url }
  },

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: {
    type: string
    data: { object: unknown }
  }): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          metadata: { organizationId: string; tier: string }
          subscription: string
          customer: string
        }

        const { organizationId, tier } = session.metadata

        await prisma.subscription.update({
          where: { organizationId },
          data: {
            tier: tier as PlanTier,
            status: SubscriptionStatus.ACTIVE,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
        })

        logger.info({ organizationId, tier }, '[Billing] Checkout completed')
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as {
          id: string
          status: string
          cancel_at_period_end: boolean
          current_period_start: number
          current_period_end: number
          canceled_at: number | null
        }

        // Find subscription by Stripe ID
        const dbSubscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (!dbSubscription) {
          logger.warn({ stripeSubscriptionId: subscription.id }, '[Billing] Unknown subscription')
          break
        }

        // Map Stripe status to our status
        const statusMap: Record<string, SubscriptionStatus> = {
          active: SubscriptionStatus.ACTIVE,
          past_due: SubscriptionStatus.PAST_DUE,
          canceled: SubscriptionStatus.CANCELED,
          trialing: SubscriptionStatus.TRIALING,
        }

        await prisma.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: statusMap[subscription.status] || SubscriptionStatus.ACTIVE,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : null,
          },
        })

        logger.info(
          { organizationId: dbSubscription.organizationId, status: subscription.status },
          '[Billing] Subscription updated'
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as { id: string }

        const dbSubscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (dbSubscription) {
          // Downgrade to free tier
          await prisma.subscription.update({
            where: { id: dbSubscription.id },
            data: {
              tier: PlanTier.FREE,
              status: SubscriptionStatus.CANCELED,
              stripeSubscriptionId: null,
            },
          })

          logger.info(
            { organizationId: dbSubscription.organizationId },
            '[Billing] Subscription deleted, downgraded to free'
          )
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as {
          subscription: string
          customer: string
        }

        const dbSubscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: invoice.subscription },
        })

        if (dbSubscription) {
          await prisma.subscription.update({
            where: { id: dbSubscription.id },
            data: { status: SubscriptionStatus.PAST_DUE },
          })

          logger.warn(
            { organizationId: dbSubscription.organizationId },
            '[Billing] Payment failed'
          )
        }
        break
      }

      default:
        logger.debug({ eventType: event.type }, '[Billing] Unhandled webhook event')
    }
  },
}
