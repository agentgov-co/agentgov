import { describe, it, expect, vi, beforeEach } from 'vitest'
import { wrapOpenAI, type OpenAIClient } from './openai.js'
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

// Mock OpenAI client
function createMockOpenAIClient(): OpenAIClient {
  return {
    chat: {
      completions: {
        create: vi.fn()
      }
    },
    embeddings: {
      create: vi.fn()
    }
  }
}

describe('wrapOpenAI', () => {
  let mockFetchClient: FetchClient
  let mockOpenAI: OpenAIClient
  let context: TraceContext | null

  beforeEach(() => {
    mockFetchClient = createMockFetchClient()
    mockOpenAI = createMockOpenAIClient()
    context = null
    vi.clearAllMocks()
  })

  describe('chat.completions.create', () => {
    it('should trace non-streaming completion', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockResponse)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context)
      const result = await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      })

      expect(result).toEqual(mockResponse)
      expect(mockFetchClient.createTrace).toHaveBeenCalledTimes(1)
      expect(mockFetchClient.createSpan).toHaveBeenCalledTimes(1)
      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'COMPLETED',
        promptTokens: 10,
        outputTokens: 5
      }))
      expect(mockFetchClient.updateTrace).toHaveBeenCalledWith('trace-123', expect.objectContaining({
        status: 'COMPLETED'
      }))
    })

    it('should use existing trace context', async () => {
      context = { traceId: 'existing-trace' }

      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockResponse)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context)
      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      })

      // Should not create new trace when context exists
      expect(mockFetchClient.createTrace).not.toHaveBeenCalled()
      // Should create span with existing traceId
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        traceId: 'existing-trace'
      }))
      // Should not update trace (we didn't create it)
      expect(mockFetchClient.updateTrace).not.toHaveBeenCalled()
    })

    it('should handle streaming response', async () => {
      const chunks = [
        { id: 'chunk-1', model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] },
        { id: 'chunk-2', model: 'gpt-4o', choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] },
        { id: 'chunk-3', model: 'gpt-4o', choices: [{ index: 0, delta: { content: ' world!' }, finish_reason: null }] },
        { id: 'chunk-4', model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } }
      ]

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk
        }
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockStream())

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context)
      const stream = await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true
      })

      // Consume the stream
      const receivedChunks: unknown[] = []
      for await (const chunk of stream as AsyncIterable<unknown>) {
        receivedChunks.push(chunk)
      }

      expect(receivedChunks).toHaveLength(4)
      expect(mockFetchClient.createTrace).toHaveBeenCalledTimes(1)
      expect(mockFetchClient.createSpan).toHaveBeenCalledTimes(1)

      // After stream completes, span should be updated
      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'COMPLETED',
        promptTokens: 10,
        outputTokens: 3
      }))
    })

    it('should trace tool calls', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"London"}' }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 }
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockResponse)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context, { traceToolCalls: true })
      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What is the weather?' }]
      })

      // Should create main span + tool call span
      expect(mockFetchClient.createSpan).toHaveBeenCalledTimes(2)
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'get_weather',
        type: 'TOOL_CALL',
        toolName: 'get_weather',
        toolInput: { city: 'London' }
      }))
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('API rate limit exceeded')
      vi.mocked(mockOpenAI.chat.completions.create).mockRejectedValue(error)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context)

      await expect(wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      })).rejects.toThrow('API rate limit exceeded')

      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'FAILED',
        error: 'API rate limit exceeded'
      }))
      expect(mockFetchClient.updateTrace).toHaveBeenCalledWith('trace-123', { status: 'FAILED' })
    })

    it('should respect captureInput option', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockResponse)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context, { captureInput: false })
      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Secret message' }]
      })

      expect(mockFetchClient.createTrace).toHaveBeenCalledWith(expect.objectContaining({
        input: undefined
      }))
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        input: undefined
      }))
    })

    it('should respect captureOutput option', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Secret response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockResponse)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context, { captureOutput: false })
      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      })

      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        output: undefined
      }))
    })

    it('should skip tracing when autoTrace is false and no context', async () => {
      context = null

      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockResponse)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context, { autoTrace: false })
      const result = await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }]
      })

      expect(result).toEqual(mockResponse)
      expect(mockFetchClient.createTrace).not.toHaveBeenCalled()
      expect(mockFetchClient.createSpan).not.toHaveBeenCalled()
    })
  })

  describe('embeddings.create', () => {
    it('should trace embeddings', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        usage: { prompt_tokens: 8, completion_tokens: 0, total_tokens: 8 }
      }

      vi.mocked(mockOpenAI.embeddings.create).mockResolvedValue(mockResponse)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context)
      const result = await wrapped.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Hello world'
      })

      expect(result).toEqual(mockResponse)
      expect(mockFetchClient.createTrace).toHaveBeenCalledTimes(1)
      expect(mockFetchClient.createSpan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'embeddings.create',
        type: 'EMBEDDING',
        model: 'text-embedding-3-small'
      }))
      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'COMPLETED',
        promptTokens: 8,
        outputTokens: 0
      }))
    })

    it('should handle embedding errors', async () => {
      const error = new Error('Invalid input')
      vi.mocked(mockOpenAI.embeddings.create).mockRejectedValue(error)

      const wrapped = wrapOpenAI(mockOpenAI, mockFetchClient, () => context)

      await expect(wrapped.embeddings.create({
        model: 'text-embedding-3-small',
        input: ''
      })).rejects.toThrow('Invalid input')

      expect(mockFetchClient.updateSpan).toHaveBeenCalledWith('span-456', expect.objectContaining({
        status: 'FAILED',
        error: 'Invalid input'
      }))
    })
  })
})
