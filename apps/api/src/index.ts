import 'dotenv/config'
import { validateEnv } from './lib/env-validation.js'

// Validate required environment variables before any initialization
const envResult = validateEnv(process.env as Record<string, string | undefined>)
if (!envResult.valid) {
  console.error(envResult.error)
  process.exit(1)
}

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import rawBody from 'fastify-raw-body'
import cron from 'node-cron'
import { createHash } from 'crypto'
import authPlugin from './plugins/auth.js'
import websocketPlugin from './plugins/websocket.js'
import { registerRoutes } from './routes/index.js'
import { prisma, closePool } from './lib/prisma.js'
import { register, recordHttpRequest, setWsConnectionCount } from './lib/metrics.js'
import { LOGGER_REDACT_PATHS } from './lib/logger.js'
import { GLOBAL_BODY_LIMIT, HEALTH_RATE_LIMIT } from './lib/constants.js'
import { checkRedisHealth, closeRedis, getRedisClient } from './lib/redis.js'
import { initSentry, captureException, flushSentry } from './lib/sentry.js'
import { sanitizeErrorMessage } from './lib/error-sanitize.js'
import { runRetentionCleanup } from './jobs/retention-cleanup.js'

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

// Security headers with helmet
await fastify.register(helmet, {
  contentSecurityPolicy: nodeEnv === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  } : false, // Disable CSP in development for easier debugging
  crossOriginEmbedderPolicy: false, // Required for WebSocket
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for API
})

// CORS - restrict in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:3001']

await fastify.register(cors, {
  origin: nodeEnv === 'production' ? allowedOrigins : allowedOrigins, // Always validate origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
})

// Raw body parsing for webhook signature verification
await fastify.register(rawBody, {
  field: 'rawBody',
  global: false, // Only add rawBody to routes that request it
  encoding: 'utf8',
  runFirst: true,
  routes: ['/webhooks/stripe'], // Only enable for Stripe webhooks
})

// OpenAPI/Swagger documentation
await fastify.register(swagger, {
  openapi: {
    openapi: '3.1.0',
    info: {
      title: 'AgentGov API',
      description: 'AI Agent Governance Platform API - Monitor, trace, and govern AI agents with security and compliance in mind.',
      version: '1.0.1',
      contact: {
        name: 'AgentGov Team',
        url: 'https://agentgov.io'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: nodeEnv === 'production' ? 'Production server' : 'Development server'
      }
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Traces', description: 'Trace management for AI agent executions' },
      { name: 'Spans', description: 'Span management for individual operations' },
      { name: 'API Keys', description: 'API key management' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'API key authentication. Use your project API key.'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'Session cookie authentication for dashboard'
        }
      }
    }
  }
})

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    persistAuthorization: true
  },
  staticCSP: true
})

// Rate limiting with Redis store for distributed systems
const redis = getRedisClient()
await fastify.register(rateLimit, {
  max: 100, // 100 requests per minute
  timeWindow: '1 minute',
  // Use Redis for distributed rate limiting if available
  redis: redis || undefined,
  keyGenerator: (request) => {
    // Use hashed API key prefix if present, otherwise IP
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      // Hash the API key to prevent timing attacks and log exposure
      const apiKey = authHeader.slice(7)
      const hash = createHash('sha256').update(apiKey).digest('hex')
      return hash.slice(0, 16) // Use first 16 chars of hash as rate limit key
    }
    const xApiKey = request.headers['x-api-key']
    if (typeof xApiKey === 'string') {
      const hash = createHash('sha256').update(xApiKey).digest('hex')
      return hash.slice(0, 16)
    }
    return request.ip
  },
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please retry after some time.'
  })
})

// Auth plugin (Better Auth)
await fastify.register(authPlugin)

// WebSocket plugin
await fastify.register(websocketPlugin)

// Server start time for uptime calculation
const serverStartTime = Date.now()

// Health check types
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

// Helper to check database health
async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch {
    return { status: 'error', latencyMs: Date.now() - start }
  }
}

// Comprehensive health check
fastify.get('/health', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async (): Promise<HealthResponse> => {
  const [dbCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedisHealth(),
  ])

  const memoryUsage = process.memoryUsage()
  const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
  const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)

  // Redis being disabled is OK, but error is degraded
  const allChecksOk = dbCheck.status === 'ok' &&
    (redisCheck.status === 'ok' || redisCheck.status === 'disabled')

  return {
    status: allChecksOk ? 'ok' : 'degraded',
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

// Test endpoint to verify Sentry integration
fastify.get('/test-error', async () => {
  throw new Error('Sentry test error from AgentGov API')
})

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

// Error handler to capture exceptions with Sentry
fastify.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
  // Capture error with Sentry (full details for debugging)
  captureException(error, {
    url: request.url,
    method: request.method,
    headers: {
      'user-agent': request.headers['user-agent'],
      'x-request-id': request.headers['x-request-id'],
    },
  })

  // Log error
  fastify.log.error(error)

  // Send sanitized error response
  const statusCode = error.statusCode || 500
  reply.status(statusCode).send({
    error: error.name || 'Internal Server Error',
    message: sanitizeErrorMessage(error.message, statusCode),
    statusCode,
  })
})

// Register API routes
await registerRoutes(fastify)

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

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach(signal => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down...`)
    retentionJob.stop()
    await fastify.close()
    await flushSentry()
    await closeRedis()
    await prisma.$disconnect()
    await closePool()
    process.exit(0)
  })
})

// Start server
const port = parseInt(process.env.API_PORT || '3001', 10)
const host = '0.0.0.0'

try {
  await fastify.listen({ port, host })
  fastify.log.info(`API running on http://localhost:${port}`)
  fastify.log.info(`WebSocket available at ws://localhost:${port}/ws`)
} catch (err) {
  fastify.log.error(err as Error)
  await prisma.$disconnect()
  process.exit(1)
}
