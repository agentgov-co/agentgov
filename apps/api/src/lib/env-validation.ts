const REQUIRED_ENV = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'REDIS_URL'] as const

export interface EnvValidationResult {
  valid: boolean
  error?: string
}

/** Validate required environment variables. Used by index.ts at startup. */
export function validateEnv(env: Record<string, string | undefined>): EnvValidationResult {
  for (const key of REQUIRED_ENV) {
    if (!env[key]) {
      return { valid: false, error: `Missing required environment variable: ${key}` }
    }
  }
  if ((env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
    return { valid: false, error: 'BETTER_AUTH_SECRET must be at least 32 characters' }
  }
  return { valid: true }
}
