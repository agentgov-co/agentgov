import cron from 'node-cron'
import type { FastifyInstance } from 'fastify'
import { runRetentionCleanup } from '../jobs/retention-cleanup.js'
import { captureException } from '../lib/sentry.js'

export function setupCron(fastify: FastifyInstance): cron.ScheduledTask {
  // Schedule retention cleanup job (daily at 3:00 AM UTC)
  return cron.schedule('0 3 * * *', async () => {
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
}
