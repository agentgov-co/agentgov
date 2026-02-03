import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || `agentgov-web@1.0.0`
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: RELEASE,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',

    // Performance Monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 0,

    // Session Replay - only on errors in dev, sampled in production
    replaysSessionSampleRate: IS_PRODUCTION ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Don't send PII
    sendDefaultPii: false,
  })

  console.warn(`[Sentry] Client initialized - release: ${RELEASE}`)
}
