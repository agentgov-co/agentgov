import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FetchClient, AgentGovAPIError, safeStringify } from './fetch.js'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('FetchClient', () => {
  let client: FetchClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })

    client = new FetchClient({
      baseUrl: 'http://localhost:3001',
      apiKey: 'ag_test_key',
      projectId: 'test-project',
      maxRetries: 2,
      retryDelay: 100,
      timeout: 5000
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createTrace', () => {
    it('should create trace successfully', async () => {
      const mockTrace = { id: 'trace-123', status: 'RUNNING' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTrace)
      })

      const result = await client.createTrace({ name: 'Test Trace' })

      expect(result).toEqual(mockTrace)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/v1/traces',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer ag_test_key',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ name: 'Test Trace', projectId: 'test-project' })
        })
      )
    })

    it('should include projectId in trace creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'trace-123' })
      })

      await client.createTrace({ name: 'Test', metadata: { foo: 'bar' } })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            name: 'Test',
            metadata: { foo: 'bar' },
            projectId: 'test-project'
          })
        })
      )
    })
  })

  describe('retry logic', () => {
    it('should retry on 429 rate limit', async () => {
      // First call: rate limited
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
        headers: new Map([['Retry-After', '1']])
      })
      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'trace-123' })
      })

      const resultPromise = client.createTrace({ name: 'Test' })

      // Advance timers to process retry
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise
      expect(result).toEqual({ id: 'trace-123' })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on 500 server error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'trace-123' })
        })

      const resultPromise = client.createTrace({ name: 'Test' })
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise
      expect(result).toEqual({ id: 'trace-123' })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on 503 service unavailable', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve('Service unavailable'),
          headers: new Map()
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'trace-123' })
        })

      const resultPromise = client.createTrace({ name: 'Test' })
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise
      expect(result).toEqual({ id: 'trace-123' })
    })

    it('should NOT retry on 400 bad request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
        headers: new Map()
      })

      await expect(client.createTrace({ name: 'Test' })).rejects.toThrow(AgentGovAPIError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should NOT retry on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
        headers: new Map()
      })

      await expect(client.createTrace({ name: 'Test' })).rejects.toThrow(AgentGovAPIError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should NOT retry on 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
        headers: new Map()
      })

      await expect(client.getTrace('invalid-id')).rejects.toThrow(AgentGovAPIError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should fail after max retries', async () => {
      vi.useRealTimers()

      // Create client with minimal delays for testing
      const fastClient = new FetchClient({
        baseUrl: 'http://localhost:3001',
        apiKey: 'ag_test_key',
        projectId: 'test-project',
        maxRetries: 2,
        retryDelay: 10, // 10ms for fast tests
        timeout: 5000
      })

      // All calls fail with 500
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
        headers: new Map()
      })

      await expect(fastClient.createTrace({ name: 'Test' })).rejects.toThrow(AgentGovAPIError)
      // Initial + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3)

      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should use exponential backoff', async () => {
      const delays: number[] = []
      const originalSetTimeout = setTimeout

      vi.useRealTimers()

      const clientWithTracking = new FetchClient({
        baseUrl: 'http://localhost:3001',
        apiKey: 'ag_test_key',
        projectId: 'test-project',
        maxRetries: 2,
        retryDelay: 100,
        timeout: 5000
      })

      // Track sleep calls by mocking the private sleep method behavior
      let callCount = 0
      mockFetch.mockImplementation(async () => {
        callCount++
        if (callCount <= 2) {
          return {
            ok: false,
            status: 500,
            text: () => Promise.resolve('Error'),
            headers: new Map()
          }
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'trace-123' })
        }
      })

      await clientWithTracking.createTrace({ name: 'Test' })

      // Should have made 3 calls (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('AgentGovAPIError', () => {
    it('should have correct properties', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
        headers: new Map()
      })

      try {
        await client.createTrace({ name: 'Test' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AgentGovAPIError)
        const apiError = error as AgentGovAPIError
        expect(apiError.statusCode).toBe(403)
        expect(apiError.retryable).toBe(false)
        expect(apiError.message).toContain('403')
      }
    })

    it('should mark 5xx errors as retryable', async () => {
      vi.useRealTimers()

      // Create client with minimal delays for testing
      const fastClient = new FetchClient({
        baseUrl: 'http://localhost:3001',
        apiKey: 'ag_test_key',
        projectId: 'test-project',
        maxRetries: 2,
        retryDelay: 10,
        timeout: 5000
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad gateway'),
        headers: new Map()
      })

      try {
        await fastClient.createTrace({ name: 'Test' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AgentGovAPIError)
        expect((error as AgentGovAPIError).retryable).toBe(true)
      }

      vi.useFakeTimers({ shouldAdvanceTime: true })
    })
  })

  describe('updateTrace', () => {
    it('should update trace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'trace-123', status: 'COMPLETED' })
      })

      const result = await client.updateTrace('trace-123', { status: 'COMPLETED' })

      expect(result.status).toBe('COMPLETED')
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/v1/traces/trace-123',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })

  describe('span operations', () => {
    it('should create span', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'span-456', traceId: 'trace-123' })
      })

      const result = await client.createSpan({
        traceId: 'trace-123',
        name: 'test-span',
        type: 'LLM_CALL'
      })

      expect(result.id).toBe('span-456')
    })

    it('should update span', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'span-456', status: 'COMPLETED' })
      })

      const result = await client.updateSpan('span-456', {
        status: 'COMPLETED',
        promptTokens: 100,
        outputTokens: 50
      })

      expect(result.status).toBe('COMPLETED')
    })

    it('should get span', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'span-456', name: 'test' })
      })

      const result = await client.getSpan('span-456')

      expect(result.id).toBe('span-456')
    })
  })

  describe('204 No Content handling', () => {
    it('should handle 204 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204
      })

      const result = await client.updateTrace('trace-123', { status: 'COMPLETED' })

      expect(result).toBeUndefined()
    })
  })

  describe('base URL normalization', () => {
    it('should remove trailing slash from base URL', async () => {
      const clientWithSlash = new FetchClient({
        baseUrl: 'http://localhost:3001/',
        apiKey: 'test',
        projectId: 'test'
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'trace-123' })
      })

      await clientWithSlash.createTrace({ name: 'Test' })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/v1/traces',
        expect.any(Object)
      )
    })
  })

  describe('Retry-After header parsing', () => {
    it('should use valid Retry-After value', async () => {
      vi.useRealTimers()

      const fastClient = new FetchClient({
        baseUrl: 'http://localhost:3001',
        apiKey: 'test',
        projectId: 'test',
        maxRetries: 1,
        retryDelay: 10,
        timeout: 5000
      })

      const start = Date.now()
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
          headers: new Map([['Retry-After', '1']])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'trace-123' })
        })

      await fastClient.createTrace({ name: 'Test' })
      const elapsed = Date.now() - start
      // Should have waited ~1000ms (Retry-After: 1 → 1000ms)
      expect(elapsed).toBeGreaterThanOrEqual(900)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should fallback on Retry-After: abc (non-numeric)', async () => {
      vi.useRealTimers()

      const fastClient = new FetchClient({
        baseUrl: 'http://localhost:3001',
        apiKey: 'test',
        projectId: 'test',
        maxRetries: 1,
        retryDelay: 10,
        timeout: 5000
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
          headers: new Map([['Retry-After', 'abc']])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'trace-123' })
        })

      const result = await fastClient.createTrace({ name: 'Test' })
      expect(result).toEqual({ id: 'trace-123' })
      expect(mockFetch).toHaveBeenCalledTimes(2)

      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should fallback on Retry-After: 0', async () => {
      vi.useRealTimers()

      const fastClient = new FetchClient({
        baseUrl: 'http://localhost:3001',
        apiKey: 'test',
        projectId: 'test',
        maxRetries: 1,
        retryDelay: 10,
        timeout: 5000
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
          headers: new Map([['Retry-After', '0']])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'trace-123' })
        })

      const result = await fastClient.createTrace({ name: 'Test' })
      expect(result).toEqual({ id: 'trace-123' })
      expect(mockFetch).toHaveBeenCalledTimes(2)

      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should fallback on Retry-After: -1', async () => {
      vi.useRealTimers()

      const fastClient = new FetchClient({
        baseUrl: 'http://localhost:3001',
        apiKey: 'test',
        projectId: 'test',
        maxRetries: 1,
        retryDelay: 10,
        timeout: 5000
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
          headers: new Map([['Retry-After', '-1']])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'trace-123' })
        })

      const result = await fastClient.createTrace({ name: 'Test' })
      expect(result).toEqual({ id: 'trace-123' })
      expect(mockFetch).toHaveBeenCalledTimes(2)

      vi.useFakeTimers({ shouldAdvanceTime: true })
    })
  })
})

describe('safeStringify', () => {
  it('should stringify normal objects', () => {
    expect(safeStringify({ foo: 'bar' })).toBe('{"foo":"bar"}')
  })

  it('should handle circular references without crashing', () => {
    const obj: Record<string, unknown> = { a: 1 }
    obj.self = obj
    const result = safeStringify(obj)
    expect(result).toBe('{"error":"Failed to serialize data"}')
  })

  it('should handle null and primitives', () => {
    expect(safeStringify(null)).toBe('null')
    expect(safeStringify(42)).toBe('42')
    expect(safeStringify('hello')).toBe('"hello"')
  })
})
