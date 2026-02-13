import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rawBody from 'fastify-raw-body'

export async function setupSecurity(fastify: FastifyInstance, nodeEnv: string): Promise<void> {
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'X-CSRF-Token'],
  })

  // Raw body parsing for webhook signature verification
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: false, // Only add rawBody to routes that request it
    encoding: 'utf8',
    runFirst: true,
    routes: ['/webhooks/stripe'], // Only enable for Stripe webhooks
  })
}
