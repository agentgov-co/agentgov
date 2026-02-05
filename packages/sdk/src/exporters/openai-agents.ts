/**
 * OpenAI Agents SDK Integration
 *
 * Exports traces from @openai/agents to AgentGov for observability and governance.
 *
 * @example
 * ```typescript
 * import { BatchTraceProcessor, setTraceProcessors } from '@openai/agents'
 * import { AgentGovExporter } from '@agentgov/sdk/openai-agents'
 *
 * setTraceProcessors([
 *   new BatchTraceProcessor(new AgentGovExporter({
 *     apiKey: process.env.AGENTGOV_API_KEY!,
 *     projectId: process.env.AGENTGOV_PROJECT_ID!,
 *   }))
 * ])
 * ```
 *
 * @packageDocumentation
 */

import { FetchClient } from '../utils/fetch.js'
import { LRUCache } from '../utils/lru-cache.js'
import type { SpanType as AgentGovSpanType, SpanInput, SpanUpdate } from '../types.js'
import type {
  OpenAITrace,
  OpenAISpan,
  SpanData,
  TracingExporter
} from './openai-agents.types.js'

// Re-export types for consumers
export type { TracingExporter, OpenAITrace, OpenAISpan } from './openai-agents.types.js'

// ============================================
// Configuration
// ============================================

export interface AgentGovExporterConfig {
  /** API key from AgentGov dashboard (ag_xxx) */
  apiKey: string
  /** Project ID */
  projectId: string
  /** API base URL (default: https://api.agentgov.co) */
  baseUrl?: string
  /** Enable debug logging (default: false) */
  debug?: boolean
  /** Max entries in trace cache before eviction (default: 1000) */
  maxCacheSize?: number
  /** Cache TTL in milliseconds (default: 3600000 = 1 hour) */
  cacheTtl?: number
  /** Max retry attempts for failed requests (default: 3) */
  maxRetries?: number
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Callback for export errors (default: logs to console in debug mode) */
  onError?: (error: Error, context: ExportErrorContext) => void
  /** Min spans to use batch endpoint (default: 5). Set to 0 to disable batching. */
  batchThreshold?: number
}

export interface ExportErrorContext {
  operation: 'createTrace' | 'createSpan' | 'createSpanBatch' | 'updateSpan'
  externalId: string
  itemType: 'trace' | 'span'
}

// ============================================
// Exporter Implementation
// ============================================

/**
 * AgentGov exporter for OpenAI Agents SDK
 *
 * Implements the TracingExporter interface to send traces and spans
 * from @openai/agents to AgentGov for observability and governance.
 */
export class AgentGovExporter implements TracingExporter {
  private readonly client: FetchClient
  private readonly traceCache: LRUCache
  private readonly spanCache: LRUCache
  private readonly debug: boolean
  private readonly onError?: (error: Error, context: ExportErrorContext) => void
  private readonly batchThreshold: number

  constructor(config: AgentGovExporterConfig) {
    this.debug = config.debug ?? false
    this.onError = config.onError
    this.batchThreshold = config.batchThreshold ?? 5

    this.client = new FetchClient({
      baseUrl: config.baseUrl ?? 'https://api.agentgov.co',
      apiKey: config.apiKey,
      projectId: config.projectId,
      debug: this.debug,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000
    })

    const maxCacheSize = config.maxCacheSize ?? 1000
    const cacheTtl = config.cacheTtl ?? 3600000 // 1 hour

    this.traceCache = new LRUCache(maxCacheSize, cacheTtl)
    this.spanCache = new LRUCache(maxCacheSize * 10, cacheTtl)
  }

  /**
   * Export traces and spans to AgentGov
   */
  async export(items: (OpenAITrace | OpenAISpan)[], signal?: AbortSignal): Promise<void> {
    if (items.length === 0) return

    this.log(`Exporting ${items.length} items`)

    const grouped = this.groupByTrace(items)
    const promises: Promise<void>[] = []

    for (const [externalTraceId, group] of grouped) {
      promises.push(this.exportTraceGroup(externalTraceId, group, signal))
    }

    await Promise.all(promises)
    this.log('Export complete')
  }

  /**
   * Export a single trace group (trace + its spans)
   */
  private async exportTraceGroup(
    externalTraceId: string,
    items: (OpenAITrace | OpenAISpan)[],
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) return

    // Ensure trace exists
    let agTraceId = this.traceCache.get(externalTraceId)

    if (!agTraceId) {
      const traceItem = items.find((i): i is OpenAITrace => i.type === 'trace')

      try {
        const trace = await this.client.createTrace({
          name: traceItem?.name ?? 'Agent Run',
          externalId: externalTraceId, // For idempotency
          metadata: {
            groupId: traceItem?.groupId,
            ...traceItem?.metadata
          }
        })
        agTraceId = trace.id
        this.traceCache.set(externalTraceId, agTraceId)
        this.log(`Created trace ${agTraceId} (external: ${externalTraceId})`)
      } catch (error) {
        this.handleError(error, {
          operation: 'createTrace',
          externalId: externalTraceId,
          itemType: 'trace'
        })
        return
      }
    }

    // Export spans
    const spans = items.filter((i): i is OpenAISpan => i.type === 'trace.span')

    // Filter out already exported spans
    const newSpans = spans.filter(span => !this.spanCache.has(span.spanId))

    if (newSpans.length === 0) {
      this.log('All spans already exported, skipping')
      return
    }

    // Use batch endpoint for multiple new spans (more efficient)
    if (this.batchThreshold > 0 && newSpans.length >= this.batchThreshold) {
      await this.exportSpanBatch(newSpans, agTraceId, signal)
    } else {
      // Export spans individually
      await Promise.all(newSpans.map(span => this.exportSpan(span, agTraceId, signal)))
    }
  }

  /**
   * Export a single span to AgentGov
   */
  private async exportSpan(
    span: OpenAISpan,
    agTraceId: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) return
    if (this.spanCache.has(span.spanId)) {
      this.log(`Span ${span.spanId} already exported, skipping`)
      return
    }

    try {
      const spanInput = this.mapSpanToInput(span, agTraceId)
      const createdSpan = await this.client.createSpan(spanInput)
      this.spanCache.set(span.spanId, createdSpan.id)

      if (span.endedAt || span.error) {
        const update = this.buildSpanUpdate(span)
        if (Object.keys(update).length > 0) {
          await this.client.updateSpan(createdSpan.id, update)
        }
      }

      this.log(`Exported span ${createdSpan.id} (external: ${span.spanId})`)
    } catch (error) {
      this.handleError(error, {
        operation: 'createSpan',
        externalId: span.spanId,
        itemType: 'span'
      })
    }
  }

  /**
   * Export multiple spans using batch endpoint
   */
  private async exportSpanBatch(
    spans: OpenAISpan[],
    agTraceId: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) return

    try {
      const spanInputs = spans.map(span => this.mapSpanToInput(span, agTraceId))
      const result = await this.client.createSpanBatch(spanInputs)

      // Mark all spans as exported in cache
      for (const span of spans) {
        this.spanCache.set(span.spanId, `batch_${Date.now()}`)
      }

      this.log(`Batch exported ${result.created}/${result.total} spans`)

      // Note: Batch endpoint doesn't return individual span IDs,
      // so we can't update individual spans. For spans that need updates
      // (endedAt/error), we'll need to handle them separately if needed.
      // For now, batch is primarily for initial span creation.
    } catch (error) {
      this.handleError(error, {
        operation: 'createSpanBatch',
        externalId: `batch_${spans.length}_spans`,
        itemType: 'span'
      })

      // Fall back to individual exports on batch failure
      this.log('Batch failed, falling back to individual exports')
      await Promise.all(spans.map(span => this.exportSpan(span, agTraceId, signal)))
    }
  }

  /**
   * Map OpenAI span to AgentGov SpanInput
   */
  private mapSpanToInput(span: OpenAISpan, traceId: string): SpanInput {
    const { spanData } = span

    const base: SpanInput = {
      traceId,
      name: this.getSpanName(spanData),
      type: this.mapSpanType(spanData.type),
      metadata: {
        externalId: span.spanId,
        externalParentId: span.parentId,
        spanDataType: spanData.type,
        startedAt: span.startedAt
      }
    }

    return this.addTypeSpecificFields(base, spanData)
  }

  /**
   * Add type-specific fields to span input
   */
  private addTypeSpecificFields(base: SpanInput, spanData: SpanData): SpanInput {
    switch (spanData.type) {
      case 'generation':
        return {
          ...base,
          model: spanData.model,
          input: spanData.input ? { messages: spanData.input } : undefined,
          metadata: { ...base.metadata, model_config: spanData.model_config }
        }

      case 'function':
        return {
          ...base,
          toolName: spanData.name,
          toolInput: this.safeParseJson(spanData.input),
          metadata: { ...base.metadata, mcp_data: spanData.mcp_data }
        }

      case 'agent':
        return {
          ...base,
          metadata: {
            ...base.metadata,
            handoffs: spanData.handoffs,
            tools: spanData.tools,
            output_type: spanData.output_type
          }
        }

      case 'handoff':
        return {
          ...base,
          metadata: {
            ...base.metadata,
            from_agent: spanData.from_agent,
            to_agent: spanData.to_agent
          }
        }

      case 'guardrail':
        return {
          ...base,
          metadata: { ...base.metadata, triggered: spanData.triggered }
        }

      case 'response':
        return {
          ...base,
          input: spanData._input ? { input: spanData._input } : undefined,
          metadata: { ...base.metadata, response_id: spanData.response_id }
        }

      case 'transcription':
      case 'speech':
      case 'speech_group':
        return {
          ...base,
          model: 'model' in spanData ? spanData.model : undefined,
          metadata: {
            ...base.metadata,
            model_config: 'model_config' in spanData ? spanData.model_config : undefined
          }
        }

      case 'custom':
        return {
          ...base,
          metadata: { ...base.metadata, customData: spanData.data }
        }

      case 'mcp_tools':
        return {
          ...base,
          metadata: {
            ...base.metadata,
            server: spanData.server,
            result: spanData.result
          }
        }

      default:
        return base
    }
  }

  /**
   * Build SpanUpdate from completed span data
   */
  private buildSpanUpdate(span: OpenAISpan): SpanUpdate {
    const update: SpanUpdate = {}
    const { spanData } = span

    if (span.error) {
      update.status = 'FAILED'
      update.error = span.error.message
      if (span.error.data) {
        update.metadata = { errorData: span.error.data }
      }
    } else if (span.endedAt) {
      update.status = 'COMPLETED'
    }

    if (spanData.type === 'generation') {
      if (spanData.output) update.output = { messages: spanData.output }
      if (spanData.usage) {
        update.promptTokens = spanData.usage.prompt_tokens
        update.outputTokens = spanData.usage.completion_tokens
      }
    }

    if (spanData.type === 'function' && spanData.output) {
      update.toolOutput = this.safeParseJson(spanData.output)
    }

    if (spanData.type === 'response' && spanData._response) {
      update.output = spanData._response
    }

    return update
  }

  /**
   * Map OpenAI span type to AgentGov SpanType
   */
  private mapSpanType(type: string): AgentGovSpanType {
    const mapping: Record<string, AgentGovSpanType> = {
      generation: 'LLM_CALL',
      function: 'TOOL_CALL',
      agent: 'AGENT_STEP',
      handoff: 'AGENT_STEP',
      transcription: 'LLM_CALL',
      speech: 'LLM_CALL',
      speech_group: 'LLM_CALL',
      response: 'LLM_CALL',
      mcp_tools: 'TOOL_CALL',
      guardrail: 'CUSTOM',
      custom: 'CUSTOM'
    }
    return mapping[type] ?? 'CUSTOM'
  }

  /**
   * Get human-readable span name
   */
  private getSpanName(spanData: SpanData): string {
    switch (spanData.type) {
      case 'agent': return `Agent: ${spanData.name}`
      case 'function': return `Tool: ${spanData.name}`
      case 'generation': return `LLM: ${spanData.model ?? 'unknown'}`
      case 'handoff': return `Handoff: ${spanData.from_agent ?? '?'} → ${spanData.to_agent ?? '?'}`
      case 'guardrail': return `Guardrail: ${spanData.name}`
      case 'response': return 'Response'
      case 'custom': return spanData.name
      case 'transcription': return `Transcription: ${spanData.model ?? 'unknown'}`
      case 'speech': return `Speech: ${spanData.model ?? 'unknown'}`
      case 'speech_group': return 'Speech Group'
      case 'mcp_tools': return `MCP Tools: ${spanData.server ?? 'unknown'}`
      default: return 'Unknown'
    }
  }

  /**
   * Group items by trace ID
   */
  private groupByTrace(items: (OpenAITrace | OpenAISpan)[]): Map<string, (OpenAITrace | OpenAISpan)[]> {
    const grouped = new Map<string, (OpenAITrace | OpenAISpan)[]>()

    for (const item of items) {
      const group = grouped.get(item.traceId)
      if (group) {
        group.push(item)
      } else {
        grouped.set(item.traceId, [item])
      }
    }

    return grouped
  }

  /**
   * Safely parse JSON string
   */
  private safeParseJson(value: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null ? parsed : { value: parsed }
    } catch {
      return { raw: value }
    }
  }

  /**
   * Handle export errors
   */
  private handleError(error: unknown, context: ExportErrorContext): void {
    const err = error instanceof Error ? error : new Error(String(error))

    if (this.onError) {
      this.onError(err, context)
    } else if (this.debug) {
      console.error(`[AgentGov] Export error (${context.operation}):`, err.message, context)
    }
  }

  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log('[AgentGov]', message, data ?? '')
    }
  }

  // ============================================
  // Public API
  // ============================================

  /** Get cache statistics */
  getCacheStats(): { traces: number; spans: number } {
    return { traces: this.traceCache.size, spans: this.spanCache.size }
  }

  /** Clear all caches */
  clearCaches(): void {
    this.traceCache.clear()
    this.spanCache.clear()
  }

  /** Shutdown the exporter */
  async shutdown(_timeout?: number): Promise<void> {
    this.log('Shutting down exporter')
    this.clearCaches()
  }

  /** Force flush (no-op - BatchTraceProcessor handles batching) */
  async forceFlush(): Promise<void> {
    this.log('forceFlush called (no-op)')
  }
}
