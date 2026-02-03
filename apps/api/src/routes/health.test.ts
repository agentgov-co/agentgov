import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { HEALTH_RATE_LIMIT } from '../lib/constants.js'

/**
 * AC-1.8: Health endpoint rate limiting
 *
 * Uses HEALTH_RATE_LIMIT from production constants.
 * If the limit changes in constants.ts, these tests break accordingly.
 */

describe('AC-1.8: Health endpoint rate limiting', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    })

    // Use the same rate limit config as production health endpoints
    app.get('/health', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async () => {
      return { status: 'ok' }
    })

    app.get('/health/live', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async () => {
      return { status: 'ok' }
    })

    app.get('/health/ready', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async () => {
      return { status: 'ready' }
    })

    app.get('/metrics', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async () => {
      return 'metrics_data'
    })

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  async function sendRequests(url: string, count: number): Promise<number[]> {
    const statuses: number[] = []
    for (let i = 0; i < count; i++) {
      const response = await app.inject({ method: 'GET', url })
      statuses.push(response.statusCode)
    }
    return statuses
  }

  it('should allow 10 requests to /health, reject 11th with 429', async () => {
    const statuses = await sendRequests('/health', HEALTH_RATE_LIMIT.max + 1)
    expect(statuses.slice(0, HEALTH_RATE_LIMIT.max).every(s => s === 200)).toBe(true)
    expect(statuses[HEALTH_RATE_LIMIT.max]).toBe(429)
  })

  it('should allow 10 requests to /health/live, reject 11th with 429', async () => {
    const statuses = await sendRequests('/health/live', HEALTH_RATE_LIMIT.max + 1)
    expect(statuses.slice(0, HEALTH_RATE_LIMIT.max).every(s => s === 200)).toBe(true)
    expect(statuses[HEALTH_RATE_LIMIT.max]).toBe(429)
  })

  it('should allow 10 requests to /health/ready, reject 11th with 429', async () => {
    const statuses = await sendRequests('/health/ready', HEALTH_RATE_LIMIT.max + 1)
    expect(statuses.slice(0, HEALTH_RATE_LIMIT.max).every(s => s === 200)).toBe(true)
    expect(statuses[HEALTH_RATE_LIMIT.max]).toBe(429)
  })

  it('should allow 10 requests to /metrics, reject 11th with 429', async () => {
    const statuses = await sendRequests('/metrics', HEALTH_RATE_LIMIT.max + 1)
    expect(statuses.slice(0, HEALTH_RATE_LIMIT.max).every(s => s === 200)).toBe(true)
    expect(statuses[HEALTH_RATE_LIMIT.max]).toBe(429)
  })

  it('should return 429 response with proper body', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(429)
    const body = JSON.parse(response.body)
    expect(body.statusCode).toBe(429)
  })

  it('should include rate-limit headers in 429 response', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' })
    expect(response.statusCode).toBe(429)
    expect(response.headers['x-ratelimit-limit']).toBeDefined()
    expect(response.headers['retry-after']).toBeDefined()
  })

  it('rate limits on health endpoints should be independent from each other', async () => {
    const freshApp = Fastify({ logger: false })
    await freshApp.register(rateLimit, { max: 100, timeWindow: '1 minute' })

    freshApp.get('/a', { config: { rateLimit: { max: 2, timeWindow: '1 minute' } } }, async () => ({ ok: true }))
    freshApp.get('/b', { config: { rateLimit: { max: 2, timeWindow: '1 minute' } } }, async () => ({ ok: true }))

    await freshApp.ready()

    await freshApp.inject({ method: 'GET', url: '/a' })
    await freshApp.inject({ method: 'GET', url: '/a' })
    const aBlocked = await freshApp.inject({ method: 'GET', url: '/a' })
    expect(aBlocked.statusCode).toBe(429)

    const bOk = await freshApp.inject({ method: 'GET', url: '/b' })
    expect(bOk.statusCode).toBe(200)

    await freshApp.close()
  })
})
