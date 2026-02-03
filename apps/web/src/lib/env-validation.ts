const REQUIRED_ENV = ['NEXT_PUBLIC_API_URL', 'BETTER_AUTH_URL'] as const

export interface EnvValidationResult {
  valid: boolean
  errors: string[]
}

/** Validate required environment variables for the web app at build/startup time. */
export function validateEnv(env: Record<string, string | undefined>): EnvValidationResult {
  const errors: string[] = []

  for (const key of REQUIRED_ENV) {
    if (!env[key]) {
      errors.push(`Missing required environment variable: ${key}`)
    }
  }

  const apiUrl = env.NEXT_PUBLIC_API_URL
  if (apiUrl && !/^https?:\/\/.+/.test(apiUrl)) {
    errors.push('NEXT_PUBLIC_API_URL must be a valid URL starting with http(s)://')
  }

  const authUrl = env.BETTER_AUTH_URL
  if (authUrl && !/^https?:\/\/.+/.test(authUrl)) {
    errors.push('BETTER_AUTH_URL must be a valid URL starting with http(s)://')
  }

  return { valid: errors.length === 0, errors }
}
