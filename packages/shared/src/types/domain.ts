// ============================================
// Domain type unions shared between API and Web
// ============================================

export type TraceStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export type SpanType =
  | 'LLM_CALL'
  | 'TOOL_CALL'
  | 'AGENT_STEP'
  | 'RETRIEVAL'
  | 'EMBEDDING'
  | 'CUSTOM'

export type SpanStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'

export type MemberRole = 'owner' | 'admin' | 'member'

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
