import type { FastifyInstance } from 'fastify'

/**
 * Public endpoint to get available authentication methods
 * This allows the frontend to conditionally show OAuth buttons
 */
export async function authConfigRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/auth/config', async () => {
    return {
      providers: {
        google: !!process.env.GOOGLE_CLIENT_ID,
        github: !!process.env.GITHUB_CLIENT_ID,
      },
      features: {
        emailPassword: true,
        twoFactor: true,
        organizations: true,
      },
    }
  })
}
