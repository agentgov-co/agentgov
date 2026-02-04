import type { FastifyInstance } from 'fastify'
import { register, recordHttpRequest, setWsConnectionCount } from '../lib/metrics.js'
import { HEALTH_RATE_LIMIT } from '../lib/constants.js'

export function setupMonitoring(fastify: FastifyInstance): void {
  // Metrics endpoint
  fastify.get('/metrics', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async (request, reply) => {
    reply.header('Content-Type', register.contentType)
    return register.metrics()
  })

  // Request metrics hook
  fastify.addHook('onResponse', (request, reply, done) => {
    // Skip metrics for health and metrics endpoints to avoid noise
    const skipPaths = ['/health', '/health/live', '/health/ready', '/metrics']
    if (!skipPaths.some((p) => request.url.startsWith(p))) {
      recordHttpRequest(
        request.method,
        request.url,
        reply.statusCode,
        reply.elapsedTime
      )
    }

    // Update WebSocket connection count
    setWsConnectionCount(fastify.wsManager.getClientCount())

    done()
  })
}
