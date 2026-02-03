import { describe, it, expectTypeOf } from 'vitest'
import type {
  AgentGovConfig,
  Trace,
  Span,
  SpanType,
  TraceStatus,
  SpanStatus,
  TraceContext,
  TraceInput,
  SpanInput,
  SpanUpdate
} from './types.js'

describe('types', () => {
  describe('AgentGovConfig', () => {
    it('should have required fields', () => {
      const config: AgentGovConfig = {
        apiKey: 'ag_test',
        projectId: 'proj_123'
      }

      expectTypeOf(config.apiKey).toBeString()
      expectTypeOf(config.projectId).toBeString()
    })

    it('should have optional fields', () => {
      const config: AgentGovConfig = {
        apiKey: 'ag_test',
        projectId: 'proj_123',
        baseUrl: 'http://localhost:3001',
        debug: true,
        flushInterval: 5000,
        batchSize: 10
      }

      expectTypeOf(config.baseUrl).toEqualTypeOf<string | undefined>()
      expectTypeOf(config.debug).toEqualTypeOf<boolean | undefined>()
    })

    it('should have retry configuration options', () => {
      const config: AgentGovConfig = {
        apiKey: 'ag_test',
        projectId: 'proj_123',
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000
      }

      expectTypeOf(config.maxRetries).toEqualTypeOf<number | undefined>()
      expectTypeOf(config.retryDelay).toEqualTypeOf<number | undefined>()
      expectTypeOf(config.timeout).toEqualTypeOf<number | undefined>()
    })
  })

  describe('Trace', () => {
    it('should have correct shape', () => {
      const trace: Trace = {
        id: 'trace_123',
        projectId: 'proj_123',
        status: 'RUNNING',
        startedAt: new Date().toISOString()
      }

      expectTypeOf(trace.id).toBeString()
      expectTypeOf(trace.projectId).toBeString()
      expectTypeOf(trace.status).toEqualTypeOf<TraceStatus>()
    })
  })

  describe('Span', () => {
    it('should have correct shape', () => {
      const span: Span = {
        id: 'span_123',
        traceId: 'trace_123',
        name: 'test_span',
        type: 'LLM_CALL',
        status: 'RUNNING',
        startedAt: new Date().toISOString()
      }

      expectTypeOf(span.id).toBeString()
      expectTypeOf(span.traceId).toBeString()
      expectTypeOf(span.type).toEqualTypeOf<SpanType>()
      expectTypeOf(span.status).toEqualTypeOf<SpanStatus>()
    })
  })

  describe('SpanType', () => {
    it('should include all valid types', () => {
      const types: SpanType[] = [
        'LLM_CALL',
        'TOOL_CALL',
        'AGENT_STEP',
        'RETRIEVAL',
        'EMBEDDING',
        'CUSTOM'
      ]

      expectTypeOf(types).toEqualTypeOf<SpanType[]>()
    })
  })

  describe('TraceContext', () => {
    it('should have traceId and optional spanId', () => {
      const ctx: TraceContext = {
        traceId: 'trace_123',
        spanId: 'span_456'
      }

      expectTypeOf(ctx.traceId).toBeString()
      expectTypeOf(ctx.spanId).toEqualTypeOf<string | undefined>()
    })
  })

  describe('TraceInput', () => {
    it('should allow optional fields', () => {
      const input: TraceInput = {
        name: 'My Trace',
        input: { query: 'test' },
        metadata: { userId: '123' }
      }

      expectTypeOf(input.name).toEqualTypeOf<string | undefined>()
      expectTypeOf(input.input).toEqualTypeOf<Record<string, unknown> | undefined>()
    })
  })

  describe('SpanInput', () => {
    it('should have required fields', () => {
      const input: SpanInput = {
        traceId: 'trace_123',
        name: 'My Span',
        type: 'LLM_CALL'
      }

      expectTypeOf(input.traceId).toBeString()
      expectTypeOf(input.name).toBeString()
      expectTypeOf(input.type).toEqualTypeOf<SpanType>()
    })
  })

  describe('SpanUpdate', () => {
    it('should allow partial updates', () => {
      const update: SpanUpdate = {
        status: 'COMPLETED',
        promptTokens: 100,
        outputTokens: 50,
        cost: 0.01
      }

      expectTypeOf(update.status).toEqualTypeOf<SpanStatus | undefined>()
      expectTypeOf(update.promptTokens).toEqualTypeOf<number | undefined>()
    })
  })
})
