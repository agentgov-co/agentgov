import type { FastifyInstance } from 'fastify'
import type { ScheduledTask } from 'node-cron'
import { flushSentry } from '../lib/sentry.js'
import { closeRedis } from '../lib/redis.js'
import { prisma, closePool } from '../lib/prisma.js'

export function setupShutdown(fastify: FastifyInstance, cronJobs: ScheduledTask[]): void {
  const signals = ['SIGINT', 'SIGTERM']
  signals.forEach(signal => {
    process.on(signal, async () => {
      fastify.log.info(`Received ${signal}, shutting down...`)
      for (const job of cronJobs) {
        job.stop()
      }
      await fastify.close()
      await flushSentry()
      await closeRedis()
      await prisma.$disconnect()
      await closePool()
      process.exit(0)
    })
  })
}
