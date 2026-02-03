// WebSocket message types for frontend

export type WSChannel = 'traces' | 'spans'

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
    model: string | null
    tokenUsage: Record<string, number> | null
    cost: number | null
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

export interface WSConnected {
  type: 'connected'
  clientId: string
}

export interface WSPong {
  type: 'pong'
  timestamp: number
}

export interface WSError {
  type: 'error'
  message: string
}

export type WSServerMessage =
  | WSTraceCreated
  | WSSpanCreated
  | WSTraceUpdated
  | WSConnected
  | WSPong
  | WSError
