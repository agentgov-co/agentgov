import type {
  AgentGovConfig,
  TraceContext,
  TraceInput,
  Trace,
  SpanInput,
  SpanUpdate,
  Span
} from './types.js'
import { FetchClient } from './utils/fetch.js'
import { wrapOpenAI, type WrapOpenAIOptions, type OpenAIClient } from './wrappers/openai.js'
import {
  wrapGenerateText,
  wrapStreamText,
  wrapGenerateObject,
  wrapEmbed,
  wrapEmbedMany,
  type WrapVercelAIOptions,
  type GenerateTextResult,
  type StreamTextResult,
  type GenerateObjectResult,
  type EmbedResult,
  type EmbedManyResult
} from './wrappers/vercel-ai.js'

const DEFAULT_BASE_URL = 'https://api.agentgov.co'

// Batch item types
interface BatchItem {
  type: 'trace' | 'span' | 'traceUpdate' | 'spanUpdate'
  data: unknown
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

// Config with required fields except onError which stays optional
type ResolvedConfig = Required<Omit<AgentGovConfig, 'onError'>> & Pick<AgentGovConfig, 'onError'>

export class AgentGov {
  private fetchClient: FetchClient
  private config: ResolvedConfig
  private currentContext: TraceContext | null = null

  // Batching
  private batchQueue: BatchItem[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private isFlushing = false

  constructor(config: AgentGovConfig) {
    this.config = {
      baseUrl: DEFAULT_BASE_URL,
      debug: false,
      flushInterval: 5000,
      batchSize: 10,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config
    }

    // Warn about non-HTTPS URLs in production
    const parsedUrl = new URL(this.config.baseUrl)
    const isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'
    if (parsedUrl.protocol !== 'https:' && !isLocal) {
      console.warn(
        '[AgentGov] WARNING: Using non-HTTPS URL. This is insecure in production.'
      )
    }

    this.fetchClient = new FetchClient({
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      projectId: this.config.projectId,
      debug: this.config.debug,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      timeout: this.config.timeout
    })
  }

  // ============================================
  // OpenAI Integration
  // ============================================

  /**
   * Wrap OpenAI client to automatically trace all calls
   *
   * @example
   * ```typescript
   * const ag = new AgentGov({ apiKey: 'ag_xxx', projectId: 'xxx' })
   * const openai = ag.wrapOpenAI(new OpenAI())
   *
   * // All calls are now automatically traced (including streaming)
   * const response = await openai.chat.completions.create({
   *   model: 'gpt-4o',
   *   messages: [{ role: 'user', content: 'Hello!' }]
   * })
   * ```
   */
  wrapOpenAI<T extends OpenAIClient>(client: T, options?: WrapOpenAIOptions): T {
    return wrapOpenAI(client, this.fetchClient, () => this.currentContext, {
      ...options,
      debug: options?.debug ?? this.config.debug
    })
  }

  // ============================================
  // Vercel AI SDK Integration
  // ============================================

  /**
   * Wrap Vercel AI SDK's generateText function
   *
   * @example
   * ```typescript
   * import { generateText } from 'ai'
   * import { openai } from '@ai-sdk/openai'
   *
   * const ag = new AgentGov({ apiKey: 'ag_xxx', projectId: 'xxx' })
   * const tracedGenerateText = ag.wrapGenerateText(generateText)
   *
   * const { text } = await tracedGenerateText({
   *   model: openai('gpt-4o'),
   *   prompt: 'Hello!'
   * })
   * ```
   */
  wrapGenerateText<
    TArgs extends Record<string, unknown>,
    TResult extends GenerateTextResult
  >(
    fn: (args: TArgs) => Promise<TResult>,
    options?: WrapVercelAIOptions
  ): (args: TArgs) => Promise<TResult> {
    return wrapGenerateText(fn, this.fetchClient, () => this.currentContext, {
      ...options,
      debug: options?.debug ?? this.config.debug
    })
  }

  /**
   * Wrap Vercel AI SDK's streamText function
   *
   * @example
   * ```typescript
   * import { streamText } from 'ai'
   * import { openai } from '@ai-sdk/openai'
   *
   * const ag = new AgentGov({ apiKey: 'ag_xxx', projectId: 'xxx' })
   * const tracedStreamText = ag.wrapStreamText(streamText)
   *
   * const { textStream } = await tracedStreamText({
   *   model: openai('gpt-4o'),
   *   prompt: 'Hello!'
   * })
   *
   * for await (const chunk of textStream) {
   *   process.stdout.write(chunk)
   * }
   * ```
   */
  wrapStreamText<
    TArgs extends Record<string, unknown>,
    TResult extends StreamTextResult
  >(
    fn: (args: TArgs) => Promise<TResult>,
    options?: WrapVercelAIOptions
  ): (args: TArgs) => Promise<TResult> {
    return wrapStreamText(fn, this.fetchClient, () => this.currentContext, {
      ...options,
      debug: options?.debug ?? this.config.debug
    })
  }

  /**
   * Wrap Vercel AI SDK's generateObject function
   */
  wrapGenerateObject<
    TArgs extends Record<string, unknown>,
    TResult extends GenerateObjectResult
  >(
    fn: (args: TArgs) => Promise<TResult>,
    options?: WrapVercelAIOptions
  ): (args: TArgs) => Promise<TResult> {
    return wrapGenerateObject(fn, this.fetchClient, () => this.currentContext, {
      ...options,
      debug: options?.debug ?? this.config.debug
    })
  }

  /**
   * Wrap Vercel AI SDK's embed function
   */
  wrapEmbed<
    TArgs extends Record<string, unknown>,
    TResult extends EmbedResult
  >(
    fn: (args: TArgs) => Promise<TResult>,
    options?: WrapVercelAIOptions
  ): (args: TArgs) => Promise<TResult> {
    return wrapEmbed(fn, this.fetchClient, () => this.currentContext, {
      ...options,
      debug: options?.debug ?? this.config.debug
    })
  }

  /**
   * Wrap Vercel AI SDK's embedMany function
   */
  wrapEmbedMany<
    TArgs extends Record<string, unknown>,
    TResult extends EmbedManyResult
  >(
    fn: (args: TArgs) => Promise<TResult>,
    options?: WrapVercelAIOptions
  ): (args: TArgs) => Promise<TResult> {
    return wrapEmbedMany(fn, this.fetchClient, () => this.currentContext, {
      ...options,
      debug: options?.debug ?? this.config.debug
    })
  }

  // ============================================
  // Manual Tracing API
  // ============================================

  /**
   * Create a new trace
   *
   * @example
   * ```typescript
   * const trace = await ag.trace({ name: 'My Agent Run' })
   * // ... do work ...
   * await ag.endTrace(trace.id, { status: 'COMPLETED' })
   * ```
   */
  async trace(input: TraceInput = {}): Promise<Trace> {
    const trace = await this.fetchClient.createTrace(input)
    this.currentContext = { traceId: trace.id }
    return trace
  }

  /**
   * End a trace
   */
  async endTrace(
    traceId: string,
    update: { status?: 'COMPLETED' | 'FAILED'; output?: Record<string, unknown> } = {}
  ): Promise<Trace> {
    const result = await this.fetchClient.updateTrace(traceId, {
      status: update.status || 'COMPLETED',
      output: update.output
    })

    if (this.currentContext?.traceId === traceId) {
      this.currentContext = null
    }

    return result
  }

  /**
   * Create a span within current trace
   */
  async span(input: Omit<SpanInput, 'traceId'> & { traceId?: string }): Promise<Span> {
    const traceId = input.traceId || this.currentContext?.traceId

    if (!traceId) {
      throw new Error('No active trace. Call trace() first or provide traceId.')
    }

    const span = await this.fetchClient.createSpan({
      ...input,
      traceId,
      parentId: input.parentId || this.currentContext?.spanId
    })

    return span
  }

  /**
   * End a span
   */
  async endSpan(spanId: string, update: SpanUpdate = {}): Promise<Span> {
    return this.fetchClient.updateSpan(spanId, {
      status: update.status || 'COMPLETED',
      ...update
    })
  }

  // ============================================
  // Context Management
  // ============================================

  /**
   * Run a function within a trace context
   *
   * @example
   * ```typescript
   * const result = await ag.withTrace({ name: 'My Operation' }, async (ctx) => {
   *   // All OpenAI calls within this function are traced
   *   const response = await openai.chat.completions.create(...)
   *   return response
   * })
   * ```
   */
  async withTrace<T>(
    input: TraceInput,
    fn: (context: TraceContext) => Promise<T>
  ): Promise<T> {
    const trace = await this.trace(input)

    try {
      const result = await fn({ traceId: trace.id })
      await this.endTrace(trace.id, { status: 'COMPLETED' })
      return result
    } catch (error) {
      await this.endTrace(trace.id, { status: 'FAILED' })
      throw error
    }
  }

  /**
   * Run a function within a span context
   */
  async withSpan<T>(
    input: Omit<SpanInput, 'traceId'> & { traceId?: string },
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = await this.span(input)
    const previousSpanId = this.currentContext?.spanId

    if (this.currentContext) {
      this.currentContext.spanId = span.id
    }

    try {
      const result = await fn(span)
      await this.endSpan(span.id, { status: 'COMPLETED' })
      return result
    } catch (error) {
      await this.endSpan(span.id, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    } finally {
      if (this.currentContext) {
        this.currentContext.spanId = previousSpanId
      }
    }
  }

  // ============================================
  // Batching API (for high-throughput scenarios)
  // ============================================

  /**
   * Queue a trace creation (batched)
   * Use this for high-throughput scenarios where you don't need immediate response
   */
  queueTrace(input: TraceInput): Promise<Trace> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        type: 'trace',
        data: input,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      this.scheduleBatchFlush()
    })
  }

  /**
   * Queue a span creation (batched)
   */
  queueSpan(input: SpanInput): Promise<Span> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        type: 'span',
        data: input,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      this.scheduleBatchFlush()
    })
  }

  /**
   * Force flush all queued items
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    await this.processBatch()
  }

  private handleFlushError(error: unknown, itemCount: number): void {
    const err = error instanceof Error ? error : new Error(String(error))

    if (this.config.onError) {
      this.config.onError(err, { operation: 'batch_flush', itemCount })
    } else if (this.config.debug) {
      console.error('[AgentGov] Batch flush failed:', err.message)
    }
    // In non-debug mode without onError callback, errors are silently dropped
    // This is intentional for SDK users who don't want tracing to affect their app
  }

  private scheduleBatchFlush(): void {
    // Immediate flush if batch is full
    if (this.batchQueue.length >= this.config.batchSize) {
      const itemCount = this.batchQueue.length
      this.flush().catch((error) => this.handleFlushError(error, itemCount))
      return
    }

    // Schedule flush after interval
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null
        const itemCount = this.batchQueue.length
        this.flush().catch((error) => this.handleFlushError(error, itemCount))
      }, this.config.flushInterval)
    }
  }

  private async processBatch(): Promise<void> {
    if (this.isFlushing || this.batchQueue.length === 0) return

    this.isFlushing = true
    const items = this.batchQueue.splice(0, this.config.batchSize)

    try {
      // Process items in parallel
      await Promise.all(
        items.map(async (item) => {
          try {
            let result: unknown
            switch (item.type) {
              case 'trace':
                result = await this.fetchClient.createTrace(item.data as TraceInput)
                break
              case 'span':
                result = await this.fetchClient.createSpan(item.data as SpanInput)
                break
              case 'traceUpdate': {
                const { id, ...update } = item.data as { id: string } & Record<string, unknown>
                result = await this.fetchClient.updateTrace(id, update)
                break
              }
              case 'spanUpdate': {
                const { id, ...update } = item.data as { id: string } & SpanUpdate
                result = await this.fetchClient.updateSpan(id, update)
                break
              }
            }
            item.resolve(result)
          } catch (error) {
            item.reject(error instanceof Error ? error : new Error(String(error)))
          }
        })
      )
    } finally {
      this.isFlushing = false

      // Process remaining items if any
      if (this.batchQueue.length > 0) {
        this.scheduleBatchFlush()
      }
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get current trace context
   */
  getContext(): TraceContext | null {
    return this.currentContext
  }

  /**
   * Set trace context (useful for distributed tracing)
   */
  setContext(context: TraceContext | null): void {
    this.currentContext = context
  }

  /**
   * Get a trace by ID
   */
  async getTrace(traceId: string): Promise<Trace> {
    return this.fetchClient.getTrace(traceId)
  }

  /**
   * Get a span by ID
   */
  async getSpan(spanId: string): Promise<Span> {
    return this.fetchClient.getSpan(spanId)
  }

  /**
   * Shutdown the client, flushing any remaining batched items
   */
  async shutdown(): Promise<void> {
    await this.flush()
  }
}
