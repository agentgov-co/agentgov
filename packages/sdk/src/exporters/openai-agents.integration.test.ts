/**
 * Integration tests for AgentGovExporter with @openai/agents
 *
 * These tests verify compatibility with the real @openai/agents types
 * and ensure the exporter works correctly with BatchTraceProcessor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AgentGovExporter } from './openai-agents.js'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ============================================
// Simulated @openai/agents types (matching real SDK)
// ============================================

// These types mirror the actual @openai/agents types
// to ensure our exporter is compatible

interface Trace {
  type: 'trace'
  traceId: string
  name: string
  groupId: string | null
  metadata?: Record<string, unknown>
}

interface Span {
  type: 'trace.span'
  traceId: string
  spanId: string
  parentId: string | null
  spanData: SpanData
  startedAt: string | null
  endedAt: string | null
  error: { message: string; data?: Record<string, unknown> } | null
}

type SpanData =
  | { type: 'agent'; name: string; handoffs?: string[]; tools?: string[]; output_type?: string }
  | { type: 'function'; name: string; input: string; output: string; mcp_data?: string }
  | {
      type: 'generation'
      input?: Array<Record<string, unknown>>
      output?: Array<Record<string, unknown>>
      model?: string
      model_config?: Record<string, unknown>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
  | { type: 'response'; response_id?: string; _input?: string | Record<string, unknown>[]; _response?: Record<string, unknown> }
  | { type: 'handoff'; from_agent?: string; to_agent?: string }
  | { type: 'custom'; name: string; data: Record<string, unknown> }
  | { type: 'guardrail'; name: string; triggered: boolean }

// ============================================
// Simulated BatchTraceProcessor behavior
// ============================================

/**
 * Simplified BatchTraceProcessor that mimics @openai/agents behavior
 */
class MockBatchTraceProcessor {
  private queue: (Trace | Span)[] = []
  private exporter: { export: (items: (Trace | Span)[]) => Promise<void> }
  private maxBatchSize: number
  private scheduleDelay: number
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    exporter: { export: (items: (Trace | Span)[]) => Promise<void> },
    options: { maxBatchSize?: number; scheduleDelay?: number } = {}
  ) {
    this.exporter = exporter
    this.maxBatchSize = options.maxBatchSize ?? 100
    this.scheduleDelay = options.scheduleDelay ?? 5000
  }

  async onTraceStart(trace: Trace): Promise<void> {
    this.queue.push(trace)
    this.scheduleFlush()
  }

  async onTraceEnd(_trace: Trace): Promise<void> {
    // Trace end doesn't add to queue in BatchTraceProcessor
  }

  async onSpanStart(_span: Span): Promise<void> {
    // Span start doesn't add to queue
  }

  async onSpanEnd(span: Span): Promise<void> {
    this.queue.push(span)
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.queue.length >= this.maxBatchSize) {
      this.flush()
      return
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null
        this.flush()
      }, this.scheduleDelay)
    }
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return

    const items = this.queue.splice(0, this.maxBatchSize)
    await this.exporter.export(items)
  }

  async forceFlush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
  }

  async shutdown(): Promise<void> {
    await this.forceFlush()
  }
}

// ============================================
// Test Helpers
// ============================================

function createTrace(id: string, name: string): Trace {
  return {
    type: 'trace',
    traceId: `trace_${id}`,
    name,
    groupId: null,
  }
}

function createAgentSpan(traceId: string, spanId: string, agentName: string): Span {
  return {
    type: 'trace.span',
    traceId,
    spanId: `span_${spanId}`,
    parentId: null,
    spanData: {
      type: 'agent',
      name: agentName,
      tools: ['get_weather', 'search'],
    },
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    error: null,
  }
}

function createGenerationSpan(traceId: string, spanId: string, parentId: string | null): Span {
  return {
    type: 'trace.span',
    traceId,
    spanId: `span_${spanId}`,
    parentId: parentId ? `span_${parentId}` : null,
    spanData: {
      type: 'generation',
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'Hello' }],
      output: [{ role: 'assistant', content: 'Hi there!' }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    },
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    error: null,
  }
}

function createFunctionSpan(traceId: string, spanId: string, parentId: string | null, toolName: string): Span {
  return {
    type: 'trace.span',
    traceId,
    spanId: `span_${spanId}`,
    parentId: parentId ? `span_${parentId}` : null,
    spanData: {
      type: 'function',
      name: toolName,
      input: JSON.stringify({ location: 'Tokyo' }),
      output: JSON.stringify({ temperature: 22, condition: 'Sunny' }),
    },
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    error: null,
  }
}

function setupMockAPI(): void {
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
          projectId: 'test-project',
        }),
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
        }),
      }
    }

    if (method === 'PATCH' && path.startsWith('/v1/spans/')) {
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'COMPLETED' }),
      }
    }

    return { ok: false, status: 404, text: () => Promise.resolve('Not found') }
  })
}

// ============================================
// Integration Tests
// ============================================

describe('AgentGovExporter Integration', () => {
  let exporter: AgentGovExporter
  let processor: MockBatchTraceProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setupMockAPI()

    exporter = new AgentGovExporter({
      apiKey: 'ag_test_key',
      projectId: 'test-project',
      baseUrl: 'http://localhost:3001',
    })

    processor = new MockBatchTraceProcessor(exporter, {
      maxBatchSize: 10,
      scheduleDelay: 1000,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    exporter.clearCaches()
  })

  describe('Full agent workflow', () => {
    it('should export complete agent trace with nested spans', async () => {
      const traceId = 'trace_workflow_1'

      // Simulate agent workflow events
      const trace = createTrace('workflow_1', 'WeatherAgent')
      const agentSpan = createAgentSpan(traceId, 'agent_1', 'WeatherAgent')
      const llmSpan1 = createGenerationSpan(traceId, 'llm_1', 'agent_1')
      const toolSpan = createFunctionSpan(traceId, 'tool_1', 'llm_1', 'get_weather')
      const llmSpan2 = createGenerationSpan(traceId, 'llm_2', 'agent_1')

      // Process events as BatchTraceProcessor would
      await processor.onTraceStart(trace)
      await processor.onSpanEnd(agentSpan)
      await processor.onSpanEnd(llmSpan1)
      await processor.onSpanEnd(toolSpan)
      await processor.onSpanEnd(llmSpan2)

      // Force flush to export
      await processor.forceFlush()

      // Verify API calls
      const traceCreateCalls = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/traces')
      )
      const spanCreateCalls = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )
      const spanUpdateCalls = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'PATCH' && call[0].includes('/v1/spans/')
      )

      expect(traceCreateCalls).toHaveLength(1)
      expect(spanCreateCalls).toHaveLength(4) // agent + 2 llm + 1 tool
      expect(spanUpdateCalls).toHaveLength(4) // All spans have endedAt

      // Verify trace metadata
      const traceBody = JSON.parse(traceCreateCalls[0][1].body as string)
      expect(traceBody.name).toBe('WeatherAgent')
      expect(traceBody.metadata.externalId).toBe(traceId)
    })

    it('should handle multiple concurrent traces', async () => {
      // Start two traces concurrently
      const trace1 = createTrace('concurrent_1', 'Agent1')
      const trace2 = createTrace('concurrent_2', 'Agent2')
      const span1 = createGenerationSpan('trace_concurrent_1', 'span_1', null)
      const span2 = createGenerationSpan('trace_concurrent_2', 'span_2', null)

      await processor.onTraceStart(trace1)
      await processor.onTraceStart(trace2)
      await processor.onSpanEnd(span1)
      await processor.onSpanEnd(span2)

      await processor.forceFlush()

      // Should create 2 traces and 2 spans
      const traceCreateCalls = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/traces')
      )
      expect(traceCreateCalls).toHaveLength(2)
    })

    it('should deduplicate spans on retry', async () => {
      const trace = createTrace('dedup_test', 'TestAgent')
      const span = createGenerationSpan('trace_dedup_test', 'span_1', null)

      // First export
      await processor.onTraceStart(trace)
      await processor.onSpanEnd(span)
      await processor.forceFlush()

      // Second export with same span (simulating retry)
      await processor.onSpanEnd(span)
      await processor.forceFlush()

      // Should only create span once
      const spanCreateCalls = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )
      expect(spanCreateCalls).toHaveLength(1)
    })
  })

  describe('Error handling', () => {
    it('should continue processing when API fails for single item', async () => {
      let spanCallCount = 0

      mockFetch.mockImplementation(async (url: string, options: RequestInit) => {
        const method = options.method
        const path = new URL(url).pathname

        if (method === 'POST' && path === '/v1/traces') {
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'ag_trace_1' }),
          }
        }

        if (method === 'POST' && path === '/v1/spans') {
          spanCallCount++
          if (spanCallCount === 1) {
            // First span fails
            return { ok: false, status: 500, text: () => Promise.resolve('Error') }
          }
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: `ag_span_${spanCallCount}` }),
          }
        }

        if (method === 'PATCH') {
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'COMPLETED' }),
          }
        }

        return { ok: false, status: 404, text: () => Promise.resolve('Not found') }
      })

      const trace = createTrace('error_test', 'ErrorAgent')
      const span1 = createGenerationSpan('trace_error_test', 'span_fail', null)
      const span2 = createGenerationSpan('trace_error_test', 'span_success', null)

      await processor.onTraceStart(trace)
      await processor.onSpanEnd(span1)
      await processor.onSpanEnd(span2)

      // Should not throw
      await expect(processor.forceFlush()).resolves.not.toThrow()

      // Second span should still be created
      expect(spanCallCount).toBe(2)
    })
  })

  describe('Shutdown behavior', () => {
    it('should flush pending items on shutdown', async () => {
      const trace = createTrace('shutdown_test', 'ShutdownAgent')
      const span = createGenerationSpan('trace_shutdown_test', 'span_1', null)

      await processor.onTraceStart(trace)
      await processor.onSpanEnd(span)

      // Shutdown before scheduled flush
      await processor.shutdown()

      // Items should be exported
      const traceCreateCalls = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/traces')
      )
      expect(traceCreateCalls).toHaveLength(1)
    })

    it('should clear exporter caches on shutdown', async () => {
      const trace = createTrace('cache_test', 'CacheAgent')
      await exporter.export([trace])

      expect(exporter.getCacheStats().traces).toBe(1)

      await exporter.shutdown()

      expect(exporter.getCacheStats().traces).toBe(0)
    })
  })

  describe('Batching behavior', () => {
    it('should batch multiple spans before export', async () => {
      const trace = createTrace('batch_test', 'BatchAgent')
      const spans = Array.from({ length: 5 }, (_, i) =>
        createGenerationSpan('trace_batch_test', `span_${i}`, null)
      )

      await processor.onTraceStart(trace)
      for (const span of spans) {
        await processor.onSpanEnd(span)
      }

      // Before flush, no API calls for spans
      const spanCallsBeforeFlush = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )
      expect(spanCallsBeforeFlush).toHaveLength(0)

      // After flush
      await processor.forceFlush()

      const spanCallsAfterFlush = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/spans')
      )
      expect(spanCallsAfterFlush).toHaveLength(5)
    })

    it('should auto-flush when batch size is reached', async () => {
      const smallBatchProcessor = new MockBatchTraceProcessor(exporter, {
        maxBatchSize: 3,
        scheduleDelay: 10000, // Long delay to ensure size trigger
      })

      const trace = createTrace('auto_flush', 'AutoFlushAgent')
      await smallBatchProcessor.onTraceStart(trace)

      // Add spans up to batch size
      const span1 = createGenerationSpan('trace_auto_flush', 'span_1', null)
      const span2 = createGenerationSpan('trace_auto_flush', 'span_2', null)

      await smallBatchProcessor.onSpanEnd(span1)
      await smallBatchProcessor.onSpanEnd(span2)

      // Wait for any pending operations
      await vi.advanceTimersByTimeAsync(0)

      // Should have exported (trace + 2 spans = 3 items)
      const traceCreateCalls = mockFetch.mock.calls.filter(
        (call) => call[1].method === 'POST' && call[0].includes('/v1/traces')
      )
      expect(traceCreateCalls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('forceFlush method', () => {
    it('should be callable without error', async () => {
      await expect(exporter.forceFlush()).resolves.not.toThrow()
    })
  })
})
