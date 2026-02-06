import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { wsManager } from '../lib/websocket-manager.js'
import { cacheDeletePattern, CACHE_KEYS } from '../lib/redis.js'

export const STALE_TRACE_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour
const BATCH_SIZE = 500

/**
 * Auto-close traces stuck in RUNNING status.
 * If a trace's updatedAt is older than STALE_TRACE_TIMEOUT_MS, it is
 * assumed the SDK crashed without calling endTrace() and gets marked FAILED.
 *
 * Runs every 5 minutes via cron.
 */
export async function runStaleTracesCleanup(): Promise<void> {
  logger.info('[StaleTraces] Starting cleanup job')

  try {
    const cutoff = new Date(Date.now() - STALE_TRACE_TIMEOUT_MS)
    let totalClosed = 0
    let hasMore = true

    while (hasMore) {
      // Find stale traces in batches
      const staleTraces = await prisma.trace.findMany({
        where: {
          status: 'RUNNING',
          updatedAt: { lt: cutoff },
        },
        select: { id: true, projectId: true },
        take: BATCH_SIZE,
      })

      if (staleTraces.length === 0) {
        hasMore = false
        continue
      }

      const traceIds = staleTraces.map(t => t.id)
      const now = new Date()

      // Batch update to FAILED
      await prisma.trace.updateMany({
        where: { id: { in: traceIds } },
        data: { status: 'FAILED', endedAt: now },
      })

      totalClosed += staleTraces.length

      // Send WebSocket notifications per trace
      const endTimeIso = now.toISOString()
      for (const trace of staleTraces) {
        wsManager.notifyTraceUpdated({
          id: trace.id,
          projectId: trace.projectId,
          status: 'FAILED',
          endTime: endTimeIso,
        })
      }

      // Invalidate Redis cache for affected projects
      const uniqueProjectIds = [...new Set(staleTraces.map(t => t.projectId))]
      for (const projectId of uniqueProjectIds) {
        await cacheDeletePattern(`${CACHE_KEYS.TRACES_LIST}${projectId}:*`)
      }

      // If we got less than BATCH_SIZE, we're done
      if (staleTraces.length < BATCH_SIZE) {
        hasMore = false
      }
    }

    logger.info({ totalClosed }, '[StaleTraces] Cleanup job completed')
  } catch (error) {
    logger.error({ err: error }, '[StaleTraces] Cleanup job failed')
    throw error
  }
}
