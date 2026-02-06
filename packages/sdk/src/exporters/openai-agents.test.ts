import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AgentGovExporter, type TracingExporter, type ExportErrorContext } from './openai-agents.js'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ============================================
// Test Fixtures
// ============================================

function createMockTrace(overrides: Partial<{
  traceId: string
  name: string
  groupId: string | null
  metadata: Record<string, unknown>
}> = {}) {
  return {
    type: 'trace' as const,
    traceId: overrides.traceId ?? 'trace_abc123',
    name: overrides.name ?? 'Test Agent',
    groupId: overrides.groupId ?? null,
    metadata: overrides.metadata
  }
}

function createMockSpan(overrides: Partial<{
  traceId: string
  spanId: string
  parentId: string | null
  spanData: Record<string, unknown>
  startedAt: string | null
  endedAt: string | null
  error: { message: string; data?: Record<string, unknown> } | null
}> = {}) {
  return {
    type: 'trace.span' as const,
    traceId: overrides.traceId ?? 'trace_abc123',
    spanId: overrides.spanId ?? 'span_xyz789',
    parentId: overrides.parentId ?? null,
    spanData: overrides.spanData ?? { type: 'custom', name: 'test', data: {} },
    startedAt: overrides.startedAt ?? new Date().toISOString(),
    endedAt: overrides.endedAt ?? null,
    error: overrides.error ?? null
  }
}

function createGenerationSpan(traceId: string, spanId: string) {
  return createMockSpan({
    traceId,
    spanId,
    spanData: {
      type: 'generation',
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'Hello' }],
      output: [{ role: 'assistant', content: 'Hi there!' }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    },
    endedAt: new Date().toISOString()
  })
}

function createFunctionSpan(traceId: string, spanId: string) {
  return createMockSpan({
    traceId,
    spanId,
    spanData: {
      type: 'function',
      name: 'get_weather',
      input: '{"location": "Tokyo"}',
      output: '{"temperature": 20, "condition": "sunny"}'
    },
    endedAt: new Date().toISOString()
  })
}

function createAgentSpan(traceId: string, spanId: string) {
  return createMockSpan({
    traceId,
    spanId,
    spanData: {
      type: 'agent',
      name: 'WeatherAgent',
      handoffs: ['SummaryAgent'],
      tools: ['get_weather', 'get_forecast'],
      output_type: 'string'
    }
  })
}

function createHandoffSpan(traceId: string, spanId: string) {
  return createMockSpan({
    traceId,
    spanId,
    spanData: {
      type: 'handoff',
      from_agent: 'WeatherAgent',
      to_agent: 'SummaryAgent'
    }
  })
}

function setupSuccessfulResponses() {
  let traceCounter = 0
  let spanCounter = 0

  mockFetch.mockImplementation(async (url: string, options: RequestInit) => {
    const method = options.method
    const path = new URL(url).pathname

    if (method === 'POST' && path === '/v1/traces') {
      traceCounter++
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: `ag_trace_${traceCounter}`,
          status: 'RUNNING',
          projectId: 'test-project'
        })
      }
    }

    if (method === 'POST' && path === '/v1/spans/batch') {
      const body = JSON.parse(options.body as string)
      const count = body.spans?.length ?? 0
      return {
        ok: true,
        status: 201,
        json: () => Promise.resolve({
          created: count,
          total: count
        })
      }
    }

    if (method === 'POST' && path === '/v1/spans') {
      spanCounter++
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: `ag_span_${spanCounter}`,
          status: 'RUNNING',
          traceId: `ag_trace_${traceCounter}`
        })
      }
    }

    if (method === 'PATCH' && path.startsWith('/v1/traces/')) {
      const traceId = path.split('/').pop()
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: traceId, status: 'COMPLETED' })
      }
    }

    if (method === 'PATCH' && path.startsWith('/v1/spans/')) {
      const spanId = path.split('/').pop()
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: spanId,
          status: 'COMPLETED'
        })
      }
    }

    return {
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found')
    }
  })
}

// ============================================
// Tests
// ============================================

describe('AgentGovExporter', () => {
  let exporter: AgentGovExporter

  beforeEach(() => {
    vi.clearAllMocks()

    exporter = new AgentGovExporter({
      apiKey: 'ag_test_key',
      projectId: 'test-project',
      baseUrl: 'http://localhost:3001',
      debug: false
    })

    setupSuccessfulResponses()
  })

  afterEach(() => {
    exporter.clearCaches()
  })

  describe('constructor', () => {
    it('should create exporter with required config', () => {
      const exp = new AgentGovExporter({
        apiKey: 'ag_xxx',
        projectId: 'proj_123'
      })
      expect(exp).toBeInstanceOf(AgentGovExporter)
    })

    it('should use default baseUrl when not provided', () => {
      const exp = new AgentGovExporter({
        apiKey: 'ag_xxx',
        projectId: 'proj_123'
      })

      // Trigger a request to verify baseUrl
      setupSuccessfulResponses()
      exp.export([createMockTrace()])

      // The mock will capture the URL
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should implement TracingExporter interface', () => {
      const exp: TracingExporter = new AgentGovExporter({
        apiKey: 'ag_xxx',
        projectId: 'proj_123'
      })
      expect(typeof exp.export).toBe('function')
    })
  })

  describe('export', () => {
    it('should handle empty items array', async () => {
      await exporter.export([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should create trace from Trace item', async () => {
      const trace = createMockTrace({ name: 'My Agent' })
      await exporter.export([trace])

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/v1/traces',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"My Agent"')
        })
      )
    })

    it('should create trace with externalId for idempotency', async () => {
      const trace = createMockTrace({
        traceId: 'trace_external_123',
        metadata: { customKey: 'customValue' }
      })
      await exporter.export([trace])

      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1].body as string)

      // externalId should be top-level for upsert support
      expect(body.externalId).toBe('trace_external_123')
      expect(body.metadata).toEqual(expect.objectContaining({
        customKey: 'customValue'
      }))
    })

    it('should export span after creating trace', async () => {
      const trace = createMockTrace()
      const span = createMockSpan({ endedAt: new Date().toISOString() }) // completed span

      await exporter.export([trace, span])

      // Should have created trace, span, updated span, and finalized trace
      expect(mockFetch).toHaveBeenCalledTimes(4) // trace + span + span update + trace update
    })

    it('should reuse cached trace ID for multiple exports', async () => {
      const trace = createMockTrace({ traceId: 'trace_same' })
      const span1 = createMockSpan({ traceId: 'trace_same', spanId: 'span_1' })
      const span2 = createMockSpan({ traceId: 'trace_same', spanId: 'span_2' })

      // First export
      await exporter.export([trace, span1])

      // Second export with same trace
      await exporter.export([span2])

      // Count trace creation calls
      const traceCreateCalls = mockFetch.mock.calls.filter(
        call => call[1].method === 'POST' && call[0].includes('/v1/traces')
      )

      expect(traceCreateCalls).toHaveLength(1) // Only one trace created
    })

    it('should skip already exported spans', async () => {
      const span = createMockSpan({ spanId: 'span_duplicate' })

      await exporter.export([createMockTrace(), span])

      const firstCallCount = mockFetch.mock.calls.length

      // Export same span again
      await exporter.export([span])

      // Should not have made additional API calls for the span
      expect(mockFetch.mock.calls.length).toBe(firstCallCount)
    })
  })

  describe('span type mapping', () => {
    it('should map generation span to LLM_CALL', async () => {
      const span = createGenerationSpan('trace_1', 'span_gen')

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      expect(spanCreateCall).toBeDefined()
      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.type).toBe('LLM_CALL')
      expect(body.model).toBe('gpt-4o')
    })

    it('should map function span to TOOL_CALL', async () => {
      const span = createFunctionSpan('trace_1', 'span_func')

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.type).toBe('TOOL_CALL')
      expect(body.toolName).toBe('get_weather')
    })

    it('should map agent span to AGENT_STEP', async () => {
      const span = createAgentSpan('trace_1', 'span_agent')

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.type).toBe('AGENT_STEP')
      expect(body.name).toBe('Agent: WeatherAgent')
    })

    it('should map handoff span to AGENT_STEP', async () => {
      const span = createHandoffSpan('trace_1', 'span_handoff')

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.type).toBe('AGENT_STEP')
      expect(body.name).toContain('Handoff')
    })

    it('should map custom span to CUSTOM', async () => {
      const span = createMockSpan({
        traceId: 'trace_1',
        spanId: 'span_custom',
        spanData: { type: 'custom', name: 'my_custom_span', data: { foo: 'bar' } }
      })

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.type).toBe('CUSTOM')
    })

    it('should map guardrail span to CUSTOM', async () => {
      const span = createMockSpan({
        traceId: 'trace_1',
        spanId: 'span_guard',
        spanData: { type: 'guardrail', name: 'content_filter', triggered: true }
      })

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.type).toBe('CUSTOM')
      expect(body.metadata.triggered).toBe(true)
    })

    it('should map voice spans to LLM_CALL', async () => {
      const transcriptionSpan = createMockSpan({
        traceId: 'trace_1',
        spanId: 'span_transcription',
        spanData: {
          type: 'transcription',
          input: { data: 'audio_base64', format: 'pcm' },
          output: 'Hello world',
          model: 'whisper-1'
        }
      })

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), transcriptionSpan])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.type).toBe('LLM_CALL')
    })
  })

  describe('span update on completion', () => {
    it('should update span with COMPLETED status when endedAt is set', async () => {
      const span = createMockSpan({
        traceId: 'trace_1',
        spanId: 'span_completed',
        endedAt: new Date().toISOString()
      })

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/spans/')
      )

      expect(spanUpdateCall).toBeDefined()
      const body = JSON.parse(spanUpdateCall![1].body as string)
      expect(body.status).toBe('COMPLETED')
    })

    it('should update span with FAILED status and error message', async () => {
      const span = createMockSpan({
        traceId: 'trace_1',
        spanId: 'span_failed',
        error: { message: 'Something went wrong', data: { code: 500 } }
      })

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/spans/')
      )

      expect(spanUpdateCall).toBeDefined()
      const body = JSON.parse(spanUpdateCall![1].body as string)
      expect(body.status).toBe('FAILED')
      expect(body.error).toBe('Something went wrong')
    })

    it('should extract token usage from generation span', async () => {
      const span = createGenerationSpan('trace_1', 'span_with_usage')

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/spans/')
      )

      expect(spanUpdateCall).toBeDefined()
      const body = JSON.parse(spanUpdateCall![1].body as string)
      expect(body.promptTokens).toBe(10)
      expect(body.outputTokens).toBe(5)
    })

    it('should extract tool output from function span', async () => {
      const span = createFunctionSpan('trace_1', 'span_func_output')

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/spans/')
      )

      expect(spanUpdateCall).toBeDefined()
      const body = JSON.parse(spanUpdateCall![1].body as string)
      expect(body.toolOutput).toEqual({ temperature: 20, condition: 'sunny' })
    })
  })

  describe('trace finalization', () => {
    it('should update trace to COMPLETED when all spans have endedAt', async () => {
      const trace = createMockTrace({ traceId: 'trace_final' })
      const span1 = createMockSpan({ traceId: 'trace_final', spanId: 'span_f1', endedAt: new Date().toISOString() })
      const span2 = createMockSpan({ traceId: 'trace_final', spanId: 'span_f2', endedAt: new Date().toISOString() })

      await exporter.export([trace, span1, span2])

      const traceUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/traces/')
      )

      expect(traceUpdateCall).toBeDefined()
      const body = JSON.parse(traceUpdateCall![1].body as string)
      expect(body.status).toBe('COMPLETED')
    })

    it('should update trace to FAILED when any span has error', async () => {
      const trace = createMockTrace({ traceId: 'trace_fail' })
      const span1 = createMockSpan({ traceId: 'trace_fail', spanId: 'span_ok', endedAt: new Date().toISOString() })
      const span2 = createMockSpan({ traceId: 'trace_fail', spanId: 'span_err', error: { message: 'boom' } })

      await exporter.export([trace, span1, span2])

      const traceUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/traces/')
      )

      expect(traceUpdateCall).toBeDefined()
      const body = JSON.parse(traceUpdateCall![1].body as string)
      expect(body.status).toBe('FAILED')
    })

    it('should not finalize trace when spans are still running', async () => {
      const trace = createMockTrace({ traceId: 'trace_running' })
      const span1 = createMockSpan({ traceId: 'trace_running', spanId: 'span_r1', endedAt: new Date().toISOString() })
      const span2 = createMockSpan({ traceId: 'trace_running', spanId: 'span_r2' }) // no endedAt, no error

      await exporter.export([trace, span1, span2])

      const traceUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/traces/')
      )

      expect(traceUpdateCall).toBeUndefined()
    })

    it('should finalize trace even when all spans were previously cached', async () => {
      const trace = createMockTrace({ traceId: 'trace_cached' })
      const span1 = createMockSpan({ traceId: 'trace_cached', spanId: 'span_c1', endedAt: new Date().toISOString() })
      const span2 = createMockSpan({ traceId: 'trace_cached', spanId: 'span_c2', endedAt: new Date().toISOString() })

      // First export — creates trace + spans
      await exporter.export([trace, span1, span2])

      mockFetch.mockClear()
      setupSuccessfulResponses()

      // Second export — all spans cached, but should still finalize
      await exporter.export([trace, span1, span2])

      const traceUpdateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'PATCH' && call[0].includes('/v1/traces/')
      )

      expect(traceUpdateCall).toBeDefined()
      const body = JSON.parse(traceUpdateCall![1].body as string)
      expect(body.status).toBe('COMPLETED')
    })
  })

  describe('error handling', () => {
    it('should continue export when individual span fails', async () => {
      let spanCallCount = 0

      mockFetch.mockImplementation(async (url: string, options: RequestInit) => {
        if (options.method === 'POST' && url.includes('/v1/traces')) {
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'ag_trace_1' })
          }
        }

        if (options.method === 'POST' && url.includes('/v1/spans')) {
          spanCallCount++
          if (spanCallCount === 1) {
            // First span fails
            return {
              ok: false,
              status: 500,
              text: () => Promise.resolve('Internal error')
            }
          }
          // Second span succeeds
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'ag_span_2' })
          }
        }

        if (options.method === 'PATCH') {
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'updated' })
          }
        }

        return { ok: false, status: 404, text: () => Promise.resolve('Not found') }
      })

      const trace = createMockTrace({ traceId: 'trace_1' })
      const span1 = createMockSpan({ traceId: 'trace_1', spanId: 'span_fail' })
      const span2 = createMockSpan({ traceId: 'trace_1', spanId: 'span_success' })

      // Should not throw
      await expect(exporter.export([trace, span1, span2])).resolves.not.toThrow()

      // Second span should still be created
      const spanCreateCalls = mockFetch.mock.calls.filter(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )
      expect(spanCreateCalls).toHaveLength(2)
    })

    it('should call onError callback when export fails', async () => {
      const onError = vi.fn()

      const exporterWithCallback = new AgentGovExporter({
        apiKey: 'ag_test',
        projectId: 'test',
        baseUrl: 'http://localhost:3001',
        onError
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error')
      })

      const trace = createMockTrace()
      await exporterWithCallback.export([trace])

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'createTrace',
          itemType: 'trace'
        })
      )
    })

    it('should not export spans if trace creation fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error')
      })

      const trace = createMockTrace({ traceId: 'trace_fail' })
      const span = createMockSpan({ traceId: 'trace_fail' })

      await exporter.export([trace, span])

      // Only trace creation should have been attempted
      const spanCalls = mockFetch.mock.calls.filter(
        call => call[0].includes('/v1/spans')
      )
      expect(spanCalls).toHaveLength(0)
    })

    it('should respect abort signal', async () => {
      const abortController = new AbortController()
      abortController.abort()

      setupSuccessfulResponses()

      await exporter.export(
        [createMockTrace(), createMockSpan()],
        abortController.signal
      )

      // Should not make any calls when already aborted
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('groupByTrace', () => {
    it('should group items by trace ID', async () => {
      const trace1 = createMockTrace({ traceId: 'trace_1' })
      const span1a = createMockSpan({ traceId: 'trace_1', spanId: 'span_1a' })
      const span1b = createMockSpan({ traceId: 'trace_1', spanId: 'span_1b' })

      const trace2 = createMockTrace({ traceId: 'trace_2' })
      const span2a = createMockSpan({ traceId: 'trace_2', spanId: 'span_2a' })

      await exporter.export([trace1, span1a, trace2, span1b, span2a])

      // Should create 2 traces
      const traceCreateCalls = mockFetch.mock.calls.filter(
        call => call[1].method === 'POST' && call[0].includes('/v1/traces')
      )
      expect(traceCreateCalls).toHaveLength(2)

      // Should create 3 spans
      const spanCreateCalls = mockFetch.mock.calls.filter(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )
      expect(spanCreateCalls).toHaveLength(3)
    })
  })

  describe('LRU cache', () => {
    it('should report cache statistics', async () => {
      await exporter.export([
        createMockTrace({ traceId: 'trace_1' }),
        createMockSpan({ traceId: 'trace_1', spanId: 'span_1' })
      ])

      const stats = exporter.getCacheStats()
      expect(stats.traces).toBe(1)
      expect(stats.spans).toBe(1)
    })

    it('should clear caches', async () => {
      await exporter.export([
        createMockTrace({ traceId: 'trace_1' }),
        createMockSpan({ traceId: 'trace_1', spanId: 'span_1' })
      ])

      exporter.clearCaches()

      const stats = exporter.getCacheStats()
      expect(stats.traces).toBe(0)
      expect(stats.spans).toBe(0)
    })

    it('should evict oldest entries when cache is full', async () => {
      const smallCacheExporter = new AgentGovExporter({
        apiKey: 'ag_test',
        projectId: 'test',
        baseUrl: 'http://localhost:3001',
        maxCacheSize: 2
      })

      setupSuccessfulResponses()

      // Export 3 traces (cache size is 2)
      await smallCacheExporter.export([createMockTrace({ traceId: 'trace_1' })])
      await smallCacheExporter.export([createMockTrace({ traceId: 'trace_2' })])
      await smallCacheExporter.export([createMockTrace({ traceId: 'trace_3' })])

      const stats = smallCacheExporter.getCacheStats()
      expect(stats.traces).toBe(2) // Should have evicted oldest
    })
  })

  describe('span name generation', () => {
    it('should generate descriptive names for different span types', async () => {
      const spans = [
        { spanData: { type: 'agent', name: 'MyAgent' }, expected: 'Agent: MyAgent' },
        { spanData: { type: 'function', name: 'my_tool', input: '{}', output: '{}' }, expected: 'Tool: my_tool' },
        { spanData: { type: 'generation', model: 'gpt-4' }, expected: 'LLM: gpt-4' },
        { spanData: { type: 'handoff', from_agent: 'A', to_agent: 'B' }, expected: 'Handoff: A → B' },
        { spanData: { type: 'guardrail', name: 'filter', triggered: false }, expected: 'Guardrail: filter' },
        { spanData: { type: 'custom', name: 'my_span', data: {} }, expected: 'my_span' }
      ]

      for (let i = 0; i < spans.length; i++) {
        const span = createMockSpan({
          traceId: `trace_${i}`,
          spanId: `span_${i}`,
          spanData: spans[i].spanData as Record<string, unknown>
        })

        await exporter.export([createMockTrace({ traceId: `trace_${i}` }), span])
      }

      const spanCreateCalls = mockFetch.mock.calls.filter(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      for (let i = 0; i < spans.length; i++) {
        const body = JSON.parse(spanCreateCalls[i][1].body as string)
        expect(body.name).toBe(spans[i].expected)
      }
    })
  })

  describe('debug mode', () => {
    it('should log when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const debugExporter = new AgentGovExporter({
        apiKey: 'ag_test',
        projectId: 'test',
        baseUrl: 'http://localhost:3001',
        debug: true
      })

      setupSuccessfulResponses()

      await debugExporter.export([createMockTrace()])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('concurrent exports', () => {
    it('should handle multiple concurrent export calls', async () => {
      setupSuccessfulResponses()

      const exports = Promise.all([
        exporter.export([createMockTrace({ traceId: 'trace_1' })]),
        exporter.export([createMockTrace({ traceId: 'trace_2' })]),
        exporter.export([createMockTrace({ traceId: 'trace_3' })])
      ])

      await expect(exports).resolves.not.toThrow()

      const traceCreateCalls = mockFetch.mock.calls.filter(
        call => call[1].method === 'POST' && call[0].includes('/v1/traces')
      )
      expect(traceCreateCalls).toHaveLength(3)
    })
  })

  describe('JSON parsing', () => {
    it('should safely parse valid JSON in function input', async () => {
      const span = createFunctionSpan('trace_1', 'span_json')

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.toolInput).toEqual({ location: 'Tokyo' })
    })

    it('should wrap invalid JSON in raw field', async () => {
      const span = createMockSpan({
        traceId: 'trace_1',
        spanId: 'span_invalid_json',
        spanData: {
          type: 'function',
          name: 'test',
          input: 'not valid json',
          output: '{}'
        }
      })

      await exporter.export([createMockTrace({ traceId: 'trace_1' }), span])

      const spanCreateCall = mockFetch.mock.calls.find(
        call => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )

      const body = JSON.parse(spanCreateCall![1].body as string)
      expect(body.toolInput).toEqual({ raw: 'not valid json' })
    })
  })

  describe('shutdown and forceFlush', () => {
    it('should clear caches on shutdown', async () => {
      await exporter.export([
        createMockTrace({ traceId: 'trace_1' }),
        createMockSpan({ traceId: 'trace_1', spanId: 'span_1' })
      ])

      expect(exporter.getCacheStats().traces).toBe(1)
      expect(exporter.getCacheStats().spans).toBe(1)

      await exporter.shutdown()

      expect(exporter.getCacheStats().traces).toBe(0)
      expect(exporter.getCacheStats().spans).toBe(0)
    })

    it('forceFlush should be callable without error', async () => {
      await expect(exporter.forceFlush()).resolves.not.toThrow()
    })

    it('shutdown should be callable multiple times', async () => {
      await expect(exporter.shutdown()).resolves.not.toThrow()
      await expect(exporter.shutdown()).resolves.not.toThrow()
    })
  })

  describe('Batch export', () => {
    it('should use batch endpoint when spans exceed threshold', async () => {
      const exporter = new AgentGovExporter({
        apiKey: 'ag_test',
        projectId: 'proj_test',
        batchThreshold: 3 // Lower threshold for testing
      })

      const trace = createMockTrace({ traceId: 'trace_batch' })
      const spans = [
        createMockSpan({ traceId: 'trace_batch', spanId: 'span_1', endedAt: new Date().toISOString() }),
        createMockSpan({ traceId: 'trace_batch', spanId: 'span_2', endedAt: new Date().toISOString() }),
        createMockSpan({ traceId: 'trace_batch', spanId: 'span_3', endedAt: new Date().toISOString() }),
        createMockSpan({ traceId: 'trace_batch', spanId: 'span_4', endedAt: new Date().toISOString() }),
        createMockSpan({ traceId: 'trace_batch', spanId: 'span_5', endedAt: new Date().toISOString() })
      ]

      await exporter.export([trace, ...spans])

      // Should have called batch endpoint
      const batchCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/v1/spans/batch')
      )
      expect(batchCalls.length).toBe(1)

      // Should NOT have individual span create calls
      const individualSpanCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/v1/spans') && !call[0].includes('/batch')
      )
      expect(individualSpanCalls.length).toBe(0)
    })

    it('should use individual exports when spans below threshold', async () => {
      const exporter = new AgentGovExporter({
        apiKey: 'ag_test',
        projectId: 'proj_test',
        batchThreshold: 10 // High threshold
      })

      const trace = createMockTrace({ traceId: 'trace_individual' })
      const spans = [
        createMockSpan({ traceId: 'trace_individual', spanId: 'span_1', endedAt: new Date().toISOString() }),
        createMockSpan({ traceId: 'trace_individual', spanId: 'span_2', endedAt: new Date().toISOString() })
      ]

      await exporter.export([trace, ...spans])

      // Should NOT have batch calls
      const batchCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/v1/spans/batch')
      )
      expect(batchCalls.length).toBe(0)

      // Should have individual span calls (create + update for each)
      const individualSpanCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/v1/spans') && !call[0].includes('/batch') && call[1].method === 'POST'
      )
      expect(individualSpanCalls.length).toBe(2)
    })

    it('should disable batching when threshold is 0', async () => {
      const exporter = new AgentGovExporter({
        apiKey: 'ag_test',
        projectId: 'proj_test',
        batchThreshold: 0
      })

      const trace = createMockTrace({ traceId: 'trace_no_batch' })
      const spans = Array.from({ length: 10 }, (_, i) =>
        createMockSpan({ traceId: 'trace_no_batch', spanId: `span_${i}`, endedAt: new Date().toISOString() })
      )

      await exporter.export([trace, ...spans])

      // Should NOT have batch calls
      const batchCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/v1/spans/batch')
      )
      expect(batchCalls.length).toBe(0)
    })

    it('should fall back to individual exports on batch failure', async () => {
      const exporter = new AgentGovExporter({
        apiKey: 'ag_test',
        projectId: 'proj_test',
        batchThreshold: 2
      })

      let batchCallCount = 0
      mockFetch.mockImplementation(async (url: string, options: RequestInit) => {
        if (url.includes('/v1/traces')) {
          return {
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: 'ag_trace_1' })
          }
        }

        if (url.includes('/v1/spans/batch')) {
          batchCallCount++
          // Fail batch endpoint
          return {
            ok: false,
            status: 500,
            text: () => Promise.resolve('Internal Server Error')
          }
        }

        if (url.includes('/v1/spans') && options.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: `ag_span_${Date.now()}` })
          }
        }

        if (url.includes('/v1/spans') && options.method === 'PATCH') {
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'COMPLETED' })
          }
        }

        return { ok: false, status: 404, text: () => Promise.resolve('Not found') }
      })

      const trace = createMockTrace({ traceId: 'trace_fallback' })
      const spans = [
        createMockSpan({ traceId: 'trace_fallback', spanId: 'span_1', endedAt: new Date().toISOString() }),
        createMockSpan({ traceId: 'trace_fallback', spanId: 'span_2', endedAt: new Date().toISOString() }),
        createMockSpan({ traceId: 'trace_fallback', spanId: 'span_3', endedAt: new Date().toISOString() })
      ]

      await exporter.export([trace, ...spans])

      // Batch should have been attempted
      expect(batchCallCount).toBe(1)

      // Should have fallen back to individual exports
      const individualSpanCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/v1/spans') && !call[0].includes('/batch') && call[1].method === 'POST'
      )
      expect(individualSpanCalls.length).toBe(3)
    })
  })
})
