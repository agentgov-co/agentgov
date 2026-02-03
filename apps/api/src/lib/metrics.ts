import client from 'prom-client'

// Create a Registry to register the metrics
const register = new client.Registry()

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register })

// HTTP request counter
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
})

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

// WebSocket connections gauge
export const wsConnectionsActive = new client.Gauge({
  name: 'ws_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
})

// Database query duration histogram
export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
})

// Traces created counter
export const tracesCreatedTotal = new client.Counter({
  name: 'traces_created_total',
  help: 'Total number of traces created',
  labelNames: ['project_id'],
  registers: [register],
})

// Spans created counter
export const spansCreatedTotal = new client.Counter({
  name: 'spans_created_total',
  help: 'Total number of spans created',
  labelNames: ['project_id', 'span_type'],
  registers: [register],
})

// Cache hit/miss counter
export const cacheOperationsTotal = new client.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'],
  registers: [register],
})

// Export the registry for the /metrics endpoint
export { register }

// Helper to record HTTP request metrics
export function recordHttpRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number
): void {
  // Normalize path to avoid high cardinality (remove IDs)
  const normalizedPath = path
    .replace(/\/[a-z0-9]{24,}/gi, '/:id') // Replace long IDs
    .replace(/\/[0-9]+/g, '/:id') // Replace numeric IDs
    .split('?')[0] // Remove query string

  httpRequestsTotal.inc({ method, path: normalizedPath, status: String(status) })
  httpRequestDuration.observe(
    { method, path: normalizedPath, status: String(status) },
    durationMs / 1000
  )
}

// Helper to record database query metrics
export function recordDbQuery(operation: string, durationMs: number): void {
  dbQueryDuration.observe({ operation }, durationMs / 1000)
}

// Helper to update WebSocket connection count
export function setWsConnectionCount(count: number): void {
  wsConnectionsActive.set(count)
}

// Helper to record trace creation
export function recordTraceCreated(projectId: string): void {
  tracesCreatedTotal.inc({ project_id: projectId })
}

// Helper to record span creation
export function recordSpanCreated(projectId: string, spanType: string): void {
  spansCreatedTotal.inc({ project_id: projectId, span_type: spanType })
}

// Helper to record cache operation
export function recordCacheOperation(operation: 'get' | 'set' | 'delete', hit: boolean): void {
  cacheOperationsTotal.inc({
    operation,
    result: operation === 'get' ? (hit ? 'hit' : 'miss') : 'success',
  })
}
