// ============================================
// Configuration
// ============================================

export interface AgentGovConfig {
  /** API key from AgentGov dashboard (ag_xxx) */
  apiKey: string
  /** Project ID */
  projectId: string
  /** API base URL (default: http://localhost:3001) */
  baseUrl?: string
  /** Enable debug logging */
  debug?: boolean
  /** Flush interval in ms (default: 5000) */
  flushInterval?: number
  /** Max batch size before auto-flush (default: 10) */
  batchSize?: number
  /** Max retry attempts for failed API requests (default: 3) */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  retryDelay?: number
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Callback for batch flush errors (default: logs to console in debug mode) */
  onError?: (error: Error, context: { operation: string; itemCount?: number }) => void
}

// ============================================
// Trace & Span Types
// ============================================

export type TraceStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type SpanStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'
export type SpanType =
  | 'LLM_CALL'
  | 'TOOL_CALL'
  | 'AGENT_STEP'
  | 'RETRIEVAL'
  | 'EMBEDDING'
  | 'CUSTOM'

export interface TraceInput {
  name?: string
  input?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface Trace {
  id: string
  projectId: string
  name?: string
  status: TraceStatus
  startedAt: string
  endedAt?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  metadata?: Record<string, unknown>
  totalCost?: number
  totalTokens?: number
  totalDuration?: number
}

export interface SpanInput {
  traceId: string
  parentId?: string
  name: string
  type: SpanType
  input?: Record<string, unknown>
  metadata?: Record<string, unknown>
  model?: string
  toolName?: string
  toolInput?: Record<string, unknown>
}

export interface SpanUpdate {
  status?: SpanStatus
  output?: Record<string, unknown>
  error?: string
  promptTokens?: number
  outputTokens?: number
  cost?: number
  toolOutput?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface Span {
  id: string
  traceId: string
  parentId?: string
  name: string
  type: SpanType
  status: SpanStatus
  startedAt: string
  endedAt?: string
  duration?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  model?: string
  promptTokens?: number
  outputTokens?: number
  cost?: number
}

// ============================================
// Context for nested spans
// ============================================

export interface TraceContext {
  traceId: string
  spanId?: string
}
