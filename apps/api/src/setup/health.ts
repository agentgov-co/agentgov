import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { checkRedisHealth } from '../lib/redis.js'
import { captureException } from '../lib/sentry.js'
import { HEALTH_RATE_LIMIT } from '../lib/constants.js'

interface HealthCheckResult {
  status: 'ok' | 'error' | 'disabled'
  latencyMs: number
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy'
  checks: {
    database: HealthCheckResult
    redis: HealthCheckResult
    memory: {
      usedMB: number
      totalMB: number
      percentage: number
    }
  }
  wsConnections: number
  uptime: number
  timestamp: string
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch {
    return { status: 'error', latencyMs: Date.now() - start }
  }
}

export function setupHealth(fastify: FastifyInstance, serverStartTime: number): void {
  // Comprehensive health check
  fastify.get('/health', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async (_request, reply): Promise<HealthResponse> => {
    const [dbCheck, redisCheck] = await Promise.all([
      checkDatabase(),
      checkRedisHealth(),
    ])

    const memoryUsage = process.memoryUsage()
    const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
    const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)

    // Redis is a cache — its failure should NOT make the service unhealthy.
    // Only DB down → unhealthy (503). Redis down → degraded (200).
    const dbOk = dbCheck.status === 'ok'
    const redisOk = redisCheck.status === 'ok' || redisCheck.status === 'disabled'
    const status: HealthResponse['status'] = !dbOk ? 'unhealthy' : !redisOk ? 'degraded' : 'ok'

    if (status === 'unhealthy') {
      reply.status(503)
    }

    return {
      status,
      checks: {
        database: dbCheck,
        redis: redisCheck,
        memory: {
          usedMB,
          totalMB,
          percentage: Math.round((usedMB / totalMB) * 100)
        }
      },
      wsConnections: fastify.wsManager.getClientCount(),
      uptime: Math.round((Date.now() - serverStartTime) / 1000),
      timestamp: new Date().toISOString()
    }
  })

  // Liveness probe - always returns 200 if server is running
  fastify.get('/health/live', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async () => {
    return { status: 'ok' }
  })

  // Test endpoint to verify Sentry integration (dev only)
  if (process.env.NODE_ENV !== 'production') {
    fastify.get('/test-error', async () => {
      throw new Error('Sentry test error from AgentGov API')
    })
  }

  // Client error reporting endpoint (for Turbopack workaround)
  fastify.post('/report-error', async (request) => {
    const { message, stack, url, userAgent } = request.body as {
      message: string
      stack?: string
      url?: string
      userAgent?: string
    }

    const error = new Error(message)
    if (stack) error.stack = stack

    captureException(error, {
      source: 'web-client',
      url,
      userAgent,
    })

    return { success: true }
  })

  // Readiness probe - returns 200 only if all dependencies are healthy
  fastify.get('/health/ready', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async (request, reply) => {
    const dbCheck = await checkDatabase()

    if (dbCheck.status !== 'ok') {
      reply.status(503)
      return {
        status: 'not_ready',
        checks: { database: dbCheck }
      }
    }

    return {
      status: 'ready',
      checks: { database: dbCheck }
    }
  })
}
