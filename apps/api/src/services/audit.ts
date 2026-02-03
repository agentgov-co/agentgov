import { prisma } from '../lib/prisma.js'
import { Prisma } from '../generated/prisma/client.js'
import { logger } from '../lib/logger.js'

export type AuditAction =
  // Auth events
  | 'user.login'
  | 'user.logout'
  | 'user.register'
  | 'user.password_reset'
  | 'user.password_changed'
  // API Key events
  | 'api_key.created'
  | 'api_key.deleted'
  | 'api_key.used'
  // Organization events
  | 'org.created'
  | 'org.updated'
  | 'org.deleted'
  | 'org.member_invited'
  | 'org.member_joined'
  | 'org.member_removed'
  | 'org.member_role_changed'
  // Project events
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  // Trace events
  | 'trace.created'
  | 'trace.deleted'
  // Compliance events
  | 'compliance.system_assessed'
  | 'compliance.system_updated'
  | 'compliance.system_deleted'
  | 'compliance.obligation_updated'
  | 'compliance.document_generated'
  | 'compliance.incident_created'
  | 'compliance.incident_updated'
  | 'compliance.oversight_updated'

export type ResourceType =
  | 'user'
  | 'api_key'
  | 'organization'
  | 'project'
  | 'trace'
  | 'member'
  | 'invitation'
  | 'ai_system'
  | 'compliance_obligation'
  | 'compliance_document'
  | 'incident_report'
  | 'oversight_config'

export interface AuditLogData {
  action: AuditAction
  userId?: string | null
  apiKeyId?: string | null
  organizationId?: string | null
  resourceType?: ResourceType
  resourceId?: string
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Audit logging service for compliance and security tracking.
 * All sensitive operations should be logged here.
 */
export const auditService = {
  /**
   * Log an audit event
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: data.action,
          userId: data.userId,
          apiKeyId: data.apiKeyId,
          organizationId: data.organizationId,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata as Prisma.InputJsonValue | undefined,
        },
      })
    } catch (error) {
      // Don't let audit logging failures break the main flow
      logger.error({ err: error, action: data.action }, '[Audit] Failed to log event')
    }
  },

  /**
   * Log user login
   */
  async logLogin(params: {
    userId: string
    ipAddress?: string
    userAgent?: string
    organizationId?: string
  }): Promise<void> {
    await this.log({
      action: 'user.login',
      userId: params.userId,
      organizationId: params.organizationId,
      resourceType: 'user',
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  },

  /**
   * Log user registration
   */
  async logRegister(params: {
    userId: string
    email: string
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      action: 'user.register',
      userId: params.userId,
      resourceType: 'user',
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { email: params.email },
    })
  },

  /**
   * Log API key creation
   */
  async logApiKeyCreated(params: {
    userId: string
    apiKeyId: string
    organizationId?: string
    keyName: string
  }): Promise<void> {
    await this.log({
      action: 'api_key.created',
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      organizationId: params.organizationId,
      resourceType: 'api_key',
      resourceId: params.apiKeyId,
      metadata: { keyName: params.keyName },
    })
  },

  /**
   * Log API key deletion
   */
  async logApiKeyDeleted(params: {
    userId: string
    apiKeyId: string
    organizationId?: string
    keyName: string
  }): Promise<void> {
    await this.log({
      action: 'api_key.deleted',
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      organizationId: params.organizationId,
      resourceType: 'api_key',
      resourceId: params.apiKeyId,
      metadata: { keyName: params.keyName },
    })
  },

  /**
   * Log organization creation
   */
  async logOrgCreated(params: {
    userId: string
    organizationId: string
    organizationName: string
  }): Promise<void> {
    await this.log({
      action: 'org.created',
      userId: params.userId,
      organizationId: params.organizationId,
      resourceType: 'organization',
      resourceId: params.organizationId,
      metadata: { name: params.organizationName },
    })
  },

  /**
   * Log member invitation
   */
  async logMemberInvited(params: {
    userId: string
    organizationId: string
    invitedEmail: string
    role: string
    invitationId: string
  }): Promise<void> {
    await this.log({
      action: 'org.member_invited',
      userId: params.userId,
      organizationId: params.organizationId,
      resourceType: 'invitation',
      resourceId: params.invitationId,
      metadata: {
        invitedEmail: params.invitedEmail,
        role: params.role,
      },
    })
  },

  /**
   * Log member role change
   */
  async logMemberRoleChanged(params: {
    userId: string
    organizationId: string
    memberId: string
    targetUserId: string
    oldRole: string
    newRole: string
  }): Promise<void> {
    await this.log({
      action: 'org.member_role_changed',
      userId: params.userId,
      organizationId: params.organizationId,
      resourceType: 'member',
      resourceId: params.memberId,
      metadata: {
        targetUserId: params.targetUserId,
        oldRole: params.oldRole,
        newRole: params.newRole,
      },
    })
  },

  /**
   * Log project creation
   */
  async logProjectCreated(params: {
    userId?: string
    apiKeyId?: string
    organizationId?: string
    projectId: string
    projectName: string
  }): Promise<void> {
    await this.log({
      action: 'project.created',
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      organizationId: params.organizationId,
      resourceType: 'project',
      resourceId: params.projectId,
      metadata: { name: params.projectName },
    })
  },

  /**
   * Get audit logs for an organization
   */
  async getOrgLogs(params: {
    organizationId: string
    limit?: number
    offset?: number
    action?: AuditAction
  }) {
    return prisma.auditLog.findMany({
      where: {
        organizationId: params.organizationId,
        ...(params.action ? { action: params.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  },

  /**
   * Get audit logs for a user
   */
  async getUserLogs(params: {
    userId: string
    limit?: number
    offset?: number
  }) {
    return prisma.auditLog.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    })
  },
}
