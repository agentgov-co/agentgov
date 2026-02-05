import type { WebSocket } from 'ws'

// Re-export shared types
export type {
  WSChannel,
  WSTraceCreated,
  WSSpanCreated,
  WSTraceUpdated,
  WSBatchSpansCreated,
  WSConnected,
  WSError,
  WSPong,
  WSServerMessage,
  WSSubscribe,
  WSUnsubscribe,
  WSPing,
  WSClientMessage,
} from '@agentgov/shared'

import type { WSChannel } from '@agentgov/shared'

// ============================================
// Server-only types (Connection Management)
// ============================================

export interface WSClient {
  id: string
  socket: WebSocket
  projectId: string
  channels: Set<WSChannel>
  connectedAt: Date
}

export interface WSBroadcastOptions {
  projectId?: string
  channel?: WSChannel
  excludeClientId?: string
}
