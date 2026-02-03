import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  wrapGenerateText,
  wrapStreamText,
  wrapGenerateObject,
  wrapEmbed,
  wrapEmbedMany,
  type GenerateTextResult,
  type StreamTextResult,
  type GenerateObjectResult,
  type EmbedResult,
  type EmbedManyResult
} from './vercel-ai.js'
import type { FetchClient } from '../utils/fetch.js'
import type { TraceContext } from '../types.js'

// Mock FetchClient
function createMockFetchClient(): FetchClient {
  return {
    createTrace: vi.fn().mockResolvedValue({ id: 'trace-123', status: 'RUNNING' }),
    updateTrace: vi.fn().mockResolvedValue({ id: 'trace-123', status: 'COMPLETED' }),
    getTrace: vi.fn().mockResolvedValue({ id: 'trace-123' }),
    createSpan: vi.fn().mockResolvedValue({ id: 'span-456', status: 'RUNNING' }),
    updateSpan: vi.fn().mockResolvedValue({ id: 'span-456', status: 'COMPLETED' }),
    getSpan: vi.fn().mockResolvedValue({ id: 'span-456' })
  } as unknown as FetchClient
}

// Mock model object (Vercel AI style)
const mockModel = {
  modelId: 'gpt-4o',
  provider: 'openai'
}

describe('Vercel AI Wrappers', () => {
  let mockFetchClient: FetchClient
  let context: TraceContext | null

  beforeEach(() => {
    mockFetchClient = createMockFetchClient()
    context = null
    vi.clearAllMocks()
  })

  describe('wrapGenerateText', () => {
    it('should trace generateText call', async () => {
      const mockResult: GenerateTextResult = {
        text: 'Hello, world!',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop'
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapGenerateText(originalFn, mockFetchClient, () => context)

      const result = await wrapped({ model: mockModel, prompt: 'Say hello' })

      expect(result).toEqual(mockResult)
      expect(originalFn).toHaveBeenCalledWith({ model: mockModel, prompt: 'Say hello' })
      expect(mockFetchClient.createTrace).toHaveBeenCalledTimes(1)
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'generateText',
        type: 'LLM_CALL',
        model: 'gpt-4o'
      }))
      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'COMPLETED',
        promptTokens: 10,
        outputTokens: 5
      }))
    })

    it('should use existing trace context', async () => {
      context = { traceId: 'existing-trace', spanId: 'parent-span' }

      const mockResult: GenerateTextResult = {
        text: 'Response',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        finishReason: 'stop'
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapGenerateText(originalFn, mockFetchClient, () => context)

      await wrapped({ model: mockModel, prompt: 'Hi' })

      expect(mockFetchClient.createTrace).not.toHaveBeenCalled()
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        traceId: 'existing-trace',
        parentId: 'parent-span'
      }))
    })

    it('should trace tool calls', async () => {
      const mockResult: GenerateTextResult = {
        text: '',
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: 'tool-calls',
        toolCalls: [{
          toolCallId: 'call_123',
          toolName: 'get_weather',
          args: { city: 'Paris' }
        }],
        toolResults: [{
          toolCallId: 'call_123',
          toolName: 'get_weather',
          args: { city: 'Paris' },
          result: { temp: 20 }
        }]
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapGenerateText(originalFn, mockFetchClient, () => context, { traceToolCalls: true })

      await wrapped({ model: mockModel, prompt: 'Weather in Paris?' })

      // Main span + tool call span
      expect(mockFetchClient.createSpan).toHaveBeenCalledTimes(2)
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'get_weather',
        type: 'TOOL_CALL',
        toolName: 'get_weather',
        toolInput: { city: 'Paris' }
      }))
    })

    it('should handle errors', async () => {
      const error = new Error('Model overloaded')
      const originalFn = vi.fn().mockRejectedValue(error)
      const wrapped = wrapGenerateText(originalFn, mockFetchClient, () => context)

      await expect(wrapped({ model: mockModel, prompt: 'Hi' })).rejects.toThrow('Model overloaded')

      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'FAILED',
        error: 'Model overloaded'
      }))
      expect(mockFetchClient.updateTrace).toHaveBeenCalledWith('trace-123', { status: 'FAILED' })
    })

    it('should respect captureInput/captureOutput options', async () => {
      const mockResult: GenerateTextResult = {
        text: 'Secret response',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        finishReason: 'stop'
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapGenerateText(originalFn, mockFetchClient, () => context, {
        captureInput: false,
        captureOutput: false
      })

      await wrapped({ model: mockModel, prompt: 'Secret' })

      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        input: undefined
      }))
      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        output: undefined
      }))
    })
  })

  describe('wrapStreamText', () => {
    it('should trace streaming and finalize on stream end', async () => {
      const textChunks = ['Hello', ', ', 'world', '!']

      async function* mockTextStream() {
        for (const chunk of textChunks) {
          yield chunk
        }
      }

      async function* mockFullStream() {
        yield { type: 'text-delta', textDelta: 'Hello' }
      }

      const mockResult: StreamTextResult = {
        textStream: mockTextStream(),
        fullStream: mockFullStream(),
        text: Promise.resolve('Hello, world!'),
        usage: Promise.resolve({ promptTokens: 10, completionTokens: 4, totalTokens: 14 }),
        finishReason: Promise.resolve('stop'),
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve([])
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapStreamText(originalFn, mockFetchClient, () => context)

      const result = await wrapped({ model: mockModel, prompt: 'Say hello' })

      // Consume the stream
      const chunks: string[] = []
      for await (const chunk of result.textStream) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(textChunks)
      expect(mockFetchClient.createTrace).toHaveBeenCalledTimes(1)
      expect(mockFetchClient.createSpan).toHaveBeenCalledTimes(1)

      // After stream ends, should update span
      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'COMPLETED',
        promptTokens: 10,
        outputTokens: 4
      }))
    })

    it('should handle stream errors', async () => {
      async function* errorStream(): AsyncGenerator<string> {
        yield 'Start'
        throw new Error('Stream interrupted')
      }

      const mockResult: StreamTextResult = {
        textStream: errorStream(),
        fullStream: (async function* () {})(),
        text: Promise.resolve(''),
        usage: Promise.resolve({ promptTokens: 5, completionTokens: 1, totalTokens: 6 }),
        finishReason: Promise.resolve('error'),
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve([])
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapStreamText(originalFn, mockFetchClient, () => context)

      const result = await wrapped({ model: mockModel, prompt: 'Hi' })

      const chunks: string[] = []
      await expect(async () => {
        for await (const chunk of result.textStream) {
          chunks.push(chunk)
        }
      }).rejects.toThrow('Stream interrupted')

      expect(chunks).toEqual(['Start'])
    })
  })

  describe('wrapGenerateObject', () => {
    it('should trace generateObject call', async () => {
      const mockResult: GenerateObjectResult<{ name: string }> = {
        object: { name: 'John' },
        usage: { promptTokens: 15, completionTokens: 8, totalTokens: 23 },
        finishReason: 'stop'
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapGenerateObject(originalFn, mockFetchClient, () => context)

      const result = await wrapped({ model: mockModel, prompt: 'Extract name' })

      expect(result.object).toEqual({ name: 'John' })
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'generateObject',
        type: 'LLM_CALL'
      }))
    })
  })

  describe('wrapEmbed', () => {
    it('should trace embed call', async () => {
      const mockResult: EmbedResult = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        usage: { tokens: 5 }
      }

      const embeddingModel = { modelId: 'text-embedding-3-small', provider: 'openai' }
      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapEmbed(originalFn, mockFetchClient, () => context)

      const result = await wrapped({ model: embeddingModel, value: 'Hello' })

      expect(result.embedding).toHaveLength(5)
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'embed',
        type: 'EMBEDDING',
        model: 'text-embedding-3-small'
      }))
      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'COMPLETED',
        promptTokens: 5,
        outputTokens: 0
      }))
    })
  })

  describe('wrapEmbedMany', () => {
    it('should trace embedMany call', async () => {
      const mockResult: EmbedManyResult = {
        embeddings: [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
        usage: { tokens: 15 }
      }

      const embeddingModel = { modelId: 'text-embedding-3-small', provider: 'openai' }
      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapEmbedMany(originalFn, mockFetchClient, () => context)

      const result = await wrapped({ model: embeddingModel, values: ['a', 'b', 'c'] })

      expect(result.embeddings).toHaveLength(3)
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'embedMany',
        type: 'EMBEDDING'
      }))
    })
  })

  describe('autoTrace option', () => {
    it('should skip tracing when autoTrace is false and no context', async () => {
      const mockResult: GenerateTextResult = {
        text: 'Response',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        finishReason: 'stop'
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapGenerateText(originalFn, mockFetchClient, () => null, { autoTrace: false })

      const result = await wrapped({ model: mockModel, prompt: 'Hi' })

      expect(result).toEqual(mockResult)
      expect(mockFetchClient.createTrace).not.toHaveBeenCalled()
      expect(mockFetchClient.createSpan).not.toHaveBeenCalled()
    })
  })

  describe('traceNamePrefix option', () => {
    it('should use custom trace name prefix', async () => {
      const mockResult: GenerateTextResult = {
        text: 'Response',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        finishReason: 'stop'
      }

      const originalFn = vi.fn().mockResolvedValue(mockResult)
      const wrapped = wrapGenerateText(originalFn, mockFetchClient, () => context, {
        traceNamePrefix: 'my-agent'
      })

      await wrapped({ model: mockModel, prompt: 'Hi' })

      expect(mockFetchClient.createTrace).toHaveBeenCalledWith(expect.objectContaining({
        name: 'my-agent.generateText'
      }))
    })
  })
})
