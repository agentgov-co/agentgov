import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomBytes } from 'crypto'

// Mock data stores
const mockProjects: Map<string, Record<string, unknown>> = new Map()
const mockAISystems: Map<string, Record<string, unknown>> = new Map()
const mockObligations: Map<string, Record<string, unknown>> = new Map()
const mockDocuments: Map<string, Record<string, unknown>> = new Map()
const mockIncidents: Map<string, Record<string, unknown>> = new Map()
const mockOversightConfigs: Map<string, Record<string, unknown>> = new Map()

// Mock user and organization for session auth
const MOCK_USER = { id: 'user_123', email: 'test@example.com', name: 'Test User' }
const MOCK_ORG = { id: 'org_123', name: 'Test Org', role: 'OWNER' }

// Helper to create mock project
function createMockProject(): { id: string; name: string; organizationId: string; createdAt: Date; updatedAt: Date } {
  const id = `proj_${randomBytes(8).toString('hex')}`
  const project = {
    id,
    name: 'Test Project',
    organizationId: MOCK_ORG.id,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  mockProjects.set(id, project)
  return project
}

// Mock prisma module
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(({ where }) => {
        if (where?.id && where?.organizationId) {
          const project = mockProjects.get(where.id)
          if (project && (project as Record<string, unknown>).organizationId === where.organizationId) {
            return Promise.resolve(project)
          }
        }
        return Promise.resolve(null)
      }),
    },
    aISystem: {
      create: vi.fn(({ data }) => {
        const system = {
          id: `sys_${randomBytes(8).toString('hex')}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        mockAISystems.set(system.id, system)
        return Promise.resolve(system)
      }),
      findUnique: vi.fn(({ where, include }) => {
        const system = mockAISystems.get(where.id)
        if (system && include) {
          const result = { ...system }
          if (include.obligations) {
            (result as Record<string, unknown>).obligations = Array.from(mockObligations.values())
              .filter((o) => (o as Record<string, unknown>).aiSystemId === system.id)
          }
          if (include.oversightConfig) {
            (result as Record<string, unknown>).oversightConfig = mockOversightConfigs.get(system.id as string) || null
          }
          return Promise.resolve(result)
        }
        return Promise.resolve(system || null)
      }),
      findFirst: vi.fn(({ where }) => {
        for (const system of mockAISystems.values()) {
          const sys = system as Record<string, unknown>
          if (sys.id === where?.id) {
            const project = mockProjects.get(sys.projectId as string)
            if (project && (project as Record<string, unknown>).organizationId === MOCK_ORG.id) {
              return Promise.resolve(system)
            }
          }
        }
        return Promise.resolve(null)
      }),
      findMany: vi.fn(({ take, skip }) => {
        const systems = Array.from(mockAISystems.values()).filter((s) => {
          const sys = s as Record<string, unknown>
          const project = mockProjects.get(sys.projectId as string)
          return project && (project as Record<string, unknown>).organizationId === MOCK_ORG.id
        })
        return Promise.resolve(systems.slice(skip || 0, (skip || 0) + (take || 20)))
      }),
      count: vi.fn(() => Promise.resolve(mockAISystems.size)),
      update: vi.fn(({ where, data }) => {
        const system = mockAISystems.get(where.id)
        if (system) {
          Object.assign(system, data, { updatedAt: new Date() })
          return Promise.resolve(system)
        }
        return Promise.reject(new Error('Not found'))
      }),
      delete: vi.fn(({ where }) => {
        const system = mockAISystems.get(where.id)
        if (system) {
          // Simulate soft-delete via $extends (sets deletedAt instead of removing)
          ;(system as Record<string, unknown>).deletedAt = new Date()
          return Promise.resolve(system)
        }
        return Promise.reject(new Error('Not found'))
      }),
      groupBy: vi.fn(() => Promise.resolve([]))
    },
    complianceObligation: {
      createMany: vi.fn(({ data }) => {
        for (const obl of data) {
          const id = `obl_${randomBytes(8).toString('hex')}`
          mockObligations.set(id, { id, ...obl, createdAt: new Date(), updatedAt: new Date() })
        }
        return Promise.resolve({ count: data.length })
      }),
      findFirst: vi.fn(({ where }) => {
        for (const obl of mockObligations.values()) {
          if ((obl as Record<string, unknown>).id === where?.id) {
            return Promise.resolve(obl)
          }
        }
        return Promise.resolve(null)
      }),
      findMany: vi.fn(({ where }) => {
        return Promise.resolve(
          Array.from(mockObligations.values())
            .filter((o) => (o as Record<string, unknown>).aiSystemId === where?.aiSystemId)
        )
      }),
      update: vi.fn(({ where, data }) => {
        const obl = mockObligations.get(where.id)
        if (obl) {
          Object.assign(obl, data, { updatedAt: new Date() })
          return Promise.resolve(obl)
        }
        return Promise.reject(new Error('Not found'))
      }),
      count: vi.fn(() => Promise.resolve(mockObligations.size))
    },
    complianceDocument: {
      create: vi.fn(({ data }) => {
        const doc = {
          id: `doc_${randomBytes(8).toString('hex')}`,
          version: 1,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        mockDocuments.set(doc.id, doc)
        return Promise.resolve(doc)
      }),
      findFirst: vi.fn(({ where }) => {
        for (const doc of mockDocuments.values()) {
          const d = doc as Record<string, unknown>
          if (where?.aiSystemId && d.aiSystemId === where.aiSystemId && d.type === where.type) {
            return Promise.resolve(doc)
          }
          if (where?.id && d.id === where.id) {
            return Promise.resolve(doc)
          }
        }
        return Promise.resolve(null)
      }),
      findMany: vi.fn(() => Promise.resolve(Array.from(mockDocuments.values()))),
      update: vi.fn(({ where, data }) => {
        const doc = mockDocuments.get(where.id)
        if (doc) {
          Object.assign(doc, data, { updatedAt: new Date() })
          return Promise.resolve(doc)
        }
        return Promise.reject(new Error('Not found'))
      }),
      count: vi.fn(() => Promise.resolve(mockDocuments.size))
    },
    incidentReport: {
      create: vi.fn(({ data }) => {
        const incident = {
          id: `inc_${randomBytes(8).toString('hex')}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        mockIncidents.set(incident.id, incident)
        return Promise.resolve(incident)
      }),
      findFirst: vi.fn(({ where }) => {
        for (const inc of mockIncidents.values()) {
          if ((inc as Record<string, unknown>).id === where?.id) {
            return Promise.resolve(inc)
          }
        }
        return Promise.resolve(null)
      }),
      findMany: vi.fn(() => Promise.resolve(Array.from(mockIncidents.values()))),
      update: vi.fn(({ where, data }) => {
        const inc = mockIncidents.get(where.id)
        if (inc) {
          Object.assign(inc, data, { updatedAt: new Date() })
          return Promise.resolve(inc)
        }
        return Promise.reject(new Error('Not found'))
      }),
      count: vi.fn(() => Promise.resolve(mockIncidents.size))
    },
    humanOversightConfig: {
      create: vi.fn(({ data }) => {
        const config = {
          id: `oc_${randomBytes(8).toString('hex')}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        mockOversightConfigs.set(data.aiSystemId, config)
        return Promise.resolve(config)
      }),
      update: vi.fn(({ where, data }) => {
        const config = mockOversightConfigs.get(where.id)
        if (config) {
          Object.assign(config, data, { updatedAt: new Date() })
          return Promise.resolve(config)
        }
        return Promise.reject(new Error('Not found'))
      })
    }
  }
}))

// Mock audit service
const mockAuditLog = vi.fn().mockResolvedValue(undefined)
vi.mock('../services/audit.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args)
  }
}))

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer session_')) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    (request as unknown as Record<string, unknown>).user = MOCK_USER
  },
  requireOrganization: async (request: FastifyRequest) => {
    (request as unknown as Record<string, unknown>).organization = MOCK_ORG
  }
}))

// Import after mocks
import { complianceRoutes } from './compliance.js'

describe('Compliance API', () => {
  let app: FastifyInstance
  const AUTH_HEADER = { authorization: 'Bearer session_valid_token' }
  let testProject: ReturnType<typeof createMockProject>

  beforeAll(async () => {
    app = Fastify()
    await app.register(complianceRoutes, { prefix: '/v1/compliance' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockProjects.clear()
    mockAISystems.clear()
    mockObligations.clear()
    mockDocuments.clear()
    mockIncidents.clear()
    mockOversightConfigs.clear()
    mockAuditLog.mockClear()
    testProject = createMockProject()
  })

  describe('Authentication', () => {
    it('should reject requests without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/compliance/systems'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should accept requests with valid session token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/compliance/systems',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /v1/compliance/assess', () => {
    it('should create an AI system with risk classification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Test AI System',
          projectId: testProject.id,
          useCaseDescription: 'A chatbot for customer support',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Customer support automation',
          processesPersonalData: false,
          automationLevel: 'semi_automated'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.system).toBeDefined()
      expect(body.system.name).toBe('Test AI System')
      expect(body.classification).toBeDefined()
      expect(body.classification.riskLevel).toBeDefined()
    })

    it('should classify high-risk system correctly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'HR Screening AI',
          projectId: testProject.id,
          useCaseDescription: 'Automated CV screening',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Screen job applicants',
          processesPersonalData: true
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.classification.riskLevel).toBe('HIGH')
      expect(body.system.riskLevel).toBe('HIGH')
    })

    it('should classify prohibited system correctly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Social Scoring AI',
          projectId: testProject.id,
          useCaseDescription: 'Social credit scoring',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Score citizens',
          processesPersonalData: true,
          usesSocialScoring: true
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.classification.riskLevel).toBe('PROHIBITED')
    })

    it('should reject assessment for non-existent project', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Test AI',
          projectId: 'nonexistent',
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should auto-generate FRIA document when FRIA fields provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'FRIA Test System',
          projectId: testProject.id,
          useCaseDescription: 'A system that screens applicants',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Screen job applicants',
          processesPersonalData: true,
          friaAffectedGroups: 'Job applicants across all demographics',
          friaFundamentalRightsImpact: 'May impact right to non-discrimination and privacy'
        }
      })

      expect(response.statusCode).toBe(201)
      // Verify FRIA document was created
      expect(mockDocuments.size).toBeGreaterThanOrEqual(1)
      const friaDoc = Array.from(mockDocuments.values()).find(
        (d) => (d as Record<string, unknown>).type === 'FRIA'
      )
      expect(friaDoc).toBeDefined()
    })

    it('should reject invalid assessment data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          // Missing required fields
          name: 'Test'
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /v1/compliance/systems', () => {
    it('should list AI systems', async () => {
      // Create a system first
      await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Test System',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/v1/compliance/systems',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.data).toBeDefined()
      expect(body.pagination).toBeDefined()
    })
  })

  describe('GET /v1/compliance/systems/:id', () => {
    it('should get a system by ID', async () => {
      // Create a system first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Test System',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'GET',
        url: `/v1/compliance/systems/${created.system.id}`,
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.id).toBe(created.system.id)
    })

    it('should return 404 for non-existent system', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/compliance/systems/nonexistent',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /v1/compliance/obligations/:id', () => {
    it('should update obligation status', async () => {
      // Create a high-risk system (generates obligations)
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'HR AI',
          projectId: testProject.id,
          useCaseDescription: 'CV Screening',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Screen applicants',
          processesPersonalData: true
        }
      })
      const created = JSON.parse(createResponse.body)

      // Get system with obligations
      const systemResponse = await app.inject({
        method: 'GET',
        url: `/v1/compliance/systems/${created.system.id}`,
        headers: AUTH_HEADER
      })
      const system = JSON.parse(systemResponse.body)
      const obligationId = system.obligations?.[0]?.id

      if (obligationId) {
        const response = await app.inject({
          method: 'PUT',
          url: `/v1/compliance/obligations/${obligationId}`,
          headers: AUTH_HEADER,
          payload: {
            status: 'COMPLETED',
            notes: 'Done'
          }
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.status).toBe('COMPLETED')
      }
    })
  })

  describe('POST /v1/compliance/documents/generate', () => {
    it('should generate a document', async () => {
      // Create a system first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Test System',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/documents/generate',
        headers: AUTH_HEADER,
        payload: {
          aiSystemId: created.system.id,
          type: 'TECHNICAL_DOCUMENTATION'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.type).toBe('TECHNICAL_DOCUMENTATION')
      expect(body.content).toBeDefined()
      expect(body.title).toContain('Technical Documentation')
    })

    it('should reject for non-existent system', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/documents/generate',
        headers: AUTH_HEADER,
        payload: {
          aiSystemId: 'nonexistent',
          type: 'TECHNICAL_DOCUMENTATION'
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /v1/compliance/incidents', () => {
    it('should create an incident', async () => {
      // Create a system first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Test System',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/incidents',
        headers: AUTH_HEADER,
        payload: {
          aiSystemId: created.system.id,
          title: 'Test Incident',
          description: 'Something went wrong',
          severity: 'MEDIUM',
          type: 'MALFUNCTION',
          occurredAt: new Date().toISOString(),
          detectedAt: new Date().toISOString()
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.title).toBe('Test Incident')
      expect(body.severity).toBe('MEDIUM')
    })
  })

  describe('GET /v1/compliance/stats', () => {
    it('should return stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/compliance/stats',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.totalSystems).toBeDefined()
      expect(body.byRiskLevel).toBeDefined()
      expect(body.byComplianceStatus).toBeDefined()
      expect(body.pendingObligations).toBeDefined()
    })
  })

  describe('Audit Logging', () => {
    it('should log audit event on system assessment', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Audit Test System',
          projectId: testProject.id,
          useCaseDescription: 'Testing audit logging',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.system_assessed',
          resourceType: 'ai_system',
          organizationId: MOCK_ORG.id
        })
      )
    })

    it('should log audit event on system deletion', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Delete Audit Test',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)

      await app.inject({
        method: 'DELETE',
        url: `/v1/compliance/systems/${created.system.id}`,
        headers: AUTH_HEADER
      })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.system_deleted',
          resourceType: 'ai_system',
          resourceId: created.system.id
        })
      )
    })

    it('should log audit event on incident creation', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Incident Audit Test',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)

      await app.inject({
        method: 'POST',
        url: '/v1/compliance/incidents',
        headers: AUTH_HEADER,
        payload: {
          aiSystemId: created.system.id,
          title: 'Audit Incident',
          description: 'Testing audit',
          severity: 'LOW',
          type: 'OTHER',
          occurredAt: new Date().toISOString(),
          detectedAt: new Date().toISOString()
        }
      })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.incident_created',
          resourceType: 'incident_report'
        })
      )
    })

    it('should include metadata in audit event on system assessment', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Metadata Audit Test',
          projectId: testProject.id,
          useCaseDescription: 'Testing metadata',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test metadata',
          processesPersonalData: true
        }
      })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.system_assessed',
          userId: MOCK_USER.id,
          organizationId: MOCK_ORG.id,
          resourceType: 'ai_system',
          metadata: expect.objectContaining({
            systemName: 'Metadata Audit Test',
            riskLevel: 'HIGH'
          })
        })
      )
    })

    it('should log audit event on obligation update', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Obligation Audit Test',
          projectId: testProject.id,
          useCaseDescription: 'CV Screening',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Screen applicants',
          processesPersonalData: true
        }
      })
      const created = JSON.parse(createResponse.body)

      const systemResponse = await app.inject({
        method: 'GET',
        url: `/v1/compliance/systems/${created.system.id}`,
        headers: AUTH_HEADER
      })
      const system = JSON.parse(systemResponse.body)
      const obligationId = system.obligations?.[0]?.id

      if (obligationId) {
        mockAuditLog.mockClear()
        await app.inject({
          method: 'PUT',
          url: `/v1/compliance/obligations/${obligationId}`,
          headers: AUTH_HEADER,
          payload: {
            status: 'COMPLETED',
            notes: 'Done'
          }
        })

        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'compliance.obligation_updated',
            resourceType: 'compliance_obligation',
            resourceId: obligationId
          })
        )
      }
    })

    it('should log audit event on document generation', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Doc Audit Test',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)

      await app.inject({
        method: 'POST',
        url: '/v1/compliance/documents/generate',
        headers: AUTH_HEADER,
        payload: {
          aiSystemId: created.system.id,
          type: 'TECHNICAL_DOCUMENTATION'
        }
      })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.document_generated',
          resourceType: 'compliance_document'
        })
      )
    })
  })

  describe('FRIA Document Auto-Generation', () => {
    it('should store FRIA data in generatedFrom metadata', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'FRIA Metadata System',
          projectId: testProject.id,
          useCaseDescription: 'Screening system',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Screen applicants',
          processesPersonalData: true,
          friaAffectedGroups: 'Job applicants across all demographics',
          friaPotentialDiscrimination: 'Age and gender bias risk',
          friaFundamentalRightsImpact: 'Right to non-discrimination',
          friaMitigationMeasures: 'Regular bias audits'
        }
      })

      const friaDoc = Array.from(mockDocuments.values()).find(
        (d) => (d as Record<string, unknown>).type === 'FRIA'
      )
      expect(friaDoc).toBeDefined()
      const generatedFrom = (friaDoc as Record<string, unknown>).generatedFrom as Record<string, unknown>
      expect(generatedFrom.source).toBe('wizard')
      expect(generatedFrom.friaData).toEqual({
        affectedGroups: 'Job applicants across all demographics',
        potentialDiscrimination: 'Age and gender bias risk',
        fundamentalRightsImpact: 'Right to non-discrimination',
        mitigationMeasures: 'Regular bias audits'
      })
    })

    it('should not create FRIA document when no FRIA fields provided', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'No FRIA System',
          projectId: testProject.id,
          useCaseDescription: 'Simple chatbot',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Customer support',
          processesPersonalData: false
        }
      })

      const friaDoc = Array.from(mockDocuments.values()).find(
        (d) => (d as Record<string, unknown>).type === 'FRIA'
      )
      expect(friaDoc).toBeUndefined()
    })
  })

  describe('E2E: Full FRIA Wizard Flow', () => {
    it('should create system with FRIA → generate FRIA doc with wizard content → log audit', async () => {
      mockAuditLog.mockClear()

      const response = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'E2E FRIA System',
          projectId: testProject.id,
          useCaseDescription: 'Automated HR screening with CV parsing',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Screen job applicants automatically',
          processesPersonalData: true,
          processesSensitiveData: true,
          hasLegalEffects: true,
          affectsVulnerableGroups: true,
          friaAffectedGroups: 'All job applicants in EU member states',
          friaPotentialDiscrimination: 'Potential age and gender bias from training data',
          friaFundamentalRightsImpact: 'Directly impacts right to non-discrimination and right to work',
          friaMitigationMeasures: 'Quarterly bias audits, human review for all rejections'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)

      // 1. System classified as HIGH risk
      expect(body.classification.riskLevel).toBe('HIGH')

      // 2. FRIA document was auto-generated
      const friaDoc = Array.from(mockDocuments.values()).find(
        (d) => (d as Record<string, unknown>).type === 'FRIA'
      )
      expect(friaDoc).toBeDefined()

      // 3. FRIA doc content contains the wizard text
      const docContent = (friaDoc as Record<string, unknown>).content as string
      expect(docContent).toContain('All job applicants in EU member states')
      expect(docContent).toContain('Potential age and gender bias from training data')
      expect(docContent).toContain('Directly impacts right to non-discrimination and right to work')
      expect(docContent).toContain('Quarterly bias audits, human review for all rejections')

      // 4. generatedFrom has complete FRIA data
      const generatedFrom = (friaDoc as Record<string, unknown>).generatedFrom as Record<string, unknown>
      expect(generatedFrom.source).toBe('wizard')
      expect(generatedFrom.friaData).toEqual({
        affectedGroups: 'All job applicants in EU member states',
        potentialDiscrimination: 'Potential age and gender bias from training data',
        fundamentalRightsImpact: 'Directly impacts right to non-discrimination and right to work',
        mitigationMeasures: 'Quarterly bias audits, human review for all rejections'
      })

      // 5. Audit event was logged
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.system_assessed',
          userId: MOCK_USER.id,
          organizationId: MOCK_ORG.id,
          resourceType: 'ai_system',
          metadata: expect.objectContaining({
            systemName: 'E2E FRIA System',
            riskLevel: 'HIGH'
          })
        })
      )
    })
  })

  describe('Audit Before/After Metadata', () => {
    it('should include before/after in system update audit', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Before After Test',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)
      mockAuditLog.mockClear()

      await app.inject({
        method: 'PUT',
        url: `/v1/compliance/systems/${created.system.id}`,
        headers: AUTH_HEADER,
        payload: {
          name: 'Updated Name',
          complianceStatus: 'COMPLIANT'
        }
      })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.system_updated',
          metadata: expect.objectContaining({
            before: expect.objectContaining({
              name: 'Before After Test'
            }),
            after: expect.objectContaining({
              name: 'Updated Name',
              complianceStatus: 'COMPLIANT'
            })
          })
        })
      )
    })

    it('should include before/after in obligation update audit', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Obligation Diff Test',
          projectId: testProject.id,
          useCaseDescription: 'CV Screening',
          annexIIICategory: 'employment',
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Screen applicants',
          processesPersonalData: true
        }
      })
      const created = JSON.parse(createResponse.body)

      const systemResponse = await app.inject({
        method: 'GET',
        url: `/v1/compliance/systems/${created.system.id}`,
        headers: AUTH_HEADER
      })
      const system = JSON.parse(systemResponse.body)
      const obligationId = system.obligations?.[0]?.id

      if (obligationId) {
        mockAuditLog.mockClear()

        await app.inject({
          method: 'PUT',
          url: `/v1/compliance/obligations/${obligationId}`,
          headers: AUTH_HEADER,
          payload: { status: 'COMPLETED', notes: 'All done' }
        })

        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'compliance.obligation_updated',
            metadata: expect.objectContaining({
              oldStatus: 'PENDING',
              newStatus: 'COMPLETED'
            })
          })
        )
      }
    })

    it('should include before/after in incident update audit', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Incident Diff Test',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)

      const incidentResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/incidents',
        headers: AUTH_HEADER,
        payload: {
          aiSystemId: created.system.id,
          title: 'Severity Change Test',
          description: 'Testing before/after on incident',
          severity: 'LOW',
          type: 'MALFUNCTION',
          occurredAt: new Date().toISOString(),
          detectedAt: new Date().toISOString()
        }
      })
      const incident = JSON.parse(incidentResponse.body)
      mockAuditLog.mockClear()

      await app.inject({
        method: 'PUT',
        url: `/v1/compliance/incidents/${incident.id}`,
        headers: AUTH_HEADER,
        payload: {
          severity: 'CRITICAL',
          rootCause: 'Data pipeline failure'
        }
      })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'compliance.incident_updated',
          metadata: expect.objectContaining({
            before: expect.objectContaining({
              severity: 'LOW'
            }),
            after: expect.objectContaining({
              severity: 'CRITICAL',
              rootCause: 'Data pipeline failure'
            })
          })
        })
      )
    })
  })

  describe('Soft Delete', () => {
    it('should return 204 and set deletedAt (not remove record)', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/compliance/assess',
        headers: AUTH_HEADER,
        payload: {
          name: 'Delete Test System',
          projectId: testProject.id,
          useCaseDescription: 'Test',
          annexIIICategory: null,
          deployedInEU: true,
          affectsEUCitizens: true,
          intendedPurpose: 'Test',
          processesPersonalData: false
        }
      })
      const created = JSON.parse(createResponse.body)
      const systemId = created.system.id

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/compliance/systems/${systemId}`,
        headers: AUTH_HEADER
      })

      expect(deleteResponse.statusCode).toBe(204)

      // Verify record still exists in mock store with deletedAt set
      const deletedSystem = mockAISystems.get(systemId) as Record<string, unknown>
      expect(deletedSystem).toBeDefined()
      expect(deletedSystem.deletedAt).toBeInstanceOf(Date)
    })
  })
})
