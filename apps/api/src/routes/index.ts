import { FastifyInstance } from 'fastify'
import { projectRoutes } from './projects.js'
import { traceRoutes } from './traces.js'
import { spanRoutes } from './spans.js'
import { apiKeyRoutes } from './api-keys.js'
import { usageRoutes } from './usage.js'
import { billingRoutes } from './billing.js'
import { webhookRoutes } from './webhooks.js'
import { complianceRoutes } from './compliance.js'
import { feedbackRoutes } from './feedback.js'

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // API v1 routes
  await fastify.register(projectRoutes, { prefix: '/v1/projects' })
  await fastify.register(traceRoutes, { prefix: '/v1/traces' })
  await fastify.register(spanRoutes, { prefix: '/v1/spans' })
  await fastify.register(apiKeyRoutes, { prefix: '/v1/api-keys' })
  await fastify.register(usageRoutes, { prefix: '/v1/usage' })
  await fastify.register(billingRoutes, { prefix: '/v1/billing' })
  await fastify.register(complianceRoutes, { prefix: '/v1/compliance' })
  await fastify.register(feedbackRoutes, { prefix: '/v1/feedback' })

  // Webhook routes (no /v1 prefix)
  await fastify.register(webhookRoutes, { prefix: '/webhooks' })
}
