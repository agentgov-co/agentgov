import type { FetchClient } from '../utils/fetch.js'
import type { TraceContext, SpanType } from '../types.js'
import { estimateCost } from '../utils/timing.js'

// ============================================
// Vercel AI SDK Types (exported for client.ts)
// ============================================

export interface VercelAIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface VercelAIToolCall {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

export interface VercelAIToolResult {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  result: unknown
}

export interface GenerateTextResult {
  text: string
  usage: VercelAIUsage
  finishReason: string
  toolCalls?: VercelAIToolCall[]
  toolResults?: VercelAIToolResult[]
  response?: {
    id?: string
    model?: string
  }
}

export interface StreamTextResult {
  textStream: AsyncIterable<string>
  fullStream: AsyncIterable<StreamPart>
  text: Promise<string>
  usage: Promise<VercelAIUsage>
  finishReason: Promise<string>
  toolCalls: Promise<VercelAIToolCall[]>
  toolResults: Promise<VercelAIToolResult[]>
}

export interface StreamPart {
  type: string
  value?: unknown
  textDelta?: string
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: unknown
}

export interface GenerateObjectResult<T = unknown> {
  object: T
  usage: VercelAIUsage
  finishReason: string
}

export interface EmbedResult {
  embedding: number[]
  usage: { tokens: number }
}

export interface EmbedManyResult {
  embeddings: number[][]
  usage: { tokens: number }
}

// Model type from Vercel AI SDK
interface VercelAIModel {
  modelId: string
  provider: string
}

// ============================================
// Wrapper Options
// ============================================

export interface WrapVercelAIOptions {
  /** Custom trace name prefix */
  traceNamePrefix?: string
  /** Auto-create trace for each call (default: true) */
  autoTrace?: boolean
  /** Include full prompts in trace (default: true) */
  captureInput?: boolean
  /** Include full responses in trace (default: true) */
  captureOutput?: boolean
  /** Create separate spans for tool calls (default: true) */
  traceToolCalls?: boolean
  /** Enable debug logging for span errors (default: false) */
  debug?: boolean
}

// ============================================
// Generic Wrapper Type
// ============================================

type AsyncFunction<TArgs, TResult> = (args: TArgs) => Promise<TResult>

// ============================================
// Main Wrapper Functions
// ============================================

/**
 * Wrap Vercel AI SDK's generateText function
 */
export function wrapGenerateText<
  TArgs extends Record<string, unknown>,
  TResult extends GenerateTextResult
>(
  originalFn: AsyncFunction<TArgs, TResult>,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapVercelAIOptions = {}
): AsyncFunction<TArgs, TResult> {
  const {
    traceNamePrefix = 'vercel-ai',
    autoTrace = true,
    captureInput = true,
    captureOutput = true,
    traceToolCalls = true,
    debug = false
  } = options

  return async (callOptions: TArgs): Promise<TResult> => {
    const model = extractModelInfo(callOptions.model)
    const context = getContext()

    // Create trace if needed
    let traceId = context?.traceId
    let createdTrace = false

    if (!traceId && autoTrace) {
      const trace = await fetchClient.createTrace({
        name: `${traceNamePrefix}.generateText`,
        input: captureInput ? {
          prompt: callOptions.prompt,
          messages: callOptions.messages,
          system: callOptions.system
        } : undefined,
        metadata: { model: model.id, provider: model.provider }
      })
      traceId = trace.id
      createdTrace = true
    }

    // Create span
    let spanId: string | undefined
    if (traceId) {
      const span = await fetchClient.createSpan({
        traceId,
        parentId: context?.spanId,
        name: 'generateText',
        type: 'LLM_CALL',
        model: model.id,
        input: captureInput ? callOptions as Record<string, unknown> : undefined
      })
      spanId = span.id
    }

    try {
      const result = await originalFn(callOptions)

      // Create tool call/result spans
      if (traceToolCalls && spanId && traceId) {
        await createVercelToolSpans(result, fetchClient, traceId, spanId, debug)
      }

      // Update span
      if (spanId) {
        const promptTokens = result.usage?.promptTokens || 0
        const outputTokens = result.usage?.completionTokens || 0

        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: captureOutput ? {
            text: result.text,
            finishReason: result.finishReason,
            usage: result.usage
          } : undefined,
          promptTokens,
          outputTokens,
          cost: estimateCost(model.id, promptTokens, outputTokens)
        })
      }

      // Complete trace
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, {
          status: 'COMPLETED',
          output: captureOutput ? { text: result.text } : undefined
        })
      }

      return result
    } catch (error) {
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        })
      }
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' })
      }
      throw error
    }
  }
}

/**
 * Wrap Vercel AI SDK's streamText function
 */
export function wrapStreamText<
  TArgs extends Record<string, unknown>,
  TResult extends StreamTextResult
>(
  originalFn: AsyncFunction<TArgs, TResult>,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapVercelAIOptions = {}
): AsyncFunction<TArgs, TResult> {
  const {
    traceNamePrefix = 'vercel-ai',
    autoTrace = true,
    captureInput = true,
    captureOutput = true,
    traceToolCalls = true,
    debug = false
  } = options

  return async (callOptions: TArgs): Promise<TResult> => {
    const model = extractModelInfo(callOptions.model)
    const context = getContext()

    // Create trace if needed
    let traceId = context?.traceId
    let createdTrace = false

    if (!traceId && autoTrace) {
      const trace = await fetchClient.createTrace({
        name: `${traceNamePrefix}.streamText`,
        input: captureInput ? {
          prompt: callOptions.prompt,
          messages: callOptions.messages
        } : undefined,
        metadata: { model: model.id, provider: model.provider, streaming: true }
      })
      traceId = trace.id
      createdTrace = true
    }

    // Create span
    let spanId: string | undefined
    if (traceId) {
      const span = await fetchClient.createSpan({
        traceId,
        parentId: context?.spanId,
        name: 'streamText',
        type: 'LLM_CALL',
        model: model.id,
        input: captureInput ? callOptions as Record<string, unknown> : undefined
      })
      spanId = span.id
    }

    try {
      const result = await originalFn(callOptions)

      // Wrap the textStream to track completion
      const wrappedTextStream = wrapTextStream(
        result.textStream,
        result,
        fetchClient,
        {
          traceId,
          spanId,
          createdTrace,
          model,
          captureOutput,
          traceToolCalls,
          debug
        }
      )

      // Return modified result with wrapped stream
      return {
        ...result,
        textStream: wrappedTextStream
      } as TResult
    } catch (error) {
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        })
      }
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' })
      }
      throw error
    }
  }
}

/**
 * Wrap Vercel AI SDK's generateObject function
 */
export function wrapGenerateObject<
  TArgs extends Record<string, unknown>,
  TResult extends GenerateObjectResult<unknown>
>(
  originalFn: AsyncFunction<TArgs, TResult>,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapVercelAIOptions = {}
): AsyncFunction<TArgs, TResult> {
  const {
    traceNamePrefix = 'vercel-ai',
    autoTrace = true,
    captureInput = true,
    captureOutput = true
  } = options

  return async (callOptions: TArgs): Promise<TResult> => {
    const model = extractModelInfo(callOptions.model)
    const context = getContext()

    let traceId = context?.traceId
    let createdTrace = false

    if (!traceId && autoTrace) {
      const trace = await fetchClient.createTrace({
        name: `${traceNamePrefix}.generateObject`,
        input: captureInput ? { prompt: callOptions.prompt } : undefined,
        metadata: { model: model.id, provider: model.provider }
      })
      traceId = trace.id
      createdTrace = true
    }

    let spanId: string | undefined
    if (traceId) {
      const span = await fetchClient.createSpan({
        traceId,
        parentId: context?.spanId,
        name: 'generateObject',
        type: 'LLM_CALL',
        model: model.id,
        input: captureInput ? callOptions as Record<string, unknown> : undefined
      })
      spanId = span.id
    }

    try {
      const result = await originalFn(callOptions)

      if (spanId) {
        const promptTokens = result.usage?.promptTokens || 0
        const outputTokens = result.usage?.completionTokens || 0

        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: captureOutput ? {
            object: result.object,
            finishReason: result.finishReason
          } : undefined,
          promptTokens,
          outputTokens,
          cost: estimateCost(model.id, promptTokens, outputTokens)
        })
      }

      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, {
          status: 'COMPLETED',
          output: captureOutput ? { object: result.object } : undefined
        })
      }

      return result
    } catch (error) {
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        })
      }
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' })
      }
      throw error
    }
  }
}

/**
 * Wrap Vercel AI SDK's embed function
 */
export function wrapEmbed<
  TArgs extends Record<string, unknown>,
  TResult extends EmbedResult
>(
  originalFn: AsyncFunction<TArgs, TResult>,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapVercelAIOptions = {}
): AsyncFunction<TArgs, TResult> {
  const {
    traceNamePrefix = 'vercel-ai',
    autoTrace = true,
    captureInput = true
  } = options

  return async (callOptions: TArgs): Promise<TResult> => {
    const model = extractModelInfo(callOptions.model)
    const context = getContext()

    let traceId = context?.traceId
    let createdTrace = false

    if (!traceId && autoTrace) {
      const trace = await fetchClient.createTrace({
        name: `${traceNamePrefix}.embed`,
        metadata: { model: model.id, provider: model.provider }
      })
      traceId = trace.id
      createdTrace = true
    }

    let spanId: string | undefined
    if (traceId) {
      const span = await fetchClient.createSpan({
        traceId,
        parentId: context?.spanId,
        name: 'embed',
        type: 'EMBEDDING',
        model: model.id,
        input: captureInput ? {
          valueLength: String(callOptions.value).length
        } : undefined
      })
      spanId = span.id
    }

    try {
      const result = await originalFn(callOptions)

      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: { embeddingLength: result.embedding.length },
          promptTokens: result.usage?.tokens || 0,
          outputTokens: 0,
          cost: estimateCost(model.id, result.usage?.tokens || 0, 0)
        })
      }

      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'COMPLETED' })
      }

      return result
    } catch (error) {
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        })
      }
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' })
      }
      throw error
    }
  }
}

/**
 * Wrap Vercel AI SDK's embedMany function
 */
export function wrapEmbedMany<
  TArgs extends Record<string, unknown>,
  TResult extends EmbedManyResult
>(
  originalFn: AsyncFunction<TArgs, TResult>,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapVercelAIOptions = {}
): AsyncFunction<TArgs, TResult> {
  const {
    traceNamePrefix = 'vercel-ai',
    autoTrace = true,
    captureInput = true
  } = options

  return async (callOptions: TArgs): Promise<TResult> => {
    const model = extractModelInfo(callOptions.model)
    const context = getContext()
    const values = callOptions.values as unknown[] | undefined

    let traceId = context?.traceId
    let createdTrace = false

    if (!traceId && autoTrace) {
      const trace = await fetchClient.createTrace({
        name: `${traceNamePrefix}.embedMany`,
        metadata: { model: model.id, provider: model.provider, count: values?.length }
      })
      traceId = trace.id
      createdTrace = true
    }

    let spanId: string | undefined
    if (traceId) {
      const span = await fetchClient.createSpan({
        traceId,
        parentId: context?.spanId,
        name: 'embedMany',
        type: 'EMBEDDING',
        model: model.id,
        input: captureInput ? {
          valuesCount: values?.length
        } : undefined
      })
      spanId = span.id
    }

    try {
      const result = await originalFn(callOptions)

      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: { embeddingsCount: result.embeddings.length },
          promptTokens: result.usage?.tokens || 0,
          outputTokens: 0,
          cost: estimateCost(model.id, result.usage?.tokens || 0, 0)
        })
      }

      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'COMPLETED' })
      }

      return result
    } catch (error) {
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        })
      }
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' })
      }
      throw error
    }
  }
}

// ============================================
// Helper Functions
// ============================================

function wrapTextStream(
  textStream: AsyncIterable<string>,
  result: StreamTextResult,
  fetchClient: FetchClient,
  ctx: {
    traceId: string | undefined
    spanId: string | undefined
    createdTrace: boolean
    model: { id: string; provider: string }
    captureOutput: boolean
    traceToolCalls: boolean
    debug: boolean
  }
): AsyncIterable<string> {
  const { traceId, spanId, createdTrace, model, captureOutput, traceToolCalls, debug } = ctx
  let fullText = ''

  async function* wrappedStream(): AsyncGenerator<string> {
    try {
      for await (const chunk of textStream) {
        fullText += chunk
        yield chunk
      }

      // Stream completed - get final values
      const [usage, toolCalls, toolResults] = await Promise.all([
        result.usage,
        result.toolCalls,
        result.toolResults
      ])

      // Create tool spans
      if (traceToolCalls && spanId && traceId && toolCalls?.length) {
        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i]
          const tr = toolResults?.[i]
          await createToolSpan(fetchClient, traceId, spanId, tc, tr, debug)
        }
      }

      // Update span
      if (spanId) {
        const promptTokens = usage?.promptTokens || 0
        const outputTokens = usage?.completionTokens || 0

        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: captureOutput ? { text: fullText } : undefined,
          promptTokens,
          outputTokens,
          cost: estimateCost(model.id, promptTokens, outputTokens)
        })
      }

      // Complete trace
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, {
          status: 'COMPLETED',
          output: captureOutput ? { text: fullText } : undefined
        })
      }
    } catch (error) {
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        }).catch((e: unknown) => {
          if (debug) {
            console.warn('[AgentGov] Failed to update span on error:', e)
          }
        })
      }
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' }).catch((e: unknown) => {
          if (debug) {
            console.warn('[AgentGov] Failed to update trace on error:', e)
          }
        })
      }
      throw error
    }
  }

  return wrappedStream()
}

async function createVercelToolSpans(
  result: GenerateTextResult,
  fetchClient: FetchClient,
  traceId: string,
  parentSpanId: string,
  debug?: boolean
): Promise<void> {
  const toolCalls = result.toolCalls
  const toolResults = result.toolResults

  if (!toolCalls?.length) return

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i]
    const tr = toolResults?.[i]
    await createToolSpan(fetchClient, traceId, parentSpanId, tc, tr, debug)
  }
}

async function createToolSpan(
  fetchClient: FetchClient,
  traceId: string,
  parentSpanId: string,
  toolCall: VercelAIToolCall,
  toolResult?: VercelAIToolResult,
  debug?: boolean
): Promise<void> {
  try {
    const span = await fetchClient.createSpan({
      traceId,
      parentId: parentSpanId,
      name: toolCall.toolName,
      type: 'TOOL_CALL' as SpanType,
      toolName: toolCall.toolName,
      toolInput: toolCall.args,
      metadata: { toolCallId: toolCall.toolCallId }
    })

    await fetchClient.updateSpan(span.id, {
      status: 'COMPLETED',
      toolOutput: toolResult?.result as Record<string, unknown> | undefined
    })
  } catch (error) {
    if (debug) {
      console.warn('[AgentGov] Failed to record tool call span:', error)
    }
  }
}

function extractModelInfo(model: unknown): { id: string; provider: string } {
  if (model && typeof model === 'object') {
    const m = model as VercelAIModel
    return {
      id: m.modelId || 'unknown',
      provider: m.provider || 'unknown'
    }
  }
  return { id: 'unknown', provider: 'unknown' }
}
