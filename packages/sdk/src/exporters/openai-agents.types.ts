/**
 * Type definitions for @openai/agents SDK
 *
 * These types mirror the @openai/agents package to allow standalone
 * type checking without requiring the peer dependency at build time.
 *
 * @see https://openai.github.io/openai-agents-js/guides/tracing/
 */

// ============================================
// Core Types
// ============================================

/**
 * OpenAI Agents Trace - represents a complete agent execution
 */
export interface OpenAITrace {
  type: 'trace'
  traceId: string
  name: string
  groupId: string | null
  metadata?: Record<string, unknown>
}

/**
 * OpenAI Agents Span - represents a single operation within a trace
 */
export interface OpenAISpan {
  type: 'trace.span'
  traceId: string
  spanId: string
  parentId: string | null
  spanData: SpanData
  startedAt: string | null
  endedAt: string | null
  error: SpanError | null
}

export interface SpanError {
  message: string
  data?: Record<string, unknown>
}

// ============================================
// SpanData Types (discriminated union)
// ============================================

export type SpanData =
  | AgentSpanData
  | FunctionSpanData
  | GenerationSpanData
  | ResponseSpanData
  | HandoffSpanData
  | CustomSpanData
  | GuardrailSpanData
  | TranscriptionSpanData
  | SpeechSpanData
  | SpeechGroupSpanData
  | MCPListToolsSpanData

export interface AgentSpanData {
  type: 'agent'
  name: string
  handoffs?: string[]
  tools?: string[]
  output_type?: string
}

export interface FunctionSpanData {
  type: 'function'
  name: string
  input: string
  output: string
  mcp_data?: string
}

export interface GenerationSpanData {
  type: 'generation'
  input?: Array<Record<string, unknown>>
  output?: Array<Record<string, unknown>>
  model?: string
  model_config?: Record<string, unknown>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export interface ResponseSpanData {
  type: 'response'
  response_id?: string
  _input?: string | Record<string, unknown>[]
  _response?: Record<string, unknown>
}

export interface HandoffSpanData {
  type: 'handoff'
  from_agent?: string
  to_agent?: string
}

export interface CustomSpanData {
  type: 'custom'
  name: string
  data: Record<string, unknown>
}

export interface GuardrailSpanData {
  type: 'guardrail'
  name: string
  triggered: boolean
}

export interface TranscriptionSpanData {
  type: 'transcription'
  input: { data: string; format: string }
  output?: string
  model?: string
  model_config?: Record<string, unknown>
}

export interface SpeechSpanData {
  type: 'speech'
  input?: string
  output: { data: string; format: string }
  model?: string
  model_config?: Record<string, unknown>
}

export interface SpeechGroupSpanData {
  type: 'speech_group'
  input?: string
}

export interface MCPListToolsSpanData {
  type: 'mcp_tools'
  server?: string
  result?: string[]
}

// ============================================
// Exporter Interface
// ============================================

/**
 * TracingExporter interface from @openai/agents
 */
export interface TracingExporter {
  export(items: (OpenAITrace | OpenAISpan)[], signal?: AbortSignal): Promise<void>
}
