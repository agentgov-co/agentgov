import { PlanTier, SubscriptionStatus } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { config } from '../lib/config.js'
import { logger } from '../lib/logger.js'

export type UsageAction = 'create_trace' | 'create_project' | 'add_member'

export interface UsageWithLimits {
  // Current usage
  tracesCount: number
  projectsCount: number
  membersCount: number

  // Limits from plan
  tracesLimit: number
  projectsLimit: number
  membersLimit: number
  retentionDays: number

  // Plan info
  tier: PlanTier
  status: SubscriptionStatus
  billingEnabled: boolean

  // Period
  periodStart: string
  periodEnd: string

  // Percentages
  tracesPercentage: number
  projectsPercentage: number
  membersPercentage: number
}

/**
 * Get the start of the current billing period (first day of month, UTC)
 */
function getPeriodStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

/**
 * Get the end of the current billing period (first day of next month, UTC)
 */
function getPeriodEnd(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
}

/** Default limits used when no plan is configured (fail-safe) */
const FALLBACK_LIMITS = {
  tracesPerMonth: 1000,
  projectsMax: 1,
  membersMax: 2,
  retentionDays: 7,
} as const

/**
 * Get plan limits for a tier from DB or fallback to config defaults
 * Always returns valid limits - never throws
 */
async function getPlanLimits(tier: PlanTier): Promise<{
  tracesPerMonth: number
  projectsMax: number
  membersMax: number
  retentionDays: number
}> {
  try {
    // Try to get from database first
    const dbLimits = await prisma.planLimit.findUnique({
      where: { tier },
    })

    if (dbLimits) {
      return {
        tracesPerMonth: dbLimits.tracesPerMonth,
        projectsMax: dbLimits.projectsMax,
        membersMax: dbLimits.membersMax,
        retentionDays: dbLimits.retentionDays,
      }
    }

    // Fallback to config defaults
    const configLimits = config.planDefaults[tier]
    if (configLimits) {
      return configLimits
    }

    // Ultimate fallback - log warning and use safe defaults
    logger.warn({ tier }, '[Usage] No limits found for tier, using fallback defaults')
    return FALLBACK_LIMITS
  } catch (error) {
    // Database error - use fallback to not break the system
    logger.error({ err: error, tier }, '[Usage] Failed to fetch plan limits, using fallback')
    return FALLBACK_LIMITS
  }
}

/**
 * Usage tracking and limits enforcement service
 */
export const usageService = {
  /**
   * Ensure organization has a subscription record
   * Called when organization is created or on first usage check
   */
  async ensureSubscription(orgId: string): Promise<void> {
    const existing = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
    })

    if (!existing) {
      await prisma.subscription.create({
        data: {
          organizationId: orgId,
          tier: config.defaultPlan,
          status: SubscriptionStatus.ACTIVE,
        },
      })
      logger.info({ orgId }, '[Usage] Created subscription for organization')
    }
  },

  /**
   * Get or create the current month's usage record for an organization
   */
  async getCurrentUsage(orgId: string) {
    const periodStart = getPeriodStart()
    const periodEnd = getPeriodEnd()

    // Upsert usage record for current period
    return prisma.usageRecord.upsert({
      where: {
        organizationId_periodStart: {
          organizationId: orgId,
          periodStart,
        },
      },
      create: {
        organizationId: orgId,
        periodStart,
        periodEnd,
        tracesCount: 0,
      },
      update: {},
    })
  },

  /**
   * Increment trace count for organization (non-blocking)
   * Returns immediately, updates happen in background
   */
  async incrementTraces(orgId: string, count: number = 1): Promise<void> {
    const periodStart = getPeriodStart()
    const periodEnd = getPeriodEnd()

    try {
      await prisma.usageRecord.upsert({
        where: {
          organizationId_periodStart: {
            organizationId: orgId,
            periodStart,
          },
        },
        create: {
          organizationId: orgId,
          periodStart,
          periodEnd,
          tracesCount: count,
        },
        update: {
          tracesCount: {
            increment: count,
          },
        },
      })
    } catch (error) {
      // Don't fail trace creation if usage tracking fails
      logger.error({ err: error, orgId, count }, '[Usage] Failed to increment traces')
    }
  },

  /**
   * Get full usage data with limits for dashboard display
   */
  async getUsageWithLimits(orgId: string): Promise<UsageWithLimits> {
    // Ensure subscription exists
    await this.ensureSubscription(orgId)

    const [subscription, usageRecord, projectsCount, membersCount] = await Promise.all([
      prisma.subscription.findUnique({
        where: { organizationId: orgId },
      }),
      this.getCurrentUsage(orgId),
      prisma.project.count({
        where: { organizationId: orgId },
      }),
      prisma.member.count({
        where: { organizationId: orgId },
      }),
    ])

    const tier = subscription?.tier ?? config.defaultPlan
    const status = subscription?.status ?? SubscriptionStatus.ACTIVE
    const limits = await getPlanLimits(tier)

    // Calculate percentages (-1 means unlimited)
    const tracesPercentage = limits.tracesPerMonth === -1
      ? 0
      : Math.round((usageRecord.tracesCount / limits.tracesPerMonth) * 100)

    const projectsPercentage = limits.projectsMax === -1
      ? 0
      : Math.round((projectsCount / limits.projectsMax) * 100)

    const membersPercentage = limits.membersMax === -1
      ? 0
      : Math.round((membersCount / limits.membersMax) * 100)

    return {
      tracesCount: usageRecord.tracesCount,
      projectsCount,
      membersCount,

      tracesLimit: limits.tracesPerMonth,
      projectsLimit: limits.projectsMax,
      membersLimit: limits.membersMax,
      retentionDays: limits.retentionDays,

      tier,
      status,
      billingEnabled: config.billing.enabled,

      periodStart: usageRecord.periodStart.toISOString(),
      periodEnd: usageRecord.periodEnd.toISOString(),

      tracesPercentage,
      projectsPercentage,
      membersPercentage,
    }
  },

  /**
   * Check if organization can perform a specific action
   * Returns { allowed: boolean, reason?: string }
   */
  async canPerformAction(
    orgId: string,
    action: UsageAction
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Ensure subscription exists
    await this.ensureSubscription(orgId)

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
    })

    const tier = subscription?.tier ?? config.defaultPlan
    const limits = await getPlanLimits(tier)

    switch (action) {
      case 'create_trace': {
        // -1 means unlimited
        if (limits.tracesPerMonth === -1) {
          return { allowed: true }
        }
        const usage = await this.getCurrentUsage(orgId)
        if (usage.tracesCount >= limits.tracesPerMonth) {
          return {
            allowed: false,
            reason: `Monthly trace limit reached (${limits.tracesPerMonth.toLocaleString()} traces). Upgrade your plan for more.`,
          }
        }
        return { allowed: true }
      }

      case 'create_project': {
        if (limits.projectsMax === -1) {
          return { allowed: true }
        }
        const projectsCount = await prisma.project.count({
          where: { organizationId: orgId },
        })
        if (projectsCount >= limits.projectsMax) {
          return {
            allowed: false,
            reason: `Project limit reached (${limits.projectsMax} projects). Upgrade your plan to create more.`,
          }
        }
        return { allowed: true }
      }

      case 'add_member': {
        if (limits.membersMax === -1) {
          return { allowed: true }
        }
        const membersCount = await prisma.member.count({
          where: { organizationId: orgId },
        })
        if (membersCount >= limits.membersMax) {
          return {
            allowed: false,
            reason: `Team member limit reached (${limits.membersMax} members). Upgrade your plan to invite more.`,
          }
        }
        return { allowed: true }
      }

      default:
        return { allowed: true }
    }
  },

  /**
   * Get retention days for an organization
   */
  async getRetentionDays(orgId: string): Promise<number> {
    await this.ensureSubscription(orgId)

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
    })

    const tier = subscription?.tier ?? config.defaultPlan
    const limits = await getPlanLimits(tier)
    return limits.retentionDays
  },
}
