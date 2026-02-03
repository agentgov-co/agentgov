import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',

    // Performance Monitoring - disabled in dev for speed
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  })
}

export { Sentry }
