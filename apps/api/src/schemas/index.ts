import { z } from 'zod'
import type { MemberRole, InvitationStatus, TraceStatus, SpanType, SpanStatus } from '@agentgov/shared'

// Re-export domain types from shared for convenience
export type { MemberRole, InvitationStatus, TraceStatus, SpanType, SpanStatus } from '@agentgov/shared'

// ============================================
// Member & Invitation Enums
// ============================================

export const MemberRoleSchema: z.ZodEnum<[MemberRole, ...MemberRole[]]> = z.enum(['owner', 'admin', 'member'])

export const InvitationStatusSchema: z.ZodEnum<[InvitationStatus, ...InvitationStatus[]]> = z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'])

// ============================================
// Shared Validators
// ============================================

const jsonPayloadMax = z.record(z.unknown()).refine(
  val => JSON.stringify(val).length < 1_000_000,
  { message: 'JSON payload too large (max 1MB)' }
)

// ============================================
// Project Schemas
// ============================================

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
})

export const ProjectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  apiKey: z.string(), // Only returned on creation
  createdAt: z.string().datetime()
})

export type CreateProject = z.infer<typeof CreateProjectSchema>

// ============================================
// Trace Schemas
// ============================================

export const TraceStatusSchema: z.ZodEnum<[TraceStatus, ...TraceStatus[]]> = z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])

export const CreateTraceSchema = z.object({
  name: z.string().max(200).optional(),
  input: jsonPayloadMax.optional(),
  metadata: jsonPayloadMax.optional(),
  // External ID for idempotency (e.g., OpenAI Agents trace_id)
  // If provided, existing trace with same externalId will be returned (upsert)
  externalId: z.string().max(100).optional()
})

export const UpdateTraceSchema = z.object({
  status: TraceStatusSchema.optional(),
  output: jsonPayloadMax.optional(),
  metadata: jsonPayloadMax.optional()
})

export const TraceQuerySchema = z.object({
  status: TraceStatusSchema.optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
})

export type CreateTrace = z.infer<typeof CreateTraceSchema>
export type UpdateTrace = z.infer<typeof UpdateTraceSchema>
export type TraceQuery = z.infer<typeof TraceQuerySchema>

// ============================================
// Span Schemas
// ============================================

export const SpanTypeSchema: z.ZodEnum<[SpanType, ...SpanType[]]> = z.enum([
  'LLM_CALL',
  'TOOL_CALL',
  'AGENT_STEP',
  'RETRIEVAL',
  'EMBEDDING',
  'CUSTOM',
])

export const SpanStatusSchema: z.ZodEnum<[SpanStatus, ...SpanStatus[]]> = z.enum(['RUNNING', 'COMPLETED', 'FAILED'])

export const CreateSpanSchema = z.object({
  traceId: z.string(),
  parentId: z.string().optional(),
  name: z.string().min(1).max(200),
  type: SpanTypeSchema,
  input: jsonPayloadMax.optional(),
  metadata: jsonPayloadMax.optional(),

  // LLM specific
  model: z.string().optional(),

  // Tool specific
  toolName: z.string().optional(),
  toolInput: jsonPayloadMax.optional()
})

export const UpdateSpanSchema = z.object({
  status: SpanStatusSchema.optional(),
  output: jsonPayloadMax.optional(),
  error: z.string().max(5000).optional(),

  // LLM metrics
  promptTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  cost: z.number().optional(),

  // Tool output
  toolOutput: jsonPayloadMax.optional(),

  metadata: jsonPayloadMax.optional()
})

export type CreateSpan = z.infer<typeof CreateSpanSchema>
export type UpdateSpan = z.infer<typeof UpdateSpanSchema>
