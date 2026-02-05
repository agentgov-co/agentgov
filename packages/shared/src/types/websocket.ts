// ============================================
// Shared WebSocket types (API + Web)
// ============================================

// Channels
export type WSChannel = 'traces' | 'spans'

// Server → Client Messages

export interface WSTraceCreated {
  type: 'trace:created'
  data: {
    id: string
    projectId: string
    name: string | null
    status: string
    startTime: string
    endTime: string | null
    metadata: Record<string, unknown> | null
    createdAt: string
  }
}

export interface WSSpanCreated {
  type: 'span:created'
  data: {
    id: string
    traceId: string
    parentSpanId: string | null
    name: string
    type: string
    status: string
    startTime: string
    endTime: string | null
    input: unknown | null
    output: unknown | null
    model: string | null
    tokenUsage: Record<string, number> | null
    cost: number | null
    metadata: Record<string, unknown> | null
    createdAt: string
  }
}

export interface WSTraceUpdated {
  type: 'trace:updated'
  data: {
    id: string
    projectId: string
    status: string
    endTime: string | null
  }
}

export interface WSBatchSpansCreated {
  type: 'spans:batch-created'
  data: {
    traceId: string
    count: number
  }
}

export interface WSConnected {
  type: 'connected'
  clientId: string
}

export interface WSError {
  type: 'error'
  message: string
}

export interface WSPong {
  type: 'pong'
  timestamp: number
}

export type WSServerMessage =
  | WSTraceCreated
  | WSSpanCreated
  | WSTraceUpdated
  | WSBatchSpansCreated
  | WSConnected
  | WSError
  | WSPong

// Client → Server Messages

export interface WSSubscribe {
  type: 'subscribe'
  channels: WSChannel[]
}

export interface WSUnsubscribe {
  type: 'unsubscribe'
  channels: WSChannel[]
}

export interface WSPing {
  type: 'ping'
}

export type WSClientMessage = WSSubscribe | WSUnsubscribe | WSPing
