import 'dotenv/config'
import { validateEnv } from './lib/env-validation.js'

// Validate required environment variables before any initialization
const envResult = validateEnv(process.env as Record<string, string | undefined>)
if (!envResult.valid) {
  console.error(envResult.error)
  process.exit(1)
}

import Fastify from 'fastify'
import authPlugin from './plugins/auth.js'
import csrfPlugin from './plugins/csrf.js'
import websocketPlugin from './plugins/websocket.js'
import { registerRoutes } from './routes/index.js'
import { prisma } from './lib/prisma.js'
import { LOGGER_REDACT_PATHS } from './lib/logger.js'
import { GLOBAL_BODY_LIMIT } from './lib/constants.js'
import { initSentry } from './lib/sentry.js'
import { setupSecurity } from './setup/security.js'
import { setupSwagger } from './setup/swagger.js'
import { setupRateLimit } from './setup/rate-limit.js'
import { setupMonitoring } from './setup/monitoring.js'
import { setupErrorHandler } from './setup/error-handler.js'
import { setupHealth } from './setup/health.js'
import { setupCron } from './setup/cron.js'
import { setupShutdown } from './setup/shutdown.js'

// Initialize Sentry for error tracking
initSentry()

const fastify = Fastify({
  bodyLimit: GLOBAL_BODY_LIMIT,
  logger: {
    redact: LOGGER_REDACT_PATHS,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
})

// Validate NODE_ENV
const nodeEnv = ['production', 'development', 'test'].includes(process.env.NODE_ENV || '')
  ? process.env.NODE_ENV
  : 'development'

// Setup plugins and middleware
await setupSecurity(fastify, nodeEnv!)
await setupSwagger(fastify, nodeEnv!)
await setupRateLimit(fastify)

// Auth plugin (Better Auth)
await fastify.register(authPlugin)

// CSRF protection for session-authenticated mutating requests
await fastify.register(csrfPlugin)

// 2FA enforcement for privileged roles (owner/admin)
// Disabled: Now showing warning banner on frontend instead of blocking
// Users can still access the app but will see a warning to enable 2FA

// WebSocket plugin
await fastify.register(websocketPlugin)

// Server start time for uptime calculation
const serverStartTime = Date.now()

// Setup routes and handlers
setupHealth(fastify, serverStartTime)
setupMonitoring(fastify)
setupErrorHandler(fastify)

// Register API routes
await registerRoutes(fastify)

// Cron jobs and graceful shutdown
const cronJobs = setupCron(fastify)
setupShutdown(fastify, cronJobs)

// Start server
const port = parseInt(process.env.PORT || process.env.API_PORT || '3001', 10)
const host = '::'

try {
  await fastify.listen({ port, host })
  fastify.log.info(`API running on http://localhost:${port}`)
  fastify.log.info(`WebSocket available at ws://localhost:${port}/ws`)
} catch (err) {
  fastify.log.error(err as Error)
  await prisma.$disconnect()
  process.exit(1)
}
