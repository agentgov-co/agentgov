// Main client
export { AgentGov } from './client.js'

// Types
export type {
  AgentGovConfig,
  TraceContext,
  TraceInput,
  Trace,
  TraceStatus,
  SpanInput,
  SpanUpdate,
  Span,
  SpanStatus,
  SpanType
} from './types.js'

// Wrapper options
export type { WrapOpenAIOptions } from './wrappers/openai.js'
export type { WrapVercelAIOptions } from './wrappers/vercel-ai.js'

// Utils (for advanced users)
export { estimateCost, calculateDuration } from './utils/timing.js'

// Errors
export { AgentGovAPIError } from './utils/fetch.js'

// Safety utilities
export { safeStringify } from './utils/fetch.js'
