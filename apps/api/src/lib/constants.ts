/** Global Fastify body limit: 1MB */
export const GLOBAL_BODY_LIMIT = 1_048_576

/** SDK routes (traces, spans) body limit: 5MB */
export const SDK_BODY_LIMIT = 5_242_880

/** Health endpoint rate limit config */
export const HEALTH_RATE_LIMIT = { max: 10, timeWindow: '1 minute' as const }
