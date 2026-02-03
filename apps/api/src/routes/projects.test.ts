import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomBytes } from 'crypto'

// Mock data store
const mockProjects: Map<string, Record<string, unknown>> = new Map()

// Mock user and organization for session auth
const MOCK_USER = { id: 'user_123', email: 'test@example.com', name: 'Test User' }
const MOCK_ORG = { id: 'org_123', name: 'Test Org', role: 'OWNER' }

// Mock prisma module
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    project: {
      findMany: vi.fn(() => Promise.resolve(Array.from(mockProjects.values()))),
      findUnique: vi.fn(({ where }) => {
        if (where.id) {
          return Promise.resolve(mockProjects.get(where.id) || null)
        }
        return Promise.resolve(null)
      }),
      create: vi.fn(({ data }) => {
        const project = {
          id: `proj_${randomBytes(8).toString('hex')}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        mockProjects.set(project.id, project)
        return Promise.resolve(project)
      }),
      delete: vi.fn(({ where }) => {
        const project = mockProjects.get(where.id)
        if (!project) return Promise.reject(new Error('Not found'))
        mockProjects.delete(where.id)
        return Promise.resolve(project)
      })
    }
  }
}))

// Mock auth middleware with proper async signature
vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer session_')) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    (request as unknown as Record<string, unknown>).user = MOCK_USER
  },
  requireOrganization: async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as unknown as Record<string, unknown>).user
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    (request as unknown as Record<string, unknown>).organization = MOCK_ORG
  }
}))

// Mock usage middleware - allow all operations in tests
vi.mock('../middleware/usage.js', () => ({
  checkProjectLimit: async () => {
    // Allow all project creation in tests
  },
  checkTraceLimit: async () => {
    // Allow all trace creation in tests
  },
  checkMemberLimit: async () => {
    // Allow all member operations in tests
  }
}))

// Import after mocks
import { projectRoutes } from './projects.js'

describe('Projects API', () => {
  let app: FastifyInstance
  const AUTH_HEADER = { authorization: 'Bearer session_valid_token' }

  beforeAll(async () => {
    app = Fastify()
    await app.register(projectRoutes, { prefix: '/v1/projects' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockProjects.clear()
  })

  describe('Authentication', () => {
    it('should reject requests without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/projects'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject requests with invalid auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/projects',
        headers: {
          authorization: 'Bearer wrong_token'
        }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should accept requests with valid session token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/projects',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /v1/projects', () => {
    it('should create a project', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: AUTH_HEADER,
        payload: {
          name: 'My Project',
          description: 'Test project'
        }
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.id).toBeDefined()
      expect(body.name).toBe('My Project')
      expect(body.apiKey).toBeDefined()
      expect(body.apiKey).toMatch(/^ag_/)
    })

    it('should reject invalid project data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: AUTH_HEADER,
        payload: {
          // Missing name
          description: 'Test'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject project name exceeding max length', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: AUTH_HEADER,
        payload: {
          name: 'a'.repeat(101) // > 100 chars
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /v1/projects', () => {
    it('should list all projects', async () => {
      // Create some projects
      await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: AUTH_HEADER,
        payload: { name: 'Project 1' }
      })
      await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: AUTH_HEADER,
        payload: { name: 'Project 2' }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/v1/projects',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(2)
    })
  })

  describe('GET /v1/projects/:id', () => {
    it('should get a project by ID', async () => {
      // Create a project first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: AUTH_HEADER,
        payload: { name: 'Test Project' }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'GET',
        url: `/v1/projects/${created.id}`,
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.id).toBe(created.id)
      expect(body.name).toBe('Test Project')
    })

    it('should return 404 for non-existent project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/projects/nonexistent',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('DELETE /v1/projects/:id', () => {
    it('should delete a project', async () => {
      // Create a project first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: AUTH_HEADER,
        payload: { name: 'To Delete' }
      })
      const created = JSON.parse(createResponse.body)

      const response = await app.inject({
        method: 'DELETE',
        url: `/v1/projects/${created.id}`,
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(204)

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/v1/projects/${created.id}`,
        headers: AUTH_HEADER
      })
      expect(getResponse.statusCode).toBe(404)
    })

    it('should return 404 for non-existent project', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/projects/nonexistent',
        headers: AUTH_HEADER
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
