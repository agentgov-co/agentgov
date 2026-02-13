import type { FastifyInstance } from 'fastify'
import { captureException } from '../lib/sentry.js'
import { sanitizeErrorMessage } from '../lib/error-sanitize.js'

export function setupErrorHandler(fastify: FastifyInstance): void {
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
}
