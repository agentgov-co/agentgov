import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentGov } from './client.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AgentGov', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('constructor', () => {
    it('should create client with required config', () => {
      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      expect(ag).toBeInstanceOf(AgentGov)
    })

    it('should use default baseUrl', () => {
      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      // Context should be null initially
      expect(ag.getContext()).toBeNull()
    })

    it('should accept custom config', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123',
        baseUrl: 'http://custom:8080',
        debug: true,
        flushInterval: 1000,
        batchSize: 5
      })

      expect(ag).toBeInstanceOf(AgentGov)
      warnSpy.mockRestore()
    })

    it('should warn for non-HTTPS non-localhost URL', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123',
        baseUrl: 'http://prod.example.com'
      })

      expect(warnSpy).toHaveBeenCalledWith(
        '[AgentGov] WARNING: Using non-HTTPS URL. This is insecure in production.'
      )
      warnSpy.mockRestore()
    })

    it('should NOT warn for HTTPS URL', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123',
        baseUrl: 'https://api.agentgov.io'
      })

      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should NOT warn for localhost URL', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123',
        baseUrl: 'http://localhost:3001'
      })

      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should NOT warn for 127.0.0.1 URL', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123',
        baseUrl: 'http://127.0.0.1:3001'
      })

      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('context management', () => {
    it('should get and set context', () => {
      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      expect(ag.getContext()).toBeNull()

      ag.setContext({ traceId: 'trace_123' })
      expect(ag.getContext()).toEqual({ traceId: 'trace_123' })

      ag.setContext({ traceId: 'trace_456', spanId: 'span_789' })
      expect(ag.getContext()).toEqual({ traceId: 'trace_456', spanId: 'span_789' })

      ag.setContext(null)
      expect(ag.getContext()).toBeNull()
    })
  })

  describe('trace', () => {
    it('should create trace and set context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'trace_created',
          projectId: 'proj_123',
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        })
      })

      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      const trace = await ag.trace({ name: 'Test Trace' })

      expect(trace.id).toBe('trace_created')
      expect(ag.getContext()).toEqual({ traceId: 'trace_created' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/traces'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer ag_test_key'
          })
        })
      )
    })
  })

  describe('endTrace', () => {
    it('should update trace and clear context', async () => {
      // First create trace
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'trace_123',
          projectId: 'proj_123',
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        })
      })

      // Then update trace
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'trace_123',
          projectId: 'proj_123',
          status: 'COMPLETED',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString()
        })
      })

      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      const trace = await ag.trace({ name: 'Test' })
      expect(ag.getContext()?.traceId).toBe('trace_123')

      const updated = await ag.endTrace(trace.id, { status: 'COMPLETED' })

      expect(updated.status).toBe('COMPLETED')
      expect(ag.getContext()).toBeNull()
    })
  })

  describe('span', () => {
    it('should throw error when no trace context', async () => {
      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      await expect(
        ag.span({ name: 'Test Span', type: 'LLM_CALL' })
      ).rejects.toThrow('No active trace')
    })

    it('should create span with trace context', async () => {
      // Create trace
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'trace_123',
          projectId: 'proj_123',
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        })
      })

      // Create span
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'span_456',
          traceId: 'trace_123',
          name: 'Test Span',
          type: 'LLM_CALL',
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        })
      })

      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      await ag.trace({ name: 'Test' })
      const span = await ag.span({ name: 'Test Span', type: 'LLM_CALL' })

      expect(span.id).toBe('span_456')
      expect(span.traceId).toBe('trace_123')
    })
  })

  describe('withTrace', () => {
    it('should execute function within trace context', async () => {
      // Create trace
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'trace_123',
          projectId: 'proj_123',
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        })
      })

      // Update trace (complete)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'trace_123',
          projectId: 'proj_123',
          status: 'COMPLETED',
          startedAt: new Date().toISOString()
        })
      })

      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      const result = await ag.withTrace({ name: 'Test' }, async (ctx) => {
        expect(ctx.traceId).toBe('trace_123')
        return 'success'
      })

      expect(result).toBe('success')
      expect(ag.getContext()).toBeNull()
    })

    it('should mark trace as failed on error', async () => {
      // Create trace
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'trace_123',
          projectId: 'proj_123',
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        })
      })

      // Update trace (failed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'trace_123',
          projectId: 'proj_123',
          status: 'FAILED',
          startedAt: new Date().toISOString()
        })
      })

      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      await expect(
        ag.withTrace({ name: 'Test' }, async () => {
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')

      // Verify trace was marked as failed
      const lastCall = mockFetch.mock.calls[1]
      const body = JSON.parse(lastCall[1].body)
      expect(body.status).toBe('FAILED')
    })
  })

  describe('batching', () => {
    it('should queue and flush traces', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'trace_queued',
          projectId: 'proj_123',
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        })
      })

      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123',
        batchSize: 10,
        flushInterval: 100
      })

      // Queue multiple traces
      const promises = [
        ag.queueTrace({ name: 'Trace 1' }),
        ag.queueTrace({ name: 'Trace 2' }),
        ag.queueTrace({ name: 'Trace 3' })
      ]

      // Force flush
      await ag.flush()

      const results = await Promise.all(promises)
      expect(results).toHaveLength(3)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('wrapOpenAI', () => {
    it('should return wrapped client', () => {
      const ag = new AgentGov({
        apiKey: 'ag_test_key',
        projectId: 'proj_123'
      })

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn()
          }
        },
        embeddings: {
          create: vi.fn()
        }
      }

      const wrapped = ag.wrapOpenAI(mockOpenAI)

      expect(wrapped).toBeDefined()
      expect(wrapped.chat.completions.create).toBeDefined()
      expect(wrapped.embeddings.create).toBeDefined()
    })
  })
})
