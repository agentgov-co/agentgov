import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN
const RELEASE = process.env.SENTRY_RELEASE || `agentgov-web@${process.env.npm_package_version || '1.0.0'}`

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: RELEASE,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',

    // Performance Monitoring - disabled in dev for speed
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

    // Don't send PII
    sendDefaultPii: false,
  })

  console.warn(`[Sentry] Server initialized - release: ${RELEASE}`)
}

export { Sentry }
