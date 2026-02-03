import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireOrganization } from '../middleware/auth.js'
import {
  AssessmentWizardDataSchema,
  UpdateAISystemSchema,
  AISystemQuerySchema,
  UpdateObligationSchema,
  GenerateDocumentSchema,
  DocumentQuerySchema,
  CreateIncidentSchema,
  UpdateIncidentSchema,
  IncidentQuerySchema,
  UpdateOversightSchema,
  StatsQuerySchema,
  type AssessmentWizardData
} from '../schemas/compliance.schema.js'
import { classifyRisk } from '../services/risk-classification.service.js'
import { generateDocument } from '../services/document-generator.service.js'
import { auditService } from '../services/audit.js'
import type { Prisma } from '../generated/prisma/client.js'

export async function complianceRoutes(fastify: FastifyInstance): Promise<void> {
  // Require session auth and organization context
  fastify.addHook('preHandler', requireAuth)
  fastify.addHook('preHandler', requireOrganization)

  // ============================================
  // Assessment Endpoint
  // ============================================

  // POST /v1/compliance/assess - Submit wizard and get classification
  fastify.post('/assess', async (
    request: FastifyRequest<{ Body: AssessmentWizardData }>,
    reply: FastifyReply
  ) => {
    const parsed = AssessmentWizardDataSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    const org = request.organization!
    const data = parsed.data

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organizationId: org.id
      }
    })

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    // Classify risk
    const classification = classifyRisk(data)

    // Create AI System with classification results
    const aiSystem = await prisma.aISystem.create({
      data: {
        name: data.name,
        description: data.description,
        version: data.version,
        projectId: data.projectId,
        riskLevel: classification.riskLevel,
        complianceStatus: classification.riskLevel === 'PROHIBITED' ? 'NON_COMPLIANT' : 'IN_PROGRESS',
        annexIIICategory: data.annexIIICategory,
        prohibitedReason: classification.prohibitedReason,
        wizardData: data as unknown as Prisma.InputJsonValue,
        deployedInEU: data.deployedInEU,
        affectsEUCitizens: data.affectsEUCitizens,
        intendedPurpose: data.intendedPurpose,
        intendedUsers: data.intendedUsers,
        riskReasoning: classification.reasoning.join('\n'),
        applicableArticles: classification.applicableArticles,
        assessedAt: new Date()
      }
    })

    // Create obligations from classification
    if (classification.obligations.length > 0) {
      await prisma.complianceObligation.createMany({
        data: classification.obligations.map(obl => ({
          aiSystemId: aiSystem.id,
          articleNumber: obl.articleNumber,
          articleTitle: obl.articleTitle,
          description: obl.description,
          status: 'PENDING'
        }))
      })
    }

    // Create default human oversight config for high-risk systems
    if (classification.riskLevel === 'HIGH') {
      await prisma.humanOversightConfig.create({
        data: {
          aiSystemId: aiSystem.id,
          oversightLevel: 'MONITORING',
          humanOnLoop: true,
          canInterrupt: true,
          canOverride: true,
          canShutdown: true,
          trainingRequired: true
        }
      })
    }

    // Auto-generate FRIA document if FRIA fields are provided
    if (data.friaAffectedGroups || data.friaFundamentalRightsImpact) {
      const friaGenerated = generateDocument('FRIA', {
        system: aiSystem,
        oversightConfig: null,
        generatedAt: new Date()
      })

      const friaGeneratedFrom: Record<string, unknown> = {
        ...friaGenerated.generatedFrom,
        source: 'wizard',
        friaData: {
          affectedGroups: data.friaAffectedGroups ?? null,
          potentialDiscrimination: data.friaPotentialDiscrimination ?? null,
          fundamentalRightsImpact: data.friaFundamentalRightsImpact ?? null,
          mitigationMeasures: data.friaMitigationMeasures ?? null,
        },
      }

      await prisma.complianceDocument.create({
        data: {
          aiSystemId: aiSystem.id,
          type: 'FRIA',
          title: friaGenerated.title,
          content: friaGenerated.content,
          generatedFrom: friaGeneratedFrom as Prisma.InputJsonValue,
        }
      })
    }

    // Return created system with classification
    const result = await prisma.aISystem.findUnique({
      where: { id: aiSystem.id },
      include: {
        obligations: true,
        oversightConfig: true
      }
    })

    await auditService.log({
      action: 'compliance.system_assessed',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'ai_system',
      resourceId: aiSystem.id,
      metadata: {
        systemName: data.name,
        riskLevel: classification.riskLevel,
        projectId: data.projectId
      }
    })

    return reply.status(201).send({
      system: result,
      classification: {
        riskLevel: classification.riskLevel,
        reasoning: classification.reasoning,
        applicableArticles: classification.applicableArticles,
        prohibitedReason: classification.prohibitedReason
      }
    })
  })

  // ============================================
  // AI Systems CRUD
  // ============================================

  // GET /v1/compliance/systems - List AI systems
  fastify.get('/systems', async (request: FastifyRequest) => {
    const org = request.organization!
    const query = AISystemQuerySchema.parse(request.query)

    const where: Prisma.AISystemWhereInput = {
      project: {
        organizationId: org.id
      }
    }

    if (query.projectId) {
      where.projectId = query.projectId
    }
    if (query.riskLevel) {
      where.riskLevel = query.riskLevel
    }
    if (query.complianceStatus) {
      where.complianceStatus = query.complianceStatus
    }

    const [systems, total] = await Promise.all([
      prisma.aISystem.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              obligations: true,
              documents: true,
              incidents: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset
      }),
      prisma.aISystem.count({ where })
    ])

    return {
      data: systems,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + systems.length < total
      }
    }
  })

  // GET /v1/compliance/systems/:id - Get single AI system
  fastify.get('/systems/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    const system = await prisma.aISystem.findFirst({
      where: {
        id,
        project: {
          organizationId: org.id
        }
      },
      include: {
        project: {
          select: { id: true, name: true }
        },
        obligations: {
          take: 100,
          orderBy: { articleNumber: 'asc' }
        },
        documents: {
          take: 50,
          orderBy: { createdAt: 'desc' }
        },
        incidents: {
          orderBy: { occurredAt: 'desc' },
          take: 10
        },
        oversightConfig: true,
        traces: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            startedAt: true,
            endedAt: true,
            totalCost: true,
            totalTokens: true,
            totalDuration: true
          }
        },
        _count: {
          select: { traces: true }
        }
      }
    })

    if (!system) {
      return reply.status(404).send({ error: 'AI System not found' })
    }

    return system
  })

  // GET /v1/compliance/systems/:id/traces - Get traces for an AI system
  fastify.get('/systems/:id/traces', async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>
  ) => {
    const org = request.organization!
    const { id } = request.params
    const limit = Math.min(parseInt(request.query.limit || '20'), 100)
    const offset = parseInt(request.query.offset || '0')

    // Verify ownership
    const system = await prisma.aISystem.findFirst({
      where: {
        id,
        project: { organizationId: org.id }
      }
    })

    if (!system) {
      return { data: [], pagination: { total: 0, limit, offset, hasMore: false } }
    }

    const [traces, total] = await Promise.all([
      prisma.trace.findMany({
        where: { aiSystemId: id },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          status: true,
          startedAt: true,
          endedAt: true,
          totalCost: true,
          totalTokens: true,
          totalDuration: true,
          _count: { select: { spans: true } }
        }
      }),
      prisma.trace.count({ where: { aiSystemId: id } })
    ])

    return {
      data: traces,
      pagination: { total, limit, offset, hasMore: offset + traces.length < total }
    }
  })

  // PUT /v1/compliance/systems/:id - Update AI system
  fastify.put('/systems/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    const parsed = UpdateAISystemSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    // Verify ownership
    const existing = await prisma.aISystem.findFirst({
      where: {
        id,
        project: {
          organizationId: org.id
        }
      }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'AI System not found' })
    }

    // Capture before values for audit trail before mutation
    const auditBefore: Record<string, unknown> = {}
    const auditAfter: Record<string, unknown> = {}
    for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
      if (parsed.data[key] !== undefined) {
        auditBefore[key] = existing[key as keyof typeof existing]
        auditAfter[key] = parsed.data[key]
      }
    }

    const updated = await prisma.aISystem.update({
      where: { id },
      data: parsed.data
    })

    await auditService.log({
      action: 'compliance.system_updated',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'ai_system',
      resourceId: id,
      metadata: {
        before: auditBefore,
        after: auditAfter
      }
    })

    return updated
  })

  // DELETE /v1/compliance/systems/:id - Delete AI system
  fastify.delete('/systems/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    // Verify ownership
    const existing = await prisma.aISystem.findFirst({
      where: {
        id,
        project: {
          organizationId: org.id
        }
      }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'AI System not found' })
    }

    await prisma.aISystem.delete({ where: { id } })

    await auditService.log({
      action: 'compliance.system_deleted',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'ai_system',
      resourceId: id,
      metadata: { systemName: existing.name }
    })

    return reply.status(204).send()
  })

  // ============================================
  // Obligations
  // ============================================

  // PUT /v1/compliance/obligations/:id - Update obligation status
  fastify.put('/obligations/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    const parsed = UpdateObligationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    // Verify ownership through AI System -> Project -> Organization
    const existing = await prisma.complianceObligation.findFirst({
      where: {
        id,
        aiSystem: {
          project: {
            organizationId: org.id
          }
        }
      }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Obligation not found' })
    }

    const updated = await prisma.complianceObligation.update({
      where: { id },
      data: {
        status: parsed.data.status,
        notes: parsed.data.notes,
        completedAt: parsed.data.status === 'COMPLETED' ? new Date() : null
      }
    })

    await auditService.log({
      action: 'compliance.obligation_updated',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'compliance_obligation',
      resourceId: id,
      metadata: {
        aiSystemId: existing.aiSystemId,
        oldStatus: existing.status,
        newStatus: parsed.data.status
      }
    })

    // Update AI System compliance status based on obligations
    await updateComplianceStatus(existing.aiSystemId)

    return updated
  })

  // ============================================
  // Documents
  // ============================================

  // POST /v1/compliance/documents/generate - Generate document
  fastify.post('/documents/generate', async (
    request: FastifyRequest<{ Body: unknown }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!

    const parsed = GenerateDocumentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    // Verify ownership
    const system = await prisma.aISystem.findFirst({
      where: {
        id: parsed.data.aiSystemId,
        project: {
          organizationId: org.id
        }
      },
      include: {
        oversightConfig: true
      }
    })

    if (!system) {
      return reply.status(404).send({ error: 'AI System not found' })
    }

    // Generate document
    const generated = generateDocument(parsed.data.type, {
      system,
      oversightConfig: system.oversightConfig,
      generatedAt: new Date()
    })

    // Check if document of this type already exists
    const existing = await prisma.complianceDocument.findFirst({
      where: {
        aiSystemId: system.id,
        type: parsed.data.type
      }
    })

    let document
    if (existing) {
      // Update existing document with new version
      document = await prisma.complianceDocument.update({
        where: { id: existing.id },
        data: {
          title: generated.title,
          content: generated.content,
          version: existing.version + 1,
          generatedFrom: generated.generatedFrom as Prisma.InputJsonValue
        }
      })
    } else {
      // Create new document
      document = await prisma.complianceDocument.create({
        data: {
          aiSystemId: system.id,
          type: parsed.data.type,
          title: generated.title,
          content: generated.content,
          generatedFrom: generated.generatedFrom as Prisma.InputJsonValue
        }
      })
    }

    await auditService.log({
      action: 'compliance.document_generated',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'compliance_document',
      resourceId: document.id,
      metadata: {
        aiSystemId: system.id,
        documentType: parsed.data.type,
        version: document.version
      }
    })

    return reply.status(201).send(document)
  })

  // GET /v1/compliance/documents - List documents
  fastify.get('/documents', async (request: FastifyRequest) => {
    const org = request.organization!
    const query = DocumentQuerySchema.parse(request.query)

    const where: Prisma.ComplianceDocumentWhereInput = {
      aiSystem: {
        project: {
          organizationId: org.id
        }
      }
    }

    if (query.aiSystemId) {
      where.aiSystemId = query.aiSystemId
    }
    if (query.type) {
      where.type = query.type
    }

    const [documents, total] = await Promise.all([
      prisma.complianceDocument.findMany({
        where,
        include: {
          aiSystem: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset
      }),
      prisma.complianceDocument.count({ where })
    ])

    return {
      data: documents,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + documents.length < total
      }
    }
  })

  // GET /v1/compliance/documents/:id - Get single document
  fastify.get('/documents/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    const document = await prisma.complianceDocument.findFirst({
      where: {
        id,
        aiSystem: {
          project: {
            organizationId: org.id
          }
        }
      },
      include: {
        aiSystem: {
          select: { id: true, name: true }
        }
      }
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document not found' })
    }

    return document
  })

  // ============================================
  // Incidents
  // ============================================

  // POST /v1/compliance/incidents - Create incident
  fastify.post('/incidents', async (
    request: FastifyRequest<{ Body: unknown }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!

    const parsed = CreateIncidentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    // Verify ownership
    const system = await prisma.aISystem.findFirst({
      where: {
        id: parsed.data.aiSystemId,
        project: {
          organizationId: org.id
        }
      }
    })

    if (!system) {
      return reply.status(404).send({ error: 'AI System not found' })
    }

    const incident = await prisma.incidentReport.create({
      data: {
        aiSystemId: parsed.data.aiSystemId,
        title: parsed.data.title,
        description: parsed.data.description,
        severity: parsed.data.severity,
        type: parsed.data.type,
        occurredAt: parsed.data.occurredAt,
        detectedAt: parsed.data.detectedAt,
        impactDescription: parsed.data.impactDescription,
        affectedUsers: parsed.data.affectedUsers
      }
    })

    await auditService.log({
      action: 'compliance.incident_created',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'incident_report',
      resourceId: incident.id,
      metadata: {
        aiSystemId: parsed.data.aiSystemId,
        severity: parsed.data.severity,
        type: parsed.data.type
      }
    })

    return reply.status(201).send(incident)
  })

  // GET /v1/compliance/incidents - List incidents
  fastify.get('/incidents', async (request: FastifyRequest) => {
    const org = request.organization!
    const query = IncidentQuerySchema.parse(request.query)

    const where: Prisma.IncidentReportWhereInput = {
      aiSystem: {
        project: {
          organizationId: org.id
        }
      }
    }

    if (query.aiSystemId) {
      where.aiSystemId = query.aiSystemId
    }
    if (query.severity) {
      where.severity = query.severity
    }
    if (query.type) {
      where.type = query.type
    }
    if (query.resolved !== undefined) {
      where.resolvedAt = query.resolved ? { not: null } : null
    }

    const [incidents, total] = await Promise.all([
      prisma.incidentReport.findMany({
        where,
        include: {
          aiSystem: {
            select: { id: true, name: true }
          }
        },
        orderBy: { occurredAt: 'desc' },
        take: query.limit,
        skip: query.offset
      }),
      prisma.incidentReport.count({ where })
    ])

    return {
      data: incidents,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + incidents.length < total
      }
    }
  })

  // PUT /v1/compliance/incidents/:id - Update incident
  fastify.put('/incidents/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const { id } = request.params

    const parsed = UpdateIncidentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    // Verify ownership
    const existing = await prisma.incidentReport.findFirst({
      where: {
        id,
        aiSystem: {
          project: {
            organizationId: org.id
          }
        }
      }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Incident not found' })
    }

    // Capture before values for audit trail before mutation
    const incidentBefore: Record<string, unknown> = {}
    const incidentAfter: Record<string, unknown> = {}
    for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
      if (parsed.data[key] !== undefined) {
        incidentBefore[key] = existing[key as keyof typeof existing]
        incidentAfter[key] = parsed.data[key]
      }
    }

    const updated = await prisma.incidentReport.update({
      where: { id },
      data: parsed.data
    })

    await auditService.log({
      action: 'compliance.incident_updated',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'incident_report',
      resourceId: id,
      metadata: {
        aiSystemId: existing.aiSystemId,
        before: incidentBefore,
        after: incidentAfter
      }
    })

    return updated
  })

  // ============================================
  // Human Oversight
  // ============================================

  // PUT /v1/compliance/systems/:id/oversight - Update oversight config
  fastify.put('/systems/:id/oversight', async (
    request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
    reply: FastifyReply
  ) => {
    const org = request.organization!
    const user = request.user
    const { id } = request.params

    const parsed = UpdateOversightSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten()
      })
    }

    // Verify ownership
    const system = await prisma.aISystem.findFirst({
      where: {
        id,
        project: {
          organizationId: org.id
        }
      },
      include: {
        oversightConfig: true
      }
    })

    if (!system) {
      return reply.status(404).send({ error: 'AI System not found' })
    }

    const oldConfig = system.oversightConfig
    let config: Awaited<ReturnType<typeof prisma.humanOversightConfig.update>> | Awaited<ReturnType<typeof prisma.humanOversightConfig.create>>

    if (oldConfig) {
      // Track changes for audit history
      const changes: { fieldName: string; oldValue: string | null; newValue: string | null }[] = []

      for (const [key, newValue] of Object.entries(parsed.data)) {
        if (newValue === undefined) continue
        const oldValue = oldConfig[key as keyof typeof oldConfig]
        const oldStr = oldValue !== undefined && oldValue !== null ? JSON.stringify(oldValue) : null
        const newStr = JSON.stringify(newValue)

        if (oldStr !== newStr) {
          changes.push({
            fieldName: key,
            oldValue: oldStr,
            newValue: newStr
          })
        }
      }

      config = await prisma.humanOversightConfig.update({
        where: { id: oldConfig.id },
        data: {
          ...parsed.data,
          alertThresholds: parsed.data.alertThresholds as Prisma.InputJsonValue,
          responsiblePersons: parsed.data.responsiblePersons as Prisma.InputJsonValue
        }
      })

      // Create history records for changes
      if (changes.length > 0) {
        await prisma.oversightChangeHistory.createMany({
          data: changes.map(change => ({
            oversightConfigId: config.id,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            changedBy: user?.email || 'system'
          }))
        })
      }
    } else {
      config = await prisma.humanOversightConfig.create({
        data: {
          aiSystemId: id,
          ...parsed.data,
          alertThresholds: parsed.data.alertThresholds as Prisma.InputJsonValue,
          responsiblePersons: parsed.data.responsiblePersons as Prisma.InputJsonValue
        }
      })

      // Record initial creation
      await prisma.oversightChangeHistory.create({
        data: {
          oversightConfigId: config.id,
          fieldName: '_created',
          oldValue: null,
          newValue: 'Initial configuration created',
          changedBy: user?.email || 'system'
        }
      })
    }

    // Build before/after for oversight audit
    const oversightBefore: Record<string, unknown> = {}
    const oversightAfter: Record<string, unknown> = {}
    if (oldConfig) {
      for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
        if (parsed.data[key] !== undefined) {
          oversightBefore[key] = oldConfig[key as keyof typeof oldConfig]
          oversightAfter[key] = parsed.data[key]
        }
      }
    }

    await auditService.log({
      action: 'compliance.oversight_updated',
      userId: request.user?.id,
      organizationId: org.id,
      resourceType: 'oversight_config',
      resourceId: config.id,
      metadata: {
        aiSystemId: id,
        isNewConfig: !oldConfig,
        ...(oldConfig ? { before: oversightBefore, after: oversightAfter } : {})
      }
    })

    return config
  })

  // ============================================
  // Stats
  // ============================================

  // GET /v1/compliance/stats - Get dashboard stats
  fastify.get('/stats', async (request: FastifyRequest) => {
    const org = request.organization!
    const query = StatsQuerySchema.parse(request.query)

    const baseWhere: Prisma.AISystemWhereInput = {
      project: {
        organizationId: org.id
      }
    }

    if (query.projectId) {
      baseWhere.projectId = query.projectId
    }

    const [
      total,
      byRiskLevel,
      byComplianceStatus,
      recentIncidents,
      pendingObligations
    ] = await Promise.all([
      // Total systems
      prisma.aISystem.count({ where: baseWhere }),

      // By risk level
      prisma.aISystem.groupBy({
        by: ['riskLevel'],
        where: baseWhere,
        _count: true
      }),

      // By compliance status
      prisma.aISystem.groupBy({
        by: ['complianceStatus'],
        where: baseWhere,
        _count: true
      }),

      // Recent incidents
      prisma.incidentReport.findMany({
        where: {
          aiSystem: baseWhere
        },
        orderBy: { occurredAt: 'desc' },
        take: 5,
        include: {
          aiSystem: {
            select: { id: true, name: true }
          }
        }
      }),

      // Pending obligations count
      prisma.complianceObligation.count({
        where: {
          status: 'PENDING',
          aiSystem: baseWhere
        }
      })
    ])

    return {
      totalSystems: total,
      byRiskLevel: byRiskLevel.reduce((acc, item) => {
        acc[item.riskLevel] = item._count
        return acc
      }, {} as Record<string, number>),
      byComplianceStatus: byComplianceStatus.reduce((acc, item) => {
        acc[item.complianceStatus] = item._count
        return acc
      }, {} as Record<string, number>),
      pendingObligations,
      recentIncidents
    }
  })
}

// ============================================
// Helper Functions
// ============================================

async function updateComplianceStatus(aiSystemId: string): Promise<void> {
  const obligations = await prisma.complianceObligation.findMany({
    where: { aiSystemId }
  })

  if (obligations.length === 0) {
    return
  }

  const pendingCount = obligations.filter(o =>
    o.status === 'PENDING' || o.status === 'IN_PROGRESS'
  ).length

  const completedCount = obligations.filter(o =>
    o.status === 'COMPLETED' || o.status === 'NOT_APPLICABLE'
  ).length

  let newStatus: 'IN_PROGRESS' | 'COMPLIANT' | 'NON_COMPLIANT'

  if (completedCount === obligations.length) {
    newStatus = 'COMPLIANT'
  } else if (pendingCount === obligations.length) {
    newStatus = 'IN_PROGRESS'
  } else {
    newStatus = 'IN_PROGRESS'
  }

  await prisma.aISystem.update({
    where: { id: aiSystemId },
    data: { complianceStatus: newStatus }
  })
}
