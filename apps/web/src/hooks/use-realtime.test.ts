import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// ── Helpers ─────────────────────────────────────────────

function getShouldReconnect(): () => boolean {
  const fn = capturedOptions.shouldReconnect as (() => boolean) | undefined
  if (!fn) throw new Error('shouldReconnect not captured — was the hook rendered?')
  return fn
}

// ── Tests ──────────────────────────────────────────────

describe('useRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLastMessage = null
    mockReadyState = ReadyState.CLOSED
    capturedOptions = {}
    mockGetTicket.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
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
    it('always returns false — reconnection driven by URL change, not library', async () => {
      vi.useFakeTimers()
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-initial' })

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      // Flush initial ticket fetch
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })

      const shouldReconnect = getShouldReconnect()

      // Every call returns false — the library must never schedule its own reconnect
      expect(shouldReconnect()).toBe(false)
      expect(shouldReconnect()).toBe(false)
      expect(shouldReconnect()).toBe(false)
    })

    it('schedules ticket fetch with exponential backoff', async () => {
      vi.useFakeTimers()
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-initial' })

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(mockGetTicket).toHaveBeenCalledTimes(1)

      const shouldReconnect = getShouldReconnect()

      // 1st attempt: delay = min(1000 * 2^0, 30000) = 1000ms
      shouldReconnect()
      await act(async () => { await vi.advanceTimersByTimeAsync(999) })
      expect(mockGetTicket).toHaveBeenCalledTimes(1) // not yet
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(mockGetTicket).toHaveBeenCalledTimes(2) // now

      // 2nd attempt: delay = min(1000 * 2^1, 30000) = 2000ms
      shouldReconnect()
      await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
      expect(mockGetTicket).toHaveBeenCalledTimes(2) // not yet
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(mockGetTicket).toHaveBeenCalledTimes(3) // now

      // 3rd attempt: delay = min(1000 * 2^2, 30000) = 4000ms
      shouldReconnect()
      await act(async () => { await vi.advanceTimersByTimeAsync(3999) })
      expect(mockGetTicket).toHaveBeenCalledTimes(3) // not yet
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(mockGetTicket).toHaveBeenCalledTimes(4) // now
    })

    it('stops reconnecting after 10 attempts', async () => {
      vi.useFakeTimers()
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await act(async () => { await vi.advanceTimersByTimeAsync(0) })

      const shouldReconnect = getShouldReconnect()

      // Exhaust 9 attempts (all return false, but schedule a retry)
      for (let i = 0; i < 9; i++) {
        expect(shouldReconnect()).toBe(false)
      }

      // 10th attempt: max reached, returns false AND does not schedule retry
      const callsBefore = mockGetTicket.mock.calls.length
      expect(shouldReconnect()).toBe(false)

      // Advance plenty of time — no new ticket fetch should be scheduled
      await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
      expect(mockGetTicket).toHaveBeenCalledTimes(callsBefore)
    })

    it('cancels pending reconnect timeout on unmount', async () => {
      vi.useFakeTimers()
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })

      const { unmount } = renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      const callsAfterInit = mockGetTicket.mock.calls.length

      // Trigger a reconnect — schedules a delayed ticket fetch
      const shouldReconnect = getShouldReconnect()
      shouldReconnect()

      // Unmount before the backoff timer fires
      unmount()

      // Advance past any backoff delay — fetch should NOT happen
      await vi.advanceTimersByTimeAsync(60000)
      expect(mockGetTicket).toHaveBeenCalledTimes(callsAfterInit)
    })

    it('cancels previous timeout when shouldReconnect is called again', async () => {
      vi.useFakeTimers()
      mockGetTicket.mockResolvedValue({ ticket: 'ticket-1' })

      renderHook(() =>
        useRealtime({ projectId: 'proj_1', enabled: true })
      )

      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      const callsAfterInit = mockGetTicket.mock.calls.length

      const shouldReconnect = getShouldReconnect()

      // 1st attempt schedules fetch at +1000ms
      shouldReconnect()

      // Before it fires, trigger 2nd attempt — should cancel the 1st timeout
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      shouldReconnect()

      // At +1000ms from start, the 1st timeout would have fired — but it was cancelled
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(mockGetTicket).toHaveBeenCalledTimes(callsAfterInit) // no extra fetch

      // 2nd attempt fires at +500 + 2000ms = +2500ms from start
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(mockGetTicket).toHaveBeenCalledTimes(callsAfterInit + 1)
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
