import cron from 'node-cron'
import type { FastifyInstance } from 'fastify'
import { runRetentionCleanup } from '../jobs/retention-cleanup.js'
import { runStaleTracesCleanup } from '../jobs/stale-traces-cleanup.js'
import { captureException } from '../lib/sentry.js'

export function setupCron(fastify: FastifyInstance): cron.ScheduledTask[] {
  // Schedule retention cleanup job (daily at 3:00 AM UTC)
  const retentionJob = cron.schedule('0 3 * * *', async () => {
    fastify.log.info('Running scheduled retention cleanup')
    try {
      await runRetentionCleanup()
    } catch (error) {
      fastify.log.error(error as Error, 'Retention cleanup failed')
      captureException(error as Error, { job: 'retention-cleanup' })
    }
  }, {
    timezone: 'UTC',
  })

  // Schedule stale traces cleanup (every 5 minutes)
  const staleTracesJob = cron.schedule('*/5 * * * *', async () => {
    fastify.log.info('Running scheduled stale traces cleanup')
    try {
      await runStaleTracesCleanup()
    } catch (error) {
      fastify.log.error(error as Error, 'Stale traces cleanup failed')
      captureException(error as Error, { job: 'stale-traces-cleanup' })
    }
  })

  return [retentionJob, staleTracesJob]
}
