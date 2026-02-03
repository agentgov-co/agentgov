import type OpenAI from 'openai'
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions'
import type {
  EmbeddingCreateParams,
  CreateEmbeddingResponse
} from 'openai/resources/embeddings'
import type { FetchClient } from '../utils/fetch.js'
import type { TraceContext } from '../types.js'
import { estimateCost } from '../utils/timing.js'

// Re-export OpenAI types for consumers
export type { ChatCompletion, ChatCompletionChunk }
export type { EmbeddingCreateParams, CreateEmbeddingResponse }

// OpenAI client interface - compatible with OpenAI SDK
// Uses structural typing to allow any client with matching methods
export interface OpenAIClient {
  chat: {
    completions: {
      create(params: ChatCompletionCreateParamsBase): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>
    }
  }
  embeddings?: {
    create(params: EmbeddingCreateParams): Promise<CreateEmbeddingResponse>
  }
}

// Wrapped streaming response type (implements AsyncIterable but not full Stream)
export type WrappedStream<T> = AsyncIterable<T>

// Function tool call type (narrowed from union)
type FunctionToolCall = ChatCompletionMessageToolCall & {
  type: 'function'
  function: { name: string; arguments: string }
}

export interface WrapOpenAIOptions {
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

/**
 * Wrap OpenAI client to automatically trace all calls
 */
export function wrapOpenAI<T extends OpenAIClient>(
  client: T,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapOpenAIOptions = {}
): T {
  const {
    traceNamePrefix = 'openai',
    autoTrace = true,
    captureInput = true,
    captureOutput = true,
    traceToolCalls = true,
    debug = false
  } = options

  // Create a proxy that intercepts method calls
  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop as keyof T]

      // Wrap chat.completions
      if (prop === 'chat') {
        return new Proxy(target.chat, {
          get(chatTarget, chatProp) {
            if (chatProp === 'completions') {
              return new Proxy(chatTarget.completions, {
                get(completionsTarget, completionsProp) {
                  if (completionsProp === 'create') {
                    return wrapChatCompletions(
                      completionsTarget.create.bind(completionsTarget),
                      fetchClient,
                      getContext,
                      { traceNamePrefix, autoTrace, captureInput, captureOutput, traceToolCalls, debug }
                    )
                  }
                  return completionsTarget[completionsProp as keyof typeof completionsTarget]
                }
              })
            }
            return chatTarget[chatProp as keyof typeof chatTarget]
          }
        })
      }

      // Wrap embeddings (if exists)
      if (prop === 'embeddings' && target.embeddings) {
        return new Proxy(target.embeddings, {
          get(embeddingsTarget, embeddingsProp) {
            if (embeddingsProp === 'create') {
              return wrapEmbeddings(
                embeddingsTarget.create.bind(embeddingsTarget),
                fetchClient,
                getContext,
                { traceNamePrefix, autoTrace, captureInput, captureOutput, debug }
              )
            }
            return embeddingsTarget[embeddingsProp as keyof typeof embeddingsTarget]
          }
        })
      }

      return value
    }
  })
}

// Type for the original create function (simplified - accepts base params)
type ChatCompletionsCreateFn = (
  params: ChatCompletionCreateParamsBase
) => Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>

function wrapChatCompletions(
  originalFn: ChatCompletionsCreateFn,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapOpenAIOptions
): ChatCompletionsCreateFn {
  return async (params: ChatCompletionCreateParamsBase): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> => {
    const model = params.model || 'unknown'
    const isStreaming = params.stream === true
    const context = getContext()

    // Create trace if needed
    let traceId = context?.traceId
    let createdTrace = false

    if (!traceId && options.autoTrace) {
      const trace = await fetchClient.createTrace({
        name: `${options.traceNamePrefix}.chat.completions`,
        input: options.captureInput ? { messages: params.messages } : undefined,
        metadata: { model, streaming: isStreaming }
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
        name: 'chat.completions.create',
        type: 'LLM_CALL',
        model,
        input: options.captureInput ? (params as unknown as Record<string, unknown>) : undefined
      })
      spanId = span.id
    }

    try {
      // Call original function
      const response = await originalFn(params)

      // Handle streaming response
      if (isStreaming && isAsyncIterable(response)) {
        return wrapStreamingResponse(
          response,
          fetchClient,
          { traceId, spanId, createdTrace, model, options }
        )
      }

      // Handle non-streaming response
      const completion = response as ChatCompletion

      // Create tool call spans if enabled
      if (options.traceToolCalls && spanId && traceId) {
        await createToolCallSpans(completion, fetchClient, traceId, spanId, options.debug)
      }

      // Update span with results
      if (spanId) {
        const usage = completion.usage
        const promptTokens = usage?.prompt_tokens || 0
        const outputTokens = usage?.completion_tokens || 0

        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: options.captureOutput ? {
            id: completion.id,
            model: completion.model,
            choices: completion.choices,
            usage: completion.usage
          } : undefined,
          promptTokens,
          outputTokens,
          cost: estimateCost(model, promptTokens, outputTokens)
        })
      }

      // Complete trace if we created it
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, {
          status: 'COMPLETED',
          output: options.captureOutput ? {
            content: completion.choices[0]?.message?.content
          } : undefined
        })
      }

      return completion
    } catch (error) {
      // Update span with error
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // Fail trace if we created it
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' })
      }

      throw error
    }
  }
}

/**
 * Wrap streaming response to track completion
 * Note: Returns AsyncIterable, not the full OpenAI Stream type
 */
function wrapStreamingResponse(
  stream: AsyncIterable<ChatCompletionChunk>,
  fetchClient: FetchClient,
  ctx: {
    traceId: string | undefined
    spanId: string | undefined
    createdTrace: boolean
    model: string
    options: WrapOpenAIOptions
  }
): WrappedStream<ChatCompletionChunk> {
  const { traceId, spanId, createdTrace, model, options } = ctx

  // Accumulator for streaming data
  let fullContent = ''
  let promptTokens = 0
  let outputTokens = 0
  const toolCalls: Map<number, { id: string; type: string; name: string; arguments: string }> = new Map()

  async function* wrappedStream(): AsyncGenerator<ChatCompletionChunk> {
    try {
      for await (const chunk of stream) {
        // Accumulate content
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          fullContent += delta.content
        }

        // Accumulate tool calls
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCalls.get(tc.index) || { id: '', type: '', name: '', arguments: '' }
            if (tc.id) existing.id = tc.id
            if (tc.type) existing.type = tc.type
            if (tc.function?.name) existing.name = tc.function.name
            if (tc.function?.arguments) existing.arguments += tc.function.arguments
            toolCalls.set(tc.index, existing)
          }
        }

        // Get usage from final chunk
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens
          outputTokens = chunk.usage.completion_tokens
        }

        yield chunk
      }

      // Stream completed - create tool call spans
      if (options.traceToolCalls && spanId && traceId && toolCalls.size > 0) {
        for (const [, tc] of toolCalls) {
          await fetchClient.createSpan({
            traceId,
            parentId: spanId,
            name: tc.name,
            type: 'TOOL_CALL',
            toolName: tc.name,
            toolInput: parseJSON(tc.arguments),
            metadata: { toolCallId: tc.id }
          }).then(span => {
            // Mark as completed immediately (tool not executed by us)
            return fetchClient.updateSpan(span.id, { status: 'COMPLETED' })
          }).catch((error: unknown) => {
            if (options.debug) {
              console.warn('[AgentGov] Failed to record tool call span:', error)
            }
          })
        }
      }

      // Update span with final results
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: options.captureOutput ? {
            content: fullContent,
            toolCalls: toolCalls.size > 0 ? Array.from(toolCalls.values()) : undefined
          } : undefined,
          promptTokens,
          outputTokens,
          cost: estimateCost(model, promptTokens, outputTokens)
        })
      }

      // Complete trace if we created it
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, {
          status: 'COMPLETED',
          output: options.captureOutput ? { content: fullContent } : undefined
        })
      }
    } catch (error) {
      // Update span with error
      if (spanId) {
        await fetchClient.updateSpan(spanId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        }).catch((e: unknown) => {
          if (options.debug) {
            console.warn('[AgentGov] Failed to update span on error:', e)
          }
        })
      }

      // Fail trace if we created it
      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'FAILED' }).catch((e: unknown) => {
          if (options.debug) {
            console.warn('[AgentGov] Failed to update trace on error:', e)
          }
        })
      }

      throw error
    }
  }

  return wrappedStream()
}

/**
 * Type guard for function tool calls
 */
function isFunctionToolCall(tc: ChatCompletionMessageToolCall): tc is FunctionToolCall {
  return tc.type === 'function' && 'function' in tc
}

/**
 * Create spans for tool calls in non-streaming response
 */
async function createToolCallSpans(
  completion: ChatCompletion,
  fetchClient: FetchClient,
  traceId: string,
  parentSpanId: string,
  debug?: boolean
): Promise<void> {
  const toolCalls = completion.choices[0]?.message?.tool_calls
  if (!toolCalls?.length) return

  for (const tc of toolCalls) {
    // Only handle function tool calls
    if (!isFunctionToolCall(tc)) continue

    try {
      const span = await fetchClient.createSpan({
        traceId,
        parentId: parentSpanId,
        name: tc.function.name,
        type: 'TOOL_CALL',
        toolName: tc.function.name,
        toolInput: parseJSON(tc.function.arguments),
        metadata: { toolCallId: tc.id }
      })
      // Mark as completed immediately
      await fetchClient.updateSpan(span.id, { status: 'COMPLETED' })
    } catch (error) {
      if (debug) {
        console.warn('[AgentGov] Failed to record tool call span:', error)
      }
    }
  }
}

// Type for the embeddings create function
type EmbeddingsCreateFn = (params: EmbeddingCreateParams) => Promise<CreateEmbeddingResponse>

function wrapEmbeddings(
  originalFn: EmbeddingsCreateFn,
  fetchClient: FetchClient,
  getContext: () => TraceContext | null,
  options: WrapOpenAIOptions
): EmbeddingsCreateFn {
  return async (params: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> => {
    const model = params.model || 'text-embedding-ada-002'
    const context = getContext()

    let traceId = context?.traceId
    let createdTrace = false

    if (!traceId && options.autoTrace) {
      const trace = await fetchClient.createTrace({
        name: `${options.traceNamePrefix}.embeddings`,
        metadata: { model }
      })
      traceId = trace.id
      createdTrace = true
    }

    let spanId: string | undefined
    if (traceId) {
      const span = await fetchClient.createSpan({
        traceId,
        parentId: context?.spanId,
        name: 'embeddings.create',
        type: 'EMBEDDING',
        model,
        input: options.captureInput ? {
          model,
          inputLength: Array.isArray(params.input)
            ? params.input.length
            : String(params.input).length
        } : undefined
      })
      spanId = span.id
    }

    try {
      const response = await originalFn(params)

      if (spanId) {
        const usage = response.usage
        await fetchClient.updateSpan(spanId, {
          status: 'COMPLETED',
          output: { embeddingsCount: response.data.length },
          promptTokens: usage?.prompt_tokens || 0,
          outputTokens: 0,
          cost: estimateCost(model, usage?.prompt_tokens || 0, 0)
        })
      }

      if (createdTrace && traceId) {
        await fetchClient.updateTrace(traceId, { status: 'COMPLETED' })
      }

      return response
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

// Helpers
function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown> {
  return obj != null && typeof obj === 'object' && Symbol.asyncIterator in obj
}

function parseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str)
  } catch {
    return { raw: str }
  }
}
