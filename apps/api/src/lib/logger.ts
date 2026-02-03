import pino from 'pino'

// Pino redact paths — used by Fastify logger in index.ts
export const LOGGER_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
]

// Create a pino logger instance for use outside of Fastify routes
// This ensures consistent logging throughout the application
export const logger = pino({
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  } : undefined,
  level: process.env.LOG_LEVEL || 'info',
})

// Sanitize sensitive data from log output
export function sanitizeForLog(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sensitiveKeys = ['password', 'apikey', 'secret', 'token', 'authorization', 'cookie', 'resettoken', 'newpassword', 'confirmpassword']
  const sanitized = { ...data } as Record<string, unknown>

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLog(sanitized[key])
    }
  }

  return sanitized
}
