import type {
  Trace,
  TraceInput,
  Span,
  SpanInput,
  SpanUpdate
} from '../types.js'

export interface FetchClientConfig {
  baseUrl: string
  apiKey: string
  projectId: string
  debug?: boolean
  /** Max retry attempts for failed requests (default: 3) */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  retryDelay?: number
  /** Request timeout in ms (default: 30000) */
  timeout?: number
}

/** Error thrown when API request fails */
export class AgentGovAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean
  ) {
    super(message)
    this.name = 'AgentGovAPIError'
  }
}

/** Safely serialize data, handling circular references */
export function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data)
  } catch {
    return JSON.stringify({ error: 'Failed to serialize data' })
  }
}

export class FetchClient {
  private baseUrl: string
  private headers: Record<string, string>
  private projectId: string
  private debug: boolean
  private maxRetries: number
  private retryDelay: number
  private timeout: number

  constructor(config: FetchClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.projectId = config.projectId
    this.debug = config.debug ?? false
    this.maxRetries = config.maxRetries ?? 3
    this.retryDelay = config.retryDelay ?? 1000
    this.timeout = config.timeout ?? 30000
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    }
  }

  /**
   * Sanitize data for logging - removes sensitive fields
   */
  private sanitize(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data
    }
    const sensitiveKeys = ['apiKey', 'password', 'secret', 'token', 'authorization', 'input', 'output']
    const obj = data as Record<string, unknown>
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  private log(message: string, data?: unknown): void {
    if (this.debug) {
      const sanitizedData = data ? this.sanitize(data) : undefined
      console.log('[AgentGov]', message, sanitizedData ?? '')
    }
  }

  /**
   * Check if error is retryable based on status code
   */
  private isRetryable(status: number): boolean {
    // Retry on: 408 (timeout), 429 (rate limit), 5xx (server errors)
    return status === 408 || status === 429 || status >= 500
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, retryAfter?: number): number {
    if (retryAfter !== undefined && !isNaN(retryAfter) && retryAfter > 0) {
      return retryAfter * 1000
    }
    // Exponential backoff with jitter: baseDelay * 2^attempt * (0.5 to 1.5)
    const exponentialDelay = this.retryDelay * Math.pow(2, attempt)
    const jitter = 0.5 + Math.random()
    return Math.min(exponentialDelay * jitter, 30000) // Cap at 30s
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.log(`${method} ${url}${attempt > 0 ? ` (retry ${attempt})` : ''}`, body)

        // Create abort controller for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        try {
          const response = await fetch(url, {
            method,
            headers: this.headers,
            body: body ? safeStringify(body) : undefined,
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorText = await response.text()
            const retryable = this.isRetryable(response.status)

            // If retryable and we have retries left, try again
            if (retryable && attempt < this.maxRetries) {
              const retryAfterRaw = response.headers.get('Retry-After')
              const retryAfterParsed = retryAfterRaw ? parseInt(retryAfterRaw, 10) : NaN
              const delay = this.calculateDelay(
                attempt,
                !isNaN(retryAfterParsed) && retryAfterParsed > 0 ? retryAfterParsed : undefined
              )
              this.log(`Retryable error (${response.status}), waiting ${delay}ms before retry`)
              await this.sleep(delay)
              lastError = new AgentGovAPIError(
                `AgentGov API error: ${response.status} ${errorText}`,
                response.status,
                true
              )
              continue
            }

            throw new AgentGovAPIError(
              `AgentGov API error: ${response.status} ${errorText}`,
              response.status,
              retryable
            )
          }

          // Handle 204 No Content
          if (response.status === 204) {
            return undefined as T
          }

          const data = await response.json()
          this.log('Response:', data)
          return data as T
        } finally {
          clearTimeout(timeoutId)
        }
      } catch (error) {
        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new AgentGovAPIError(
            `Request timeout after ${this.timeout}ms`,
            408,
            true
          )

          if (attempt < this.maxRetries) {
            const delay = this.calculateDelay(attempt)
            this.log(`Request timed out, waiting ${delay}ms before retry`)
            await this.sleep(delay)
            continue
          }
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          lastError = new AgentGovAPIError(
            `Network error: ${error.message}`,
            0,
            true
          )

          if (attempt < this.maxRetries) {
            const delay = this.calculateDelay(attempt)
            this.log(`Network error, waiting ${delay}ms before retry`)
            await this.sleep(delay)
            continue
          }
        }

        // Re-throw AgentGovAPIError or wrap other errors
        if (error instanceof AgentGovAPIError) {
          throw error
        }

        throw error
      }
    }

    // Should not reach here, but throw last error if we do
    throw lastError || new Error('Unexpected error in request')
  }

  // ============================================
  // Traces
  // ============================================

  async createTrace(input: TraceInput): Promise<Trace> {
    return this.request<Trace>('POST', '/v1/traces', {
      ...input,
      projectId: this.projectId
    })
  }

  async updateTrace(
    traceId: string,
    update: { status?: string; output?: Record<string, unknown> }
  ): Promise<Trace> {
    return this.request<Trace>('PATCH', `/v1/traces/${traceId}`, update)
  }

  async getTrace(traceId: string): Promise<Trace> {
    return this.request<Trace>('GET', `/v1/traces/${traceId}`)
  }

  // ============================================
  // Spans
  // ============================================

  async createSpan(input: SpanInput): Promise<Span> {
    return this.request<Span>('POST', '/v1/spans', input)
  }

  async updateSpan(spanId: string, update: SpanUpdate): Promise<Span> {
    return this.request<Span>('PATCH', `/v1/spans/${spanId}`, update)
  }

  async getSpan(spanId: string): Promise<Span> {
    return this.request<Span>('GET', `/v1/spans/${spanId}`)
  }
}
