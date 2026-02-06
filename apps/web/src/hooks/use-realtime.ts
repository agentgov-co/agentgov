'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import { useQueryClient } from '@tanstack/react-query'
import { traceKeys } from '@/hooks/use-traces'
import { wsApi } from '@/lib/api'
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

/** Fetch a one-time WS auth ticket from the API */
async function fetchTicket(projectId: string): Promise<string> {
  const { ticket } = await wsApi.getTicket(projectId)
  return ticket
}

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
  const [ticket, setTicket] = useState<string | null>(null)
  // Ref mirror of ticket for use inside callbacks (avoids stale closure)
  const ticketRef = useRef(ticket)
  useEffect(() => { ticketRef.current = ticket }, [ticket])

  // Fetch a one-time WebSocket auth ticket when enabled/projectId changes
  useEffect(() => {
    if (!enabled || projectId === 'default') return

    let cancelled = false

    fetchTicket(projectId)
      .then((t) => {
        if (!cancelled) setTicket(t)
      })
      .catch((err) => {
        console.error('[WS] Failed to get auth ticket:', err)
      })

    return () => {
      cancelled = true
      // Reset ticket on cleanup so a fresh one is fetched on next mount
      setTicket(null)
    }
  }, [enabled, projectId])

  // Only connect once we have a ticket
  const wsUrl = enabled && ticket
    ? `${WS_URL}?projectId=${projectId}`
    : null

  // WebSocket connection
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    wsUrl,
    {
      shouldReconnect: () => {
        reconnectAttempts.current += 1
        if (reconnectAttempts.current >= 10) return false

        // Need a fresh ticket for reconnection — triggers re-fetch via state change
        setTicket(null)
        fetchTicket(projectId)
          .then((t) => setTicket(t))
          .catch((err) => {
            console.error('[WS] Failed to get reconnect ticket:', err)
          })

        return true
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
        // Send ticket-based auth as first message (read from ref to avoid stale closure)
        const currentTicket = ticketRef.current
        if (currentTicket) {
          sendMessage(
            JSON.stringify({
              type: 'auth',
              ticket: currentTicket
            })
          )
        }
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
        case 'connected':
          // Auth succeeded — now subscribe to channels
          sendMessage(
            JSON.stringify({
              type: 'subscribe',
              channels
            })
          )
          break

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

        case 'error':
          console.error('[WS] Server error:', message.message)
          break
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error)
    }
  }, [lastMessage, queryClient, onTraceCreated, onTraceUpdated, onSpanCreated, sendMessage, channels])

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
