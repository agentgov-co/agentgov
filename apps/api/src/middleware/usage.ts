import { FastifyRequest, FastifyReply } from 'fastify'
import { usageService } from '../services/usage.service.js'
import { logger } from '../lib/logger.js'

/**
 * Get organization ID from request context
 * Works with both API key and session auth
 */
function getOrgId(request: FastifyRequest): string | null {
  // API key auth - use apiKey.organizationId or project.organizationId
  if (request.apiKey?.organizationId) {
    return request.apiKey.organizationId
  }

  if (request.project?.organizationId) {
    return request.project.organizationId
  }

  // Session auth
  if (request.organization?.id) {
    return request.organization.id
  }

  return null
}

/**
 * Check trace limit before creating traces
 * Returns 402 Payment Required if limit exceeded
 *
 * On error: Allows request (fail-open) and logs the error
 */
export async function checkTraceLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const orgId = getOrgId(request)

  if (!orgId) {
    // No org context - skip limit check (other auth middleware will handle)
    return
  }

  try {
    const result = await usageService.canPerformAction(orgId, 'create_trace')

    if (!result.allowed) {
      return reply.status(402).send({
        error: 'Payment Required',
        code: 'TRACE_LIMIT_EXCEEDED',
        message: result.reason,
      })
    }
  } catch (error) {
    // Fail-open: don't block user requests if usage check fails
    logger.error(
      { err: error, orgId, action: 'create_trace' },
      '[Usage] Failed to check trace limit, allowing request'
    )
  }
}

/**
 * Check project limit before creating projects
 * Returns 402 Payment Required if limit exceeded
 *
 * On error: Allows request (fail-open) and logs the error
 */
export async function checkProjectLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const orgId = getOrgId(request)

  if (!orgId) {
    return
  }

  try {
    const result = await usageService.canPerformAction(orgId, 'create_project')

    if (!result.allowed) {
      return reply.status(402).send({
        error: 'Payment Required',
        code: 'PROJECT_LIMIT_EXCEEDED',
        message: result.reason,
      })
    }
  } catch (error) {
    logger.error(
      { err: error, orgId, action: 'create_project' },
      '[Usage] Failed to check project limit, allowing request'
    )
  }
}

/**
 * Check member limit before inviting members
 * Returns 402 Payment Required if limit exceeded
 *
 * On error: Allows request (fail-open) and logs the error
 */
export async function checkMemberLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const orgId = getOrgId(request)

  if (!orgId) {
    return
  }

  try {
    const result = await usageService.canPerformAction(orgId, 'add_member')

    if (!result.allowed) {
      return reply.status(402).send({
        error: 'Payment Required',
        code: 'MEMBER_LIMIT_EXCEEDED',
        message: result.reason,
      })
    }
  } catch (error) {
    logger.error(
      { err: error, orgId, action: 'add_member' },
      '[Usage] Failed to check member limit, allowing request'
    )
  }
}
