import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'

const BATCH_SIZE = 1000

/**
 * Clean up old traces based on organization retention settings
 * Runs as a scheduled job (daily at 3:00 AM UTC)
 */
export async function runRetentionCleanup(): Promise<void> {
  logger.info('[Retention] Starting cleanup job')

  try {
    // Get all organizations with their subscriptions
    const organizations = await prisma.organization.findMany({
      include: {
        subscription: true,
        projects: {
          select: { id: true },
        },
      },
    })

    let totalDeleted = 0

    for (const org of organizations) {
      if (org.projects.length === 0) continue

      // Get retention days for this organization
      const tier = org.subscription?.tier ?? 'FREE_BETA'

      // Get limits from DB
      const planLimit = await prisma.planLimit.findUnique({
        where: { tier },
      })

      const retentionDays = planLimit?.retentionDays ?? 15 // Default to FREE_BETA

      // Calculate cutoff date
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const projectIds = org.projects.map(p => p.id)

      // Delete in batches
      let deletedInOrg = 0
      let hasMore = true

      while (hasMore) {
        // Find traces to delete (batch at a time)
        const tracesToDelete = await prisma.trace.findMany({
          where: {
            projectId: { in: projectIds },
            createdAt: { lt: cutoffDate },
          },
          select: { id: true },
          take: BATCH_SIZE,
        })

        if (tracesToDelete.length === 0) {
          hasMore = false
          continue
        }

        const traceIds = tracesToDelete.map(t => t.id)

        // Delete spans first (cascade should handle this, but explicit is safer)
        await prisma.span.deleteMany({
          where: { traceId: { in: traceIds } },
        })

        // Delete traces
        const result = await prisma.trace.deleteMany({
          where: { id: { in: traceIds } },
        })

        deletedInOrg += result.count

        // If we got less than BATCH_SIZE, we're done
        if (tracesToDelete.length < BATCH_SIZE) {
          hasMore = false
        }
      }

      if (deletedInOrg > 0) {
        logger.info(
          { orgId: org.id, orgName: org.name, deletedCount: deletedInOrg, retentionDays },
          '[Retention] Cleaned up old traces for organization'
        )
        totalDeleted += deletedInOrg
      }
    }

    logger.info({ totalDeleted }, '[Retention] Cleanup job completed')
  } catch (error) {
    logger.error({ err: error }, '[Retention] Cleanup job failed')
    throw error
  }
}
