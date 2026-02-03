import type { WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import { logger } from './logger.js'
import type {
  WSClient,
  WSServerMessage,
  WSClientMessage,
  WSChannel,
  WSBroadcastOptions,
  WSTraceCreated,
  WSSpanCreated,
  WSTraceUpdated
} from '../types/websocket.js'

// Rate limiting configuration
const MAX_MESSAGES_PER_SECOND = 10
const RATE_LIMIT_WINDOW_MS = 1000
const CLEANUP_INTERVAL_MS = 60000 // Clean up stale entries every minute

class WebSocketManager {
  private clients: Map<string, WSClient> = new Map()
  private messageTimestamps: Map<string, number[]> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Start periodic cleanup to prevent memory leaks from stale rate limit entries
    this.startPeriodicCleanup()
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      // Remove rate limit entries for disconnected clients or entries older than 1 minute
      for (const [clientId, timestamps] of this.messageTimestamps) {
        // Remove if client no longer connected
        if (!this.clients.has(clientId)) {
          this.messageTimestamps.delete(clientId)
          continue
        }
        // Remove stale timestamps (older than cleanup interval)
        const activeTimestamps = timestamps.filter(t => now - t < CLEANUP_INTERVAL_MS)
        if (activeTimestamps.length === 0) {
          this.messageTimestamps.delete(clientId)
        } else if (activeTimestamps.length !== timestamps.length) {
          this.messageTimestamps.set(clientId, activeTimestamps)
        }
      }
    }, CLEANUP_INTERVAL_MS)
  }

  // Call this when shutting down the server
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.socket.close(1000, 'Server shutting down')
      } catch {
        // Ignore errors during shutdown
      }
      this.clients.delete(clientId)
    }
    this.messageTimestamps.clear()
  }

  // ============================================
  // Rate Limiting
  // ============================================

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now()
    const timestamps = this.messageTimestamps.get(clientId) || []
    const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)

    if (recentTimestamps.length >= MAX_MESSAGES_PER_SECOND) {
      return false
    }

    this.messageTimestamps.set(clientId, [...recentTimestamps, now])
    return true
  }

  private cleanupRateLimitData(clientId: string): void {
    this.messageTimestamps.delete(clientId)
  }

  // ============================================
  // Connection Management
  // ============================================

  addClient(socket: WebSocket, projectId: string): string {
    const clientId = randomUUID()

    const client: WSClient = {
      id: clientId,
      socket,
      projectId,
      channels: new Set(['traces']), // Default subscription
      connectedAt: new Date()
    }

    this.clients.set(clientId, client)

    // Send connected message
    this.sendToClient(clientId, {
      type: 'connected',
      clientId
    })

    logger.info({ clientId, projectId }, '[WS] Client connected')
    return clientId
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (client) {
      this.clients.delete(clientId)
      this.cleanupRateLimitData(clientId)
      logger.info({ clientId }, '[WS] Client disconnected')
    }
  }

  getClientCount(): number {
    return this.clients.size
  }

  // ============================================
  // Message Handling
  // ============================================

  handleMessage(clientId: string, message: string): void {
    // Check rate limit
    if (!this.checkRateLimit(clientId)) {
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Rate limit exceeded. Max 10 messages per second.'
      })
      return
    }

    try {
      const parsed = JSON.parse(message) as WSClientMessage

      switch (parsed.type) {
        case 'subscribe':
          this.subscribe(clientId, parsed.channels)
          break
        case 'unsubscribe':
          this.unsubscribe(clientId, parsed.channels)
          break
        case 'ping': {
          // Send raw 'pong' string for heartbeat compatibility
          const client = this.clients.get(clientId)
          if (client?.socket.readyState === 1) {
            client.socket.send('pong')
          }
          break
        }
        default:
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Unknown message type'
          })
      }
    } catch {
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format'
      })
    }
  }

  private subscribe(clientId: string, channels: WSChannel[]): void {
    const client = this.clients.get(clientId)
    if (client) {
      channels.forEach((ch) => client.channels.add(ch))
      logger.debug({ clientId, channels }, '[WS] Client subscribed')
    }
  }

  private unsubscribe(clientId: string, channels: WSChannel[]): void {
    const client = this.clients.get(clientId)
    if (client) {
      channels.forEach((ch) => client.channels.delete(ch))
      logger.debug({ clientId, channels }, '[WS] Client unsubscribed')
    }
  }

  // ============================================
  // Broadcasting
  // ============================================

  broadcast(message: WSServerMessage, options: WSBroadcastOptions = {}): void {
    const { projectId, channel, excludeClientId } = options

    for (const [clientId, client] of this.clients) {
      // Skip excluded client
      if (excludeClientId && clientId === excludeClientId) continue

      // Filter by project
      if (projectId && client.projectId !== projectId) continue

      // Filter by channel subscription
      if (channel && !client.channels.has(channel)) continue

      this.sendToClient(clientId, message)
    }
  }

  private sendToClient(clientId: string, message: WSServerMessage): void {
    const client = this.clients.get(clientId)
    if (client && client.socket.readyState === 1) {
      // OPEN
      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        logger.error({ err: error, clientId }, '[WS] Failed to send message')
        this.removeClient(clientId)
      }
    }
  }

  // ============================================
  // Event Emitters (called from API routes)
  // ============================================

  notifyTraceCreated(trace: WSTraceCreated['data']): void {
    this.broadcast({ type: 'trace:created', data: trace }, { projectId: trace.projectId, channel: 'traces' })
  }

  notifyTraceUpdated(trace: WSTraceUpdated['data']): void {
    this.broadcast({ type: 'trace:updated', data: trace }, { projectId: trace.projectId, channel: 'traces' })
  }

  notifySpanCreated(span: WSSpanCreated['data'], projectId: string): void {
    this.broadcast({ type: 'span:created', data: span }, { projectId, channel: 'spans' })
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()
