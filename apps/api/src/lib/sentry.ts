import * as Sentry from '@sentry/node'

let isInitialized = false

/**
 * Initialize Sentry for error tracking
 * Only initializes if SENTRY_DSN is set
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN
  const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
  const release = process.env.SENTRY_RELEASE || `agentgov-api@${process.env.npm_package_version || '1.0.0'}`

  if (!dsn) {
    console.warn('Sentry DSN not configured, skipping initialization')
    return
  }

  Sentry.init({
    dsn,
    release,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 0,
    profilesSampleRate: environment === 'production' ? 0.1 : 0,

    // Session Tracking (Release Health)
    autoSessionTracking: true,

    integrations: [
      // Add Node-specific integrations
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    // Don't send PII
    sendDefaultPii: false,
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['x-api-key']
        delete event.request.headers['cookie']
      }
      return event
    },
  })

  isInitialized = true
  console.warn(`Sentry initialized - release: ${release}, environment: ${environment}`)
}

/**
 * Capture an exception and send to Sentry
 */
export function captureException(error: Error, context?: Record<string, unknown>): string {
  if (!isInitialized) {
    console.error('Sentry not configured, error not captured:', error)
    return ''
  }

  return Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Capture a message and send to Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string {
  if (!isInitialized) {
    console.warn('Sentry not configured, message not captured:', message)
    return ''
  }

  return Sentry.captureMessage(message, level)
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: string; email?: string } | null): void {
  Sentry.setUser(user)
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(breadcrumb: {
  category: string
  message: string
  level?: Sentry.SeverityLevel
  data?: Record<string, unknown>
}): void {
  Sentry.addBreadcrumb(breadcrumb)
}

/**
 * Start a transaction span for performance monitoring
 */
export function startSpan<T>(
  name: string,
  operation: string,
  callback: () => T
): T {
  return Sentry.startSpan({ name, op: operation }, callback)
}

/**
 * Flush Sentry events before shutdown
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  return Sentry.flush(timeout)
}

export { Sentry }
