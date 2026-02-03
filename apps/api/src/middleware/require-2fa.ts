import type { FastifyRequest, FastifyReply } from 'fastify'
import { logger } from '../lib/logger.js'

const PRIVILEGED_ROLES = ['OWNER', 'ADMIN'] as const

/**
 * Middleware that enforces 2FA for users with OWNER or ADMIN roles.
 * Returns 403 with code 2FA_REQUIRED if the user has a privileged role
 * but has not enabled two-factor authentication.
 *
 * Skips enforcement when:
 * - No authenticated user (handled by other middleware)
 * - No organization context (role unknown)
 * - User role is MEMBER (not privileged)
 */
export async function require2FAForPrivilegedRoles(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip if no user or no organization context
  if (!request.user || !request.organization) {
    return
  }

  const role = request.organization.role
  if (!PRIVILEGED_ROLES.includes(role as typeof PRIVILEGED_ROLES[number])) {
    return
  }

  if (!request.user.twoFactorEnabled) {
    logger.warn(
      { userId: request.user.id, role },
      '[2FA] Privileged user without 2FA attempted access'
    )

    return reply.status(403).send({
      error: 'Forbidden',
      code: '2FA_REQUIRED',
      message: 'Two-factor authentication is required for users with OWNER or ADMIN roles. Please enable 2FA in your account settings.',
    })
  }
}
