import Stripe from 'stripe'
import { config } from './config.js'

/**
 * Stripe client instance
 * Only initialized when billing is enabled
 */
let stripeClient: Stripe | null = null

/**
 * Get the Stripe client instance
 * Throws if billing is disabled or not configured
 */
export function getStripe(): Stripe {
  if (!config.billing.enabled) {
    throw new Error('Billing is not enabled. Set BILLING_ENABLED=true')
  }

  if (!config.stripe.secretKey) {
    throw new Error('Stripe secret key not configured. Set STRIPE_SECRET_KEY')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(config.stripe.secretKey)
  }

  return stripeClient
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return config.billing.enabled && !!config.stripe.secretKey
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!config.stripe.webhookSecret) {
    throw new Error('Stripe webhook secret not configured. Set STRIPE_WEBHOOK_SECRET')
  }

  const stripe = getStripe()
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripe.webhookSecret
  )
}

// Re-export Stripe types for convenience
export type { Stripe }
