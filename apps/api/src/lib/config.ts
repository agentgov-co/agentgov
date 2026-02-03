/**
 * Application configuration
 * Centralizes environment-based settings for billing, plans, and features
 */

import { PlanTier } from '../generated/prisma/client.js'

// Parse boolean from environment
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

export const config = {
  /**
   * Billing configuration
   */
  billing: {
    /** Whether billing/payments are enabled (Stripe integration) */
    enabled: parseBoolean(process.env.BILLING_ENABLED, false),
  },

  /**
   * Default plan for new organizations
   * - FREE_BETA when billing is disabled (generous limits for beta users)
   * - FREE when billing is enabled (limited free tier)
   */
  get defaultPlan(): PlanTier {
    return this.billing.enabled ? PlanTier.FREE : PlanTier.FREE_BETA
  },

  /**
   * Plan limits (in-memory fallback if DB not seeded)
   * These should match the seeded PlanLimit records
   */
  planDefaults: {
    [PlanTier.FREE_BETA]: {
      tracesPerMonth: 20000,
      projectsMax: 3,
      membersMax: 5,
      retentionDays: 15,
    },
    [PlanTier.FREE]: {
      tracesPerMonth: 1000,
      projectsMax: 1,
      membersMax: 2,
      retentionDays: 7,
    },
    [PlanTier.STARTER]: {
      tracesPerMonth: 50000,
      projectsMax: 5,
      membersMax: 10,
      retentionDays: 30,
    },
    [PlanTier.PRO]: {
      tracesPerMonth: 500000,
      projectsMax: 20,
      membersMax: 50,
      retentionDays: 90,
    },
    [PlanTier.ENTERPRISE]: {
      tracesPerMonth: -1, // unlimited
      projectsMax: -1,
      membersMax: -1,
      retentionDays: 365,
    },
  },

  /**
   * Stripe configuration (only used when billing.enabled = true)
   */
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
} as const

export type Config = typeof config
