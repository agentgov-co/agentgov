import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReadyState } from 'react-use-websocket'
import { useRealtime } from './use-realtime'

// ── Mocks ──────────────────────────────────────────────

const mockSendMessage = vi.fn()
let mockLastMessage: { data: string; timeStamp: number } | null = null
let mockReadyState = ReadyState.CLOSED
let capturedOptions: Record<string, unknown> = {}

vi.mock('react-use-websocket', () => ({
  ReadyState: { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3, UNINSTANTIATED: -1 },
  default: (_url: string | null, options: Record<string, unknown>) => {
    // Always capture latest options from the most recent render
    capturedOptions = options
    return {
      sendMessage: mockSendMessage,
      lastMessage: mockLastMessage,
      readyState: mockReadyState,
    }
  },
}))

const mockGetTicket = vi.fn()

vi.mock('@/lib/api', () => ({
  wsApi: {
    getTicket: (...args: unknown[]) => mockGetTicket(...args),
  },
}))

const mockInvalidateQueries = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

vi.mock('@/hooks/use-traces', () => ({
  traceKeys: {
    all: ['traces'],
    lists: () => ['traces', 'list'],
    detail: (id: string) => ['traces', 'detail', id],
  },
}))

// ── Tests ──────────────────────────────────────────────

describe('useRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLastMessage = null
    mockReadyState = ReadyState.CLOSED
    capturedOptions = {}
    mockGetTicket.mockReset()
  })

  describe('ticket-based auth flow', () => {
    it('fetches a ticket before connecting', async () => {
      mockGetTicket.mockResolvedValue({ ticket: 'test-ticket-123' })

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      expect(mockGetTicket).toHaveBeenCalledWith('proj_1')
    })

    it('does not fetch ticket when disabled', () => {
      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: false })
      )

      expect(mockGetTicket).not.toHaveBeenCalled()
    })

    it('does not fetch ticket for default projectId', () => {
      renderHook(() =>
        useRealtime({ enabled: true })
      )

      expect(mockGetTicket).not.toHaveBeenCalled()
    })

    it('sends auth message with ticket on WebSocket open', async () => {
      // Use a deferred promise so we can control when ticket resolves
      let resolveTicket!: (value: { ticket: string }) => void
      mockGetTicket.mockImplementation(() => new Promise((resolve) => {
        resolveTicket = resolve
      }))

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      // Resolve the ticket fetch and wait for state update + re-render
      await act(async () => {
        resolveTicket({ ticket: 'test-ticket-456' })
      })

      // After re-render, onOpen should have access to the latest ticketRef
      const onOpen = capturedOptions.onOpen as (() => void) | undefined
      expect(onOpen).toBeDefined()
      act(() => { onOpen!() })

      expect(mockSendMessage).toHaveBeenCalledWith(
        JSON.stringify({ type: 'auth', ticket: 'test-ticket-456' })
      )
    })

    it('handles ticket fetch failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetTicket.mockRejectedValue(new Error('Network error'))

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[WS] Failed to get auth ticket:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })

    it('fetches fresh ticket on projectId change', async () => {
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-a' })

      const { rerender } = renderHook(
        ({ projectId }) => useRealtime({ projectId, enabled: true }),
        { initialProps: { projectId: 'proj_1' } }
      )

      await waitFor(() => {
        expect(mockGetTicket).toHaveBeenCalledWith('proj_1')
      })

      mockGetTicket.mockResolvedValue({ ticket: 'ticket-b' })

      rerender({ projectId: 'proj_2' })

      await waitFor(() => {
        expect(mockGetTicket).toHaveBeenCalledWith('proj_2')
      })
    })
  })

  describe('message handling', () => {
    it('subscribes to channels after receiving connected message', async () => {
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })
      mockReadyState = ReadyState.OPEN
      mockLastMessage = {
        data: JSON.stringify({ type: 'connected', clientId: 'ws-123' }),
        timeStamp: Date.now(),
      }

      renderHook(() =>
        useRealtime({
          projectId: 'proj_1',
          enabled: true,
          channels: ['traces'],
        })
      )

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(
          JSON.stringify({ type: 'subscribe', channels: ['traces'] })
        )
      })
    })

    it('invalidates queries on trace:created', async () => {
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })
      mockReadyState = ReadyState.OPEN
      mockLastMessage = {
        data: JSON.stringify({
          type: 'trace:created',
          data: { id: 'trace-1', projectId: 'proj_1' },
        }),
        timeStamp: Date.now(),
      }

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ['traces', 'list'],
        })
      })
    })

    it('calls onTraceCreated callback', async () => {
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })
      const onTraceCreated = vi.fn()
      mockReadyState = ReadyState.OPEN
      const traceMsg = {
        type: 'trace:created',
        data: { id: 'trace-1', projectId: 'proj_1' },
      }
      mockLastMessage = {
        data: JSON.stringify(traceMsg),
        timeStamp: Date.now(),
      }

      renderHook(() =>
        useRealtime({
          projectId: 'proj_1',
          enabled: true,
          onTraceCreated,
        })
      )

      await waitFor(() => {
        expect(onTraceCreated).toHaveBeenCalledWith(traceMsg)
      })
    })

    it('logs server error messages', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })
      mockReadyState = ReadyState.OPEN
      mockLastMessage = {
        data: JSON.stringify({ type: 'error', message: 'Auth failed' }),
        timeStamp: Date.now(),
      }

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[WS] Server error:',
          'Auth failed'
        )
      })

      consoleSpy.mockRestore()
    })
  })

  describe('reconnection', () => {
    it('fetches fresh ticket on reconnect', async () => {
      mockGetTicket
        .mockResolvedValueOnce({ ticket: 'ticket-initial' })
        .mockResolvedValueOnce({ ticket: 'ticket-reconnect' })

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await waitFor(() => {
        expect(mockGetTicket).toHaveBeenCalledTimes(1)
      })

      // Simulate shouldReconnect callback
      const shouldReconnect = capturedOptions.shouldReconnect as (() => boolean) | undefined
      if (shouldReconnect) {
        const result = shouldReconnect()

        expect(result).toBe(true)
        expect(mockGetTicket).toHaveBeenCalledTimes(2)
      }
    })

    it('stops reconnecting after 10 attempts', async () => {
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await waitFor(() => {
        expect(mockGetTicket).toHaveBeenCalledTimes(1)
      })

      const shouldReconnect = capturedOptions.shouldReconnect as (() => boolean) | undefined
      if (shouldReconnect) {
        // Exhaust 10 attempts
        for (let i = 0; i < 9; i++) {
          expect(shouldReconnect()).toBe(true)
        }
        // 10th attempt should return false
        expect(shouldReconnect()).toBe(false)
      }
    })
  })

  describe('connection status', () => {
    it('returns disconnected when not connected', () => {
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })
      mockReadyState = ReadyState.CLOSED

      const { result } = renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('returns connected when WebSocket is open', () => {
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })
      mockReadyState = ReadyState.OPEN

      const { result } = renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      expect(result.current.isConnected).toBe(true)
      expect(result.current.connectionStatus).toBe('connected')
    })
  })
})
