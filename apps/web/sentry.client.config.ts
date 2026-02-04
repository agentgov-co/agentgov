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

    // Session Replay — rates are set here, integration is lazy-loaded below
    replaysSessionSampleRate: IS_PRODUCTION ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Don't send PII
    sendDefaultPii: false,
  })

  // Lazy load replay integration from Sentry CDN to avoid ~70KB in initial bundle.
  // lazyLoadIntegration() loads the integration asynchronously from CDN,
  // which may fail if user has an ad-blocker or network issue — handled gracefully.
  Sentry.lazyLoadIntegration('replayIntegration').then((replayIntegration) => {
    Sentry.addIntegration(replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }))
  }).catch(() => {
    // Silently fail — replay is non-critical.
    // Common cause: ad-blockers blocking Sentry CDN requests.
  })

  console.warn(`[Sentry] Client initialized - release: ${RELEASE}`)
}
