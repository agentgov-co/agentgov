'use client'

import { useCallback, useEffect, useRef } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import { useQueryClient } from '@tanstack/react-query'
import { traceKeys } from '@/hooks/use-traces'
import type {
  WSServerMessage,
  WSChannel,
  WSTraceCreated,
  WSSpanCreated,
  WSTraceUpdated
} from '@/types/websocket'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws'

interface UseRealtimeOptions {
  projectId?: string
  channels?: WSChannel[]
  enabled?: boolean
  onTraceCreated?: (message: WSTraceCreated) => void
  onTraceUpdated?: (message: WSTraceUpdated) => void
  onSpanCreated?: (message: WSSpanCreated) => void
}

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'closing'
  | 'disconnected'
  | 'uninstantiated'

export function useRealtime(options: UseRealtimeOptions = {}): { isConnected: boolean; connectionStatus: ConnectionStatus; subscribe: (newChannels: WSChannel[]) => void; unsubscribe: (channelsToRemove: WSChannel[]) => void } {
  const {
    projectId = 'default',
    channels = ['traces'],
    enabled = true,
    onTraceCreated,
    onTraceUpdated,
    onSpanCreated
  } = options

  const queryClient = useQueryClient()
  const reconnectAttempts = useRef(0)
  const lastProcessedMessage = useRef<string | null>(null)

  // Reset state when disabled or projectId changes
  useEffect(() => {
    if (!enabled) {
      reconnectAttempts.current = 0
      lastProcessedMessage.current = null
    }
  }, [enabled, projectId])

  // WebSocket connection
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    enabled ? `${WS_URL}?projectId=${projectId}` : null,
    {
      shouldReconnect: () => {
        reconnectAttempts.current += 1
        return reconnectAttempts.current < 10
      },
      reconnectInterval: (attemptNumber) =>
        Math.min(1000 * Math.pow(2, attemptNumber), 30000),
      heartbeat: {
        message: JSON.stringify({ type: 'ping' }),
        returnMessage: 'pong',
        timeout: 60000,
        interval: 25000
      },
      onOpen: () => {
        reconnectAttempts.current = 0
        sendMessage(
          JSON.stringify({
            type: 'subscribe',
            channels
          })
        )
      }
    }
  )

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage?.data) return

    // Avoid reprocessing the same message when other deps change
    const messageKey = `${lastMessage.timeStamp}-${lastMessage.data}`
    if (lastProcessedMessage.current === messageKey) return
    lastProcessedMessage.current = messageKey

    try {
      const message = JSON.parse(lastMessage.data as string) as WSServerMessage

      switch (message.type) {
        case 'trace:created':
          queryClient.invalidateQueries({ queryKey: traceKeys.lists() })
          onTraceCreated?.(message)
          break

        case 'trace:updated':
          queryClient.invalidateQueries({ queryKey: traceKeys.lists() })
          queryClient.invalidateQueries({
            queryKey: traceKeys.detail(message.data.id),
          })
          onTraceUpdated?.(message)
          break

        case 'span:created':
          queryClient.invalidateQueries({
            queryKey: traceKeys.detail(message.data.traceId),
          })
          onSpanCreated?.(message)
          break

        case 'connected':
          console.warn('[WS] Connected with ID:', message.clientId)
          break

        case 'error':
          console.error('[WS] Server error:', message.message)
          break
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error)
    }
  }, [lastMessage, queryClient, onTraceCreated, onTraceUpdated, onSpanCreated])

  // Subscribe to additional channels
  const subscribe = useCallback(
    (newChannels: WSChannel[]) => {
      sendMessage(
        JSON.stringify({
          type: 'subscribe',
          channels: newChannels
        })
      )
    },
    [sendMessage]
  )

  // Unsubscribe from channels
  const unsubscribe = useCallback(
    (channelsToRemove: WSChannel[]) => {
      sendMessage(
        JSON.stringify({
          type: 'unsubscribe',
          channels: channelsToRemove
        })
      )
    },
    [sendMessage]
  )

  // Connection status
  const connectionStatus: ConnectionStatus = {
    [ReadyState.CONNECTING]: 'connecting',
    [ReadyState.OPEN]: 'connected',
    [ReadyState.CLOSING]: 'closing',
    [ReadyState.CLOSED]: 'disconnected',
    [ReadyState.UNINSTANTIATED]: 'uninstantiated'
  }[readyState] as ConnectionStatus

  return {
    isConnected: readyState === ReadyState.OPEN,
    connectionStatus,
    subscribe,
    unsubscribe
  }
}
