import { validateEnv } from './src/lib/env-validation'

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const result = validateEnv(process.env as Record<string, string | undefined>)
    if (!result.valid) {
      const message = `[agentgov] Environment validation failed:\n${result.errors.map(e => `  - ${e}`).join('\n')}`
      if (process.env.NODE_ENV === 'production') {
        throw new Error(message)
      }
      console.warn(message)
    }

    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
